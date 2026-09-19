import test from 'node:test';
import assert from 'node:assert/strict';

test('shared mute persists, silences existing gains and music, and blocks new effects', async () => {
  const stored=new Map([['eh-muted','false']]);
  globalThis.localStorage={ getItem:k=>stored.get(k), setItem:(k,v)=>stored.set(k,v) };
  let tracks=0, oscillators=0, gainNodes=[];
  const parameter=()=>({value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  class Context {
    state='running'; currentTime=0; destination={};
    createGain(){const node={gain:parameter(),connect(){},disconnect(){}};gainNodes.push(node);return node;}
    createOscillator(){oscillators++;return {frequency:parameter(),connect(){},disconnect(){},addEventListener(){},start(){},stop(){}};}
    resume(){return Promise.resolve();} close(){return Promise.resolve();}
  }
  let track;
  globalThis.Audio=class { constructor(){tracks++;track=this;} paused=true; play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;} removeAttribute(){} load(){} };
  globalThis.window={AudioContext:Context,addEventListener(){},removeEventListener(){}};
  const audio=await import('../src/ui/audio.js?test');
  assert.equal(audio.getMuted(),false);
  audio.unlockAudio();audio.unlockAudio();assert.equal(tracks,1);
  assert.equal(audio.playTone('supernova'),true);
  audio.setMuted(true);
  assert.equal(stored.get('eh-muted'),'true'); assert.equal(track.paused,true); assert.equal(track.muted,true);
  assert.equal(gainNodes.at(-1).gain.value,0);
  const count=oscillators;
  for(const kind of ['click','supernova','solarFlare','collision','selection']) assert.equal(audio.playTone(kind),false);
  assert.equal(oscillators,count);
  audio.setMuted(false);assert.equal(track.paused,false);assert.equal(tracks,1);
  assert.equal(stored.get('eh-muted'),'false');assert.equal(gainNodes.at(-1).gain.value,1);
  track.play=()=>Promise.reject(new Error('autoplay denied'));track.paused=true;
  assert.doesNotThrow(()=>audio.unlockAudio());
  audio.disposeAudio();assert.equal(track.paused,true);
  delete globalThis.window;delete globalThis.Audio;delete globalThis.localStorage;
});
