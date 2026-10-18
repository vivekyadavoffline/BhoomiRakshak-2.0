import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, RefreshCw, ZoomIn, ZoomOut, Compass, ShieldAlert, Activity, X, Database, Map } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const GLOBE_RADIUS = 4.5;
const D_ENTER_2D = 5.9;
const D_EXIT_2D  = 6.8;

function latLngToVector3(lat, lng, radius = GLOBE_RADIUS, altitude = 0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const r = radius + altitude;
  return new THREE.Vector3(-(r * Math.sin(phi) * Math.cos(theta)), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

function latLngToRotation(lat, lng) {
  return { x: lat * (Math.PI / 180), y: (-lng - 90) * (Math.PI / 180) };
}

function rotationToLatLng(rotX, rotY) {
  const lat = rotX * (180 / Math.PI);
  const lng = -rotY * (180 / Math.PI) - 90;
  return { lat: Math.max(-85, Math.min(85, lat)), lng: ((lng + 180) % 360) - 180 };
}

const NE = {
  c110: 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json',
  c50:  'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json',
  st:   'https://raw.githubusercontent.com/geohacker/india/master/state/india.geojson',
  city: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_populated_places_simple.geojson'
};

function geoJsonToLines(gj, color = 0x38bdf8, opacity = 0.6, alt = 0.007) {
  const g = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const addR = (c) => {
    if (!c || c.length < 2) return;
    const pts = [];
    for (const [lng, lat] of c) {
      if (typeof lat === 'number' && typeof lng === 'number')
        pts.push(latLngToVector3(lat, lng, GLOBE_RADIUS, alt));
    }
    if (pts.length >= 2) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  };
  const proc = (geom) => {
    if (!geom) return;
    if (geom.type === 'LineString') addR(geom.coordinates);
    else if (geom.type === 'MultiLineString') geom.coordinates.forEach(addR);
    else if (geom.type === 'Polygon') geom.coordinates.forEach(addR);
    else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(p => p.forEach(addR));
    else if (geom.type === 'GeometryCollection') geom.geometries.forEach(proc);
  };
  (gj.features || (gj.type === 'Feature' ? [gj] : [])).forEach(f => proc(f.geometry));
  return g;
}

async function loadTopo(url, key) {
  const res = await fetch(url);
  const topo = await res.json();
  const tj = await import('https://cdn.skypack.dev/topojson-client@3');
  const obj = topo.objects[key] || topo.objects[Object.keys(topo.objects)[0]];
  return tj.feature(topo, obj);
}

function mkOcean() {
  const cv = document.createElement('canvas');
  cv.width = 2048; cv.height = 1024;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, cv.height);
  g.addColorStop(0, '#010f21'); g.addColorStop(0.5, '#091f3a'); g.addColorStop(1, '#010f21');
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(56,189,248,0.06)'; ctx.lineWidth = 0.8;
  for (let lat = -80; lat <= 80; lat += 20) { const y = ((90-lat)/180)*cv.height; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(cv.width,y); ctx.stroke(); }
  for (let lon = -180; lon <= 180; lon += 30) { const x = ((lon+180)/360)*cv.width; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cv.height); ctx.stroke(); }
  return new THREE.CanvasTexture(cv);
}

const MARKS = [
  { id:'IN', name:'🇮🇳 India', lat:20.59, lng:78.96, d:9.5 },
  { id:'DEL', name:'Delhi', lat:28.61, lng:77.21, d:6.4 },
  { id:'MUM', name:'Mumbai', lat:19.08, lng:72.88, d:6.4 },
  { id:'SUN', name:'Sundarbans', lat:21.95, lng:88.91, d:6.4 },
  { id:'WYD', name:'Wayanad', lat:11.61, lng:76.08, d:6.4 },
];

const phaseCol = (p) => p==='Immediate'?'#ef4444':p==='Short-Term'?'#f59e0b':'#10b981';

