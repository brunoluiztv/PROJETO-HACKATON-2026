"""Envia leituras simuladas por HTTP; não acessa banco nem Telegram.

Use preferencialmente uma instância com banco exclusivo de ensaio.
"""
import argparse
import getpass
import json
import math
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url',default='http://127.0.0.1:8001')
parser.add_argument('--values',type=float,nargs='+',default=[20,21,22,36,37,38])
parser.add_argument('--boot-id',default=None)
parser.add_argument('--start-sequence',type=int,default=1)
args=parser.parse_args()
if not 1<=len(args.values)<=32 or not all(math.isfinite(v) for v in args.values) or args.start_sequence<0:
    parser.error('Use 1 a 32 valores finitos e sequência inicial não negativa.')
token=getpass.getpass('Token do gateway da instância de ensaio: ')
boot_id=args.boot_id or f'manual-{uuid4().hex}'
readings=[]
for sequence,value in enumerate(args.values,start=args.start_sequence):
    readings.append({'node_id':'node-demo-01','node_boot_id':boot_id,'sequence':sequence,'sensor_id':'sensor-demo-01','channel_id':'signal-01','profile_id':'signal-demo','profile_version':1,'result':{'kind':'numeric','value':value},'quality':'valid','source':'simulation','measured_at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'time_quality':'synchronized','node_uptime_ms':sequence*1000})
request=Request(args.base_url.rstrip('/')+'/api/v1/readings',data=json.dumps({'schema_version':1,'gateway_id':'gateway-demo-01','readings':readings},allow_nan=False).encode(),headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},method='POST')
try:
    with urlopen(request,timeout=10) as response:
        print('HTTP',response.status)
        print(response.read().decode())
    print('Sessão simulada:',boot_id)
except HTTPError as exc:
    print('HTTP',exc.code,exc.read().decode())
    raise SystemExit(1)
except URLError as exc:
    print('Falha ao alcançar a API:',exc.reason)
    raise SystemExit(1)
