import React, { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const diskVertex = "varying vec2 vUv; varying vec3 vWorld; void main(){ vUv=uv; vWorld=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }";
const diskFragment = "precision highp float; uniform float uTime; uniform float uIntensity; uniform float uDoppler; varying vec2 vUv; varying vec3 vWorld; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);} float fbm(vec2 p){float v=0.0,a=0.55;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(3.7,1.9);a*=0.5;}return v;} void main(){vec2 p=vUv*2.0-1.0;p.x*=1.34;float r=length(p);if(r>1.0)discard;float a=atan(p.y,p.x);float inner=smoothstep(0.42,0.07,r);float outer=smoothstep(1.0,0.44,r);float band=smoothstep(1.0,0.05,r)*smoothstep(0.15,0.23,r);float t=fbm(vec2(a*4.0+uTime*0.18,r*12.0-uTime*0.7));float streak=0.5+0.5*sin(a*10.0+uTime*(2.5+2.5/max(r,0.18))+t*8.0);vec3 tangent=normalize(vec3(-p.y,0.0,p.x));vec3 view=normalize(cameraPosition-vWorld);float doppler=1.0+uDoppler*dot(tangent,view)*0.58;vec3 c=mix(vec3(0.50,0.006,0.002),vec3(1.0,0.22,0.012),outer);c=mix(c,vec3(1.0,0.96,0.68),inner*0.92);c*=mix(0.76,1.35,streak)*doppler;float alpha=band*(0.46+0.54*t)*(0.72+uIntensity*0.55);gl_FragColor=vec4(c*1.12,alpha);}"

function Disk({radius,quality,reducedMotion}){
 const uniforms=useMemo(()=>({uTime:{value:0},uIntensity:{value:quality==="high"?1:quality==="medium"?0.84:0.58},uDoppler:{value:0.9}}),[quality]);
 useFrame(({clock})=>{uniforms.uTime.value=reducedMotion?0:clock.elapsedTime;});
 return <mesh rotation={[Math.PI/2,0,0]} renderOrder={20}><planeGeometry args={[radius*7.2,radius*4.9]}/><shaderMaterial vertexShader={diskVertex} fragmentShader={diskFragment} uniforms={uniforms} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} side={THREE.DoubleSide}/></mesh>;
}

function PhotonRing({radius,reducedMotion}){
 const uniforms=useMemo(()=>({uIntensity:{value:0.7},uTime:{value:0}}),[]);
 useFrame(({clock})=>{const fx=typeof window!=="undefined"?window.__EVENT_HORIZON_BLACK_HOLE_CINEMATIC__:null;uniforms.uIntensity.value=THREE.MathUtils.lerp(uniforms.uIntensity.value,0.36+(fx?.proximity||0)*0.95,0.09);uniforms.uTime.value=reducedMotion?0:clock.elapsedTime;});
 return <mesh rotation={[Math.PI/2,0,0]} renderOrder={25}><torusGeometry args={[radius*0.39,radius*0.024,18,144]}/><meshBasicMaterial color="#ffb347" transparent opacity={0.72} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false}/></mesh>;
}

export default function BlackHoleCinematic({radius,settings}){
 const reducedMotion=typeof window!=="undefined"&&!!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 const intensity=settings.quality==="high"?1:settings.quality==="medium"?0.84:0.58;
 const coreRadius=radius*0.23;
 return <group><Disk radius={radius} quality={settings.quality} reducedMotion={reducedMotion}/><mesh scale={radius*1.72} renderOrder={15}><sphereGeometry args={[1,48,32]}/><meshBasicMaterial color="#ff3f08" transparent opacity={0.16} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending}/></mesh><mesh renderOrder={35}><sphereGeometry args={[coreRadius,settings.quality==="low"?32:64,settings.quality==="low"?20:40]}/><meshBasicMaterial color="#000000" toneMapped={false}/></mesh><PhotonRing radius={radius} reducedMotion={reducedMotion}/></group>;
}
