import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap, Polyline, Tooltip as LeafletTooltip, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  AlertTriangle, MapPin, ShieldCheck, FileText, MessageSquare,
  X, Radio, Bell, Layers, Building2, Waves, Mountain,
  Printer, CheckCircle2, ClipboardList, SlidersHorizontal, Siren,
  Hospital, School, Flame, Droplets, Route, ArrowRight, Navigation, Heart, Shield,
  Boxes, Move3d, Satellite, Play, Pause, RotateCcw, Landmark, Wallet, Scale, Cog,
  Volume2, VolumeX, PhoneCall, CheckSquare, Square, Crosshair, AlertCircle, Info, Sparkles, Phone, Compass, LifeBuoy, ExternalLink, Check, Globe,
} from "lucide-react";

import { ZONES, DISTRICT_COORDS } from "../data/zonesData";
import ReverseInsurance from "../components/ReverseInsurance";
import ClimateFundCalculator from "../components/ClimateFundCalculator";
import CommunityVoice from "../components/CommunityVoice";
import { buildApiUrl } from "../services/apiConfig";
import Earth3D from "../components/Earth3D";

/* ---------------------------------------------------------------------- */
/*  NATIONAL PLANNING DATA — 1,000+ places across India                   */
/* ---------------------------------------------------------------------- */

const PHASES = ["Immediate", "Short-Term", "Medium-Term"];
const PHASE_COLOR = { Immediate: "var(--immediate)", "Short-Term": "var(--watch)", "Medium-Term": "var(--safe)" };
const PHASE_HEX = { Immediate: 0xd45143, "Short-Term": 0xc78922, "Medium-Term": 0x21845f };
const DISTRICTS = ["All Districts", ...Array.from(new Set(ZONES.map((z) => z.district))).sort()];

/* ---------------------------------------------------------------------- */
/*  3D TERRAIN PROCEDURAL ENGINE (Three.js WebGL)                         */
/* ---------------------------------------------------------------------- */

const TERRAIN_SIZE = 60;
function gauss(nx, nz, cx, cz, radius, amplitude) {
  const dx = nx - cx, dz = nz - cz;
  return amplitude * Math.exp(-((dx * dx + dz * dz) / (2 * radius * radius)));
}
function terrainHeight(nx, nz) {
  let height = 0.25 * Math.sin(nx * 9) * Math.cos(nz * 9);
  height += gauss(nx, nz, 0.87, 0.35, 0.22, 7.5);
  height += gauss(nx, nz, 0.62, 0.12, 0.18, 5.0);
  height += gauss(nx, nz, 0.62, 0.58, 0.22, 5.0);
  height -= gauss(nx, nz, 0.18, 0.28, 0.20, 2.0);
  return height;
}
function buildTerrainGeometry(segments = 56, style = "satellite", exaggeration = 1.0) {
  const vertices = [];
  const colors = [];
  const rowLength = segments + 1;
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const nx = row / segments, nz = column / segments;
      const h = terrainHeight(nx, nz) * exaggeration;
      vertices.push((nx - 0.5) * TERRAIN_SIZE, h, (nz - 0.5) * TERRAIN_SIZE);

      const color = new THREE.Color();
      const normH = Math.max(0, Math.min(1, (h + 2.0 * exaggeration) / (9.0 * exaggeration)));
      if (style === "elevation") {
        if (normH < 0.22) color.setHex(0x2d6a4f);
        else if (normH < 0.45) color.setHex(0x52b788);
        else if (normH < 0.68) color.setHex(0xf4a261);
        else if (normH < 0.85) color.setHex(0xe76f51);
        else if (normH < 0.95) color.setHex(0xd90429);
        else color.setHex(0xffffff);
      } else if (style === "geology") {
        const slopeStress = Math.abs(Math.sin(nx * 12) * Math.cos(nz * 12));
        if (normH > 0.5 && slopeStress > 0.35) color.setHex(0xef4444);
        else if (normH > 0.3) color.setHex(0xf59e0b);
        else color.setHex(0x475569);
      } else if (style === "radar") {
        color.setHSL(0.57, 0.85, 0.08 + normH * 0.26);
      } else if (style === "hydrology") {
        if (normH < 0.28) color.setHex(0x0284c7);
        else if (normH < 0.42) color.setHex(0x38bdf8);
        else if (normH < 0.68) color.setHex(0x2e6f40);
        else color.setHex(0x78716c);
      } else if (style === "slope") {
        const slopeMag = Math.abs(terrainHeight(nx + 0.02, nz) - terrainHeight(nx - 0.02, nz)) +
                         Math.abs(terrainHeight(nx, nz + 0.02) - terrainHeight(nx, nz - 0.02));
        if (slopeMag > 0.8) color.setHex(0xef4444);
        else if (slopeMag > 0.5) color.setHex(0xf97316);
        else if (slopeMag > 0.25) color.setHex(0xeab308);
        else color.setHex(0x22c55e);
      } else {
        if (normH < 0.35) color.setHex(0x486b3e);
        else if (normH < 0.65) color.setHex(0x7c735d);
        else if (normH < 0.88) color.setHex(0x948e82);
        else color.setHex(0xededed);
      }
      colors.push(color.r, color.g, color.b);
    }
  }
  const indices = [];
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * rowLength + column, b = a + 1, c = a + rowLength, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Terrain3D({ zones, selectedIdRef, onSelect, interactive = true, height = 420, style = "satellite", exaggeration = 1.0, autoRotate = true }) {
  const containerRef = useRef(null);
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let renderer, animId, ro;
    let dragging = false, moved = 0, lastX = 0, lastY = 0;
    const cam = { theta: Math.PI / 4, phi: 1.0, radius: 55 };
    const markers = {};
    const clickable = [];
    const pulses = [];
    let camera, terrainGeo, terrainMat, wireMat;

    function updateCamera() {
      camera.position.x = cam.radius * Math.sin(cam.phi) * Math.sin(cam.theta);
      camera.position.y = cam.radius * Math.cos(cam.phi);
      camera.position.z = cam.radius * Math.sin(cam.phi) * Math.cos(cam.theta);
      camera.lookAt(0, 2, 0);
    }

    try {
      const width = container.clientWidth || 400;
      const scene = new THREE.Scene();
      if (style === "radar") {
        scene.background = new THREE.Color(0x0a1420);
        scene.fog = new THREE.FogExp2(0x0a1420, 0.012);
      } else if (style === "elevation") {
        scene.background = new THREE.Color(0x1a2634);
        scene.fog = new THREE.FogExp2(0x1a2634, 0.009);
      } else if (style === "geology") {
        scene.background = new THREE.Color(0x231e1c);
        scene.fog = new THREE.FogExp2(0x231e1c, 0.009);
      } else if (style === "hydrology") {
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.FogExp2(0x0f172a, 0.01);
      } else if (style === "slope") {
        scene.background = new THREE.Color(0x181e24);
        scene.fog = new THREE.FogExp2(0x181e24, 0.009);
      } else {
        scene.background = new THREE.Color(0xd4cfc0);
        scene.fog = new THREE.FogExp2(0xcac5b5, 0.008);
      }
      camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
      updateCamera();

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.setSize(width, height);
      container.innerHTML = "";
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(style === "radar" || style === "hydrology" ? 0x224466 : 0xfff5e0, style === "radar" ? 0.8 : 0.55));
      const hemi = new THREE.HemisphereLight(0xfff4d0, 0x8aaa7a, style === "radar" ? 0.3 : 0.5);
      scene.add(hemi);
      const dirLight = new THREE.DirectionalLight(0xfff8ee, 1.1);
      dirLight.position.set(35, 55, 20);
      dirLight.castShadow = true;
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0xa0c8ff, 0.25);
      fillLight.position.set(-20, 20, -30);
      scene.add(fillLight);

      terrainGeo = buildTerrainGeometry(56, style, exaggeration);
      if (style === "radar") {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.4 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.38 });
      } else if (style === "elevation") {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.1 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.16 });
      } else if (style === "geology") {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0.08 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true, transparent: true, opacity: 0.26 });
      } else if (style === "hydrology") {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.2 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.25 });
      } else if (style === "slope") {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.8, metalness: 0.1 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, wireframe: true, transparent: true, opacity: 0.2 });
      } else {
        terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, roughness: 0.88, metalness: 0.04 });
        wireMat = new THREE.MeshBasicMaterial({ color: 0x9db88a, wireframe: true, transparent: true, opacity: 0.18 });
      }
      const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
      terrainMesh.receiveShadow = true;
      scene.add(terrainMesh);

      const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
      wireMesh.position.y += 0.02;
      scene.add(wireMesh);

      let pointLightCount = 0;
      zones.forEach((z) => {
        const nx = z.x / 100, nz = z.y / 100;
        const groundY = terrainHeight(nx, nz) * exaggeration;
        const worldX = (nx - 0.5) * TERRAIN_SIZE;
        const worldZ = (nz - 0.5) * TERRAIN_SIZE;
        const colorHex = PHASE_HEX[z.phase];
        const pinHeight = 1.8 + z.priorityScore / 12;

        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.12, pinHeight, 8),
          new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.3 })
        );
        stem.position.set(worldX, groundY + pinHeight / 2, worldZ);
        stem.userData.zoneId = z.id;
        stem.castShadow = true;
        scene.add(stem);

        const headRadius = z.phase === "Immediate" ? 0.65 : 0.52;
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(headRadius, 18, 18),
          new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: z.phase === "Immediate" ? 0.55 : 0.28, roughness: 0.2, metalness: 0.1 })
        );
        const baseY = groundY + pinHeight + headRadius;
        head.position.set(worldX, baseY, worldZ);
        head.userData.zoneId = z.id;
        head.castShadow = true;
        scene.add(head);

        if (z.phase === "Immediate" && pointLightCount < 4) {
          pointLightCount++;
          const ptLight = new THREE.PointLight(colorHex, 1.2, 8);
          ptLight.position.set(worldX, baseY, worldZ);
          scene.add(ptLight);
        }

        clickable.push(stem, head);
        markers[z.id] = { head, baseY };

        if (z.phase === "Immediate") {
          [0.8, 1.3].forEach((outerR, ri) => {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(outerR * 0.75, outerR, 32),
              new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(worldX, groundY + 0.04, worldZ);
            scene.add(ring);
            pulses.push({ mesh: ring, phase: Math.random() * Math.PI * 2 + ri * 1.2, speed: 1.8 + ri * 0.4 });
          });
        } else if (z.phase === "Short-Term") {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.75, 24),
            new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.35 })
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(worldX, groundY + 0.04, worldZ);
          scene.add(ring);
          pulses.push({ mesh: ring, phase: Math.random() * Math.PI * 2, speed: 1.2 });
        }
      });

      const raycaster = new THREE.Raycaster();
      const mouseVec = new THREE.Vector2();

      function onDown(e) {
        dragging = true;
        moved = 0;
        lastX = e.clientX;
        lastY = e.clientY;
      }
      function onMove(e) {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.theta -= dx * 0.007;
        cam.phi = Math.max(0.2, Math.min(Math.PI / 2 - 0.05, cam.phi - dy * 0.006));
        updateCamera();
      }
      function onUp(e) {
        if (moved < 6 && onSelect) {
          const rect = container.getBoundingClientRect();
          mouseVec.x = ((e.clientX - rect.left) / width) * 2 - 1;
          mouseVec.y = -((e.clientY - rect.top) / height) * 2 + 1;
          raycaster.setFromCamera(mouseVec, camera);
          const hits = raycaster.intersectObjects(clickable);
          if (hits.length) {
            onSelect(hits[0].object.userData.zoneId);
            cam.radius = Math.max(28, Math.min(cam.radius, 38));
            updateCamera();
          }
        }
        dragging = false;
      }
      function onWheel(e) {
        e.preventDefault();
        cam.radius = Math.min(90, Math.max(28, cam.radius + e.deltaY * 0.03));
        updateCamera();
      }

      if (interactive) {
        renderer.domElement.style.cursor = "grab";
        renderer.domElement.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
      }

      function animate() {
        animId = requestAnimationFrame(animate);
        const t = performance.now() * 0.001;
        if (!dragging && autoRotate) {
          cam.theta += interactive ? 0.0012 : 0.0022;
          updateCamera();
        }
        pulses.forEach((p) => {
          const s = 1 + 0.28 * Math.sin(t * (p.speed || 2) + p.phase);
          p.mesh.scale.set(s, s, s);
          p.mesh.material.opacity = 0.28 + 0.28 * Math.sin(t * (p.speed || 2) + p.phase);
        });
        const selId = selectedIdRef && selectedIdRef.current;
        Object.keys(markers).forEach((zid) => {
          const m = markers[zid];
          if (zid === selId) {
            m.head.scale.set(1.6, 1.6, 1.6);
            m.head.position.y = m.baseY + Math.sin(t * 3) * 0.15;
          } else {
            m.head.scale.set(1, 1, 1);
            m.head.position.y = m.baseY;
          }
        });
        renderer.render(scene, camera);
      }
      animate();

      ro = new ResizeObserver(() => {
        const w = container.clientWidth || width;
        camera.aspect = w / height;
        camera.updateProjectionMatrix();
        renderer.setSize(w, height);
      });
      ro.observe(container);

      return () => {
        cancelAnimationFrame(animId);
        if (ro) ro.disconnect();
        if (interactive) {
          renderer.domElement.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          renderer.domElement.removeEventListener("wheel", onWheel);
        }
        renderer.dispose();
        terrainGeo.dispose();
        terrainMat.dispose();
        wireMat.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    } catch {
      setGlFailed(true);
      return undefined;
    }
  }, [zones, interactive, height, style, exaggeration, autoRotate]); // eslint-disable-line

  if (glFailed) {
    return <div className="terrain-fallback" style={{ height }}><Mountain size={18} /> 3D terrain view isn't supported in this browser.</div>;
  }
  return <div ref={containerRef} className="terrain-canvas" style={{ height }} />;
}

function TerrainDecisionOverlay({ zone }) {
  if (!zone) return null;
  const history = zone.incidentHistory ? { events: zone.priorityScore > 50 ? 3 : 1 } : { events: 0 };
  const action = zone.site?.status === "shortfall"
    ? "Secure overflow capacity before issuing a relocation order."
    : zone.phase === "Immediate"
      ? "Approve the evacuation plan and issue a community alert."
      : "Schedule a field verification and keep the zone under review.";
  return (
    <div className="terrain-decision-overlay">
      <div className="terrain-overlay-kicker"><span className="live-dot" /> SELECTED PLANNING AREA</div>
      <div className="terrain-overlay-title"><strong>{zone.name}</strong><PhaseBadge phase={zone.phase} /></div>
      <div className="terrain-overlay-grid">
        <div><strong>{zone.priorityScore}</strong><span>priority</span></div>
        <div><strong>{Math.max(30, 100 - (zone.hazardIntensity || 50))}</strong><span>site score</span></div>
        <div><strong>{history.events}</strong><span>past events</span></div>
      </div>
      <div className="terrain-next-step"><span>NEXT STEP</span>{action}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SMALL HELPERS                                                         */
/* ---------------------------------------------------------------------- */

function AnimatedBar({ value, max = 100, color, height = 8, trackKey }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(0);
    const t = setTimeout(() => setW(Math.min(100, (value / max) * 100)), 60);
    return () => clearTimeout(t);
  }, [value, max, trackKey]);
  return (
    <div style={{ height, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, transition: "width 700ms cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  );
}

function PhaseBadge({ phase }) {
  return (
    <span className="badge" style={{ background: `${PHASE_COLOR[phase]}1a`, color: PHASE_COLOR[phase], border: `1px solid ${PHASE_COLOR[phase]}55` }}>
      {phase}
    </span>
  );
}

function HazardIcon({ icon, size = 15 }) {
  if (icon === "flood") return <Waves size={size} />;
  if (icon === "slide") return <Mountain size={size} />;
  return <AlertTriangle size={size} />;
}

function fmt(n) {
  return n.toLocaleString("en-IN");
}

/* ---------------------------------------------------------------------- */
/*  DETERMINISTIC FACILITY GENERATOR                                       */
/* ---------------------------------------------------------------------- */

function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h * 16807 + 0) % 2147483647;
    return (h & 0x7fffffff) / 2147483647;
  };
}

const HOSPITAL_NAMES = [
  "District General Hospital", "Civil Hospital", "Community Health Centre",
  "Primary Health Centre", "Sub-District Hospital", "Trauma Centre",
  "Government Medical College", "Rural Hospital", "ESI Hospital",
  "Cantonment Hospital", "Railway Hospital", "Municipal Hospital",
];
const SHELTER_NAMES = [
  "Government School Shelter", "Community Hall", "Panchayat Bhawan",
  "Relief Camp Ground", "Stadium Emergency Camp", "Temple / Dharamshala",
  "Town Hall Shelter", "ITI Training Centre", "Anganwadi Complex",
];
const FIRE_STATIONS = [
  "Central Fire Station", "Sub Fire Station", "Auxiliary Fire Post",
  "District Fire & Emergency HQ",
];

function generateFacilities(zone) {
  const rng = seededRandom(zone.id + zone.district);
  const pick = (arr, n) => {
    const shuffled = [...arr].sort(() => rng() - 0.5);
    return shuffled.slice(0, n);
  };

  const hospitalCount = Math.floor(rng() * 3) + 1;
  const shelterCount = Math.floor(rng() * 3) + 2;
  const fireCount = Math.floor(rng() * 2) + 1;
  const waterPoints = Math.floor(rng() * 5) + 3;
  const roadRating = Math.floor(rng() * 3) + 3; // 3-5 out of 5
  const totalCapacity = Math.floor(5000 + rng() * 45000);
  const bedsAvailable = Math.floor(rng() * 200) + 50;

  return {
    hospitals: pick(HOSPITAL_NAMES, hospitalCount),
    shelters: pick(SHELTER_NAMES, shelterCount),
    fireStations: pick(FIRE_STATIONS, fireCount),
    waterPoints,
    roadRating,
    totalCapacity,
    bedsAvailable,
  };
}

/* ---------------------------------------------------------------------- */
/*  DIJKSTRA SHORTEST PATH EVACUATION ROUTER                              */
/*  Directs ONLY Red (Immediate) and Yellow (Short-Term) zones            */
/*  to the nearest Green (Medium-Term) safe zone.                          */
/* ---------------------------------------------------------------------- */

function findRelocationRouteDijkstra(sourceZone, allZones) {
  if (!sourceZone) return null;
  // Direct ONLY red (Immediate) and yellow (Short-Term) zones
  const isRedOrYellow =
    sourceZone.phase === "Immediate" || sourceZone.phase === "Short-Term";
  if (!isRedOrYellow) return null;

  // Safe destinations are strictly Green (Medium-Term) zones
  const greenZones = allZones.filter(
    (z) => z.phase === "Medium-Term" && z.id !== sourceZone.id
  );
  if (greenZones.length === 0) return null;

  const haversineKm = (z1, z2) => {
    if (z1.lat && z2.lat && z1.lng && z2.lng) {
      const R = 6371;
      const dLat = ((z2.lat - z1.lat) * Math.PI) / 180;
      const dLng = ((z2.lng - z1.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((z1.lat * Math.PI) / 180) *
          Math.cos((z2.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    const dx = (z1.x || 50) - (z2.x || 50);
    const dy = (z1.y || 50) - (z2.y || 50);
    return Math.max(1, Math.round(Math.sqrt(dx * dx + dy * dy) * 12));
  };

  // Scope to closest 200 nodes around sourceZone + all green zones
  const nodesWithDist = allZones.map((z) => ({
    zone: z,
    distToSrc: haversineKm(sourceZone, z),
  }));

  const candidateNodes = nodesWithDist
    .filter((zd) => zd.distToSrc <= 450 || zd.zone.phase === "Medium-Term")
    .sort((a, b) => a.distToSrc - b.distToSrc)
    .slice(0, 200)
    .map((item) => item.zone);

  const nodeMap = new Map();
  candidateNodes.forEach((z) => nodeMap.set(z.id, z));
  if (!nodeMap.has(sourceZone.id)) nodeMap.set(sourceZone.id, sourceZone);

  const nodes = Array.from(nodeMap.values());

  // Adjacency graph: connect each node to K=6 nearest neighbors
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.id, []));

  for (let i = 0; i < nodes.length; i++) {
    const u = nodes[i];
    const distances = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const v = nodes[j];
      const d = haversineKm(u, v);
      distances.push({ target: v, dist: d });
    }
    distances.sort((a, b) => a.dist - b.dist);
    const neighbors = distances.slice(0, 6);
    neighbors.forEach((nb) => {
      // Risk factor: Red = 1.6x, Yellow = 1.25x, Green = 1.0x
      const hazardFactor =
        nb.target.phase === "Immediate"
          ? 1.6
          : nb.target.phase === "Short-Term"
          ? 1.25
          : 1.0;
      const weight = nb.dist * hazardFactor;
      adj.get(u.id).push({
        node: nb.target,
        distKm: nb.dist,
        weight,
      });
    });
  }

  // Dijkstra's Algorithm
  const dist = new Map();
  const prev = new Map();
  const unvisited = new Set();

  nodes.forEach((n) => {
    dist.set(n.id, Infinity);
    unvisited.add(n.id);
  });
  dist.set(sourceZone.id, 0);

  let targetZone = null;

  while (unvisited.size > 0) {
    let uId = null;
    let uDist = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id);
      if (d < uDist) {
        uDist = d;
        uId = id;
      }
    }

    if (uId === null || uDist === Infinity) break;
    unvisited.delete(uId);

    const uNode = nodeMap.get(uId);
    if (uId !== sourceZone.id && uNode.phase === "Medium-Term") {
      targetZone = uNode;
      break;
    }

    const edges = adj.get(uId) || [];
    for (const edge of edges) {
      const vId = edge.node.id;
      if (!unvisited.has(vId)) continue;
      const alt = uDist + edge.weight;
      if (alt < dist.get(vId)) {
        dist.set(vId, alt);
        prev.set(vId, { fromId: uId, distKm: edge.distKm });
      }
    }
  }

  // Fallback if disconnected
  if (!targetZone) {
    const sortedGreens = greenZones
      .map((gz) => ({ zone: gz, distKm: haversineKm(sourceZone, gz) }))
      .sort((a, b) => a.distKm - b.distKm);
    const best = sortedGreens[0];
    return {
      source: sourceZone,
      target: best.zone,
      distKm: Math.max(1, Math.round(best.distKm * 10) / 10),
      path: [sourceZone, best.zone],
      hops: 1,
      algorithm: "Dijkstra (Direct)",
    };
  }

  // Reconstruct path
  const path = [];
  let currId = targetZone.id;
  let totalKm = 0;

  while (currId) {
    const nodeObj = nodeMap.get(currId);
    if (nodeObj) path.unshift(nodeObj);
    const step = prev.get(currId);
    if (step) {
      totalKm += step.distKm;
      currId = step.fromId;
    } else {
      break;
    }
  }

  if (path.length === 0 || path[0].id !== sourceZone.id) {
    path.unshift(sourceZone);
  }

  const directKm = haversineKm(sourceZone, targetZone);
  const actualKm =
    totalKm > 0 ? Math.round(totalKm * 10) / 10 : Math.round(directKm * 10) / 10;

  return {
    source: sourceZone,
    target: targetZone,
    distKm: Math.max(1, actualKm),
    path,
    hops: Math.max(1, path.length - 1),
    algorithm: "Dijkstra's Shortest Path",
  };
}

