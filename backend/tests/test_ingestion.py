"""Integração ASGI real, SQLite temporário e unittest; sem dependência de rede externa."""

import asyncio
import copy
import json
import logging
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import Settings
from app.database import Database
from app.main import create_app
from app.seed import seed_demo
from app.security import issue_token

EXAMPLE = json.loads((Path(__file__).resolve().parent.parent / "examples/readings-batch.json").read_text())


from support import ASGITestCase


class IngestionTests(ASGITestCase):
    async def test_accepted_duplicate_conflict_and_no_overwrite(self):
        first = await self.request()
        self.assertEqual(first[0], 200)
        self.assertEqual(first[1]["results"][0]["status"], "accepted")
        second = await self.request()
        self.assertEqual(second[1]["results"][0]["status"], "duplicate")
        self.assertEqual(first[1]["results"][0]["reading_id"], second[1]["results"][0]["reading_id"])
        changed = copy.deepcopy(EXAMPLE)
        changed["readings"][0]["result"]["value"] = 70
        self.assertEqual((await self.request(data=changed))[1]["results"][0]["status"], "conflict")
        self.assertEqual(self.count(), 1)
        with self.database.connection(readonly=True) as connection:
            self.assertEqual(json.loads(connection.execute("SELECT result_json FROM readings").fetchone()[0])["value"], 42.5)

    async def test_authentication_binding_and_rotation(self):
        self.assertEqual((await self.request(token=False))[0], 401)
        self.assertEqual((await self.request(token="invalid"))[0], 401)
        other = copy.deepcopy(EXAMPLE)
        other["gateway_id"] = "gateway-other"
        self.assertEqual((await self.request(data=other))[0], 403)
        token = self.token
        self.token = issue_token(self.database, "gateway-demo-01")
        self.assertEqual((await self.request(token=token))[0], 401)
        self.assertEqual((await self.request())[0], 200)
        with self.database.connection(readonly=True) as connection:
            self.assertNotEqual(connection.execute("SELECT token_hash FROM gateways").fetchone()[0], self.token)

    async def test_envelope_failure_does_not_partially_insert(self):
        for change in [lambda b:b.update(schema_version=True), lambda b:b.update(readings=[]), lambda b:b.update(readings=b["readings"]*33), lambda b:b["readings"][0].update(sequence=True), lambda b:b["readings"][0].update(sequence=2**63), lambda b:b["readings"].append({"node_id":"missing-identity"})]:
            batch = copy.deepcopy(EXAMPLE)
            change(batch)
            self.assertEqual((await self.request(data=batch))[0], 422)
        self.assertEqual(self.count(), 0)

    async def test_mixed_batch_types_nulls_and_partial_rejection(self):
        batch = copy.deepcopy(EXAMPLE)
        zero = batch["readings"][0]
        zero["result"]["value"] = 0
        invalid = copy.deepcopy(zero)
        invalid.update(sequence=43, result={"kind":"numeric","value":True})
        category = copy.deepcopy(zero)
        category.update(sequence=44, channel_id="class-01", profile_id="class-demo", result={"kind":"categorical","value":"a"})
        boolean = copy.deepcopy(zero)
        boolean.update(sequence=45, channel_id="event-01", profile_id="event-demo", result={"kind":"boolean","value":False})
        error = copy.deepcopy(zero)
        error.update(sequence=46, quality="sensor_error", result=None)
        batch["readings"] = [zero,invalid,category,boolean,error]
        response = await self.request(data=batch)
        self.assertEqual([r["status"] for r in response[1]["results"]], ["accepted","rejected","accepted","accepted","accepted"])
        self.assertEqual(self.count(), 4)
        with self.database.connection(readonly=True) as c:
            rows = c.execute("SELECT sequence,result_json,measured_at FROM readings ORDER BY sequence").fetchall()
            self.assertEqual(json.loads(rows[0]["result_json"])["value"],0)
            self.assertIs(json.loads(rows[2]["result_json"])["value"],False)
            self.assertIsNone(rows[3]["result_json"])
            self.assertTrue(all(row["measured_at"] is None for row in rows))

    async def test_invalid_content_and_catalog_associations(self):
        cases = [
            {"result":{"kind":"numeric","value":"42.5"}},
            {"result":{"kind":"numeric","value":float('nan')}},
            {"result":{"kind":"numeric","value":float('inf')}},
            {"source":"unknown"}, {"profile_version":2}, {"sensor_id":"other"},
            {"node_id":"unauthorized"}, {"time_quality":"synchronized"},
            {"measured_at":"2026-11-13T00:00:00Z"},
            {"measured_at":"2026-11-13T00:00:00", "time_quality":"synchronized"},
            {"channel_id":"class-01","profile_id":"class-demo","result":{"kind":"categorical","value":"missing"}},
            {"channel_id":"event-01","profile_id":"event-demo","result":{"kind":"boolean","value":0}},
            {"result":{"kind":"boolean","value":True}},
            {"node_uptime_ms":-1}, {"received_at":"2026-11-13T00:00:00Z"},
        ]
        for changes in cases:
            batch = copy.deepcopy(EXAMPLE)
            batch["readings"][0].update(changes)
            response = await self.request(data=batch)
            self.assertEqual(response[0],200,changes)
            self.assertEqual(response[1]["results"][0]["status"],"rejected",changes)
        self.assertEqual(self.count(),0)

    async def test_restart_and_other_node_are_distinct(self):
        batch = copy.deepcopy(EXAMPLE)
        second = copy.deepcopy(batch["readings"][0]); second["node_id"]="node-demo-02"
        boot = copy.deepcopy(batch["readings"][0]); boot["node_boot_id"]="another-boot"
        batch["readings"].extend([second,boot])
        self.assertTrue(all(r["status"]=="accepted" for r in (await self.request(data=batch))[1]["results"]))
        self.assertEqual(self.count(),3)
        self.database.initialize()
        self.assertTrue(all(r["status"]=="duplicate" for r in (await self.request(data=batch))[1]["results"]))

    async def test_utc_canonicalization_and_numerically_equal_retry(self):
        batch = copy.deepcopy(EXAMPLE)
        batch["readings"][0].update(measured_at="2026-11-12T21:00:00-03:00",time_quality="synchronized",result={"kind":"numeric","value":42})
        self.assertEqual((await self.request(data=batch))[1]["results"][0]["status"],"accepted")
        batch["readings"][0].update(measured_at="2026-11-13T00:00:00Z",result={"kind":"numeric","value":42.0})
        self.assertEqual((await self.request(data=batch))[1]["results"][0]["status"],"duplicate")

    async def test_real_body_limit_chunking_and_cors(self):
        response = await self.request(chunks=[b'x'*20000,b'x'*13000],headers={"content-length":"1","origin":"http://localhost:5173"})
        self.assertEqual(response[0],413)
        self.assertEqual(response[2]["access-control-allow-origin"],"http://localhost:5173")
        self.assertEqual(self.count(),0)

    async def test_database_failure_rolls_back_entire_batch(self):
        from app.services.ingestion import insert_reading
        count = 0
        def fail_second(*args):
            nonlocal count
            count += 1
            if count == 2: raise sqlite3.OperationalError('falha simulada')
            return insert_reading(*args)
        batch = copy.deepcopy(EXAMPLE)
        second = copy.deepcopy(batch["readings"][0]);second["sequence"]+=1;batch["readings"].append(second)
        with self.assertLogs('app.main',level=logging.ERROR), patch('app.services.ingestion.insert_reading',side_effect=fail_second):
            response = await self.request(data=batch)
        self.assertEqual(response[0],503)
        self.assertEqual(self.count(),0)

    async def test_concurrent_retries_do_not_duplicate(self):
        responses = await asyncio.gather(self.request(),self.request())
        self.assertEqual(sorted(r[1]["results"][0]["status"] for r in responses),['accepted','duplicate'])
        self.assertEqual(self.count(),1)

    async def test_profiles_health_and_unauthorized_node(self):
        self.assertEqual((await self.request('/health',method='GET',token=False))[1],{'status':'ok','database':'ok','schema_version':4})
        response=await self.request('/api/v1/profiles',method='GET',token=False)
        self.assertEqual(response[0],200);self.assertEqual(len(response[1]['items']),4)
        with self.database.transaction() as c:
            c.execute("INSERT INTO gateways(id,name,created_at) VALUES('other','other','2026-11-13T00:00:00Z')")
            c.execute("UPDATE nodes SET gateway_id='other' WHERE id='node-demo-01'")
        response=await self.request()
        self.assertEqual(response[1]['results'][0]['error_code'],'channel_not_authorized')
        self.assertEqual(self.count(),0)

    async def test_known_retry_survives_channel_configuration_change(self):
        await self.request()
        with self.database.transaction() as c: c.execute("UPDATE channels SET profile_id='temperature-demo' WHERE node_id='node-demo-01' AND id='signal-01'")
        self.assertEqual((await self.request())[1]['results'][0]['status'],'duplicate')


