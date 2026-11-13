import asyncio
from dataclasses import replace
from datetime import timedelta
from unittest.mock import patch

from alert_support import AlertTestCase
from app.security import issue_bot_token
from app.services.rules import add_rule,disable_rule
from app.services.notifications import requeue


class NotificationTests(AlertTestCase):
    async def test_default_queue_orders_opening_before_recovery(self):
        await self.values([20,20,20,40,40,40])
        items=(await self.reserve(limit=20))[1]['items']
        self.assertEqual([item['event'] for item in items],['opened','resolved'])

    async def test_expired_last_attempt_is_terminal(self):
        self.app.state.settings=replace(self.app.state.settings,notification_max_attempts=1)
        await self.values([20,20,20])
        await self.reserve()
        self.clock+=timedelta(seconds=61)
        self.assertEqual((await self.reserve())[1]['items'],[])
        with self.database.connection(readonly=True) as c:
            self.assertEqual(c.execute('SELECT status FROM notification_outbox').fetchone()[0],'dead')

    async def test_operator_can_requeue_only_dead_items(self):
        self.app.state.settings=replace(self.app.state.settings,notification_max_attempts=1)
        await self.values([20,20,20])
        item=(await self.reserve())[1]['items'][0]
        with self.assertRaises(ValueError):requeue(self.database,item['id'])
        await self.acknowledge(item,'failed',error='falha')
        with patch('app.services.notifications.now_utc',return_value=self.clock):
            self.assertEqual(requeue(self.database,item['id'])['status'],'pending')
        self.clock+=timedelta(days=1)
        retry=(await self.reserve())[1]['items'][0]
        self.assertEqual(retry['attempt'],1)
        self.assertNotEqual(retry['lease_token'],item['lease_token'])

    async def test_internal_auth_is_distinct_and_rotation(self):
        path='/api/v1/internal/bot-config'
        self.assertEqual((await self.request(path,method='GET',token=False))[0],401)
        self.assertEqual((await self.request(path,method='GET',token=self.token))[0],401)
        self.assertEqual((await self.request(path,method='GET',token=self.bot_token))[1]['authorized_chat_id'],'123456')
        previous=self.bot_token;self.bot_token=issue_bot_token(self.database)
        self.assertEqual((await self.request(path,method='GET',token=previous))[0],401)

    async def test_claim_confirm_and_duplicate_ack_are_persisted(self):
        await self.values([20,20,20])
        response=await self.reserve();self.assertEqual(response[0],200)
        item=response[1]['items'][0]
        self.assertEqual(item['chat_id'],'123456')
        self.assertIn('simulação',item['text']);self.assertIn('http://notebook.local:5173',item['text'])
        self.assertEqual((await self.reserve())[1]['items'],[])
        result=await self.acknowledge(item,telegram_message_id=77)
        self.assertEqual(result[1]['status'],'sent')
        self.assertTrue((await self.acknowledge(item,telegram_message_id=77))[1]['duplicate'])
        self.assertEqual((await self.acknowledge(item,telegram_message_id=78))[0],409)
        diagnostic=(await self.request('/api/v1/internal/notifications',method='GET',token=self.bot_token))[1]
        self.assertNotIn('lease_token',str(diagnostic));self.assertNotIn('token_hash',str(diagnostic))
        self.assertEqual(diagnostic['items'][0]['status'],'sent')
        self.database.initialize()
        self.assertEqual((await self.reserve())[1]['items'],[])

    async def test_failure_backoff_new_reservation_and_final_attempt(self):
        self.app.state.settings=replace(self.app.state.settings,notification_max_attempts=2)
        await self.values([20,20,20])
        first=(await self.reserve())[1]['items'][0]
        failed=await self.acknowledge(first,'failed',error='rede indisponível')
        self.assertEqual(failed[1]['status'],'pending')
        self.assertTrue((await self.acknowledge(first,'failed',error='rede indisponível'))[1]['duplicate'])
        self.assertEqual((await self.acknowledge(first,telegram_message_id=1))[0],409)
        self.assertEqual((await self.reserve())[1]['items'],[])
        self.clock+=timedelta(seconds=10)
        second=(await self.reserve())[1]['items'][0]
        self.assertEqual(second['attempt'],2)
        self.assertNotEqual(first['lease_token'],second['lease_token'])
        self.assertEqual((await self.acknowledge(first,telegram_message_id=1))[0],409)
        self.assertEqual((await self.acknowledge(second,'failed',error='falha persistente'))[1]['status'],'dead')
        self.clock+=timedelta(hours=1)
        self.assertEqual((await self.reserve())[1]['items'],[])

    async def test_expiration_retries_and_rejects_late_confirmation(self):
        await self.values([20,20,20])
        first=(await self.reserve())[1]['items'][0]
        self.clock+=timedelta(seconds=61)
        self.assertEqual((await self.acknowledge(first,telegram_message_id=1))[0],409)
        self.assertEqual((await self.reserve())[1]['items'],[])
        self.clock+=timedelta(seconds=10)
        second=(await self.reserve())[1]['items'][0]
        self.assertEqual(second['attempt'],2)
        self.assertEqual((await self.acknowledge(second,worker='other',telegram_message_id=1))[0],409)

    async def test_workers_cannot_claim_same_item(self):
        await self.values([20,20,20])
        responses=await asyncio.gather(self.reserve('a'),self.reserve('b'))
        self.assertEqual(sorted(len(r[1]['items']) for r in responses),[0,1])

    async def test_missing_chat_does_not_lose_or_consume_notification(self):
        self.app.state.settings=replace(self.app.state.settings,authorized_telegram_chat_id=None)
        await self.values([20,20,20])
        self.assertEqual((await self.reserve())[0],503)
        with self.database.connection(readonly=True) as c:
            self.assertEqual(tuple(c.execute('SELECT status,attempts FROM notification_outbox').fetchone()),('pending',0))

    async def test_destination_change_never_reuses_old_chat(self):
        await self.values([20,20,20])
        item=(await self.reserve())[1]['items'][0]
        await self.acknowledge(item,'failed',error='falha')
        self.app.state.settings=replace(self.app.state.settings,authorized_telegram_chat_id='999999')
        self.clock+=timedelta(seconds=10)
        self.assertEqual((await self.reserve())[1]['items'],[])
        with self.database.connection(readonly=True) as c:
            self.assertEqual(tuple(c.execute('SELECT status,last_error FROM notification_outbox').fetchone()),('dead','destination_changed'))

    async def test_cooldown_delays_recovery_and_text_reflects_resolved_event(self):
        disable_rule(self.database,self.rule.id)
        add_rule(self.database,self.rule.model_copy(update={'id':'cooldown-demo','cooldown_seconds':60}))
        await self.values([20,20,20,40,40,40])
        first=(await self.reserve(limit=20))[1]['items']
        self.assertEqual(len(first),1);self.assertEqual(first[0]['event'],'opened')
        self.assertIn('resolvida',first[0]['text'])
        await self.acknowledge(first[0],telegram_message_id=11)
        self.clock+=timedelta(seconds=60)
        second=(await self.reserve())[1]['items'][0]
        self.assertEqual(second['event'],'resolved')
        self.assertIn('aviso com atraso',second['text'])