const findNearestSafeZone = findRelocationRouteDijkstra;

/* ---------------------------------------------------------------------- */
/*  MAP CANVAS (2D Thematic Matrix with Contours, Hydrology, Hazard)      */
/* ---------------------------------------------------------------------- */

function MapCanvas({ zones, selectedId, onSelect, compact, visibleLayers = { hazard: true, population: true, sites: true }, relocationTarget, gridStyle = "contours", selectTrigger }) {
  const [viewCenter, setViewCenter] = useState({ x: 50, y: 38 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, centerX: 50, centerY: 38 });
  const containerRef = useRef(null);
  const selectedZone = zones.find((z) => z.id === selectedId);
  const hoveredZone = hoveredId ? zones.find((z) => z.id === hoveredId) : null;
  const isInitialMount = useRef(true);

  // Smoothly zoom in on active zone when selected
  useEffect(() => {
    if (!selectedZone) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setViewCenter({ x: selectedZone.x, y: selectedZone.y });
    setZoom((z) => Math.max(z, 2.2));
  }, [selectedZone?.id, selectTrigger]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom((z) => Math.min(8, Math.max(0.5, z * factor)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".zone-node") || e.target.closest(".site-node")) return;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      centerX: viewCenter.x,
      centerY: viewCenter.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const ratio = 100 / (rect?.width || 800);
    const dx = (e.clientX - dragStartRef.current.mouseX) * ratio;
    const dy = (e.clientY - dragStartRef.current.mouseY) * ratio;
    setViewCenter({
      x: dragStartRef.current.centerX - dx / zoom,
      y: dragStartRef.current.centerY - dy / zoom,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = (e) => {
    e?.stopPropagation();
    setViewCenter({ x: 50, y: 38 });
    setZoom(1);
  };

  const handleFocus = (e) => {
    e?.stopPropagation();
    if (relocationTarget && relocationTarget.path && relocationTarget.path.length > 0) {
      const xs = relocationTarget.path.map((p) => p.x);
      const ys = relocationTarget.path.map((p) => p.y);
      const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      setViewCenter({ x: avgX, y: avgY });
      setZoom(1.8);
    } else if (selectedZone) {
      setViewCenter({ x: selectedZone.x, y: selectedZone.y });
      setZoom(2.2);
    }
  };

  return (
    <div
      className="map-wrap"
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isDragging ? "grabbing" : "grab",
        position: "relative",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 10, display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(8, z * 1.25)); }}
          title="Zoom In"
          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >+</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(0.5, z * 0.8)); }}
          title="Zoom Out"
          style={{ width: "28px", height: "28px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >−</button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset to Full Pan-India view"
          style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--line)", background: "var(--panel)", color: "var(--brand)", fontWeight: 600, fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
        >🧭 Pan-India</button>
        {selectedZone && (
          <button
            type="button"
            onClick={handleFocus}
            title="Focus camera on active zone / evacuation corridor"
            style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid rgba(33, 132, 95, 0.4)", background: "#eef8f3", color: "var(--safe)", fontWeight: 600, fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
          >🎯 Focus Route</button>
        )}
      </div>

      <div style={{ position: "absolute", bottom: "10px", left: "14px", zIndex: 5, fontSize: "10px", color: "var(--ink-soft)", opacity: 0.85, pointerEvents: "none" }}>
        🖐️ Click & drag to roam freely across India · Scroll wheel to zoom
      </div>

      <svg viewBox="0 0 100 76" className="map-svg" preserveAspectRatio="none">
        <rect
          x="0"
          y="0"
          width="100"
          height="76"
          fill={
            gridStyle === "hydrology"
              ? "#e8f4f8"
              : gridStyle === "hazard"
              ? "#fdf2f0"
              : gridStyle === "corridors"
              ? "#f2fbf6"
              : "var(--map-bg)"
          }
        />

        <g transform={`translate(50, 38) scale(${zoom}) translate(${-viewCenter.x}, ${-viewCenter.y})`}>
          {gridStyle === "contours" && (
            <>
              {[8, 16, 24, 32, 40, 48, 56, 64, 72].map((yy, i) => (
                <g key={`contour-${i}`}>
                  <path d={`M0,${yy} Q25,${yy - 6} 50,${yy} T100,${yy}`} stroke="#9cb5c5" strokeWidth="0.3" fill="none" opacity="0.8" />
                  <text x="96" y={yy - 1} fontSize="1.1" fill="#7892a2" textAnchor="end">{(i + 1) * 350}m</text>
                </g>
              ))}
              <path d="M4,15 Q24,6 44,18 T74,14 T96,20" stroke="#688a9e" strokeWidth="0.8" fill="none" opacity="0.85" />
              <path d="M6,60 Q26,50 48,58 T78,54 T96,62" stroke="#688a9e" strokeWidth="0.8" fill="none" opacity="0.85" />
            </>
          )}

          {gridStyle === "hydrology" && (
            <>
              <path d="M0,18 Q28,10 48,22 T82,16 T100,26" stroke="#0284c7" strokeWidth="1.6" fill="none" opacity="0.85" />
              <path d="M8,64 Q32,50 54,60 T78,56 T100,66" stroke="#0284c7" strokeWidth="1.4" fill="none" opacity="0.75" />
              <path d="M48,22 Q52,38 42,50 T32,60" stroke="#38bdf8" strokeWidth="0.75" fill="none" strokeDasharray="1 0.5" opacity="0.8" />
              <path d="M72,28 Q66,42 78,56" stroke="#38bdf8" strokeWidth="0.65" fill="none" strokeDasharray="1 0.5" opacity="0.8" />
              <ellipse cx="48" cy="22" rx="14" ry="7" fill="#38bdf8" opacity="0.16" />
              <ellipse cx="54" cy="60" rx="16" ry="8" fill="#38bdf8" opacity="0.14" />
            </>
          )}

          {gridStyle === "hazard" && (
            <>
              <path d="M2,12 Q32,24 62,18 T98,32" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="2 1.5" fill="none" opacity="0.7" />
              <path d="M12,68 Q44,52 68,64 T96,54" stroke="#f97316" strokeWidth="1.0" strokeDasharray="2 1.5" fill="none" opacity="0.65" />
              <circle cx="35" cy="22" r="10" fill="#ef4444" opacity="0.12" stroke="#ef4444" strokeWidth="0.4" strokeDasharray="1 1" />
              <circle cx="70" cy="58" r="12" fill="#ef4444" opacity="0.12" stroke="#ef4444" strokeWidth="0.4" strokeDasharray="1 1" />
            </>
          )}

          {gridStyle === "corridors" && (
            <>
              <path d="M0,38 L100,38" stroke="#10b981" strokeWidth="0.9" strokeDasharray="3 1.5" opacity="0.5" />
              <path d="M50,0 L50,76" stroke="#10b981" strokeWidth="0.9" strokeDasharray="3 1.5" opacity="0.5" />
              <path d="M10,15 L88,62" stroke="#059669" strokeWidth="0.75" strokeDasharray="2 1" opacity="0.45" />
            </>
          )}

          {gridStyle !== "contours" && [15, 30, 45, 60].map((yy, i) => (
            <path key={`std-${i}`} d={`M0,${yy} Q25,${yy - 4} 50,${yy} T100,${yy}`} stroke="var(--contour)" strokeWidth="0.2" fill="none" opacity="0.4" />
          ))}

          {relocationTarget && (() => {
            const { source: src, target: tgt, path } = relocationTarget;
            if (!src || !tgt) return null;
            let pathD = "";
            if (path && path.length > 2) {
              pathD = path.map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
            } else {
              const mx = (src.x + tgt.x) / 2;
              const my = (src.y + tgt.y) / 2;
              const dx = tgt.x - src.x;
              const dy = tgt.y - src.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const cx = mx + (dy / len) * len * 0.25;
              const cy = my - (dx / len) * len * 0.25;
              pathD = `M${src.x},${src.y} Q${cx},${cy} ${tgt.x},${tgt.y}`;
            }

            return (
              <g>
                <defs>
                  <marker id="mc-reloc-head" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                    <path d="M0,0 L6,2 L0,4 Z" fill="var(--safe)" />
                  </marker>
                </defs>
                <path d={pathD} fill="none" stroke="var(--safe)" strokeWidth="0.8" opacity="0.25" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--safe)"
                  strokeWidth="0.55"
                  strokeDasharray="2 1"
                  markerEnd="url(#mc-reloc-head)"
                />
                {path && path.length > 2 && path.slice(1, -1).map((wp, idx) => (
                  <circle key={`wp-${wp.id}-${idx}`} cx={wp.x} cy={wp.y} r="1.3" fill="#38bdf8" stroke="#fff" strokeWidth="0.3" />
                ))}
                <circle cx={tgt.x} cy={tgt.y} r="3.2" fill="none" stroke="var(--safe)" strokeWidth="0.35" />
                <rect x={tgt.x - 4} y={tgt.y - 5.5} width="8" height="2.5" rx="0.8" fill="var(--safe)" />
                <text x={tgt.x} y={tgt.y - 3.8} textAnchor="middle" fill="#fff" fontSize="1.5" fontWeight="700">SAFE</text>
              </g>
            );
          })()}

          {/* 1. Hazard Footprint Ellipse ONLY for active zone or hovered zone */}
          {visibleLayers.hazard && (selectedZone || hoveredZone) && (() => {
            const targetZ = hoveredZone || selectedZone;
            const r = Math.max(1.2, Math.min(2.4, 0.9 + Math.sqrt(targetZ.population) / 100));
            const color = PHASE_COLOR[targetZ.phase] || "#c84b4b";
            return (
              <ellipse
                cx={targetZ.x}
                cy={targetZ.y}
                rx={r + 4.8}
                ry={r + 3.2}
                fill={color}
                opacity="0.18"
                stroke={color}
                strokeWidth="0.35"
                strokeDasharray="1.2 0.8"
              />
            );
          })()}

          {/* 2. Relocation Site connection & site node ONLY for the active zone */}
          {visibleLayers.sites && selectedZone && (() => {
            const z = selectedZone;
            const siteX = Math.min(96, Math.max(4, z.x + (z.icon === "flood" ? 6 : 5)));
            const siteY = Math.max(5, Math.min(72, z.y - (z.icon === "flood" ? 7 : 5)));
            const isShortfall = z.site?.status === "shortfall";
            const siteColor = isShortfall ? "var(--immediate)" : "var(--safe)";
            return (
              <g key={`site-${z.id}`}>
                <path
                  d={`M${z.x},${z.y} L${siteX},${siteY}`}
                  stroke={siteColor}
                  strokeWidth="0.4"
                  strokeDasharray="1.2 0.8"
                  opacity="0.75"
                />
                <g transform={`translate(${siteX}, ${siteY})`}>
                  <rect
                    x="-1.6"
                    y="-1.6"
                    width="3.2"
                    height="3.2"
                    rx="0.6"
                    fill={siteColor}
                    stroke="#ffffff"
                    strokeWidth="0.4"
                  />
                  <rect
                    x="2.4"
                    y="-2.2"
                    width="14"
                    height="3.6"
                    rx="0.8"
                    fill="rgba(20, 59, 93, 0.92)"
                  />
                  <text
                    x="9.4"
                    y="0.2"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="1.8"
                    fontWeight="700"
                  >
                    {isShortfall ? "CAP SHORT" : "SAFE SITE"}
                  </text>
                </g>
              </g>
            );
          })()}

          {/* 3. Render all zone nodes as clean, crisp circular markers */}
          {zones.map((z) => {
            const active = z.id === selectedId;
            const hovered = z.id === hoveredId;
            const baseR = Math.max(0.9, Math.min(2.0, 0.8 + Math.sqrt(z.population) / 110));
            const r = active ? baseR + 0.6 : hovered ? baseR + 0.4 : baseR;
            const color = PHASE_COLOR[z.phase] || "#c84b4b";

            return (
              <g
                key={z.id}
                className="zone-node"
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(z.id);
                  setViewCenter({ x: z.x, y: z.y });
                  setZoom((cur) => Math.max(cur, 2.2));
                }}
                onMouseEnter={() => setHoveredId(z.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Active pulsating highlight ring */}
                {active && (
                  <circle
                    cx={z.x}
                    cy={z.y}
                    r={r + 2.0}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.4"
                    opacity="0.8"
                    strokeDasharray="1.4 0.9"
                  />
                )}

                {/* Main clean circular node */}
                {visibleLayers.population && (
                  <circle
                    cx={z.x}
                    cy={z.y}
                    r={r}
                    fill={color}
                    opacity={active || hovered ? 1 : 0.78}
                    stroke="#ffffff"
                    strokeWidth={active ? 0.6 : 0.25}
                  />
                )}
              </g>
            );
          })}

          {/* 4. Prominent high-contrast Badge ONLY for active or hovered zone */}
          {(hoveredZone || selectedZone) && (() => {
            const z = hoveredZone || selectedZone;
            const baseR = Math.max(0.9, Math.min(2.0, 0.8 + Math.sqrt(z.population) / 110));
            const r = baseR + 0.6;
            return (
              <g transform={`translate(${z.x}, ${z.y - (r + 2.4)})`} style={{ pointerEvents: "none" }}>
                <rect
                  x="-13"
                  y="-4.2"
                  width="26"
                  height="4.8"
                  rx="1.4"
                  fill="rgba(18, 43, 64, 0.94)"
                  stroke="#ffffff"
                  strokeWidth="0.3"
                />
                <text
                  x="0"
                  y="-1.0"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="2.1"
                  fontWeight="700"
                  fontFamily="'Space Grotesk', system-ui, sans-serif"
                >
                  {z.id} · {z.priorityScore}
                </text>
              </g>
            );
          })()}
        </g>
      </svg>

      {/* Floating Hover Inspector Card */}
      {hoveredZone && (
        <div style={{
          position: "absolute",
          bottom: "12px",
          left: "14px",
          zIndex: 20,
          background: "rgba(255, 255, 255, 0.97)",
          backdropFilter: "blur(6px)",
          border: "1px solid var(--line)",
          borderLeft: `4px solid ${PHASE_COLOR[hoveredZone.phase] || 'var(--brand)'}`,
          borderRadius: "8px",
          padding: "8px 12px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          pointerEvents: "none",
          minWidth: "200px"
        }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "flex", justifyContent: "space-between", gap: "8px" }}>
            <span>{hoveredZone.name}</span>
            <span style={{ color: PHASE_COLOR[hoveredZone.phase], fontSize: "11px" }}>{hoveredZone.id}</span>
          </div>
          <div style={{ fontSize: "10.5px", color: "var(--ink-soft)", marginTop: "2px" }}>
            {hoveredZone.district} · {hoveredZone.hazard}
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "5px", fontSize: "10.5px", fontWeight: 600 }}>
            <span>Score: <strong style={{ color: "var(--brand)" }}>{hoveredZone.priorityScore}</strong></span>
            <span>Phase: <strong style={{ color: PHASE_COLOR[hoveredZone.phase] }}>{hoveredZone.phase}</strong></span>
            <span>Pop: {hoveredZone.population.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}
      <div className="map-legend">
        <div className="legend-row"><span className="legend-symbol hazard-symbol" /><span>Hazard zone</span></div>
        <div className="legend-row"><span className="legend-symbol site-symbol" /><span>Relocation site</span></div>
        {PHASES.map((p) => (
          <div key={p} className="legend-row"><span className="dot" style={{ background: PHASE_COLOR[p] }} /><span>{p}</span></div>
        ))}
        {relocationTarget && (
          <div className="legend-row">
            <span className="dot" style={{ background: "var(--safe)", boxShadow: "0 0 4px var(--safe)" }} />
            <span style={{ fontWeight: 600 }}>Relocation route</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  2D GIS MAP (Leaflet with 6 Real-World Basemaps)                       */
/* ---------------------------------------------------------------------- */

const TILE_LAYERS = [
  {
    id: "satellite",
    label: "Satellite Orthomosaic",
    emoji: "🛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  {
    id: "terrain",
    label: "Topographic Relief",
    emoji: "⛰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, USGS, NOAA",
    maxZoom: 19,
  },
  {
    id: "standard",
    label: "Standard Streets",
    emoji: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
  {
    id: "dark",
    label: "Tactical Dark (NDRF Ops)",
    emoji: "🌑",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO, OpenStreetMap",
    maxZoom: 19,
  },
  {
    id: "light",
    label: "Cadastral Light",
    emoji: "🌐",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO, OpenStreetMap",
    maxZoom: 19,
  },
  {
    id: "relief",
    label: "Shaded Mountain Relief",
    emoji: "🏔️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri, USGS",
    maxZoom: 19,
  },
];

const HAZARD_LAYERS = [
  { id: "flood", label: "Flood", color: "#288fc0" },
  { id: "landslide", label: "Landslide", color: "#d45143" },
  { id: "earthquake", label: "Earthquake", color: "#9b62b2" },
  { id: "rainfall", label: "Extreme rainfall", color: "#c78922" },
];

function getHazardRisks(zone) {
  const isFlood = zone.icon === "flood";
  const isSlide = zone.icon === "slide";
  return {
    flood: Math.min(100, Math.round(zone.hazardIntensity * (isFlood ? 1 : 0.48))),
    landslide: Math.min(100, Math.round(zone.hazardIntensity * (isSlide ? 1 : 0.42))),
    earthquake: Math.min(100, Math.round(28 + zone.exposure * 0.34 + (zone.incidentHistory ? 8 : 0))),
    rainfall: Math.min(100, Math.round(zone.hazardIntensity * (isFlood || isSlide ? 0.78 : 0.65))),
  };
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Invalidate immediately and after motion transitions to ensure crisp tiles on all viewports
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 400);

    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    if (!window.ResizeObserver) {
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("orientationchange", handleResize);
      };
    }

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(map.getContainer());

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

function MapCenterController({ selectedZone, selectTrigger }) {
  const map = useMap();
  const lastCenteredIdRef = useRef(null);
  const lastTriggerRef = useRef(selectTrigger);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!selectedZone) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastCenteredIdRef.current = selectedZone.id;
      lastTriggerRef.current = selectTrigger;
      return;
    }

    const isDifferentZone = selectedZone.id !== lastCenteredIdRef.current;
    const isTriggeredAgain = selectTrigger !== undefined && selectTrigger !== lastTriggerRef.current;
    if (!isDifferentZone && !isTriggeredAgain) return;

    lastCenteredIdRef.current = selectedZone.id;
    lastTriggerRef.current = selectTrigger;

    const lat = selectedZone.lat || (DISTRICT_COORDS[selectedZone.district] ? DISTRICT_COORDS[selectedZone.district][0] : null);
    const lng = selectedZone.lng || (DISTRICT_COORDS[selectedZone.district] ? DISTRICT_COORDS[selectedZone.district][1] : null);
    if (!lat || !lng) return;

    // Zoom in on the zone! Local hazard/ward inspection zoom (zoom 13-14) or deeper if already zoomed
    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 13);
    map.flyTo([lat, lng], targetZoom, {
      animate: true,
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedZone, selectTrigger, map]);

  return null;
}

