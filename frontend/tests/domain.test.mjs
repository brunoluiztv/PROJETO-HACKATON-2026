import test from 'node:test';
import assert from 'node:assert/strict';
import { assessment, formatResult, inPeriod, latest, numericDomain, toCsv, validReading } from '../.test-build/model.js';
import { profiles } from '../.test-build/profiles.js';
const numeric=profiles[0], category=profiles[2], boolean=profiles[3];
const now=Date.UTC(2026,10,12,15);
function reading(profile=numeric, overrides={}) { return {id:'demo-1',deviceId:'demo',sensorId:'channel-1',profileId:profile.id,profileVersion:profile.version,sequence:1,measuredAt:now,receivedAt:now+1000,timeQuality:'synchronized',source:'simulation',quality:'valid',result:{kind:profile.kind,value:0},...overrides}; }
test('zero and false remain valid results; errors do not become zero',()=>{
  assert.equal(formatResult(numeric,reading()),'0,0 %');
  const no=reading(boolean,{result:{kind:'boolean',value:false}});
  assert.equal(validReading(boolean,no),true);
  assert.equal(formatResult(boolean,no),boolean.labels.no);
  assert.equal(validReading(numeric,reading(numeric,{quality:'sensor_error',result:null})),false);
  assert.equal(formatResult(numeric,reading(numeric,{quality:'sensor_error',result:null})),'Erro de aquisição');
});
test('type, category, profile and version mismatches are rejected',()=>{
  assert.equal(validReading(numeric,reading(numeric,{result:{kind:'numeric',value:NaN}})),false);
  assert.equal(validReading(numeric,reading(numeric,{profileVersion:2})),false);
  assert.equal(validReading(numeric,reading(numeric,{profileId:'other'})),false);
  assert.equal(validReading(category,reading(category,{result:{kind:'categorical',value:'a'}})),true);
  assert.equal(validReading(category,reading(category,{result:{kind:'categorical',value:'toString'}})),false);
  assert.equal(validReading(numeric,reading(numeric,{result:{kind:'boolean',value:true}})),false);
});
test('timestamp filtering handles irregular/out-of-order samples without including future or unknown times',()=>{
  const items=[reading(numeric,{id:'old',measuredAt:now-3600001}),reading(numeric,{id:'last',measuredAt:now}),reading(numeric,{id:'unknown',measuredAt:null}),reading(numeric,{id:'boundary',measuredAt:now-3600000}),reading(numeric,{id:'future',measuredAt:now+1})];
  assert.deepEqual(inPeriod(items,now,1).map(r=>r.id),['boundary','last']);
});
test('late delivery does not replace the most recent acquisition sequence',()=>{
  const recent=reading(numeric,{sequence:20,receivedAt:now}),old=reading(numeric,{sequence:3,receivedAt:now+10000});
  assert.equal(latest([recent,old]),recent);assert.equal(latest([]),undefined);
});
test('axis includes negative and out-of-configured-domain values',()=>{
  assert.deepEqual(numericDomain(numeric,[reading(numeric,{result:{kind:'numeric',value:-20}}),reading(numeric,{result:{kind:'numeric',value:120}})]),[-20,120]);
  assert.deepEqual(numericDomain({...numeric,domain:undefined},[]),[0,1]);
  const [lo,hi]=numericDomain({...numeric,domain:undefined},[reading()]);assert.ok(lo<0&&hi>0);
});
test('missing criteria never imply normal; the test rule is explicit and handles invalid data',()=>{
  assert.equal(assessment(numeric,reading()).label,'Sem critério de avaliação definido');
  assert.equal(assessment(numeric,reading(),true).attention,true);
  assert.equal(assessment(numeric,reading(numeric,{quality:'sensor_error',result:null}),true).attention,false);
});
test('CSV preserves zero, false, missing acquisition time and profile metadata',()=>{
  const csv=toCsv(numeric,[reading(numeric,{measuredAt:null,timeQuality:'unknown'})]);
  assert.match(csv,/"0";"%";"valid";""/);assert.match(csv,/"signal-demo";"1"/);assert.match(csv,/"unknown";"simulation"/);
  assert.match(toCsv(boolean,[reading(boolean,{result:{kind:'boolean',value:false}})]),/"false";"";"valid"/);
  assert.match(toCsv(numeric,[reading(numeric,{id:'a"b',result:null,quality:'sensor_error'})]),/"a""b"/);
});
