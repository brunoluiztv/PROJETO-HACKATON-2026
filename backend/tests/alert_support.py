import copy
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from app.schemas.alerts import AlertRule
from app.security import issue_bot_token
from app.services.rules import add_rule
from app.timeutils import iso_utc
from support import ASGITestCase, EXAMPLE


class AlertTestCase(ASGITestCase):
    settings_overrides={'authorized_telegram_chat_id':'123456','dashboard_url':'http://notebook.local:5173'}

    async def asyncSetUp(self):
        await super().asyncSetUp()
        self.clock=datetime(2026,11,13,12,tzinfo=timezone.utc)
        self.sequence=0
        self.rule=AlertRule.model_validate_json((Path(__file__).parent.parent/'examples/alert-rule.json').read_text())
        add_rule(self.database,self.rule)
        self.bot_token=issue_bot_token(self.database)

    async def request(self,*args,**kwargs):
        with patch('app.services.alert_engine.now_utc',return_value=self.clock),patch('app.services.notifications.now_utc',return_value=self.clock):
            return await super().request(*args,**kwargs)

    async def values(self,values,**changes):
        batch=copy.deepcopy(EXAMPLE);batch['readings']=[]
        for value in values:
            self.sequence+=1
            row=copy.deepcopy(EXAMPLE['readings'][0])
            row.update(node_boot_id='alert-test-boot',sequence=self.sequence,node_uptime_ms=self.sequence*1000,measured_at=iso_utc(self.clock),time_quality='synchronized',result={'kind':'numeric','value':value})
            row.update(changes);batch['readings'].append(row)
        response=await self.request(data=batch)
        self.assertEqual(response[0],200,response)
        self.assertTrue(all(r['status']=='accepted' for r in response[1]['results']),response)
        return batch

    async def occurrences(self,query=''):
        response=await self.request('/api/v1/alerts'+query,method='GET',token=False)
        self.assertEqual(response[0],200,response)
        return response[1]

    async def reserve(self,worker='bot-1',limit=1):
        return await self.request('/api/v1/internal/notifications/claim',data={'worker_id':worker,'limit':limit},token=self.bot_token)

    async def acknowledge(self,item,action='delivered',worker='bot-1',**fields):
        body={'worker_id':worker,'lease_token':item['lease_token'],**fields}
        return await self.request(f"/api/v1/internal/notifications/{item['id']}/{action}",data=body,token=self.bot_token)
