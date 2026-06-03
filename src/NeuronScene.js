// 3D-граф нейронов для React Native (Expo).
// Рендер через expo-gl + three. Без DOM: текстуры генерируем процедурно.
import React, { useRef, useEffect } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";

const PRIO = { high: "#ff5765", med: "#f0b232", low: "#4fd1ad" };
const SELF = "#e7eef2";
const colorOf = (p) => (p.id === "you" ? SELF : (PRIO[p.priority] || PRIO.med));

function hashStr(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);} return h>>>0; }
function mulberry32(a){ return function(){ a|=0;a=(a+0x6d2b79f5)|0; let t=Math.imul(a^(a>>>15),1|a); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

function fibSphere(i,n,R){
  if(n<=1) return new THREE.Vector3(R,0,0);
  const off=2/n, inc=Math.PI*(3-Math.sqrt(5));
  const y=i*off-1+off/2, r=Math.sqrt(Math.max(0,1-y*y)), phi=i*inc;
  return new THREE.Vector3(Math.cos(phi)*r, y, Math.sin(phi)*r).multiplyScalar(R);
}

// мягкая радиальная текстура (вместо canvas) для гало/точек/импульсов
function radialTexture(size=64){
  const data=new Uint8Array(size*size*4); const c=(size-1)/2;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4; const d=Math.sqrt((x-c)**2+(y-c)**2)/c;
    const v=Math.pow(Math.max(0,1-d),1.7);
    data[i]=255; data[i+1]=255; data[i+2]=255; data[i+3]=Math.floor(v*255);
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  t.needsUpdate=true; return t;
}

function buildDendrites(id,color,somaR){
  const rng=mulberry32(hashStr(id+"d")); const pos=[],col=[],tips=[]; const c=new THREE.Color(color);
  const seg=(a,b,br)=>{ pos.push(a.x,a.y,a.z,b.x,b.y,b.z); const x=br,y=br*0.82; col.push(c.r*x,c.g*x,c.b*x,c.r*y,c.g*y,c.b*y); };
  function grow(origin,dir,len,depth,bright){
    const steps=5; let prev=origin.clone(); const d=dir.clone().normalize();
    const axis=new THREE.Vector3(rng()-0.5,rng()-0.5,rng()-0.5).normalize(); const bend=(rng()-0.5)*1.0;
    for(let s=1;s<=steps;s++){ const tt=s/steps; const dd=d.clone().applyAxisAngle(axis,bend*tt);
      const p=origin.clone().add(dd.multiplyScalar(len*tt)); seg(prev,p,bright*(1-tt*0.55)); prev=p; }
    tips.push(prev.clone());
    if(depth<2){ const nb=depth===0?1+((rng()*2)|0):1+((rng()*1.4)|0);
      for(let k=0;k<nb;k++){ const nd=d.clone().applyAxisAngle(new THREE.Vector3(rng()-0.5,rng()-0.5,rng()-0.5).normalize(),(rng()-0.3)*1.2);
        grow(prev,nd,len*(0.55+rng()*0.2),depth+1,bright*0.8); } }
  }
  const count=7+((rng()*3)|0);
  for(let i=0;i<count;i++){
    const off=2/count, inc=Math.PI*(3-Math.sqrt(5)); const y=i*off-1+off/2, rr=Math.sqrt(Math.max(0,1-y*y)), phi=i*inc;
    const v=new THREE.Vector3(Math.cos(phi)*rr+(rng()-0.5)*0.3, y, Math.sin(phi)*rr+(rng()-0.5)*0.3).normalize();
    grow(v.clone().multiplyScalar(somaR*0.85), v, somaR*(1.9+rng()*1.1), 0, 1.0);
  }
  return {pos,col,tips};
}

function buildGraph(a, graph, focus){
  // очистить прошлые объекты
  for(const d of a.disposeList){ if(d.parent)d.parent.remove(d); d.geometry&&d.geometry.dispose&&d.geometry.dispose();
    if(d.material){ const m=d.material; if(Array.isArray(m))m.forEach(x=>x.dispose&&x.dispose()); else m.dispose&&m.dispose(); } }
  a.disposeList=[]; a.nodeObjs=[]; a.somaMeshes=[]; a.pulses=[];

  const ring=(graph[focus]&&graph[focus].links)||[];
  const cR=0.62, rR=ring.length<=6?0.42:ring.length<=10?0.34:0.28, DIST=3.6;
  const layout=[{id:focus,pos:new THREE.Vector3(0,0,0),r:cR}];
  ring.forEach((id,i)=>layout.push({id,pos:fibSphere(i,ring.length,DIST),r:rR}));

  for(const L of layout){
    const node=graph[L.id]; const color=colorOf(node);
    const group=new THREE.Group(); group.position.copy(L.pos); a.world.add(group); a.disposeList.push(group);

    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:a.dotTex,color:new THREE.Color(color),transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false}));
    halo.scale.setScalar(L.r*5.6); group.add(halo); a.disposeList.push(halo);

    const somaMat=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(0.35),emissive:new THREE.Color(color),emissiveIntensity:0.65,roughness:0.3,metalness:0.0});
    const soma=new THREE.Mesh(a.sphereGeo,somaMat); soma.scale.setScalar(L.r); soma.userData.nodeId=L.id; group.add(soma); a.disposeList.push(soma); a.somaMeshes.push(soma);

    const core=new THREE.Mesh(a.sphereGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false}));
    core.scale.setScalar(L.r*0.4); group.add(core); a.disposeList.push(core);

    const {pos,col,tips}=buildDendrites(L.id,color,L.r);
    const dg=new THREE.BufferGeometry(); dg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); dg.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
    const lines=new THREE.LineSegments(dg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.95,blending:THREE.AdditiveBlending,depthWrite:false}));
    group.add(lines); a.disposeList.push(lines);

    const tg=new THREE.BufferGeometry(); const tp=[]; tips.forEach(v=>tp.push(v.x,v.y,v.z)); tg.setAttribute("position",new THREE.Float32BufferAttribute(tp,3));
    const pts=new THREE.Points(tg,new THREE.PointsMaterial({map:a.dotTex,color:new THREE.Color(color),size:L.r*0.7,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true}));
    group.add(pts); a.disposeList.push(pts);

    a.nodeObjs.push({id:L.id,group,soma,halo,r:L.r,phase:Math.random()*10});
  }

  // аксоны центр → кольцо + импульсы
  const cp=[],cc=[]; const ctr=new THREE.Color(colorOf(graph[focus]));
  layout.slice(1).forEach(L=>{ const col=new THREE.Color(colorOf(graph[L.id]));
    cp.push(0,0,0,L.pos.x,L.pos.y,L.pos.z);
    cc.push(ctr.r*0.6,ctr.g*0.6,ctr.b*0.6,col.r*0.6,col.g*0.6,col.b*0.6);
    const ps=new THREE.Sprite(new THREE.SpriteMaterial({map:a.dotTex,color:col,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    ps.scale.setScalar(0.28); a.world.add(ps); a.disposeList.push(ps);
    a.pulses.push({sprite:ps,from:new THREE.Vector3(0,0,0),to:L.pos.clone(),ph:Math.random()});
  });
  if(cp.length){ const cg=new THREE.BufferGeometry(); cg.setAttribute("position",new THREE.Float32BufferAttribute(cp,3)); cg.setAttribute("color",new THREE.Float32BufferAttribute(cc,3));
    const cl=new THREE.LineSegments(cg,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.7,blending:THREE.AdditiveBlending,depthWrite:false}));
    a.world.add(cl); a.disposeList.push(cl); }
}