class MigrationUpgradeTests(unittest.TestCase):
    def test_delivery_three_upgrade_preserves_sessions(self):
        import app.database as module
        from app.schemas.heartbeat import Heartbeat
        from app.services.heartbeat import receive_heartbeat
        from app.security import issue_bot_token
        with tempfile.TemporaryDirectory() as tmp:
            old=Path(tmp)/'old';old.mkdir()
            for name in ['001_catalog.sql','002_readings.sql','003_queries_sessions.sql']:
                (old/name).write_bytes((module.MIGRATIONS_DIR/name).read_bytes())
            database=Database(Path(tmp)/'old.sqlite3')
            with patch('app.database.MIGRATIONS_DIR',old):
                self.assertEqual(database.initialize(),3)
                seed_demo(database)
                receive_heartbeat(database,'gateway-demo-01',Heartbeat.model_validate({'schema_version':1,'gateway_boot_id':'g1','gateway_boot_count':1,'sequence':10,'nodes':[{'node_id':'node-demo-01','node_boot_id':'n1','node_boot_count':1}]}))
            self.assertEqual(database.initialize(),4)
            issue_bot_token(database)
            with database.connection(readonly=True) as c:
                self.assertEqual(c.execute('SELECT heartbeat_sequence FROM gateways').fetchone()[0],10)
                self.assertEqual(c.execute("SELECT current_boot_id FROM nodes WHERE id='node-demo-01'").fetchone()[0],'n1')
                self.assertEqual(c.execute('SELECT COUNT(*) FROM alerts').fetchone()[0],0)

    def test_delivery_two_upgrade_preserves_readings_and_token(self):
        import app.database as module
        from app.schemas.readings import ReadingBatch
        from app.services.ingestion import ingest
        with tempfile.TemporaryDirectory() as tmp:
            old_migrations=Path(tmp)/'old_migrations';old_migrations.mkdir()
            for name in ['001_catalog.sql','002_readings.sql']:
                (old_migrations/name).write_bytes((module.MIGRATIONS_DIR/name).read_bytes())
            database=Database(Path(tmp)/'previous.sqlite3')
            with patch('app.database.MIGRATIONS_DIR',old_migrations):
                self.assertEqual(database.initialize(),2)
                seed_demo(database)
                issue_token(database,'gateway-demo-01')
                from app.repositories.readings import acquisition_json,insert_reading
                from app.schemas.readings import Reading
                from app.database import utc_now
                reading=Reading.model_validate(EXAMPLE['readings'][0])
                with database.transaction() as c:
                    previous_id=insert_reading(c,EXAMPLE['gateway_id'],reading,acquisition_json(reading),utc_now())
                with database.connection(readonly=True) as c:
                    old_hash=c.execute('SELECT token_hash FROM gateways').fetchone()[0]
            self.assertEqual(database.initialize(),4)
            self.assertEqual(ingest(database,ReadingBatch.model_validate(EXAMPLE)).results[0].status,'duplicate')
            with database.connection(readonly=True) as c:
                self.assertEqual(c.execute('SELECT token_hash FROM gateways').fetchone()[0],old_hash)
                self.assertEqual(c.execute('SELECT id FROM readings').fetchone()[0],previous_id)
                self.assertEqual(c.execute('SELECT COUNT(*) FROM readings').fetchone()[0],1)

    def test_delivery_one_upgrade_preserves_catalog(self):
        import app.database as module
        with tempfile.TemporaryDirectory() as tmp:
            old_migrations = Path(tmp) / 'old_migrations'
            old_migrations.mkdir()
            (old_migrations / '001_catalog.sql').write_bytes((module.MIGRATIONS_DIR / '001_catalog.sql').read_bytes())
            database = Database(Path(tmp) / 'previous.sqlite3')
            with patch('app.database.MIGRATIONS_DIR', old_migrations):
                self.assertEqual(database.initialize(), 1)
                seed_demo(database)
                with database.transaction() as c:
                    c.execute("UPDATE gateways SET name='Cadastro preservado' WHERE id='gateway-demo-01'")
            self.assertEqual(database.initialize(), 4)
            self.assertEqual(database.initialize(), 4)
            with database.connection(readonly=True) as c:
                self.assertEqual(c.execute('SELECT COUNT(*) FROM channels').fetchone()[0], 8)
                self.assertEqual(c.execute('SELECT name FROM gateways').fetchone()[0], 'Cadastro preservado')
                self.assertIsNone(c.execute('SELECT token_hash FROM gateways').fetchone()[0])
                self.assertEqual(c.execute('SELECT COUNT(*) FROM readings').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
