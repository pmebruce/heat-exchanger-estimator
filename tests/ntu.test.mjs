import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {effectiveness,requiredUA,rating,FLOW_TYPES} from '../ht-ntu.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./ht-fixtures.json',import.meta.url)));
test('100 ht engine reference points agree with browser formulas',()=>{for(const x of fixture)assert.ok(Math.abs(effectiveness(x.ntu,x.cr,x.kind)-x.epsilon)<1e-9,JSON.stringify(x));});
test('energy balance and UA inversion hold for all configurations',()=>{
 for(const type of Object.keys(FLOW_TYPES)){const r=rating(500,1000,600,50,20,type);assert.ok(Math.abs((50-r.hotOut)*1000-r.q)<1e-8);assert.ok(Math.abs((r.coldOut-20)*600-r.q)<1e-8);assert.ok(Math.abs(requiredUA(r.q,30,600,1000,type)-500)<1e-8);}
});
test('equal-capacity and infinite-capacity limits remain finite',()=>{
 for(const type of Object.keys(FLOW_TYPES)){assert.equal(effectiveness(0,.5,type),0);assert.ok(Math.abs(effectiveness(3,0,type)-(1-Math.exp(-3)))<1e-12);assert.ok(effectiveness(3,1,type)>0);}
 assert.equal(effectiveness(3,1,'counterflow'),.75);
 assert.equal(requiredUA(6000,10,600,1000,'counterflow'),null);assert.equal(requiredUA(4000,10,600,600,'parallel'),null);
});
test('invalid physics is rejected before a plausible result is returned',()=>{
 for(const args of [[-1,.5,'parallel'],[1,1.01,'parallel'],[1,.5,'other']])assert.throws(()=>effectiveness(...args));
 assert.throws(()=>rating(100,0,1,30,20,'counterflow'));assert.throws(()=>rating(100,1,1,20,30,'counterflow'));
});
