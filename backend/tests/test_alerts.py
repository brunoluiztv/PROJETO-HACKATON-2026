import copy
import logging
import sqlite3
from datetime import timedelta
from unittest.mock import patch

from alert_support import AlertTestCase
from app.schemas.alerts import AlertRule
from app.services.rules import add_rule,disable_rule
from app.timeutils import iso_utc
from support import EXAMPLE


class AlertEngineTests(AlertTestCase):
    async def test_open_once_hysteresis_recover_and_repeat_occurrence(self):
        await self.values([20,21])
        self.assertEqual((await self.occurrences())['items'],[])
        batch=await self.values([22])
        items=(await self.occurrences())['items']
        self.assertEqual(len(items),1);self.assertEqual(items[0]['status'],'active')
        self.assertEqual(len(items[0]['notifications']),1)
        await self.request(data=batch)
        await self.values([23,24,33,34,35,34,36,37])
        self.assertEqual((await self.occurrences())['items'][0]['status'],'active')
        await self.values([38])
        item=(await self.occurrences())['items'][0]
        self.assertEqual(item['status'],'resolved');self.assertEqual(len(item['notifications']),2)
        self.assertEqual(item['recovery_reading']['result']['value'],38)
        self.assertNotIn('chat_id',str(item));self.assertNotIn('lease_token',str(item))
        await self.values([20,20,20])
        self.assertEqual(len((await self.occurrences())['items']),2)
        self.assertEqual(len((await self.occurrences('?status=active'))['items']),1)

    async def test_unknown_time_error_gap_and_restart_reset_counts(self):
        await self.values([20,20])
        await self.values([20],measured_at=None,time_quality='unknown')
        await self.values([20,20])
        self.assertEqual(len((await self.occurrences())['items']),0)
        await self.values([20],quality='sensor_error',result=None)
        await self.values([20,20])
        self.clock+=timedelta(seconds=301)
        await self.values([20])
        self.assertEqual(len((await self.occurrences())['items']),0)
        self.database.initialize()
        await self.values([20,20])
        self.assertEqual(len((await self.occurrences())['items']),1)
        summary=(await self.request('/api/v1/alert-evaluations/summary',method='GET'))[1]['items']
        self.assertIn({'outcome':'unknown_time','count':1},summary)
        self.assertIn({'outcome':'sensor_error','count':1},summary)

    async def test_backlog_does_not_generate_current_alert(self):
        await self.values([20,20,20],measured_at=iso_utc(self.clock-timedelta(hours=1)))
        await self.values([20,20,20],measured_at=None,time_quality='unknown')
        self.assertEqual((await self.occurrences())['items'],[])
        summary=(await self.request('/api/v1/alert-evaluations/summary',method='GET'))[1]['items']
        self.assertIn({'outcome':'delayed','count':3},summary)
        self.assertIn({'outcome':'unknown_time','count':3},summary)

    async def test_age_window_is_independent_of_gap_between_samples(self):
        disable_rule(self.database,self.rule.id)
        add_rule(self.database,self.rule.model_copy(update={'id':'short-age','max_age_seconds':30,'max_gap_seconds':600}))
        await self.values([20,20,20],measured_at=iso_utc(self.clock-timedelta(seconds=45)))
        self.assertEqual((await self.occurrences())['items'],[])

    async def test_out_of_order_batch_and_late_retry_do_not_recount(self):
        batch=copy.deepcopy(EXAMPLE)
        await self.values([20])
        row=copy.deepcopy(batch['readings'][0]);row.update(node_boot_id='alert-test-boot',measured_at=iso_utc(self.clock),time_quality='synchronized')
        batch['readings']=[{**row,'sequence':s,'result':{'kind':'numeric','value':20}} for s in [3,2]]
        response=await self.request(data=batch)
        self.assertEqual(response[0],200)
        item=(await self.occurrences())['items'][0]
        self.assertEqual(item['opening_reading']['sequence'],3)
        old={**row,'sequence':0,'result':{'kind':'numeric','value':40}}
        await self.request(data={**batch,'readings':[old]})
        self.assertEqual((await self.occurrences())['items'][0]['status'],'active')

    async def test_simulation_rule_never_processes_physical_source(self):
        await self.values([20,20,20],source='physical_sensor')
        self.assertEqual((await self.occurrences())['items'],[])

    async def test_new_session_requires_fresh_consecutive_observations(self):
        await self.values([20,20])
        self.clock+=timedelta(seconds=1)
        await self.values([20],node_boot_id='new-boot')
        self.assertEqual((await self.occurrences())['items'],[])
        await self.values([20,20],node_boot_id='new-boot')
        self.assertEqual(len((await self.occurrences())['items']),1)

    async def test_future_and_regressing_clock_do_not_trigger(self):
        await self.values([20,20],measured_at=iso_utc(self.clock+timedelta(seconds=1)))
        self.assertEqual((await self.occurrences())['items'],[])
        await self.values([20])
        await self.values([20],measured_at=iso_utc(self.clock-timedelta(seconds=1)))
        await self.values([20,20])
        self.assertEqual((await self.occurrences())['items'],[])

    async def test_alerts_outbox_and_reading_roll_back_together(self):
        await self.values([20,20])
        with self.assertLogs('app.main',level=logging.ERROR),patch('app.services.alert_engine.enqueue',side_effect=sqlite3.OperationalError('falha simulada')):
            batch=copy.deepcopy(EXAMPLE)
            batch['readings'][0].update(node_boot_id='alert-test-boot',sequence=3,measured_at=iso_utc(self.clock),time_quality='synchronized',result={'kind':'numeric','value':20})
            self.assertEqual((await self.request(data=batch))[0],503)
        self.assertEqual(self.count(),2)
        self.assertEqual((await self.occurrences())['items'],[])
        await self.values([20])
        self.assertEqual(len((await self.occurrences())['items']),1)

    async def test_above_direction_disable_rule_and_rule_immutability(self):
        disable_rule(self.database,self.rule.id)
        rule=self.rule.model_copy(update={'id':'high-demo','direction':'above','threshold':70.0,'recovery_threshold':65.0})
        self.assertTrue(add_rule(self.database,rule)['created'])
        self.assertFalse(add_rule(self.database,rule)['created'])
        with self.assertRaises(ValueError):add_rule(self.database,rule.model_copy(update={'threshold':75.0}))
        await self.values([80,80,80,65,65,65])
        item=(await self.occurrences('?rule_id=high-demo'))['items'][0]
        self.assertEqual(item['status'],'resolved')
        disable_rule(self.database,rule.id)
        await self.values([80,80,80])
        self.assertEqual(len((await self.occurrences())['items']),1)

    async def test_alert_filter_pagination_and_details(self):
        await self.values([20,20,20,40,40,40])
        self.clock+=timedelta(seconds=1)
        await self.values([20,20,20])
        first=await self.occurrences('?limit=1')
        second=await self.occurrences('?limit=1&cursor='+first['next_cursor'])
        self.assertNotEqual(first['items'][0]['id'],second['items'][0]['id'])
        self.assertIsNone(second['next_cursor'])
        response=await self.request('/api/v1/alerts/'+first['items'][0]['id'],method='GET',token=False)
        self.assertEqual(response[0],200)
        self.assertEqual((await self.request('/api/v1/alerts/missing',method='GET'))[0],404)
        self.assertEqual((await self.request('/api/v1/alerts?cursor='+first['next_cursor']+'&status=active',method='GET'))[0],422)
