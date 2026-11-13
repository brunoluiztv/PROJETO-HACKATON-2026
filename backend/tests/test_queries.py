import copy
import json
from datetime import datetime, timezone
from unittest.mock import patch
from urllib.parse import urlencode

from support import ASGITestCase, EXAMPLE


class QueryTests(ASGITestCase):
    async def add(self, sequence=1, boot='boot-1', time=None, **changes):
        batch = copy.deepcopy(EXAMPLE)
        row = batch['readings'][0]
        row.update(sequence=sequence, node_boot_id=boot, measured_at=time, time_quality='synchronized' if time else 'unknown')
        row.update(changes)
        status, response, _ = await self.request(data=batch)
        self.assertEqual(status,200)
        self.assertEqual(response['results'][0]['status'],'accepted',response)
        return response['results'][0]['reading_id']

    async def get_history(self, **query):
        return await self.request('/api/v1/readings?'+urlencode(query), method='GET', token=False)

    async def test_empty_history_devices_and_latest(self):
        response=await self.get_history()
        self.assertEqual(response[:2],(200,{'items':[],'next_cursor':None}))
        status, devices, _=await self.request('/api/v1/devices',method='GET',token=False)
        self.assertEqual(status,200)
        self.assertEqual([d['role'] for d in devices['items']],['gateway','node','node'])
        self.assertEqual(len(devices['items'][1]['channels']),4)
        self.assertNotIn('token_hash',json.dumps(devices))
        self.assertNotIn(self.token,json.dumps(devices))
        status, latest, _=await self.request('/api/v1/devices/node-demo-01/latest',method='GET',token=False)
        self.assertEqual(status,200)
        self.assertTrue(all(c['reading'] is None and c['freshness']['status']=='no_data' for c in latest['channels']))
        self.assertEqual((await self.request('/api/v1/devices/missing/latest',method='GET',token=False))[0],404)

    async def test_order_and_filters_preserve_fractional_seconds_and_unknowns(self):
        early=await self.add(1,time='2026-11-13T00:00:00Z')
        middle=await self.add(2,time='2026-11-13T00:00:00.500Z')
        late=await self.add(3,time='2026-11-13T00:00:00.500001Z')
        unknown=await self.add(4)
        await self.add(1,node_id='node-demo-02',time='2026-11-13T00:00:01Z',source='physical_sensor')
        response=await self.get_history(node_id='node-demo-01',channel_id='signal-01',source='simulation')
        self.assertEqual([r['id'] for r in response[1]['items']],[late,middle,early,unknown])
        response=await self.get_history(**{'from':'2026-11-12T21:00:00-03:00','to':'2026-11-13T00:00:00.500000Z','node_id':'node-demo-01'})
        self.assertEqual([r['id'] for r in response[1]['items']],[middle,early])
        response=await self.get_history(time_quality='unknown')
        self.assertEqual([r['id'] for r in response[1]['items']],[unknown])
        self.assertIsNone(response[1]['items'][0]['measured_at'])
        self.assertNotIn('acquisition_json',response[1]['items'][0])

    async def test_cursor_snapshot_prevents_page_drift_and_binds_filters(self):
        expected=set()
        for sequence in range(1,7):
            expected.add(await self.add(sequence,time=f'2026-11-13T00:00:0{sequence}Z'))
        status,page,_=await self.get_history(limit=2,node_id='node-demo-01')
        self.assertEqual(status,200)
        seen=[r['id'] for r in page['items']]
        inserted_later=await self.add(20,time='2026-11-13T00:00:01.500Z')
        cursor=page['next_cursor']
        self.assertEqual((await self.get_history(cursor=cursor,node_id='node-demo-02'))[0],422)
        while cursor:
            status,page,_=await self.get_history(cursor=cursor,limit=2,node_id='node-demo-01')
            self.assertEqual(status,200)
            seen.extend(r['id'] for r in page['items'])
            cursor=page['next_cursor']
        self.assertEqual(set(seen),expected)
        self.assertEqual(len(seen),len(expected))
        self.assertNotIn(inserted_later,seen)
        self.assertEqual(len((await self.get_history())[1]['items']),7)

    async def test_invalid_filters_are_422(self):
        for query in [{'limit':0},{'limit':501},{'limit':'true'},{'from':'2026-11-13T00:00:00'},{'from':'not-date'},{'from':'2026-11-14T00:00:00Z','to':'2026-11-13T00:00:00Z'},{'time_quality':'unknown','to':'2026-11-13T00:00:00Z'},{'cursor':'invalid!'},{'cursor':''},{'node_id':"x' OR 1=1"},{'source':'missing'}]:
            self.assertEqual((await self.get_history(**query))[0],422,query)

    async def test_latest_uses_sequence_within_session_and_keeps_errors(self):
        first=await self.add(10,time='2026-11-13T00:00:00Z')
        await self.add(2,time='2026-11-12T00:00:00Z')
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['reading']['id'],first)
        error=await self.add(11,quality='sensor_error',result=None)
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['reading']['id'],error)
        self.assertEqual(channel['reading']['quality'],'sensor_error')
        self.assertEqual(channel['freshness']['status'],'unknown')

    async def test_multiple_sessions_unknown_times_are_not_guessed(self):
        await self.add(100,boot='old')
        await self.add(1,boot='new')
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertIsNone(channel['reading'])
        self.assertEqual(channel['freshness']['status'],'unknown')
        self.assertEqual(channel['selection'],'ambiguous_sessions')

    async def test_multiple_sessions_with_known_times_use_acquisition(self):
        await self.add(100,boot='old',time='2026-11-12T00:00:00Z')
        current=await self.add(1,boot='new',time='2026-11-13T00:00:00Z')
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['reading']['id'],current)
        self.assertEqual(channel['selection'],'measured_time')

    async def test_compare_session_candidates_not_old_clock_values(self):
        await self.add(1,boot='old',time='2026-11-15T00:00:00Z')
        await self.add(2,boot='old',time='2026-11-12T00:00:00Z')
        current=await self.add(1,boot='new',time='2026-11-13T00:00:00Z')
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['reading']['id'],current)

    async def test_tied_session_times_are_ambiguous(self):
        for boot in ['a','b']:
            await self.add(1,boot=boot,time='2026-11-13T00:00:00Z')
        response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertIsNone(channel['reading'])
        self.assertEqual(channel['selection'],'ambiguous_sessions')

    async def test_freshness_age_is_not_upload_age_and_channel_override(self):
        await self.add(1,time='2026-11-13T00:00:00Z')
        now=datetime(2026,11,13,0,1,tzinfo=timezone.utc)
        with patch('app.services.devices.now_utc',return_value=now):
            response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['freshness']['status'],'fresh')
        self.assertEqual(channel['freshness']['age_seconds'],60)
        with self.database.transaction() as c:
            c.execute("UPDATE channels SET stale_after_seconds=30 WHERE node_id='node-demo-01' AND id='signal-01'")
        with patch('app.services.devices.now_utc',return_value=now):
            response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['freshness']['status'],'stale')
        with patch('app.services.devices.now_utc',return_value=datetime(2026,11,12,tzinfo=timezone.utc)):
            response=await self.request('/api/v1/devices/node-demo-01/latest',method='GET')
        channel=next(c for c in response[1]['channels'] if c['channel_id']=='signal-01')
        self.assertEqual(channel['freshness']['status'],'unknown')
        self.assertEqual(channel['freshness']['reason'],'future_acquisition_time')