function LeafletSync({ center, onZoomOut }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView([center.lat, center.lng], map.getZoom(), { animate: false }); }, [center, map]);
  
  useMapEvents({
    zoomend: () => {
      if (map.getZoom() < 8) {
        onZoomOut();
      }
    }
  });
  
  return null;
}

export default function Earth3D({ zones=[], selectedIdRef, onSelect, height=480, autoRotate:initAR=false, filterRedOnly:initFR=false }) {
  const mountRef   = useRef(null);
  const camRef     = useRef(null);
  const rendRef    = useRef(null);
  const globeRef   = useRef(null);
  const pinsRef    = useRef(null);
  const arcsRef    = useRef(null);
  const bordRef    = useRef(null);
  const rcRef      = useRef(new THREE.Raycaster());
  const msRef      = useRef(new THREE.Vector2());

  const l110 = useRef(null); const l50 = useRef(null); const lSt = useRef(null); const lCity = useRef(null);
  const lodDone = useRef({ c110:false, c50:false, st:false, city:false });

  const drag    = useRef(false);
  const pm      = useRef({ x:0,y:0 });
  const tRot    = useRef({ x:0.28, y:-1.38 });
  const cRot    = useRef({ x:0.28, y:-1.38 });
  const tDist   = useRef(11.0);
  const cDist   = useRef(11.0);
  const tTilt   = useRef(0);
  const cLOD    = useRef('FAR');
  const arRef   = useRef(initAR);
  const saRef   = useRef(true);
  const inTrans = useRef(false);

  const [show2D,      setShow2D]     = useState(false);
  const [mapCtr,      setMapCtr]     = useState({ lat:20.59, lng:78.96 });
  const [mapZm,       setMapZm]      = useState(12);
  const [is3D,        setIs3D]       = useState(false);
  const [autoRot,     setAutoRot]    = useState(initAR);
  const [filtRed,     setFiltRed]    = useState(initFR);
  const [showArcs,    setShowArcs]   = useState(true);
  const [hovered,     setHovered]    = useState(null);
  const [ttPos,       setTtPos]      = useState({ x:0,y:0 });
  const [selZone,     setSelZone]    = useState(null);
  const [zInfo,       setZInfo]      = useState({ name:'🌍 Global', scale:'1:100M', altKm:7800 });
  const [lodMsg,      setLodMsg]     = useState('Loading geographic data…');

  useEffect(() => { arRef.current = autoRot; }, [autoRot]);
  useEffect(() => { saRef.current = showArcs; }, [showArcs]);

  const updLOD = useCallback((lod) => {
    if (l110.current)  l110.current.visible  = lod==='FAR'||lod==='MEDIUM';
    if (l50.current)   l50.current.visible   = lod==='MEDIUM';
    if (lSt.current)   lSt.current.visible   = lod==='CLOSE'||lod==='VERY_CLOSE';
    if (lCity.current) lCity.current.visible  = lod==='VERY_CLOSE';
  }, []);

  // SCENE INIT
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth||800, H = height;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010b18, 0.011);
    const cam = new THREE.PerspectiveCamera(42, W/H, 0.1, 1000);
    cam.position.z = cDist.current;
    camRef.current = cam;
    const rend = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
    rend.setSize(W, H);
    rend.setPixelRatio(Math.min(window.devicePixelRatio,2));
    rend.toneMapping = THREE.ACESFilmicToneMapping;
    rend.toneMappingExposure = 1.4;
    el.appendChild(rend.domElement);
    rendRef.current = rend;

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xf0f8ff, 2.1); sun.position.set(25,25,25); scene.add(sun);
    const back = new THREE.DirectionalLight(0x0369a1, 0.9); back.position.set(-20,-10,-15); scene.add(back);

    const sp = new Float32Array(2400); for(let i=0;i<2400;i++) sp[i]=(Math.random()-0.5)*200;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp,3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0x94a3b8,size:0.28,transparent:true,opacity:0.65})));

    const gg = new THREE.Group(); globeRef.current = gg; scene.add(gg);
    const em = new THREE.MeshStandardMaterial({ map:mkOcean(), roughness:0.6, metalness:0.08 });
    const tl = new THREE.TextureLoader();
    tl.load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/planets/earth_atmos_2048.jpg',
      t=>{t.anisotropy=rend.capabilities.getMaxAnisotropy();em.map=t;em.needsUpdate=true;}, undefined,
      ()=>tl.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
        t=>{t.anisotropy=rend.capabilities.getMaxAnisotropy();em.map=t;em.needsUpdate=true;}));
    gg.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS,96,96), em));
    gg.add(new THREE.Mesh(new THREE.SphereGeometry(GLOBE_RADIUS*1.044,64,64), new THREE.MeshBasicMaterial({color:0x38bdf8,side:THREE.BackSide,transparent:true,opacity:0.20})));

    const bg = new THREE.Group(); bordRef.current = bg; gg.add(bg);
    const pg = new THREE.Group(); pinsRef.current = pg; gg.add(pg);
    const ag = new THREE.Group(); arcsRef.current = ag; gg.add(ag);
    gg.rotation.x = cRot.current.x; gg.rotation.y = cRot.current.y;

    const onWh = (e) => {
      e.preventDefault(); e.stopPropagation();
      const f = e.deltaMode===1?0.14:e.deltaMode===2?2.0:0.008;
      tDist.current = Math.max(4.5, Math.min(22.0, tDist.current + e.deltaY*f));
    };
    el.addEventListener('wheel', onWh, { passive:false });

    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!drag.current && arRef.current) tRot.current.y += 0.0013;
      cRot.current.x += (tRot.current.x - cRot.current.x)*0.075;
      cRot.current.y += (tRot.current.y - cRot.current.y)*0.075;
      gg.rotation.x = cRot.current.x; gg.rotation.y = cRot.current.y;
      cDist.current += (tDist.current - cDist.current)*0.075;
      cam.position.z = cDist.current;
      cam.rotation.x += (tTilt.current - cam.rotation.x)*0.075;

      const d = cDist.current;

      // 2D switch logic
      if (d < D_ENTER_2D && !inTrans.current) {
        inTrans.current = true;
        const { lat, lng } = rotationToLatLng(cRot.current.x, cRot.current.y);
        setMapCtr({ lat, lng });
        setMapZm(13);
        setShow2D(true);
        setTimeout(() => { inTrans.current = false; }, 1500);
      } else if (d > D_EXIT_2D && !inTrans.current) {
        setShow2D(false);
      }

      let lod = d>14?'FAR':d>9?'MEDIUM':d>6.5?'CLOSE':'VERY_CLOSE';
      if (lod !== cLOD.current) { cLOD.current = lod; updLOD(lod); }

      const altKm = Math.round((d-GLOBE_RADIUS)*1200);
      setZInfo(d>14?{name:'🌍 Global Earth View',scale:'1:100,000,000',altKm}
        :d>9?{name:'🌐 Country / Regional',scale:'1:25,000,000',altKm}
        :d>6.5?{name:'🗺️ State / District',scale:'1:5,000,000',altKm}
        :{name:'📍 Local City & Zone',scale:'1:500,000',altKm});

      if (pinsRef.current) {
        const sc = Math.max(0.28, Math.min(1.0, d/12.0));
        pinsRef.current.children.forEach(c=>{ if(c.userData.isPin) c.scale.setScalar(sc); });
      }
      rend.render(scene, cam);
    };
    tick();

    const onRz = () => { if(!el) return; cam.aspect=el.clientWidth/height; cam.updateProjectionMatrix(); rend.setSize(el.clientWidth,height); };
    window.addEventListener('resize', onRz);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onRz);
      el.removeEventListener('wheel', onWh);
      if (rend.domElement && el.contains(rend.domElement)) el.removeChild(rend.domElement);
      rend.dispose();
    };
  }, [height, updLOD]);

  // LOD DATA
  useEffect(() => {
    if (!bordRef.current) return;
    (async () => {
      if (!lodDone.current.c110) {
        try {
          const gj = await loadTopo(NE.c110,'countries');
          if (!bordRef.current) return;
          const l = geoJsonToLines(gj,0x38bdf8,0.50,0.006); l.visible=true; l110.current=l; bordRef.current.add(l);
          lodDone.current.c110=true; setLodMsg('Country borders loaded (Natural Earth 1:110m) ✓');
        } catch { if (!l110.current && bordRef.current) { const fb=mkFB(); l110.current=fb; bordRef.current.add(fb); } setLodMsg('Using built-in geographic data'); }
      }
      if (!lodDone.current.c50) {
        try { const gj=await loadTopo(NE.c50,'countries'); if(!bordRef.current) return; const l=geoJsonToLines(gj,0x7dd3fc,0.60,0.007); l.visible=false; l50.current=l; bordRef.current.add(l); lodDone.current.c50=true; } catch {}
      }
      if (!lodDone.current.st) {
        try { const r=await fetch(NE.st); const gj=await r.json(); if(!bordRef.current) return; const l=geoJsonToLines(gj,0x34d399,0.70,0.009); l.visible=false; lSt.current=l; bordRef.current.add(l); lodDone.current.st=true; setLodMsg('State borders loaded (Natural Earth Admin1) ✓'); } catch {}
      }
      if (!lodDone.current.city) {
        try {
          const r=await fetch(NE.city); const gj=await r.json(); if(!bordRef.current||!gj.features) return;
          const cg=new THREE.Group(); cg.visible=false;
          const dg=new THREE.SphereGeometry(0.022,8,8);
          gj.features.filter(f=>f.geometry?.type==='Point'&&(f.properties.pop_max||0)>500000).slice(0,300).forEach(f=>{
            const [lng,lat]=f.geometry.coordinates; const pos=latLngToVector3(lat,lng,GLOBE_RADIUS,0.04);
            const m=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({color:0xfbbf24})); m.position.copy(pos); m.userData={cityName:f.properties.name,isCity:true}; cg.add(m);
          });
          lCity.current=cg; bordRef.current.add(cg); lodDone.current.city=true; setLodMsg('All geographic data loaded ✓  (Natural Earth + OSM)');
        } catch {}
      }
      updLOD(cLOD.current);
    })();
  }, [updLOD]);

  function mkFB() {
    const g=new THREE.Group(); const mat=new THREE.LineBasicMaterial({color:0x38bdf8,transparent:true,opacity:0.45});
    [[  [35,68],[35,90],[25,95],[20,90],[10,80],[8,77],[13,75],[20,72],[23,68],[35,68]],
     [  [71,28],[70,60],[45,60],[36,36],[36,-9],[60,-5],[71,28]],
     [  [37,-6],[35,33],[12,51],[-34,25],[-34,18],[5,9],[15,-17],[37,-6]],
     [  [75,-168],[70,-60],[45,-64],[25,-80],[15,-90],[15,-105],[30,-120],[60,-165],[75,-168]],
     [  [12,-73],[5,-35],[-35,-55],[-55,-68],[-45,-75],[-5,-80],[12,-73]],
     [  [-12,113],[-12,153],[-38,150],[-34,115],[-12,113]],
     [  [72,60],[70,140],[50,140],[40,120],[30,120],[15,108],[10,105],[-5,140],[20,145],[45,140],[65,100],[55,60],[72,60]]
    ].forEach(ring=>{
      const pts=ring.map(([lat,lng])=>latLngToVector3(lat,lng,GLOBE_RADIUS,0.005));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat));
    });
    return g;
  }

  // PINS
  useEffect(() => {
    const pg=pinsRef.current, ag=arcsRef.current;
    if(!pg||!ag) return;
    [pg,ag].forEach(g=>{ while(g.children.length>0){const c=g.children.pop();c.geometry?.dispose();c.material?.dispose();} });
    let list=filtRed?zones.filter(z=>z.phase==='Immediate'):zones;
    const d=tDist.current;
    if(d>14) list=list.slice(0,45); else if(d>9) list=list.slice(0,130); else if(d>6.5) list=list.slice(0,270);
    const cM={'Immediate':'#ef4444','Short-Term':'#f59e0b'};
    const sg=new THREE.SphereGeometry(0.045,14,14);
    list.forEach((z,i)=>{
      const lat=z.lat||20.5,lng=z.lng||78.9;
      const m=new THREE.Mesh(sg,new THREE.MeshBasicMaterial({color:cM[z.phase]||'#10b981'}));
      m.position.copy(latLngToVector3(lat,lng,GLOBE_RADIUS,0.036)); m.userData={zone:z,isPin:true}; pg.add(m);
      if(showArcs&&z.phase==='Immediate'&&i%3===0){
        const safe=zones.find(x=>x.phase==='Medium-Term')||zones[zones.length-1];
        if(safe&&safe.id!==z.id){
          const s=latLngToVector3(lat,lng,GLOBE_RADIUS,0.04),e=latLngToVector3(safe.lat||20,safe.lng||78,GLOBE_RADIUS,0.04);
          const mid=new THREE.Vector3().addVectors(s,e).multiplyScalar(0.5); mid.setLength(GLOBE_RADIUS+s.distanceTo(e)*0.35);
          ag.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(s,mid,e).getPoints(32)),new THREE.LineBasicMaterial({color:0xef4444,transparent:true,opacity:0.55})));
        }
      }
    });
  }, [zones, filtRed, showArcs]);

  // POINTER
  const onPD=(e)=>{ if(show2D) return; drag.current=true; pm.current={x:e.clientX,y:e.clientY}; };
  const onPU=()=>{ drag.current=false; };
  const onPM=(e)=>{
    if(show2D) return;
    const el=mountRef.current; if(!el) return;
    if(drag.current){ const dx=e.clientX-pm.current.x,dy=e.clientY-pm.current.y; tRot.current.y+=dx*0.005; tRot.current.x=Math.max(-1.4,Math.min(1.4,tRot.current.x+dy*0.005)); pm.current={x:e.clientX,y:e.clientY}; return; }
    const rect=el.getBoundingClientRect(); msRef.current.x=((e.clientX-rect.left)/rect.width)*2-1; msRef.current.y=-((e.clientY-rect.top)/rect.height)*2+1;
    if(camRef.current&&pinsRef.current){ rcRef.current.setFromCamera(msRef.current,camRef.current); const hits=rcRef.current.intersectObjects(pinsRef.current.children); const hit=hits.find(h=>h.object.userData?.isPin);
      if(hit){setHovered(hit.object.userData.zone);setTtPos({x:e.clientX-rect.left,y:e.clientY-rect.top});el.style.cursor='pointer';} else{setHovered(null);el.style.cursor='grab';} }
  };
  const onClick=()=>{
    if(show2D||!hovered) return;
    setSelZone(hovered); if(selectedIdRef) selectedIdRef.current=hovered.id; if(onSelect) onSelect(hovered);
    tRot.current=latLngToRotation(hovered.lat||20.59,hovered.lng||78.96); tDist.current=5.5; tTilt.current=0.42;
  };

  const focusOn=(lat,lng,d=6.5)=>{ tRot.current=latLngToRotation(lat,lng); tDist.current=d; tTilt.current=0.38; };
  const resetV=()=>{ setShow2D(false); tRot.current={x:0.28,y:-1.38}; tDist.current=11.0; tTilt.current=0; };
  const zIn=()=>{ tDist.current=Math.max(4.5,tDist.current-2.5); };
  const zOut=()=>{ tDist.current=Math.min(22.0,tDist.current+2.5); if(tDist.current>D_EXIT_2D) setShow2D(false); };
  const t3D=()=>{ setIs3D(v=>!v); tTilt.current=is3D?0:0.52; };

  const B={display:'flex',alignItems:'center',gap:5,backdropFilter:'blur(10px)',cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'};
  const flyB=(c)=>({...B,background:'rgba(15,23,42,0.88)',color:c,border:'1px solid rgba(255,255,255,0.15)',padding:'5px 12px',borderRadius:20,fontSize:11});
  const togB=(on,c)=>({...B,background:on?`${c}28`:'rgba(15,23,42,0.88)',color:on?c:'#cbd5e1',border:`1px solid ${on?c+'55':'rgba(255,255,255,0.15)'}`,padding:'5px 12px',borderRadius:8,fontSize:12});
  const ctrlB={background:'rgba(15,23,42,0.92)',color:'#e2e8f0',border:'1px solid rgba(255,255,255,0.2)',width:40,height:40,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 6px 18px rgba(0,0,0,0.55)',backdropFilter:'blur(12px)'};
  const hud={background:'rgba(10,18,35,0.92)',padding:'6px 14px',borderRadius:12,border:'1px solid rgba(56,189,248,0.22)',fontSize:11,color:'#e2e8f0',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',gap:10};

  const leafZones = filtRed ? zones.filter(z=>z.phase==='Immediate') : zones.slice(0,500);

  return (
    <div style={{position:'relative',width:'100%',height,backgroundColor:'#010b18',borderRadius:16,overflow:'hidden',border:'1px solid rgba(255,255,255,0.1)',boxShadow:'0 24px 52px rgba(0,0,0,0.75)',userSelect:'none'}}>

      {/* 3D Globe canvas */}
      <div ref={mountRef} style={{width:'100%',height:'100%',cursor:show2D?'default':'grab',position:'absolute',top:0,left:0}}
        onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerLeave={onPU} onClick={onClick} />

      {/* 2D Leaflet map — perspective-tilt landing animation */}
      <AnimatePresence>
        {show2D && (
          <motion.div key="map2d"
            initial={{ opacity:0, scale:1.12, rotateX:28, y:35, transformPerspective:900, transformOrigin:'center bottom' }}
            animate={{ opacity:1, scale:1, rotateX:0, y:0, transformPerspective:900, transformOrigin:'center bottom' }}
            exit={{   opacity:0, scale:1.08, rotateX:22, y:25, transformPerspective:900, transformOrigin:'center bottom' }}
            transition={{ duration:0.75, ease:[0.22,1,0.36,1] }}
            style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',borderRadius:16,overflow:'hidden',zIndex:5}}>

            {/* vignette overlay */}
            <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:1,pointerEvents:'none',background:'radial-gradient(ellipse at center, transparent 55%, rgba(1,11,24,0.6) 100%)',borderRadius:16}}/>

            <MapContainer center={[mapCtr.lat, mapCtr.lng]} zoom={mapZm} zoomControl={false} attributionControl={false} style={{width:'100%',height:'100%'}}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}/>
              {leafZones.map(z => z.lat&&z.lng ? (
                <CircleMarker key={z.id} center={[z.lat,z.lng]}
                  radius={z.phase==='Immediate'?7:5}
                  fillColor={phaseCol(z.phase)} color="rgba(0,0,0,0.4)" weight={1} fillOpacity={0.85}
                  eventHandlers={{click:()=>{ setSelZone(z); if(selectedIdRef) selectedIdRef.current=z.id; if(onSelect) onSelect(z); }}}>
                  <Popup><div style={{fontSize:12}}><strong>{z.name}</strong><br/><span style={{color:'#666'}}>{z.district}</span><br/><span style={{color:phaseCol(z.phase),fontWeight:700}}>{z.phase}</span></div></Popup>
                </CircleMarker>
              ) : null)}
              <LeafletSync center={mapCtr} onZoomOut={resetV} />
            </MapContainer>

            {/* 2D badge */}
            <div style={{position:'absolute',bottom:14,left:'50%',transform:'translateX(-50%)',zIndex:10,background:'rgba(10,18,35,0.92)',border:'1px solid rgba(56,189,248,0.35)',borderRadius:20,padding:'5px 16px',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',gap:8,color:'#e2e8f0',fontSize:11,fontWeight:600,boxShadow:'0 4px 16px rgba(0,0,0,0.6)',whiteSpace:'nowrap'}}>
              <Map size={13} style={{color:'#38bdf8'}}/>
              <span style={{color:'#38bdf8'}}>OpenStreetMap</span>
              <span style={{color:'#e2e8f0'}}>· Zoom out to return to 3D Globe</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top controls */}
      <div style={{position:'absolute',top:14,left:14,display:'flex',flexDirection:'column',gap:8,zIndex:20,maxWidth:490}}>
        <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
          {MARKS.map(m=>(
            <button key={m.id} onClick={()=>{ setShow2D(false); focusOn(m.lat,m.lng,m.d); }} style={flyB(m.id==='IN'?'#38bdf8':'#e2e8f0')}>{m.name}</button>
          ))}
        </div>
        {!show2D ? (
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            <button onClick={()=>setAutoRot(v=>!v)} style={togB(autoRot,'#38bdf8')}><RefreshCw size={13}/> {autoRot?'Orbit On':'Orbit Off'}</button>
            <button onClick={()=>setFiltRed(v=>!v)} style={togB(filtRed,'#ef4444')}><ShieldAlert size={13}/> Red Zones ({zones.filter(z=>z.phase==='Immediate').length})</button>
            <button onClick={()=>setShowArcs(v=>!v)} style={togB(showArcs,'#38bdf8')}><Activity size={13}/> Evac Arcs</button>
          </div>
        ) : null}
      </div>

      {/* Bottom-left HUD (3D only) */}
      {!show2D && (
        <div style={{position:'absolute',bottom:12,left:12,display:'flex',flexDirection:'column',gap:5,zIndex:10,maxWidth:'calc(100% - 70px)'}}>
          <div style={{...hud, flexWrap:'wrap', padding:'4px 10px', fontSize:10}}>
            <span style={{fontWeight:700,color:'#38bdf8'}}>{zInfo.name}</span>
            <span style={{opacity:0.3}}>|</span>
            <span>Scale: <strong style={{color:'#34d399'}}>{zInfo.scale}</strong></span>
            <span style={{opacity:0.3}}>|</span>
            <span>Alt: <strong style={{color:'#fbbf24'}}>~{zInfo.altKm.toLocaleString()} km</strong></span>
          </div>
          <div style={{fontSize:9.5,color:'#64748b',paddingLeft:4,display:'flex',alignItems:'center',gap:4}}><Globe size={10}/> {lodMsg}</div>
          <div style={{display:'flex',gap:8,fontSize:10,color:'#cbd5e1',paddingLeft:2,flexWrap:'wrap'}}>
            <span style={{color:'#ef4444',fontWeight:700}}>🔴 Immediate</span>
            <span style={{color:'#f59e0b',fontWeight:700}}>🟡 Watch</span>
            <span style={{color:'#10b981',fontWeight:700}}>🟢 Safe Haven</span>
          </div>
        </div>
      )}

      {/* Camera controls (3D only) */}
      {!show2D && (
        <div style={{position:'absolute',bottom:14,right:14,display:'flex',flexDirection:'column',gap:6,alignItems:'center',zIndex:10}}>
          <button onClick={resetV} title="Reset View" style={ctrlB}><Compass size={20} style={{color:'#ef4444'}}/></button>
          <button onClick={t3D} style={{...ctrlB,background:is3D?'rgba(56,189,248,0.28)':'rgba(15,23,42,0.92)',color:is3D?'#38bdf8':'#e2e8f0'}}><span style={{fontSize:12,fontWeight:800}}>{is3D?'3D':'2D'}</span></button>
          <button onClick={zIn} title="Zoom In" style={ctrlB}><ZoomIn size={18}/></button>
          <button onClick={zOut} title="Zoom Out" style={ctrlB}><ZoomOut size={18}/></button>
        </div>
      )}

      {/* Click info panel */}
      <AnimatePresence>
        {selZone && (
          <motion.div initial={{opacity:0,x:50}} animate={{opacity:1,x:0}} exit={{opacity:0,x:50}} transition={{duration:0.28}}
            style={{position:'absolute',top:14,right:show2D?14:14,width:'min(310px, calc(100% - 28px))',maxWidth:'calc(100% - 28px)',background:'rgba(10,18,35,0.97)',border:`1px solid ${phaseCol(selZone.phase)}`,borderRadius:14,padding:14,color:'#fff',boxShadow:'0 20px 48px rgba(0,0,0,0.9)',backdropFilter:'blur(18px)',zIndex:30}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
              <div>
                <span style={{fontSize:10,fontWeight:800,textTransform:'uppercase',padding:'2px 8px',borderRadius:4,background:`${phaseCol(selZone.phase)}22`,color:phaseCol(selZone.phase)}}>{selZone.phase}</span>
                <h3 style={{margin:'4px 0 0',fontSize:16,fontWeight:800,color:'#f8fafc'}}>{selZone.name}</h3>
                <div style={{fontSize:12,color:'#94a3b8'}}>{selZone.district}, {selZone.state||'India'}</div>
              </div>
              <button onClick={()=>setSelZone(null)} style={{background:'transparent',border:'none',color:'#94a3b8',cursor:'pointer'}}><X size={18}/></button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,background:'rgba(30,41,59,0.6)',padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',fontSize:11,marginBottom:10}}>
              <div><span style={{color:'#64748b'}}>Latitude</span><div style={{fontWeight:700,fontFamily:'monospace',color:'#38bdf8'}}>{selZone.lat?.toFixed(4)}° N</div></div>
              <div><span style={{color:'#64748b'}}>Longitude</span><div style={{fontWeight:700,fontFamily:'monospace',color:'#38bdf8'}}>{selZone.lng?.toFixed(4)}° E</div></div>
              <div><span style={{color:'#64748b'}}>Population</span><div style={{fontWeight:700,color:'#e2e8f0'}}>{(selZone.population||0).toLocaleString()}</div></div>
              <div><span style={{color:'#64748b'}}>Priority</span><div style={{fontWeight:800,color:'#ef4444'}}>{selZone.priorityScore}/100</div></div>
            </div>
            {[['Elderly','elderly','20%'],['Disabled','disabled','6%'],['Low Income','lowIncome','75%']].map(([l,k,d])=>(
              <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#cbd5e1',marginBottom:4}}><span>{l}:</span><strong style={{color:'#f59e0b'}}>{selZone[k]||d}</strong></div>
            ))}
            <div style={{fontSize:11,background:'rgba(239,68,68,0.1)',padding:'8px 10px',borderRadius:6,borderLeft:`3px solid ${phaseCol(selZone.phase)}`,marginTop:8,marginBottom:10,color:'#fca5a5'}}><strong>Hazard:</strong> {selZone.hazard}</div>
            <div style={{fontSize:10,color:'#64748b',display:'flex',alignItems:'center',gap:5,paddingTop:6,borderTop:'1px solid rgba(255,255,255,0.08)'}}><Database size={11} style={{color:'#38bdf8'}}/> Bhoomi Rakshak Geo-DB + Natural Earth ({selZone.lastSurveyed||'2026'})</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover tooltip (3D only) */}
      {!show2D && hovered && !selZone && (
        <div style={{position:'absolute',left:ttPos.x+15,top:ttPos.y-52,pointerEvents:'none',background:'rgba(10,18,35,0.96)',border:`1px solid ${phaseCol(hovered.phase)}`,borderRadius:10,padding:'8px 12px',color:'#fff',boxShadow:'0 12px 30px rgba(0,0,0,0.8)',backdropFilter:'blur(14px)',zIndex:20,minWidth:170}}>
          <div style={{fontWeight:700,fontSize:12}}>{hovered.name}</div>
          <div style={{fontSize:11,color:'#94a3b8'}}>{hovered.district}</div>
          <div style={{fontSize:11,color:'#38bdf8',marginTop:4}}>Click to zoom → opens 2D map</div>
        </div>
      )}
    </div>
  );
}