export default function NeuronScene({ graph, focus, selectedId, onSelect }){
  const api=useRef({ ready:false, disposeList:[], nodeObjs:[], somaMeshes:[], pulses:[] });
  const layout=useRef({ w:1, h:1 });
  const rot=useRef({ x:0.25, y:0.2 }), vel=useRef({ x:0, y:0 }), dragging=useRef(false);
  const lastPt=useRef({ x:0, y:0 }), moved=useRef(0), rafRef=useRef(0);
  const graphRef=useRef(graph), focusRef=useRef(focus), selRef=useRef(selectedId);

  useEffect(()=>{ graphRef.current=graph; },[graph]);
  useEffect(()=>{ focusRef.current=focus; },[focus]);
  useEffect(()=>{ selRef.current=selectedId; },[selectedId]);
  useEffect(()=>{ if(api.current.ready) buildGraph(api.current, graphRef.current, focusRef.current); },[graph,focus]);
  useEffect(()=>()=>cancelAnimationFrame(rafRef.current),[]);

  function pick(px,py){
    const a=api.current; if(!a.ready) return;
    const ndc=new THREE.Vector2((px/layout.current.w)*2-1, -(py/layout.current.h)*2+1);
    a.scene.updateMatrixWorld(true); a.raycaster.setFromCamera(ndc,a.camera);
    const hits=a.raycaster.intersectObjects(a.somaMeshes,false);
    if(hits.length){ const id=hits[0].object.userData.nodeId;
      if(id===focusRef.current) onSelect(focusRef.current==="you"?null:focusRef.current);
      else onSelect(id);
    } else onSelect(null);
  }

  const pan=useRef(PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:(e)=>{ dragging.current=true; moved.current=0; lastPt.current={x:e.nativeEvent.locationX,y:e.nativeEvent.locationY}; },
    onPanResponderMove:(e)=>{ const x=e.nativeEvent.locationX,y=e.nativeEvent.locationY; const dx=x-lastPt.current.x,dy=y-lastPt.current.y; lastPt.current={x,y}; moved.current+=Math.abs(dx)+Math.abs(dy);
      rot.current.y+=dx*0.006; rot.current.x=Math.max(-1.3,Math.min(1.3,rot.current.x+dy*0.006)); vel.current={x:dy*0.0028,y:dx*0.0028}; },
    onPanResponderRelease:(e)=>{ dragging.current=false; if(moved.current<8) pick(e.nativeEvent.locationX,e.nativeEvent.locationY); },
    onPanResponderTerminate:()=>{ dragging.current=false; },
  })).current;

  const onContextCreate=(gl)=>{
    const w=gl.drawingBufferWidth, h=gl.drawingBufferHeight;
    const renderer=new Renderer({ gl }); renderer.setSize(w,h); renderer.setClearColor(0x000000,0);
    const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x070b12,0.05);
    const camera=new THREE.PerspectiveCamera(50,w/h,0.1,100); camera.position.set(0,0,9);
    scene.add(new THREE.AmbientLight(0x3a4a5a,0.9));
    const key=new THREE.PointLight(0xffffff,0.9); key.position.set(2,2,2); camera.add(key); scene.add(camera);
    const world=new THREE.Group(); scene.add(world);
    const dotTex=radialTexture();

    // дальние нейроны (звёзды) для глубины
    const sp=[]; const rng=mulberry32(99);
    for(let i=0;i<200;i++){ const r=10+rng()*9,t=rng()*Math.PI*2,ph=Math.acos(2*rng()-1);
      sp.push(r*Math.sin(ph)*Math.cos(t), r*Math.sin(ph)*Math.sin(t), r*Math.cos(ph)); }
    const sg=new THREE.BufferGeometry(); sg.setAttribute("position",new THREE.Float32BufferAttribute(sp,3));
    const stars=new THREE.Points(sg,new THREE.PointsMaterial({map:dotTex,size:0.13,color:0x8fb8c8,transparent:true,opacity:0.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    world.add(stars);

    Object.assign(api.current,{ gl, renderer, scene, camera, world, stars, dotTex,
      sphereGeo:new THREE.SphereGeometry(1,24,24), raycaster:new THREE.Raycaster(), ready:true });
    buildGraph(api.current, graphRef.current, focusRef.current);

    const t0=Date.now();
    const render=()=>{
      rafRef.current=requestAnimationFrame(render);
      const a=api.current; const tt=(Date.now()-t0)/1000;
      if(!dragging.current){ rot.current.y+=0.0016; rot.current.x+=vel.current.x; rot.current.y+=vel.current.y;
        rot.current.x=Math.max(-1.3,Math.min(1.3,rot.current.x)); vel.current.x*=0.93; vel.current.y*=0.93; }
      world.rotation.set(rot.current.x,rot.current.y,0);
      for(const o of a.nodeObjs){ const b=1+Math.sin(tt*1.4+o.phase)*0.04; o.group.scale.setScalar(b);
        const sel=o.id===selRef.current; o.halo.scale.setScalar(sel?o.r*7.4:o.r*5.6); o.halo.material.opacity=sel?0.95:0.7; o.soma.material.emissiveIntensity=sel?1.25:0.65; }
      for(const p of a.pulses){ p.ph+=0.008; const f=p.ph%1; p.sprite.position.lerpVectors(p.from,p.to,f); p.sprite.material.opacity=Math.max(0,1-Math.abs(f-0.5)*1.6); }
      stars.rotation.y-=0.0002;
      renderer.render(scene,camera); gl.endFrameEXP();
    };
    render();
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e)=>{ layout.current={ w:e.nativeEvent.layout.width, h:e.nativeEvent.layout.height }; }}
      {...pan.panHandlers}
    >
      <GLView style={{ flex:1 }} onContextCreate={onContextCreate} />
    </View>
  );
}
