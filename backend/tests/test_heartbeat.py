import copy
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from support import ASGITestCase, EXAMPLE

HEARTBEAT = {'schema_version':1,'gateway_boot_id':'gateway-boot-1','gateway_boot_count':0,'sequence':1,'nodes':[{'node_id':'node-demo-01','node_boot_id':'node-boot-1','node_boot_count':0,'last_radio_age_ms':1000}]}
ROUTE='/api/v1/gateways/gateway-demo-01/heartbeat'
NOW=datetime(2026,11,13,12,tzinfo=timezone.utc)


class HeartbeatTests(ASGITestCase):
    async def heartbeat(self,body=None,**kwargs):
        return await self.request(ROUTE,data=body or copy.deepcopy(HEARTBEAT),**kwargs)

    async def test_auth_validation_and_ownership(self):
        self.assertEqual((await self.heartbeat(token=False))[0],401)
        self.assertEqual((await self.request('/api/v1/gateways/other/heartbeat',data=HEARTBEAT))[0],403)
        for changes in [{'gateway_boot_count':True},{'sequence':-1},{'nodes':HEARTBEAT['nodes']*2}]:
            body=copy.deepcopy(HEARTBEAT);body.update(changes)
            self.assertEqual((await self.heartbeat(body))[0],422)
        body=copy.deepcopy(HEARTBEAT);body['nodes'][0]['node_id']='missing'
        self.assertEqual((await self.heartbeat(body))[0],403)
        with self.database.connection(readonly=True) as c:
            self.assertIsNone(c.execute('SELECT heartbeat_boot_id FROM gateways').fetchone()[0])

    async def test_contact_is_estimated_and_duplicate_does_not_refresh_radio(self):
        with patch('app.services.heartbeat.now_utc',return_value=NOW):
            self.assertEqual((await self.heartbeat())[1]['status'],'accepted')
        with self.database.connection(readonly=True) as c:
            original=c.execute("SELECT * FROM nodes WHERE id='node-demo-01'").fetchone()
            original_time=original['last_radio_seen_at']
        with patch('app.services.heartbeat.now_utc',return_value=NOW+timedelta(seconds=400)):
            response=await self.heartbeat()
        self.assertEqual(response[1]['status'],'duplicate')
        with patch('app.services.devices.now_utc',return_value=NOW+timedelta(seconds=400)):
            devices=(await self.request('/api/v1/devices',method='GET',token=False))[1]['items']
        gateway=next(d for d in devices if d['role']=='gateway')
        node=next(d for d in devices if d['id']=='node-demo-01')
        self.assertEqual(gateway['communication']['status'],'fresh')
        self.assertEqual(node['radio_contact']['status'],'stale')
        self.assertEqual(node['radio_contact']['time_quality'],'estimated')
        self.assertEqual(datetime.fromisoformat(node['last_radio_seen_at']),datetime.fromisoformat(original_time))
        self.assertIsNone(next(d for d in devices if d['id']=='node-demo-02')['last_radio_seen_at'])
        changed=copy.deepcopy(HEARTBEAT);changed['nodes'][0]['last_radio_age_ms']=0
        self.assertEqual((await self.heartbeat(changed))[0],409)
        self.assertEqual(self.count(),0)

    async def test_gateway_restart_and_old_report_do_not_regress_sessions(self):
        await self.heartbeat()
        restarted=copy.deepcopy(HEARTBEAT)
        restarted.update(gateway_boot_count=1,gateway_boot_id='gateway-boot-2',sequence=0)
        self.assertEqual((await self.heartbeat(restarted))[1]['status'],'accepted')
        old=copy.deepcopy(HEARTBEAT);old['sequence']=9999
        self.assertEqual((await self.heartbeat(old))[1]['status'],'ignored')
        reuse=copy.deepcopy(HEARTBEAT);reuse['gateway_boot_count']=2
        self.assertEqual((await self.heartbeat(reuse))[0],409)
        with self.database.connection(readonly=True) as c:
            self.assertEqual(c.execute('SELECT heartbeat_boot_id FROM gateways').fetchone()[0],'gateway-boot-2')

    async def test_older_node_report_is_ignored_even_inside_new_gateway_report(self):
        await self.heartbeat()
        current=copy.deepcopy(HEARTBEAT);current['sequence']=2
        current['nodes'][0].update(node_boot_id='node-boot-2',node_boot_count=1)
        self.assertEqual((await self.heartbeat(current))[1]['status'],'accepted')
        old=copy.deepcopy(HEARTBEAT);old['sequence']=3
        response=await self.heartbeat(old)
        self.assertEqual(response[1]['nodes'][0]['status'],'ignored')
        with self.database.connection(readonly=True) as c:
            self.assertEqual(c.execute("SELECT current_boot_id FROM nodes WHERE id='node-demo-01'").fetchone()[0],'node-boot-2')
        bad=copy.deepcopy(current);bad['sequence']=4;bad['nodes'][0]['node_boot_id']='different-id-same-count'
        self.assertEqual((await self.heartbeat(bad))[0],409)

    async def test_session_conflict_rolls_back_other_nodes_and_gateway(self):
        first=copy.deepcopy(HEARTBEAT)
        first['nodes'].append({'node_id':'node-demo-02','node_boot_id':'node-2-boot-1','node_boot_count':0,'last_radio_age_ms':100})
        await self.heartbeat(first)
        bad=copy.deepcopy(first);bad['sequence']=2
        bad['nodes'][0].update(node_boot_id='node-boot-new',node_boot_count=1)
        bad['nodes'][1]['node_boot_id']='conflicting'
        self.assertEqual((await self.heartbeat(bad))[0],409)
        with self.database.connection(readonly=True) as c:
            self.assertEqual(c.execute("SELECT current_boot_id FROM nodes WHERE id='node-demo-01'").fetchone()[0],'node-boot-1')
            self.assertEqual(c.execute('SELECT heartbeat_sequence FROM gateways').fetchone()[0],1)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM node_sessions WHERE boot_id='node-boot-new'").fetchone()[0],0)

    async def test_reported_session_wins_over_late_old_reading(self):
        for boot,seq in [('old',1000),('node-boot-1',1)]:
            batch=copy.deepcopy(EXAMPLE);batch['readings'][0].update(node_boot_id=boot,sequence=seq)
            await self.request(data=batch)
        await self.heartbeat()
        batch=copy.deepcopy(EXAMPLE);batch['readings'][0].update(node_boot_id='old',sequence=2000)
        await self.request(data=batch)
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['selection'],'reported_session')
        self.assertEqual(channel['reading']['node_boot_id'],'node-boot-1')
        self.assertEqual(channel['reading']['sequence'],1)
        self.assertEqual(channel['freshness']['status'],'unknown')
        self.database.initialize()
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['reading']['node_boot_id'],'node-boot-1')