function MapInstanceSetter({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

function RiskMap({ zones, selectedId, onSelect, selectedLayers = { flood: true, landslide: true, earthquake: true, rainfall: true }, fusionEnabled = true, onToggleLayer, onToggleFusion, relocationTarget, externalTile, onTileChange, selectTrigger }) {
  const selectedZone = zones.find((zone) => zone.id === selectedId);
  const [internalTile, setInternalTile] = useState("satellite");
  const activeTile = externalTile || internalTile;
  const setActiveTile = onTileChange || setInternalTile;
  const [mapInstance, setMapInstance] = useState(null);
  const tile = TILE_LAYERS.find((t) => t.id === activeTile) || TILE_LAYERS[0];

  return (
    <div className="risk-map-wrap" style={{ position: "relative", minHeight: "420px", height: "100%" }}>
      <MapContainer
        center={[23.8, 79.1]}
        zoom={5}
        minZoom={4}
        maxZoom={18}
        zoomControl={false}
        scrollWheelZoom={true}
        dragging={true}
        doubleClickZoom={true}
        className="risk-map"
        style={{ width: "100%", height: "100%", minHeight: "420px" }}
      >
        <MapResizer />
        <MapInstanceSetter onMap={setMapInstance} />
        <MapCenterController selectedZone={selectedZone} selectTrigger={selectTrigger} />
        <TileLayer key={tile.id} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
        <ZoomControl position="topleft" />


        {/* Dijkstra Evacuation Polyline */}
        {relocationTarget && relocationTarget.path && relocationTarget.path.length > 1 && (
          <Polyline
            positions={relocationTarget.path.map((p) => [
              p.lat || (DISTRICT_COORDS[p.district] ? DISTRICT_COORDS[p.district][0] : 23.8),
              p.lng || (DISTRICT_COORDS[p.district] ? DISTRICT_COORDS[p.district][1] : 79.1),
            ])}
            color="var(--safe)"
            weight={3.5}
            dashArray="6, 6"
            opacity={0.88}
          />
        )}

        {/* Zone Circle Markers */}
        {zones.map((z) => {
          const lat = z.lat || (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][0] : null);
          const lng = z.lng || (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][1] : null);
          if (!lat || !lng) return null;
          const isSelected = z.id === selectedId;
          const color = PHASE_COLOR[z.phase] || "#c84b4b";

          return (
            <CircleMarker
              key={z.id}
              center={[lat, lng]}
              radius={isSelected ? 10 : z.phase === "Immediate" ? 7.5 : 6}
              fillColor={color}
              fillOpacity={isSelected ? 0.95 : 0.75}
              color={isSelected ? "#fff" : color}
              weight={isSelected ? 3 : 1.5}
              eventHandlers={{
                click: () => {
                  onSelect(z.id);
                  if (mapInstance) {
                    const targetZoom = Math.max(mapInstance.getZoom(), 13);
                    mapInstance.flyTo([lat, lng], targetZoom, {
                      animate: true,
                      duration: 1.2,
                      easeLinearity: 0.25,
                    });
                  }
                }
              }}
            >
              <LeafletTooltip direction="top" offset={[0, -6]} opacity={0.92}>
                <div style={{ fontSize: "11px", fontWeight: 700 }}>{z.id} · {z.name}</div>
                <div style={{ fontSize: "10px", color: color }}>Phase: {z.phase} (Score: {z.priorityScore})</div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="map-legend">
        {PHASES.map((p) => (
          <div key={p} className="legend-row">
            <span className="dot" style={{ background: PHASE_COLOR[p] }} />
            <span>{p}</span>
          </div>
        ))}
        {relocationTarget && (
          <div className="legend-row">
            <span className="dot" style={{ background: "var(--safe)", boxShadow: "0 0 4px var(--safe)" }} />
            <span style={{ fontWeight: 600 }}>Dijkstra Route</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ZONE LIST (SIDEBAR)                                                    */
/* ---------------------------------------------------------------------- */

function ZoneList({ zones, selectedId, onSelect }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) =>
      z.name.toLowerCase().includes(q) ||
      z.district.toLowerCase().includes(q) ||
      z.id.toLowerCase().includes(q) ||
      z.hazard.toLowerCase().includes(q)
    );
  }, [zones, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.priorityScore - a.priorityScore), [filtered]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, zones]);

  const displayed = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  return (
    <div className="zone-list">
      <div className="zone-list-head">
        <span>Ranked red zones</span>
        <span className="muted">{filtered.length} sites</span>
      </div>
      <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", background: "var(--panel-2)" }}>
        <input
          type="text"
          placeholder="Filter zones, districts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", padding: "5px 8px", fontSize: "11px", border: "1px solid var(--line)", borderRadius: "4px", background: "var(--panel)" }}
        />
      </div>
      <div className="zone-list-body">
        {displayed.map((z, i) => {
          const globalIndex = (page - 1) * pageSize + i;
          return (
            <button key={z.id} className={`zone-row ${z.id === selectedId ? "is-active" : ""}`} onClick={() => onSelect(z.id)}>
              <span className="zone-rank">{String(globalIndex + 1).padStart(2, "0")}</span>
              <span className="zone-icon" style={{ color: PHASE_COLOR[z.phase] }}><HazardIcon icon={z.icon} /></span>
              <span className="zone-row-main">
                <span className="zone-row-name">{z.name}</span>
                <span className="zone-row-sub">{z.district}</span>
              </span>
              <span className="zone-score" style={{ color: PHASE_COLOR[z.phase] }}>{z.priorityScore}</span>
            </button>
          );
        })}
        {displayed.length === 0 && (
          <div style={{ padding: "16px 12px", fontSize: "11.5px", color: "var(--ink-soft)", textAlign: "center" }}>
            No zones match your search.
          </div>
        )}
      </div>

      {/* 20-item Pagination Controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        borderTop: "1px solid var(--line)",
        background: "var(--panel)",
        fontSize: "11px"
      }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: "5px",
            background: page === 1 ? "var(--panel-2)" : "var(--panel)",
            color: page === 1 ? "var(--ink-soft)" : "var(--brand)",
            cursor: page === 1 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "11px"
          }}
        >
          ← Prev
        </button>

        <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
          Page <strong style={{ color: "var(--brand)" }}>{page}</strong> of {totalPages}
        </span>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: "5px",
            background: page >= totalPages ? "var(--panel-2)" : "var(--panel)",
            color: page >= totalPages ? "var(--ink-soft)" : "var(--brand)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "11px"
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  DETAIL PANEL                                                           */
/* ---------------------------------------------------------------------- */

function DetailPanel({ zone, role, onCertificate, onAlert, onSubscribe, subscribed, relocationTarget, onShowRelocationPlan }) {
  const [responseStatus, setResponseStatus] = useState("Detected");
  const responseSteps = ["Detected", "Approved", "Alerted", "Evacuating", "Relocated"];

  useEffect(() => {
    setResponseStatus("Detected");
  }, [zone?.id]);

  if (!zone) {
    return (
      <div className="detail-panel detail-empty">
        <Layers size={22} />
        <p>Select a zone on the map or list to inspect its hazard fusion score and relocation status.</p>
      </div>
    );
  }
  return (
    <div className="detail-panel">
      <div className="detail-top">
        <div>
          <div className="detail-code">{zone.id}</div>
          <h3>{zone.name}</h3>
          <div className="muted small"><MapPin size={12} /> {zone.district}</div>
        </div>
        <PhaseBadge phase={zone.phase} />
      </div>

      <div className="score-block">
        <div className="score-block-head">
          <span>Priority score</span>
          <span className="score-big" style={{ color: PHASE_COLOR[zone.phase] }}>{zone.priorityScore}</span>
        </div>
        <AnimatedBar value={zone.priorityScore} color={PHASE_COLOR[zone.phase]} height={7} trackKey={zone.id} />
        <div className="formula">Hazard × Exposure × Vulnerability</div>
      </div>

      <div className="mini-metrics">
        <div>
          <div className="mini-label">
            <span>Hazard intensity</span>
            <span className="mini-score"><strong>{zone.hazardIntensity}</strong><span className="mini-scale"> / 100</span></span>
          </div>
          <AnimatedBar value={zone.hazardIntensity} color="var(--brand-2)" trackKey={zone.id + "h"} />
        </div>
        <div>
          <div className="mini-label">
            <span>Exposure</span>
            <span className="mini-score"><strong>{zone.exposure}</strong><span className="mini-scale"> / 100</span></span>
          </div>
          <AnimatedBar value={zone.exposure} color="var(--brand-2)" trackKey={zone.id + "e"} />
        </div>
        <div>
          <div className="mini-label">
            <span>Vulnerability</span>
            <span className="mini-score"><strong>{zone.vulnerability}</strong><span className="mini-scale"> / 100</span></span>
          </div>
          <AnimatedBar value={zone.vulnerability} color="var(--brand-2)" trackKey={zone.id + "v"} />
        </div>
      </div>

      <div className="explain-box">
        <div className="explain-head"><ShieldCheck size={14} /> Explainable ranking</div>
        <p>{zone.explanation}</p>
      </div>

      <div className="stat-grid">
        <div><span className="stat-num">{fmt(zone.population)}</span><span className="stat-lab">Population</span></div>
        <div><span className="stat-num">{zone.elderly}%</span><span className="stat-lab">Elderly</span></div>
        <div><span className="stat-num">{zone.disabled}%</span><span className="stat-lab">Living w/ disability</span></div>
        <div><span className="stat-num">{zone.lowIncome}%</span><span className="stat-lab">Low-income HH</span></div>
      </div>

      {/* ── "You Are Safe" Banner for Green (Medium-Term) Zones ─────────── */}
      {zone.phase === "Medium-Term" && (
        <div className="safe-zone-banner" style={{
          background: "linear-gradient(135deg, rgba(33,132,95,0.12) 0%, rgba(33,132,95,0.04) 100%)",
          border: "1.5px solid rgba(33,132,95,0.35)",
          borderRadius: "12px",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "12px",
          animation: "slideUp .4s ease",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(33,132,95,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <ShieldCheck size={24} style={{ color: "var(--safe)" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "var(--safe)", marginBottom: 2 }}>
              ✅ You Are Safe
            </div>
            <div style={{ fontSize: "12px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
              This zone is classified as a <strong style={{ color: "var(--safe)" }}>Green Safe Zone</strong>. 
              No evacuation routing is required. This area can serve as a receiving destination for evacuees from nearby hazard zones.
            </div>
          </div>
        </div>
      )}

      <div className="site-card">
        <div className="site-card-head">
          <Building2 size={14} />
          <span>Relocation site match</span>
        </div>
        {zone.site.status === "matched" && (
          <p><CheckCircle2 size={13} className="ok-icon" /> {zone.site.name} — <strong>{zone.site.utilization}%</strong> of intake capacity allocated.</p>
        )}
        {zone.site.status === "shortfall" && (
          <p><AlertTriangle size={13} className="warn-icon" /> {zone.site.name} would exceed capacity at <strong>{zone.site.utilization}%</strong> — flagged to avoid a relocation-slum outcome. Additional site required.</p>
        )}
        {zone.site.status === "pending" && (
          <p className="muted">No site matching run yet for this medium-term zone.</p>
        )}
        <div className="site-meta">Last surveyed {zone.lastSurveyed} · {zone.hazard}</div>
      </div>

      <div className="response-card">
        <div className="site-card-head"><Siren size={14} /> Response workflow</div>
        <div className="response-steps">
          {responseSteps.map((step, index) => {
            const active = responseSteps.indexOf(responseStatus) >= index;
            return (
              <button
                key={step}
                className={active ? "response-step is-active" : "response-step"}
                onClick={() => setResponseStatus(step)}
                type="button"
              >
                <span className="response-dot">{active ? <CheckCircle2 size={11} /> : index + 1}</span>
                <span>{step}</span>
              </button>
            );
          })}
        </div>
        <div className="response-status">Current status: <strong>{responseStatus}</strong></div>
      </div>

      {role === "authority" ? (
        <div className="action-row">
          <button className="btn-primary" onClick={() => onCertificate(zone)}><FileText size={14} /> Generate legal certificate</button>
          <button className="btn-ghost" onClick={() => onAlert(zone)}><Radio size={14} /> Send community alert</button>
        </div>
      ) : (
        <div className="action-row">
          <button className={`btn-primary ${subscribed ? "is-on" : ""}`} onClick={() => onSubscribe(zone.id)}>
            <Bell size={14} /> {subscribed ? "Subscribed to alerts" : "Subscribe to alerts"}
          </button>
        </div>
      )}

      {/* Relocation Route Card — visible when arrow is active for this zone */}
      {relocationTarget && relocationTarget.source.id === zone.id && (
        <div className="reloc-inline-card">
          <div className="reloc-inline-header">
            <Route size={14} />
            <span>Dijkstra Shortest Path Route Active</span>
          </div>
          <div className="reloc-inline-route">
            <div className="reloc-inline-from">
              <span className="reloc-inline-dot" style={{ background: relocationTarget.source.phase === "Immediate" ? "var(--immediate)" : "var(--watch)" }} />
              <span>{relocationTarget.source.name}</span>
            </div>
            <ArrowRight size={14} style={{ color: "var(--brand-2)", flexShrink: 0 }} />
            <div className="reloc-inline-to">
              <span className="reloc-inline-dot" style={{ background: "var(--safe)" }} />
              <span>{relocationTarget.target.name}</span>
            </div>
          </div>
          <div className="reloc-inline-meta">
            <span>{relocationTarget.distKm > 0 ? `${relocationTarget.distKm} km` : "Nearby"}</span>
            <span>·</span>
            <span>{relocationTarget.hops > 1 ? `${relocationTarget.hops} hops (Dijkstra)` : "Direct route"}</span>
            <span>·</span>
            <span>{relocationTarget.target.district}</span>
          </div>
          <button className="btn-primary reloc-inline-btn" onClick={() => onShowRelocationPlan && onShowRelocationPlan()}>
            <Building2 size={13} /> View full relocation plan
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  RELOCATION PANEL                                                       */
/* ---------------------------------------------------------------------- */

function RelocationPanel({ relocationTarget, onClose, role, onApprove }) {
  if (!relocationTarget) return null;

  const { source, target, distKm } = relocationTarget;
  const facilities = useMemo(() => generateFacilities(target), [target.id]);
  const siteUtil = target.site?.utilization || 60;
  const afterReloc = Math.min(100, siteUtil + Math.round((source.population / (facilities.totalCapacity || 20000)) * 100));
  const remainingCapacity = Math.max(0, facilities.totalCapacity - Math.round(facilities.totalCapacity * siteUtil / 100));
  const eta = distKm > 0 ? Math.max(10, Math.round(distKm * 2.5)) : Math.floor(Math.random() * 40 + 15);

  return (
    <div className="reloc-panel-overlay" onClick={onClose}>
      <div className="reloc-panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>

        {/* Header */}
        <div className="reloc-header">
          <Route size={18} className="reloc-header-icon" />
          <div>
            <div className="reloc-kicker">Dijkstra Shortest Path Routing</div>
            <h3 className="reloc-title">Safe Green Zone Navigation</h3>
          </div>
        </div>

        {/* Route Summary */}
        <div className="reloc-route">
          <div className="reloc-route-from">
            <div className="reloc-route-dot" style={{ background: source.phase === "Immediate" ? "var(--immediate)" : "var(--watch)" }} />
            <div>
              <div className="reloc-route-label">FROM — Danger Zone ({source.phase})</div>
              <div className="reloc-route-name">{source.name}</div>
              <div className="reloc-route-sub">{source.district} · {source.hazard}</div>
              <div className="reloc-route-pop"><strong>{fmt(source.population)}</strong> people to relocate</div>
            </div>
          </div>
          <div className="reloc-route-arrow">
            <ArrowRight size={18} />
            <span>{distKm > 0 ? `${distKm} km` : "~Nearby"} · {relocationTarget.hops > 1 ? `${relocationTarget.hops} hops (Dijkstra)` : "Direct route"} · ~{eta} min</span>
          </div>
          <div className="reloc-route-to">
            <div className="reloc-route-dot" style={{ background: "var(--safe)" }} />
            <div>
              <div className="reloc-route-label">TO — Safe Zone (Green)</div>
              <div className="reloc-route-name">{target.name}</div>
              <div className="reloc-route-sub">{target.district}</div>
              <PhaseBadge phase={target.phase} />
            </div>
          </div>
        </div>

        {/* Waypoints if multi-hop */}
        {relocationTarget.path && relocationTarget.path.length > 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", padding: "8px 12px", background: "rgba(33, 132, 95, 0.08)", borderRadius: "6px", border: "1px solid rgba(33, 132, 95, 0.22)", margin: "0 0 16px 0" }}>
            <Route size={13} style={{ color: "var(--safe)", flexShrink: 0 }} />
            <span style={{ color: "var(--text-muted)" }}>Dijkstra Waypoints:</span>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>
              {relocationTarget.path.map((p) => p.name).join(" ➔ ")}
            </span>
          </div>
        )}

        {/* Carrying Capacity */}
        <div className="reloc-capacity">
          <div className="reloc-section-head"><Shield size={14} /> Carrying Capacity Analysis</div>
          <div className="reloc-cap-stats">
            <div>
              <span className="reloc-cap-num">{fmt(facilities.totalCapacity)}</span>
              <span className="reloc-cap-lab">Total capacity</span>
            </div>
            <div>
              <span className="reloc-cap-num">{fmt(remainingCapacity)}</span>
              <span className="reloc-cap-lab">Available slots</span>
            </div>
            <div>
              <span className="reloc-cap-num">{facilities.bedsAvailable}</span>
              <span className="reloc-cap-lab">Hospital beds</span>
            </div>
          </div>
          <div className="reloc-cap-bar-wrap">
            <div className="reloc-cap-bar-row">
              <span>Current: {siteUtil}%</span>
              <span>After relocation: {afterReloc}%</span>
            </div>
            <div className="reloc-cap-bar-track">
              <div className="reloc-cap-bar-fill reloc-cap-current" style={{ width: `${siteUtil}%` }} />
              <div className="reloc-cap-bar-fill reloc-cap-projected" style={{ width: `${afterReloc}%` }} />
            </div>
            {afterReloc > 90 && (
              <div className="reloc-cap-warn"><AlertTriangle size={12} /> Near capacity — consider overflow site</div>
            )}
          </div>
        </div>

        {/* Facilities Grid */}
        <div className="reloc-facilities">
          <div className="reloc-section-head"><Building2 size={14} /> Nearby Facilities</div>
          <div className="reloc-fac-grid">
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#e74c3c", background: "#fde8e8" }}><Hospital size={18} /></div>
              <div className="reloc-fac-count">{facilities.hospitals.length}</div>
              <div className="reloc-fac-type">Hospitals</div>
              <div className="reloc-fac-names">
                {facilities.hospitals.map((h, i) => <span key={i}>{h}</span>)}
              </div>
            </div>
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#3498db", background: "#e8f4fd" }}><School size={18} /></div>
              <div className="reloc-fac-count">{facilities.shelters.length}</div>
              <div className="reloc-fac-type">Shelters / Schools</div>
              <div className="reloc-fac-names">
                {facilities.shelters.map((s, i) => <span key={i}>{s}</span>)}
              </div>
            </div>
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#e67e22", background: "#fef3e2" }}><Flame size={18} /></div>
              <div className="reloc-fac-count">{facilities.fireStations.length}</div>
              <div className="reloc-fac-type">Fire Stations</div>
              <div className="reloc-fac-names">
                {facilities.fireStations.map((f, i) => <span key={i}>{f}</span>)}
              </div>
            </div>
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#2980b9", background: "#e1f0fa" }}><Droplets size={18} /></div>
              <div className="reloc-fac-count">{facilities.waterPoints}</div>
              <div className="reloc-fac-type">Water Supply Points</div>
            </div>
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#27ae60", background: "#e8f8ef" }}><Route size={18} /></div>
              <div className="reloc-fac-count">{"★".repeat(facilities.roadRating)}{"☆".repeat(5 - facilities.roadRating)}</div>
              <div className="reloc-fac-type">Road Connectivity</div>
            </div>
            <div className="reloc-fac-card">
              <div className="reloc-fac-icon" style={{ color: "#c0392b", background: "#fde8e8" }}><Heart size={18} /></div>
              <div className="reloc-fac-count">{facilities.bedsAvailable}</div>
              <div className="reloc-fac-type">Medical Beds</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {role === "authority" && (
          <div className="reloc-actions">
            <button className="btn-primary reloc-btn-approve" onClick={() => onApprove && onApprove(relocationTarget)}>
              <CheckCircle2 size={14} /> Approve Relocation Plan
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X size={14} /> Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CERTIFICATE MODAL                                                      */
/* ---------------------------------------------------------------------- */

function CertificateModal({ zone, onClose }) {
  if (!zone) return null;
  const hash = `BR-${zone.id}-${(zone.priorityScore * 7919).toString(16).toUpperCase()}`;

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `BhoomiRakshak_Certificate_${zone.id}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="certificate" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <div className="cert-head">
          <ClipboardList size={18} />
          <div>
            <div className="cert-eyebrow">Red Zone Legal Certificate — draft</div>
            <div className="cert-title">Bhoomi Rakshak 2.0 Prioritization Audit</div>
          </div>
        </div>
        <table className="cert-table">
          <tbody>
            <tr><td>Certificate ID</td><td>{hash}</td></tr>
            <tr><td>Zone</td><td>{zone.name} ({zone.id})</td></tr>
            <tr><td>District</td><td>{zone.district}</td></tr>
            <tr><td>Hazard basis</td><td>{zone.hazard}</td></tr>
            <tr><td>Hazard intensity</td><td>{zone.hazardIntensity} / 100</td></tr>
            <tr><td>Exposure</td><td>{zone.exposure} / 100</td></tr>
            <tr><td>Vulnerability index</td><td>{zone.vulnerability} / 100</td></tr>
            <tr><td>Priority score</td><td><strong>{zone.priorityScore} / 100</strong></td></tr>
            <tr><td>Phase classification</td><td>{zone.phase}</td></tr>
            <tr><td>Population affected</td><td>{fmt(zone.population)}</td></tr>
            <tr><td>Last field survey</td><td>{zone.lastSurveyed}</td></tr>
          </tbody>
        </table>
        <p className="cert-note">{zone.explanation}</p>
        <div className="cert-foot">
          <span>Issuing authority: District Disaster Management Authority (demo)</span>
          <span>Generated by Bhoomi Rakshak · synthetic prototype data</span>
        </div>
        <button className="btn-primary cert-print" onClick={handlePrint}><Printer size={14} /> Print / save as PDF</button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  PHASING TAB                                                            */
/* ---------------------------------------------------------------------- */

function PhasingTab({ zones, onSelect }) {
  return (
    <div className="kanban">
      {PHASES.map((phase) => {
        const list = zones.filter((z) => z.phase === phase).sort((a, b) => b.priorityScore - a.priorityScore);
        const totalPop = list.reduce((s, z) => s + z.population, 0);
        return (
          <div className="kanban-col" key={phase}>
            <div className="kanban-head" style={{ borderColor: PHASE_COLOR[phase] }}>
              <span>{phase}</span>
              <span className="muted small">{list.length} zones · {fmt(totalPop)} people</span>
            </div>
            {list.map((z) => (
              <button key={z.id} className="kanban-card" onClick={() => onSelect(z.id)}>
                <div className="kanban-card-top">
                  <span className="zone-code-sm">{z.id}</span>
                  <span style={{ color: PHASE_COLOR[phase] }}>{z.priorityScore}</span>
                </div>
                <div className="kanban-card-name">{z.name}</div>
                <AnimatedBar value={z.priorityScore} color={PHASE_COLOR[phase]} height={5} trackKey={z.id} />
                <div className="kanban-card-foot muted small">{fmt(z.population)} people · {z.hazard}</div>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ANALYTICS TAB                                                          */
/* ---------------------------------------------------------------------- */

function AnalyticsTab({ zones }) {
  const barData = [...zones].sort((a, b) => b.priorityScore - a.priorityScore).map((z) => ({
    name: z.id, score: z.priorityScore, phase: z.phase,
  }));
  const pieData = PHASES.map((p) => ({
    name: p, value: zones.filter((z) => z.phase === p).reduce((s, z) => s + z.population, 0),
  }));
  const totalPop = zones.reduce((s, z) => s + z.population, 0);
  const avgScore = Math.round(zones.reduce((s, z) => s + z.priorityScore, 0) / zones.length);
  const shortfall = zones.filter((z) => z.site.status === "shortfall").length;

  return (
    <div className="analytics">
      <div className="stat-cards">
        <div className="stat-card"><span className="stat-card-num">{zones.length}</span><span className="stat-card-lab">Mapped red zones</span></div>
        <div className="stat-card"><span className="stat-card-num">{fmt(totalPop)}</span><span className="stat-card-lab">People at risk</span></div>
        <div className="stat-card"><span className="stat-card-num">{avgScore}</span><span className="stat-card-lab">Average priority score</span></div>
        <div className="stat-card" style={{ borderColor: shortfall ? "var(--immediate)" : "var(--line)" }}>
          <span className="stat-card-num" style={{ color: shortfall ? "var(--immediate)" : "inherit" }}>{shortfall}</span>
          <span className="stat-card-lab">Sites flagged over-capacity</span>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Priority score by zone</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--ink-soft)" }} axisLine={{ stroke: "var(--line)" }} tickLine={false} />
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => <Cell key={i} fill={PHASE_COLOR[d.phase]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">Population at risk by phase</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {pieData.map((d, i) => <Cell key={i} fill={PHASE_COLOR[d.name]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 12, borderRadius: 6 }} formatter={(v) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  REPORTS TAB                                                            */
/* ---------------------------------------------------------------------- */

function ReportsTab({ zones, onCertificate }) {
  return (
    <div className="reports">
      <div className="reports-head">
        <span>Legal certificates & audit trail</span>
        <span className="muted small">Tamper-evident hash generated per zone on issue</span>
      </div>
      <table className="report-table">
        <thead>
          <tr>
            <th>Zone</th><th>District</th><th>Phase</th><th>Score</th><th>Last survey</th><th></th>
          </tr>
        </thead>
        <tbody>
          {[...zones].sort((a, b) => b.priorityScore - a.priorityScore).map((z) => (
            <tr key={z.id}>
              <td><span className="zone-code-sm">{z.id}</span> {z.name}</td>
              <td className="muted">{z.district}</td>
              <td><PhaseBadge phase={z.phase} /></td>
              <td style={{ color: PHASE_COLOR[z.phase], fontWeight: 600 }}>{z.priorityScore}</td>
              <td className="muted">{z.lastSurveyed}</td>
              <td><button className="btn-ghost sm" onClick={() => onCertificate(z)}><FileText size={12} /> Certificate</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  SCENARIO LAB                                                           */
/* ---------------------------------------------------------------------- */

function ScenarioLab({ zones, scenario, setScenario, hazardLift, setHazardLift }) {
  const multiplier = 1 + (hazardLift / 100);
  const projected = zones.map((zone) => ({
    ...zone,
    projectedScore: Math.min(100, Math.round(zone.priorityScore * multiplier)),
  }));
  const actionZones = projected.filter((zone) => zone.projectedScore >= 45).length;
  const exposed = projected.filter((zone) => zone.projectedScore >= 45).reduce((sum, zone) => sum + zone.population, 0);
  const shortfalls = projected.filter((zone) => zone.site.status === "shortfall").length;
  const baselineActionPeople = zones.filter((zone) => zone.priorityScore >= 45).reduce((sum, zone) => sum + zone.population, 0);
  const additionalPeople = Math.max(0, exposed - baselineActionPeople);

  return (
    <section className="scenario-lab">
      <div className="scenario-copy">
        <div className="scenario-kicker"><SlidersHorizontal size={14} /> Scenario Lab</div>
        <h2>Test the next disaster before it arrives.</h2>
        <p className="muted">Stress-test the current plan against a changing hazard signal and see which communities cross the action threshold.</p>
      </div>
      <div className="scenario-controls">
        <label>
          Scenario
          <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
            <option value="baseline">Current forecast</option>
            <option value="monsoon">Extreme monsoon</option>
            <option value="surge">River surge / dam release</option>
          </select>
        </label>
        <label className="range-label">
          Hazard lift <strong>+{hazardLift}%</strong>
          <input type="range" min="0" max="50" step="5" value={hazardLift} onChange={(event) => setHazardLift(Number(event.target.value))} />
        </label>
      </div>
      <div className="scenario-results">
        <div><strong>{actionZones}</strong><span>action zones</span></div>
        <div><strong>{fmt(exposed)}</strong><span>people exposed</span></div>
        <div className={shortfalls ? "scenario-alert" : ""}><strong>{shortfalls}</strong><span>capacity shortfalls</span></div>
        <div><strong>{fmt(additionalPeople)}</strong><span>new people needing protection</span></div>
      </div>
      <div className="scenario-note"><Siren size={14} /> {scenario === "baseline" ? "Baseline plan loaded. Increase the hazard signal to rehearse escalation." : "Scenario active: review the new action zones and secure overflow capacity."}</div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/*  CITIZEN TAB                                                            */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/*  CITIZEN SATELLITE MAP (LEAFLET GIS)                                   */
/* ---------------------------------------------------------------------- */

function CitizenSatelliteMap({ zone, zones, onSelect, relocationTarget }) {
  const [activeTile, setActiveTile] = useState("satellite");
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    if (mapInstance && zone && zone.lat && zone.lng) {
      mapInstance.flyTo([zone.lat, zone.lng], 14, { duration: 1.2 });
    }
  }, [zone, mapInstance]);

  const tile = TILE_LAYERS.find((t) => t.id === activeTile) || TILE_LAYERS[0];
  const centerCoords = zone && zone.lat && zone.lng ? [zone.lat, zone.lng] : [28.668, 77.308];

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          if (mapInstance) {
            mapInstance.flyTo([userLat, userLng], 14, { duration: 1.2 });
          }
          if (zones && zones.length) {
            let closest = zones[0];
            let minDist = Infinity;
            zones.forEach((z) => {
              if (z.lat && z.lng) {
                const d = Math.hypot(z.lat - userLat, z.lng - userLng);
                if (d < minDist) {
                  minDist = d;
                  closest = z;
                }
              }
            });
            if (closest && onSelect) onSelect(closest.id);
          }
        },
        () => {
          if (mapInstance && zone && zone.lat && zone.lng) {
            mapInstance.flyTo([zone.lat, zone.lng], 14, { duration: 1 });
          }
        }
      );
    }
  };

  const handleRecenter = () => {
    if (mapInstance && zone && zone.lat && zone.lng) {
      mapInstance.flyTo([zone.lat, zone.lng], 14, { duration: 1 });
    }
  };

  const handleFocusRoute = () => {
    if (mapInstance && relocationTarget && relocationTarget.path && relocationTarget.path.length > 1) {
      const bounds = L.latLngBounds(relocationTarget.path.map((p) => [p.lat, p.lng]));
      mapInstance.fitBounds(bounds, { padding: [40, 40], duration: 1.2 });
    }
  };

  return (
    <div className="citizen-map-box">
      <div className="citizen-map-header">
        <div className="citizen-map-title">
          <Satellite size={15} style={{ color: "var(--brand-2)" }} />
          <span>Live High-Resolution Satellite GIS · Local Hazard & Shelter View</span>
        </div>
        <div className="citizen-map-actions">
          <button
            type="button"
            className="citizen-map-btn"
            onClick={handleLocateMe}
            title="Locate my position using GPS"
          >
            <Crosshair size={12} /> Locate GPS
          </button>
          <button
            type="button"
            className="citizen-map-btn"
            onClick={handleRecenter}
            title="Recenter on community"
          >
            <Compass size={12} /> Recenter
          </button>
          {relocationTarget && (
            <button
              type="button"
              className="citizen-map-btn is-accent"
              onClick={handleFocusRoute}
              title="Focus Evacuation Route"
            >
              <Route size={12} /> Route
            </button>
          )}
          <div className="citizen-tile-pills">
            <button
              type="button"
              className={activeTile === "satellite" ? "is-active" : ""}
              onClick={() => setActiveTile("satellite")}
            >
              🛰️ Satellite
            </button>
            <button
              type="button"
              className={activeTile === "standard" ? "is-active" : ""}
              onClick={() => setActiveTile("standard")}
            >
              🗺️ Streets
            </button>
            <button
              type="button"
              className={activeTile === "terrain" ? "is-active" : ""}
              onClick={() => setActiveTile("terrain")}
            >
              ⛰️ Topo
            </button>
          </div>
        </div>
      </div>

      <div className="citizen-map-frame">
        <MapContainer
          center={centerCoords}
          zoom={13}
          minZoom={4}
          maxZoom={18}
          zoomControl={false}
          scrollWheelZoom={true}
          dragging={true}
          style={{ height: "350px", width: "100%", borderRadius: "0 0 10px 10px" }}
        >
          <MapResizer />
          <MapInstanceSetter onMap={setMapInstance} />
          <TileLayer key={tile.id} url={tile.url} attribution={tile.attribution} maxZoom={tile.maxZoom} />
          <ZoomControl position="topright" />

          {/* Citizen Community Hazard Perimeter & Center Marker */}
          {zone && zone.lat && zone.lng && (
            <>
              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={32}
                pathOptions={{
                  color: zone.phase === "Immediate" ? "#dc2626" : zone.phase === "Short-Term" ? "#d97706" : "#059669",
                  weight: 2,
                  fillColor: zone.phase === "Immediate" ? "#dc2626" : zone.phase === "Short-Term" ? "#d97706" : "#059669",
                  fillOpacity: 0.22,
                  dashArray: "5, 5"
                }}
              />
              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={10}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: zone.phase === "Immediate" ? "#dc2626" : zone.phase === "Short-Term" ? "#d97706" : "#059669",
                  fillOpacity: 1
                }}
              >
                <Popup>
                  <div style={{ padding: "4px 2px", fontSize: "12px", minWidth: "180px" }}>
                    <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: "13px" }}>📍 {zone.name}</div>
                    <div style={{ color: "var(--ink-soft)", fontSize: "11px", marginBottom: "4px" }}>{zone.district}</div>
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "5px", display: "flex", flexDirection: "column", gap: "3px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Hazard:</span>
                        <strong style={{ color: zone.phase === "Immediate" ? "#dc2626" : "#d97706" }}>{zone.hazard}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Priority Score:</span>
                        <strong>{zone.priorityScore} / 100</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Status:</span>
                        <span style={{ fontWeight: 600, color: zone.phase === "Immediate" ? "#dc2626" : "#059669" }}>{zone.phase}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Residents at risk:</span>
                        <strong>{zone.population?.toLocaleString() || "0"}</strong>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}

          {/* Designated Safe Relief Shelter Marker */}
          {relocationTarget && relocationTarget.target && (
            <>
              <CircleMarker
                center={[relocationTarget.target.lat, relocationTarget.target.lng]}
                radius={24}
                pathOptions={{
                  color: "#059669",
                  weight: 2,
                  fillColor: "#10b981",
                  fillOpacity: 0.25
                }}
              />
              <CircleMarker
                center={[relocationTarget.target.lat, relocationTarget.target.lng]}
                radius={11}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#059669",
                  fillOpacity: 1
                }}
              >
                <Popup>
                  <div style={{ padding: "4px 2px", fontSize: "12px", minWidth: "190px" }}>
                    <div style={{ fontWeight: 700, color: "#059669", fontSize: "13px" }}>🟢 Designated Safe Relief Shelter</div>
                    <div style={{ fontWeight: 600, fontSize: "12.5px" }}>{relocationTarget.target.site?.name || relocationTarget.target.name}</div>
                    <div style={{ color: "var(--ink-soft)", fontSize: "11px", marginBottom: "4px" }}>{relocationTarget.target.district}</div>
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "5px", fontSize: "11.5px" }}>
                      <div>🚗 Transit Distance: <strong>{relocationTarget.distKm} km</strong></div>
                      <div>🚶 Evacuation ETA: <strong>~{Math.max(12, Math.round(relocationTarget.distKm * 2.2))} mins</strong></div>
                      <div style={{ color: "#059669", marginTop: "3px", fontWeight: 600 }}>✓ Verified Drinking Water & Clinic</div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}

          {/* Evacuation Route Polyline */}
          {relocationTarget && relocationTarget.path && relocationTarget.path.length > 1 && (
            <Polyline
              positions={relocationTarget.path.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: "#10b981",
                weight: 4.5,
                opacity: 0.95,
                dashArray: "8, 8"
              }}
            />
          )}

          {/* Nearby District Zones */}
          {zones &&
            zones
              .filter((z) => z.id !== zone?.id && z.district === zone?.district && z.lat && z.lng)
              .slice(0, 16)
              .map((otherZone) => (
                <CircleMarker
                  key={otherZone.id}
                  center={[otherZone.lat, otherZone.lng]}
                  radius={5.5}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 1.5,
                    fillColor: otherZone.phase === "Immediate" ? "#dc2626" : otherZone.phase === "Short-Term" ? "#d97706" : "#059669",
                    fillOpacity: 0.85
                  }}
                  eventHandlers={{
                    click: () => onSelect && onSelect(otherZone.id)
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -5]}>
                    <div style={{ fontSize: "11px" }}>
                      <strong>{otherZone.name}</strong> ({otherZone.priorityScore}/100)
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              ))}
        </MapContainer>

        {/* Legend */}
        <div className="citizen-map-legend">
          <div className="citizen-legend-item">
            <span className="legend-dot" style={{ background: zone?.phase === "Immediate" ? "#dc2626" : "#d97706" }} />
            <span>Community Hazard Risk</span>
          </div>
          {relocationTarget && (
            <>
              <div className="citizen-legend-item">
                <span className="legend-dot" style={{ background: "#059669" }} />
                <span>Designated Safe Relief Shelter</span>
              </div>
              <div className="citizen-legend-item">
                <span className="legend-line" style={{ borderColor: "#10b981" }} />
                <span>Dijkstra Evacuation Route</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  CITIZEN RESILIENCE & COMMUNITY ACTION TAB                             */
/* ---------------------------------------------------------------------- */

function CitizenTab({ zones, selectedId, onSelect, feedback, onSubmitFeedback, lang, setLang, subscribed, onSubscribe, relocationTarget }) {
  const [text, setText] = useState("");
  const [zoneChoice, setZoneChoice] = useState(selectedId || zones[0]?.id || "");
  const [category, setCategory] = useState("Rising Water / Submerged Road");
  const [urgency, setUrgency] = useState("High");
  const [phone, setPhone] = useState("");
  const [attachGps, setAttachGps] = useState(true);
  const [ticketSubmitted, setTicketSubmitted] = useState(null);
  const [honeypot, setHoneypot] = useState("");
  const [fontScale, setFontScale] = useState("normal"); // 'normal' | 'large' | 'xlarge'
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showSimulateAlert, setShowSimulateAlert] = useState(false);

  // 72-Hour Preparedness Go-Bag Checklist
  const [checklist, setChecklist] = useState([
    { id: "water", en: "Drinking Water (3 Liters per person per day)", hi: "पीने का साफ पानी (प्रति व्यक्ति 3 लीटर प्रतिदिन)", packed: true },
    { id: "food", en: "Ready-to-Eat Dry Food, Biscuits & ORS Packets", hi: "सूखा व तैयार भोजन, बिस्कुट और ओआरएस पैकेट", packed: true },
    { id: "docs", en: "Waterproof Pouch: Aadhaar, Ration Card, Passbooks", hi: "वाटरप्रूफ थैली: आधार कार्ड, राशन कार्ड, बैंक पासबुक", packed: true },
    { id: "meds", en: "First Aid Kit & 7-Day Prescription Medications", hi: "प्राथमिक चिकित्सा किट और 7 दिन की जरूरी दवाएं", packed: false },
    { id: "torch", en: "High-Beam Torch & Extra Dry Cell Batteries", hi: "तेज रोशनी वाली टॉर्च और अतिरिक्त बैटरियां", packed: false },
    { id: "power", en: "Fully Charged Power Bank & Mobile Cables", hi: "फुल चार्ज पावर बैंक और मोबाइल चार्जिंग केबल", packed: false },
    { id: "cash", en: "Emergency Cash in Small ₹100/₹200 Notes", hi: "छोटे नोटों में नकद राशि (ATM/UPI ठप होने पर)", packed: false },
    { id: "whistle", en: "Whistle for Signaling Rescue Boats & NDRF Teams", hi: "रेस्क्यू टीम को आवाज देने के लिए सीटी (Whistle)", packed: false },
  ]);

  const toggleChecklistItem = (id) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, packed: !item.packed } : item))
    );
  };

  const markAllChecklist = (state) => {
    setChecklist((prev) => prev.map((item) => ({ ...item, packed: state })));
  };

  const packedCount = checklist.filter((c) => c.packed).length;
  const packPercent = Math.round((packedCount / checklist.length) * 100);

  const zone = zones.find((z) => z.id === selectedId) || zones[0];
  const history = zone && zone.incidentHistory ? { events: zone.priorityScore > 50 ? 3 : 1, severity: zone.priorityScore > 60 ? "Critical" : "Moderate" } : { events: 1, severity: "Moderate" };

  useEffect(() => {
    if (selectedId) setZoneChoice(selectedId);
  }, [selectedId]);

  // Guaranteed safe haven target for citizen view
  const activeRelocTarget = useMemo(() => {
    if (relocationTarget && relocationTarget.target) return relocationTarget;
    if (!zone) return null;
    return {
      source: zone,
      target: {
        id: "SAFE-RELOC-01",
        name: zone.site?.name || `${zone.district?.split(',')[0]} Disaster Relief Center`,
        district: zone.district,
        lat: (zone.lat || 28.66) + 0.035,
        lng: (zone.lng || 77.30) + 0.041,
        population: 8500,
        site: { status: "matched", name: zone.site?.name || "District Multi-Purpose Relief Shelter", utilization: 55 }
      },
      distKm: 4.8,
      hops: 1,
      path: [
        { name: zone.name, lat: zone.lat || 28.66, lng: zone.lng || 77.30 },
        { name: "Sector Transit Corridor", lat: (zone.lat || 28.66) + 0.016, lng: (zone.lng || 77.30) + 0.02 },
        { name: zone.site?.name || "District Relief Center", lat: (zone.lat || 28.66) + 0.035, lng: (zone.lng || 77.30) + 0.041 }
      ]
    };
  }, [zone, relocationTarget]);

  // Text-to-Speech (TTS) Voice Advisory
  const toggleSpeech = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech voice advisory is not supported in this browser.");
      return;
    }
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const shelterName = activeRelocTarget?.target?.site?.name || activeRelocTarget?.target?.name || "the designated district shelter";
    const distText = activeRelocTarget?.distKm ? `${activeRelocTarget.distKm} kilometers` : "a short distance";

    let message = "";
    if (lang === "hi") {
      message = `ध्यान दें! ${zone ? zone.name : "समुदाय"} के नागरिकों के लिए आधिकारिक सुरक्षा सलाह। आपके क्षेत्र में ${zone?.hazard || "आपदा जोखिम"} के कारण स्थिति ${zone?.phase === "Immediate" ? "अति संवेदनशील और तत्काल सतर्कता" : "निगरानी"} के अधीन है। स्थानीय जोखिम स्कोर ${zone?.priorityScore || 60} है। कृपया अपने 72 घंटे के इमरजेंसी बैग में पीने का पानी, जरूरी दवाएं और पहचान पत्र सुरक्षित रखें। आपका सबसे नजदीकी सुरक्षित आश्रय ${shelterName} है, जो लगभग ${distText} दूर है। किसी भी आपातकालीन सहायता या बचाव के लिए 112 या एनडीआरएफ को 1078 पर तुरंत कॉल करें।`;
    } else {
      message = `Attention residents of ${zone ? zone.name : "your community"}, ${zone ? zone.district : ""}. This is an official disaster safety advisory. Your area is currently under ${zone?.phase || "Immediate"} alert status for ${zone?.hazard || "disaster hazard"}, with an action priority score of ${zone?.priorityScore || 60} out of 100. Please prepare your emergency kit, secure all essential documents, and follow district evacuation guidance. Your designated safe relief haven is ${shelterName}, situated ${distText} away. For immediate life rescue, dial 112 or NDRF helpline at 1078.`;
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = lang === "hi" ? "hi-IN" : "en-IN";
    utterance.rate = 0.92;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (honeypot) return;
    if (!text.trim() || text.length < 8) {
      alert("Please provide at least 8 characters describing the ground situation.");
      return;
    }
    const ticketId = `BR-SOS-${Math.floor(1000 + Math.random() * 9000)}`;
    const fullText = `[${urgency.toUpperCase()} URGENCY] ${text.trim()}${phone ? ` · Contact: ${phone}` : ""}${attachGps && zone ? ` · GPS: ${zone.lat}, ${zone.lng}` : ""}`;

    onSubmitFeedback({
      ticketId,
      zoneId: zoneChoice,
      category,
      urgency,
      text: fullText,
      time: new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })
    });
    setTicketSubmitted({ ticketId, zoneId: zoneChoice, time: "Just now" });
    setText("");
    setTimeout(() => setTicketSubmitted(null), 9000);
  };

  // Hazard Specific Do's and Don'ts
  const getHazardDosDonts = (hazard) => {
    const h = (hazard || "").toLowerCase();
    if (h.includes("flood")) {
      return {
        title: lang === "hi" ? "बाढ़ सुरक्षा निर्देश" : "Riverine & Flash Flood Safety Rules",
        dos: [
          lang === "hi" ? "तत्काल छत या ऊपरी मंजिल पर जाएं और मुख्य बिजली स्विच बंद करें" : "Move to higher ground/floors immediately; shut off main electrical breaker",
          lang === "hi" ? "केवल उबला या क्लोरीनेटेड पानी ही पिएं" : "Boil or chlorinate all drinking water before consumption",
          lang === "hi" ? "स्थानीय प्रशासन की लाउडस्पीकर घोषणाओं और एनडीआरएफ का पालन करें" : "Follow district disaster control loudspeaker & WhatsApp updates"
        ],
        donts: [
          lang === "hi" ? "बहते पानी या जलमग्न सड़कों पर पैदल या वाहन से न निकलें" : "Never walk or drive through moving flood waters (15 cm can sweep an adult)",
          lang === "hi" ? "बिजली के खंभों, तारों और गिरे पेड़ों के पास न जाएं" : "Stay far clear of downed electric poles and transformer boxes"
        ]
      };
    } else if (h.includes("landslide") || h.includes("slope")) {
      return {
        title: lang === "hi" ? "भूस्खलन सुरक्षा निर्देश" : "Landslide & Slope Movement Rules",
        dos: [
          lang === "hi" ? "पहाड़ी ढलानों में दरारें या मिट्टी का कटाव दिखते ही खाली करें" : "Evacuate immediately upon noticing widening ground fissures or tilted trees",
          lang === "hi" ? "पत्थरों के खिसकने या गड़गड़ाहट की आवाज पर सतर्क रहें" : "Listen for rumbling sounds of falling boulders and rushing debris",
          lang === "hi" ? "सुरक्षित पक्के सामुदायिक आश्रय में शरण लें" : "Move to designated concrete community shelters on stable bedrock"
        ],
        donts: [
          lang === "hi" ? "नदी नालों के प्राकृतिक बहाव मार्ग या ढलान के नीचे न रुकें" : "Do not stay downhill of saturated slopes or near culvert outlets",
          lang === "hi" ? "खतरे के दौरान बंद पहाड़ी रास्तों पर जबरन यात्रा न करें" : "Do not attempt to clear roadblocks manually during active rain"
        ]
      };
    } else {
      return {
        title: lang === "hi" ? "आपदा सुरक्षा दिशानिर्देश" : "General Disaster Safety Protocol",
        dos: [
          lang === "hi" ? "अपना 72 घंटे का इमरजेंसी बैग तैयार रखें" : "Keep your 72-hour emergency go-bag by the door",
          lang === "hi" ? "परिवार के साथ सुरक्षित मिलन स्थल पहले से तय करें" : "Agree on a designated safe reunion point with family members"
        ],
        donts: [
          lang === "hi" ? "सोशल मीडिया पर बिना पुष्टि वाली अफवाहों पर विश्वास न करें" : "Do not spread or act on unverified rumors on messaging groups"
        ]
      };
    }
  };

  const dosDonts = getHazardDosDonts(zone?.hazard);

  const HELPLINES = [
    { num: "112", nameEn: "National Emergency", nameHi: "राष्ट्रीय आपातकालीन सेवा", desc: "Police, Fire & Medical 24x7", icon: "🚨", color: "#dc2626" },
    { num: "1078", nameEn: "NDRF Rescue Ops", nameHi: "एनडीआरएफ बचाव कक्ष", desc: "Specialized Disaster Response", icon: "🛡️", color: "#2563eb" },
    { num: "1077", nameEn: "District DDMA Desk", nameHi: "जिला आपदा नियंत्रण", desc: "Local Collectorate Cell", icon: "🏛️", color: "#d97706" },
    { num: "108", nameEn: "Medical Ambulance", nameHi: "एम्बुलेंस सेवा", desc: "Hospital Triage & Trauma", icon: "🚑", color: "#059669" },
    { num: "1070", nameEn: "State Disaster SDMA", nameHi: "राज्य आपदा राहत", desc: "State HQ Relief Desk", icon: "🏢", color: "#4f46e5" },
  ];

  const RAPID_ISSUES = [
    { id: "Rising Water / Submerged Road", icon: "🌊", labelEn: "Rising Floodwater", labelHi: "बढ़ता जलस्तर" },
    { id: "Landslide / Ground Cracks", icon: "⛰️", labelEn: "Landslide / Fissure", labelHi: "भूस्खलन / दरार" },
    { id: "Access or Evacuation Route Cut Off", icon: "🚧", labelEn: "Road / Bridge Blocked", labelHi: "रास्ता / पुल बंद" },
    { id: "Stranded Senior / Medical Need", icon: "🚑", labelEn: "Medical / Senior Trap", labelHi: "फंसे बुजुर्ग / दवा" },
    { id: "Drinking Water / Food Scarcity", icon: "🚰", labelEn: "Water / Food Outage", labelHi: "पानी / राशन कमी" },
    { id: "Fallen Electric Wires / Sparking", icon: "⚡", labelEn: "Live Wire / Fallen Pole", labelHi: "गिरा हुआ बिजली पोल" },
  ];

  return (
    <div className={`citizen-page ${fontScale !== "normal" ? `font-scale-${fontScale}` : ""}`}>
      {/* Top Welcome Header & Accessibility Bar */}
      <div className="citizen-welcome">
        <div>
          <div className="eyebrow"><Users size={13} /> {lang === "hi" ? "नागरिक आपदा पोर्टल" : "Community Resilience Portal"}</div>
          <h1>{lang === "hi" ? "अपने क्षेत्र की स्थिति जानें और सुरक्षित रहें।" : "Know what is happening near you."}</h1>
          <p className="muted">
            {lang === "hi"
              ? "हाई-रिज़ॉल्यूशन सैटेलाइट मैप देखें, निकटतम राहत आश्रय खोजें, और आपातकालीन फील्ड टीम से जुड़ें।"
              : "High-resolution satellite GIS, verified evacuation sanctuaries, audio safety advisory, and emergency ground reporting."}
          </p>
        </div>

        {/* Accessibility & Voice Tools Bar */}
        <div className="citizen-access-bar">
          {/* TTS Audio Voice Button */}
          <button
            type="button"
            className={`citizen-tts-btn ${isPlayingAudio ? "is-speaking" : ""}`}
            onClick={toggleSpeech}
            title={lang === "hi" ? "आवाज में सुरक्षा निर्देश सुनें" : "Listen to official voice advisory"}
          >
            {isPlayingAudio ? (
              <>
                <VolumeX size={15} />
                <span>{lang === "hi" ? "आवाज रोकें (Stop)" : "Stop Voice"}</span>
                <div className="audio-wave">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            ) : (
              <>
                <Volume2 size={15} />
                <span>{lang === "hi" ? "🔊 सुरक्षा सलाह सुनें" : "🔊 Listen to Advisory"}</span>
              </>
            )}
          </button>

          {/* Font Resizer */}
          <div className="font-scale-controls" title="Text size for accessibility">
            <span style={{ fontSize: "10.5px", color: "var(--ink-soft)", padding: "0 4px" }}>Text:</span>
            <button
              type="button"
              className={`font-scale-btn ${fontScale === "normal" ? "is-active" : ""}`}
              onClick={() => setFontScale("normal")}
            >
              A
            </button>
            <button
              type="button"
              className={`font-scale-btn ${fontScale === "large" ? "is-active" : ""}`}
              onClick={() => setFontScale("large")}
            >
              A+
            </button>
            <button
              type="button"
              className={`font-scale-btn ${fontScale === "xlarge" ? "is-active" : ""}`}
              onClick={() => setFontScale("xlarge")}
            >
              A++
            </button>
          </div>

          {/* Language Toggle */}
          <div className="lang-toggle">
            <button className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>English</button>
            <button className={lang === "hi" ? "is-on" : ""} onClick={() => setLang("hi")}>हिन्दी</button>
          </div>

          <div className="citizen-trust"><CheckCircle2 size={14} /> {lang === "hi" ? "जिला आपदा टीम से सत्यापित" : "Connected to District Operations"}</div>
        </div>
      </div>

      {/* 1-Tap Emergency SOS Direct Helplines Strip */}
      <div className="citizen-sos-strip">
        {HELPLINES.map((h) => (
          <a key={h.num} href={`tel:${h.num}`} className="citizen-sos-card" title={`Call ${h.nameEn} immediately`}>
            <div className="citizen-sos-info">
              <strong>{h.icon} {h.num}</strong>
              <span>{lang === "hi" ? h.nameHi : h.nameEn}</span>
            </div>
            <div className="citizen-sos-badge">
              <PhoneCall size={10} /> Call
            </div>
          </a>
        ))}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="citizen-grid">
        {/* Left Column: Satellite Map + Community Card + Hazard Safety Rules */}
        <div>
          {/* Leaflet Satellite Map */}
          <CitizenSatelliteMap
            zone={zone}
            zones={zones}
            onSelect={onSelect}
            relocationTarget={activeRelocTarget}
          />

          {/* Zone Detail & Risk Card */}
          {zone && (
            <div className="citizen-zone-card">
              <div className="citizen-zone-top">
                <div>
                  <div className="detail-code">{zone.id}</div>
                  <h4 style={{ margin: "2px 0 3px" }}>{zone.name}</h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    <MapPin size={11} style={{ verticalAlign: "middle" }} /> {zone.district}
                  </p>
                </div>
                <PhaseBadge phase={zone.phase} />
              </div>

              <div style={{ marginTop: "12px", background: "var(--panel-2)", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", marginBottom: "4px" }}>
                  <span style={{ color: "var(--ink-soft)" }}>Hazard Threat:</span>
                  <strong style={{ color: zone.phase === "Immediate" ? "var(--immediate)" : "var(--brand)" }}>
                    {zone.hazard}
                  </strong>
                </div>
                <AnimatedBar value={zone.hazardIntensity} color={zone.phase === "Immediate" ? "#dc2626" : "#d97706"} height={6} trackKey={zone.id + "cit"} />
              </div>

              <div className="citizen-risk-row">
                <div>
                  <strong>{zone.priorityScore} / 100</strong>
                  <span>{lang === "hi" ? "प्राथमिकता स्कोर" : "local priority"}</span>
                </div>
                <div>
                  <strong>{history.events}</strong>
                  <span>{lang === "hi" ? "पिछली आपदाएं" : "past events"}</span>
                </div>
                <div>
                  <strong>{fmt(zone.population)}</strong>
                  <span>{lang === "hi" ? "प्रभावित जनसंख्या" : "people nearby"}</span>
                </div>
              </div>

              <div className="citizen-action-note">
                <span>{lang === "hi" ? "आधिकारिक निर्देश" : "WHAT THIS MEANS"}</span>
                {lang === "hi"
                  ? zone.phase === "Immediate"
                    ? "अलर्ट चालू रखें, आवश्यक दस्तावेज और दवाएं वाटरप्रूफ बैग में रखें और जिला प्रशासन के निकासी निर्देशों का तुरंत पालन करें।"
                    : "सतर्क रहें, स्थानीय स्थिति की निगरानी करें और किसी भी जलभराव या मार्ग अवरोध की सूचना नीचे दिए गए फॉर्म से दें।"
                  : zone.phase === "Immediate"
                  ? "Keep alerts on, secure your emergency kit, and follow district evacuation instructions immediately."
                  : "Stay informed, monitor surrounding water levels, and report ground changes in access, water, or shelter conditions."}
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className={`btn-ghost full ${isPlayingAudio ? "is-on" : ""}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", padding: "8px" }}
                  onClick={toggleSpeech}
                >
                  {isPlayingAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  {isPlayingAudio ? (lang === "hi" ? "आवाज बंद करें" : "Stop Voice") : (lang === "hi" ? "सुरक्षा निर्देश सुनें" : "Listen to Voice Guidance")}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Hazard-Specific Do's & Don'ts */}
          <div className="citizen-dodonts-card">
            <div className="dodonts-head">
              <ShieldCheck size={16} style={{ color: "var(--brand-2)" }} />
              <span>{dosDonts.title}</span>
            </div>
            <div className="dodonts-cols">
              <div className="dos-box">
                <h5><CheckCircle2 size={13} /> {lang === "hi" ? "क्या करें (DOs)" : "DOs (Safety First)"}</h5>
                <ul>
                  {dosDonts.dos.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="donts-box">
                <h5><X size={13} /> {lang === "hi" ? "क्या न करें (DON'Ts)" : "DON'Ts (Avoid Risk)"}</h5>
                <ul>
                  {dosDonts.donts.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Safe Shelter Sanctuary + 72-Hour Checklist + Ground Report Form + SMS Subscription */}
        <div>
          {/* Nearest Designated Safe Relief Haven Card */}
          {activeRelocTarget && (
            <div className="citizen-shelter-card">
              <div className="shelter-head">
                <div>
                  <div className="shelter-title">
                    <Shield size={16} />
                    <span>{lang === "hi" ? "आपका नामित सुरक्षित राहत आश्रय" : "Designated Safe Relief Shelter"}</span>
                  </div>
                  <h4 style={{ margin: "4px 0 2px", fontFamily: "Space Grotesk", fontSize: "15px", color: "var(--brand)" }}>
                    {activeRelocTarget.target.site?.name || activeRelocTarget.target.name}
                  </h4>
                  <p className="muted small" style={{ margin: 0 }}>
                    {activeRelocTarget.target.district}
                  </p>
                </div>
                <span className="shelter-badge">{lang === "hi" ? "सत्यापित सुरक्षित" : "Safe Haven"}</span>
              </div>

              <div className="shelter-kpis">
                <div>
                  <span>Distance: </span>
                  <strong>{activeRelocTarget.distKm} km</strong>
                </div>
                <div>
                  <span>Walking ETA: </span>
                  <strong>~{Math.max(12, Math.round(activeRelocTarget.distKm * 2.2))} mins</strong>
                </div>
                <div>
                  <span>Safe Intake: </span>
                  <strong>{fmt(activeRelocTarget.target.population ? activeRelocTarget.target.population * 2 : 12000)} slots</strong>
                </div>
              </div>

              <div className="shelter-amenities">
                <span className="shelter-amenity-pill"><Hospital size={12} /> Medical Clinic & Doctors</span>
                <span className="shelter-amenity-pill"><Droplets size={12} /> Clean RO Drinking Water</span>
                <span className="shelter-amenity-pill"><Flame size={12} /> Hot Community Kitchen</span>
                <span className="shelter-amenity-pill"><Building2 size={12} /> Generator & Mobile Charging</span>
                <span className="shelter-amenity-pill"><ShieldCheck size={12} /> Separate Women & Child Ward</span>
              </div>
            </div>
          )}

          {/* Interactive 72-Hour Preparedness Checklist */}
          <div className="citizen-checklist-card" style={{ marginTop: "14px" }}>
            <div className="checklist-head">
              <div className="checklist-title">
                <ClipboardList size={16} style={{ color: "var(--brand-2)" }} />
                <span>{lang === "hi" ? "72 घंटे का आपातकालीन किट (Go-Bag)" : "72-Hour Emergency Kit (Go-Bag)"}</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => markAllChecklist(true)}
                  className="btn-ghost"
                  style={{ fontSize: "10px", padding: "3px 7px" }}
                >
                  {lang === "hi" ? "सभी चुनें" : "All packed"}
                </button>
                <button
                  type="button"
                  onClick={() => markAllChecklist(false)}
                  className="btn-ghost"
                  style={{ fontSize: "10px", padding: "3px 7px" }}
                >
                  {lang === "hi" ? "रीसेट" : "Reset"}
                </button>
              </div>
            </div>

            <div className="checklist-progress-wrap">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--ink-soft)" }}>
                <span>{packedCount} of {checklist.length} items packed</span>
                <strong style={{ color: packPercent === 100 ? "#059669" : "var(--brand)" }}>{packPercent}% Ready</strong>
              </div>
              <div className="checklist-bar-bg">
                <div className="checklist-bar-fill" style={{ width: `${packPercent}%` }} />
              </div>
            </div>

            <div className="checklist-items">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className={`checklist-item ${item.packed ? "is-packed" : ""}`}
                  onClick={() => toggleChecklistItem(item.id)}
                >
                  <div className="checklist-checkbox">
                    {item.packed ? <Check size={12} /> : null}
                  </div>
                  <span style={{ textDecoration: item.packed ? "line-through" : "none" }}>
                    {lang === "hi" ? item.hi : item.en}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Citizen Ground Report & Observation Form */}
          <div className="feedback-panel" style={{ marginTop: "14px" }}>
            <div className="reports-head">
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MessageSquare size={15} style={{ color: "var(--brand-2)" }} />
                {lang === "hi" ? "मैदानी स्थिति रिपोर्ट (Community Report)" : "Community Ground Report & SOS"}
              </span>
              <span className="muted small">{lang === "hi" ? "सीधे जिला कंट्रोल रूम को प्रेषित" : "Direct to District Control"}</span>
            </div>

            {ticketSubmitted && (
              <div className="ticket-alert-box">
                <CheckCircle2 size={16} />
                <div>
                  <strong>{lang === "hi" ? "रिपोर्ट सफलतापूर्वक दर्ज!" : "Report Dispatched Successfully!"}</strong>
                  <div>
                    Ticket ID: <strong>{ticketSubmitted.ticketId}</strong> · {lang === "hi" ? "जिला आपदा दल को सूचित किया गया।" : "Sent to District Emergency Operations."}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="feedback-form">
              <input
                type="text"
                name="honeypot"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ display: "none" }}
                tabIndex="-1"
                autoComplete="off"
              />

              {/* Zone selector */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "3px" }}>
                  {lang === "hi" ? "प्रभावित क्षेत्र चुनें:" : "Select Affected Community:"}
                </label>
                <select value={zoneChoice} onChange={(e) => { setZoneChoice(e.target.value); onSelect(e.target.value); }} required>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.id} — {z.name} ({z.district})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rapid Category Pills */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "3px" }}>
                  {lang === "hi" ? "समस्या का प्रकार (Category):" : "Incident Category:"}
                </label>
                <div className="quick-tags-wrap">
                  {RAPID_ISSUES.map((iss) => (
                    <button
                      type="button"
                      key={iss.id}
                      className={`quick-tag-pill ${category === iss.id ? "is-selected" : ""}`}
                      onClick={() => setCategory(iss.id)}
                    >
                      {iss.icon} {lang === "hi" ? iss.labelHi : iss.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Urgency Selector */}
              <div>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", display: "block", marginBottom: "3px" }}>
                  {lang === "hi" ? "आपातकालीन स्तर (Urgency):" : "Urgency Level:"}
                </label>
                <div className="urgency-toggle">
                  <button
                    type="button"
                    className={`urgency-btn ${urgency === "High" ? "is-high" : ""}`}
                    onClick={() => setUrgency("High")}
                  >
                    🔴 {lang === "hi" ? "अति गंभीर (Life Risk)" : "Critical Emergency"}
                  </button>
                  <button
                    type="button"
                    className={`urgency-btn ${urgency === "Moderate" ? "is-mod" : ""}`}
                    onClick={() => setUrgency("Moderate")}
                  >
                    🟡 {lang === "hi" ? "चेतावनी (Access Cut)" : "Moderate / Impaired"}
                  </button>
                  <button
                    type="button"
                    className={`urgency-btn ${urgency === "Info" ? "is-info" : ""}`}
                    onClick={() => setUrgency("Info")}
                  >
                    🟢 {lang === "hi" ? "सामान्य सूचना" : "General Advisory"}
                  </button>
                </div>
              </div>

              {/* Phone contact input */}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="tel"
                  placeholder={lang === "hi" ? "मोबाइल नंबर (बचाव कार्य संपर्क हेतु - वैकल्पिक)" : "Phone number (for rescue dispatch - optional)"}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ flex: 1, padding: "7px 10px", fontSize: "12px", border: "1px solid var(--line)", borderRadius: "6px" }}
                />
              </div>

              {/* GPS Geotag Checkbox */}
              <label style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "11px", color: "var(--ink-soft)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={attachGps}
                  onChange={(e) => setAttachGps(e.target.checked)}
                />
                <span>{lang === "hi" ? `वर्तमान जीपीएस स्थिति संलग्न करें (${zone.lat?.toFixed(3)}, ${zone.lng?.toFixed(3)})` : `Attach verified zone GPS coordinates (${zone.lat?.toFixed(3)}, ${zone.lng?.toFixed(3)})`}</span>
              </label>

              {/* Description textarea */}
              <textarea
                rows={3}
                placeholder={
                  lang === "hi"
                    ? "जमीनी स्थिति का संक्षिप्त विवरण लिखें (उदा. पानी कितना ऊंचा है, क्या कोई फंसा है, रास्ता खुला है या नहीं)..."
                    : "Describe what you are seeing on the ground (water level, impassable bridges, trapped residents, medical needs)..."
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                minLength={8}
              />

              <button className="btn-primary" type="submit" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MessageSquare size={14} /> {lang === "hi" ? "रिपोर्ट जिला दल को भेजें" : "Dispatch Community Report"}
              </button>
            </form>

            {/* List of recent community feedback */}
            <div className="feedback-list" style={{ marginTop: "12px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", marginBottom: "6px" }}>
                {lang === "hi" ? "हालिया सत्यापित मैदानी रिपोर्ट:" : "Recent Verified Field Reports:"}
              </div>
              {feedback.length === 0 && <p className="muted small">No community reports submitted yet.</p>}
              {feedback.map((f, i) => (
                <div className="feedback-item" key={i}>
                  <div className="feedback-item-head">
                    <span>
                      <span className="zone-code-sm">{f.zoneId}</span>
                      <span className="feedback-category">{f.category || "General"}</span>
                    </span>
                    <span className="muted small">{f.time}</span>
                  </div>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Voice & SMS Alert Subscription Card */}
          <div className="citizen-sub-card" style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "Space Grotesk", fontWeight: 700, fontSize: "13px", color: "var(--brand)" }}>
                <Bell size={15} style={{ color: "var(--brand-2)" }} />
                <span>{lang === "hi" ? "वॉइस व एसएमएस आपदा अलर्ट" : "Voice & SMS Disaster Broadcasts"}</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: "10.5px", padding: "3px 7px" }}
                onClick={() => setShowSimulateAlert(!showSimulateAlert)}
              >
                {showSimulateAlert ? "Hide Preview" : "Preview SMS"}
              </button>
            </div>

            <p style={{ fontSize: "11.5px", color: "var(--ink-soft)", margin: "0 0 10px" }}>
              {lang === "hi"
                ? "मौसम विभाग और जिला कलेक्ट्रेट द्वारा जारी किए गए तत्काल खाली करने के संदेश अपने फोन पर पाएं।"
                : "Receive instant automated IVR voice calls and WhatsApp/SMS alerts when your zone escalates to Immediate action."}
            </p>

            <button
              className={`btn-primary full ${subscribed ? "is-on" : ""}`}
              onClick={onSubscribe}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
            >
              <Bell size={14} />
              {subscribed
                ? (lang === "hi" ? "✓ अलर्ट चालू है (SMS & Voice Active)" : "✓ Voice & SMS Alerts Active")
                : (lang === "hi" ? "आपदा अलर्ट प्राप्त करने हेतु सब्सक्राइब करें" : "Subscribe to Voice & SMS Alerts")}
            </button>

            {showSimulateAlert && (
              <div className="sub-preview-box">
                <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertCircle size={12} /> BHOOMI RAKSHAK 2.0 OFFICIAL BROADCAST
                </div>
                <div>
                  [DISASTER ALERT - {zone.id} {zone.name}]: Immediate hazard threat active. Priority score: {zone.priorityScore}/100.
                  Follow designated evacuation corridor to {activeRelocTarget.target.site?.name || activeRelocTarget.target.name} ({activeRelocTarget.distKm} km). Emergency rescue helpline: 112 / 1078.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ALERTS TAB                                                             */
/* ---------------------------------------------------------------------- */

function AlertsTab() {
  const [emails, setEmails] = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(buildApiUrl("/api/emails"))
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEmails(data);
      })
      .catch(e => console.error("Failed to load emails:", e));
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newEmail) return;
    setLoading(true);
    fetch(buildApiUrl("/api/emails"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail })
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.email) {
          setEmails([...emails, data]);
          setNewEmail("");
        }
      })
      .catch(e => console.error("Failed to add email:", e))
      .finally(() => setLoading(false));
  };

  return (
    <div className="reports">
      <div className="reports-head">
        <span>Email Alert Subscribers</span>
        <span className="muted">{emails.length} Subscribed</span>
      </div>
      <div style={{ padding: "16px", background: "var(--panel-2)", borderRadius: "8px", marginBottom: "16px" }}>
        <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px" }}>
          <input 
            type="email" 
            placeholder="Enter email address..." 
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--line)", borderRadius: "6px" }}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Adding..." : "Add Email"}
          </button>
        </form>
      </div>
      <table className="report-table">
        <thead>
          <tr>
            <th>EMAIL ADDRESS</th>
            <th>DATE SUBSCRIBED</th>
          </tr>
        </thead>
        <tbody>
          {emails.map(e => (
            <tr key={e.id}>
              <td><strong>{e.email}</strong></td>
              <td>{new Date(e.timestamp).toLocaleString()}</td>
            </tr>
          ))}
          {emails.length === 0 && (
            <tr><td colSpan="2" style={{textAlign:"center"}}>No emails subscribed yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  ROOT APP                                                               */
/* ---------------------------------------------------------------------- */

export default function BhoomiRakshakDashboard() {
  const [role, setRole] = useState("authority");
  const [district, setDistrict] = useState("All Districts");
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState(ZONES[0].id);
  const [selectTrigger, setSelectTrigger] = useState(0);
  const handleSelectZone = (id) => {
    setSelectedId(id);
    setSelectTrigger((c) => c + 1);
  };
  const [certZone, setCertZone] = useState(null);
  const [toast, setToast] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [subscribed, setSubscribed] = useState(false);
  const [lang, setLang] = useState("en");
  const [scenario, setScenario] = useState("baseline");
  const [hazardLift, setHazardLift] = useState(0);
  const [showRelocPanel, setShowRelocPanel] = useState(false);

  // Dynamic Map Mode and Layer States
  const [mapMode, setMapMode] = useState("risk"); // "risk", "3d", "2d"
  const [terrain3DStyle, setTerrain3DStyle] = useState("satellite"); // "satellite", "elevation", "geology", "radar", "hydrology", "slope"
  const [terrain3DExaggeration, setTerrain3DExaggeration] = useState(1.0); // 1.0, 1.8, 2.5
  const [autoRotate3D, setAutoRotate3D] = useState(true);
  const [risk2DStyle, setRisk2DStyle] = useState("satellite"); // "satellite", "terrain", "standard", "dark", "light", "relief"
  const [grid2DStyle, setGrid2DStyle] = useState("contours"); // "contours", "hydrology", "hazard", "corridors"
  const [visibleLayers, setVisibleLayers] = useState({ hazard: true, population: true, sites: true });
  const [fusionEnabled, setFusionEnabled] = useState(true);
  const [selectedHazards, setSelectedHazards] = useState({ flood: true, landslide: true, earthquake: true, rainfall: true });
  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setTab(role === "citizen" ? "citizen" : "overview");
  }, [role]);

  const zones = useMemo(
    () => (district === "All Districts" ? ZONES : ZONES.filter((z) => z.district === district)),
    [district]
  );

  const scenarioZones = useMemo(() => zones.map((zone) => {
    const projectedScore = Math.min(100, Math.round(zone.priorityScore * (1 + hazardLift / 100)));
    const phase = projectedScore >= 60 ? "Immediate" : projectedScore >= 50 ? "Short-Term" : "Medium-Term";
    return { ...zone, priorityScore: projectedScore, phase };
  }), [zones, hazardLift]);

  const mapZones = useMemo(() => {
    const subset = scenarioZones.slice(0, 400);
    if (selectedId && !subset.find((z) => z.id === selectedId)) {
      const sel = scenarioZones.find((z) => z.id === selectedId);
      if (sel) subset.push(sel);
    }
    return subset;
  }, [scenarioZones, selectedId]);

  useEffect(() => {
    if (!zones.find((z) => z.id === selectedId) && zones.length) setSelectedId(zones[0].id);
  }, [zones]); // eslint-disable-line

  const selectedZone = scenarioZones.find((z) => z.id === selectedId) || null;

  // Reactive Dijkstra shortest path router:
  // Automatically computes evacuation corridor for Red (Immediate) and Yellow (Short-Term) zones
  const relocationTarget = useMemo(() => {
    if (!selectedZone) return null;
    if (selectedZone.phase === "Immediate" || selectedZone.phase === "Short-Term") {
      return findRelocationRouteDijkstra(selectedZone, scenarioZones);
    }
    return null;
  }, [selectedZone, scenarioZones]);

  const authorityTabs = [
    { id: "overview", label: "Overview" },
    { id: "phasing", label: "Phasing matrix" },
    { id: "reverse-insurance", label: "Reverse insurance" },
    { id: "fund-calculator", label: "Fund calculator" },
    { id: "community-voice", label: "Community voice" },
    { id: "analytics", label: "Analytics" },
    { id: "reports", label: "Reports & legal" },
    { id: "alerts", label: "Alerts" },
  ];

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        :root {
          --ink: #172a3a; --ink-soft: #5e7180; --paper: #f7f8fa; --panel: #ffffff;
          --panel-2: #eef4f7; --line: #d5e0e8; --brand: #143b5d; --brand-2: #1e7890;
          --safe: #2e8b68; --watch: #c8871f; --immediate: #c84b4b;
          --contour: #b7cbd7; --map-bg: #eaf2f5;
        }
        * { box-sizing: border-box; }
        .app { font-family: 'Inter', system-ui, sans-serif; background: var(--paper); color: var(--ink);
          min-height: 100%; width: 100%; }
        .app, .app * { -webkit-font-smoothing: antialiased; }

        .header { display:flex; align-items:center; justify-content:space-between; gap:16px;
          padding: 16px 22px; background: var(--brand); color: #eef1e8; flex-wrap: wrap; }
        .brand-wrap { display:flex; align-items:center; gap:10px; }
        .brand-mark { width:30px; height:30px; border-radius:6px; background:#eef1e8; color:var(--brand);
          display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:700; font-size:14px; }
        .header .brand-name { color: #ffffff !important; font-family:'Space Grotesk'; font-weight: 700; font-size: 17px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); }
        .header .brand-tag { font-size: 11px; color: #d1ded8 !important; }
        .header-controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .header-controls select { background:#25473f; color:#eef1e8; border:1px solid #3a5f56; border-radius:6px;
          padding:6px 10px; font-size:12.5px; font-family:'Inter'; }
        .role-toggle { display:flex; background:#173029; border-radius:7px; padding:3px; }
        .role-toggle button { border:none; background:transparent; color:#c7d1c1; padding:6px 12px; font-size:12.5px;
          border-radius:5px; cursor:pointer; font-family:'Inter'; font-weight:500; }
        .role-toggle button.is-on { background:#eef1e8; color:var(--brand); }

        .nav-tabs { display:flex; gap:2px; padding: 0 22px; background: var(--panel-2); border-bottom:1px solid var(--line);
          overflow-x:auto; }
        .nav-tabs button { border:none; background:transparent; padding:12px 14px; font-size:13px; font-weight:500;
          color:var(--ink-soft); cursor:pointer; border-bottom:2px solid transparent; white-space:nowrap; font-family:'Inter'; }
        .nav-tabs button.is-active { color:var(--brand); border-bottom-color:var(--brand); font-weight:600; }

        .body { padding: 18px 22px 40px; }

        .scenario-lab { display:grid; grid-template-columns:1.4fr 1fr 1.1fr; gap:16px; align-items:center; background:var(--brand); color:#eef1e8;
          border-radius:10px; padding:16px 18px; margin-bottom:16px; }
        .scenario-kicker { display:flex; align-items:center; gap:6px; color:#c7d1c1; font-size:11px; text-transform:uppercase; letter-spacing:.5px; font-weight:600; }
        .scenario-copy h2 { font-family:'Space Grotesk'; font-size:18px; margin:5px 0 4px; }
        .scenario-copy p { font-size:11.5px; line-height:1.45; margin:0; color:#c7d1c1; }
        .scenario-controls { display:flex; flex-direction:column; gap:10px; }
        .scenario-controls label { display:flex; flex-direction:column; gap:5px; font-size:11px; color:#c7d1c1; }
        .scenario-controls select { background:#25473f; color:#eef1e8; border:1px solid #527268; border-radius:6px; padding:7px 8px; font:inherit; }
        .range-label strong { color:#eef1e8; font-family:'Space Grotesk'; }
        .scenario-controls input[type=range] { width:100%; accent-color:#d6bd63; }
        .scenario-results { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
        .scenario-results div { border-left:1px solid #527268; padding-left:10px; }
        .scenario-results strong { display:block; font:700 21px 'Space Grotesk'; color:#eef1e8; }
        .scenario-results span { display:block; font-size:10px; color:#c7d1c1; line-height:1.25; }
        .scenario-results .scenario-alert strong { color:#f0a18e; }
        .scenario-note { grid-column:1/-1; display:flex; align-items:center; gap:6px; border-top:1px solid #527268; padding-top:9px; color:#d6bd63; font-size:10.5px; }
        @media (max-width: 900px) { .scenario-lab { grid-template-columns:1fr 1fr; } .scenario-results { grid-template-columns:repeat(2,1fr); } .scenario-note { grid-column:auto; } }
        @media (max-width: 600px) { .scenario-lab { grid-template-columns:1fr; } .scenario-note { grid-column:1; } }

        .overview-layout { display:grid; grid-template-columns: 270px 1fr 320px; gap: 16px; align-items:start; }
        @media (max-width: 980px) {
          .overview-layout { display: flex; flex-direction: column; gap: 14px; }
          .overview-layout > .workspace-main { order: 1; width: 100%; }
          .overview-layout > .detail-panel { order: 2; width: 100%; }
          .overview-layout > .zone-list { order: 3; width: 100%; }
          .zone-list-body { max-height: 220px; }
        }

        .zone-list { background: var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
        .zone-list-head { display:flex; justify-content:space-between; padding:11px 13px; font-size:12px; font-weight:600;
          border-bottom:1px solid var(--line); font-family:'Space Grotesk'; }
        .zone-list-body { max-height: 560px; overflow-y:auto; }
        .zone-row { width:100%; display:flex; align-items:center; gap:9px; padding:10px 12px; border:none; background:none;
          border-bottom:1px solid var(--panel-2); cursor:pointer; text-align:left; }
        .zone-row:hover { background: var(--panel-2); }
        .zone-row.is-active { background:#dfe3d1; }
        .zone-rank { font-family:'Space Grotesk'; font-size:11px; color:var(--ink-soft); width:16px; }
        .zone-icon { display:flex; }
        .zone-row-main { flex:1; min-width:0; }
        .zone-row-name { display:block; font-size:12.5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .zone-row-sub { display:block; font-size:11px; color:var(--ink-soft); }
        .zone-score { font-family:'Space Grotesk'; font-weight:700; font-size:14px; }

        .map-wrap { background: var(--map-bg); border:1px solid var(--line); border-radius:10px; padding:10px; position:relative; }
        .map-svg { width:100%; height: auto; display:block; }
        .zone-node { cursor:pointer; }
        .map-label { font-size:2.6px; fill: var(--ink); font-family:'Space Grotesk'; font-weight:600; }
        .map-legend { position:absolute; left:20px; bottom:16px; background:rgba(246,245,238,0.9); border:1px solid var(--line);
          border-radius:7px; padding:7px 10px; display:flex; gap:12px; }
        .legend-row { display:flex; align-items:center; gap:5px; font-size:10.5px; color:var(--ink-soft); }
        .dot { width:7px; height:7px; border-radius:50%; display:inline-block; }

        .detail-panel { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
        .detail-empty { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; color:var(--ink-soft);
          padding:50px 20px; font-size:13px; }
        .detail-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
        .detail-code { font-family:'Space Grotesk'; font-size:11px; letter-spacing:0.4px; color:var(--ink-soft); }
        .detail-panel h3 { font-family:'Space Grotesk'; font-size:16px; margin:2px 0 3px; }
        .muted { color: var(--ink-soft); }
        .small { font-size:11.5px; }
        .badge { font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:5px; white-space:nowrap; }

        .score-block { margin-bottom:14px; }
        .score-block-head { display:flex; justify-content:space-between; align-items:baseline; font-size:12px; margin-bottom:5px; color:var(--ink-soft); }
        .score-big { font-family:'Space Grotesk'; font-weight:700; font-size:20px; }
        .formula { font-size:10.5px; color:var(--ink-soft); margin-top:4px; font-style:italic; }

        .mini-metrics { display:grid; gap:9px; margin-bottom:14px; }
        .mini-label { display:flex; justify-content:space-between; align-items:baseline; font-size:11px; color:var(--ink-soft); margin-bottom:3px; }
        .mini-score { font-family:'Space Grotesk', sans-serif; display:inline-flex; align-items:baseline; gap:2px; }
        .mini-score strong { font-size:11.5px; font-weight:700; color:var(--brand); }
        .mini-score .mini-scale { font-size:9.5px; font-weight:500; color:var(--ink-soft); opacity:0.8; }

        .explain-box { background: var(--panel-2); border:1px solid var(--line); border-radius:8px; padding:11px; margin-bottom:14px; }
        .explain-head { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; margin-bottom:5px; color:var(--brand-2); }
        .explain-box p { font-size:12px; line-height:1.5; margin:0; }

        .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
        .stat-grid div { background: var(--panel-2); border-radius:7px; padding:8px 10px; }
        .stat-num { display:block; font-family:'Space Grotesk'; font-weight:700; font-size:15px; }
        .stat-lab { font-size:10.5px; color:var(--ink-soft); }

        .site-card { border:1px solid var(--line); border-radius:8px; padding:10px 11px; margin-bottom:14px; }
        .site-card-head { display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; margin-bottom:6px; }
        .site-card p { font-size:12px; margin:0 0 6px; line-height:1.45; }
        .ok-icon { color: var(--safe); position:relative; top:2px; }
        .warn-icon { color: var(--immediate); position:relative; top:2px; }
        .site-meta { font-size:10.5px; color:var(--ink-soft); }
        .response-card { border:1px solid var(--line); border-radius:8px; padding:10px 11px; margin-bottom:14px; background:var(--panel-2); }
        .response-steps { display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin:9px 0 8px; }
        .response-step { display:flex; flex-direction:column; align-items:center; gap:4px; border:none; background:transparent; color:var(--ink-soft); padding:0; font:10px 'Inter'; cursor:pointer; }
        .response-step.is-active { color:var(--brand); font-weight:600; }
        .response-dot { display:flex; align-items:center; justify-content:center; width:20px; height:20px; border:1px solid var(--line); border-radius:50%; background:var(--paper); font-size:10px; }
        .response-step.is-active .response-dot { border-color:var(--brand-2); background:var(--brand-2); color:#eef1e8; }
        .response-status { border-top:1px solid var(--line); padding-top:7px; color:var(--ink-soft); font-size:10.5px; }
        .response-status strong { color:var(--brand); }

        .action-row { display:flex; gap:8px; flex-wrap:wrap; }
        .btn-primary, .btn-ghost { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600;
          border-radius:7px; padding:9px 13px; cursor:pointer; font-family:'Inter'; }
        .btn-primary { background: var(--brand); color:#eef1e8; border:1px solid var(--brand); }
        .btn-primary.is-on { background: var(--brand-2); }
        .btn-primary.full { width:100%; justify-content:center; margin-top:10px; }
        .btn-ghost { background:transparent; color:var(--brand); border:1px solid var(--line); }
        .btn-ghost.sm { padding:5px 9px; font-size:11.5px; }

        .modal-overlay { position:fixed; inset:0; background:rgba(22,33,26,0.55); display:flex; align-items:center;
          justify-content:center; z-index:50; padding:20px; }
        .certificate { background:#fdfcf6; border-radius:10px; padding:26px; max-width:520px; width:100%; position:relative;
          box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
        .modal-close { position:absolute; top:14px; right:14px; background:none; border:none; cursor:pointer; color:var(--ink-soft); }
        .cert-head { display:flex; gap:10px; align-items:flex-start; margin-bottom:16px; color:var(--brand); }
        .cert-eyebrow { font-size:11px; color:var(--ink-soft); }
        .cert-title { font-family:'Space Grotesk'; font-weight:700; font-size:16px; }
        .cert-table { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:14px; }
        .cert-table td { padding:6px 4px; border-bottom:1px dashed var(--line); }
        .cert-table td:first-child { color:var(--ink-soft); width:44%; }
        .cert-note { font-size:12px; line-height:1.55; background:var(--panel-2); border-radius:7px; padding:10px; margin-bottom:14px; }
        .cert-foot { display:flex; flex-direction:column; gap:2px; font-size:10.5px; color:var(--ink-soft); margin-bottom:14px; }
        .cert-print { width:100%; justify-content:center; }

        .kanban { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
        @media (max-width: 900px) { .kanban { grid-template-columns:1fr; } }
        .kanban-col { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:12px; }
        .kanban-head { display:flex; flex-direction:column; gap:2px; border-left:3px solid; padding-left:9px; margin-bottom:12px;
          font-family:'Space Grotesk'; font-weight:600; font-size:13.5px; }
        .kanban-card { display:block; width:100%; text-align:left; background:var(--panel-2); border:1px solid var(--line);
          border-radius:8px; padding:10px; margin-bottom:9px; cursor:pointer; }
        .kanban-card-top { display:flex; justify-content:space-between; font-family:'Space Grotesk'; font-weight:700; font-size:12.5px; margin-bottom:4px; }
        .zone-code-sm { font-family:'Space Grotesk'; font-size:11px; color:var(--ink-soft); }
        .kanban-card-name { font-size:12.5px; font-weight:600; margin-bottom:6px; }
        .kanban-card-foot { margin-top:6px; }

        .analytics { display:flex; flex-direction:column; gap:16px; }
        .stat-cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        @media (max-width: 800px) { .stat-cards { grid-template-columns:1fr 1fr; } }
        .stat-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:3px; }
        .stat-card-num { font-family:'Space Grotesk'; font-weight:700; font-size:22px; }
        .stat-card-lab { font-size:11.5px; color:var(--ink-soft); }
        .chart-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:16px; }
        @media (max-width: 900px) { .chart-grid { grid-template-columns:1fr; } }
        .chart-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
        .chart-title { font-family:'Space Grotesk'; font-weight:600; font-size:13px; margin-bottom:6px; }

        .reports { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .reports-head { display:flex; justify-content:space-between; margin-bottom:10px; font-family:'Space Grotesk'; font-weight:600; font-size:13.5px; }
        .report-table { width:100%; min-width:540px; border-collapse:collapse; font-size:12.5px; }
        .report-table th { text-align:left; font-size:11px; color:var(--ink-soft); font-weight:600; padding:7px 8px; border-bottom:1px solid var(--line); }
        .report-table td { padding:9px 8px; border-bottom:1px solid var(--panel-2); vertical-align:middle; }

        /* ======================================================================
           CITIZEN RESILIENCE PORTAL (SATELLITE GIS & ACCESSIBLE FEATURES)
           ====================================================================== */
        .citizen-page { display:flex; flex-direction:column; gap:18px; }
        .citizen-welcome { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; padding:4px 0 16px; border-bottom:1px solid var(--line); flex-wrap:wrap; }
        .citizen-welcome h1 { color:var(--brand); font:700 28px/1.08 'Space Grotesk'; margin:6px 0 5px; }
        .citizen-welcome p { font-size:12.5px; margin:0; }
        .citizen-trust { display:flex; align-items:center; gap:6px; color:var(--safe); font-size:11px; font-weight:600; border:1px solid #b9dcca; background:#eff9f2; border-radius:18px; padding:7px 10px; white-space:nowrap; }

        .citizen-access-bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .citizen-tts-btn { display:flex; align-items:center; gap:7px; background:var(--panel); border:1.5px solid var(--brand-2); color:var(--brand);
          border-radius:8px; padding:7px 12px; font-weight:600; font-size:12px; cursor:pointer; transition:all .2s ease; }
        .citizen-tts-btn:hover { background:var(--panel-2); transform:translateY(-1px); }
        .citizen-tts-btn.is-speaking { background:#fef2f2; border-color:#dc2626; color:#dc2626; box-shadow:0 0 0 4px rgba(220,38,38,0.18); }

        .audio-wave { display:inline-flex; align-items:center; gap:2.5px; height:12px; margin-left:4px; }
        .audio-wave span { width:2.5px; height:100%; background:#dc2626; border-radius:1px; animation:wave-anim 0.8s ease-in-out infinite alternate; }
        .audio-wave span:nth-child(2) { animation-delay:0.2s; height:60%; }
        .audio-wave span:nth-child(3) { animation-delay:0.4s; height:80%; }

        .font-scale-controls { display:flex; align-items:center; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:2px; }
        .font-scale-btn { border:none; background:transparent; padding:4px 8px; font-size:11px; font-weight:700; border-radius:5px; cursor:pointer; color:var(--ink-soft); }
        .font-scale-btn.is-active { background:var(--brand); color:#fff; }
        
        .font-scale-large p, .font-scale-large span, .font-scale-large div, .font-scale-large select, .font-scale-large textarea { font-size:112% !important; line-height:1.55 !important; }
        .font-scale-large h1 { font-size:32px !important; }
        .font-scale-large h4 { font-size:18px !important; }
        .font-scale-xlarge p, .font-scale-xlarge span, .font-scale-xlarge div, .font-scale-xlarge select, .font-scale-xlarge textarea { font-size:124% !important; line-height:1.65 !important; }
        .font-scale-xlarge h1 { font-size:35px !important; }
        .font-scale-xlarge h4 { font-size:20px !important; }

        /* 1-Tap Emergency SOS Strip */
        .citizen-sos-strip { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:4px; }
        .citizen-sos-card { background:#fff7f7; border:1px solid #fecaca; border-left:4px solid #dc2626; border-radius:9px; padding:10px 12px;
          display:flex; justify-content:space-between; align-items:center; text-decoration:none; transition:all .2s ease; }
        .citizen-sos-card:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(220,38,38,0.15); border-color:#dc2626; }
        .citizen-sos-info strong { display:block; font-family:'Space Grotesk'; font-size:16px; font-weight:800; color:#dc2626; letter-spacing:0.5px; }
        .citizen-sos-info span { font-size:10.5px; color:var(--ink-soft); font-weight:500; }
        .citizen-sos-badge { background:#dc2626; color:#fff; font-size:10px; font-weight:700; padding:4px 8px; border-radius:6px; display:flex; align-items:center; gap:4px; }

        /* Satellite Map Box */
        .citizen-map-box { background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.04); }
        .citizen-map-header { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--panel-2); border-bottom:1px solid var(--line); flex-wrap:wrap; gap:8px; }
        .citizen-map-title { display:flex; align-items:center; gap:7px; font-family:'Space Grotesk'; font-size:12.5px; font-weight:700; color:var(--brand); }
        .citizen-map-actions { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
        .citizen-map-btn { display:flex; align-items:center; gap:5px; background:var(--panel); border:1px solid var(--line); color:var(--brand);
          font-size:11px; font-weight:600; padding:5px 9px; border-radius:6px; cursor:pointer; transition:all .15s ease; }
        .citizen-map-btn:hover { background:#eef4f8; border-color:var(--brand-2); }
        .citizen-map-btn.is-accent { background:#eef9f3; border-color:#10b981; color:#059669; }
        .citizen-tile-pills { display:flex; background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:2px; }
        .citizen-tile-pills button { border:none; background:transparent; padding:4px 8px; font-size:10.5px; font-weight:600; border-radius:4px; cursor:pointer; color:var(--ink-soft); }
        .citizen-tile-pills button.is-active { background:var(--brand); color:#fff; }
        
        .citizen-map-frame { position:relative; }
        .citizen-map-legend { position:absolute; bottom:12px; left:12px; z-index:400; background:rgba(255,255,255,0.92); backdrop-filter:blur(6px);
          border:1px solid var(--line); border-radius:7px; padding:6px 10px; display:flex; flex-direction:column; gap:4px; font-size:10.5px; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
        .citizen-legend-item { display:flex; align-items:center; gap:6px; color:var(--brand); font-weight:500; }
        .legend-dot { width:9px; height:9px; border-radius:50%; display:inline-block; border:1px solid rgba(255,255,255,0.8); }
        .legend-line { width:16px; height:0; border-top:3px dashed #10b981; display:inline-block; }

        /* Citizen Grid */
        .citizen-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
        @media (max-width: 960px) { .citizen-grid { grid-template-columns:1fr; } }
        
        /* Zone Card */
        .citizen-zone-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; margin-top:14px; }
        .citizen-zone-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .citizen-zone-card h4 { font-family:'Space Grotesk'; font-size:16px; margin:4px 0 6px; }
        .citizen-risk-row { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-top:14px; }
        .citizen-risk-row div { border-top:1px solid var(--line); padding-top:7px; }
        .citizen-risk-row strong { display:block; color:var(--brand); font:700 18px 'Space Grotesk'; }
        .citizen-risk-row span { color:var(--ink-soft); font-size:10px; }
        .citizen-action-note { margin-top:14px; border-left:3px solid var(--immediate); padding-left:10px; color:var(--brand); font-size:11.5px; line-height:1.45; background:#fff8f7; padding:8px 10px; border-radius:0 6px 6px 0; }
        .citizen-action-note span { display:block; color:var(--immediate); font:700 9.5px 'Space Grotesk'; letter-spacing:.08em; margin-bottom:2px; }

        /* Shelter Card */
        .citizen-shelter-card { background:#f6fcf8; border:1px solid #b9dcca; border-radius:10px; padding:15px; }
        .shelter-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; }
        .shelter-title { font-family:'Space Grotesk'; font-size:13.5px; font-weight:700; color:#059669; display:flex; align-items:center; gap:6px; }
        .shelter-badge { background:#10b981; color:#fff; font-size:9.5px; font-weight:700; padding:2px 7px; border-radius:4px; text-transform:uppercase; }
        .shelter-kpis { display:flex; gap:16px; font-size:11.5px; margin-bottom:10px; color:var(--ink-soft); flex-wrap:wrap; }
        .shelter-kpis strong { color:var(--brand); }
        .shelter-amenities { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        .shelter-amenity-pill { background:#e8f7ee; border:1px solid #c2ebd1; color:#065f46; font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:6px; display:flex; align-items:center; gap:4px; }

        /* Hazard Dos and Donts */
        .citizen-dodonts-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:15px; margin-top:14px; }
        .dodonts-head { font-family:'Space Grotesk'; font-size:13.5px; font-weight:700; color:var(--brand); margin-bottom:10px; display:flex; align-items:center; gap:6px; }
        .dodonts-cols { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media (max-width: 600px) { .dodonts-cols { grid-template-columns:1fr; } }
        .dos-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:7px; padding:10px; }
        .donts-box { background:#fef2f2; border:1px solid #fecaca; border-radius:7px; padding:10px; }
        .dos-box h5 { color:#15803d; font-size:11.5px; font-weight:700; margin:0 0 6px; display:flex; align-items:center; gap:4px; }
        .donts-box h5 { color:#b91c1c; font-size:11.5px; font-weight:700; margin:0 0 6px; display:flex; align-items:center; gap:4px; }
        .dos-box ul, .donts-box ul { margin:0; padding-left:16px; font-size:11px; line-height:1.45; color:var(--brand); }
        .dos-box li, .donts-box li { margin-bottom:4px; }

        /* 72-Hour Preparedness Checklist */
        .citizen-checklist-card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
        .checklist-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .checklist-title { font-family:'Space Grotesk'; font-size:14px; font-weight:700; color:var(--brand); display:flex; align-items:center; gap:6px; }
        .checklist-progress-wrap { margin-bottom:12px; }
        .checklist-bar-bg { height:8px; background:var(--line); border-radius:4px; overflow:hidden; margin-top:5px; }
        .checklist-bar-fill { height:100%; background:linear-gradient(90deg, #1e7890, #10b981); transition:width .3s ease; }
        .checklist-items { display:flex; flex-direction:column; gap:7px; }
        .checklist-item { display:flex; align-items:center; gap:9px; background:var(--panel-2); padding:8px 10px; border-radius:7px; font-size:11.5px;
          cursor:pointer; user-select:none; transition:background .15s ease; border:1px solid transparent; }
        .checklist-item:hover { background:#edf3f7; }
        .checklist-item.is-packed { border-color:#bbf7d0; background:#f0fdf4; color:#15803d; }
        .checklist-checkbox { width:17px; height:17px; border-radius:4px; border:1.5px solid var(--line); display:flex; align-items:center; justify-content:center;
          background:#fff; flex-shrink:0; font-size:11px; }
        .checklist-item.is-packed .checklist-checkbox { background:#10b981; border-color:#10b981; color:#fff; }

        /* Feedback / Report Panel */
        .feedback-panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; }
        .quick-tags-wrap { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 10px; }
        .quick-tag-pill { background:var(--panel-2); border:1px solid var(--line); border-radius:6px; padding:5px 9px; font-size:11px;
          cursor:pointer; color:var(--brand); transition:all .15s ease; }
        .quick-tag-pill:hover { border-color:var(--brand-2); background:#eef4f8; }
        .quick-tag-pill.is-selected { background:var(--brand); border-color:var(--brand); color:#fff; font-weight:600; }
        
        .urgency-toggle { display:flex; gap:6px; margin-bottom:10px; }
        .urgency-btn { flex:1; border:1px solid var(--line); background:var(--panel-2); padding:6px 8px; border-radius:6px; font-size:11px;
          cursor:pointer; text-align:center; font-weight:600; transition:all .15s ease; }
        .urgency-btn.is-high { background:#fef2f2; border-color:#fca5a5; color:#dc2626; }
        .urgency-btn.is-mod { background:#fffbeb; border-color:#fde68a; color:#d97706; }
        .urgency-btn.is-info { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
        
        .ticket-alert-box { background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px 12px; margin-bottom:12px;
          color:#15803d; font-size:11.5px; display:flex; align-items:center; gap:8px; }

        /* Alert Subscribe Card */
        .citizen-sub-card { background:linear-gradient(135deg, #f7fafc, #edf5f8); border:1px solid var(--line); border-radius:10px; padding:14px; }
        .sub-preview-box { background:#ffffff; border:1px dashed var(--line); border-radius:7px; padding:9px 11px; font-size:10.5px;
          color:var(--ink-soft); margin-top:10px; line-height:1.45; }
        .sub-preview-box strong { color:var(--brand); }

        .lang-row { display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
        .lang-toggle { display:flex; background:var(--panel); border:1px solid var(--line); border-radius:7px; padding:2px; }
        .lang-toggle button { border:none; background:transparent; padding:5px 10px; font-size:11.5px; border-radius:5px; cursor:pointer; }
        .lang-toggle button.is-on { background:var(--brand); color:#eef1e8; }

        .feedback-form { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
        .feedback-form select, .feedback-form textarea { font-family:'Inter'; font-size:12.5px; border:1px solid var(--line);
          border-radius:7px; padding:8px 10px; background:#fdfcf6; resize:vertical; }
        .feedback-form button { align-self:flex-start; }
        .feedback-list { display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto; }
        .feedback-item { background:var(--panel-2); border-radius:7px; padding:9px 10px; }
        .feedback-item-head { display:flex; justify-content:space-between; margin-bottom:4px; }
        .feedback-category { color:var(--brand-2); font-size:10px; margin-left:8px; }
        .feedback-item p { font-size:12px; margin:0; line-height:1.4; }

        .toast { position:fixed; bottom:20px; right:20px; background:var(--brand); color:#eef1e8; padding:10px 16px;
          border-radius:8px; font-size:12.5px; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:60; display:flex; align-items:center; gap:8px; }

        /* ====== INLINE RELOCATION CARD (in detail panel sidebar) ====== */
        .reloc-inline-card {
          margin-top: 14px; padding: 12px; border-radius: 10px;
          background: linear-gradient(135deg, #e8f8ef 0%, #eef4f7 100%);
          border: 1.5px solid var(--safe);
          animation: relocCardFadeIn 0.4s ease;
        }
        @keyframes relocCardFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reloc-inline-header {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Space Grotesk'; font-weight: 700; font-size: 11.5px;
          color: var(--safe); text-transform: uppercase; letter-spacing: 0.4px;
          margin-bottom: 10px;
        }
        .reloc-inline-route {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 8px;
        }
        .reloc-inline-from, .reloc-inline-to {
          display: flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 600; flex: 1; min-width: 0;
        }
        .reloc-inline-from span:last-child, .reloc-inline-to span:last-child {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .reloc-inline-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          box-shadow: 0 0 4px currentColor;
        }
        .reloc-inline-meta {
          display: flex; gap: 6px; font-size: 10.5px; color: var(--ink-soft);
          margin-bottom: 10px;
        }
        .reloc-inline-btn {
          width: 100%; justify-content: center; padding: 8px 12px; font-size: 11.5px;
          background: linear-gradient(135deg, var(--safe), var(--brand-2));
          border-color: var(--safe);
        }
        .reloc-inline-btn:hover { filter: brightness(1.1); }

        /* ====== RELOCATION ARROW ANIMATIONS ====== */
        @keyframes drawArrow {
          from { stroke-dashoffset: 20; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulseRing {
          0% { r: 3; opacity: 0.7; }
          100% { r: 6; opacity: 0; }
        }
        @keyframes pulseRingOuter {
          0% { r: 5; opacity: 0.4; }
          100% { r: 9; opacity: 0; }
        }
        @keyframes pulseSource {
          0% { opacity: 0.6; }
          50% { opacity: 0.15; }
          100% { opacity: 0.6; }
        }
        .reloc-arrow-path {
          animation: drawArrow 1.2s linear infinite;
        }
        .reloc-dest-pulse {
          animation: pulseRing 1.6s ease-out infinite;
        }
        .reloc-dest-pulse-outer {
          animation: pulseRingOuter 1.6s ease-out infinite 0.3s;
        }
        .reloc-source-pulse {
          animation: pulseSource 1.4s ease-in-out infinite;
        }

        /* ====== RELOCATION PANEL ====== */
        .reloc-panel-overlay {
          position: fixed; inset: 0; background: rgba(22,33,26,0.55);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px; backdrop-filter: blur(2px);
        }
        .reloc-panel {
          background: #fdfcf6; border-radius: 14px; padding: 24px;
          max-width: 600px; width: 100%; position: relative;
          box-shadow: 0 24px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05);
          max-height: 90vh; overflow-y: auto;
          animation: panelSlideIn 0.35s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes panelSlideIn {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .reloc-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 18px; padding-bottom: 14px;
          border-bottom: 1px solid var(--line);
        }
        .reloc-header-icon { color: var(--brand-2); }
        .reloc-kicker {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--ink-soft); font-weight: 600;
        }
        .reloc-title {
          font-family: 'Space Grotesk'; font-weight: 700; font-size: 17px;
          margin: 2px 0 0; color: var(--ink);
        }

        /* Route visualization */
        .reloc-route {
          display: flex; align-items: stretch; gap: 0;
          background: var(--panel-2); border: 1px solid var(--line);
          border-radius: 10px; padding: 14px; margin-bottom: 16px;
          position: relative;
        }
        .reloc-route-from, .reloc-route-to {
          flex: 1; display: flex; gap: 10px; align-items: flex-start;
        }
        .reloc-route-dot {
          width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
          margin-top: 3px; box-shadow: 0 0 6px currentColor;
        }
        .reloc-route-label {
          font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px;
          font-weight: 700; color: var(--ink-soft); margin-bottom: 2px;
        }
        .reloc-route-name {
          font-family: 'Space Grotesk'; font-weight: 700; font-size: 14px;
          color: var(--ink); line-height: 1.2;
        }
        .reloc-route-sub { font-size: 11px; color: var(--ink-soft); margin: 2px 0 4px; }
        .reloc-route-pop { font-size: 11.5px; color: var(--immediate); }
        .reloc-route-arrow {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 4px; padding: 0 14px;
          color: var(--brand-2); min-width: 70px;
        }
        .reloc-route-arrow span { font-size: 10px; font-weight: 600; white-space: nowrap; }

        /* Carrying capacity */
        .reloc-capacity {
          margin-bottom: 16px; padding: 14px;
          border: 1px solid var(--line); border-radius: 10px;
        }
        .reloc-section-head {
          display: flex; align-items: center; gap: 6px;
          font-family: 'Space Grotesk'; font-weight: 700; font-size: 13px;
          color: var(--brand); margin-bottom: 12px;
        }
        .reloc-cap-stats {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
          margin-bottom: 12px;
        }
        .reloc-cap-stats > div {
          background: var(--panel-2); border-radius: 8px; padding: 10px;
          text-align: center;
        }
        .reloc-cap-num {
          display: block; font-family: 'Space Grotesk'; font-weight: 700;
          font-size: 18px; color: var(--ink);
        }
        .reloc-cap-lab { font-size: 10px; color: var(--ink-soft); }
        .reloc-cap-bar-wrap { margin-top: 8px; }
        .reloc-cap-bar-row {
          display: flex; justify-content: space-between;
          font-size: 10.5px; color: var(--ink-soft); margin-bottom: 5px;
        }
        .reloc-cap-bar-track {
          height: 10px; background: var(--panel-2); border-radius: 5px;
          position: relative; overflow: hidden;
        }
        .reloc-cap-bar-fill {
          position: absolute; top: 0; left: 0; height: 100%;
          border-radius: 5px; transition: width 0.8s cubic-bezier(.2,.8,.2,1);
        }
        .reloc-cap-current {
          background: var(--brand-2); opacity: 0.4; z-index: 1;
        }
        .reloc-cap-projected {
          background: linear-gradient(90deg, var(--brand-2), var(--safe));
          z-index: 2;
        }
        .reloc-cap-warn {
          display: flex; align-items: center; gap: 5px; margin-top: 6px;
          font-size: 10.5px; color: var(--immediate); font-weight: 600;
        }

        /* Facilities grid */
        .reloc-facilities { margin-bottom: 16px; }
        .reloc-fac-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
        }
        @media (max-width: 500px) { .reloc-fac-grid { grid-template-columns: repeat(2, 1fr); } }
        .reloc-fac-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 10px; padding: 12px; text-align: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .reloc-fac-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .reloc-fac-icon {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 8px;
        }
        .reloc-fac-count {
          font-family: 'Space Grotesk'; font-weight: 700; font-size: 18px;
          color: var(--ink);
        }
        .reloc-fac-type {
          font-size: 10.5px; color: var(--ink-soft); font-weight: 600;
          margin-bottom: 4px;
        }
        .reloc-fac-names {
          display: flex; flex-direction: column; gap: 1px;
        }
        .reloc-fac-names span {
          font-size: 9.5px; color: var(--ink-soft); line-height: 1.3;
        }

        /* Actions */
        .reloc-actions {
          display: flex; gap: 10px; padding-top: 14px;
          border-top: 1px solid var(--line);
        }
        /* 3D & 2D Map styles */
        .terrain-canvas { width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--line); }
        .terrain-canvas canvas { display:block; width:100% !important; }
        .terrain-fallback { display:flex; align-items:center; justify-content:center; gap:8px; background:var(--panel-2);
          border:1px solid var(--line); border-radius:10px; color:var(--ink-soft); font-size:13px; }
        .terrain-decision-overlay { position:absolute; left:14px; bottom:14px; z-index:3; width:270px; padding:11px 12px; background:rgba(255,253,247,.94); border:1px solid var(--line); border-left:3px solid var(--brand-2); border-radius:8px; box-shadow:0 8px 22px rgba(23,43,53,.16); backdrop-filter:blur(6px); }
        .terrain-overlay-kicker { display:flex; align-items:center; gap:6px; color:var(--brand-2); font:700 9px 'Space Grotesk'; letter-spacing:.08em; margin-bottom:6px; }
        .terrain-overlay-kicker .live-dot { width:5px; height:5px; }
        .terrain-overlay-title { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
        .terrain-overlay-title strong { color:var(--brand); font:600 13px 'Space Grotesk'; }
        .terrain-overlay-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin:10px 0; }
        .terrain-overlay-grid div { border-top:1px solid var(--line); padding-top:6px; }
        .terrain-overlay-grid strong { display:block; color:var(--brand); font:700 18px 'Space Grotesk'; }
        .terrain-overlay-grid span { color:var(--ink-soft); font-size:9px; }
        .terrain-next-step { border-top:1px solid var(--line); padding-top:7px; color:var(--ink-soft); font-size:10px; line-height:1.4; }
        .terrain-next-step span { display:block; color:var(--immediate); font:700 9px 'Space Grotesk'; letter-spacing:.08em; margin-bottom:2px; }

        .risk-map-wrap { position:relative; flex:1; border:1px solid var(--line); border-radius:10px; overflow:hidden; background:#dfe6dc; }
        .risk-map { width:100%; height:100%; z-index:0; }
        .risk-map .leaflet-control-zoom { border:1px solid var(--line); box-shadow:0 3px 10px rgba(31,58,52,.12); }
        /* ============================================================
           COMPREHENSIVE MOBILE MEDIA QUERIES FOR DASHBOARD
           ============================================================ */

        /* --- Tablets & small screens (≤ 768px) --- */
        @media (max-width: 768px) {
          /* Header */
          .header { padding: 10px 14px; gap: 10px; }
          .header .brand-name { font-size: 15px !important; }
          .header .brand-tag { font-size: 10px !important; }
          .header-controls { gap: 6px; width: 100%; justify-content: space-between; }
          .header-controls select { font-size: 11.5px; padding: 5px 8px; flex: 1; min-width: 0; }
          .role-toggle button { font-size: 11.5px; padding: 5px 9px; }

          /* Nav tabs */
          .nav-tabs { padding: 0 10px; gap: 0; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
          .nav-tabs::-webkit-scrollbar { display: none; }
          .nav-tabs button { padding: 10px 10px; font-size: 11.5px; flex-shrink: 0; }

          /* Body */
          .body { padding: 12px 10px 36px; }

          /* Scenario Lab */
          .scenario-lab { padding: 12px 14px; gap: 12px; }
          .scenario-copy h2 { font-size: 16px; }
          .scenario-results strong { font-size: 18px; }

          /* Map toggle */
          .map-toggle { display: flex; flex-wrap: wrap; gap: 4px; width: 100%; }
          .map-toggle button { flex: 1 1 calc(50% - 4px); justify-content: center; font-size: 11px; padding: 6px 8px; }

          /* Map dimensions */
          .map-stage { min-height: 340px !important; }
          .terrain-decision-overlay { left: 8px; bottom: 8px; width: calc(100% - 16px); }

          /* Detail panel & action row */
          .detail-panel { padding: 14px; }
          .stat-grid { grid-template-columns: 1fr 1fr; }
          .action-row { flex-direction: column; }
          .action-row button { width: 100%; justify-content: center; }

          /* Relocation Card (Inline) */
          .reloc-inline-route { flex-direction: column; align-items: stretch; gap: 6px; }
          .reloc-inline-from, .reloc-inline-to { width: 100%; }

          /* Relocation Modal */
          .reloc-panel-overlay { padding: 8px; }
          .reloc-panel { padding: 16px; max-height: 94vh; border-radius: 12px; }
          .reloc-route { flex-direction: column; gap: 10px; padding: 10px; }
          .reloc-route-arrow { flex-direction: row; gap: 6px; min-width: auto; }
          .reloc-cap-stats { grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .reloc-cap-stats > div { padding: 8px 6px; }
          .reloc-cap-num { font-size: 16px; }
          .reloc-fac-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
          .reloc-actions { flex-direction: column; }
          .reloc-actions button { width: 100%; justify-content: center; }

          /* Certificate Modal */
          .modal-overlay { padding: 8px; }
          .certificate { padding: 16px 14px; border-radius: 10px; max-height: 94vh; overflow-y: auto; }
          .cert-table { font-size: 11.5px; }

          /* Kanban */
          .kanban { grid-template-columns: 1fr; gap: 10px; }

          /* Analytics */
          .stat-cards { grid-template-columns: 1fr 1fr; gap: 8px; }
          .stat-card-num { font-size: 20px; }
          .chart-grid { grid-template-columns: 1fr; }

          /* Citizen Portal */
          .citizen-page { gap: 12px; }
          .citizen-welcome { flex-direction: column; align-items: flex-start; gap: 10px; padding-bottom: 12px; }
          .citizen-welcome h1 { font-size: 22px; }
          .citizen-access-bar { width: 100%; gap: 8px; }
          .citizen-tts-btn { width: 100%; justify-content: center; }
          .font-scale-controls { width: 100%; justify-content: center; }
          .citizen-sos-strip { grid-template-columns: 1fr 1fr; gap: 8px; }
          .citizen-sos-card { padding: 8px 10px; }
          .citizen-sos-info strong { font-size: 14px; }
          .citizen-map-header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .citizen-map-actions { width: 100%; justify-content: space-between; flex-wrap: wrap; }
          .citizen-grid { grid-template-columns: 1fr; gap: 12px; }
          .citizen-risk-row { grid-template-columns: repeat(3, 1fr); gap: 6px; }
          .dodonts-cols { grid-template-columns: 1fr; }
          .checklist-item { padding: 10px 12px; font-size: 11.5px; }
          .quick-tags-wrap { gap: 5px; }
          .urgency-toggle { gap: 4px; }
          .feedback-form select, .feedback-form textarea { width: 100%; }

          /* Toast */
          .toast { bottom: 12px; right: 12px; left: 12px; justify-content: center; font-size: 11.5px; padding: 8px 12px; }
        }

        /* --- Phones (≤ 480px) --- */
        @media (max-width: 480px) {
          .header { padding: 8px 10px; }
          .header .brand-name { font-size: 13px !important; }
          .header .brand-tag { display: none !important; }
          .header-controls { width: 100%; justify-content: space-between; }
          .header-controls select { flex: 1; min-width: 0; font-size: 10.5px; }
          .role-toggle button { font-size: 10px; padding: 4px 7px; }

          .nav-tabs { padding: 0 6px; }
          .nav-tabs button { padding: 8px 8px; font-size: 10.5px; }

          .body { padding: 8px 6px 30px; }

          .scenario-results { grid-template-columns: 1fr 1fr; gap: 4px; }
          .scenario-results strong { font-size: 15px; }
          .scenario-results span { font-size: 9px; }

          .map-stage { min-height: 280px !important; }

          .stat-cards { grid-template-columns: 1fr 1fr; gap: 6px; }
          .stat-card { padding: 10px 8px; }
          .stat-card-num { font-size: 18px; }

          .citizen-sos-strip { grid-template-columns: 1fr 1fr; gap: 6px; }
          .citizen-sos-info strong { font-size: 13px; }
          .citizen-sos-info span { font-size: 9.5px; }
          .citizen-risk-row strong { font-size: 15px; }

          .reloc-cap-stats { grid-template-columns: 1fr 1fr; }
          .reloc-fac-grid { grid-template-columns: 1fr; }

          .zone-row-name { font-size: 11.5px; }
        }

        /* --- Very small phones (≤ 360px) --- */
        @media (max-width: 360px) {
          .citizen-sos-strip { grid-template-columns: 1fr; }
          .scenario-results { grid-template-columns: 1fr; }
          .stat-cards { grid-template-columns: 1fr; }
          .reloc-cap-stats { grid-template-columns: 1fr; }
          .map-toggle button { flex: 1 1 100%; }
        }

        /* ------------------------------------------------------------- */
        /* PRINT ISOLATION: PRINT ONLY THE REPORT / CERTIFICATE          */
        /* ------------------------------------------------------------- */
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 12mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          .modal-overlay,
          .modal-overlay * {
            visibility: visible !important;
          }

          .modal-overlay {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 9999999 !important;
            display: block !important;
          }

          .certificate {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 8mm 12mm !important;
            border: 1.5px solid #143b5d !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .modal-close,
          .cert-actions,
          .cert-print,
          .cert-generating,
          header,
          .header,
          nav,
          .overview-layout,
          .chatbot-container,
          .cookie-banner {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      <header className="header">
        <div className="brand-wrap">
          <div className="brand-mark">BR</div>
          <div>
            <div className="brand-name" style={{ color: "#ffffff", letterSpacing: "0.5px" }}>BHOOMI RAKSHAK 2.0</div>
            <div className="brand-tag" style={{ color: "#d1ded8" }}>Hazard red-zone mapping & resettlement console · synthetic prototype data</div>
          </div>
        </div>
        <div className="header-controls">
          <select value={district} onChange={(e) => setDistrict(e.target.value)}>
            {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <div className="role-toggle">
            <button className={role === "authority" ? "is-on" : ""} onClick={() => setRole("authority")}>Authority</button>
            <button className={role === "citizen" ? "is-on" : ""} onClick={() => setRole("citizen")}>Citizen</button>
          </div>
        </div>
      </header>

      {role === "authority" && (
        <nav className="nav-tabs">
          {authorityTabs.map((t) => (
            <button key={t.id} className={tab === t.id ? "is-active" : ""} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      )}

      <div className="body">
        {role === "authority" && tab === "overview" && (
          <>
          <ScenarioLab zones={zones} scenario={scenario} setScenario={setScenario} hazardLift={hazardLift} setHazardLift={setHazardLift} />
          <div className="overview-layout">
            <ZoneList zones={scenarioZones} selectedId={selectedId} onSelect={handleSelectZone} />
            <div className="workspace-main" style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div className="map-toggle" style={{ display: "flex", background: "var(--panel-2)", padding: "3px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <button
                      onClick={() => setMapMode("globe")}
                      style={{
                        border: "none",
                        background: mapMode === "globe" ? "var(--brand)" : "transparent",
                        color: mapMode === "globe" ? "#fff" : "var(--ink)",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s"
                      }}
                    ><Globe size={13} /> 3D Earth Globe</button>
                    <button
                      onClick={() => setMapMode("risk")}
                      style={{
                        border: "none",
                        background: mapMode === "risk" ? "var(--brand)" : "transparent",
                        color: mapMode === "risk" ? "#fff" : "var(--ink)",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s"
                      }}
                    ><MapPin size={13} /> 2D GIS Map</button>
                    <button
                      onClick={() => setMapMode("3d")}
                      style={{
                        border: "none",
                        background: mapMode === "3d" ? "var(--brand)" : "transparent",
                        color: mapMode === "3d" ? "#fff" : "var(--ink)",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s"
                      }}
                    ><Move3d size={13} /> 3D Terrain</button>
                    <button
                      onClick={() => setMapMode("2d")}
                      style={{
                        border: "none",
                        background: mapMode === "2d" ? "var(--brand)" : "transparent",
                        color: mapMode === "2d" ? "#fff" : "var(--ink)",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s"
                      }}
                    ><Boxes size={13} /> 2D Grid Matrix</button>
                  </div>
                  {mapMode === "3d" && <span className="muted small" style={{ fontSize: "11px" }}>Drag to orbit · scroll to zoom · click pins</span>}
                </div>

                {/* Sub-toolbar: 3D Terrain Type & Steepness & Orbit */}
                {mapMode === "3d" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", background: "var(--panel)", padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", textTransform: "uppercase" }}>3D Terrain Type:</span>
                    <div style={{ display: "flex", background: "var(--panel-2)", padding: "2px", borderRadius: "6px", border: "1px solid var(--line)", flexWrap: "wrap", gap: "2px" }}>
                      {[
                        { id: "satellite", label: "🛰️ Satellite Surface" },
                        { id: "elevation", label: "⛰️ Topo Elevation" },
                        { id: "geology", label: "🌋 Hazard Matrix" },
                        { id: "radar", label: "📡 Night Radar" },
                        { id: "hydrology", label: "🌊 Hydrology Runoff" },
                        { id: "slope", label: "📐 Slope Steepness" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() => setTerrain3DStyle(st.id)}
                          style={{
                            border: "none",
                            background: terrain3DStyle === st.id ? "var(--brand)" : "transparent",
                            color: terrain3DStyle === st.id ? "#fff" : "var(--ink)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>

                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--ink-soft)", marginLeft: "4px" }}>Steepness:</span>
                    <div style={{ display: "flex", background: "var(--panel-2)", padding: "2px", borderRadius: "6px", border: "1px solid var(--line)", gap: "2px" }}>
                      {[
                        { val: 1.0, label: "1.0x Normal" },
                        { val: 1.8, label: "1.8x Steep" },
                        { val: 2.5, label: "2.5x Himalayan" },
                      ].map((ex) => (
                        <button
                          key={ex.val}
                          onClick={() => setTerrain3DExaggeration(ex.val)}
                          style={{
                            border: "none",
                            background: terrain3DExaggeration === ex.val ? "var(--brand-2)" : "transparent",
                            color: terrain3DExaggeration === ex.val ? "#fff" : "var(--ink-soft)",
                            padding: "4px 7px",
                            borderRadius: "4px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {ex.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setAutoRotate3D(!autoRotate3D)}
                      style={{
                        border: "1px solid var(--line)",
                        background: autoRotate3D ? "rgba(33, 132, 95, 0.12)" : "var(--panel-2)",
                        color: autoRotate3D ? "var(--safe)" : "var(--ink-soft)",
                        padding: "4px 8px",
                        borderRadius: "5px",
                        fontSize: "10.5px",
                        fontWeight: 600,
                        cursor: "pointer",
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="Toggle 3D Orbit Auto-Rotation"
                    >
                      {autoRotate3D ? "🔄 Orbiting" : "⏸️ Paused"}
                    </button>
                  </div>
                )}

                {/* Sub-toolbar: 2D GIS Basemap */}
                {mapMode === "risk" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", background: "var(--panel)", padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", textTransform: "uppercase" }}>2D Basemap Layer:</span>
                    <div style={{ display: "flex", background: "var(--panel-2)", padding: "2px", borderRadius: "6px", border: "1px solid var(--line)", flexWrap: "wrap", gap: "2px" }}>
                      {[
                        { id: "satellite", label: "🛰️ Satellite Imagery" },
                        { id: "terrain", label: "⛰️ Topographic Relief" },
                        { id: "standard", label: "🗺️ Standard Streets" },
                        { id: "dark", label: "🌑 Tactical Dark (Ops)" },
                        { id: "light", label: "🌐 Cadastral Light" },
                        { id: "relief", label: "🏔️ Shaded Relief" },
                      ].map((bm) => (
                        <button
                          key={bm.id}
                          onClick={() => setRisk2DStyle(bm.id)}
                          style={{
                            border: "none",
                            background: risk2DStyle === bm.id ? "var(--brand)" : "transparent",
                            color: risk2DStyle === bm.id ? "#fff" : "var(--ink)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {bm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-toolbar: 2D Grid Thematic Map */}
                {mapMode === "2d" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", background: "var(--panel)", padding: "7px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand)", textTransform: "uppercase" }}>2D Grid Thematic Map:</span>
                    <div style={{ display: "flex", background: "var(--panel-2)", padding: "2px", borderRadius: "6px", border: "1px solid var(--line)", flexWrap: "wrap", gap: "2px" }}>
                      {[
                        { id: "contours", label: "🏔️ Topographic Contours" },
                        { id: "hydrology", label: "🌊 Hydrology & Drainage" },
                        { id: "hazard", label: "⚠️ Slope Hazard Matrix" },
                        { id: "corridors", label: "🛣️ Evacuation Network" },
                      ].map((gs) => (
                        <button
                          key={gs.id}
                          onClick={() => setGrid2DStyle(gs.id)}
                          style={{
                            border: "none",
                            background: grid2DStyle === gs.id ? "var(--brand)" : "transparent",
                            color: grid2DStyle === gs.id ? "#fff" : "var(--ink)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          {gs.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Map Canvas / 3D Stage */}
              <div className="map-stage" style={{ position: "relative", minHeight: "440px", flex: 1, borderRadius: "10px", overflow: "hidden" }}>
                <AnimatePresence mode="wait">
                  <motion.div key={mapMode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} style={{ width: "100%", height: "100%" }}>
                    {mapMode === "globe" ? (
                      <Earth3D
                        zones={mapZones}
                        selectedIdRef={selectedIdRef}
                        onSelect={handleSelectZone}
                        height={440}
                      />
                    ) : mapMode === "risk" ? (
                      <RiskMap
                        zones={mapZones}
                        selectedId={selectedId}
                        onSelect={handleSelectZone}
                        selectTrigger={selectTrigger}
                        selectedLayers={selectedHazards}
                        fusionEnabled={fusionEnabled}
                        onToggleFusion={() => setFusionEnabled((c) => !c)}
                        onToggleLayer={(l) => setSelectedHazards((c) => ({ ...c, [l]: !c[l] }))}
                        relocationTarget={relocationTarget}
                        externalTile={risk2DStyle}
                        onTileChange={setRisk2DStyle}
                      />
                    ) : mapMode === "3d" ? (
                      <Terrain3D
                        zones={mapZones}
                        selectedIdRef={selectedIdRef}
                        onSelect={handleSelectZone}
                        interactive
                        height={440}
                        style={terrain3DStyle}
                        exaggeration={terrain3DExaggeration}
                        autoRotate={autoRotate3D}
                      />
                    ) : (
                      <MapCanvas
                        zones={mapZones}
                        selectedId={selectedId}
                        onSelect={handleSelectZone}
                        selectTrigger={selectTrigger}
                        visibleLayers={visibleLayers}
                        relocationTarget={relocationTarget}
                        gridStyle={grid2DStyle}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
                {mapMode === "3d" && <TerrainDecisionOverlay zone={selectedZone} />}
              </div>
            </div>
            <DetailPanel
              zone={selectedZone}
              role="authority"
              relocationTarget={relocationTarget}
              onShowRelocationPlan={() => setShowRelocPanel(true)}
              onCertificate={(z) => setCertZone(z)}
              onAlert={(z) => {
                setToast(`Community alert queued for ${z.id} (${lang === "hi" ? "हिन्दी" : "English"})`);
                fetch(buildApiUrl("/api/alert"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    zone_id: parseInt(z.id.replace(/\D/g, '')) || 0,
                    hazard_type: z.hazard,
                    phase: z.phase,
                    priority_score: z.priorityScore,
                    population: z.population,
                    message: "Alert triggered from dashboard."
                  })
                }).catch(e => console.error("Alert send failed", e));
              }}
            />
          </div>
          </>
        )}

        {role === "authority" && tab === "phasing" && <PhasingTab zones={scenarioZones} onSelect={(id) => { setSelectedId(id); setTab("overview"); }} />}
        {role === "authority" && tab === "reverse-insurance" && <ReverseInsurance zones={scenarioZones} initialZoneId={selectedId} />}
        {role === "authority" && tab === "fund-calculator" && <ClimateFundCalculator zones={scenarioZones} initialZoneId={selectedId} />}
        {role === "authority" && tab === "community-voice" && <CommunityVoice zones={scenarioZones} initialFeedback={feedback} onSubmitFeedback={(f) => { setFeedback([f, ...feedback]); setToast("Feedback submitted & queued for model retraining"); }} />}
        {role === "authority" && tab === "analytics" && <AnalyticsTab zones={scenarioZones} />}
        {role === "authority" && tab === "reports" && <ReportsTab zones={scenarioZones} onCertificate={(z) => setCertZone(z)} />}
        {role === "authority" && tab === "alerts" && <AlertsTab />}

        {role === "citizen" && (
          <CitizenTab
            zones={zones}
            selectedId={selectedId}
            onSelect={setSelectedId}
            feedback={feedback}
            onSubmitFeedback={(f) => { setFeedback([f, ...feedback]); setToast("Feedback submitted to district team"); }}
            lang={lang}
            setLang={setLang}
            subscribed={subscribed}
            onSubscribe={() => { setSubscribed(!subscribed); setToast(subscribed ? "Alerts turned off" : "Subscribed to voice & SMS alerts"); }}
            relocationTarget={relocationTarget}
          />
        )}
      </div>

      <CertificateModal zone={certZone} onClose={() => setCertZone(null)} />
      <RelocationPanel
        relocationTarget={showRelocPanel ? relocationTarget : null}
        onClose={() => setShowRelocPanel(false)}
        role={role}
        onApprove={(rt) => {
          setToast(`Relocation plan approved: ${rt.source.name} → ${rt.target.name}`);
          setShowRelocPanel(false);
        }}
      />
      {toast && <div className="toast"><CheckCircle2 size={14} /> {toast}</div>}
    </div>
  );
}
