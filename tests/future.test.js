import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import PhysicsEngine, { createSunEarthTestSystem } from '../src/physics/PhysicsEngine.js';
import { toYears, formatYears, advanceEllipse } from '../src/physics/timeline.js';
import { estimateVoyagerDistance, presentMission, missionYearAt, missionPlaybackProgress, missionCameraOffset } from '../src/physics/voyager.js';
import { lightDeflection, visualEinsteinRadius } from '../src/physics/lensing.js';
const mission = JSON.parse(readFileSync(new URL('../src/data/stories.json', import.meta.url)))['voyager-1-journey'];

test('timeline converts days through billions and rejects invalid input', () => {
  assert.equal(toYears(365.25, 'days'), 1);
  for (const [unit, value] of [['years',1],['thousand',1e3],['million',1e6],['billion',1e9]]) assert.equal(toYears(1,unit), value);
  for (const value of [-1, NaN, Infinity, 1e12]) assert.throws(() => toYears(value));
  assert.throws(() => toYears(1,'bad'));
  assert.equal(formatYears(250), '250 years');
  assert.equal(formatYears(12500), '12.5 thousand years');
  assert.equal(formatYears(4.8e9), '4.8 billion years');
});
test('ellipse quarter orbit, full orbit and billion-year inputs remain finite', () => {
  const mu = 4*Math.PI**2;
  const quarter = advanceEllipse([1,0,0],[0,2*Math.PI,0],mu,0.25);
  assert.ok(Math.abs(quarter.position[0]) < 1e-12);
  assert.ok(Math.abs(quarter.position[1]-1) < 1e-12);
  const full = advanceEllipse([1,0,0],[0,2*Math.PI,0],mu,1);
  assert.ok(Math.abs(full.position[0]-1) < 1e-12);
  assert.ok(advanceEllipse([1,0,0],[0,2*Math.PI,0],mu,1e11).position.every(Number.isFinite));
  assert.equal(advanceEllipse([1,0,0],[0,100,0],mu,100), null);
});
test('future advancement updates actual positions, preserves pause and resets exactly', () => {
  const e = createSunEarthTestSystem(); e.pause();
  const before = e.saveState();
  e.advanceFuture(0.25);
  assert.equal(e.time,0.25); assert.equal(e.paused,true);
  assert.ok(e.getBody('earth').position.distanceTo({x:1,y:0,z:0}) > 0.5);
  e.restoreState(before); assert.deepEqual(e.saveState(),before);
  e.advanceFuture(1/365.25); assert.ok(e.time > 0);
});
test('large future jump is bounded and Sun leaves a white dwarf, never a supernova', () => {
  const e = createSunEarthTestSystem(); const events=[];
  e.on('supernova',event => events.push(event));
  const started=performance.now(); e.advanceFuture(8e9);
  assert.ok(performance.now()-started < 1000);
  assert.equal(e.time,8e9); assert.equal(events.length,0);
  assert.ok(e.bodies.some(b => b.type==='white dwarf'));
  assert.ok(e.bodies.every(b => b.position.toArray().every(Number.isFinite)));
});
test('invalid future values do not mutate state', () => {
  const e=createSunEarthTestSystem(); const before=e.saveState();
  for (const value of [-1, Infinity, NaN, 1e12]) assert.throws(()=>e.advanceFuture(value));
  assert.deepEqual(e.saveState(),before);
});
for (const mass of [0.2,1,7.99]) test(`supernova rejects initial mass ${mass} without mutation or events`, () => {
  const e=new PhysicsEngine(); const star=e.spawnBody('star',{mass,name:mass===1?'Sun':'Low mass'});
  const before=e.saveState(); let count=0;
  for (const type of ['supernova','planetaryNebula','bodyRemoved','bodyAdded']) e.on(type,()=>count++);
  assert.equal(e.triggerSupernova(star.id),null);
  assert.equal(e.supernovaEligibility(star.id).eligible,false);
  assert.match(e.supernovaEligibility(star.id).reason,/8 Suns/);
  assert.deepEqual(e.saveState(),before); assert.equal(count,0);
});
for (const [mass,type] of [[8,'neutron star'],[25,'black hole']]) test(`eligible ${mass} solar masses produces ${type}`,()=>{
  const e=new PhysicsEngine(); const star=e.spawnBody('star',{mass});
  assert.equal(e.triggerSupernova(star.id).type,type);
  assert.ok(Math.abs(e.bodies.reduce((s,b)=>s+b.mass,0)-mass)<1e-10);
});
test('eligibility uses initial mass and rejects compact remnants',()=>{
  const e=new PhysicsEngine(); const star=e.spawnBody('star',{mass:4,metadata:{initialMass:10}});
  assert.equal(e.supernovaEligibility(star.id).eligible,true);
  const dwarf=e.spawnBody('white dwarf',{mass:10});
  assert.equal(e.triggerSupernova(dwarf.id),null);
});
test('Voyager has seven chronological milestones with present and future refreshed',()=>{
  const story=presentMission(mission,new Date('2030-01-01'));
  assert.deepEqual(story.waypoints.slice(0,5).map(w=>w.year),[1977,1979,1980,1990,2012]);
  assert.equal(story.waypoints[5].year,2030);
  assert.equal(story.waypoints[6].year,2050);
  for(let i=0;i<story.waypoints.length;i++) assert.equal(missionYearAt(i/6,story.waypoints),story.waypoints[i].year);
});
test('Voyager estimate matches epoch, elapsed velocity, units and light time',()=>{
  const base=estimateVoyagerDistance(mission.display,new Date(mission.display.epoch));
  assert.equal(base.au,164.7);
  const later=estimateVoyagerDistance(mission.display,new Date(Date.parse(mission.display.epoch)+86400000));
  assert.ok(Math.abs((later.km-base.km)-17*86400)<0.01);
  assert.equal(later.lightHours,later.km/299792.458/3600);
  assert.equal(later.asOf,'2024-08-22');
  assert.throws(()=>estimateVoyagerDistance(mission.display,'invalid'));
});
test('deflection scales with mass and inverse impact, visible scale is bounded',()=>{
  const a=lightDeflection(1,6.957e8);
  assert.ok(Math.abs(a*206265-1.75)<0.01);
  assert.equal(lightDeflection(2,6.957e8),2*a);
  assert.equal(lightDeflection(1,2*6.957e8),a/2);
  for(const value of [0,-1,NaN,Infinity]) assert.equal(lightDeflection(1,value),0);
  assert.ok(visualEinsteinRadius(20,15)>visualEinsteinRadius(10,15));
  assert.ok(visualEinsteinRadius(10,30)<visualEinsteinRadius(10,15));
  assert.ok(visualEinsteinRadius(1e12,0.1)<=0.22);
});

test('Voyager playback handles early animation timestamps and finite camera offsets', () => {
  assert.equal(missionPlaybackProgress(0,-1,32000),0);
  assert.equal(missionPlaybackProgress(0,16000,32000),0.5);
  assert.equal(missionPlaybackProgress(0.9,32000,32000),1);
  for (const progress of [0,0.5,1,NaN]) assert.ok(missionCameraOffset(progress).every(Number.isFinite));
});
