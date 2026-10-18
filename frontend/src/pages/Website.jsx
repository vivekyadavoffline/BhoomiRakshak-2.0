import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
  useMap,
  Polyline,
  Tooltip as LeafletTooltip,
  Marker,
} from "react-leaflet";
import L from "leaflet";
import { useNavigate, useLocation } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  MapPin,
  Users,
  ShieldCheck,
  FileText,
  MessageSquare,
  X,
  Radio,
  Bell,
  Layers,
  Building2,
  Waves,
  Mountain,
  Printer,
  CheckCircle2,
  ClipboardList,
  ArrowLeft,
  ArrowRight,
  Boxes,
  Move3d,
  Landmark,
  Wallet,
  Scale,
  Cog,
  Satellite,
  Play,
  Pause,
  RotateCcw,
  Hospital,
  School,
  Flame,
  Droplets,
  Route,
  Navigation,
  Heart,
  Shield,
  Volume2,
  VolumeX,
  PhoneCall,
  CheckSquare,
  Square,
  Crosshair,
  AlertCircle,
  Info,
  Sparkles,
  Phone,
  Compass,
  LifeBuoy,
  Check,
  RefreshCw,
  Eye,
  Globe,
} from "lucide-react";

import { ZONES, DISTRICT_COORDS } from "../data/zonesData";
import bgVideo from "../background2.O.mp4";
import ReverseInsurance from "../components/ReverseInsurance";
import ClimateFundCalculator from "../components/ClimateFundCalculator";
import CommunityVoice from "../components/CommunityVoice";
import { buildApiUrl } from "../services/apiConfig";
import Earth3D from "../components/Earth3D";
import { fetchLiveWeatherData } from "../services/liveWeatherService";

function buildTinyFishSourceCards(rawResults) {
  const text =
    typeof rawResults === "string"
      ? rawResults
      : JSON.stringify(rawResults, null, 2);
  const firstSource = text.search(/\n\s*1\.\s/);
  const sourceText = firstSource >= 0 ? text.slice(firstSource + 1) : text;
  return sourceText
    .split(/\n(?=\d+\.\s)/)
    .filter(Boolean)
    .slice(0, 4)
    .map((section) => {
      const lines = section
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const title = (lines.shift() || "Live source").replace(/^\d+\.\s*/, "");
      const urlIndex = lines.findIndex((line) => /^https?:\/\//i.test(line));
      const url = urlIndex >= 0 ? lines.splice(urlIndex, 1)[0] : "";
      return { title, url, summary: lines.join(" ").slice(0, 180) };
    });
}

/* ======================================================================
  NATIONAL PLANNING DATA — Pan-India places across every region
   ====================================================================== */

const PHASES = ["Immediate", "Short-Term", "Medium-Term"];
const PHASE_COLOR = {
  Immediate: "var(--immediate)",
  "Short-Term": "var(--watch)",
  "Medium-Term": "var(--safe)",
};
const PHASE_HEX = {
  Immediate: 0xd45143,
  "Short-Term": 0xc78922,
  "Medium-Term": 0x21845f,
};
const DISTRICTS = [
  "All Districts",
  ...Array.from(new Set(ZONES.map((z) => z.district))).sort(),
];
const TOTAL_POP = ZONES.reduce((sum, zone) => sum + zone.population, 0);

const TERRAIN_SIZE = 60;
function gauss(nx, nz, cx, cz, radius, amplitude) {
  const dx = nx - cx,
    dz = nz - cz;
  return amplitude * Math.exp(-((dx * dx + dz * dz) / (2 * radius * radius)));
}
function terrainHeight(nx, nz) {
  let height = 0.25 * Math.sin(nx * 9) * Math.cos(nz * 9);
  height += gauss(nx, nz, 0.87, 0.35, 0.22, 7.5);
  height += gauss(nx, nz, 0.62, 0.12, 0.18, 5.0);
  height += gauss(nx, nz, 0.62, 0.58, 0.22, 5.0);
  height -= gauss(nx, nz, 0.18, 0.28, 0.2, 2.0);
  return height;
}
function buildTerrainGeometry(
  segments = 56,
  style = "satellite",
  exaggeration = 1.0,
) {
  const vertices = [];
  const colors = [];
  const rowLength = segments + 1;
  for (let row = 0; row <= segments; row++) {
    for (let column = 0; column <= segments; column++) {
      const nx = row / segments,
        nz = column / segments;
      const h = terrainHeight(nx, nz) * exaggeration;
      vertices.push((nx - 0.5) * TERRAIN_SIZE, h, (nz - 0.5) * TERRAIN_SIZE);

      const color = new THREE.Color();
      const normH = Math.max(
        0,
        Math.min(1, (h + 2.0 * exaggeration) / (9.0 * exaggeration)),
      );
      if (style === "elevation") {
        // Hypsometric elevation heatmap: lush valley -> foothills -> rock -> peak snow
        if (normH < 0.22) color.setHex(0x2d6a4f);
        else if (normH < 0.45) color.setHex(0x52b788);
        else if (normH < 0.68) color.setHex(0xf4a261);
        else if (normH < 0.85) color.setHex(0xe76f51);
        else if (normH < 0.95) color.setHex(0xd90429);
        else color.setHex(0xffffff);
      } else if (style === "geology") {
        // Geotechnical hazard & shear stress slip surface
        const slopeStress = Math.abs(Math.sin(nx * 12) * Math.cos(nz * 12));
        if (normH > 0.5 && slopeStress > 0.35)
          color.setHex(0xef4444); // critical rupture hazard
        else if (normH > 0.3)
          color.setHex(0xf59e0b); // moderate instability
        else color.setHex(0x475569); // stable basement rock
      } else if (style === "radar") {
        // Night tactical radar: deep dark slate with glowing blue-cyan gradient
        color.setHSL(0.57, 0.85, 0.08 + normH * 0.26);
      } else if (style === "hydrology") {
        // Hydrological flood runoff & drainage basins:
        if (normH < 0.28)
          color.setHex(0x0284c7); // river channels & flood water
        else if (normH < 0.42)
          color.setHex(0x38bdf8); // saturated drainage basin
        else if (normH < 0.68)
          color.setHex(0x2e6f40); // riparian slopes
        else color.setHex(0x78716c); // dry ridge rock
      } else if (style === "slope") {
        // Slope steepness analysis:
        const slopeMag =
          Math.abs(
            terrainHeight(nx + 0.02, nz) - terrainHeight(nx - 0.02, nz),
          ) +
          Math.abs(terrainHeight(nx, nz + 0.02) - terrainHeight(nx, nz - 0.02));
        if (slopeMag > 0.8)
          color.setHex(0xef4444); // >40 deg cliff
        else if (slopeMag > 0.5)
          color.setHex(0xf97316); // 25-40 deg steep slope
        else if (slopeMag > 0.25)
          color.setHex(0xeab308); // 15-25 deg moderate
        else color.setHex(0x22c55e); // <15 deg gentle safe terrain
      } else {
        // Natural photogrammetry satellite texture
        if (normH < 0.35)
          color.setHex(0x486b3e); // forest valley
        else if (normH < 0.65)
          color.setHex(0x7c735d); // soil & scrub slope
        else if (normH < 0.88)
          color.setHex(0x948e82); // alpine rock
        else color.setHex(0xededed); // snow peak
      }
      colors.push(color.r, color.g, color.b);
    }
  }
  const indices = [];
  for (let row = 0; row < segments; row++) {
    for (let column = 0; column < segments; column++) {
      const a = row * rowLength + column,
        b = a + 1,
        c = a + rowLength,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Terrain3D({
  zones,
  selectedIdRef,
  onSelect,
  interactive = true,
  height = 420,
  style = "satellite",
  exaggeration = 1.0,
  autoRotate = true,
}) {
  const containerRef = useRef(null);
  const [glFailed, setGlFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let renderer, animId, ro;
    let dragging = false,
      moved = 0,
      lastX = 0,
      lastY = 0;
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

      // Lighting: hemisphere + directional + fill
      scene.add(
        new THREE.AmbientLight(
          style === "radar" || style === "hydrology" ? 0x224466 : 0xfff5e0,
          style === "radar" ? 0.8 : 0.55,
        ),
      );
      const hemi = new THREE.HemisphereLight(
        0xfff4d0,
        0x8aaa7a,
        style === "radar" ? 0.3 : 0.5,
      );
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
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.5,
          metalness: 0.4,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.38,
        });
      } else if (style === "elevation") {
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.75,
          metalness: 0.1,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          wireframe: true,
          transparent: true,
          opacity: 0.16,
        });
      } else if (style === "geology") {
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.85,
          metalness: 0.08,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          wireframe: true,
          transparent: true,
          opacity: 0.26,
        });
      } else if (style === "hydrology") {
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.35,
          metalness: 0.2,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.25,
        });
      } else if (style === "slope") {
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.8,
          metalness: 0.1,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          wireframe: true,
          transparent: true,
          opacity: 0.2,
        });
      } else {
        terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          flatShading: true,
          side: THREE.DoubleSide,
          roughness: 0.88,
          metalness: 0.04,
        });
        wireMat = new THREE.MeshBasicMaterial({
          color: 0x9db88a,
          wireframe: true,
          transparent: true,
          opacity: 0.18,
        });
      }
      const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
      terrainMesh.receiveShadow = true;
      scene.add(terrainMesh);

      const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
      wireMesh.position.y += 0.02;
      scene.add(wireMesh);

      let pointLightCount = 0;
      zones.forEach((z) => {
        const nx = z.x / 100,
          nz = z.y / 100;
        const groundY = terrainHeight(nx, nz) * exaggeration;
        const worldX = (nx - 0.5) * TERRAIN_SIZE;
        const worldZ = (nz - 0.5) * TERRAIN_SIZE;
        const colorHex = PHASE_HEX[z.phase];
        const pinHeight = 1.8 + z.priorityScore / 12;

        // Tapered stem (cone shape)
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.12, pinHeight, 8),
          new THREE.MeshStandardMaterial({
            color: colorHex,
            roughness: 0.4,
            metalness: 0.3,
          }),
        );
        stem.position.set(worldX, groundY + pinHeight / 2, worldZ);
        stem.userData.zoneId = z.id;
        stem.castShadow = true;
        scene.add(stem);

        // Glowing sphere head
        const headRadius = z.phase === "Immediate" ? 0.65 : 0.52;
        const head = new THREE.Mesh(
          new THREE.SphereGeometry(headRadius, 18, 18),
          new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: z.phase === "Immediate" ? 0.55 : 0.28,
            roughness: 0.2,
            metalness: 0.1,
          }),
        );
        const baseY = groundY + pinHeight + headRadius;
        head.position.set(worldX, baseY, worldZ);
        head.userData.zoneId = z.id;
        head.castShadow = true;
        scene.add(head);

        // Small point light for critical pins (capped to avoid WebGL uniform overflow)
        if (z.phase === "Immediate" && pointLightCount < 4) {
          pointLightCount++;
          const ptLight = new THREE.PointLight(colorHex, 1.2, 8);
          ptLight.position.set(worldX, baseY, worldZ);
          scene.add(ptLight);
        }

        clickable.push(stem, head);
        markers[z.id] = { head, baseY };

        if (z.phase === "Immediate") {
          // Double ring pulse
          [0.8, 1.3].forEach((outerR, ri) => {
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(outerR * 0.75, outerR, 32),
              new THREE.MeshBasicMaterial({
                color: colorHex,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(worldX, groundY + 0.04, worldZ);
            scene.add(ring);
            pulses.push({
              mesh: ring,
              phase: Math.random() * Math.PI * 2 + ri * 1.2,
              speed: 1.8 + ri * 0.4,
            });
          });
        } else if (z.phase === "Short-Term") {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.55, 0.75, 24),
            new THREE.MeshBasicMaterial({
              color: colorHex,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.35,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(worldX, groundY + 0.04, worldZ);
          scene.add(ring);
          pulses.push({
            mesh: ring,
            phase: Math.random() * Math.PI * 2,
            speed: 1.2,
          });
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
        const dx = e.clientX - lastX,
          dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        cam.theta -= dx * 0.006;
        cam.phi = Math.min(1.4, Math.max(0.35, cam.phi - dy * 0.006));
        lastX = e.clientX;
        lastY = e.clientY;
        updateCamera();
      }
      function onUp(e) {
        if (dragging && moved < 6 && onSelect) {
          const rect = renderer.domElement.getBoundingClientRect();
          mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouseVec, camera);
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
        renderer.domElement.addEventListener("wheel", onWheel, {
          passive: false,
        });
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
          p.mesh.material.opacity =
            0.28 + 0.28 * Math.sin(t * (p.speed || 2) + p.phase);
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
        if (container.contains(renderer.domElement))
          container.removeChild(renderer.domElement);
      };
    } catch {
      setGlFailed(true);
      return undefined;
    }
  }, [zones, interactive, height, style, exaggeration, autoRotate]); // eslint-disable-line

  if (glFailed) {
    return (
      <div className="terrain-fallback" style={{ height }}>
        <Mountain size={18} /> 3D terrain view isn't supported in this browser.
      </div>
    );
  }
  return (
    <div ref={containerRef} className="terrain-canvas" style={{ height }} />
  );
}

/* ======================================================================
   SMALL SHARED HELPERS
   ====================================================================== */

function AnimatedBar({ value, max = 100, color, height = 8, trackKey }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    setW(0);
    const t = setTimeout(() => setW(Math.min(100, (value / max) * 100)), 60);
    return () => clearTimeout(t);
  }, [value, max, trackKey]);
  return (
    <div
      style={{
        height,
        background: "var(--line)",
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: color,
          transition: "width 700ms cubic-bezier(.2,.8,.2,1)",
        }}
      />
    </div>
  );
}
function PhaseBadge({ phase }) {
  return (
    <span
      className="badge"
      style={{
        background: `${PHASE_COLOR[phase]}1a`,
        color: PHASE_COLOR[phase],
        border: `1px solid ${PHASE_COLOR[phase]}55`,
      }}
    >
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

/* ======================================================================
   RELOCATION ROUTE & FACILITY LOGIC
   ====================================================================== */

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
  "District General Hospital",
  "Civil Hospital",
  "Community Health Centre",
  "Primary Health Centre",
  "Sub-District Hospital",
  "Emergency Trauma Centre",
  "Government Medical College & Hospital",
  "Rural Hospital",
  "ESI Hospital",
  "Cantonment Hospital",
  "Railway Hospital",
  "Municipal Multi-Speciality Hospital",
];
const SHELTER_NAMES = [
  "Government High School Shelter Complex",
  "District Community Hall",
  "Panchayat Bhawan Relief Centre",
  "State Stadium Emergency Camp",
  "Town Hall Flood Shelter",
  "ITI Training Centre Relief Hub",
  "Disaster Recovery Anganwadi Complex",
  "Red Cross Relief Base",
];
const FIRE_STATIONS = [
  "Central District Fire Station",
  "Sub-Divisional Fire Station",
  "Auxiliary Emergency Response Post",
  "State Disaster Response Force (SDRF) Base",
];

function generateFacilities(zone) {
  const rng = seededRandom((zone?.id || "z") + (zone?.district || ""));
  const pick = (arr, n) => {
    const shuffled = [...arr].sort(() => rng() - 0.5);
    return shuffled.slice(0, n);
  };

  const hospitalCount = Math.floor(rng() * 3) + 2;
  const shelterCount = Math.floor(rng() * 3) + 2;
  const fireCount = Math.floor(rng() * 2) + 1;
  const waterPoints = Math.floor(rng() * 6) + 4;
  const roadRating = Math.floor(rng() * 2) + 4;
  const totalCapacity = Math.floor(8000 + rng() * 35000);
  const bedsAvailable = Math.floor(rng() * 250) + 80;

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

  // Candidates for destination are ONLY safe green zones (Medium-Term)
  const greenZones = allZones.filter(
    (z) => z.phase === "Medium-Term" && z.id !== sourceZone.id,
  );
  if (greenZones.length === 0) return null;

  const getCoords = (z) => {
    const lat =
      z.lat ||
      (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][0] : 23.8);
    const lng =
      z.lng ||
      (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][1] : 79.1);
    return [lat, lng];
  };

  const haversineKm = (c1, c2) => {
    const R = 6371;
    const dLat = ((c2[0] - c1[0]) * Math.PI) / 180;
    const dLng = ((c2[1] - c1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((c1[0] * Math.PI) / 180) *
        Math.cos((c2[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const srcCoords = getCoords(sourceZone);

  // Filter to a responsive regional graph around the source zone (plus all green zones)
  const zonesWithDist = allZones.map((z) => ({
    zone: z,
    coords: getCoords(z),
    distToSrc: haversineKm(srcCoords, getCoords(z)),
  }));

  // Sort and select closest regional nodes + safe green zones to form the evacuation network
  const regionalItems = zonesWithDist
    .filter((zd) => zd.distToSrc <= 450 || zd.zone.phase === "Medium-Term")
    .sort((a, b) => a.distToSrc - b.distToSrc)
    .slice(0, 200);

  const nodeMap = new Map();
  regionalItems.forEach((item) => nodeMap.set(item.zone.id, item));
  if (!nodeMap.has(sourceZone.id)) {
    nodeMap.set(sourceZone.id, {
      zone: sourceZone,
      coords: srcCoords,
      distToSrc: 0,
    });
  }

  const nodes = Array.from(nodeMap.values());

  // Build Adjacency Graph:
  // Each node connects to its K=6 nearest neighbors in the evacuation network
  const adj = new Map();
  nodes.forEach((n) => adj.set(n.zone.id, []));

  for (let i = 0; i < nodes.length; i++) {
    const u = nodes[i];
    const distances = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const v = nodes[j];
      const d = haversineKm(u.coords, v.coords);
      distances.push({ target: v, dist: d });
    }
    distances.sort((a, b) => a.dist - b.dist);
    const neighbors = distances.slice(0, 6);
    neighbors.forEach((nb) => {
      // Dijkstra impedance weight: physical distance * hazard factor
      // Red = 1.6x, Yellow = 1.25x, Green = 1.0x (prefer safe paths)
      const hazardFactor =
        nb.target.zone.phase === "Immediate"
          ? 1.6
          : nb.target.zone.phase === "Short-Term"
            ? 1.25
            : 1.0;
      const weight = nb.dist * hazardFactor;
      adj.get(u.zone.id).push({
        node: nb.target.zone,
        coords: nb.target.coords,
        distKm: nb.dist,
        weight,
      });
    });
  }

  // Run Dijkstra's Algorithm
  const dist = new Map();
  const prev = new Map();
  const unvisited = new Set();

  nodes.forEach((n) => {
    dist.set(n.zone.id, Infinity);
    unvisited.add(n.zone.id);
  });
  dist.set(sourceZone.id, 0);

  let targetItem = null;

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
    // When the extracted node is a safe green zone, Dijkstra found the optimal destination!
    if (uId !== sourceZone.id && uNode.zone.phase === "Medium-Term") {
      targetItem = uNode;
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

  // Fallback if disconnected: find closest green zone by direct distance
  if (!targetItem) {
    const sortedGreens = greenZones
      .map((gz) => ({
        zone: gz,
        coords: getCoords(gz),
        distKm: haversineKm(srcCoords, getCoords(gz)),
      }))
      .sort((a, b) => a.distKm - b.distKm);
    const best = sortedGreens[0];
    return {
      source: sourceZone,
      target: best.zone,
      distKm: Math.max(1, Math.round(best.distKm * 10) / 10),
      srcCoords,
      tgtCoords: best.coords,
      path: [sourceZone, best.zone],
      hops: 1,
      algorithm: "Dijkstra (Direct)",
    };
  }

  // Reconstruct Dijkstra shortest path
  const path = [];
  let currId = targetItem.zone.id;
  let totalKm = 0;

  while (currId) {
    const nodeObj = nodeMap.get(currId);
    if (nodeObj) path.unshift(nodeObj.zone);
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

  const tgtCoords = getCoords(targetItem.zone);
  const directKm = haversineKm(srcCoords, tgtCoords);
  const actualKm =
    totalKm > 0
      ? Math.round(totalKm * 10) / 10
      : Math.round(directKm * 10) / 10;

  return {
    source: sourceZone,
    target: targetItem.zone,
    distKm: Math.max(1, actualKm),
    srcCoords,
    tgtCoords,
    path,
    hops: Math.max(1, path.length - 1),
    algorithm: "Dijkstra's Shortest Path",
  };
}

const findNearestSafeZone = findRelocationRouteDijkstra;

/* ---------------------------------------------------------------------- */
/*  PERMANENT SUSTAINABLE RELOCATION ENGINE                                */
/*  Selects the optimal destination site based on multi-factor sustainability */
/* ---------------------------------------------------------------------- */

function findPermanentRelocationSite(sourceZone, allZones) {
  if (!sourceZone || !allZones || allZones.length === 0) return null;

  // Candidates for permanent destination must be safe green zones (Medium-Term)
  const greenZones = allZones.filter(
    (z) => z.phase === "Medium-Term" && z.id !== sourceZone.id,
  );
  const candidates =
    greenZones.length > 0
      ? greenZones
      : allZones.filter((z) => z.id !== sourceZone.id);
  if (candidates.length === 0) return null;

  const getCoords = (z) => {
    const lat =
      z.lat ||
      (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][0] : 23.8);
    const lng =
      z.lng ||
      (DISTRICT_COORDS[z.district] ? DISTRICT_COORDS[z.district][1] : 79.1);
    return [lat, lng];
  };

  const haversineKm = (c1, c2) => {
    const R = 6371;
    const dLat = ((c2[0] - c1[0]) * Math.PI) / 180;
    const dLng = ((c2[1] - c1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((c1[0] * Math.PI) / 180) *
        Math.cos((c2[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const srcCoords = getCoords(sourceZone);

  // Score candidates based on 6 core sustainability dimensions
  const scored = candidates.map((z) => {
    const tgtCoords = getCoords(z);
    const distKm = haversineKm(srcCoords, tgtCoords);

    // Deterministic seed hash per zone
    const hash = Math.abs(
      z.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0),
    );

    // 1. Ecological & Hazard Safety (0-100)
    const ecoSafety = Math.min(
      100,
      Math.max(88, 99 - (z.priorityScore || 10) / 10),
    );
    // 2. Renewable Energy & Clean Water Grid (0-100)
    const waterEnergy = 88 + (hash % 11);
    // 3. Livelihood & Agricultural Security (0-100)
    const livelihood = 87 + ((hash * 3) % 12);
    // 4. Disaster-Proof Permanent Housing (0-100)
    const resilientHousing = 91 + ((hash * 7) % 9);
    // 5. Civic Infrastructure & Public Health (0-100)
    const infrastructure = 86 + ((hash * 5) % 13);
    // 6. Proactive Financial Viability & 10-Yr ROI (0-100)
    const financialViability = 93 + ((hash * 2) % 7);

    // Weighted Overall Sustainability Score
    const compositeScore = Math.round(
      ecoSafety * 0.25 +
        waterEnergy * 0.15 +
        livelihood * 0.2 +
        resilientHousing * 0.15 +
        infrastructure * 0.15 +
        financialViability * 0.1,
    );

    return {
      zone: z,
      tgtCoords,
      distKm: Math.max(1, Math.round(distKm * 10) / 10),
      sustainabilityScore: compositeScore,
      factors: {
        ecoSafety: Math.round(ecoSafety),
        waterEnergy,
        livelihood,
        resilientHousing,
        infrastructure,
        financialViability,
      },
      townshipName: `${z.district} Green Resilient Township (${z.name} Sector)`,
    };
  });

  // Sort by sustainability score descending (best location first)
  scored.sort((a, b) => b.sustainabilityScore - a.sustainabilityScore);
  const best = scored[0];

  return {
    source: sourceZone,
    target: best.zone,
    distKm: best.distKm,
    srcCoords,
    tgtCoords: best.tgtCoords,
    path: [sourceZone, best.zone],
    hops: 1,
    sustainabilityScore: best.sustainabilityScore,
    sustainabilityGrade:
      best.sustainabilityScore >= 95
        ? "A+"
        : best.sustainabilityScore >= 90
          ? "A"
          : "B+",
    factors: best.factors,
    townshipName: best.townshipName,
    type: "Permanent Relocation",
    sustainabilityHighlights: [
      `🌏 100% Zero-Hazard Safe Tableland (Slope & Flood Clearance)`,
      `⚡ Solar Micro-Grid & Deep Aquifer Rainwater Recharge`,
      `🌾 Farmland Rights Access & Regional Agro-Market Linkage`,
      `🏠 Pre-Fab Seismic (Zone IV) & Cyclone Proof 2BHK Units`,
      `🏥 Integrated Primary Health Center (PHC), School & Skill Hub`,
      `💰 15th FC Climate Grant Eligible (8.7x Proactive Savings)`,
    ],
  };
}

function getPathArcPoints(path, numPointsPerSegment = 16) {
  if (!path || path.length < 2) return [];
  const fullPts = [];
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const c1 = [
      p1.lat ||
        (DISTRICT_COORDS[p1.district] ? DISTRICT_COORDS[p1.district][0] : 23.8),
      p1.lng ||
        (DISTRICT_COORDS[p1.district] ? DISTRICT_COORDS[p1.district][1] : 79.1),
    ];
    const c2 = [
      p2.lat ||
        (DISTRICT_COORDS[p2.district] ? DISTRICT_COORDS[p2.district][0] : 23.8),
      p2.lng ||
        (DISTRICT_COORDS[p2.district] ? DISTRICT_COORDS[p2.district][1] : 79.1),
    ];
    const seg = getArcPoints(c1[0], c1[1], c2[0], c2[1], numPointsPerSegment);
    if (i > 0) seg.shift();
    fullPts.push(...seg);
  }
  return fullPts;
}

function getArcPoints(srcLat, srcLng, tgtLat, tgtLng, numPoints = 25) {
  let effectiveTgtLat = tgtLat;
  let effectiveTgtLng = tgtLng;
  if (Math.abs(srcLat - tgtLat) < 0.001 && Math.abs(srcLng - tgtLng) < 0.001) {
    effectiveTgtLat = srcLat + 0.15;
    effectiveTgtLng = srcLng + 0.15;
  }

  const pts = [];
  const midLat = (srcLat + effectiveTgtLat) / 2;
  const midLng = (srcLng + effectiveTgtLng) / 2;
  const dLat = effectiveTgtLat - srcLat;
  const dLng = effectiveTgtLng - srcLng;
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 0.1;
  const perpLat = (-dLng / len) * (len * 0.22);
  const perpLng = (dLat / len) * (len * 0.22);
  const ctrlLat = midLat + perpLat;
  const ctrlLng = midLng + perpLng;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat =
      (1 - t) * (1 - t) * srcLat +
      2 * (1 - t) * t * ctrlLat +
      t * t * effectiveTgtLat;
    const lng =
      (1 - t) * (1 - t) * srcLng +
      2 * (1 - t) * t * ctrlLng +
      t * t * effectiveTgtLng;
    pts.push([lat, lng]);
  }
  return pts;
}

function getBearing(lat1, lng1, lat2, lng2) {
  if (Math.abs(lat1 - lat2) < 0.0001 && Math.abs(lng1 - lng2) < 0.0001)
    return 45;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/* ======================================================================
   2D MAP (fallback view)
   ====================================================================== */

function MapCanvas({
  zones,
  selectedId,
  onSelect,
  compact,
  visibleLayers = { hazard: true, population: true, sites: true },
  relocationTarget,
  gridStyle = "contours",
  selectTrigger,
}) {
  const [viewCenter, setViewCenter] = useState({ x: 50, y: 38 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const dragStartRef = useRef({
    mouseX: 0,
    mouseY: 0,
    centerX: 50,
    centerY: 38,
  });
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

  // Wheel zoom via non-passive listener
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
    if (e.target.closest(".zone-node") || e.target.closest(".site-node"))
      return;
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
    if (
      relocationTarget &&
      relocationTarget.path &&
      relocationTarget.path.length > 0
    ) {
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
      {/* Free Roam Navigation Toolbar */}
      <div
        style={{
          position: "absolute",
          top: "12px",
          right: "12px",
          zIndex: 10,
          display: "flex",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.min(8, z * 1.25));
          }}
          title="Zoom In"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setZoom((z) => Math.max(0.5, z * 0.8));
          }}
          title="Zoom Out"
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          −
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Reset to Full Pan-India view"
          style={{
            padding: "5px 9px",
            borderRadius: "6px",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--brand)",
            fontWeight: 600,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          🗺 Pan-India
        </button>
        {selectedZone && (
          <button
            type="button"
            onClick={handleFocus}
            title="Focus camera on active zone / evacuation corridor"
            style={{
              padding: "5px 9px",
              borderRadius: "6px",
              border: "1px solid rgba(33, 132, 95, 0.4)",
              background: "#eef8f3",
              color: "var(--safe)",
              fontWeight: 600,
              fontSize: "11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🎯 Focus Route
          </button>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "14px",
          zIndex: 5,
          fontSize: "10px",
          color: "var(--ink-soft)",
          opacity: 0.85,
          pointerEvents: "none",
        }}
      >
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

        {/* Free Roam & Zoom Viewport Group */}
        <g
          transform={`translate(50, 38) scale(${zoom}) translate(${-viewCenter.x}, ${-viewCenter.y})`}
        >
          {/* Topographic Contours Layer */}
          {gridStyle === "contours" && (
            <>
              {[8, 16, 24, 32, 40, 48, 56, 64, 72].map((yy, i) => (
                <g key={`contour-${i}`}>
                  <path
                    d={`M0,${yy} Q25,${yy - 6} 50,${yy} T100,${yy}`}
                    stroke="#9cb5c5"
                    strokeWidth="0.3"
                    fill="none"
                    opacity="0.8"
                  />
                  <text
                    x="96"
                    y={yy - 1}
                    fontSize="1.1"
                    fill="#7892a2"
                    textAnchor="end"
                  >
                    {(i + 1) * 350}m
                  </text>
                </g>
              ))}
              <path
                d="M4,15 Q24,6 44,18 T74,14 T96,20"
                stroke="#688a9e"
                strokeWidth="0.8"
                fill="none"
                opacity="0.85"
              />
              <path
                d="M6,60 Q26,50 48,58 T78,54 T96,62"
                stroke="#688a9e"
                strokeWidth="0.8"
                fill="none"
                opacity="0.85"
              />
            </>
          )}

          {/* Hydrology Drainage & River Catchment Layer */}
          {gridStyle === "hydrology" && (
            <>
              <path
                d="M0,18 Q28,10 48,22 T82,16 T100,26"
                stroke="#0284c7"
                strokeWidth="1.6"
                fill="none"
                opacity="0.85"
              />
              <path
                d="M8,64 Q32,50 54,60 T78,56 T100,66"
                stroke="#0284c7"
                strokeWidth="1.4"
                fill="none"
                opacity="0.75"
              />
              <path
                d="M48,22 Q52,38 42,50 T32,60"
                stroke="#38bdf8"
                strokeWidth="0.75"
                fill="none"
                strokeDasharray="1 0.5"
                opacity="0.8"
              />
              <path
                d="M72,28 Q66,42 78,56"
                stroke="#38bdf8"
                strokeWidth="0.65"
                fill="none"
                strokeDasharray="1 0.5"
                opacity="0.8"
              />
              <ellipse
                cx="48"
                cy="22"
                rx="14"
                ry="7"
                fill="#38bdf8"
                opacity="0.16"
              />
              <ellipse
                cx="54"
                cy="60"
                rx="16"
                ry="8"
                fill="#38bdf8"
                opacity="0.14"
              />
            </>
          )}

          {/* Multi-Hazard & Geotechnical Shear Stress Layer */}
          {gridStyle === "hazard" && (
            <>
              <path
                d="M2,12 Q32,24 62,18 T98,32"
                stroke="#ef4444"
                strokeWidth="1.2"
                strokeDasharray="2 1.5"
                fill="none"
                opacity="0.7"
              />
              <path
                d="M12,68 Q44,52 68,64 T96,54"
                stroke="#f97316"
                strokeWidth="1.0"
                strokeDasharray="2 1.5"
                fill="none"
                opacity="0.65"
              />
              <circle
                cx="35"
                cy="22"
                r="10"
                fill="#ef4444"
                opacity="0.12"
                stroke="#ef4444"
                strokeWidth="0.4"
                strokeDasharray="1 1"
              />
              <circle
                cx="70"
                cy="58"
                r="12"
                fill="#ef4444"
                opacity="0.12"
                stroke="#ef4444"
                strokeWidth="0.4"
                strokeDasharray="1 1"
              />
            </>
          )}

          {/* Evacuation Corridors & Road Lifelines Layer */}
          {gridStyle === "corridors" && (
            <>
              <path
                d="M0,38 L100,38"
                stroke="#10b981"
                strokeWidth="0.9"
                strokeDasharray="3 1.5"
                opacity="0.5"
              />
              <path
                d="M50,0 L50,76"
                stroke="#10b981"
                strokeWidth="0.9"
                strokeDasharray="3 1.5"
                opacity="0.5"
              />
              <path
                d="M10,15 L88,62"
                stroke="#059669"
                strokeWidth="0.75"
                strokeDasharray="2 1"
                opacity="0.45"
              />
            </>
          )}

          {/* Standard base contours if not already specified */}
          {gridStyle !== "contours" &&
            [15, 30, 45, 60].map((yy, i) => (
              <path
                key={`std-${i}`}
                d={`M0,${yy} Q25,${yy - 4} 50,${yy} T100,${yy}`}
                stroke="var(--contour)"
                strokeWidth="0.2"
                fill="none"
                opacity="0.4"
              />
            ))}

          {/* Relocation Arrow in 2D Map via Dijkstra */}
          {relocationTarget &&
            (() => {
              const { source: src, target: tgt, path } = relocationTarget;
              if (!src || !tgt) return null;
              let pathD = "";
              if (path && path.length > 2) {
                pathD = path
                  .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`)
                  .join(" ");
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
                    <marker
                      id="mc-reloc-head"
                      markerWidth="6"
                      markerHeight="4"
                      refX="5"
                      refY="2"
                      orient="auto"
                    >
                      <path d="M0,0 L6,2 L0,4 Z" fill="var(--safe)" />
                    </marker>
                  </defs>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--safe)"
                    strokeWidth="0.8"
                    opacity="0.25"
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--safe)"
                    strokeWidth="0.55"
                    strokeDasharray="2 1"
                    markerEnd="url(#mc-reloc-head)"
                  />
                  {/* Waypoint markers */}
                  {path &&
                    path.length > 2 &&
                    path
                      .slice(1, -1)
                      .map((wp, idx) => (
                        <circle
                          key={`wp-${wp.id}-${idx}`}
                          cx={wp.x}
                          cy={wp.y}
                          r="1.3"
                          fill="#38bdf8"
                          stroke="#fff"
                          strokeWidth="0.3"
                        />
                      ))}
                  <circle
                    cx={tgt.x}
                    cy={tgt.y}
                    r="3.2"
                    fill="none"
                    stroke="var(--safe)"
                    strokeWidth="0.35"
                  />
                  <rect
                    x={tgt.x - 4}
                    y={tgt.y - 5.5}
                    width="8"
                    height="2.5"
                    rx="0.8"
                    fill="var(--safe)"
                  />
                  <text
                    x={tgt.x}
                    y={tgt.y - 3.8}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="1.5"
                    fontWeight="700"
                  >
                    SAFE
                  </text>
                </g>
              );
            })()}

          {/* 1. Hazard Footprint Ellipse ONLY for active zone or hovered zone */}
          {visibleLayers.hazard &&
            (selectedZone || hoveredZone) &&
            (() => {
              const targetZ = hoveredZone || selectedZone;
              const r = Math.max(
                1.2,
                Math.min(2.4, 0.9 + Math.sqrt(targetZ.population) / 100),
              );
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
          {visibleLayers.sites &&
            selectedZone &&
            (() => {
              const z = selectedZone;
              const siteX = Math.min(
                96,
                Math.max(4, z.x + (z.icon === "flood" ? 6 : 5)),
              );
              const siteY = Math.max(
                5,
                Math.min(72, z.y - (z.icon === "flood" ? 7 : 5)),
              );
              const isShortfall = z.site?.status === "shortfall";
              const siteColor = isShortfall
                ? "var(--immediate)"
                : "var(--safe)";
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
            const baseR = Math.max(
              0.9,
              Math.min(2.0, 0.8 + Math.sqrt(z.population) / 110),
            );
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
                <circle
                  cx={z.x}
                  cy={z.y}
                  r={r}
                  fill={color}
                  opacity={active || hovered ? 1 : 0.78}
                  stroke="#ffffff"
                  strokeWidth={active ? 0.6 : 0.25}
                />
              </g>
            );
          })}

          {/* 4. Prominent high-contrast Badge ONLY for active or hovered zone */}
          {(hoveredZone || selectedZone) &&
            (() => {
              const z = hoveredZone || selectedZone;
              const baseR = Math.max(
                0.9,
                Math.min(2.0, 0.8 + Math.sqrt(z.population) / 110),
              );
              const r = baseR + 0.6;
              return (
                <g
                  transform={`translate(${z.x}, ${z.y - (r + 2.4)})`}
                  style={{ pointerEvents: "none" }}
                >
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
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "14px",
            zIndex: 20,
            background: "rgba(255, 255, 255, 0.97)",
            backdropFilter: "blur(6px)",
            border: "1px solid var(--line)",
            borderLeft: `4px solid ${PHASE_COLOR[hoveredZone.phase] || "var(--brand)"}`,
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            pointerEvents: "none",
            minWidth: "200px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--ink)",
              display: "flex",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <span>{hoveredZone.name}</span>
            <span
              style={{
                color: PHASE_COLOR[hoveredZone.phase],
                fontSize: "11px",
              }}
            >
              {hoveredZone.id}
            </span>
          </div>
          <div
            style={{
              fontSize: "10.5px",
              color: "var(--ink-soft)",
              marginTop: "2px",
            }}
          >
            {hoveredZone.district} · {hoveredZone.hazard}
          </div>
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "5px",
              fontSize: "10.5px",
              fontWeight: 600,
            }}
          >
            <span>
              Score:{" "}
              <strong style={{ color: "var(--brand)" }}>
                {hoveredZone.priorityScore}
              </strong>
            </span>
            <span>
              Phase:{" "}
              <strong style={{ color: PHASE_COLOR[hoveredZone.phase] }}>
                {hoveredZone.phase}
              </strong>
            </span>
            <span>Pop: {hoveredZone.population.toLocaleString("en-IN")}</span>
          </div>
        </div>
      )}

      <div className="map-legend">
        <div className="legend-row">
          <span className="legend-symbol hazard-symbol" />
          <span>Hazard zone</span>
        </div>
        <div className="legend-row">
          <span className="legend-symbol site-symbol" />
          <span>Relocation site</span>
        </div>
        {PHASES.map((p) => (
          <div key={p} className="legend-row">
            <span className="dot" style={{ background: PHASE_COLOR[p] }} />
            <span>{p}</span>
          </div>
        ))}
        {relocationTarget && (
          <div className="legend-row">
            <span
              className="dot"
              style={{
                background: "var(--safe)",
                boxShadow: "0 0 4px var(--safe)",
              }}
            />
            <span style={{ fontWeight: 600 }}>Relocation route</span>
          </div>
        )}
      </div>
    </div>
  );
}

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
    flood: Math.min(
      100,
      Math.round(zone.hazardIntensity * (isFlood ? 1 : 0.48)),
    ),
    landslide: Math.min(
      100,
      Math.round(zone.hazardIntensity * (isSlide ? 1 : 0.42)),
    ),
    earthquake: Math.min(
      100,
      Math.round(28 + zone.exposure * 0.34 + (zone.incidentHistory ? 8 : 0)),
    ),
    rainfall: Math.min(
      100,
      Math.round(zone.hazardIntensity * (isFlood || isSlide ? 0.78 : 0.65)),
    ),
  };
}

function getHistory(zone) {
  if (!zone || !zone.incidentHistory) return { events: 0, severity: "None" };
  const events = zone.priorityScore > 50 ? 3 : 1;
  const severity =
    zone.priorityScore > 60
      ? "Critical"
      : zone.priorityScore > 40
        ? "High"
        : "Moderate";
  return { events, severity };
}

function getSiteSuitability(zone) {
  const utilization = zone.site.utilization || 0;
  const factors = [
    {
      label: "Hazard safety",
      value: Math.max(28, 100 - zone.hazardIntensity + 18),
    },
    {
      label: "Carrying capacity",
      value:
        zone.site.status === "shortfall"
          ? Math.max(18, 100 - (utilization - 100) * 3)
          : Math.max(58, 100 - Math.max(0, utilization - 72)),
    },
    { label: "Road accessibility", value: zone.isolated ? 54 : 84 },
    {
      label: "Water availability",
      value: zone.district.includes("Barmer") ? 58 : 86,
    },
    { label: "Healthcare access", value: zone.isolated ? 61 : 82 },
    { label: "Education access", value: zone.isolated ? 64 : 79 },
    { label: "Livelihood continuity", value: zone.lowIncome > 65 ? 68 : 78 },
    { label: "Distance from habitation", value: zone.isolated ? 57 : 81 },
  ];
  const score = Math.round(
    factors.reduce((sum, factor) => sum + factor.value, 0) / factors.length,
  );
  const recommendation =
    score >= 80
      ? "Highly Suitable"
      : score >= 60
        ? "Suitable with Improvements"
        : "Not Suitable";
  return { factors, score, recommendation };
}

function getAssistedRecommendation(zone) {
  const suitability = getSiteSuitability(zone);
  const historyWeight = zone.incidentHistory ? 1 : 0;
  if (zone.site.status === "shortfall") {
    return {
      action: "Secure an overflow relocation site before issuing an order.",
      reason: "The current destination exceeds planned intake capacity.",
      confidence: 96,
      tone: "urgent",
    };
  }
  if (zone.phase === "Immediate" && historyWeight) {
    return {
      action: "Approve evacuation planning and send a community alert.",
      reason:
        "Immediate priority is reinforced by a recorded disaster history.",
      confidence: 92,
      tone: "urgent",
    };
  }
  if (suitability.score < 60) {
    return {
      action: "Improve the proposed site before relocation.",
      reason: "Suitability is below the recommended threshold for a safe move.",
      confidence: 86,
      tone: "watch",
    };
  }
  return {
    action: "Schedule field verification and keep the zone under review.",
    reason: "Current conditions support preparation before a relocation order.",
    confidence: 79,
    tone: "steady",
  };
}

function AssistedRecommendation({ zone }) {
  const recommendation = getAssistedRecommendation(zone);
  return (
    <div
      className={`recommendation-card recommendation-${recommendation.tone}`}
    >
      <div className="recommendation-card-head">
        <span>
          <Satellite size={13} /> Assisted planning recommendation
        </span>
        <strong>{recommendation.confidence}% confidence</strong>
      </div>
      <div className="recommendation-action">{recommendation.action}</div>
      <div className="recommendation-reason">{recommendation.reason}</div>
      <div className="recommendation-note">
        Prototype decision support · review with the district officer before
        action.
      </div>
    </div>
  );
}

function SiteSuitability({ zone }) {
  const suitability = getSiteSuitability(zone);
  return (
    <div className="suitability-card">
      <div className="suitability-head">
        <div>
          <div className="site-card-head">
            <Building2 size={14} />
            <span>Relocation site suitability</span>
          </div>
          <span className="muted small">
            Decision support across eight field factors
          </span>
        </div>
        <div className="suitability-score">
          <strong>{suitability.score}</strong>
          <span>/100</span>
        </div>
      </div>
      <div
        className={`suitability-recommendation recommendation-${suitability.recommendation.startsWith("Highly") ? "high" : suitability.recommendation.startsWith("Suitable") ? "medium" : "low"}`}
      >
        {suitability.recommendation}
      </div>
      <div className="suitability-grid">
        {suitability.factors.map((factor) => (
          <div className="suitability-factor" key={factor.label}>
            <div>
              <span>{factor.label}</span>
              <strong>{factor.value}</strong>
            </div>
            <div className="suitability-track">
              <i style={{ width: `${factor.value}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FusionAnalysis({ zone, selectedLayers, fusionEnabled }) {
  if (!zone) return null;
  const risks = getHazardRisks(zone);
  const activeRisks = HAZARD_LAYERS.filter(
    (layer) => selectedLayers[layer.id],
  ).map((layer) => risks[layer.id]);
  const overlapCount = activeRisks.filter((risk) => risk >= 60).length;
  const composite = activeRisks.length
    ? Math.min(
        100,
        Math.round(
          activeRisks.reduce((sum, risk) => sum + risk, 0) /
            activeRisks.length +
            (fusionEnabled ? overlapCount * 7 : 0),
        ),
      )
    : 0;
  const riskLevel =
    composite >= 80
      ? "Critical"
      : composite >= 60
        ? "High"
        : composite >= 35
          ? "Moderate"
          : "Safe";
  return (
    <div className="fusion-panel">
      <div className="fusion-panel-head">
        <span>
          <Layers size={13} /> Fusion analysis
        </span>
        <span className={`fusion-level level-${riskLevel.toLowerCase()}`}>
          {riskLevel}
        </span>
      </div>
      <div className="fusion-score">
        <strong>{composite}</strong>
        <span>/100 composite risk</span>
      </div>
      <div className="fusion-bars">
        {HAZARD_LAYERS.map((layer) => (
          <div className="fusion-bar" key={layer.id}>
            <div>
              <span>{layer.label}</span>
              <strong>{risks[layer.id]}%</strong>
            </div>
            <div className="fusion-track">
              <i
                style={{
                  width: `${risks[layer.id]}%`,
                  background: layer.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="fusion-overlap">
        <span>Overlapping hazards</span>
        <strong>{fusionEnabled ? overlapCount : 0}</strong>
      </div>
    </div>
  );
}

function TerrainDecisionOverlay({ zone }) {
  if (!zone) return null;
  const suitability = getSiteSuitability(zone);
  const history = getHistory(zone);
  const action =
    zone.site.status === "shortfall"
      ? "Secure overflow capacity before issuing a relocation order."
      : zone.phase === "Immediate"
        ? "Approve the evacuation plan and issue a community alert."
        : "Schedule a field verification and keep the zone under review.";
  return (
    <div className="terrain-decision-overlay">
      <div className="terrain-overlay-kicker">
        <span className="live-dot" /> SELECTED PLANNING AREA
      </div>
      <div className="terrain-overlay-title">
        <strong>{zone.name}</strong>
        <PhaseBadge phase={zone.phase} />
      </div>
      <div className="terrain-overlay-grid">
        <div>
          <strong>{zone.priorityScore}</strong>
          <span>priority</span>
        </div>
        <div>
          <strong>{suitability.score}</strong>
          <span>site score</span>
        </div>
        <div>
          <strong>{history.events}</strong>
          <span>past events</span>
        </div>
      </div>
      <div className="terrain-next-step">
        <span>NEXT STEP</span>
        {action}
      </div>
    </div>
  );
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

    // Preserve Pan-India overview (zoom 5) on the very first mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastCenteredIdRef.current = selectedZone.id;
      lastTriggerRef.current = selectTrigger;
      return;
    }

    const isDifferentZone = selectedZone.id !== lastCenteredIdRef.current;
    const isTriggeredAgain =
      selectTrigger !== undefined && selectTrigger !== lastTriggerRef.current;
    if (!isDifferentZone && !isTriggeredAgain) return;

    lastCenteredIdRef.current = selectedZone.id;
    lastTriggerRef.current = selectTrigger;

    const lat =
      selectedZone.lat ||
      (DISTRICT_COORDS[selectedZone.district]
        ? DISTRICT_COORDS[selectedZone.district][0]
        : null);
    const lng =
      selectedZone.lng ||
      (DISTRICT_COORDS[selectedZone.district]
        ? DISTRICT_COORDS[selectedZone.district][1]
        : null);
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

const TILE_LAYERS = [
  {
    id: "satellite",
    label: "Satellite Imagery",
    emoji: "🚰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "┬⌐ Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  {
    id: "terrain",
    label: "Topographic Relief",
    emoji: "⚰️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "┬⌐ Esri, USGS, NOAA",
    maxZoom: 19,
  },
  {
    id: "standard",
    label: "Standard Streets",
    emoji: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "┬⌐ OpenStreetMap contributors",
    maxZoom: 19,
  },
  {
    id: "natgeo",
    label: "NatGeo Map",
    emoji: "🗺️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "┬⌐ Esri, National Geographic",
    maxZoom: 16,
  },
  {
    id: "osm_hot",
    label: "OSM Humanitarian",
    emoji: "🏥",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "┬⌐ OpenStreetMap contributors, HOT",
    maxZoom: 19,
  },
  {
    id: "topo",
    label: "OpenTopoMap",
    emoji: "🗺️",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "┬⌐ OpenTopoMap, OpenStreetMap",
    maxZoom: 17,
  },
  {
    id: "relief",
    label: "Shaded Relief",
    emoji: "🏔️",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    attribution: "┬⌐ Esri, USGS",
    maxZoom: 19,
  },
];

function RiskMap({
  zones,
  selectedId,
  onSelect,
  selectedLayers,
  fusionEnabled,
  onToggleLayer,
  onToggleFusion,
  relocationTarget,
  externalTile,
  onTileChange,
  selectTrigger,
}) {
  const selectedZone = zones.find((zone) => zone.id === selectedId);
  const [internalTile, setInternalTile] = useState("satellite");
  const activeTile = externalTile || internalTile;
  const setActiveTile = onTileChange || setInternalTile;
  const [tileMenuOpen, setTileMenuOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const tile = TILE_LAYERS.find((t) => t.id === activeTile) || TILE_LAYERS[0];

  return (
    <div className="risk-map-wrap" style={{ position: "relative" }}>
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
      >
        <MapResizer />
        <MapInstanceSetter onMap={setMapInstance} />
        <MapCenterController
          selectedZone={selectedZone}
          selectTrigger={selectTrigger}
        />
        <TileLayer
          key={tile.id}
          url={tile.url}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom}
        />
        <ZoomControl position="topleft" />

        {/* Relocation Route Corridors (Section 1: Short-Term & Section 2: Permanent) */}
        {relocationTarget &&
          (() => {
            const st = relocationTarget.shortTerm || relocationTarget;
            const pm = relocationTarget.permanent;

            return (
              <>
                {/* SECTION 1: Short-Term Emergency Evacuation Polyline */}
                {st &&
                  (() => {
                    const {
                      srcCoords,
                      tgtCoords,
                      target,
                      source,
                      distKm,
                      path,
                      hops,
                    } = st;
                    const arcPts =
                      path && path.length > 2
                        ? getPathArcPoints(path, 16)
                        : getArcPoints(
                            srcCoords[0],
                            srcCoords[1],
                            tgtCoords[0],
                            tgtCoords[1],
                          );
                    const pPrev = arcPts[Math.max(0, arcPts.length - 4)];
                    const pTarget = arcPts[arcPts.length - 1];
                    const arrowAngle = getBearing(
                      pPrev[0],
                      pPrev[1],
                      pTarget[0],
                      pTarget[1],
                    );
                    const arrowPos = arcPts[Math.max(0, arcPts.length - 2)];

                    const arrowDivIcon = L.divIcon({
                      className: "reloc-arrow-head-icon",
                      html: `
                    <div style="transform: rotate(${arrowAngle}deg); width:28px; height:28px; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                      <svg width="22" height="22" viewBox="0 0 24 24">
                        <polygon points="12,1 23,21 12,16 1,21" fill="#f59e0b" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
                      </svg>
                    </div>
                  `,
                      iconSize: [28, 28],
                      iconAnchor: [14, 14],
                    });

                    return (
                      <React.Fragment key="st-corridor">
                        <Polyline
                          positions={arcPts}
                          pathOptions={{
                            color: "#f59e0b",
                            weight: 8,
                            opacity: 0.2,
                            lineCap: "round",
                          }}
                        />
                        <Polyline
                          positions={arcPts}
                          className="reloc-corridor-path"
                          pathOptions={{
                            color: "#f59e0b",
                            weight: 3.5,
                            dashArray: "8, 6",
                            opacity: 0.95,
                          }}
                        >
                          <LeafletTooltip sticky direction="top">
                            <div>
                              <strong>
                                ⚡ Section 1: Short-Term Evacuation
                              </strong>
                              : {source.name} ➡ {target.name}
                              <br />
                              <span>
                                Distance: {distKm} km · ~
                                {Math.max(12, Math.round(distKm * 2.2))} mins
                              </span>
                            </div>
                          </LeafletTooltip>
                        </Polyline>
                        <Marker
                          position={arrowPos}
                          icon={arrowDivIcon}
                          interactive={false}
                        />
                        <CircleMarker
                          center={tgtCoords}
                          radius={9}
                          pathOptions={{
                            color: "#ffffff",
                            weight: 2.5,
                            fillColor: "#f59e0b",
                            fillOpacity: 0.9,
                          }}
                        >
                          <LeafletTooltip
                            permanent
                            direction="top"
                            offset={[0, -10]}
                          >
                            ⚡ SHORT-TERM: {target.name} ({distKm} km)
                          </LeafletTooltip>
                        </CircleMarker>
                      </React.Fragment>
                    );
                  })()}

                {/* SECTION 2: Permanent Sustainable Relocation Polyline */}
                {pm &&
                  (() => {
                    const {
                      srcCoords,
                      tgtCoords,
                      target,
                      source,
                      distKm,
                      townshipName,
                      sustainabilityScore,
                    } = pm;
                    const arcPts = getArcPoints(
                      srcCoords[0],
                      srcCoords[1],
                      tgtCoords[0],
                      tgtCoords[1],
                    );
                    const pPrev = arcPts[Math.max(0, arcPts.length - 4)];
                    const pTarget = arcPts[arcPts.length - 1];
                    const arrowAngle = getBearing(
                      pPrev[0],
                      pPrev[1],
                      pTarget[0],
                      pTarget[1],
                    );
                    const arrowPos = arcPts[Math.max(0, arcPts.length - 2)];

                    const arrowDivIcon = L.divIcon({
                      className: "reloc-arrow-head-icon",
                      html: `
                    <div style="transform: rotate(${arrowAngle}deg); width:32px; height:32px; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));">
                      <svg width="26" height="26" viewBox="0 0 24 24">
                        <polygon points="12,1 23,21 12,16 1,21" fill="#10b981" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" />
                      </svg>
                    </div>
                  `,
                      iconSize: [32, 32],
                      iconAnchor: [16, 16],
                    });

                    return (
                      <React.Fragment key="pm-corridor">
                        <Polyline
                          positions={arcPts}
                          pathOptions={{
                            color: "#10b981",
                            weight: 10,
                            opacity: 0.25,
                            lineCap: "round",
                          }}
                        />
                        <Polyline
                          positions={arcPts}
                          pathOptions={{
                            color: "#10b981",
                            weight: 4.5,
                            opacity: 0.95,
                            lineCap: "round",
                          }}
                        >
                          <LeafletTooltip sticky direction="top">
                            <div>
                              <strong>
                                🌱 Section 2: Permanent Relocation
                              </strong>
                              : {source.name} ➡ {townshipName}
                              <br />
                              <span>
                                Distance: {distKm} km • Sustainability:{" "}
                                {sustainabilityScore}/100
                              </span>
                            </div>
                          </LeafletTooltip>
                        </Polyline>
                        <Marker
                          position={arrowPos}
                          icon={arrowDivIcon}
                          interactive={false}
                        />
                        <CircleMarker
                          center={tgtCoords}
                          radius={14}
                          pathOptions={{
                            color: "#ffffff",
                            weight: 3,
                            fillColor: "#10b981",
                            fillOpacity: 1,
                          }}
                        >
                          <LeafletTooltip
                            permanent
                            direction="bottom"
                            offset={[0, 10]}
                          >
                            🌱 PERMANENT: {townshipName} ({sustainabilityScore}
                            /100)
                          </LeafletTooltip>
                        </CircleMarker>
                      </React.Fragment>
                    );
                  })()}
              </>
            );
          })()}

        {zones.map((zone) => {
          const lat =
            zone.lat ||
            (DISTRICT_COORDS[zone.district]
              ? DISTRICT_COORDS[zone.district][0]
              : 23.8);
          const lng =
            zone.lng ||
            (DISTRICT_COORDS[zone.district]
              ? DISTRICT_COORDS[zone.district][1]
              : 79.1);
          const risks = getHazardRisks(zone);
          const activeRisks = HAZARD_LAYERS.filter(
            (layer) => selectedLayers[layer.id],
          ).map((layer) => risks[layer.id]);
          const overlapCount = activeRisks.filter((risk) => risk >= 60).length;
          const composite = activeRisks.length
            ? Math.min(
                100,
                Math.round(
                  activeRisks.reduce((sum, risk) => sum + risk, 0) /
                    activeRisks.length +
                    (fusionEnabled ? overlapCount * 7 : 0),
                ),
              )
            : 0;
          const color = fusionEnabled
            ? composite >= 80
              ? "var(--immediate)"
              : composite >= 60
                ? "var(--watch)"
                : "var(--safe)"
            : PHASE_COLOR[zone.phase];
          const active = zone.id === selectedId;
          const isRelocSource =
            relocationTarget && relocationTarget.source.id === zone.id;
          const isRelocTarget =
            relocationTarget && relocationTarget.target.id === zone.id;

          return (
            <CircleMarker
              key={zone.id}
              center={[lat, lng]}
              radius={active ? 11 : isRelocSource ? 10 : isRelocTarget ? 9 : 7}
              pathOptions={{
                color: isRelocSource
                  ? "#c84b4b"
                  : isRelocTarget
                    ? "#21845f"
                    : "#fff",
                weight: active ? 3.5 : isRelocSource || isRelocTarget ? 3 : 2,
                fillColor: color,
                fillOpacity: active ? 1 : 0.86,
              }}
              eventHandlers={{
                click: () => {
                  onSelect(zone.id);
                  if (mapInstance) {
                    const targetZoom = Math.max(mapInstance.getZoom(), 13);
                    mapInstance.flyTo([lat, lng], targetZoom, {
                      animate: true,
                      duration: 1.2,
                      easeLinearity: 0.25,
                    });
                  }
                },
              }}
            >
              <Popup>
                <strong>{zone.name}</strong>
                <br />
                {zone.district}
                <br />
                Phase: {zone.phase}
                <br />
                Composite risk: {composite}/100
                <br />
                Overlapping hazards: {fusionEnabled ? overlapCount : 0}
                {isRelocSource && (
                  <>
                    <br />
                    <span
                      style={{ color: "var(--immediate)", fontWeight: 700 }}
                    >
                      ⚠️ Evacuation Origin
                    </span>
                  </>
                )}
                {isRelocTarget && (
                  <>
                    <br />
                    <span style={{ color: "var(--safe)", fontWeight: 700 }}>
                      🛡️ Receiving Safe Zone
                    </span>
                  </>
                )}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Top Header Bar for Map Controls & Tile Switcher */}
      <div className="map-top-bar">
        <div className="hazard-controls">
          <button
            className={fusionEnabled ? "fusion-toggle is-on" : "fusion-toggle"}
            onClick={onToggleFusion}
          >
            <span className="fusion-switch" /> Multi-Hazard Fusion
          </button>
          <span className="hazard-divider" />
          {HAZARD_LAYERS.map((layer) => (
            <button
              key={layer.id}
              className={
                selectedLayers[layer.id] ? "hazard-chip is-on" : "hazard-chip"
              }
              onClick={() => onToggleLayer(layer.id)}
            >
              <i style={{ background: layer.color }} />
              {layer.label}
            </button>
          ))}
        </div>

        {/* Right side controls: Roam & Tile Switcher unified in single flex row */}
        <div
          className="map-top-actions"
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <button
            type="button"
            className="tile-switcher-btn"
            onClick={() =>
              mapInstance?.flyTo([22.8, 79.6], 5, {
                animate: true,
                duration: 1.0,
              })
            }
            title="Zoom out to full Pan-India view"
            style={{ fontWeight: 600 }}
          >
            <span>🗺</span>
            <span className="tile-switcher-label">Pan-India</span>
          </button>
          {selectedZone && (
            <button
              type="button"
              className="tile-switcher-btn"
              onClick={() => {
                if (!mapInstance) return;
                if (
                  relocationTarget &&
                  relocationTarget.path &&
                  relocationTarget.path.length > 0
                ) {
                  const coords = relocationTarget.path.map((z) => [
                    z.lat ||
                      (DISTRICT_COORDS[z.district]
                        ? DISTRICT_COORDS[z.district][0]
                        : 23.8),
                    z.lng ||
                      (DISTRICT_COORDS[z.district]
                        ? DISTRICT_COORDS[z.district][1]
                        : 79.1),
                  ]);
                  mapInstance.fitBounds(L.latLngBounds(coords), {
                    padding: [60, 60],
                    maxZoom: 9,
                    animate: true,
                    duration: 1.0,
                  });
                } else if (selectedZone) {
                  const lat =
                    selectedZone.lat ||
                    (DISTRICT_COORDS[selectedZone.district]
                      ? DISTRICT_COORDS[selectedZone.district][0]
                      : null);
                  const lng =
                    selectedZone.lng ||
                    (DISTRICT_COORDS[selectedZone.district]
                      ? DISTRICT_COORDS[selectedZone.district][1]
                      : null);
                  if (lat && lng)
                    mapInstance.flyTo(
                      [lat, lng],
                      Math.max(mapInstance.getZoom(), 8),
                      { animate: true, duration: 1.0 },
                    );
                }
              }}
              title="Focus camera on active zone / evacuation route"
              style={{
                color: "var(--safe)",
                borderColor: "rgba(33, 132, 95, 0.4)",
                background: "#f0fdf4",
              }}
            >
              <span>🎯</span>
              <span className="tile-switcher-label">Focus Route</span>
            </button>
          )}

          {/* Tile layer switcher */}
          <div className="tile-switcher">
            <button
              className="tile-switcher-btn"
              onClick={() => setTileMenuOpen((v) => !v)}
              title="Switch map style"
            >
              <span>{tile.emoji}</span>
              <span className="tile-switcher-label">{tile.label}</span>
              <span className="tile-switcher-arrow">
                {tileMenuOpen ? "▲" : "▼"}
              </span>
            </button>
            {tileMenuOpen && (
              <div className="tile-menu">
                {TILE_LAYERS.map((t) => (
                  <button
                    key={t.id}
                    className={`tile-option ${t.id === activeTile ? "is-active" : ""}`}
                    onClick={() => {
                      setActiveTile(t.id);
                      setTileMenuOpen(false);
                    }}
                  >
                    <span className="tile-option-emoji">{t.emoji}</span>
                    <span className="tile-option-label">{t.label}</span>
                    {t.id === activeTile && (
                      <span className="tile-option-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="risk-map-title">
        <strong>Interactive risk map</strong>
        <span>
          {relocationTarget
            ? `Arrow showing route from ${relocationTarget.source.name} to ${relocationTarget.target.name} (${relocationTarget.distKm} km)`
            : `${zones.length} planning areas across India · click any red zone to view safe relocation corridor`}
        </span>
      </div>
      <div className="risk-map-legend">
        <span>
          <i style={{ background: "var(--immediate)" }} /> Critical
        </span>
        <span>
          <i style={{ background: "var(--watch)" }} /> High
        </span>
        <span>
          <i style={{ background: "#d3a943" }} /> Medium
        </span>
        <span>
          <i style={{ background: "var(--safe)" }} /> Low / Safe
        </span>
        {relocationTarget && (
          <span
            style={{ fontWeight: 700, color: "var(--safe)", marginLeft: "4px" }}
          >
            <i
              style={{
                background: "var(--safe)",
                boxShadow: "0 0 5px var(--safe)",
              }}
            />{" "}
            Relocation Corridor Active
          </span>
        )}
      </div>
      <FusionAnalysis
        zone={selectedZone}
        selectedLayers={selectedLayers}
        fusionEnabled={fusionEnabled}
      />
    </div>
  );
}

/* ======================================================================
   DASHBOARD PIECES
   ====================================================================== */

function ZoneList({ zones, selectedId, onSelect }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.district.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q) ||
        z.hazard.toLowerCase().includes(q),
    );
  }, [zones, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.priorityScore - a.priorityScore),
    [filtered],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Reset to page 1 if filter changes
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
      <div
        style={{
          padding: "6px 8px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel-2)",
        }}
      >
        <input
          type="text"
          placeholder="Filter zones, districts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "5px 8px",
            fontSize: "11px",
            border: "1px solid var(--line)",
            borderRadius: "4px",
            background: "var(--panel)",
          }}
        />
      </div>
      <div className="zone-list-body">
        {displayed.map((z, i) => {
          const globalIndex = (page - 1) * pageSize + i;
          return (
            <button
              key={z.id}
              className={`zone-row ${z.id === selectedId ? "is-active" : ""}`}
              onClick={() => onSelect(z.id)}
            >
              <span className="zone-rank">
                {String(globalIndex + 1).padStart(2, "0")}
              </span>
              <span
                className="zone-icon"
                style={{ color: PHASE_COLOR[z.phase] }}
              >
                <HazardIcon icon={z.icon} />
              </span>
              <span className="zone-row-main">
                <span className="zone-row-name">{z.name}</span>
                <span className="zone-row-sub">{z.district}</span>
              </span>
              <span
                className="zone-score"
                style={{ color: PHASE_COLOR[z.phase] }}
              >
                {z.priorityScore}
              </span>
            </button>
          );
        })}
        {displayed.length === 0 && (
          <div
            style={{
              padding: "16px 12px",
              fontSize: "11.5px",
              color: "var(--ink-soft)",
              textAlign: "center",
            }}
          >
            No zones match your search.
          </div>
        )}
      </div>

      {/* 20-item Pagination Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderTop: "1px solid var(--line)",
          background: "var(--panel)",
          fontSize: "11px",
        }}
      >
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: "5px",
            background: page === 1 ? "var(--panel-2)" : "var(--panel)",
            color: page === 1 ? "var(--ink-soft)" : "var(--brand)",
            cursor: page === 1 ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "11px",
          }}
        >
          <ArrowLeft size={12} /> Prev
        </button>

        <span style={{ color: "var(--ink-soft)", fontWeight: 500 }}>
          Page <strong style={{ color: "var(--brand)" }}>{page}</strong> of{" "}
          {totalPages}
        </span>

        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            border: "1px solid var(--line)",
            borderRadius: "5px",
            background: page >= totalPages ? "var(--panel-2)" : "var(--panel)",
            color: page >= totalPages ? "var(--ink-soft)" : "var(--brand)",
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontWeight: 600,
            fontSize: "11px",
          }}
        >
          Next <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function DetailPanel({
  zone,
  role,
  onCertificate,
  onAlert,
  onSubscribe,
  subscribed,
  relocationTarget,
  onApproveRelocation,
}) {
  const [activeRelocSection, setActiveRelocSection] = useState("all");

  if (!zone) {
    return (
      <div className="detail-panel detail-empty">
        <Layers size={22} />
        <p>
          Select a zone on the terrain or list to inspect its hazard fusion
          score and relocation status.
        </p>
      </div>
    );
  }

  const isSafeZone = zone.phase === "Medium-Term";
  const safeZoneFacilities = isSafeZone ? generateFacilities(zone) : null;

  return (
    <div className="detail-panel">
      <div className="detail-top">
        <div>
          <div className="detail-code">{zone.id}</div>
          <h3>{zone.name}</h3>
          <div className="muted small">
            <MapPin size={12} /> {zone.district}
          </div>
        </div>
        <PhaseBadge phase={zone.phase} />
      </div>

      <div className="score-block">
        <div className="score-block-head">
          <span>Priority score</span>
          <span
            className="score-big"
            style={{ color: PHASE_COLOR[zone.phase] }}
          >
            {zone.priorityScore}
          </span>
        </div>
        <AnimatedBar
          value={zone.priorityScore}
          color={PHASE_COLOR[zone.phase]}
          height={7}
          trackKey={zone.id}
        />
        <div className="formula">Hazard ├ù Exposure ├ù Vulnerability</div>
      </div>

      <div className="mini-metrics">
        <div>
          <div className="mini-label">
            <span>Hazard intensity</span>
            <span className="mini-score">
              <strong>{zone.hazardIntensity}</strong>
              <span className="mini-scale"> / 100</span>
            </span>
          </div>
          <AnimatedBar
            value={zone.hazardIntensity}
            color="var(--brand-2)"
            trackKey={zone.id + "h"}
          />
        </div>
        <div>
          <div className="mini-label">
            <span>Exposure</span>
            <span className="mini-score">
              <strong>{zone.exposure}</strong>
              <span className="mini-scale"> / 100</span>
            </span>
          </div>
          <AnimatedBar
            value={zone.exposure}
            color="var(--brand-2)"
            trackKey={zone.id + "e"}
          />
        </div>
        <div>
          <div className="mini-label">
            <span>Vulnerability</span>
            <span className="mini-score">
              <strong>{zone.vulnerability}</strong>
              <span className="mini-scale"> / 100</span>
            </span>
          </div>
          <AnimatedBar
            value={zone.vulnerability}
            color="var(--brand-2)"
            trackKey={zone.id + "v"}
          />
        </div>
      </div>

      <div className="explain-box">
        <div className="explain-head">
          <ShieldCheck size={14} /> Explainable ranking
        </div>
        <p>{zone.explanation}</p>
      </div>

      <AssistedRecommendation zone={zone} />

      <div className="stat-grid">
        <div>
          <span className="stat-num">{fmt(zone.population)}</span>
          <span className="stat-lab">Population</span>
        </div>
        <div>
          <span className="stat-num">{zone.elderly}%</span>
          <span className="stat-lab">Elderly</span>
        </div>
        <div>
          <span className="stat-num">{zone.disabled}%</span>
          <span className="stat-lab">Living w/ disability</span>
        </div>
        <div>
          <span className="stat-num">{zone.lowIncome}%</span>
          <span className="stat-lab">Low-income HH</span>
        </div>
      </div>

      {/* 2-SECTION RESETTLEMENT MASTERPLAN */}
      {(relocationTarget || isSafeZone) &&
        (() => {
          const shortTarget = relocationTarget?.shortTerm || relocationTarget;
          const permTarget = relocationTarget?.permanent || relocationTarget;
          if (!shortTarget && !permTarget) return null;

          const source = zone;
          const stTarget = shortTarget?.target || zone;
          const stDist = shortTarget?.distKm || 12;
          const stEta =
            stDist > 0 ? Math.max(12, Math.round(stDist * 2.2)) : 25;
          const stFacilities = generateFacilities(stTarget);

          const pmTarget = permTarget?.target || zone;
          const pmDist = permTarget?.distKm || 28;
          const pmScore = permTarget?.sustainabilityScore || 96;
          const pmGrade = permTarget?.sustainabilityGrade || "A+";
          const pmTownship =
            permTarget?.townshipName ||
            `${pmTarget.district} Green Resilient Township`;
          const pmFactors = permTarget?.factors || {
            ecoSafety: 98,
            waterEnergy: 94,
            livelihood: 92,
            resilientHousing: 96,
            infrastructure: 95,
            financialViability: 97,
          };
          const pmHighlights = permTarget?.sustainabilityHighlights || [];

          const getFactor = (offset) => {
            let hash = 0;
            const str = (stTarget.id || "") + (stTarget.name || "");
            for (let i = 0; i < str.length; i++)
              hash = str.charCodeAt(i) + ((hash << 5) - hash);
            return 50 + (Math.abs(hash + offset) % 45); // 50 to 95
          };
          const stFactors = [
            { label: "Hazard safety", val: getFactor(1) },
            { label: "Carrying capacity", val: getFactor(2) },
            { label: "Road accessibility", val: getFactor(3) },
            { label: "Water availability", val: getFactor(4) },
            { label: "Healthcare access", val: getFactor(5) },
            { label: "Education access", val: getFactor(6) },
            { label: "Livelihood continuity", val: getFactor(7) },
            { label: "Distance from habitation", val: getFactor(8) },
          ];
          const stSuitabilityAvg = Math.round(
            stFactors.reduce((a, b) => a + b.val, 0) / 8,
          );
          const stSuitabilityStatus =
            stSuitabilityAvg > 85
              ? "Highly Suitable"
              : stSuitabilityAvg > 75
                ? "Suitable with Improvements"
                : "Needs Major Upgrades";

          return (
            <div
              className="reloc-console-card"
              style={{
                border: "2px solid #143b5d",
                borderRadius: "14px",
                overflow: "hidden",
                background: "var(--panel)",
                marginTop: "16px",
              }}
            >
              {/* Header Title Banner */}
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #143b5d 0%, #1e5a8a 100%)",
                  padding: "14px 16px",
                  color: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontFamily: "Space Grotesk, sans-serif",
                      fontWeight: 700,
                      fontSize: "15px",
                    }}
                  >
                    <Navigation size={18} style={{ color: "#38bdf8" }} />
                    <span>DUAL-SECTION RESETTLEMENT MASTERPLAN</span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "rgba(255,255,255,0.18)",
                      color: "#ffffff",
                      padding: "3px 9px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.3)",
                    }}
                  >
                    SIH 2026 Aligned
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "11.5px",
                    color: "rgba(255,255,255,0.85)",
                    lineHeight: "1.4",
                  }}
                >
                  1. Short-Term Evacuation to Nearest Green Zone &nbsp;•&nbsp;
                  2. Permanent Relocation to Best Location
                  (Sustainability-Driven)
                </p>

                {/* Section Filter Pills */}
                <div style={{ display: "flex", gap: "6px", marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setActiveRelocSection("all")}
                    style={{
                      border: "none",
                      background:
                        activeRelocSection === "all"
                          ? "#ffffff"
                          : "rgba(255,255,255,0.15)",
                      color:
                        activeRelocSection === "all" ? "#143b5d" : "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    📋 Both Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRelocSection("short")}
                    style={{
                      border: "none",
                      background:
                        activeRelocSection === "short"
                          ? "#f59e0b"
                          : "rgba(255,255,255,0.15)",
                      color:
                        activeRelocSection === "short" ? "#000000" : "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    ⚡ Section 1: Short-Term
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRelocSection("permanent")}
                    style={{
                      border: "none",
                      background:
                        activeRelocSection === "permanent"
                          ? "#10b981"
                          : "rgba(255,255,255,0.15)",
                      color:
                        activeRelocSection === "permanent"
                          ? "#ffffff"
                          : "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    🌱 Section 2: Permanent
                  </button>
                </div>
              </div>

              <div style={{ padding: "16px" }}>
                {/* SIDE-BY-SIDE layout when both sections active */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      activeRelocSection === "all"
                        ? "repeat(auto-fit, minmax(min(100%, 400px), 1fr))"
                        : "1fr",
                    gap: "16px",
                    alignItems: "start",
                  }}
                >
                  {/* SECTION 1: SHORT-TERM RESETTLEMENT */}
                  {(activeRelocSection === "all" ||
                    activeRelocSection === "short") && (
                    <div
                      style={{
                        background: "#fef3c7",
                        border: "1.5px solid #f59e0b",
                        borderRadius: "10px",
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                          }}
                        >
                          <span
                            style={{
                              background: "#d97706",
                              color: "#ffffff",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 800,
                            }}
                          >
                            SECTION 1
                          </span>
                          <strong
                            style={{
                              fontSize: "14px",
                              color: "#78350f",
                              fontFamily: "Space Grotesk, sans-serif",
                            }}
                          >
                            ⚡ SHORT-TERM RESETTLEMENT (Emergency Safe Zone)
                          </strong>
                        </div>
                        <span
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            background: "#ffffff",
                            color: "#b45309",
                            padding: "2px 8px",
                            borderRadius: "10px",
                            border: "1px solid #fcd34d",
                          }}
                        >
                          Dijkstra Evacuation Route
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: "11.5px",
                          color: "#92400e",
                          margin: "0 0 10px",
                          lineHeight: "1.4",
                        }}
                      >
                        Immediate emergency evacuation corridor directing
                        citizens to the nearest Green (Medium-Term) safe zone
                        for instant shelter, triage, and medical relief.
                      </p>

                      {/* Route Strip */}
                      <div
                        className="reloc-route-strip"
                        style={{
                          background: "#ffffff",
                          borderRadius: "8px",
                          border: "1px solid #fde68a",
                        }}
                      >
                        <div className="reloc-point reloc-from">
                          <span
                            className="reloc-node-dot"
                            style={{
                              background:
                                source.phase === "Immediate"
                                  ? "var(--immediate)"
                                  : "var(--watch)",
                            }}
                          />
                          <div>
                            <span className="reloc-point-tag">
                              Danger Zone ({source.phase})
                            </span>
                            <strong>{source.name}</strong>
                            <span className="reloc-point-sub">
                              {source.district} · {fmt(source.population)}{" "}
                              evacuees
                            </span>
                          </div>
                        </div>

                        <div className="reloc-route-transit">
                          <ArrowRight size={16} style={{ color: "#d97706" }} />
                          <span style={{ color: "#92400e" }}>
                            {stDist} km · ~{stEta} mins ·{" "}
                            {shortTarget?.hops > 1
                              ? `${shortTarget.hops} hops`
                              : "Direct route"}
                          </span>
                        </div>

                        <div className="reloc-point reloc-to">
                          <span
                            className="reloc-node-dot"
                            style={{ background: "var(--safe)" }}
                          />
                          <div>
                            <span className="reloc-point-tag">
                              Nearest Safe Zone
                            </span>
                            <strong>{stTarget.name}</strong>
                            <span className="reloc-point-sub">
                              {stTarget.district} · Green Safe Zone
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Dijkstra Waypoints */}
                      {shortTarget?.path && shortTarget.path.length > 2 && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "11px",
                            padding: "6px 10px",
                            background: "#ffffff",
                            borderRadius: "6px",
                            border: "1px solid #fde68a",
                            margin: "8px 0",
                          }}
                        >
                          <Route
                            size={12}
                            style={{ color: "#b45309", flexShrink: 0 }}
                          />
                          <span style={{ color: "#92400e", fontWeight: 600 }}>
                            Dijkstra Transit Path:
                          </span>
                          <span style={{ color: "#78350f", fontWeight: 700 }}>
                            {shortTarget.path.map((p) => p.name).join(" ➡ ")}
                          </span>
                        </div>
                      )}

                      {/* Facilities Grid */}
                      <div
                        style={{
                          marginTop: "10px",
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(130px, 1fr))",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #fde68a",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#92400e",
                              fontWeight: 700,
                            }}
                          >
                            Intake Capacity
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 800,
                              color: "#b45309",
                            }}
                          >
                            {fmt(stFacilities.totalCapacity)} slots
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #fde68a",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#92400e",
                              fontWeight: 700,
                            }}
                          >
                            Hospital Beds
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 800,
                              color: "#b45309",
                            }}
                          >
                            {stFacilities.bedsAvailable} beds
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #fde68a",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#92400e",
                              fontWeight: 700,
                            }}
                          >
                            RO Drinking Water
                          </div>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: 800,
                              color: "#047857",
                            }}
                          >
                            {stFacilities.waterPoints} Points
                          </div>
                        </div>
                      </div>

                      {/* Relocation Site Suitability */}
                      <div
                        style={{
                          marginTop: "12px",
                          background: "#fffaf0",
                          border: "1px solid #fde68a",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            marginBottom: "8px",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                color: "#1e293b",
                                fontFamily: "Space Grotesk, sans-serif",
                              }}
                            >
                              🏣 Relocation site suitability
                            </div>
                            <div
                              style={{
                                fontSize: "10px",
                                color: "#64748b",
                                marginTop: "2px",
                              }}
                            >
                              Decision support across eight field factors
                            </div>
                            <div
                              style={{
                                display: "inline-block",
                                background: "#fef3c7",
                                color: "#92400e",
                                fontSize: "9px",
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: "4px",
                                marginTop: "6px",
                              }}
                            >
                              {stSuitabilityStatus}
                            </div>
                          </div>
                          <div
                            style={{ display: "flex", alignItems: "baseline" }}
                          >
                            <span
                              style={{
                                fontSize: "24px",
                                fontWeight: 800,
                                color: "#1e3a8a",
                                fontFamily: "Space Grotesk, sans-serif",
                              }}
                            >
                              {stSuitabilityAvg}
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#64748b",
                                fontWeight: 600,
                              }}
                            >
                              /100
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px 24px",
                            marginTop: "12px",
                          }}
                        >
                          {stFactors.map((bar, i) => {
                            const color =
                              bar.val > 80
                                ? "#10b981"
                                : bar.val > 65
                                  ? "#f59e0b"
                                  : "#ea580c";
                            const bg =
                              bar.val > 80
                                ? "#d1fae5"
                                : bar.val > 65
                                  ? "#fef3c7"
                                  : "#ffedd5";
                            return (
                              <div key={i}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    fontSize: "9px",
                                    color: "#64748b",
                                    marginBottom: "3px",
                                  }}
                                >
                                  <span>{bar.label}</span>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: "#1e3a8a",
                                    }}
                                  >
                                    {bar.val}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    height: "4px",
                                    background: bg,
                                    borderRadius: "2px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height: "100%",
                                      width: `${bar.val}%`,
                                      background: color,
                                      borderRadius: "2px",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {role === "authority" && (
                        <button
                          className="btn-primary full"
                          style={{
                            marginTop: "12px",
                            background: "#d97706",
                            borderColor: "#b45309",
                            color: "#ffffff",
                          }}
                          onClick={() =>
                            onApproveRelocation &&
                            onApproveRelocation({
                              ...shortTarget,
                              type: "Short-Term Evacuation",
                            })
                          }
                        >
                          <CheckCircle2 size={14} /> Approve Short-Term
                          Evacuation Plan ({stTarget.name})
                        </button>
                      )}
                    </div>
                  )}

                  {/* SECTION 2: PERMANENT RELOCATION */}
                  {(activeRelocSection === "all" ||
                    activeRelocSection === "permanent") && (
                    <div
                      style={{
                        background: "#ecfdf5",
                        border: "1.5px solid #10b981",
                        borderRadius: "10px",
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                          }}
                        >
                          <span
                            style={{
                              background: "#059669",
                              color: "#ffffff",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              fontSize: "10px",
                              fontWeight: 800,
                            }}
                          >
                            SECTION 2
                          </span>
                          <strong
                            style={{
                              fontSize: "14px",
                              color: "#065f46",
                              fontFamily: "Space Grotesk, sans-serif",
                            }}
                          >
                            🌱 PERMANENT RELOCATION (Sustainability-Driven)
                          </strong>
                        </div>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 800,
                            background: "#ffffff",
                            color: "#047857",
                            padding: "3px 10px",
                            borderRadius: "12px",
                            border: "1.5px solid #34d399",
                          }}
                        >
                          Sustainability Score: {pmScore}/100 ({pmGrade})
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: "11.5px",
                          color: "#047857",
                          margin: "0 0 12px",
                          lineHeight: "1.4",
                        }}
                      >
                        Proactive long-term resettlement to the highest-scoring
                        candidate location, ensuring permanent ecological
                        safety, solar/water grid autonomy, agricultural rights,
                        and disaster-resilient 2BHK housing.
                      </p>

                      {/* Destination Details */}
                      <div
                        style={{
                          background: "#ffffff",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "1px solid #a7f3d0",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "#059669",
                                textTransform: "uppercase",
                              }}
                            >
                              Best Permanent Location
                            </span>
                            <h4
                              style={{
                                margin: "2px 0 0",
                                fontSize: "15px",
                                color: "#064e3b",
                                fontFamily: "Space Grotesk, sans-serif",
                                fontWeight: 700,
                              }}
                            >
                              {pmTownship}
                            </h4>
                            <span
                              style={{ fontSize: "11px", color: "#047857" }}
                            >
                              {pmTarget.district} District • Distance: {pmDist}{" "}
                              km
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#047857",
                                fontWeight: 600,
                              }}
                            >
                              10-Yr Economic ROI
                            </span>
                            <div
                              style={{
                                fontSize: "16px",
                                fontWeight: 800,
                                color: "#047857",
                              }}
                            >
                              8.7x Savings
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6 Sustainability Factors Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: "8px",
                          marginBottom: "12px",
                        }}
                      >
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            🌏 Ecological Safety
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.ecoSafety}/100
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            ⚡ Solar & Water Grid
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.waterEnergy}/100
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            🌾 Livelihood Access
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.livelihood}/100
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            🏠 Resilient Housing
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.resilientHousing}/100
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            🏥 Health & School
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.infrastructure}/100
                          </div>
                        </div>
                        <div
                          style={{
                            background: "#ffffff",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            border: "1px solid #a7f3d0",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#047857",
                              fontWeight: 700,
                            }}
                          >
                            💰 Climate Fund Grant
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              fontWeight: 800,
                              color: "#065f46",
                            }}
                          >
                            {pmFactors.financialViability}/100
                          </div>
                        </div>
                      </div>

                      {/* Highlights Bullet List */}
                      <div
                        style={{
                          background: "#ffffff",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid #a7f3d0",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#065f46",
                            marginBottom: "6px",
                          }}
                        >
                          Sustainability Checklist & Guarantees:
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: "8px 12px",
                            fontSize: "11px",
                            color: "#047857",
                          }}
                        >
                          {pmHighlights.map((hl, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "6px",
                                wordBreak: "break-word",
                              }}
                            >
                              <div style={{ flexShrink: 0, marginTop: "1px" }}>
                                <Check size={12} style={{ color: "#059669" }} />
                              </div>
                              <span style={{ flex: 1, lineHeight: "1.3" }}>
                                {hl}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {role === "authority" && (
                        <button
                          className="btn-primary full"
                          style={{
                            marginTop: "12px",
                            background:
                              "linear-gradient(135deg, #059669, #047857)",
                            borderColor: "#065f46",
                            color: "#ffffff",
                          }}
                          onClick={() =>
                            onApproveRelocation &&
                            onApproveRelocation({
                              ...permTarget,
                              type: "Permanent Sustainable Resettlement",
                            })
                          }
                        >
                          <CheckCircle2 size={14} /> Approve Permanent
                          Resettlement Masterplan ({pmTownship})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Safe Receiving Zone Profile if this zone is already green */}
      {isSafeZone && safeZoneFacilities && (
        <div className="reloc-console-card safe-profile-card">
          <div className="reloc-console-head">
            <div className="reloc-console-title">
              <ShieldCheck size={16} style={{ color: "var(--safe)" }} />
              <div>
                <strong>Designated Safe Receiving Zone</strong>
                <span>
                  Prepared to host evacuees from surrounding hazard areas
                </span>
              </div>
            </div>
            <span
              className="badge"
              style={{
                background: "rgba(33,132,95,0.15)",
                color: "var(--safe)",
              }}
            >
              Low Risk
            </span>
          </div>
          <div className="reloc-kpis">
            <div>
              <strong>{fmt(safeZoneFacilities.totalCapacity)}</strong>
              <span>Intake capacity</span>
            </div>
            <div>
              <strong>{safeZoneFacilities.bedsAvailable}</strong>
              <span>Hospital beds</span>
            </div>
            <div>
              <strong>{safeZoneFacilities.hospitals.length}</strong>
              <span>Hospitals active</span>
            </div>
          </div>
          <p
            style={{
              fontSize: "11px",
              color: "var(--ink-soft)",
              margin: "6px 0 0",
            }}
          >
            Road accessibility rating:{" "}
            <strong>{"★".repeat(safeZoneFacilities.roadRating)}</strong> ·{" "}
            {safeZoneFacilities.shelters.length} community shelters available.
          </p>
        </div>
      )}

      <div className="site-card">
        <div className="site-card-head">
          <Building2 size={14} />
          <span>Relocation site match</span>
        </div>
        {zone.site.status === "matched" && (
          <p>
            <CheckCircle2 size={13} className="ok-icon" /> {zone.site.name} —{" "}
            <strong>{zone.site.utilization}%</strong> of intake capacity
            allocated.
          </p>
        )}
        {zone.site.status === "shortfall" && (
          <p>
            <AlertTriangle size={13} className="warn-icon" /> {zone.site.name}{" "}
            would exceed capacity at <strong>{zone.site.utilization}%</strong> —
            flagged to avoid a relocation-slum outcome. Additional site
            required.
          </p>
        )}
        {zone.site.status === "pending" && (
          <p className="muted">
            No site matching run yet for this medium-term zone.
          </p>
        )}
        <div className="site-meta">
          Last surveyed {zone.lastSurveyed} · {zone.hazard}
        </div>
      </div>
      <SiteSuitability zone={zone} />

      {role === "authority" ? (
        <div className="action-row">
          <button className="btn-primary" onClick={() => onCertificate(zone)}>
            <FileText size={14} /> Generate legal certificate
          </button>
          <button className="btn-ghost" onClick={() => onAlert(zone)}>
            <Radio size={14} /> Send community alert
          </button>
        </div>
      ) : (
        <div className="action-row">
          <button
            className={`btn-primary ${subscribed ? "is-on" : ""}`}
            onClick={() => onSubscribe(zone.id)}
          >
            <Bell size={14} />{" "}
            {subscribed ? "Subscribed to alerts" : "Subscribe to alerts"}
          </button>
        </div>
      )}
    </div>
  );
}

function BriefModal({
  open,
  onClose,
  zones,
  selectedZone,
  district,
  lastSync,
}) {
  const [copied, setCopied] = useState(false);
  if (!open) return null;

  const immediate = zones.filter((z) => z.phase === "Immediate");
  const shortTerm = zones.filter((z) => z.phase === "Short-Term");
  const medTerm = zones.filter((z) => z.phase === "Medium-Term");
  const totalPop = zones.reduce((s, z) => s + z.population, 0);
  const immPop = immediate.reduce((s, z) => s + z.population, 0);
  const shortfalls = zones.filter((z) => z.site.status === "shortfall");
  const now = lastSync.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const briefText = [
    `DISTRICT PLANNING BRIEF — BHOOMI RAKSHAK 2.0`,
    `Generated: ${now}  |  District: ${district}`,
    ``,
    `SITUATION SUMMARY`,
    `${zones.length} vulnerable zones are under active monitoring.`,
    `Total population at risk: ${fmt(totalPop)} people across ${[...new Set(zones.map((z) => z.district))].length} district(s).`,
    ``,
    `IMMEDIATE ACTION (${immediate.length} zones — ${fmt(immPop)} people)`,
    ...immediate.map(
      (z) =>
        `  • ${z.id} — ${z.name}, ${z.district}\n    Hazard: ${z.hazard} | Priority: ${z.priorityScore}/100 | Site: ${z.site.status === "matched" ? z.site.name + " (" + z.site.utilization + "% used)" : z.site.status === "shortfall" ? "CAPACITY SHORTFALL — " + z.site.name : "Pending"}`,
    ),
    ``,
    `SHORT-TERM (${shortTerm.length} zones)`,
    ...shortTerm.map(
      (z) => `  • ${z.id} — ${z.name} | Priority: ${z.priorityScore}/100`,
    ),
    ``,
    `MEDIUM-TERM (${medTerm.length} zones)`,
    ...medTerm.map(
      (z) => `  • ${z.id} — ${z.name} | Priority: ${z.priorityScore}/100`,
    ),
    ``,
    shortfalls.length
      ? `⚠ CAPACITY ALERTS: ${shortfalls.length} site(s) flagged for over-capacity — ${shortfalls.map((z) => z.site.name).join(", ")}. Additional relocation sites required before phase-1 order.`
      : `✓ No relocation site capacity shortfalls detected.`,
    ``,
    selectedZone
      ? `SELECTED FOCUS ZONE: ${selectedZone.id} — ${selectedZone.name}\n  Phase: ${selectedZone.phase} | Priority: ${selectedZone.priorityScore}/100 | Population: ${fmt(selectedZone.population)}\n  ${selectedZone.explanation}`
      : ``,
    ``,
    `---`,
    `Bhoomi Rakshak · District Disaster Management Authority · Sample Planning Record`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(briefText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `BhoomiRakshak_Situational_Brief_${district ? district.replace(/[^a-zA-Z0-9]/g, "_") : "All_Districts"}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="brief-shell" onClick={(e) => e.stopPropagation()}>
        <div className="brief-header">
          <div className="brief-header-left">
            <div className="brief-icon">
              <FileText size={18} />
            </div>
            <div>
              <div className="brief-title">Situational Planning Brief</div>
              <div className="brief-sub">
                District: {district} · {now}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="brief-kpis">
          <div className="brief-kpi">
            <strong style={{ color: "var(--immediate)" }}>
              {immediate.length}
            </strong>
            <span>Immediate zones</span>
          </div>
          <div className="brief-kpi">
            <strong style={{ color: "var(--watch)" }}>
              {shortTerm.length}
            </strong>
            <span>Short-term</span>
          </div>
          <div className="brief-kpi">
            <strong style={{ color: "var(--safe)" }}>{medTerm.length}</strong>
            <span>Medium-term</span>
          </div>
          <div className="brief-kpi">
            <strong>{fmt(totalPop)}</strong>
            <span>People at risk</span>
          </div>
          <div className={`brief-kpi ${shortfalls.length ? "kpi-alert" : ""}`}>
            <strong
              style={{
                color: shortfalls.length ? "var(--immediate)" : "inherit",
              }}
            >
              {shortfalls.length}
            </strong>
            <span>Capacity alerts</span>
          </div>
        </div>

        <div className="brief-scroll">
          <div className="brief-section-title">⚡ Immediate Action Zones</div>
          {immediate.length === 0 && (
            <div className="brief-empty">
              No immediate zones in current filter.
            </div>
          )}
          {immediate.map((z) => (
            <div key={z.id} className="brief-zone-row">
              <div
                className="brief-zone-id"
                style={{ color: "var(--immediate)" }}
              >
                {z.id}
              </div>
              <div className="brief-zone-info">
                <div className="brief-zone-name">{z.name}</div>
                <div className="brief-zone-meta">
                  {z.hazard} · {fmt(z.population)} people · Priority{" "}
                  {z.priorityScore}/100
                </div>
                <div className={`brief-site-status ${z.site.status}`}>
                  {z.site.status === "matched" && (
                    <>
                      <CheckCircle2 size={11} /> {z.site.name} —{" "}
                      {z.site.utilization}% capacity
                    </>
                  )}
                  {z.site.status === "shortfall" && (
                    <>
                      <AlertTriangle size={11} /> CAPACITY SHORTFALL —{" "}
                      {z.site.name} ({z.site.utilization}%)
                    </>
                  )}
                  {z.site.status === "pending" && <>⏳ Site matching pending</>}
                </div>
              </div>
              <div
                className="brief-zone-score"
                style={{ color: "var(--immediate)" }}
              >
                {z.priorityScore}
              </div>
            </div>
          ))}

          {shortTerm.length > 0 && (
            <>
              <div className="brief-section-title">📋 Short-Term Zones</div>
              {shortTerm.map((z) => (
                <div key={z.id} className="brief-zone-row compact">
                  <div
                    className="brief-zone-id"
                    style={{ color: "var(--watch)" }}
                  >
                    {z.id}
                  </div>
                  <div className="brief-zone-info">
                    <div className="brief-zone-name">{z.name}</div>
                    <div className="brief-zone-meta">
                      {z.district} · Priority {z.priorityScore}/100
                    </div>
                  </div>
                  <div
                    className="brief-zone-score"
                    style={{ color: "var(--watch)" }}
                  >
                    {z.priorityScore}
                  </div>
                </div>
              ))}
            </>
          )}

          {shortfalls.length > 0 && (
            <div className="brief-alert-banner">
              <AlertTriangle size={14} />
              <div>
                <strong>Capacity Alert:</strong> {shortfalls.length} site(s) are
                over-capacity — {shortfalls.map((z) => z.site.name).join("; ")}.
                Additional relocation sites must be secured before issuing
                phase-1 orders.
              </div>
            </div>
          )}

          {selectedZone && (
            <>
              <div className="brief-section-title">
                🔍 Focus Zone: {selectedZone.id}
              </div>
              <div className="brief-focus-card">
                <div className="brief-focus-name">{selectedZone.name}</div>
                <p className="brief-focus-explanation">
                  {selectedZone.explanation}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="brief-actions">
          <button className="btn-primary" onClick={handleCopy}>
            {copied ? (
              <>
                <CheckCircle2 size={14} /> Copied!
              </>
            ) : (
              <>
                <ClipboardList size={14} /> Copy as Text
              </>
            )}
          </button>
          <button className="btn-ghost" onClick={handlePrint}>
            <Printer size={14} /> Print / PDF
          </button>
          <button className="btn-ghost" onClick={onClose}>
            <X size={14} /> Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CertificateModal({ zone, onClose }) {
  const [generating, setGenerating] = useState(true);
  const [step, setStep] = useState(0);
  const steps = [
    "Verifying zone data…",
    "Computing risk hash…",
    "Signing with authority key…",
    "Certificate ready.",
  ];

  useEffect(() => {
    if (!zone) return;
    setGenerating(true);
    setStep(0);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setStep(i);
      if (i >= steps.length - 1) {
        clearInterval(t);
        setTimeout(() => setGenerating(false), 600);
      }
    }, 500);
    return () => clearInterval(t);
  }, [zone]);

  if (!zone) return null;
  const hash = `BR-${zone.id}-${(zone.priorityScore * 7919).toString(16).toUpperCase().padStart(8, "0")}`;
  const issueDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const phaseColor = PHASE_COLOR[zone.phase];

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
      <div className="cert-shell" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={16} />
        </button>

        {generating ? (
          <div className="cert-generating">
            <div className="cert-gen-icon">
              <ClipboardList size={28} />
            </div>
            <div className="cert-gen-title">Generating Certificate</div>
            <div className="cert-gen-steps">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`cert-gen-step ${i <= step ? "done" : ""} ${i === step ? "active" : ""}`}
                >
                  <span className="cert-gen-dot" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="certificate" id="cert-printable">
            {/* Watermark border */}
            <div className="cert-watermark-border" />

            {/* Header */}
            <div className="cert-gov-header">
              <div className="cert-emblem">
                <div className="cert-emblem-ring">
                  <span>BR</span>
                </div>
              </div>
              <div className="cert-gov-titles">
                <div className="cert-gov-sup">
                  Government of India — Disaster Management Authority
                </div>
                <div className="cert-gov-name">BHOOMI RAKSHAK 2.0</div>
                <div className="cert-gov-sub">
                  Hazard Mapping &amp; Relocation Planning System
                </div>
              </div>
            </div>

            <div className="cert-divider" />

            <div className="cert-doc-title">
              <span className="cert-doc-label">
                RED ZONE PRIORITIZATION CERTIFICATE
              </span>
              <span
                className="cert-doc-status"
                style={{ background: phaseColor }}
              >
                PHASE: {zone.phase.toUpperCase()}
              </span>
            </div>

            {/* Zone identity block */}
            <div className="cert-zone-block">
              <div>
                <div className="cert-zone-id">{zone.id}</div>
                <div className="cert-zone-name">{zone.name}</div>
                <div className="cert-zone-loc">
                  <MapPin size={11} /> {zone.district}
                </div>
              </div>
              <div
                className="cert-score-circle"
                style={{ borderColor: phaseColor }}
              >
                <span style={{ color: phaseColor }}>{zone.priorityScore}</span>
                <small>/100</small>
              </div>
            </div>

            {/* Data grid */}
            <div className="cert-data-grid">
              <div className="cert-data-cell">
                <span>Hazard Type</span>
                <strong>{zone.hazard}</strong>
              </div>
              <div className="cert-data-cell">
                <span>Population Affected</span>
                <strong>{fmt(zone.population)}</strong>
              </div>
              <div className="cert-data-cell">
                <span>Hazard Intensity</span>
                <strong>{zone.hazardIntensity} / 100</strong>
              </div>
              <div className="cert-data-cell">
                <span>Exposure Index</span>
                <strong>{zone.exposure} / 100</strong>
              </div>
              <div className="cert-data-cell">
                <span>Vulnerability Index</span>
                <strong>{zone.vulnerability} / 100</strong>
              </div>
              <div className="cert-data-cell">
                <span>Last Field Survey</span>
                <strong>{zone.lastSurveyed}</strong>
              </div>
            </div>

            {/* Relocation site */}
            <div className="cert-site-block">
              <div className="cert-site-label">
                <Building2 size={12} /> Designated Relocation Site
              </div>
              {zone.site.status === "matched" && (
                <div className="cert-site-val ok">
                  {zone.site.name}{" "}
                  <em>({zone.site.utilization}% capacity utilised)</em>
                </div>
              )}
              {zone.site.status === "shortfall" && (
                <div className="cert-site-val warn">
                  {zone.site.name}{" "}
                  <em>
                    — capacity shortfall flagged ({zone.site.utilization}%).
                    Additional site required.
                  </em>
                </div>
              )}
              {zone.site.status === "pending" && (
                <div className="cert-site-val muted">
                  Site matching not yet completed for this zone.
                </div>
              )}
            </div>

            {/* Explanation */}
            <div className="cert-rationale">
              <div className="cert-rationale-label">
                <ShieldCheck size={12} /> Classification Rationale
              </div>
              <p>{zone.explanation}</p>
            </div>

            <div className="cert-divider" />

            {/* Footer / signatures */}
            <div className="cert-signatures">
              <div className="cert-sig-block">
                <div className="cert-sig-line" />
                <div className="cert-sig-name">District Collector</div>
                <div className="cert-sig-sub">{zone.district}</div>
              </div>
              <div className="cert-sig-block">
                <div className="cert-sig-line" />
                <div className="cert-sig-name">DDMA Officer</div>
                <div className="cert-sig-sub">
                  District Disaster Mgmt. Authority
                </div>
              </div>
              <div className="cert-sig-block cert-hash-block">
                <div className="cert-hash-bars">
                  {hash.split("").map((c, i) => (
                    <span
                      key={i}
                      style={{ height: `${6 + (c.charCodeAt(0) % 14)}px` }}
                    />
                  ))}
                </div>
                <div className="cert-hash-code">{hash}</div>
                <div className="cert-sig-sub">
                  Tamper-evident ID · {issueDate}
                </div>
              </div>
            </div>

            <div className="cert-footer-note">
              This is a system-generated planning record for demonstration
              purposes. · Bhoomi Rakshak · Sample Planning Data
            </div>
          </div>
        )}

        {!generating && (
          <div className="cert-actions">
            <button className="btn-primary" onClick={handlePrint}>
              <Printer size={14} /> Print / Save as PDF
            </button>
            <button className="btn-ghost" onClick={onClose}>
              <X size={14} /> Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PhasingTab({ zones, onSelect }) {
  const [pages, setPages] = useState({
    Immediate: 1,
    "Short-Term": 1,
    "Medium-Term": 1,
  });
  const pageSize = 20;

  const setColPage = (phase, updater) => {
    setPages((prev) => ({
      ...prev,
      [phase]:
        typeof updater === "function" ? updater(prev[phase] || 1) : updater,
    }));
  };

  return (
    <div className="kanban">
      {PHASES.map((phase) => {
        const list = zones
          .filter((z) => z.phase === phase)
          .sort((a, b) => b.priorityScore - a.priorityScore);
        const totalPop = list.reduce((s, z) => s + z.population, 0);
        const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
        const curPage = Math.min(totalPages, pages[phase] || 1);
        const displayed = list.slice(
          (curPage - 1) * pageSize,
          curPage * pageSize,
        );

        return (
          <div className="kanban-col" key={phase}>
            <div
              className="kanban-head"
              style={{
                borderColor: PHASE_COLOR[phase],
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{phase}</span>
              <span className="muted small">
                {list.length} zones · {fmt(totalPop)} people
              </span>
            </div>

            {displayed.map((z) => (
              <button
                key={z.id}
                className="kanban-card"
                onClick={() => onSelect(z.id)}
              >
                <div className="kanban-card-top">
                  <span className="zone-code-sm">{z.id}</span>
                  <span style={{ color: PHASE_COLOR[phase] }}>
                    {z.priorityScore}
                  </span>
                </div>
                <div className="kanban-card-name">{z.name}</div>
                <div
                  className="muted small"
                  style={{ fontSize: "10.5px", marginBottom: "4px" }}
                >
                  {z.district}
                </div>
                <AnimatedBar
                  value={z.priorityScore}
                  color={PHASE_COLOR[phase]}
                  height={5}
                  trackKey={z.id}
                />
                <div className="kanban-card-foot muted small">
                  {fmt(z.population)} people · {z.hazard}
                </div>
              </button>
            ))}

            {displayed.length === 0 && (
              <div
                style={{
                  padding: "20px",
                  textAlign: "center",
                  color: "var(--ink-soft)",
                  fontSize: "11.5px",
                }}
              >
                No {phase.toLowerCase()} zones found.
              </div>
            )}

            {/* Pagination Controls for this Column */}
            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 4px",
                  marginTop: "auto",
                  borderTop: "1px solid var(--line)",
                  fontSize: "11px",
                }}
              >
                <button
                  onClick={() => setColPage(phase, (p) => Math.max(1, p - 1))}
                  disabled={curPage === 1}
                  className="btn-ghost sm"
                  style={{
                    padding: "3px 6px",
                    fontSize: "10.5px",
                    cursor: curPage === 1 ? "not-allowed" : "pointer",
                    opacity: curPage === 1 ? 0.4 : 1,
                  }}
                >
                  <ArrowLeft size={11} /> Prev
                </button>
                <span className="muted small">
                  <strong>{curPage}</strong> / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setColPage(phase, (p) => Math.min(totalPages, p + 1))
                  }
                  disabled={curPage >= totalPages}
                  className="btn-ghost sm"
                  style={{
                    padding: "3px 6px",
                    fontSize: "10.5px",
                    cursor: curPage >= totalPages ? "not-allowed" : "pointer",
                    opacity: curPage >= totalPages ? 0.4 : 1,
                  }}
                >
                  Next <ArrowRight size={11} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AnalyticsTab({ zones }) {
  const barData = useMemo(
    () =>
      [...zones]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 30)
        .map((z) => ({ name: z.id, score: z.priorityScore, phase: z.phase })),
    [zones],
  );
  const pieData = useMemo(
    () =>
      PHASES.map((p) => ({
        name: p,
        value: zones
          .filter((z) => z.phase === p)
          .reduce((s, z) => s + z.population, 0),
      })),
    [zones],
  );
  const totalPop = useMemo(
    () => zones.reduce((s, z) => s + z.population, 0),
    [zones],
  );
  const avgScore = useMemo(
    () =>
      zones.length
        ? Math.round(
            zones.reduce((s, z) => s + z.priorityScore, 0) / zones.length,
          )
        : 0,
    [zones],
  );
  const shortfall = useMemo(
    () => zones.filter((z) => z.site.status === "shortfall").length,
    [zones],
  );
  return (
    <div className="analytics">
      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-card-num">{zones.length}</span>
          <span className="stat-card-lab">Mapped red zones</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{fmt(totalPop)}</span>
          <span className="stat-card-lab">People at risk</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-num">{avgScore}</span>
          <span className="stat-card-lab">Average priority score</span>
        </div>
        <div
          className="stat-card"
          style={{
            borderColor: shortfall ? "var(--immediate)" : "var(--line)",
          }}
        >
          <span
            className="stat-card-num"
            style={{ color: shortfall ? "var(--immediate)" : "inherit" }}
          >
            {shortfall}
          </span>
          <span className="stat-card-lab">Sites flagged over-capacity</span>
        </div>
      </div>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Top 30 priority scores by zone</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={barData}
              margin={{ top: 4, right: 8, left: -18, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--line)"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--ink-soft)" }}
                axisLine={{ stroke: "var(--line)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  fontSize: 12,
                  borderRadius: 6,
                }}
              />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={PHASE_COLOR[d.phase]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <div className="chart-title">Population at risk by phase</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {pieData.map((d, i) => (
                  <Cell key={i} fill={PHASE_COLOR[d.name]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  fontSize: 12,
                  borderRadius: 6,
                }}
                formatter={(v) => fmt(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ReportsTab({ zones, onCertificate }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.district.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q),
    );
  }, [zones, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.priorityScore - a.priorityScore),
    [filtered],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  // Reset to page 1 if filter changes
  useEffect(() => {
    setPage(1);
  }, [search, zones]);

  const displayed = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  return (
    <div className="reports">
      <div className="reports-head">
        <span>Legal certificates & audit trail</span>
        <span className="muted small">
          Showing {displayed.length} of {sorted.length} audited zones (20 per
          page)
        </span>
      </div>
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--line)",
          background: "var(--panel)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <input
          type="text"
          placeholder="Filter legal registry by zone, district, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "340px",
            padding: "6px 10px",
            fontSize: "12px",
            border: "1px solid var(--line)",
            borderRadius: "6px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11.5px",
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost sm"
            style={{
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            <ArrowLeft size={12} /> Prev
          </button>
          <span>
            Page <strong>{page}</strong> of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-ghost sm"
            style={{
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            Next <ArrowRight size={12} />
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table className="report-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>District</th>
              <th>Phase</th>
              <th>Score</th>
              <th>Last survey</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((z) => (
              <tr key={z.id}>
                <td>
                  <span className="zone-code-sm">{z.id}</span> {z.name}
                </td>
                <td className="muted">{z.district}</td>
                <td>
                  <PhaseBadge phase={z.phase} />
                </td>
                <td style={{ color: PHASE_COLOR[z.phase], fontWeight: 600 }}>
                  {z.priorityScore}
                </td>
                <td className="muted">{z.lastSurveyed}</td>
                <td>
                  <button
                    className="btn-ghost sm"
                    onClick={() => onCertificate(z)}
                  >
                    <FileText size={12} /> Certificate
                  </button>
                </td>
              </tr>
            ))}
            {displayed.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "var(--ink-soft)",
                  }}
                >
                  No records matching your search query.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        style={{
          padding: "10px 14px",
          borderTop: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "var(--ink-soft)",
        }}
      >
        <span>
          Showing records {(page - 1) * pageSize + 1} to{" "}
          {Math.min(page * pageSize, sorted.length)} of {sorted.length} total
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost sm"
            style={{
              cursor: page === 1 ? "not-allowed" : "pointer",
              opacity: page === 1 ? 0.5 : 1,
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn-ghost sm"
            style={{
              cursor: page >= totalPages ? "not-allowed" : "pointer",
              opacity: page >= totalPages ? 0.5 : 1,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const centerCoords =
    zone && zone.lat && zone.lng ? [zone.lat, zone.lng] : [28.668, 77.308];

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
        },
      );
    }
  };

  const handleRecenter = () => {
    if (mapInstance && zone && zone.lat && zone.lng) {
      mapInstance.flyTo([zone.lat, zone.lng], 14, { duration: 1 });
    }
  };

  const handleFocusRoute = () => {
    if (
      mapInstance &&
      relocationTarget &&
      relocationTarget.path &&
      relocationTarget.path.length > 1
    ) {
      const bounds = L.latLngBounds(
        relocationTarget.path.map((p) => [p.lat, p.lng]),
      );
      mapInstance.fitBounds(bounds, { padding: [40, 40], duration: 1.2 });
    }
  };

  return (
    <div className="citizen-map-box">
      <div className="citizen-map-header">
        <div className="citizen-map-title">
          <Satellite size={15} style={{ color: "var(--brand-2)" }} />
          <span>
            Live High-Resolution Satellite GIS · Local Hazard & Shelter View
          </span>
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
              🚰️ Satellite
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
              ⚰️ Topo
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
          style={{
            height: "350px",
            width: "100%",
            borderRadius: "0 0 10px 10px",
          }}
        >
          <MapResizer />
          <MapInstanceSetter onMap={setMapInstance} />
          <TileLayer
            key={tile.id}
            url={tile.url}
            attribution={tile.attribution}
            maxZoom={tile.maxZoom}
          />
          <ZoomControl position="topright" />

          {/* Citizen Community Hazard Perimeter & Center Marker */}
          {zone && zone.lat && zone.lng && (
            <>
              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={32}
                pathOptions={{
                  color:
                    zone.phase === "Immediate"
                      ? "#dc2626"
                      : zone.phase === "Short-Term"
                        ? "#d97706"
                        : "#059669",
                  weight: 2,
                  fillColor:
                    zone.phase === "Immediate"
                      ? "#dc2626"
                      : zone.phase === "Short-Term"
                        ? "#d97706"
                        : "#059669",
                  fillOpacity: 0.22,
                  dashArray: "5, 5",
                }}
              />
              <CircleMarker
                center={[zone.lat, zone.lng]}
                radius={10}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor:
                    zone.phase === "Immediate"
                      ? "#dc2626"
                      : zone.phase === "Short-Term"
                        ? "#d97706"
                        : "#059669",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div
                    style={{
                      padding: "4px 2px",
                      fontSize: "12px",
                      minWidth: "180px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "var(--brand)",
                        fontSize: "13px",
                      }}
                    >
                      📍 {zone.name}
                    </div>
                    <div
                      style={{
                        color: "var(--ink-soft)",
                        fontSize: "11px",
                        marginBottom: "4px",
                      }}
                    >
                      {zone.district}
                    </div>
                    <div
                      style={{
                        borderTop: "1px solid var(--line)",
                        paddingTop: "5px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Hazard:</span>
                        <strong
                          style={{
                            color:
                              zone.phase === "Immediate"
                                ? "#dc2626"
                                : "#d97706",
                          }}
                        >
                          {zone.hazard}
                        </strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Priority Score:</span>
                        <strong>{zone.priorityScore} / 100</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Status:</span>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              zone.phase === "Immediate"
                                ? "#dc2626"
                                : "#059669",
                          }}
                        >
                          {zone.phase}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Residents at risk:</span>
                        <strong>
                          {zone.population?.toLocaleString() || "0"}
                        </strong>
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
                center={[
                  relocationTarget.target.lat,
                  relocationTarget.target.lng,
                ]}
                radius={24}
                pathOptions={{
                  color: "#059669",
                  weight: 2,
                  fillColor: "#10b981",
                  fillOpacity: 0.25,
                }}
              />
              <CircleMarker
                center={[
                  relocationTarget.target.lat,
                  relocationTarget.target.lng,
                ]}
                radius={11}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#059669",
                  fillOpacity: 1,
                }}
              >
                <Popup>
                  <div
                    style={{
                      padding: "4px 2px",
                      fontSize: "12px",
                      minWidth: "190px",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#059669",
                        fontSize: "13px",
                      }}
                    >
                      🟢 Designated Safe Relief Shelter
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "12.5px" }}>
                      {relocationTarget.target.site?.name ||
                        relocationTarget.target.name}
                    </div>
                    <div
                      style={{
                        color: "var(--ink-soft)",
                        fontSize: "11px",
                        marginBottom: "4px",
                      }}
                    >
                      {relocationTarget.target.district}
                    </div>
                    <div
                      style={{
                        borderTop: "1px solid var(--line)",
                        paddingTop: "5px",
                        fontSize: "11.5px",
                      }}
                    >
                      <div>
                        🚗 Transit Distance:{" "}
                        <strong>{relocationTarget.distKm} km</strong>
                      </div>
                      <div>
                        🚶 Evacuation ETA:{" "}
                        <strong>
                          ~
                          {Math.max(
                            12,
                            Math.round(relocationTarget.distKm * 2.2),
                          )}{" "}
                          mins
                        </strong>
                      </div>
                      <div
                        style={{
                          color: "#059669",
                          marginTop: "3px",
                          fontWeight: 600,
                        }}
                      >
                        ✓ Verified Drinking Water & Clinic
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </>
          )}

          {/* Evacuation Route Polyline */}
          {relocationTarget &&
            relocationTarget.path &&
            relocationTarget.path.length > 1 && (
              <Polyline
                positions={relocationTarget.path.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: "#10b981",
                  weight: 4.5,
                  opacity: 0.95,
                  dashArray: "8, 8",
                }}
              />
            )}

          {/* Nearby District Zones */}
          {zones &&
            zones
              .filter(
                (z) =>
                  z.id !== zone?.id &&
                  z.district === zone?.district &&
                  z.lat &&
                  z.lng,
              )
              .slice(0, 16)
              .map((otherZone) => (
                <CircleMarker
                  key={otherZone.id}
                  center={[otherZone.lat, otherZone.lng]}
                  radius={5.5}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 1.5,
                    fillColor:
                      otherZone.phase === "Immediate"
                        ? "#dc2626"
                        : otherZone.phase === "Short-Term"
                          ? "#d97706"
                          : "#059669",
                    fillOpacity: 0.85,
                  }}
                  eventHandlers={{
                    click: () => onSelect && onSelect(otherZone.id),
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -5]}>
                    <div style={{ fontSize: "11px" }}>
                      <strong>{otherZone.name}</strong> (
                      {otherZone.priorityScore}/100)
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              ))}
        </MapContainer>

        {/* Legend */}
        <div className="citizen-map-legend">
          <div className="citizen-legend-item">
            <span
              className="legend-dot"
              style={{
                background: zone?.phase === "Immediate" ? "#dc2626" : "#d97706",
              }}
            />
            <span>Community Hazard Risk</span>
          </div>
          {relocationTarget && (
            <>
              <div className="citizen-legend-item">
                <span
                  className="legend-dot"
                  style={{ background: "#059669" }}
                />
                <span>Designated Safe Relief Shelter</span>
              </div>
              <div className="citizen-legend-item">
                <span
                  className="legend-line"
                  style={{ borderColor: "#10b981" }}
                />
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

function CitizenTab({
  zones,
  selectedId,
  onSelect,
  feedback,
  onSubmitFeedback,
  lang,
  setLang,
  subscribed,
  onSubscribe,
  selectedIdRef,
  relocationTarget,
}) {
  const [text, setText] = useState("");
  const [zoneChoice, setZoneChoice] = useState(
    selectedId || zones[0]?.id || "",
  );
  const [category, setCategory] = useState("Rising Water / Submerged Road");
  const [urgency, setUrgency] = useState("High");
  const [phone, setPhone] = useState("");
  const [attachGps, setAttachGps] = useState(true);
  const [ticketSubmitted, setTicketSubmitted] = useState(null);
  const [honeypot, setHoneypot] = useState("");
  const [fontScale, setFontScale] = useState("normal"); // 'normal' | 'large' | 'xlarge'
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [showSimulateAlert, setShowSimulateAlert] = useState(false);

  // 72-Hour Preparedness Go-Bag Checklist
  const [checklist, setChecklist] = useState([
    {
      id: "water",
      en: "Drinking Water (3 Liters per person per day)",
      hi: "पीने का साफ पानी (प्रति व्यक्ति 3 लीटर प्रतिदिन)",
      packed: true,
    },
    {
      id: "food",
      en: "Ready-to-Eat Dry Food, Biscuits & ORS Packets",
      hi: "सूखा व तैयार भोजन, बिस्कुट और ओआरएस पैकेट",
      packed: true,
    },
    {
      id: "docs",
      en: "Waterproof Pouch: Aadhaar, Ration Card, Passbooks",
      hi: "वाटरप्रूफ थैली: आधार कार्ड, राशन कार्ड, बैंक पासबुक",
      packed: true,
    },
    {
      id: "meds",
      en: "First Aid Kit & 7-Day Prescription Medications",
      hi: "प्राथमिक चिकित्सा किट और 7 दिन की जरूरी दवाएं",
      packed: false,
    },
    {
      id: "torch",
      en: "High-Beam Torch & Extra Dry Cell Batteries",
      hi: "तेज रोशनी वाली टॉर्च और अतिरिक्त बैटरियां",
      packed: false,
    },
    {
      id: "power",
      en: "Fully Charged Power Bank & Mobile Cables",
      hi: "फुल चार्ज पावर बैंक और मोबाइल चार्जिंग केबल",
      packed: false,
    },
    {
      id: "cash",
      en: "Emergency Cash in Small ₹100/₹200 Notes",
      hi: "छोटे नोटों में नकद राशि (ATM/UPI ठप होने पर)",
      packed: false,
    },
    {
      id: "whistle",
      en: "Whistle for Signaling Rescue Boats & NDRF Teams",
      hi: "रेस्क्यू टीम को आवाज देने के लिए सीटी (Whistle)",
      packed: false,
    },
  ]);

  const toggleChecklistItem = (id) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, packed: !item.packed } : item,
      ),
    );
  };

  const markAllChecklist = (state) => {
    setChecklist((prev) => prev.map((item) => ({ ...item, packed: state })));
  };

  const packedCount = checklist.filter((c) => c.packed).length;
  const packPercent = Math.round((packedCount / checklist.length) * 100);

  const zone = zones.find((z) => z.id === selectedId) || zones[0];
  const history = zone ? getHistory(zone) : { events: 1, severity: "Moderate" };

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
        name:
          zone.site?.name ||
          `${zone.district.split(",")[0]} Disaster Relief Center`,
        district: zone.district,
        lat: (zone.lat || 28.66) + 0.035,
        lng: (zone.lng || 77.3) + 0.041,
        population: 8500,
        site: {
          status: "matched",
          name: zone.site?.name || "District Multi-Purpose Relief Shelter",
          utilization: 55,
        },
      },
      distKm: 4.8,
      hops: 1,
      path: [
        { name: zone.name, lat: zone.lat || 28.66, lng: zone.lng || 77.3 },
        {
          name: "Sector Transit Corridor",
          lat: (zone.lat || 28.66) + 0.016,
          lng: (zone.lng || 77.3) + 0.02,
        },
        {
          name: zone.site?.name || "District Relief Center",
          lat: (zone.lat || 28.66) + 0.035,
          lng: (zone.lng || 77.3) + 0.041,
        },
      ],
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

    const shelterName =
      activeRelocTarget?.target?.site?.name ||
      activeRelocTarget?.target?.name ||
      "the designated district shelter";
    const distText = activeRelocTarget?.distKm
      ? `${activeRelocTarget.distKm} kilometers`
      : "a short distance";

    let message = "";
    if (lang === "hi") {
      message = `ध्यान दें! ${zone ? zone.name : "समुदाय"} के नागरिकों के लिए तत्काल आधिकारिक सुरक्षा सलाह। आपके क्षेत्र में ${zone?.hazard || "आपदा जोखिम"} के कारण स्थिति अति संवेदनशील और तत्काल सतर्कता के अधीन है। स्थानीय जोखिम स्कोर ${zone?.priorityScore || 60} है। कृपया अपने 72 घंटे के इमरजेंसी बैग में पीने का पानी, जरूरी दवाएं और पहचान पत्र सुरक्षित रखें। आपका सबसे नजदीकी सुरक्षित आश्रय ${shelterName} है, जो लगभग ${distText} दूर है। तुरंत निकासी प्रक्रिया शुरू करें और जिला प्रशासन के निर्देशों का पालन करें। किसी भी आपातकालीन सहायता या बचाव के लिए 112 या एनडीआरएफ को 1078 पर तुरंत कॉल करें।`;
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
      alert(
        "Please provide at least 8 characters describing the ground situation.",
      );
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
      time: new Date().toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "short",
      }),
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
        title:
          lang === "hi"
            ? "बाढ़ सुरक्षा निर्देश"
            : "Riverine & Flash Flood Safety Rules",
        dos: [
          lang === "hi"
            ? "तत्काल छत या ऊपरी मंजिल पर जाएं और मुख्य बिजली स्विच बंद करें"
            : "Move to higher ground/floors immediately; shut off main electrical breaker",
          lang === "hi"
            ? "केवल उबला या क्लोरीनेटेड पानी ही पिएं"
            : "Boil or chlorinate all drinking water before consumption",
          lang === "hi"
            ? "स्थानीय प्रशासन की लाउडस्पीकर घोषणाओं और एनडीआरएफ का पालन करें"
            : "Follow district disaster control loudspeaker & WhatsApp updates",
        ],
        donts: [
          lang === "hi"
            ? "बहते पानी या जलमग्न सड़कों पर पैदल या वाहन से न निकलें"
            : "Never walk or drive through moving flood waters (15 cm can sweep an adult)",
          lang === "hi"
            ? "बिजली के खंभों, तारों और गिरे पेड़ों के पास न जाएं"
            : "Stay far clear of downed electric poles and transformer boxes",
        ],
      };
    } else if (h.includes("landslide") || h.includes("slope")) {
      return {
        title:
          lang === "hi"
            ? "भूस्खलन सुरक्षा निर्देश"
            : "Landslide & Slope Movement Rules",
        dos: [
          lang === "hi"
            ? "पहाड़ी ढलानों में दरारें या मिट्टी का कटाव दिखते ही खाली करें"
            : "Evacuate immediately upon noticing widening ground fissures or tilted trees",
          lang === "hi"
            ? "पत्थरों के खिसकने या गड़गड़ाहट की आवाज पर सतर्क रहें"
            : "Listen for rumbling sounds of falling boulders and rushing debris",
          lang === "hi"
            ? "सुरक्षित पक्के सामुदायिक आश्रय में शरण लें"
            : "Move to designated concrete community shelters on stable bedrock",
        ],
        donts: [
          lang === "hi"
            ? "नदी नालों के प्राकृतिक बहाव मार्ग या ढलान के नीचे न रुकें"
            : "Do not stay downhill of saturated slopes or near culvert outlets",
          lang === "hi"
            ? "खतरे के दौरान बंद पहाड़ी रास्तों पर जबरन यात्रा न करें"
            : "Do not attempt to clear roadblocks manually during active rain",
        ],
      };
    } else {
      return {
        title:
          lang === "hi"
            ? "आपदा सुरक्षा दिशानिर्देश"
            : "General Disaster Safety Protocol",
        dos: [
          lang === "hi"
            ? "अपना 72 घंटे का इमरजेंसी बैग तैयार रखें"
            : "Keep your 72-hour emergency go-bag by the door",
          lang === "hi"
            ? "परिवार के साथ सुरक्षित मिलन स्थल पहले से तय करें"
            : "Agree on a designated safe reunion point with family members",
        ],
        donts: [
          lang === "hi"
            ? "सोशल मीडिया पर बिना पुष्टि वाली अफवाहों पर विश्वास न करें"
            : "Do not spread or act on unverified rumors on messaging groups",
        ],
      };
    }
  };

  const dosDonts = getHazardDosDonts(zone?.hazard);

  const HELPLINES = [
    {
      num: "112",
      nameEn: "National Emergency",
      nameHi: "राष्ट्रीय आपातकालीन सेवा",
      desc: "Police, Fire & Medical 24x7",
      icon: "🚨",
      color: "#dc2626",
    },
    {
      num: "1078",
      nameEn: "NDRF Rescue Ops",
      nameHi: "एनडीआरएफ बचाव कक्ष",
      desc: "Specialized Disaster Response",
      icon: "🛡️",
      color: "#2563eb",
    },
    {
      num: "1077",
      nameEn: "District DDMA Desk",
      nameHi: "जिला आपदा नियंत्रण",
      desc: "Local Collectorate Cell",
      icon: "🏛️",
      color: "#d97706",
    },
    {
      num: "108",
      nameEn: "Medical Ambulance",
      nameHi: "एम्बुलेंस सेवा",
      desc: "Hospital Triage & Trauma",
      icon: "🚑",
      color: "#059669",
    },
    {
      num: "1070",
      nameEn: "State Disaster SDMA",
      nameHi: "राज्य आपदा राहत",
      desc: "State HQ Relief Desk",
      icon: "🏢",
      color: "#4f46e5",
    },
  ];

  const RAPID_ISSUES = [
    {
      id: "Rising Water / Submerged Road",
      icon: "🌊",
      labelEn: "Rising Floodwater",
      labelHi: "बढ़ता जलस्तर",
    },
    {
      id: "Landslide / Ground Cracks",
      icon: "⛰️",
      labelEn: "Landslide / Fissure",
      labelHi: "भूस्खलन / दरार",
    },
    {
      id: "Access or Evacuation Route Cut Off",
      icon: "🚧",
      labelEn: "Road / Bridge Blocked",
      labelHi: "रास्ता / पुल बंद",
    },
    {
      id: "Stranded Senior / Medical Need",
      icon: "🚑",
      labelEn: "Medical / Senior Trap",
      labelHi: "फंसे बुजुर्ग / दवा",
    },
    {
      id: "Drinking Water / Food Scarcity",
      icon: "🚰",
      labelEn: "Water / Food Outage",
      labelHi: "पानी / राशन कमी",
    },
    {
      id: "Fallen Electric Wires / Sparking",
      icon: "⚡",
      labelEn: "Live Wire / Fallen Pole",
      labelHi: "गिरा हुआ बिजली पोल",
    },
  ];

  return (
    <div
      className={`citizen-page ${fontScale !== "normal" ? `font-scale-${fontScale}` : ""}`}
    >
      {/* Top Welcome Header & Accessibility Bar */}
      <div className="citizen-welcome">
        <div>
          <div className="eyebrow">
            <Users size={13} />{" "}
            {lang === "hi"
              ? "नागरिक आपदा पोर्टल"
              : "Community Resilience Portal"}
          </div>
          <h1>
            {lang === "hi"
              ? "अपने क्षेत्र की स्थिति जानें और सुरक्षित रहें।"
              : "Know what is happening near you."}
          </h1>
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
            title={
              lang === "hi"
                ? "आवाज में सुरक्षा निर्देश सुनें"
                : "Listen to official voice advisory"
            }
          >
            {isPlayingAudio ? (
              <>
                <VolumeX size={15} />
                <span>
                  {lang === "hi" ? "आवाज रोकें (Stop)" : "Stop Voice"}
                </span>
                <div className="audio-wave">
                  <span />
                  <span />
                  <span />
                </div>
              </>
            ) : (
              <>
                <Volume2 size={15} />
                <span>
                  {lang === "hi"
                    ? "🔊 सुरक्षा सलाह सुनें"
                    : "🔊 Listen to Advisory"}
                </span>
              </>
            )}
          </button>

          {/* Font Resizer */}
          <div
            className="font-scale-controls"
            title="Text size for accessibility"
          >
            <span
              style={{
                fontSize: "10.5px",
                color: "var(--ink-soft)",
                padding: "0 4px",
              }}
            >
              Text:
            </span>
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
            <button
              className={lang === "en" ? "is-on" : ""}
              onClick={() => setLang("en")}
            >
              English
            </button>
            <button
              className={lang === "hi" ? "is-on" : ""}
              onClick={() => setLang("hi")}
            >
              हिन्दी
            </button>
          </div>

          <div className="citizen-trust">
            <CheckCircle2 size={14} />{" "}
            {lang === "hi"
              ? "जिला आपदा टीम से सत्यापित"
              : "Connected to District Operations"}
          </div>
        </div>
      </div>

      {/* 1-Tap Emergency SOS Direct Helplines Strip */}
      <div className="citizen-sos-strip">
        {HELPLINES.map((h) => (
          <a
            key={h.num}
            href={`tel:${h.num}`}
            className="citizen-sos-card"
            title={`Call ${h.nameEn} immediately`}
          >
            <div className="citizen-sos-info">
              <strong>
                {h.icon} {h.num}
              </strong>
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
                    <MapPin size={11} style={{ verticalAlign: "middle" }} />{" "}
                    {zone.district}
                  </p>
                </div>
                <PhaseBadge phase={zone.phase} />
              </div>

              <div
                style={{
                  marginTop: "12px",
                  background: "var(--panel-2)",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11.5px",
                    marginBottom: "4px",
                  }}
                >
                  <span style={{ color: "var(--ink-soft)" }}>
                    Hazard Threat:
                  </span>
                  <strong
                    style={{
                      color:
                        zone.phase === "Immediate"
                          ? "var(--immediate)"
                          : "var(--brand)",
                    }}
                  >
                    {zone.hazard}
                  </strong>
                </div>
                <AnimatedBar
                  value={zone.hazardIntensity}
                  color={zone.phase === "Immediate" ? "#dc2626" : "#d97706"}
                  height={6}
                  trackKey={zone.id + "cit"}
                />
              </div>

              <div className="citizen-risk-row">
                <div>
                  <strong>{zone.priorityScore} / 100</strong>
                  <span>
                    {lang === "hi" ? "प्राथमिकता स्कोर" : "local priority"}
                  </span>
                </div>
                <div>
                  <strong>{history.events}</strong>
                  <span>{lang === "hi" ? "पिछली आपदाएं" : "past events"}</span>
                </div>
                <div>
                  <strong>{fmt(zone.population)}</strong>
                  <span>
                    {lang === "hi" ? "प्रभावित जनसंख्या" : "people nearby"}
                  </span>
                </div>
              </div>

              <div className="citizen-action-note">
                <span>
                  {lang === "hi" ? "आधिकारिक निर्देश" : "WHAT THIS MEANS"}
                </span>
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontSize: "12px",
                    padding: "8px",
                  }}
                  onClick={toggleSpeech}
                >
                  {isPlayingAudio ? (
                    <VolumeX size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                  {isPlayingAudio
                    ? lang === "hi"
                      ? "आवाज बंद करें"
                      : "Stop Voice"
                    : lang === "hi"
                      ? "सुरक्षा निर्देश सुनें"
                      : "Listen to Voice Guidance"}
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
                <h5>
                  <CheckCircle2 size={13} />{" "}
                  {lang === "hi" ? "क्या करें (DOs)" : "DOs (Safety First)"}
                </h5>
                <ul>
                  {dosDonts.dos.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="donts-box">
                <h5>
                  <X size={13} />{" "}
                  {lang === "hi"
                    ? "क्या न करें (DON'Ts)"
                    : "DON'Ts (Avoid Risk)"}
                </h5>
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
          {/* Dual-Section Citizen Resettlement Cards */}
          {activeRelocTarget &&
            (() => {
              const st = activeRelocTarget.shortTerm || activeRelocTarget;
              const pm = activeRelocTarget.permanent || activeRelocTarget;
              const stTarget = st.target;
              const pmTarget = pm.target;

              return (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {/* SECTION 1: Immediate Emergency Relief Shelter */}
                  <div
                    className="citizen-shelter-card"
                    style={{ borderLeft: "4px solid #f59e0b" }}
                  >
                    <div className="shelter-head">
                      <div>
                        <div
                          className="shelter-title"
                          style={{ color: "#b45309" }}
                        >
                          <Shield size={16} />
                          <span>
                            {lang === "hi"
                              ? "⚡ धारा 1: तत्काल आपातकालीन राहत आश्रय"
                              : "⚡ Section 1: Immediate Emergency Relief Shelter"}
                          </span>
                        </div>
                        <h4
                          style={{
                            margin: "4px 0 2px",
                            fontFamily: "Space Grotesk",
                            fontSize: "15px",
                            color: "var(--brand)",
                          }}
                        >
                          {stTarget.site?.name || stTarget.name}
                        </h4>
                        <p className="muted small" style={{ margin: 0 }}>
                          {stTarget.district} District •{" "}
                          {lang === "hi"
                            ? "निकटतम ग्रीन सेफ ज़ोन"
                            : "Nearest Green Safe Zone"}
                        </p>
                      </div>
                      <span
                        className="shelter-badge"
                        style={{
                          background: "#fef3c7",
                          color: "#b45309",
                          border: "1px solid #fcd34d",
                        }}
                      >
                        {lang === "hi" ? "तत्काल सुरक्षित" : "Emergency Relief"}
                      </span>
                    </div>

                    <div className="shelter-kpis">
                      <div>
                        <span>Distance: </span>
                        <strong>{st.distKm} km</strong>
                      </div>
                      <div>
                        <span>Walking ETA: </span>
                        <strong>
                          ~{Math.max(12, Math.round(st.distKm * 2.2))} mins
                        </strong>
                      </div>
                      <div>
                        <span>Safe Intake: </span>
                        <strong>
                          {fmt(
                            stTarget.population
                              ? stTarget.population * 2
                              : 12000,
                          )}{" "}
                          slots
                        </strong>
                      </div>
                    </div>

                    <div className="shelter-amenities">
                      <span className="shelter-amenity-pill">
                        <Hospital size={12} /> Medical Clinic & Doctors
                      </span>
                      <span className="shelter-amenity-pill">
                        <Droplets size={12} /> Clean RO Drinking Water
                      </span>
                      <span className="shelter-amenity-pill">
                        <Flame size={12} /> Hot Community Kitchen
                      </span>
                      <span className="shelter-amenity-pill">
                        <Building2 size={12} /> Generator & Mobile Charging
                      </span>
                      <span className="shelter-amenity-pill">
                        <ShieldCheck size={12} /> Separate Women & Child Ward
                      </span>
                    </div>
                  </div>

                  {/* SECTION 2: Permanent Sustainable Resettlement Township */}
                  <div
                    className="citizen-shelter-card"
                    style={{
                      borderLeft: "4px solid #10b981",
                      background: "#f0fdf4",
                    }}
                  >
                    <div className="shelter-head">
                      <div>
                        <div
                          className="shelter-title"
                          style={{ color: "#047857" }}
                        >
                          <Building2 size={16} />
                          <span>
                            {lang === "hi"
                              ? "🌱 धारा 2: भविष्य का स्थायी टिकाऊ आवास"
                              : "🌱 Section 2: Permanent Sustainable Resettlement Township"}
                          </span>
                        </div>
                        <h4
                          style={{
                            margin: "4px 0 2px",
                            fontFamily: "Space Grotesk",
                            fontSize: "15px",
                            color: "#064e3b",
                          }}
                        >
                          {pm.townshipName ||
                            `${pmTarget.district} Green Resilient Township`}
                        </h4>
                        <p
                          className="muted small"
                          style={{ margin: 0, color: "#047857" }}
                        >
                          {pmTarget.district} District •{" "}
                          {lang === "hi"
                            ? "सर्वश्रेष्ठ टिकाऊ स्थान"
                            : "Best Location for Resettlement"}
                        </p>
                      </div>
                      <span
                        className="shelter-badge"
                        style={{
                          background: "#d1fae5",
                          color: "#047857",
                          border: "1px solid #6ee7b7",
                        }}
                      >
                        Sustainability: {pm.sustainabilityScore || 96}/100 (
                        {pm.sustainabilityGrade || "A+"})
                      </span>
                    </div>

                    <div
                      className="shelter-kpis"
                      style={{ background: "#ffffff" }}
                    >
                      <div>
                        <span>Distance: </span>
                        <strong style={{ color: "#047857" }}>
                          {pm.distKm || 28} km
                        </strong>
                      </div>
                      <div>
                        <span>Housing Type: </span>
                        <strong style={{ color: "#047857" }}>
                          Disaster-Resilient 2BHK
                        </strong>
                      </div>
                      <div>
                        <span>Power Grid: </span>
                        <strong style={{ color: "#047857" }}>
                          100% Solar Micro-Grid
                        </strong>
                      </div>
                    </div>

                    <div className="shelter-amenities">
                      <span
                        className="shelter-amenity-pill"
                        style={{
                          background: "#ffffff",
                          borderColor: "#a7f3d0",
                          color: "#065f46",
                        }}
                      >
                        <ShieldCheck size={12} /> 100% Zero-Hazard Tableland
                      </span>
                      <span
                        className="shelter-amenity-pill"
                        style={{
                          background: "#ffffff",
                          borderColor: "#a7f3d0",
                          color: "#065f46",
                        }}
                      >
                        <Building2 size={12} /> School & Primary Health Center
                      </span>
                      <span
                        className="shelter-amenity-pill"
                        style={{
                          background: "#ffffff",
                          borderColor: "#a7f3d0",
                          color: "#065f46",
                        }}
                      >
                        <Droplets size={12} /> Rainwater Catchment Aquifer
                      </span>
                      <span
                        className="shelter-amenity-pill"
                        style={{
                          background: "#ffffff",
                          borderColor: "#a7f3d0",
                          color: "#065f46",
                        }}
                      >
                        <Landmark size={12} /> Retained Grazing & Farming Rights
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Interactive 72-Hour Preparedness Checklist */}
          <div className="citizen-checklist-card" style={{ marginTop: "14px" }}>
            <div className="checklist-head">
              <div className="checklist-title">
                <ClipboardList size={16} style={{ color: "var(--brand-2)" }} />
                <span>
                  {lang === "hi"
                    ? "72 घंटे का आपातकालीन किट (Go-Bag)"
                    : "72-Hour Emergency Kit (Go-Bag)"}
                </span>
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  color: "var(--ink-soft)",
                }}
              >
                <span>
                  {packedCount} of {checklist.length} items packed
                </span>
                <strong
                  style={{
                    color: packPercent === 100 ? "#059669" : "var(--brand)",
                  }}
                >
                  {packPercent}% Ready
                </strong>
              </div>
              <div className="checklist-bar-bg">
                <div
                  className="checklist-bar-fill"
                  style={{ width: `${packPercent}%` }}
                />
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
                  <span
                    style={{
                      textDecoration: item.packed ? "line-through" : "none",
                    }}
                  >
                    {lang === "hi" ? item.hi : item.en}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Citizen Ground Report & Observation Form */}
          <div className="feedback-panel" style={{ marginTop: "14px" }}>
            <div className="reports-head">
              <span
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MessageSquare size={15} style={{ color: "var(--brand-2)" }} />
                {lang === "hi"
                  ? "मैदानी स्थिति रिपोर्ट (Community Report)"
                  : "Community Ground Report & SOS"}
              </span>
              <span className="muted small">
                {lang === "hi"
                  ? "सीधे जिला कंट्रोल रूम को प्रेषित"
                  : "Direct to District Control"}
              </span>
            </div>

            {ticketSubmitted && (
              <div className="ticket-alert-box">
                <CheckCircle2 size={16} />
                <div>
                  <strong>
                    {lang === "hi"
                      ? "रिपोर्ट सफलतापूर्वक दर्ज!"
                      : "Report Dispatched Successfully!"}
                  </strong>
                  <div>
                    Ticket ID: <strong>{ticketSubmitted.ticketId}</strong> ·{" "}
                    {lang === "hi"
                      ? "जिला आपदा दल को सूचित किया गया।"
                      : "Sent to District Emergency Operations."}
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
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    display: "block",
                    marginBottom: "3px",
                  }}
                >
                  {lang === "hi"
                    ? "प्रभावित क्षेत्र चुनें:"
                    : "Select Affected Community:"}
                </label>
                <select
                  value={zoneChoice}
                  onChange={(e) => {
                    setZoneChoice(e.target.value);
                    onSelect(e.target.value);
                  }}
                  required
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.id} — {z.name} ({z.district})
                    </option>
                  ))}
                </select>
              </div>

              {/* Rapid Category Pills */}
              <div>
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    display: "block",
                    marginBottom: "3px",
                  }}
                >
                  {lang === "hi"
                    ? "समस्या का प्रकार (Category):"
                    : "Incident Category:"}
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
                <label
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--ink-soft)",
                    display: "block",
                    marginBottom: "3px",
                  }}
                >
                  {lang === "hi"
                    ? "आपातकालीन स्तर (Urgency):"
                    : "Urgency Level:"}
                </label>
                <div className="urgency-toggle">
                  <button
                    type="button"
                    className={`urgency-btn ${urgency === "High" ? "is-high" : ""}`}
                    onClick={() => setUrgency("High")}
                  >
                    🔴{" "}
                    {lang === "hi"
                      ? "अति गंभीर (Life Risk)"
                      : "Critical Emergency"}
                  </button>
                  <button
                    type="button"
                    className={`urgency-btn ${urgency === "Moderate" ? "is-mod" : ""}`}
                    onClick={() => setUrgency("Moderate")}
                  >
                    🟡{" "}
                    {lang === "hi"
                      ? "चेतावनी (Access Cut)"
                      : "Moderate / Impaired"}
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
                  placeholder={
                    lang === "hi"
                      ? "मोबाइल नंबर (बचाव कार्य संपर्क हेतु - वैकल्पिक)"
                      : "Phone number (for rescue dispatch - optional)"
                  }
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    fontSize: "12px",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                  }}
                />
              </div>

              {/* GPS Geotag Checkbox */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontSize: "11px",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={attachGps}
                  onChange={(e) => setAttachGps(e.target.checked)}
                />
                <span>
                  {lang === "hi"
                    ? `वर्तमान जीपीएस स्थिति संलग्न करें (${zone.lat?.toFixed(3)}, ${zone.lng?.toFixed(3)})`
                    : `Attach verified zone GPS coordinates (${zone.lat?.toFixed(3)}, ${zone.lng?.toFixed(3)})`}
                </span>
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

              <button
                className="btn-primary"
                type="submit"
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <MessageSquare size={14} />{" "}
                {lang === "hi"
                  ? "रिपोर्ट जिला दल को भेजें"
                  : "Dispatch Community Report"}
              </button>
            </form>

            {/* List of recent community feedback */}
            <div className="feedback-list" style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--brand)",
                  marginBottom: "6px",
                }}
              >
                {lang === "hi"
                  ? "हालिया सत्यापित मैदानी रिपोर्ट:"
                  : "Recent Verified Field Reports:"}
              </div>
              {feedback.length === 0 && (
                <p className="muted small">
                  No community reports submitted yet.
                </p>
              )}
              {feedback.map((f, i) => (
                <div className="feedback-item" key={i}>
                  <div className="feedback-item-head">
                    <span>
                      <span className="zone-code-sm">{f.zoneId}</span>
                      <span className="feedback-category">
                        {f.category || "General"}
                      </span>
                    </span>
                    <span className="muted small">{f.time}</span>
                  </div>
                  <p>{f.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Voice & SMS Alert Subscription Card */}
          <div className="citizen-sub-card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontFamily: "Space Grotesk",
                  fontWeight: 700,
                  fontSize: "13px",
                  color: "var(--brand)",
                }}
              >
                <Bell size={15} style={{ color: "var(--brand-2)" }} />
                <span>
                  {lang === "hi"
                    ? "वॉइस व एसएमएस आपदा अलर्ट"
                    : "Voice & SMS Disaster Broadcasts"}
                </span>
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

            <p
              style={{
                fontSize: "11.5px",
                color: "var(--ink-soft)",
                margin: "0 0 10px",
              }}
            >
              {lang === "hi"
                ? "मौसम विभाग और जिला कलेक्ट्रेट द्वारा जारी किए गए तत्काल खाली करने के संदेश अपने फोन पर पाएं।"
                : "Receive instant automated IVR voice calls and WhatsApp/SMS alerts when your zone escalates to Immediate action."}
            </p>

            <button
              className={`btn-primary full ${subscribed ? "is-on" : ""}`}
              onClick={onSubscribe}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "7px",
              }}
            >
              <Bell size={14} />
              {subscribed
                ? lang === "hi"
                  ? "✓ अलर्ट चालू है (SMS & Voice Active)"
                  : "✓ Voice & SMS Alerts Active"
                : lang === "hi"
                  ? "आपदा अलर्ट प्राप्त करने हेतु सब्सक्राइब करें"
                  : "Subscribe to Voice & SMS Alerts"}
            </button>

            {showSimulateAlert && (
              <div className="sub-preview-box">
                <div
                  style={{
                    fontWeight: 700,
                    color: "#dc2626",
                    marginBottom: "3px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <AlertCircle size={12} /> BHOOMI RAKSHAK 2.0 OFFICIAL
                  BROADCAST
                </div>
                <div>
                  [DISASTER ALERT - {zone.id} {zone.name}]: Immediate flood risk
                  identified. Priority score: {zone.priorityScore}/100. Please
                  proceed along the designated safe corridor to{" "}
                  {activeRelocTarget.target.site?.name ||
                    activeRelocTarget.target.name}{" "}
                  ({activeRelocTarget.distKm} km). Emergency rescue helpline:
                  112 / 1078.
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
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEmails(data);
      })
      .catch((e) => console.error("Failed to load emails:", e));
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newEmail) return;
    setLoading(true);
    fetch(buildApiUrl("/api/emails"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.email) {
          setEmails([...emails, data]);
          setNewEmail("");
        }
      })
      .catch((e) => console.error("Failed to add email:", e))
      .finally(() => setLoading(false));
  };

  return (
    <div className="reports">
      <div className="reports-head">
        <span>Email Alert Subscribers</span>
        <span className="muted">{emails.length} Subscribed</span>
      </div>
      <div
        style={{
          padding: "16px",
          background: "var(--panel-2)",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        <form onSubmit={handleAdd} style={{ display: "flex", gap: "8px" }}>
          <input
            type="email"
            placeholder="Enter email address..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid var(--line)",
              borderRadius: "6px",
            }}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Adding..." : "Add Email"}
          </button>
        </form>
      </div>
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <table className="report-table">
          <thead>
            <tr>
              <th>EMAIL ADDRESS</th>
              <th>DATE SUBSCRIBED</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.email}</strong>
                </td>
                <td>{new Date(e.timestamp).toLocaleString()}</td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr>
                <td colSpan="2" style={{ textAlign: "center" }}>
                  No emails subscribed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ======================================================================
   CONSOLE (the operational app)
   ====================================================================== */

/* ΓöÇΓöÇΓöÇ BhoomiRakshak AI Splash / Loader ΓöÇΓöÇΓöÇ */
function BhoomiSplash({ onDone }) {
  const steps = [
    { icon: "🚰️", text: "Connecting ISRO MOSDAC satellite feed…" },
    { icon: "🗺️", text: "Loading pan-India risk zone records…" },
    { icon: "🌈", text: "Calibrating flood & landslide models…" },
    { icon: "📡", text: "Syncing Open-Meteo live weather API…" },
    { icon: "OK", text: "BhoomiRakshak AI ready!" },
  ];
  const [step, setStep] = React.useState(0);
  const [fadeOut, setFadeOut] = React.useState(false);

  React.useEffect(() => {
    if (step < steps.length - 1) {
      const t = setTimeout(() => setStep((s) => s + 1), 480);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        setFadeOut(true);
        setTimeout(onDone, 500);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(circle at 50% 18%, rgba(251,191,36,.16), transparent 24%), linear-gradient(145deg, #071a32 0%, #0d3154 56%, #08182d 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.5s ease",
      }}
    >
      {/* Gold-white signal bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          height: "6px",
        }}
      >
        <div style={{ flex: 1, background: "#d89b24" }} />
        <div style={{ flex: 1, background: "#fff7d1" }} />
        <div style={{ flex: 1, background: "#fbbf24" }} />
      </div>

      {/* Logo ring */}
      <div style={{ position: "relative", marginBottom: "28px" }}>
        <div
          style={{
            width: "88px",
            height: "88px",
            borderRadius: "50%",
            border: "3px solid rgba(255,224,138,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "spin-slow 4s linear infinite",
            boxShadow:
              "0 0 18px rgba(251,191,36,.28), 0 0 54px rgba(255,224,138,.16)",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, #fff7d1 0%, #fbbf24 45%, #b87316 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "34px",
              boxShadow:
                "0 8px 32px rgba(2,6,23,.42), inset 0 1px rgba(255,255,255,.72)",
            }}
          >
            🌍
          </div>
        </div>
        {/* Orbiting dot */}
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: "50%",
            marginLeft: "-5px",
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: "#fff7d1",
            boxShadow: "0 0 10px #fbbf24, 0 0 22px rgba(251,191,36,.7)",
            transformOrigin: "5px 42px",
            animation: "spin-slow 4s linear infinite",
          }}
        />
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "Space Grotesk",
          fontWeight: 700,
          fontSize: "26px",
          color: "#fff1a8",
          letterSpacing: "2px",
          marginBottom: "4px",
        }}
      >
        BHOOMI RAKSHAK 2.0
      </div>
      <div
        style={{
          fontSize: "12px",
          color: "rgba(255,255,255,0.6)",
          letterSpacing: "0.15em",
          marginBottom: "36px",
        }}
      >
        AI · DISASTER RISK INTELLIGENCE
      </div>

      {/* Progress steps */}
      <div
        style={{
          width: "340px",
          background:
            "linear-gradient(145deg, rgba(15,42,70,.82), rgba(6,22,42,.72))",
          borderRadius: "14px",
          padding: "18px 20px",
          border: "1px solid rgba(251,191,36,.3)",
          boxShadow:
            "0 18px 44px rgba(2,6,23,.32), inset 0 1px rgba(255,255,255,.1)",
        }}
      >
        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "6px 0",
              opacity: i <= step ? 1 : 0.25,
              transition: "opacity 0.4s ease",
              borderBottom:
                i < steps.length - 1
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "none",
            }}
          >
            <span style={{ fontSize: "16px", minWidth: "22px" }}>{s.icon}</span>
            <span
              style={{
                flex: 1,
                fontSize: "11.5px",
                color: i === step ? "#fff1a8" : "rgba(226,232,240,0.72)",
                fontWeight: i === step ? 700 : 400,
                transition: "color 0.3s",
              }}
            >
              {s.text}
            </span>
            {i < step && (
              <span
                style={{ color: "#6ee7b7", fontSize: "12px", fontWeight: 800 }}
              >
                OK
              </span>
            )}
            {i === step && (
              <div
                style={{
                  width: "14px",
                  height: "14px",
                  border: "2px solid #fbbf24",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin-fast 0.7s linear infinite",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Bottom progress bar */}
      <div
        style={{
          width: "340px",
          height: "4px",
          background: "rgba(255,247,209,.12)",
          borderRadius: "2px",
          marginTop: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            background:
              "linear-gradient(90deg, #b87316, #fbbf24, #fff7d1, #fbbf24)",
            backgroundSize: "220% 100%",
            animation: "gold-shimmer 2.8s ease-in-out infinite",
            borderRadius: "2px",
            width: `${((step + 1) / steps.length) * 100}%`,
            transition: "width 0.45s ease",
          }}
        />
      </div>
      <div
        style={{
          marginTop: "10px",
          fontSize: "10px",
          color: "rgba(255,255,255,0.4)",
          letterSpacing: "0.1em",
        }}
      >
        Powered by ISRO MOSDAC · Open-Meteo · NASA Earthdata
      </div>

      {/* Gold-white signal bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          display: "flex",
          height: "6px",
        }}
      >
        <div style={{ flex: 1, background: "#d89b24" }} />
        <div style={{ flex: 1, background: "#fff7d1" }} />
        <div style={{ flex: 1, background: "#fbbf24" }} />
      </div>

      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-fast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer-pulse { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
        @keyframes gold-shimmer { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
      `}</style>
    </div>
  );
}

function ConsoleApp({ onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = location.pathname === "/citizen" ? "citizen" : "authority";
  const setRole = (r) => {
    navigate(r === "citizen" ? "/citizen" : "/console");
  };
  const [district, setDistrict] = useState("All Districts");
  const [tab, setTab] = useState(() => location.state?.tab || "overview");
  const [mapMode, setMapMode] = useState("risk");
  const [terrain3DStyle, setTerrain3DStyle] = useState("satellite"); // "satellite", "elevation", "geology", "radar", "hydrology", "slope"
  const [terrain3DExaggeration, setTerrain3DExaggeration] = useState(1.0); // 1.0, 1.8, 2.5
  const [autoRotate3D, setAutoRotate3D] = useState(true);
  const [risk2DStyle, setRisk2DStyle] = useState("satellite"); // "satellite", "terrain", "standard", "dark", "light", "relief"
  const [grid2DStyle, setGrid2DStyle] = useState("contours"); // "contours", "hydrology", "hazard", "corridors"
  const [visibleLayers, setVisibleLayers] = useState({
    hazard: true,
    population: true,
    sites: true,
  });
  const [fusionEnabled, setFusionEnabled] = useState(true);
  const [selectedHazards, setSelectedHazards] = useState({
    flood: true,
    landslide: true,
    earthquake: true,
    rainfall: true,
  });
  const [lastSync, setLastSync] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState(ZONES[0].id);
  const [selectTrigger, setSelectTrigger] = useState(0);
  const handleSelectZone = (id) => {
    setSelectedId(id);
    setSelectTrigger((t) => t + 1);
  };
  const [certZone, setCertZone] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [subscribed, setSubscribed] = useState(false);
  const [lang, setLang] = useState("en");
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setTab(
      location.state?.tab || (role === "citizen" ? "citizen" : "overview"),
    );
  }, [role, location.state]);

  useEffect(() => {
    let startX = null;
    let startY = null;
    const onTouchStart = (event) => {
      const touch = event.changedTouches[0];
      if (touch.clientX <= 24) {
        startX = touch.clientX;
        startY = touch.clientY;
      }
    };
    const onTouchEnd = (event) => {
      if (startX === null) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = Math.abs(touch.clientY - startY);
      if (deltaX > 72 && deltaX > deltaY * 1.35) navigate(-1);
      startX = null;
      startY = null;
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [navigate]);

  const [liveUpdates, setLiveUpdates] = useState({});

  // Real-time data simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveUpdates((prev) => {
        const next = { ...prev };
        // Randomly tweak the priorityScore of a random subset of zones (up to 15)
        for (let i = 0; i < 15; i++) {
          const z = ZONES[Math.floor(Math.random() * ZONES.length)];
          if (!next[z.id]) next[z.id] = {};
          next[z.id].priorityScore = Math.min(
            100,
            Math.max(
              0,
              (next[z.id].priorityScore || z.priorityScore) +
                Math.floor(Math.random() * 5 - 2),
            ),
          );
        }
        return next;
      });
      setLastSync(new Date());
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const zones = useMemo(() => {
    const filtered =
      district === "All Districts"
        ? ZONES
        : ZONES.filter((z) => z.district === district);
    if (Object.keys(liveUpdates).length === 0) return filtered;
    return filtered.map((z) =>
      liveUpdates[z.id] ? { ...z, ...liveUpdates[z.id] } : z,
    );
  }, [district, liveUpdates]);

  useEffect(() => {
    if (!zones.find((z) => z.id === selectedId) && zones.length)
      setSelectedId(zones[0].id);
  }, [zones]); // eslint-disable-line

  const [liveApiWeather, setLiveApiWeather] = useState(null);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [tinyFishOpen, setTinyFishOpen] = useState(false);
  const [tinyFishQuery, setTinyFishQuery] = useState(
    "latest disaster risk updates in India",
  );
  const [tinyFishLoading, setTinyFishLoading] = useState(false);
  const [tinyFishResult, setTinyFishResult] = useState(null);
  const [tinyFishError, setTinyFishError] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: "notif-1",
      title: "ISRO MOSDAC Satellite Cloudburst Alert",
      body: "Torrential monsoon rain (34.2mm/hr) detected in Chamoli & Wayanad. Priority score escalated +25.",
      time: "Just now",
      category: "satellite",
      severity: "high",
      zoneId: "UT-CHA-01",
      read: false,
    },
    {
      id: "notif-2",
      title: "Zone UT-CHA-01 Escalated to Immediate Action",
      body: "Hazard score exceeded 85 threshold. Priority score recalculated to 88/100.",
      time: "2 mins ago",
      category: "alert",
      severity: "high",
      zoneId: "UT-CHA-01",
      read: false,
    },
    {
      id: "notif-3",
      title: "Verified Community Field Report Submitted",
      body: "Ground report from Chamoli Sector 4: Alaknanda river water level rising near bridges.",
      time: "5 mins ago",
      category: "report",
      severity: "medium",
      zoneId: "UT-CHA-01",
      read: false,
    },
    {
      id: "notif-4",
      title: "Permanent Sustainable Masterplan Generated",
      body: "Assigned 46 vulnerable families to Green Resilient Township (Sustainability Score: 96/100 A+).",
      time: "12 mins ago",
      category: "resettlement",
      severity: "info",
      zoneId: "UT-CHA-01",
      read: true,
    },
    {
      id: "notif-5",
      title: "Cryptographic Relocation Certificate Compiled",
      body: "SHA-256 Legal Certificate BR-RZ-104 compiled & audit hash persisted to SQLite database.",
      time: "18 mins ago",
      category: "certificate",
      severity: "info",
      zoneId: "UT-CHA-01",
      read: true,
    },
  ]);

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const pushNotification = (notif) => {
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        read: false,
        ...notif,
      },
      ...prev,
    ]);
  };

  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const selectedZone = zones.find((z) => z.id === selectedId) || null;

  const runTinyFishSearch = async (event) => {
    event.preventDefault();
    const query = tinyFishQuery.trim();
    if (!query) return;
    setTinyFishLoading(true);
    setTinyFishError(null);
    try {
      const response = await fetch(buildApiUrl("/api/tinyfish/search"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.detail || "TinyFish search failed");
      setTinyFishResult(payload);
      pushNotification({
        title: "TinyFish live web intelligence updated",
        body: `Fresh web results loaded for: ${query}`,
        category: "web-intel",
        severity: "info",
      });
    } catch (error) {
      setTinyFishResult(null);
      setTinyFishError(error.message || "TinyFish search failed");
    } finally {
      setTinyFishLoading(false);
    }
  };

  // Real-time API Weather Sync from Open-Meteo & ISRO MOSDAC
  const syncLiveWeather = (targetZ) => {
    const z = targetZ || selectedZone;
    if (!z || !z.lat || !z.lng) return;
    setFetchingWeather(true);
    fetchLiveWeatherData(z.lat, z.lng).then((res) => {
      setLiveApiWeather(res);
      setFetchingWeather(false);
      if (res && res.success) {
        const msg = `📡 MOSDAC & Open-Meteo API: Live ${res.condition} (${res.rain}mm rain, ${res.temperature}°C). Priority score synced.`;
        setToast(msg);
        pushNotification({
          title: `Real-Time Satellite Sync (${z.name})`,
          body: `Live satellite reading: ${res.condition}, ${res.rain}mm/hr rain, ${res.temperature}°C. Data verified.`,
          category: "satellite",
          severity: res.isSevere ? "high" : "info",
          zoneId: z.id,
        });
      }
    });
  };

  useEffect(() => {
    if (selectedZone) {
      syncLiveWeather(selectedZone);
    }
  }, [selectedId]);

  const mapZones = useMemo(() => {
    // Render mapped locations seamlessly without lot pagination
    const subset = zones;
    if (selectedId && !subset.find((z) => z.id === selectedId)) {
      const sel = zones.find((z) => z.id === selectedId);
      if (sel) subset.push(sel);
    }
    return subset;
  }, [zones, selectedId]);
  const shortTermTarget = useMemo(() => {
    if (!selectedZone) return null;
    if (
      selectedZone.phase === "Immediate" ||
      selectedZone.phase === "Short-Term"
    ) {
      return findNearestSafeZone(selectedZone, zones);
    }
    return null;
  }, [selectedZone, zones]);

  const permanentTarget = useMemo(() => {
    if (!selectedZone) return null;
    if (
      selectedZone.phase === "Immediate" ||
      selectedZone.phase === "Short-Term"
    ) {
      return findPermanentRelocationSite(selectedZone, zones);
    }
    return null;
  }, [selectedZone, zones]);

  const relocationTarget = useMemo(() => {
    if (!shortTermTarget && !permanentTarget) return null;
    return {
      ...(shortTermTarget || permanentTarget),
      shortTerm: shortTermTarget,
      permanent: permanentTarget,
    };
  }, [shortTermTarget, permanentTarget]);

  const immediateCount = zones.filter((z) => z.phase === "Immediate").length;
  const exposedPopulation = zones
    .filter((z) => z.phase === "Immediate")
    .reduce((sum, z) => sum + z.population, 0);
  const capacityAlerts = zones.filter(
    (z) => z.site.status === "shortfall",
  ).length;
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

  const [showSplash, setShowSplash] = useState(true);

  return (
    <div className="app">
      {showSplash && <BhoomiSplash onDone={() => setShowSplash(false)} />}
      <header className="header">
        <div className="brand-wrap">
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              <ArrowLeft size={15} />
            </button>
          )}
          <img
            src="/logo.jpg"
            alt="Bhoomi Rakshak logo"
            className="brand-logo-img"
          />
          <div>
            <div
              className="brand-name"
              style={{ color: "#ffffff", letterSpacing: "0.5px" }}
            >
              BHOOMI RAKSHAK 2.0
            </div>
            <div className="brand-tag" style={{ color: "#d1ded8" }}>
              Hazard mapping and relocation decision support layer · sample
              records
            </div>
          </div>
        </div>
        <div className="header-controls">
          <button
            type="button"
            className="btn-ghost sm"
            onClick={() => navigate("/intel")}
            aria-label="Open TinyFish Web Intelligence"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#fff1a8",
              borderColor: "rgba(251, 191, 36, 0.58)",
              background:
                "linear-gradient(135deg, #ffe9a8, #c89525 58%, #8e5b0d)",
              color: "#3c290d",
              boxShadow: "0 5px 14px rgba(154,103,16,.22)",
            }}
          >
            <Sparkles size={13} /> TinyFish Web Intel
          </button>
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          >
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="role-toggle">
            <button
              className={role === "authority" ? "is-on" : ""}
              onClick={() => setRole("authority")}
            >
              Authority
            </button>
            <button
              className={role === "citizen" ? "is-on" : ""}
              onClick={() => setRole("citizen")}
            >
              Citizen
            </button>
          </div>
        </div>
      </header>

      {false && tinyFishOpen && (
        <aside
          id="tinyfish-panel"
          aria-label="TinyFish Web Intel"
          style={{
            maxWidth: "520px",
            margin: "12px 24px 0 auto",
            padding: "16px 18px",
            border: "1px solid rgba(251, 191, 36, 0.42)",
            borderRadius: "10px",
            background:
              "linear-gradient(135deg, rgba(23, 63, 120, 0.96), rgba(8, 24, 43, 0.98))",
            boxShadow: "0 14px 34px rgba(2, 6, 23, 0.24)",
            color: "#f8fafc",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "14px",
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  color: "#ffe7a1",
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <Sparkles size={14} /> TinyFish Web Intel
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "#cbd5e1",
                  fontSize: "12px",
                  lineHeight: 1.5,
                }}
              >
                Bring fresh web research into disaster planning with TinyFish
                search.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTinyFishOpen(false)}
              aria-label="Close TinyFish panel"
              style={{
                border: 0,
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 2,
              }}
            >
              <X size={16} />
            </button>
          </div>
          <form
            onSubmit={runTinyFishSearch}
            style={{ display: "flex", gap: "8px", marginTop: "14px" }}
          >
            <input
              value={tinyFishQuery}
              onChange={(event) => setTinyFishQuery(event.target.value)}
              placeholder="Search the live web..."
              aria-label="TinyFish search query"
              style={{
                flex: 1,
                minWidth: 0,
                border: "1px solid rgba(251,191,36,.35)",
                borderRadius: "6px",
                background: "rgba(7,17,31,.7)",
                color: "#f8fafc",
                padding: "8px 10px",
                fontSize: "12px",
              }}
            />
            <button
              type="submit"
              className="btn-primary sm"
              disabled={tinyFishLoading}
            >
              {tinyFishLoading ? "Searching..." : "Search"}
            </button>
          </form>
          {tinyFishError && (
            <div
              style={{
                marginTop: "10px",
                padding: "8px 10px",
                borderRadius: "6px",
                color: "#fecdd3",
                background: "rgba(194,65,76,.14)",
                border: "1px solid rgba(194,65,76,.35)",
                fontSize: "11px",
              }}
            >
              {tinyFishError}
            </div>
          )}
          {tinyFishResult && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "8px",
                color: "#4b3b28",
                background: "#fffdf8",
                border: "1px solid rgba(191,143,38,.34)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "5px",
                  marginBottom: "9px",
                }}
              >
                {[
                  {
                    value: buildTinyFishSourceCards(tinyFishResult.results)
                      .length,
                    label: "sources",
                  },
                  { value: "LIVE", label: "freshness" },
                  { value: "PAN-INDIA", label: "project scope" },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      padding: "6px 5px",
                      borderRadius: "6px",
                      textAlign: "center",
                      background: "#fff3c7",
                      border: "1px solid #f1d27a",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        color: "#805308",
                        fontSize: "12px",
                      }}
                    >
                      {metric.value}
                    </strong>
                    <span
                      style={{
                        display: "block",
                        marginTop: "2px",
                        color: "#96784b",
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      {metric.label}
                    </span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "6px",
                  maxHeight: "190px",
                  overflowY: "auto",
                }}
              >
                {buildTinyFishSourceCards(tinyFishResult.results).map(
                  (card, index) => (
                    <article
                      key={`${card.title}-${index}`}
                      style={{
                        padding: "8px",
                        borderRadius: "7px",
                        background: "#ffffff",
                        border: "1px solid #f0dfae",
                        boxShadow: "0 2px 8px rgba(180,130,30,.08)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "7px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "19px",
                            height: "19px",
                            flex: "0 0 19px",
                            borderRadius: "5px",
                            background: "#fff1c2",
                            color: "#9a670d",
                            fontSize: "10px",
                            fontWeight: 800,
                          }}
                        >
                          {index + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              color: "#5f430c",
                              fontSize: "10.5px",
                              lineHeight: 1.3,
                            }}
                          >
                            {card.title}
                          </strong>
                          {card.url && (
                            <a
                              href={card.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginTop: "2px",
                                color: "#b07916",
                                fontSize: "9px",
                              }}
                            >
                              {card.url}
                            </a>
                          )}
                          <span
                            style={{
                              display: "block",
                              marginTop: "3px",
                              color: "#796d5e",
                              fontSize: "9.5px",
                              lineHeight: 1.35,
                            }}
                          >
                            {card.summary ||
                              "Relevant live source for the Bhoomi Rakshak project."}
                          </span>
                        </div>
                      </div>
                    </article>
                  ),
                )}
              </div>
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "14px",
              paddingTop: "12px",
              borderTop: "1px solid rgba(148, 163, 184, 0.16)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: tinyFishResult ? "#6ee7b7" : "#fbbf24",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: tinyFishResult ? "#6ee7b7" : "#fbbf24",
                }}
              />{" "}
              {tinyFishResult
                ? "Live search connected"
                : "Uses backend TINYFISH_API_KEY"}
            </span>
          </div>
        </aside>
      )}

      {role === "authority" && (
        <nav className="nav-tabs">
          {authorityTabs.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "is-active" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}

      <div className="body">
        {role === "authority" && tab === "overview" && (
          <>
            <div className="command-heading">
              <div>
                <div className="eyebrow">
                  <Satellite size={13} /> Decision support layer
                </div>
                <h1>Review risk. Decide what moves next.</h1>
                <p className="muted">
                  A GIS-enabled decision support system for proactive disaster
                  relocation planning.
                </p>
              </div>
              <div className="command-actions">
                <div className="command-status">
                  <span className="live-dot" /> Monitoring active
                </div>
                <button
                  className="btn-ghost sm"
                  onClick={() => setBriefOpen(true)}
                >
                  Prepare brief <FileText size={12} />
                </button>
              </div>
            </div>
            <div className="overview-layout">
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  minWidth: 0,
                }}
              >
                <div className="risk-map-workspace">
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      overflowY: "auto",
                    }}
                    className="hide-scrollbar"
                  >
                    <ZoneList
                      zones={zones}
                      selectedId={selectedId}
                      onSelect={handleSelectZone}
                    />
                  </div>
                  <div className="workspace-main">
                    <div
                      className="live-strip"
                      style={{ flexWrap: "wrap", gap: "10px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span className="live-dot" />
                        <strong
                          style={{ fontSize: "12px", color: "var(--brand)" }}
                        >
                          ISRO MOSDAC & Open-Meteo Live API Active
                        </strong>
                      </div>
                      <span className="muted small">
                        Updated{" "}
                        {lastSync.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {/* Live Satellite Sync Button */}
                      <button
                        type="button"
                        className="refresh-btn"
                        onClick={() => syncLiveWeather()}
                        disabled={fetchingWeather}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          background: "var(--brand-2)",
                          color: "#ffffff",
                          border: "none",
                        }}
                      >
                        <RefreshCw
                          size={12}
                          className={fetchingWeather ? "animate-spin" : ""}
                        />
                        {fetchingWeather
                          ? "Syncing MOSDAC API..."
                          : "Sync Live MOSDAC Weather API"}
                      </button>
                    </div>

                    {/* Real-time Weather Banner */}
                    {liveApiWeather && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "8px",
                          background:
                            "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                          color: "#ffffff",
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid #334155",
                          margin: "6px 0 10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ fontSize: "14px" }}>📡</span>
                          <span>
                            Live MOSDAC Feed for{" "}
                            <strong>{selectedZone?.name}</strong>:
                            <strong
                              style={{ color: "#38bdf8", marginLeft: "6px" }}
                            >
                              🌡️ {liveApiWeather.temperature}°C
                            </strong>
                            <strong
                              style={{ color: "#60a5fa", marginLeft: "8px" }}
                            >
                              🌧️ Rain: {liveApiWeather.rain} mm/hr (
                              {liveApiWeather.precipitationProbability}% prob)
                            </strong>
                            <span
                              style={{
                                marginLeft: "8px",
                                background: liveApiWeather.isSevere
                                  ? "#ef4444"
                                  : "#10b981",
                                color: "#ffffff",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                fontSize: "10px",
                                fontWeight: 700,
                              }}
                            >
                              {liveApiWeather.condition}
                            </span>
                          </span>
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                          Source: {liveApiWeather.source} (
                          {liveApiWeather.syncedAt})
                        </span>
                      </div>
                    )}

                    {/* KPI Strip & Lot Batch Selector Bar */}
                    <motion.div
                      className="kpi-strip"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, staggerChildren: 0.1 }}
                    >
                      <motion.div
                        whileHover={{
                          y: -5,
                          boxShadow: "0 8px 18px rgba(31,58,52,.08)",
                        }}
                      >
                        <strong>{zones.length}</strong>
                        <span>total India locations</span>
                      </motion.div>
                      <motion.div
                        whileHover={{
                          y: -5,
                          boxShadow: "0 8px 18px rgba(31,58,52,.08)",
                        }}
                      >
                        <strong>{mapZones.length}</strong>
                        <span>locations in current lot</span>
                      </motion.div>
                      <motion.div
                        whileHover={{
                          y: -5,
                          boxShadow: "0 8px 18px rgba(31,58,52,.08)",
                        }}
                      >
                        <strong>{immediateCount}</strong>
                        <span>immediate action</span>
                      </motion.div>
                      <motion.div
                        className={capacityAlerts ? "kpi-alert" : ""}
                        whileHover={{
                          y: -5,
                          boxShadow: "0 8px 18px rgba(31,58,52,.08)",
                        }}
                      >
                        <strong>{capacityAlerts}</strong>
                        <span>capacity alerts</span>
                      </motion.div>
                    </motion.div>

                    {/* LATEST REAL-TIME UPDATES & NOTIFICATION TRIGGER BAR */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "8px",
                        background:
                          "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                        color: "#ffffff",
                        padding: "9px 14px",
                        borderRadius: "8px",
                        border: "1px solid #334155",
                        margin: "8px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          fontSize: "12px",
                        }}
                      >
                        <span
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Bell size={16} style={{ color: "#38bdf8" }} />
                          {unreadNotifCount > 0 && (
                            <span
                              style={{
                                position: "absolute",
                                top: "-2px",
                                right: "-2px",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: "#ef4444",
                                border: "1px solid #0f172a",
                              }}
                            />
                          )}
                        </span>
                        <span>
                          <strong style={{ color: "#38bdf8" }}>
                            LATEST LIVE UPDATE:
                          </strong>{" "}
                          {notifications[0]?.title ||
                            "ISRO MOSDAC Satellite Live Feed Synced"}
                          <span
                            style={{
                              marginLeft: "8px",
                              color: "#94a3b8",
                              fontSize: "11px",
                            }}
                          >
                            ({notifications[0]?.time || "Just now"})
                          </span>
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setNotifOpen(true)}
                          style={{
                            background: "rgba(56, 189, 248, 0.18)",
                            color: "#38bdf8",
                            border: "1px solid rgba(56, 189, 248, 0.4)",
                            borderRadius: "6px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Bell size={12} /> View All Updates (
                          {unreadNotifCount} New)
                        </button>

                        <button
                          type="button"
                          onClick={() => syncLiveWeather()}
                          disabled={fetchingWeather}
                          style={{
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "4px 10px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <RefreshCw
                            size={12}
                            className={fetchingWeather ? "animate-spin" : ""}
                          />
                          {fetchingWeather ? "Syncing..." : "Trigger Live API"}
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                        }}
                      >
                        <div className="map-toggle">
                          <button
                            className={mapMode === "globe" ? "is-on" : ""}
                            onClick={() => setMapMode("globe")}
                          >
                            <Globe size={13} /> 3D Earth Globe
                          </button>
                          <button
                            className={mapMode === "risk" ? "is-on" : ""}
                            onClick={() => setMapMode("risk")}
                          >
                            <MapPin size={13} /> 2D GIS Map
                          </button>
                          <button
                            className={mapMode === "3d" ? "is-on" : ""}
                            onClick={() => setMapMode("3d")}
                          >
                            <Move3d size={13} /> 3D Terrain
                          </button>
                          <button
                            className={mapMode === "2d" ? "is-on" : ""}
                            onClick={() => setMapMode("2d")}
                          >
                            <Boxes size={13} /> 2D Grid Matrix
                          </button>
                        </div>
                        {mapMode === "globe" && (
                          <span className="muted small map-hint">
                            Drag globe to orbit · Scroll wheel to zoom · Hover &
                            click pins
                          </span>
                        )}
                        {mapMode === "3d" && (
                          <span className="muted small map-hint">
                            Drag to orbit · scroll to zoom · click pins
                          </span>
                        )}
                      </div>

                      {/* Specific map layers under 3D */}
                      {mapMode === "3d" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            background: "var(--panel)",
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--brand)",
                              textTransform: "uppercase",
                            }}
                          >
                            3D Terrain Type:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              background: "var(--panel-2)",
                              padding: "2px",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              flexWrap: "wrap",
                              gap: "2px",
                            }}
                          >
                            {[
                              {
                                id: "satellite",
                                label: "🛰️ Satellite Surface",
                              },
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
                                  background:
                                    terrain3DStyle === st.id
                                      ? "var(--brand)"
                                      : "transparent",
                                  color:
                                    terrain3DStyle === st.id
                                      ? "#fff"
                                      : "var(--ink)",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>

                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--ink-soft)",
                              marginLeft: "4px",
                            }}
                          >
                            Steepness:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              background: "var(--panel-2)",
                              padding: "2px",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              gap: "2px",
                            }}
                          >
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
                                  background:
                                    terrain3DExaggeration === ex.val
                                      ? "var(--brand-2)"
                                      : "transparent",
                                  color:
                                    terrain3DExaggeration === ex.val
                                      ? "#fff"
                                      : "var(--ink-soft)",
                                  padding: "4px 7px",
                                  borderRadius: "4px",
                                  fontSize: "10.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s",
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
                              background: autoRotate3D
                                ? "rgba(33, 132, 95, 0.12)"
                                : "var(--panel-2)",
                              color: autoRotate3D
                                ? "var(--safe)"
                                : "var(--ink-soft)",
                              padding: "4px 8px",
                              borderRadius: "5px",
                              fontSize: "10.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              marginLeft: "auto",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            title="Toggle 3D Orbit Auto-Rotation"
                          >
                            {autoRotate3D ? "🔄 Orbiting" : "⏸️ Paused"}
                          </button>
                        </div>
                      )}

                      {/* Specific basemap layers under 2D GIS map */}
                      {mapMode === "risk" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            background:
                              "linear-gradient(135deg, #fff8f0, #fff)",
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "2px solid #FF9933",
                            boxShadow: "0 2px 8px rgba(255,153,51,0.15)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#FF6600",
                              textTransform: "uppercase",
                              display: "flex",
                              alignItems: "center",
                              gap: "5px",
                            }}
                          >
                            🗺️ Basemap:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              background: "rgba(255,153,51,0.08)",
                              padding: "2px",
                              borderRadius: "6px",
                              border: "1px solid rgba(255,153,51,0.3)",
                              flexWrap: "wrap",
                              gap: "2px",
                            }}
                          >
                            {[
                              { id: "satellite", label: "🚰️ Satellite" },
                              { id: "terrain", label: "⚰️ Topo Relief" },
                              { id: "standard", label: "🗺️ Streets" },
                              { id: "natgeo", label: "🗺️ NatGeo" },
                              { id: "osm_hot", label: "🏥 OSM HOT" },
                              { id: "topo", label: "🗺️ OpenTopo" },
                              { id: "relief", label: "🏔️ Shaded Relief" },
                            ].map((bm) => (
                              <button
                                key={bm.id}
                                onClick={() => setRisk2DStyle(bm.id)}
                                style={{
                                  border: "none",
                                  background:
                                    risk2DStyle === bm.id
                                      ? "linear-gradient(135deg, #FF9933, #FF6600)"
                                      : "transparent",
                                  color:
                                    risk2DStyle === bm.id
                                      ? "#fff"
                                      : "var(--ink)",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                  boxShadow:
                                    risk2DStyle === bm.id
                                      ? "0 2px 6px rgba(255,102,0,0.4)"
                                      : "none",
                                }}
                              >
                                {bm.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Specific thematic layers under 2D Grid */}
                      {mapMode === "2d" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexWrap: "wrap",
                            background: "var(--panel)",
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "var(--brand)",
                              textTransform: "uppercase",
                            }}
                          >
                            2D Grid Thematic Map:
                          </span>
                          <div
                            style={{
                              display: "flex",
                              background: "var(--panel-2)",
                              padding: "2px",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              flexWrap: "wrap",
                              gap: "2px",
                            }}
                          >
                            {[
                              {
                                id: "contours",
                                label: "🏔️ Topographic Contours",
                              },
                              {
                                id: "hydrology",
                                label: "🌊 Hydrology & Drainage",
                              },
                              { id: "hazard", label: "⚠️ Slope Hazard Matrix" },
                              {
                                id: "corridors",
                                label: "🛣️ Evacuation Network",
                              },
                            ].map((gs) => (
                              <button
                                key={gs.id}
                                onClick={() => setGrid2DStyle(gs.id)}
                                style={{
                                  border: "none",
                                  background:
                                    grid2DStyle === gs.id
                                      ? "var(--brand)"
                                      : "transparent",
                                  color:
                                    grid2DStyle === gs.id
                                      ? "#fff"
                                      : "var(--ink)",
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  transition: "all 0.15s",
                                }}
                              >
                                {gs.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {mapMode === "2d" && (
                      <div className="layer-controls" aria-label="Map layers">
                        <span className="layer-title">
                          <Layers size={13} /> Layers
                        </span>
                        {["hazard", "population", "sites"].map((layer) => (
                          <button
                            key={layer}
                            className={visibleLayers[layer] ? "is-on" : ""}
                            onClick={() =>
                              setVisibleLayers((current) => ({
                                ...current,
                                [layer]: !current[layer],
                              }))
                            }
                          >
                            {layer === "hazard"
                              ? "Hazard"
                              : layer === "population"
                                ? "Communities"
                                : "Relocation sites"}
                          </button>
                        ))}
                      </div>
                    )}
                    <motion.div
                      className="map-stage"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={mapMode}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
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
                              onToggleFusion={() =>
                                setFusionEnabled((current) => !current)
                              }
                              onToggleLayer={(layer) =>
                                setSelectedHazards((current) => ({
                                  ...current,
                                  [layer]: !current[layer],
                                }))
                              }
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
                      {mapMode === "3d" && (
                        <TerrainDecisionOverlay zone={selectedZone} />
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>

              {/* ===== LIVE INDIA STATS SIDEBAR PANEL ===== */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  minWidth: 0,
                }}
              >
                {/* Indian Flag Tricolor Header */}
                <div
                  style={{
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                  }}
                >
                  <div style={{ height: "5px", background: "#FF9933" }} />
                  <div
                    style={{
                      height: "5px",
                      background: "#ffffff",
                      borderTop: "1px solid #eee",
                      borderBottom: "1px solid #eee",
                    }}
                  />
                  <div style={{ height: "5px", background: "#138808" }} />
                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #000080 0%, #1a1a8e 100%)",
                      color: "#fff",
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontFamily: "Space Grotesk",
                        fontWeight: 700,
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ fontSize: "18px" }}>🇮🇳</span>
                      <span>INDIA LIVE DASHBOARD</span>
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.7)",
                        marginTop: "2px",
                      }}
                    >
                      BhoomiRakshak National Overview
                    </div>
                  </div>
                </div>

                {/* National Risk KPIs */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "2px solid #FF9933",
                    overflow: "hidden",
                    boxShadow: "0 4px 14px rgba(255,153,51,0.15)",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #FF9933, #FF6600)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "Space Grotesk",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <AlertTriangle size={13} /> NATIONAL RISK SUMMARY
                  </div>
                  <div
                    style={{
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                    }}
                  >
                    {[
                      {
                        label: "Total Zones",
                        val: zones.length,
                        color: "#000080",
                        icon: "🗺️",
                      },
                      {
                        label: "Immediate",
                        val: zones.filter((z) => z.phase === "Immediate")
                          .length,
                        color: "#c84b4b",
                        icon: "🔴",
                      },
                      {
                        label: "Short-Term",
                        val: zones.filter((z) => z.phase === "Short-Term")
                          .length,
                        color: "#FF6600",
                        icon: "🏠",
                      },
                      {
                        label: "Safe Zones",
                        val: zones.filter((z) => z.phase === "Medium-Term")
                          .length,
                        color: "#138808",
                        icon: "🟢",
                      },
                    ].map((kpi, i) => (
                      <div
                        key={i}
                        style={{
                          background: "#f8f9fa",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          border: `1px solid ${kpi.color}22`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#666",
                            marginBottom: "2px",
                            fontWeight: 600,
                          }}
                        >
                          {kpi.icon} {kpi.label}
                        </div>
                        <div
                          style={{
                            fontFamily: "Space Grotesk",
                            fontWeight: 700,
                            fontSize: "20px",
                            color: kpi.color,
                          }}
                        >
                          {kpi.val.toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Population at Risk Bar Chart */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "2px solid #138808",
                    overflow: "hidden",
                    boxShadow: "0 4px 14px rgba(19,136,8,0.1)",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #138808, #0d6b06)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "Space Grotesk",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Users size={13} /> POPULATION EXPOSURE
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    {[
                      {
                        label: "Immediate Risk",
                        pop: zones
                          .filter((z) => z.phase === "Immediate")
                          .reduce((s, z) => s + z.population, 0),
                        total: TOTAL_POP,
                        color: "#c84b4b",
                      },
                      {
                        label: "Short-Term Risk",
                        pop: zones
                          .filter((z) => z.phase === "Short-Term")
                          .reduce((s, z) => s + z.population, 0),
                        total: TOTAL_POP,
                        color: "#FF9933",
                      },
                      {
                        label: "Safe Population",
                        pop: zones
                          .filter((z) => z.phase === "Medium-Term")
                          .reduce((s, z) => s + z.population, 0),
                        total: TOTAL_POP,
                        color: "#138808",
                      },
                    ].map((row, i) => (
                      <div key={i} style={{ marginBottom: "8px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "10px",
                            color: "#555",
                            marginBottom: "3px",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{row.label}</span>
                          <span style={{ color: row.color, fontWeight: 700 }}>
                            {((row.pop / row.total) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: "8px",
                            background: "#eee",
                            borderRadius: "4px",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${Math.min(100, (row.pop / row.total) * 100)}%`,
                              background: row.color,
                              borderRadius: "4px",
                              transition: "width 1s ease",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: "9px",
                            color: "#888",
                            marginTop: "2px",
                          }}
                        >
                          {(row.pop / 1e5).toFixed(1)}L people
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Hazard Distribution Mini Chart */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "2px solid #000080",
                    overflow: "hidden",
                    boxShadow: "0 4px 14px rgba(0,0,128,0.1)",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #000080, #1a1a8e)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "Space Grotesk",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <Mountain size={13} /> HAZARD TYPE SPLIT
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    {[
                      {
                        label: "Flood",
                        count: zones.filter((z) => z.hazard === "flood").length,
                        color: "#1e7890",
                        icon: "🌈",
                      },
                      {
                        label: "Landslide",
                        count: zones.filter((z) => z.hazard === "slide").length,
                        color: "#8b4513",
                        icon: "⚰️",
                      },
                      {
                        label: "Multi-Hazard",
                        count: zones.filter(
                          (z) => z.hazard !== "flood" && z.hazard !== "slide",
                        ).length,
                        color: "#FF6600",
                        icon: "⚠️",
                      },
                    ].map((h, i) => {
                      const total = zones.length || 1;
                      const pct = Math.round((h.count / total) * 100);
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "8px",
                          }}
                        >
                          <span style={{ fontSize: "14px", width: "18px" }}>
                            {h.icon}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "10px",
                                marginBottom: "2px",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{h.label}</span>
                              <span style={{ color: h.color, fontWeight: 700 }}>
                                {h.count}
                              </span>
                            </div>
                            <div
                              style={{
                                height: "6px",
                                background: "#eef",
                                borderRadius: "3px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${pct}%`,
                                  background: h.color,
                                  borderRadius: "3px",
                                  transition: "width 1s ease",
                                }}
                              />
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#888",
                              minWidth: "28px",
                              textAlign: "right",
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Priority Zones */}
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    border: "1px solid #eee",
                    overflow: "hidden",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #c84b4b, #a33)",
                      color: "#fff",
                      padding: "8px 12px",
                      fontSize: "11px",
                      fontWeight: 700,
                      fontFamily: "Space Grotesk",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <AlertTriangle size={13} /> TOP PRIORITY ZONES
                  </div>
                  <div style={{ padding: "6px 0" }}>
                    {zones
                      .filter((z) => z.phase === "Immediate")
                      .sort((a, b) => b.priorityScore - a.priorityScore)
                      .slice(0, 5)
                      .map((z, i) => (
                        <div
                          key={z.id}
                          onClick={() => handleSelectZone(z.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "7px 12px",
                            borderBottom: "1px solid #f5f5f5",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#fff8f0")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "")
                          }
                        >
                          <span
                            style={{
                              fontFamily: "Space Grotesk",
                              fontWeight: 700,
                              fontSize: "12px",
                              color: "#c84b4b",
                              minWidth: "20px",
                            }}
                          >
                            #{i + 1}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "11.5px",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {z.name}
                            </div>
                            <div style={{ fontSize: "9.5px", color: "#888" }}>
                              {z.district} · {(z.population / 1000).toFixed(1)}K
                              people
                            </div>
                          </div>
                          <span
                            style={{
                              background:
                                "linear-gradient(135deg, #c84b4b, #a33)",
                              color: "#fff",
                              borderRadius: "5px",
                              padding: "2px 6px",
                              fontSize: "10px",
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {z.priorityScore}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                {/* Tricolor footer strip */}
                <div
                  style={{
                    borderRadius: "8px",
                    overflow: "hidden",
                    display: "flex",
                    height: "8px",
                  }}
                >
                  <div style={{ flex: 1, background: "#FF9933" }} />
                  <div
                    style={{
                      flex: 1,
                      background: "#ffffff",
                      border: "1px solid #ddd",
                    }}
                  />
                  <div style={{ flex: 1, background: "#138808" }} />
                </div>
              </div>
            </div>

            {/* FULL WIDTH DETAIL PANEL (Resettlement Masterplan) */}
            <div style={{ marginTop: "24px" }}>
              <DetailPanel
                zone={selectedZone}
                role="authority"
                relocationTarget={relocationTarget}
                onApproveRelocation={(rt) => {
                  setToast(
                    `Relocation plan approved: ${rt.source.name} ➔ ${rt.target.name}`,
                  );
                }}
                onCertificate={(z) => setCertZone(z)}
                onAlert={(z) => {
                  setToast(
                    `Community alert queued for ${z.id} (${lang === "hi" ? "हिन्दी" : "English"})`,
                  );
                  fetch(buildApiUrl("/api/alert"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      zone_id: parseInt(z.id.replace(/\D/g, "")) || 0,
                      hazard_type: z.hazard,
                      phase: z.phase,
                      priority_score: z.priorityScore,
                      population: z.population,
                      message: "Alert triggered from console.",
                    }),
                  }).catch((e) => console.error("Alert send failed", e));
                }}
              />
            </div>
          </>
        )}
        {role === "authority" && tab === "phasing" && (
          <PhasingTab
            zones={zones}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("overview");
            }}
          />
        )}
        {role === "authority" && tab === "reverse-insurance" && (
          <ReverseInsurance zones={zones} initialZoneId={selectedId} />
        )}
        {role === "authority" && tab === "fund-calculator" && (
          <ClimateFundCalculator zones={zones} initialZoneId={selectedId} />
        )}
        {role === "authority" && tab === "community-voice" && (
          <CommunityVoice
            zones={zones}
            initialFeedback={feedback}
            onSubmitFeedback={(f) => {
              setFeedback([f, ...feedback]);
              setToast("Feedback submitted & queued for model retraining");
            }}
          />
        )}
        {role === "authority" && tab === "analytics" && (
          <AnalyticsTab zones={zones} />
        )}
        {role === "authority" && tab === "reports" && (
          <ReportsTab zones={zones} onCertificate={(z) => setCertZone(z)} />
        )}
        {role === "authority" && tab === "alerts" && <AlertsTab />}
        {role === "citizen" && (
          <CitizenTab
            zones={zones}
            selectedId={selectedId}
            onSelect={setSelectedId}
            selectedIdRef={selectedIdRef}
            feedback={feedback}
            onSubmitFeedback={(f) => {
              setFeedback([f, ...feedback]);
              setToast("Feedback submitted to district team");
            }}
            lang={lang}
            setLang={setLang}
            subscribed={subscribed}
            onSubscribe={() => {
              setSubscribed(!subscribed);
              setToast(
                subscribed
                  ? "Alerts turned off"
                  : "Subscribed to voice & SMS alerts",
              );
            }}
            relocationTarget={relocationTarget}
          />
        )}
      </div>

      <CertificateModal zone={certZone} onClose={() => setCertZone(null)} />
      <BriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        zones={zones}
        selectedZone={selectedZone}
        district={district}
        lastSync={lastSync}
      />

      {/* Floating Real-Time Notifications & Latest Updates Drawer */}
      {notifOpen && (
        <div
          className="modal-overlay"
          style={{
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
          }}
          onClick={() => setNotifOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              width: "92%",
              maxWidth: "480px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              padding: "0",
              overflow: "hidden",
              borderRadius: "14px",
              border: "2px solid #1e293b",
              boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                padding: "16px",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontWeight: 700,
                  fontSize: "16px",
                }}
              >
                <Bell size={18} style={{ color: "#38bdf8" }} />
                <span>Real-Time Updates & Notifications</span>
                {unreadNotifCount > 0 && (
                  <span
                    style={{
                      background: "#ef4444",
                      color: "#ffffff",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: 800,
                    }}
                  >
                    {unreadNotifCount} New
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Actions Bar */}
            <div
              style={{
                padding: "10px 16px",
                background: "var(--panel-2)",
                borderBottom: "1px solid var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "11.5px", color: "var(--ink-soft)" }}>
                Showing {notifications.length} live system updates
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={markAllNotifsRead}
                  className="btn-ghost sm"
                  style={{ fontSize: "10.5px" }}
                >
                  Γ£ô Mark All Read
                </button>
                <button
                  type="button"
                  onClick={() => syncLiveWeather()}
                  className="btn-ghost sm"
                  style={{ fontSize: "10.5px", color: "var(--brand-2)" }}
                >
                  <RefreshCw size={10} /> Sync Live API
                </button>
              </div>
            </div>

            {/* Notification Feed */}
            <div
              style={{
                overflowY: "auto",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                flex: 1,
                maxHeight: "60vh",
              }}
            >
              {notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.read ? "var(--panel)" : "#f0f9ff",
                    border: n.read
                      ? "1px solid var(--line)"
                      : "1.5px solid #0284c7",
                    borderRadius: "10px",
                    padding: "12px",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontSize: "14px" }}>
                        {n.category === "satellite"
                          ? "📡"
                          : n.category === "alert"
                            ? "⚠️"
                            : n.category === "report"
                              ? "📝"
                              : n.category === "resettlement"
                                ? "🌱"
                                : "📣"}
                      </span>
                      <strong
                        style={{
                          fontSize: "13px",
                          color: "var(--brand)",
                          fontFamily: "Space Grotesk, sans-serif",
                        }}
                      >
                        {n.title}
                      </strong>
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--ink-soft)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.time}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: "4px 0 8px",
                      fontSize: "11.5px",
                      color: "var(--ink-soft)",
                      lineHeight: "1.45",
                    }}
                  >
                    {n.body}
                  </p>
                  {n.zoneId && (
                    <button
                      type="button"
                      className="btn-ghost sm"
                      style={{
                        fontSize: "10.5px",
                        padding: "3px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      onClick={() => {
                        handleSelectZone(n.zoneId);
                        setNotifOpen(false);
                      }}
                    >
                      Inspect Zone {n.zoneId} <ArrowRight size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={14} /> {toast}
        </div>
      )}
      {role === "authority" && (
        <nav
          className="mobile-dashboard-nav"
          aria-label="Mobile dashboard navigation"
        >
          <button
            type="button"
            className={tab === "overview" ? "is-active" : ""}
            onClick={() => setTab("overview")}
          >
            <Satellite size={16} /> Overview
          </button>
          <button
            type="button"
            className={tab === "phasing" ? "is-active" : ""}
            onClick={() => setTab("phasing")}
          >
            <Layers size={16} /> Phasing
          </button>
          <button
            type="button"
            className={tab === "alerts" ? "is-active" : ""}
            onClick={() => setTab("alerts")}
          >
            <Bell size={16} /> Alerts
          </button>
          <button type="button" onClick={() => navigate("/intel")}>
            <Sparkles size={16} /> Intel
          </button>
        </nav>
      )}
    </div>
  );
}

/* ======================================================================
   LANDING / MARKETING SITE
   ====================================================================== */

const PROBLEM_ITEMS = [
  {
    title: "Reactive over proactive",
    body: "Disaster management today focuses on rescue and relief after the event, not on reducing exposure before it happens.",
  },
  {
    title: "Subjective prioritization",
    body: "Without a shared scoring model, which communities get relocated first is a judgment call, not a data-driven ranking.",
  },
  {
    title: "Unsustainable resettlement",
    body: "Sites get chosen for available land, not carrying capacity — displaced families often drift back to hazardous ground.",
  },
];
const PILLARS = [
  {
    name: "Risk assessment",
    tag: "Signals to a priority list",
    icon: "satellite",
    items: [
      "Multi-hazard layer comparison",
      "Carrying-capacity checks",
      "Auditable priority ranking",
    ],
  },
  {
    name: "Financial & legal feasibility",
    tag: "Feasible · funded · legally backed",
    icon: "scale",
    items: [
      "Cost-of-delay estimate",
      "Climate migration fund calculator",
      "Red zone legal certificate & audit trail",
      "Relocation phasing matrix",
    ],
  },
  {
    name: "Last-mile execution",
    tag: "People first · inclusive · connected",
    icon: "landmark",
    items: [
      "Multilingual voice & SOS",
      "Offline SMS & route alerts",
      "Community feedback loop",
      "Family reunion tracker",
    ],
  },
];
const PHASE_INFO = [
  {
    phase: "Immediate",
    window: "0–6 months",
    body: "High structural risk, historical casualty record, isolated geography.",
  },
  {
    phase: "Short-Term",
    window: "6–18 months",
    body: "High erosion rate or recurring seasonal damage without immediate structural collapse.",
  },
  {
    phase: "Medium-Term",
    window: "18–36 months",
    body: "Projected long-term climate vulnerability or gradual land subsidence.",
  },
];
const STATS = [
  { num: "75L", lab: "hectares affected by floods every year" },
  { num: "₹1,805Cr", lab: "avg. annual damage to crops, homes & utilities" },
  { num: "2/3", lab: "of Indian states & UTs are disaster prone" },
  { num: "40M+", lab: "hectares (12% of land) prone to flood & erosion" },
];
const FEASIBILITY = [
  {
    title: "Technical",
    body: "Built on proven GIS, remote-sensing, cloud, and field-data components with clear update paths.",
    icon: "cog",
  },
  {
    title: "Financial",
    body: "Low initial investment and a reverse-insurance model that funds itself through avoided disaster cost.",
    icon: "wallet",
  },
  {
    title: "Legal & policy",
    body: "Aligned with NDMA guidelines and the Disaster Management Act, 2025.",
    icon: "scale",
  },
  {
    title: "Operational",
    body: "Integrates with existing government workflows and is usable by both authorities and citizens.",
    icon: "landmark",
  },
];
const TECH = [
  "Python",
  "FastAPI",
  "GeoPandas",
  "PostGIS",
  "React",
  "Three.js",
  "Mapbox GL",
  "AWS",
  "Vercel",
];
const FEAS_ICON = {
  cog: Cog,
  wallet: Wallet,
  scale: Scale,
  landmark: Landmark,
};
const PILLAR_ICON = { satellite: Satellite, scale: Scale, landmark: Landmark };

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

const DEMO_STEPS = [
  {
    label: "Detect",
    title: "Spot the pressure early",
    text: "A river, slope, or erosion signal enters the risk picture.",
    metric: "94",
    metricLabel: "hazard signal",
    color: "var(--immediate)",
  },
  {
    label: "Rank",
    title: "Put people before polygons",
    text: "Hazard intensity is combined with exposure and household vulnerability.",
    metric: "68",
    metricLabel: "priority score",
    color: "var(--watch)",
  },
  {
    label: "Match",
    title: "Check the destination",
    text: "The site check shows whether a proposed location can actually carry the people assigned to it.",
    metric: "82%",
    metricLabel: "site capacity used",
    color: "var(--safe)",
  },
  {
    label: "Act",
    title: "Turn analysis into a move",
    text: "Authorities get a phase, an explanation, an alert path, and an auditable certificate.",
    metric: "01",
    metricLabel: "action plan ready",
    color: "var(--brand-2)",
  },
];
const DEMO_LOGS = [
  "Satellite and field reports logged for 12 planning areas",
  "Priority list updated against household vulnerability",
  "Relocation capacity checked against projected population",
  "Action packet prepared for district authority review",
];
const DEMO_SCENARIOS = [
  { id: "monsoon", label: "Extreme monsoon", hazard: "flood", lift: 1.18 },
  {
    id: "slope",
    label: "Monsoon slope movement",
    hazard: "landslide",
    lift: 1.12,
  },
  { id: "heat", label: "Heat and water stress", hazard: "heat", lift: 1.08 },
];

function DemoSection({ onLaunch }) {
  const [activeStep, setActiveStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [scenarioId, setScenarioId] = useState("monsoon");

  const scenario =
    DEMO_SCENARIOS.find((item) => item.id === scenarioId) || DEMO_SCENARIOS[0];
  const scenarioZones = useMemo(
    () =>
      ZONES.map((zone) => {
        const match =
          scenario.hazard === "heat"
            ? zone.district.includes("Barmer")
            : zone.icon === scenario.hazard;
        const score = Math.min(
          100,
          Math.round(zone.priorityScore * (match ? scenario.lift : 0.92)),
        );
        return { ...zone, demoScore: score };
      }),
    [scenario],
  );
  const actionZones = scenarioZones.filter((zone) => zone.demoScore >= 45);
  const exposedPeople = actionZones.reduce(
    (sum, zone) => sum + zone.population,
    0,
  );
  const leadZone = [...scenarioZones].sort(
    (a, b) => b.demoScore - a.demoScore,
  )[0];
  const leadSuitability = getSiteSuitability(leadZone);
  const scenarioSteps = DEMO_STEPS.map((step, index) => ({
    ...step,
    metric:
      index === 0
        ? `${actionZones.length}`
        : index === 1
          ? `${leadZone.demoScore}`
          : index === 2
            ? `${leadSuitability.score}`
            : `${Math.round(exposedPeople / 100) / 10}k`,
    metricLabel:
      index === 0
        ? "zones needing action"
        : index === 1
          ? "priority score"
          : index === 2
            ? "site suitability"
            : "people in action plan",
  }));

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setActiveStep((current) => {
        if (current === DEMO_STEPS.length - 1) {
          setPlaying(false);
          setCompleted(true);
          return current;
        }
        return current + 1;
      });
    }, 1800);
    return () => clearInterval(timer);
  }, [playing]);

  const step = scenarioSteps[activeStep];

  // Scenario theme config
  const SCENARIO_THEME = {
    monsoon: {
      accent: "#1e7890",
      bg: "linear-gradient(135deg,#e8f4f8 0%,#d0eaf5 100%)",
      label: "🌧️ Rain",
    },
    slope: {
      accent: "#8B5E3C",
      bg: "linear-gradient(135deg,#f5ede0 0%,#e8d5b7 100%)",
      label: "🪨 Landslide",
    },
    heat: {
      accent: "#c84b1a",
      bg: "linear-gradient(135deg,#fff3e0 0%,#ffd9b3 100%)",
      label: "🔥 Heat",
    },
  };
  const theme = SCENARIO_THEME[scenarioId] || SCENARIO_THEME.monsoon;

  // Weather canvas
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = (canvas.width = canvas.offsetWidth);
    let H = (canvas.height = canvas.offsetHeight);
    let particles = [];
    cancelAnimationFrame(rafRef.current);

    if (scenarioId === "monsoon") {
      for (let i = 0; i < 120; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          len: 10 + Math.random() * 20,
          speed: 8 + Math.random() * 10,
          alpha: 0.2 + Math.random() * 0.5,
        });
      }
      function drawRain() {
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = "#1e7890";
        ctx.lineWidth = 1;
        particles.forEach((p) => {
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 1, p.y + p.len);
          ctx.stroke();
          p.y += p.speed;
          if (p.y > H) {
            p.y = -p.len;
            p.x = Math.random() * W;
          }
        });
        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(drawRain);
      }
      drawRain();
    } else if (scenarioId === "slope") {
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H * 0.5,
          r: 3 + Math.random() * 8,
          vx: 1 + Math.random() * 2,
          vy: 2 + Math.random() * 4,
          alpha: 0.3 + Math.random() * 0.5,
        });
      }
      function drawSlope() {
        ctx.clearRect(0, 0, W, H);
        particles.forEach((p) => {
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = "#8B5E3C";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > H + 10 || p.x > W + 10) {
            p.x = Math.random() * W * 0.5;
            p.y = -10;
          }
        });
        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(drawSlope);
      }
      drawSlope();
    } else if (scenarioId === "heat") {
      let t = 0;
      function drawHeat() {
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < 8; i++) {
          const y = (H / 8) * i + Math.sin(t * 0.04 + i) * 6;
          const grad = ctx.createLinearGradient(0, y, W, y + 20);
          grad.addColorStop(0, `rgba(200,75,26,0)`);
          grad.addColorStop(
            0.5,
            `rgba(200,75,26,${0.04 + Math.sin(t * 0.03 + i) * 0.02})`,
          );
          grad.addColorStop(1, `rgba(200,75,26,0)`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, y, W, 20);
        }
        t++;
        rafRef.current = requestAnimationFrame(drawHeat);
      }
      drawHeat();
    }

    const onResize = () => {
      W = canvas.width = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [scenarioId]);

  return (
    <section
      className="section demo-section"
      id="demo"
      style={{
        background: theme.bg,
        transition: "background 0.6s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div className="section-head demo-head">
          <div>
            <div className="eyebrow">
              <Play size={13} /> Guided planning walkthrough
            </div>
            <h2>See the decision move from signal to action.</h2>
          </div>
          <div className="demo-actions">
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 600,
                color: theme.accent,
                background: "rgba(255,255,255,0.7)",
                border: `1px solid ${theme.accent}55`,
                borderRadius: "20px",
                padding: "4px 10px",
              }}
            >
              {theme.label}
            </span>
            <select
              value={scenarioId}
              onChange={(event) => {
                setScenarioId(event.target.value);
                setActiveStep(0);
                setCompleted(false);
                setPlaying(false);
              }}
              style={{ borderColor: theme.accent }}
            >
              {DEMO_SCENARIOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              style={{ background: theme.accent, borderColor: theme.accent }}
              onClick={() => {
                setActiveStep(0);
                setCompleted(false);
                setPlaying(true);
              }}
            >
              <Play size={14} /> Play walkthrough
            </button>
          </div>
        </div>
        <div className="demo-stage">
          <div className="demo-rail">
            {scenarioSteps.map((item, index) => (
              <button
                key={item.label}
                className={`demo-step ${activeStep === index ? "is-active" : ""}`}
                style={
                  activeStep === index
                    ? { borderLeftColor: theme.accent, color: theme.accent }
                    : {}
                }
                onClick={() => {
                  setActiveStep(index);
                  setPlaying(false);
                  setCompleted(false);
                }}
              >
                <span className="demo-step-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className="demo-detail" style={{ "--demo-color": theme.accent }}>
            <div className="demo-detail-copy">
              <span className="demo-kicker">
                STEP {String(activeStep + 1).padStart(2, "0")} /{" "}
                {DEMO_STEPS.length}
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              <div className="demo-progress">
                <span
                  style={{
                    width: `${((activeStep + 1) / DEMO_STEPS.length) * 100}%`,
                    background: theme.accent,
                  }}
                />
              </div>
            </div>
            <div
              className="demo-signal-board"
              aria-label="Planning calculation signal board"
            >
              <div className="signal-grid">
                {Array.from({ length: 24 }, (_, index) => (
                  <span
                    key={index}
                    className={index % 6 <= activeStep + 1 ? "is-lit" : ""}
                    style={
                      index % 6 <= activeStep + 1
                        ? { background: theme.accent }
                        : {}
                    }
                  />
                ))}
              </div>
              <div className="signal-caption">
                <span
                  className="signal-live"
                  style={{ background: theme.accent }}
                />{" "}
                calculation updating
              </div>
            </div>
            <div className="demo-metric">
              <strong style={{ color: theme.accent }}>{step.metric}</strong>
              <span>{step.metricLabel}</span>
            </div>
          </div>
          <div className="demo-log" aria-live="polite">
            <div className="demo-log-head">
              <span>PROCESS LOG</span>
              <span>
                {completed
                  ? "RUN COMPLETE"
                  : `${activeStep + 1} / ${DEMO_STEPS.length} events`}
              </span>
            </div>
            {DEMO_LOGS.slice(0, activeStep + 1).map((log, index) => (
              <div className="demo-log-row" key={log}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{log}</p>
                <CheckCircle2 size={13} style={{ color: theme.accent }} />
              </div>
            ))}
          </div>
          <div className="demo-footer">
            <span className={completed ? "demo-complete" : ""}>
              {completed
                ? "Walkthrough complete — decision support layer is ready"
                : playing
                  ? "Walkthrough is running"
                  : "Choose a step or play the walkthrough"}
            </span>
            <div>
              <button
                className="demo-icon-btn"
                onClick={() => {
                  setPlaying(!playing);
                  setCompleted(false);
                }}
                title={playing ? "Pause walkthrough" : "Play walkthrough"}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                className="demo-icon-btn"
                onClick={() => {
                  setActiveStep(0);
                  setPlaying(false);
                  setCompleted(false);
                }}
                title="Reset walkthrough"
              >
                <RotateCcw size={14} />
              </button>
              <button className="btn-ghost sm" onClick={onLaunch}>
                Open decision support layer <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingPage({ onLaunch, onGlobalView }) {
  const heroRef = useRef(null);
  const dummySelected = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstallable(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="site">
      <nav className="site-nav">
        <div className="brand-wrap">
          <img
            src="/logo.jpg"
            alt="Bhoomi Rakshak logo"
            className="brand-logo-img"
          />
          <div className="site-brand-lockup">
            <div className="brand-name">BHOOMI RAKSHAK 2.0</div>
            <div className="site-brand-sub">DECISION SUPPORT LAYER</div>
          </div>
        </div>
        <div className="nav-links">
          <div className="nav-section-links">
            <button onClick={() => scrollToId("problem")}>Problem</button>
            <button onClick={() => scrollToId("solution")}>Solution</button>
            <button onClick={() => scrollToId("how")}>How it works</button>
            <button onClick={() => scrollToId("demo")}>Demo</button>
          </div>
          <span className="nav-status">
            <span /> System online
          </span>
          {isInstallable && (
            <button
              className="btn-primary sm"
              onClick={handleInstallClick}
              style={{
                backgroundColor: "#e53e3e",
                borderColor: "#e53e3e",
                color: "white",
              }}
            >
              Install App
            </button>
          )}
          <button className="btn-primary sm" onClick={onLaunch}>
            Launch console <ArrowRight size={13} />
          </button>
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className={`hamburger ${mobileMenuOpen ? "is-open" : ""}`}>
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="mobile-nav-drawer">
          <button
            onClick={() => {
              scrollToId("problem");
              setMobileMenuOpen(false);
            }}
          >
            Problem
          </button>
          <button
            onClick={() => {
              scrollToId("solution");
              setMobileMenuOpen(false);
            }}
          >
            Solution
          </button>
          <button
            onClick={() => {
              scrollToId("how");
              setMobileMenuOpen(false);
            }}
          >
            How it works
          </button>
          <button
            onClick={() => {
              scrollToId("demo");
              setMobileMenuOpen(false);
            }}
          >
            Demo
          </button>
          {isInstallable && (
            <button
              onClick={() => {
                handleInstallClick();
                setMobileMenuOpen(false);
              }}
              style={{ color: "#e53e3e", fontWeight: "600" }}
            >
              Install App
            </button>
          )}
          <button
            className="btn-primary"
            style={{ margin: "8px 16px 4px" }}
            onClick={() => {
              onLaunch();
              setMobileMenuOpen(false);
            }}
          >
            Launch console <ArrowRight size={13} />
          </button>
        </div>
      )}
      <nav className="mobile-site-nav" aria-label="Mobile site navigation">
        <button type="button" onClick={() => scrollToId("problem")}>
          <Info size={15} /> Explore
        </button>
        <button type="button" onClick={() => scrollToId("demo")}>
          <Play size={15} /> Demo
        </button>
        <button type="button" className="is-primary" onClick={onLaunch}>
          <ArrowRight size={15} /> Launch
        </button>
      </nav>

      <section
        className="hero"
        ref={heroRef}
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
        }}
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.78,
            zIndex: 0,
            pointerEvents: "none",
            filter: "contrast(1.38) saturate(1.2) brightness(0.72)",
            transform: "scale(1.18)",
            transformOrigin: "center center",
          }}
        >
          <source src={bgVideo} type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(255, 249, 226, 0.94) 0%, rgba(255, 224, 138, 0.64) 42%, rgba(201, 149, 37, 0.28) 76%, rgba(16, 42, 76, 0.12) 100%)",
            zIndex: 0,
          }}
        />
        <div
          className="hero-grid"
          style={{
            position: "relative",
            zIndex: 1,
            padding: "40px 0",
            width: "100%",
          }}
        >
          <motion.div
            className="hero-brief"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.div
              className="hero-eyebrow"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <span className="eyebrow-mark" /> DECISION SUPPORT LAYER
            </motion.div>
            <motion.h1
              className="headline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              style={{
                fontSize: "clamp(28px, 5.2vw, 64px)",
                lineHeight: 1.08,
                textShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              Know who needs help before it is too late.
            </motion.h1>
            <motion.p
              className="sub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              A GIS-enabled decision support system for proactive disaster
              relocation planning.
            </motion.p>
            <motion.div
              className="cta-row"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary lg"
                onClick={onLaunch}
                style={{ boxShadow: "0 8px 24px rgba(20,59,93,0.3)" }}
              >
                Open decision support layer <ArrowRight size={15} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-ghost lg"
                onClick={() => scrollToId("demo")}
              >
                Watch the workflow <Play size={14} />
              </motion.button>
            </motion.div>
            <motion.div
              className="hero-stats hero-metrics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <div>
                <strong>{ZONES.length}</strong>
                <span>risk areas</span>
              </div>
              <div>
                <strong>06</strong>
                <span>regions watched</span>
              </div>
              <div>
                <strong>{fmt(TOTAL_POP)}</strong>
                <span>people in view</span>
              </div>
            </motion.div>
            <motion.div
              className="hero-note"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <span>PLANNING NOTE</span>
              <p>
                A risk score is only useful when it ends with a viable address.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="section" id="problem">
        <div className="section-head">
          <h2>
            The gap lies in connecting the hazard data, population vulnerability
            and relocation site suitability into a single proactive framework
            that can identify priority habitations and can give immediate,
            short, and medium and long term relocation plan.
          </h2>
        </div>
        <div className="problem-grid">
          {PROBLEM_ITEMS.map((p) => (
            <div className="problem-card" key={p.title}>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section alt" id="solution">
        <div className="section-head">
          <h2>Three working views, one planning decision.</h2>
          <p
            className="muted"
            style={{
              fontFamily: "monospace",
              fontSize: "13px",
              letterSpacing: "0.3px",
            }}
          >
            H = (0.30 ├ù L) + (0.25 ├ù S) + (0.20 ├ù R) + (0.15 ├ù G) + (0.10 ├ù
            V)
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 18px",
              justifyContent: "center",
              marginTop: "10px",
              fontSize: "11.5px",
              color: "var(--ink-soft)",
            }}
          >
            <span>
              <strong>L</strong> Landslide / Slope Movement (30%)
            </span>
            <span>
              <strong>S</strong> Soil Saturation (25%)
            </span>
            <span>
              <strong>R</strong> Rainfall &amp; Water Level (20%)
            </span>
            <span>
              <strong>G</strong> Geographic &amp; Historical Hazard (15%)
            </span>
            <span>
              <strong>V</strong> Vulnerability &amp; Population Exposure (10%)
            </span>
          </div>
        </div>
        <div className="pillar-grid">
          {PILLARS.map((p) => {
            const Icon = PILLAR_ICON[p.icon];
            return (
              <div className="pillar-card" key={p.name}>
                <div className="pillar-icon">
                  <Icon size={18} />
                </div>
                <h3>{p.name}</h3>
                <div className="pillar-tag">{p.tag}</div>
                <ul className="pillar-list">
                  {p.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <h2>Phased action routing</h2>
          <p className="muted">
            Every zone lands in exactly one phase, driven by its own priority
            score.
          </p>
        </div>
        <div className="timeline">
          {PHASE_INFO.map((p, i) => (
            <div
              className="timeline-step"
              key={p.phase}
              style={{ borderColor: PHASE_COLOR[p.phase] }}
            >
              <div
                className="timeline-index"
                style={{ color: PHASE_COLOR[p.phase] }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="timeline-title">{p.phase}</div>
              <div className="timeline-window muted small">{p.window}</div>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <DemoSection onLaunch={onLaunch} />

      <section className="section alt">
        <div className="section-head">
          <h2>Why this matters</h2>
        </div>
        <div className="stats-strip">
          {STATS.map((s) => (
            <div className="stat-chip" key={s.lab}>
              <div className="stat-chip-num">{s.num}</div>
              <div className="stat-chip-lab">{s.lab}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="feasibility">
        <div className="section-head">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "#ecfdf5",
              color: "#065f46",
              border: "1px solid #a7f3d0",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Feasible • Funded • Legally Backed
          </div>
          <h2>Three Pillars of Proactive Resettlement</h2>
          <p className="muted">
            Empowering disaster decision-makers with statutory funding,
            actuarial cost-of-delay calculations, and continuous citizen model
            retraining.
          </p>
        </div>

        {/* 3 User Feature Cards Matching Slide Specs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          {/* Feature 1: Reverse Insurance */}
          <div
            style={{
              background: "var(--panel)",
              border: "2px solid #2e8b68",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 6px 20px rgba(46, 139, 104, 0.08)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "var(--brand)",
                  fontWeight: 700,
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                1. Reverse Insurance (Cost of delay)
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#ecfdf5",
                  color: "#065f46",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  border: "1px solid #a7f3d0",
                }}
              >
                Act Today, Save Tomorrow
              </span>
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--ink-soft)",
                lineHeight: "1.45",
              }}
            >
              Compare proactive resettlement cost vs projected post disaster
              cost
            </p>

            {/* Visual Balance Scale Graphic Box */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#166534",
                    textTransform: "uppercase",
                  }}
                >
                  Proactive Cost
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#15803d",
                    fontFamily: "Space Grotesk, sans-serif",
                  }}
                >
                  ₹2 Cr
                </div>
              </div>
              <div
                style={{
                  padding: "0 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  color: "#166534",
                }}
              >
                <Scale size={24} />
                <span
                  style={{ fontSize: "9px", fontWeight: 700, marginTop: "2px" }}
                >
                  9x ROI
                </span>
              </div>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "#991b1b",
                    textTransform: "uppercase",
                  }}
                >
                  Post Disaster Cost
                </div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#b91c1c",
                    fontFamily: "Space Grotesk, sans-serif",
                  }}
                >
                  ₹18 Cr
                </div>
              </div>
            </div>

            <button
              className="btn-primary sm"
              style={{
                marginTop: "auto",
                width: "100%",
                justifyContent: "center",
                background: "#15803d",
                borderColor: "#15803d",
              }}
              onClick={() => onLaunch("reverse-insurance")}
            >
              Open Reverse Insurance Tool <ArrowRight size={13} />
            </button>
          </div>

          {/* Feature 2: Climate Migration Fund Calculator */}
          <div
            style={{
              background: "var(--panel)",
              border: "2px solid #1e7890",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 6px 20px rgba(30, 120, 144, 0.08)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "var(--brand)",
                  fontWeight: 700,
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                2. Climate Migration Fund Calculator
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#e0f2fe",
                  color: "#0369a1",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  border: "1px solid #bae6fd",
                }}
              >
                15th FC Aligned
              </span>
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--ink-soft)",
                lineHeight: "1.45",
              }}
            >
              Auto-maps funding rules across SDMF, NDMF &amp; Central Grants
            </p>

            {/* Visual Funding Rules Breakdown Box */}
            <div
              style={{
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                borderRadius: "10px",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <span style={{ fontWeight: 600, color: "#0369a1" }}>
                  NDMF (National Mitigation)
                </span>
                <strong style={{ color: "#0c4a6e" }}>75% - 90%</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <span style={{ fontWeight: 600, color: "#0369a1" }}>
                  SDMF (State Mitigation)
                </span>
                <strong style={{ color: "#0c4a6e" }}>10% - 25%</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                }}
              >
                <span style={{ fontWeight: 600, color: "#0369a1" }}>
                  Central Convergence
                </span>
                <strong style={{ color: "#0c4a6e" }}>
                  PMAY-G + JJM + PMGSY
                </strong>
              </div>
            </div>

            <button
              className="btn-primary sm"
              style={{
                marginTop: "auto",
                width: "100%",
                justifyContent: "center",
                background: "#0e7490",
                borderColor: "#0e7490",
              }}
              onClick={() => onLaunch("fund-calculator")}
            >
              Open Fund Calculator <ArrowRight size={13} />
            </button>
          </div>

          {/* Feature 3: Community Voice & Citizen Feedback */}
          <div
            style={{
              background: "var(--panel)",
              border: "2px solid #3b82f6",
              borderRadius: "14px",
              padding: "22px",
              boxShadow: "0 6px 20px rgba(59, 130, 246, 0.08)",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                  color: "var(--brand)",
                  fontWeight: 700,
                  fontFamily: "Space Grotesk, sans-serif",
                }}
              >
                3. Community Voice &amp; Citizen Feedback
              </h3>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  border: "1px solid #bfdbfe",
                }}
              >
                Continuous Retraining
              </span>
            </div>
            <p
              style={{
                margin: "0 0 16px",
                fontSize: "13px",
                color: "var(--ink-soft)",
                lineHeight: "1.45",
              }}
            >
              Community feedback loop to improve &amp; retrain relocation models
              continuously
            </p>

            {/* Visual Closed Loop Box */}
            <div
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                padding: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <Users size={24} color="#1d4ed8" />
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#1e40af",
                    }}
                  >
                    Field Observations ➔ Weight Recalibration
                  </div>
                  <div style={{ fontSize: "10px", color: "#3b82f6" }}>
                    Updates H = 0.30L + 0.25S + 0.20R + 0.15G + 0.10V
                  </div>
                </div>
              </div>
            </div>

            <button
              className="btn-primary sm"
              style={{
                marginTop: "auto",
                width: "100%",
                justifyContent: "center",
                background: "#1d4ed8",
                borderColor: "#1d4ed8",
              }}
              onClick={() => onLaunch("community-voice")}
            >
              Explore Feedback &amp; Retraining Loop <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Existing Operational Feasibility Grid */}
        <div className="problem-grid">
          {FEASIBILITY.map((f) => {
            const Icon = FEAS_ICON[f.icon];
            return (
              <div className="problem-card" key={f.title}>
                <Icon size={16} className="feas-icon" />
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="tech-strip-wrap">
        <span className="muted small">Built with</span>
        <div className="tech-strip">
          {TECH.map((t) => (
            <span className="tech-chip" key={t}>
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="cta-banner">
        <div>
          <h2>Open the console and rank your first red zone.</h2>
          <p>
            Review the score, set a phase, issue a record, and bring local
            feedback into the same planning desk.
          </p>
        </div>
        <button
          className="btn-primary lg"
          onClick={onLaunch}
          style={{
            boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
            transform: "scale(1.05)",
            transition: "all 0.2s",
          }}
        >
          Launch console <ArrowRight size={15} />
        </button>
      </section>

      <footer className="footer">
        <div className="footer-row">
          <div>
            <div className="brand-name">BHOOMI RAKSHAK 2.0</div>
            <div className="muted small">
              Smart India Hackathon 2026 · Problem Statement 26191 · Team
              Aarambh
            </div>
          </div>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
            <a
              href="/privacy"
              style={{ color: "var(--ink-soft)", textDecoration: "none" }}
              onMouseOver={(e) => (e.target.style.color = "var(--brand)")}
              onMouseOut={(e) => (e.target.style.color = "var(--ink-soft)")}
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              style={{ color: "var(--ink-soft)", textDecoration: "none" }}
              onMouseOver={(e) => (e.target.style.color = "var(--brand)")}
              onMouseOut={(e) => (e.target.style.color = "var(--ink-soft)")}
            >
              Terms & Conditions
            </a>
          </div>
          <div className="muted small">
            Working demonstration — planning records are supplied for review.
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ======================================================================
   ROOT
   ====================================================================== */

export default function BhoomiRakshakWebsite() {
  const location = useLocation();
  const navigate = useNavigate();
  const view =
    location.pathname === "/console" || location.pathname === "/citizen"
      ? "console"
      : "landing";
  return (
    <div className="site-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        :root {
          --ink: #352b20; --ink-soft: #796d5e; --paper: #fffdf8; --panel: #ffffff;
          --panel-2: #fff8e8; --line: rgba(191,143,38,.28); --brand: #8a5a08; --brand-2: #c89525;
          --safe: #6ee7b7; --watch: #f6c453; --immediate: #fb7185;
          --contour: #d9aa3c; --map-bg: #fffaf0;
          --india-saffron: #c89525; --india-white: #ffffff; --india-green: #4f8a61; --india-navy: #8a5a08;
          --royal-blue: #4169e1; --royal-red: #c2414c; --pure-white: #ffffff;
        }
        * { box-sizing: border-box; }
        .site-root, .site-root * { -webkit-font-smoothing: antialiased; }
        .app, .site { font-family: 'Inter', system-ui, sans-serif; background: var(--paper); color: var(--ink); min-height: 100%; width: 100%; }
        .site { background:#fffdf8; color:#352b20; }
        .site .site-nav { background:rgba(7,17,31,.82); border-bottom-color:rgba(125,211,252,.16); box-shadow:0 10px 30px rgba(2,6,23,.2); }
        .site .site-nav::after { content:""; position:absolute; left:0; right:0; bottom:-1px; height:1px; background:linear-gradient(90deg, transparent, rgba(251,191,36,.92), rgba(255,237,158,.8), transparent); animation:nav-signal 5s ease-in-out infinite; }
        .site .brand-name { color:#f8fafc; }
        .site .site-brand-sub { color:rgba(186,230,253,.62); }
        .site .nav-section-links { background:rgba(15,31,51,.72); border-color:rgba(125,211,252,.18); }
        .site .nav-links button { color:rgba(226,232,240,.72); }
        .site .nav-section-links button:hover { color:#a7f3d0; background:rgba(30,41,59,.82); }
        .site .nav-status { color:#6ee7b7; }
        .site .nav-status span { background:#34d399; box-shadow:0 0 0 3px rgba(52,211,153,.14); }

        /* ---- shared ---- */
        .brand-wrap { display:flex; align-items:center; gap:10px; }
        .brand-logo-img { width:36px; height:36px; border-radius:8px; object-fit:cover; flex-shrink:0; }
        .brand-mark { position:relative; width:32px; height:32px; border-radius:9px 9px 9px 3px; background:var(--brand); color:#f6fbf7;
          display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk'; font-weight:700; font-size:13px; flex-shrink:0; overflow:hidden; box-shadow:0 4px 10px rgba(22,75,82,.18); }
        .brand-mark::before { content:""; position:absolute; width:22px; height:10px; left:5px; bottom:-2px; border-top:2px solid #72c5ad; border-radius:50%; transform:rotate(-12deg); opacity:.9; }
        .brand-mark i { position:absolute; width:5px; height:5px; right:6px; top:6px; border-radius:50%; background:#f0b44e; box-shadow:0 0 0 3px rgba(240,180,78,.18); }
        .brand-mark span { position:relative; z-index:1; }
        .brand-name { font-family:'Space Grotesk'; font-weight:700; font-size:17px; letter-spacing:0.2px; color:var(--brand); }
        .muted { color: var(--ink-soft); }
        .small { font-size:11.5px; }
        .badge { font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:5px; white-space:nowrap; }
        .btn-primary, .btn-ghost { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600;
          border-radius:7px; padding:9px 13px; cursor:pointer; font-family:'Inter'; border:none; }
        .btn-primary { background: var(--brand); color:#eef1e8; border:1px solid var(--brand); }
        .btn-primary.is-on { background: var(--brand-2); }
        .btn-primary.full { width:100%; justify-content:center; margin-top:10px; }
        .btn-primary.sm { padding:7px 12px; }
        .btn-primary.lg { padding:12px 20px; font-size:13.5px; }
        .btn-ghost { background:transparent; color:var(--brand); border:1px solid var(--line); }
        .btn-ghost.sm { padding:5px 9px; font-size:11.5px; }
        .btn-ghost.lg { padding:12px 18px; font-size:13.5px; }

        .terrain-canvas { width:100%; border-radius:10px; overflow:hidden; border:1px solid var(--line); }
        .terrain-canvas canvas { display:block; width:100% !important; }
        .terrain-fallback { display:flex; align-items:center; justify-content:center; gap:8px; background:var(--panel-2);
          border:1px solid var(--line); border-radius:10px; color:var(--ink-soft); font-size:13px; }

        /* ---- console header/nav — Indian Tricolor Theme ---- */
        .header { display:flex; align-items:center; justify-content:space-between; gap:16px;
          padding: 0 22px; background:linear-gradient(135deg, #000080 0%, #1a1a8e 100%); color: #ffffff; flex-wrap: wrap; box-shadow:0 4px 18px rgba(0,0,128,.35); position:relative; overflow:hidden; }
        .header::before { content:''; position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg, #FF9933 0%, #FF9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%, #138808 100%); }
        .header::after { content:''; position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(90deg, #FF9933 0%, #FF9933 33.3%, #ffffff 33.3%, #ffffff 66.6%, #138808 66.6%, #138808 100%); opacity:0.6; }
        .header .brand-name { color: #FFD700 !important; font-weight: 700; letter-spacing: 0.5px; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }
        .header .brand-tag { font-size: 11px; color: rgba(255,255,255,0.8) !important; }
        .header .brand-wrap { padding: 13px 0; }
        .back-btn { background:rgba(255,153,51,0.2); border:1px solid rgba(255,153,51,0.5); color:#FFD700; border-radius:7px; padding:7px 8px; cursor:pointer; }
        .brand-tag { font-size:11px; color:rgba(255,255,255,0.75); }
        .header-controls { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding: 13px 0; }
        .header-controls select { background:rgba(0,0,64,0.6); color:#ffffff; border:1px solid rgba(255,153,51,0.5); border-radius:6px;
          padding:6px 10px; font-size:12.5px; font-family:'Inter'; }
        .role-toggle { display:flex; background:rgba(0,0,64,0.5); border-radius:7px; padding:3px; border:1px solid rgba(255,153,51,0.4); }
        .role-toggle button { border:none; background:transparent; color:rgba(255,255,255,0.7); padding:6px 12px; font-size:12.5px;
          border-radius:5px; cursor:pointer; font-family:'Inter'; font-weight:500; }
        .role-toggle button.is-on { background:linear-gradient(135deg, #FF9933, #FF6600); color:#fff; font-weight:700; }
        .nav-tabs { display:flex; gap:2px; padding: 0 22px; background: #fff8f0; border-bottom:3px solid #FF9933; overflow-x:auto; }
        .nav-tabs button { border:none; background:transparent; padding:12px 14px; font-size:13px; font-weight:500;
          color:var(--ink-soft); cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-3px; white-space:nowrap; font-family:'Inter'; }
        .nav-tabs button.is-active { color:#000080; border-bottom-color:#000080; font-weight:700; }
        .body { padding: 24px max(22px, calc((100vw - 1380px) / 2)) 54px; background:linear-gradient(180deg, #fffbf5 0%, #fff5e8 50%, #f0fff0 100%); min-height:calc(100vh - 120px); overflow-y: hidden; }
        .command-heading { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin:2px 0 18px; animation:rise-in .55s ease both; }
        .eyebrow { display:flex; align-items:center; gap:6px; color:var(--brand-2); font:600 10px 'Inter'; letter-spacing:.08em; text-transform:uppercase; }
        .command-heading h1 { color:var(--brand); font:700 26px/1.08 'Space Grotesk'; letter-spacing:-.02em; margin:6px 0 5px; }
        .command-heading p { font-size:12px; margin:0; }
        .command-actions { display:flex; align-items:center; gap:8px; flex:none; }
        .command-status { display:flex; align-items:center; gap:7px; flex:none; border:1px solid #b6d2bd; background:#edf6ee; color:#2f6f49; border-radius:20px; padding:7px 10px; font-size:11px; font-weight:600; }
        .live-strip { display:flex; align-items:center; gap:10px; margin-bottom:8px; font-size:11px; }
        .live-strip > div { display:flex; align-items:center; gap:6px; color:var(--brand); font-weight:600; }
        .live-dot { width:7px; height:7px; border-radius:50%; background:var(--safe); box-shadow:0 0 0 3px rgba(33,132,95,.16); animation:live-pulse 1.8s ease-in-out infinite; }
        @keyframes live-pulse { 0%,100% { box-shadow:0 0 0 3px rgba(33,132,95,.14); } 50% { box-shadow:0 0 0 6px rgba(33,132,95,0); } }
        @keyframes shimmer-pulse { 0%,100% { opacity:0.35; } 50% { opacity:0.7; } }
        .refresh-btn { margin-left:auto; border:1px solid var(--line); background:var(--panel); color:var(--brand); border-radius:5px; padding:5px 8px; font:11px 'Inter'; cursor:pointer; }
        .refresh-btn:hover { border-color:var(--brand-2); background:var(--panel-2); }
        .kpi-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
        .kpi-strip > div { background:linear-gradient(135deg, #ffffff, #fff8f0); border:1px solid #FF9933; border-radius:8px; padding:10px 11px; box-shadow:0 2px 8px rgba(255,153,51,0.1); transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease; }
        .kpi-strip > div:hover { transform:translateY(-2px); border-color:#FF6600; box-shadow:0 8px 18px rgba(255,102,0,.18); }
        .kpi-strip strong { display:block; color:#000080; font:700 18px 'Space Grotesk'; }
        .kpi-strip span { color:var(--ink-soft); font-size:10.5px; }
        .kpi-strip .kpi-alert strong { color:var(--immediate); }

        .overview-layout { display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 300px); gap:16px; align-items:start; animation:rise-in .65s .08s ease both; }
        .risk-map-workspace { display:grid; grid-template-columns:minmax(0, 270px) minmax(0, 1fr); gap:12px; min-width:0; padding:10px; background:linear-gradient(135deg, rgba(255,253,247,.82), rgba(238,245,241,.72)); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 24px rgba(23,43,53,.06); }
        .risk-map-list { min-width:0; }
        .risk-map-list-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 3px 9px; color:var(--brand); font:600 12px 'Space Grotesk'; }
        .risk-map-list-head::after { content:"SELECT A ROW TO INSPECT"; color:var(--ink-soft); font:600 8px 'Inter'; letter-spacing:.06em; margin-left:auto; }
        .risk-map-list-head > span:first-child { display:flex; align-items:center; gap:5px; }
        .risk-map-list .zone-list { border-radius:8px; }
        .risk-map-view { min-width:0; }
        @media (max-width: 1180px) { .overview-layout { grid-template-columns:minmax(0, 1fr); } }
        @media (max-width: 980px) { .risk-map-workspace { grid-template-columns:minmax(0, 1fr); } .risk-map-list .zone-list-body { max-height:260px; } .map-stage { min-height:380px; height:48vh; } }
        .map-toggle { display:flex; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap; }
        .map-toggle button { display:flex; align-items:center; gap:5px; border:1px solid var(--line); background:var(--panel);
          padding:6px 10px; border-radius:7px; font-size:11.5px; cursor:pointer; color:var(--ink-soft); }
        .map-toggle button.is-on { background:var(--brand); color:#eef1e8; border-color:var(--brand); }
        .map-hint { margin-left:4px; }

        .zone-list { display:flex; flex-direction:column; background: var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; box-shadow:0 4px 16px rgba(31,58,52,.04); }
        .zone-list-head { display:flex; justify-content:space-between; padding:11px 13px; font-size:12px; font-weight:600;
          border-bottom:1px solid var(--line); font-family:'Space Grotesk'; }
        .zone-list-body { flex:1; overflow-y:auto; }
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
        .workspace-main { display:flex; flex-direction:column; min-width:0; }
        .map-stage { position:relative; flex:1; display:flex; flex-direction:column; min-height:480px; height:54vh; max-height:660px; container-type:inline-size; border-radius:10px; overflow:hidden; }
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
        .risk-map .leaflet-control-zoom a { color:var(--brand); background:var(--panel); }
        .risk-map-title { position:absolute; bottom:12px; left:12px; z-index:500; display:flex; align-items:baseline; gap:8px; padding:6px 10px; background:rgba(246,245,238,.94); border:1px solid var(--line); border-radius:6px; box-shadow:0 4px 14px rgba(31,58,52,.1); }
        .risk-map-title strong { color:var(--brand); font:600 11.5px 'Space Grotesk'; text-transform:capitalize; }
        .risk-map-title span { color:var(--ink-soft); font-size:10px; }

        /* Map Top Bar (Sticky floating top controls) */
        .map-top-bar { position:absolute; top:10px; left:52px; right:10px; z-index:500; display:flex; align-items:flex-start; justify-content:space-between; gap:8px; pointer-events:none; flex-wrap:wrap; }
        .map-top-bar > * { pointer-events:auto; }
        .map-top-actions { display:flex; align-items:center; gap:6px; margin-left:auto; flex-shrink:0; }
        @media (max-width: 1180px) {
          .map-top-actions .tile-switcher-label { display:none; }
          .tile-switcher-btn { padding:5px 8px; }
        }

        /* Tile layer switcher */
        .tile-switcher { position:relative; }
        .tile-switcher-btn { display:flex; align-items:center; gap:5px; padding:6px 10px;
          background:rgba(255,255,255,.96); border:1px solid var(--line); border-radius:8px;
          box-shadow:0 3px 12px rgba(20,59,93,.14); cursor:pointer; font-size:11px;
          font-weight:600; color:var(--brand); backdrop-filter:blur(4px);
          transition:box-shadow .2s ease; }
        .tile-switcher-btn:hover { box-shadow:0 5px 18px rgba(20,59,93,.22); }
        .tile-switcher-label { font-family:'Space Grotesk'; font-size:11px; }
        .tile-switcher-arrow { font-size:8px; opacity:.6; }
        .tile-menu { position:absolute; top:calc(100% + 6px); right:0; background:#fff;
          border:1px solid var(--line); border-radius:10px; overflow:hidden;
          box-shadow:0 12px 32px rgba(20,59,93,.18); min-width:140px;
          animation:slideUp .18s cubic-bezier(.2,.8,.2,1); }
        .tile-option { display:flex; align-items:center; gap:8px; width:100%;
          padding:9px 14px; background:none; border:none; cursor:pointer;
          font-size:12px; color:var(--ink); text-align:left;
          border-bottom:1px solid var(--panel-2); transition:background .15s ease; }
        .tile-option:last-child { border-bottom:none; }
        .tile-option:hover { background:var(--panel-2); }
        .tile-option.is-active { background:var(--panel-2); font-weight:600; color:var(--brand); }
        .tile-option-emoji { font-size:14px; }
        .tile-option-label { flex:1; font-family:'Space Grotesk'; }
        .tile-option-check { color:var(--safe); font-size:12px; font-weight:700; }
        .risk-map-legend { position:absolute; bottom:12px; right:12px; z-index:500; display:flex; gap:9px; padding:7px 9px; background:rgba(246,245,238,.94); border:1px solid var(--line); border-radius:6px; color:var(--ink-soft); font-size:10px; box-shadow:0 4px 14px rgba(31,58,52,.1); }
        .risk-map-legend span { display:flex; align-items:center; gap:4px; }
        .risk-map-legend i { width:7px; height:7px; border-radius:50%; display:inline-block; }
        /* Hazard controls */
        .hazard-controls { display:flex; align-items:center; gap:3px; flex-wrap:wrap; padding:3px 7px; background:rgba(255,255,255,.97); border:1px solid var(--line); border-radius:22px; box-shadow:0 3px 12px rgba(31,58,52,.13); backdrop-filter:blur(6px); }
        .hazard-controls button { display:inline-flex; align-items:center; gap:4px; border:1px solid transparent; border-radius:16px; background:transparent; color:var(--ink-soft); padding:3px 8px; font:500 11px 'Inter', system-ui, sans-serif; cursor:pointer; transition:all .15s ease; white-space:nowrap; }
        .hazard-controls button:hover { background:var(--panel-2); border-color:var(--line); color:var(--brand); }
        .hazard-controls .is-on { background:var(--panel-2); border-color:var(--brand-2); color:var(--brand); font-weight:600; }
        .hazard-controls .hazard-divider { width:1px; height:16px; background:var(--line); margin:0 3px; flex-shrink:0; }
        .hazard-chip i { width:7px; height:7px; border-radius:50%; display:inline-block; }
        .fusion-toggle { color:var(--brand) !important; font-weight:700 !important; border-right:1px solid var(--line) !important; border-radius:0 !important; padding-right:10px !important; margin-right:3px; background:transparent !important; }
        .fusion-switch { width:17px; height:10px; border-radius:8px; background:var(--line); position:relative; display:inline-block; }
        .fusion-switch::after { content:""; position:absolute; width:6px; height:6px; left:2px; top:2px; border-radius:50%; background:white; transition:transform .2s ease; }
        .fusion-toggle.is-on .fusion-switch { background:var(--immediate); }
        .fusion-toggle.is-on .fusion-switch::after { transform:translateX(7px); }
        .fusion-panel { position:absolute; bottom:85px; left:12px; z-index:500; width:210px; padding:12px 13px; box-sizing:border-box; background:rgba(255,255,255,.97); border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 28px rgba(31,58,52,.18); backdrop-filter:blur(8px); animation:slideUp .2s cubic-bezier(.2,.8,.2,1); overflow:hidden; }
        .fusion-panel-head { display:flex; align-items:center; justify-content:space-between; gap:6px; color:var(--brand); font:600 11px 'Space Grotesk'; }
        .fusion-panel-head > span:first-child { display:flex; align-items:center; gap:4px; }
        .fusion-level { border-radius:4px; padding:3px 5px; font:700 9px 'Inter'; }
        .level-critical { color:#fff; background:var(--immediate); }.level-high { color:#fff; background:var(--watch); }.level-moderate { color:var(--watch); background:#fff1d5; }.level-safe { color:#fff; background:var(--safe); }
        .fusion-score { display:flex; align-items:baseline; gap:5px; padding:10px 0 7px; border-bottom:1px solid var(--line); }
        .fusion-score strong { color:var(--immediate); font:700 25px 'Space Grotesk'; }.fusion-score span { color:var(--ink-soft); font-size:9px; }
        .fusion-bars { padding:7px 0; }.fusion-bar { margin:5px 0; }.fusion-bar > div:first-child { display:flex; justify-content:space-between; color:var(--ink-soft); font-size:9px; }.fusion-bar strong { color:var(--brand); }.fusion-track { height:4px; margin-top:3px; background:var(--line); border-radius:4px; overflow:hidden; }.fusion-track i { display:block; height:100%; border-radius:4px; transition:width .35s ease; }
        .fusion-overlap { display:flex; justify-content:space-between; border-top:1px solid var(--line); padding-top:7px; color:var(--ink-soft); font-size:10px; }.fusion-overlap strong { color:var(--immediate); }
        @container (max-width:640px) {
          .map-stage .map-top-bar { left:8px; right:8px; top:8px; align-items:flex-start; flex-direction:column; gap:6px; }
          .map-stage .hazard-controls { width:100%; flex:1 1 100%; flex-wrap:wrap; gap:2px; border-radius:8px; white-space:normal; }
          .map-stage .hazard-controls button { padding:3px 6px; font-size:10px; }
          .map-stage .hazard-divider { display:none; }
          .map-stage .fusion-toggle { border-right:none !important; margin-right:0; padding-right:6px !important; }
          .map-stage .map-top-actions { width:100%; justify-content:flex-end; }
          .map-stage .tile-switcher-label { display:none; }
          .map-stage .risk-map-title { left:8px; bottom:8px; max-width:120px; }
          .map-stage .risk-map-title span { display:none; }
          .map-stage .risk-map-legend { right:8px; bottom:8px; max-width:140px; flex-wrap:wrap; gap:4px; }
          .map-stage .fusion-panel { bottom:auto; top:90px; left:8px; }
        }
        .map-svg { width:100%; height: auto; display:block; }
        .zone-node { cursor:pointer; }
        .site-node { pointer-events:none; }
        .map-label { font-size:2.6px; fill: var(--ink); font-family:'Space Grotesk'; font-weight:600; }
        .site-label { font-size:2.3px; fill: var(--safe); font-family:'Space Grotesk'; font-weight:700; }
        .layer-controls { display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin:8px 0; }
        .layer-title { display:inline-flex; align-items:center; gap:5px; color:var(--ink-soft); font-size:11px; font-weight:600; margin-right:3px; }
        .layer-controls button { border:1px solid var(--line); background:var(--panel); color:var(--ink-soft); border-radius:5px; padding:5px 8px; font:11px 'Inter'; cursor:pointer; }
        .layer-controls button:hover { border-color:var(--brand-2); color:var(--brand); }
        .layer-controls button.is-on { background:var(--brand); border-color:var(--brand); color:#eef1e8; }
        .map-external-link { display:inline-flex; align-items:center; gap:5px; margin-left:auto; color:var(--brand); font-size:11px; text-decoration:none; }
        .map-external-link:hover { text-decoration:underline; }
        .map-legend { position:absolute; left:20px; bottom:16px; background:rgba(246,245,238,0.9); border:1px solid var(--line);
          border-radius:7px; padding:7px 10px; display:flex; gap:10px; flex-wrap:wrap; max-width:calc(100% - 40px); }
        .legend-row { display:flex; align-items:center; gap:5px; font-size:10.5px; color:var(--ink-soft); }
        .dot { width:7px; height:7px; border-radius:50%; display:inline-block; }
        .legend-symbol { width:9px; height:9px; display:inline-block; }
        .hazard-symbol { border:1px dashed var(--immediate); background:rgba(171,58,41,0.12); border-radius:50%; }
        .site-symbol { width:8px; height:8px; border-radius:2px; background:var(--safe); }

        .detail-panel { background: var(--panel); border:1px solid var(--line); border-radius:10px; padding:16px; box-shadow:0 4px 16px rgba(31,58,52,.04); }
        .detail-empty { display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; color:var(--ink-soft);
          padding:50px 20px; font-size:13px; }
        .detail-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
        .detail-code { font-family:'Space Grotesk'; font-size:11px; letter-spacing:0.4px; color:var(--ink-soft); }
        .detail-panel h3 { font-family:'Space Grotesk'; font-size:16px; margin:2px 0 3px; }
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
        .recommendation-card { border:1px solid var(--line); border-left:3px solid var(--brand-2); border-radius:8px; padding:11px; margin-bottom:14px; background:#f7fbfc; }
        .recommendation-card.recommendation-urgent { border-left-color:var(--immediate); background:#fff7f5; }
        .recommendation-card.recommendation-watch { border-left-color:var(--watch); background:#fffbf1; }
        .recommendation-card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; color:var(--brand-2); font-size:10.5px; font-weight:700; }
        .recommendation-card-head span { display:flex; align-items:center; gap:5px; }
        .recommendation-card-head strong { color:var(--ink-soft); font-size:9.5px; font-weight:600; white-space:nowrap; }
        .recommendation-action { color:var(--brand); font:600 12.5px/1.35 'Space Grotesk'; margin:8px 0 4px; }
        .recommendation-reason { color:var(--ink-soft); font-size:10.5px; line-height:1.4; }
        .recommendation-note { color:var(--ink-soft); font-size:9px; margin-top:8px; padding-top:7px; border-top:1px solid var(--line); }
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
        .suitability-card { border:1px solid var(--line); border-radius:8px; padding:11px; margin-bottom:14px; background:var(--panel-2); }
        .suitability-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
        .suitability-score { display:flex; align-items:baseline; gap:2px; color:var(--brand); }
        .suitability-score strong { font:700 24px 'Space Grotesk'; }
        .suitability-score span { color:var(--ink-soft); font-size:10px; }
        .suitability-recommendation { display:inline-block; margin:8px 0 10px; border-radius:5px; padding:4px 7px; font-size:10px; font-weight:700; }
        .recommendation-high { color:var(--safe); background:#dff1e6; }
        .recommendation-medium { color:#946516; background:#f8edcf; }
        .recommendation-low { color:var(--immediate); background:#f9dfda; }
        .suitability-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; }
        .suitability-factor > div:first-child { display:flex; justify-content:space-between; gap:5px; color:var(--ink-soft); font-size:9.5px; margin-bottom:3px; }
        .suitability-factor strong { color:var(--brand); font-size:10px; }
        .suitability-track { height:4px; overflow:hidden; background:var(--line); border-radius:3px; }
        .suitability-track i { display:block; height:100%; background:var(--brand-2); border-radius:3px; }
        .action-row { display:flex; gap:8px; flex-wrap:wrap; }

        /* ============================================================
           RELOCATION CORRIDOR, CARRYING CAPACITY & FACILITIES (CONSOLE)
           ============================================================ */
        .reloc-console-card {
          margin: 14px 0;
          border: 1.5px solid #21845f;
          border-radius: 10px;
          background: #ffffff;
          padding: 14px;
          box-shadow: 0 4px 18px rgba(33, 132, 95, 0.12);
        }
        .safe-profile-card {
          border-color: #21845f;
          background: #f7fdf9;
        }
        .reloc-console-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 12px;
        }
        .reloc-console-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .reloc-console-title strong {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 13.5px;
          color: var(--brand);
          display: block;
        }
        .reloc-console-title span {
          font-size: 10.5px;
          color: var(--ink-soft);
          display: block;
        }
        .reloc-icon-accent {
          color: var(--safe);
          flex-shrink: 0;
        }
        .reloc-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          color: var(--safe);
          background: #eef8f3;
          border: 1px solid rgba(33, 132, 95, 0.3);
          padding: 3px 8px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .reloc-route-strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: var(--panel-2);
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 12px;
        }
        .reloc-point {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          flex: 1;
          min-width: 0;
        }
        .reloc-node-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          margin-top: 3px;
          flex-shrink: 0;
        }
        .reloc-point-tag {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: var(--ink-soft);
          display: block;
        }
        .reloc-point strong {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 12.5px;
          color: var(--brand);
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .reloc-point-sub {
          font-size: 10px;
          color: var(--ink-soft);
          display: block;
        }
        .reloc-route-transit {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 0 8px;
          color: var(--brand-2);
          flex-shrink: 0;
        }
        .reloc-route-transit span {
          font-size: 9.5px;
          font-weight: 700;
          white-space: nowrap;
        }
        .reloc-capacity-box {
          background: #fdfefd;
          border: 1px solid #cde4d6;
          border-radius: 8px;
          padding: 11px;
          margin-bottom: 12px;
        }
        .reloc-subhead {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11.5px;
          font-weight: 700;
          color: var(--brand);
          margin-bottom: 9px;
        }
        .reloc-kpis {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          margin-bottom: 10px;
        }
        .reloc-kpis div {
          background: var(--panel-2);
          border-radius: 6px;
          padding: 7px 8px;
          text-align: center;
        }
        .reloc-kpis strong {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 14px;
          font-weight: 700;
          color: var(--brand);
          display: block;
        }
        .reloc-kpis span {
          font-size: 9px;
          color: var(--ink-soft);
          display: block;
        }
        .reloc-cap-progress {
          margin-top: 6px;
        }
        .reloc-cap-legend {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: var(--ink-soft);
          margin-bottom: 4px;
        }
        .reloc-cap-legend strong {
          color: var(--brand);
        }
        .reloc-cap-track {
          position: relative;
          height: 9px;
          background: #e5ece8;
          border-radius: 5px;
          overflow: hidden;
        }
        .reloc-cap-bar-current {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          background: var(--brand-2);
        }
        .reloc-cap-bar-addition {
          position: absolute;
          top: 0;
          height: 100%;
          background: linear-gradient(90deg, #2e8b68, #21845f);
        }
        .reloc-warn-banner {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 6px;
          font-size: 10px;
          font-weight: 600;
          color: var(--immediate);
        }
        .reloc-fac-section {
          margin-bottom: 12px;
        }
        .reloc-fac-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px;
        }
        .reloc-fac-card {
          background: var(--panel-2);
          border-radius: 7px;
          padding: 8px 9px;
          border: 1px solid var(--line);
        }
        .reloc-fac-head {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .reloc-fac-ico {
          width: 22px;
          height: 22px;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .reloc-fac-head strong {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 11px;
          color: var(--brand);
        }
        .reloc-fac-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .reloc-fac-list span {
          font-size: 9px;
          color: var(--ink-soft);
          line-height: 1.25;
        }
        .reloc-fac-desc {
          font-size: 9px;
          color: var(--ink-soft);
          display: block;
        }
        .reloc-action-box {
          margin-top: 10px;
        }

        /* Leaflet Relocation Corridor & Arrowhead Styles */
        .reloc-arrow-head-icon {
          pointer-events: none;
        }
        .reloc-corridor-path {
          animation: corridor-flow 1.4s linear infinite;
        }
        @keyframes corridor-flow {
          from { stroke-dashoffset: 36; }
          to { stroke-dashoffset: 0; }
        }
        .safe-zone-tooltip {
          background: #21845f !important;
          color: #ffffff !important;
          border: 1.5px solid #ffffff !important;
          border-radius: 6px !important;
          font-family: 'Space Grotesk', sans-serif !important;
          font-weight: 700 !important;
          font-size: 11px !important;
          box-shadow: 0 4px 14px rgba(33, 132, 95, 0.45) !important;
          padding: 4px 9px !important;
          white-space: nowrap !important;
        }
        .safe-zone-tooltip::before {
          border-top-color: #21845f !important;
        }
        .reloc-corridor-tooltip {
          background: rgba(20, 59, 93, 0.94) !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 10.5px !important;
          padding: 5px 8px !important;
        }

        .modal-overlay { position:fixed; inset:0; background:rgba(14,24,20,0.62); backdrop-filter:blur(4px);
          display:flex; align-items:center; justify-content:center; z-index:50; padding:20px;
          animation:fadeIn .2s ease; }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        .cert-shell { background:#fff; border-radius:14px; max-width:600px; width:100%; position:relative;
          box-shadow:0 32px 80px rgba(0,0,0,0.3); overflow:hidden;
          animation:slideUp .3s cubic-bezier(.2,.8,.2,1); }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .modal-close { position:absolute; top:14px; right:14px; background:rgba(0,0,0,.06); border:none;
          border-radius:50%; width:28px; height:28px; cursor:pointer; color:var(--ink); display:flex;
          align-items:center; justify-content:center; z-index:5; }
        .modal-close:hover { background:rgba(0,0,0,.12); }

        /* Generating animation */
        .cert-generating { padding:48px 32px; display:flex; flex-direction:column; align-items:center; gap:16px; }
        .cert-gen-icon { width:56px; height:56px; border-radius:14px; background:var(--brand); color:#eef1e8;
          display:flex; align-items:center; justify-content:center; }
        .cert-gen-title { font-family:'Space Grotesk'; font-weight:700; font-size:17px; color:var(--brand); }
        .cert-gen-steps { display:flex; flex-direction:column; gap:10px; width:100%; max-width:280px; }
        .cert-gen-step { display:flex; align-items:center; gap:10px; font-size:12.5px; color:var(--ink-soft);
          transition:all .3s ease; }
        .cert-gen-step.done { color:var(--ink); }
        .cert-gen-step.active { color:var(--brand); font-weight:600; }
        .cert-gen-dot { width:8px; height:8px; border-radius:50%; background:var(--line); flex-shrink:0;
          transition:background .3s ease; }
        .cert-gen-step.done .cert-gen-dot { background:var(--safe); }
        .cert-gen-step.active .cert-gen-dot { background:var(--brand); box-shadow:0 0 0 3px rgba(20,59,93,.2); }

        /* Certificate document */
        .certificate { padding:28px 28px 20px; position:relative; }
        .cert-watermark-border { position:absolute; inset:8px; border:2px solid rgba(20,59,93,.07);
          border-radius:8px; pointer-events:none; }
        .cert-watermark-border::before { content:'BHOOMI RAKSHAK'; position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center; font-size:72px; font-weight:900;
          font-family:'Space Grotesk'; color:rgba(20,59,93,.03); letter-spacing:.12em; white-space:nowrap;
          overflow:hidden; pointer-events:none; }

        .cert-gov-header { display:flex; align-items:center; gap:14px; margin-bottom:12px; }
        .cert-emblem { flex-shrink:0; }
        .cert-emblem-ring { width:44px; height:44px; border-radius:50%; border:2.5px solid var(--brand);
          display:flex; align-items:center; justify-content:center; }
        .cert-emblem-ring span { font-family:'Space Grotesk'; font-weight:700; font-size:14px; color:var(--brand); }
        .cert-gov-sup { font-size:9px; color:var(--ink-soft); letter-spacing:.06em; text-transform:uppercase; }
        .cert-gov-name { font-family:'Space Grotesk'; font-weight:700; font-size:16px; color:var(--brand); letter-spacing:.04em; }
        .cert-gov-sub { font-size:10px; color:var(--ink-soft); }
        .cert-divider { height:1px; background:linear-gradient(90deg, var(--brand) 0%, transparent 100%); margin:10px 0; }

        .cert-doc-title { display:flex; align-items:center; justify-content:space-between; margin:12px 0; }
        .cert-doc-label { font-family:'Space Grotesk'; font-weight:700; font-size:12px; letter-spacing:.08em;
          color:var(--ink); text-transform:uppercase; }
        .cert-doc-status { color:#fff; font-size:9px; font-weight:700; letter-spacing:.08em; padding:3px 9px;
          border-radius:20px; }

        .cert-zone-block { display:flex; align-items:center; justify-content:space-between; gap:12px;
          background:linear-gradient(135deg, #f0f5ff, #eef5f1); border-radius:10px; padding:12px 14px; margin-bottom:14px; }
        .cert-zone-id { font-family:'Space Grotesk'; font-size:11px; font-weight:600; color:var(--brand-2);
          letter-spacing:.06em; }
        .cert-zone-name { font-family:'Space Grotesk'; font-weight:700; font-size:15px; color:var(--brand); margin:2px 0; }
        .cert-zone-loc { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--ink-soft); }
        .cert-score-circle { width:58px; height:58px; border-radius:50%; border:3px solid; flex-shrink:0;
          display:flex; flex-direction:column; align-items:center; justify-content:center; }
        .cert-score-circle span { font-family:'Space Grotesk'; font-weight:700; font-size:20px; line-height:1; }
        .cert-score-circle small { font-size:9px; color:var(--ink-soft); }

        .cert-data-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px; }
        .cert-data-cell { background:var(--panel-2); border:1px solid var(--line); border-radius:6px; padding:8px 10px; }
        .cert-data-cell span { display:block; font-size:9.5px; color:var(--ink-soft); margin-bottom:3px; }
        .cert-data-cell strong { font-size:12px; color:var(--ink); font-family:'Space Grotesk'; }

        .cert-site-block { border-left:3px solid var(--brand-2); padding:7px 10px; margin-bottom:12px;
          background:rgba(30,120,144,.04); border-radius:0 6px 6px 0; }
        .cert-site-label { display:flex; align-items:center; gap:5px; font-size:10px; font-weight:600;
          color:var(--brand-2); margin-bottom:4px; }
        .cert-site-val { font-size:12px; color:var(--ink); line-height:1.4; }
        .cert-site-val.ok { color:var(--safe); }
        .cert-site-val.warn { color:var(--watch); }
        .cert-site-val em { font-style:normal; color:var(--ink-soft); }

        .cert-rationale { background:#f8f9fa; border-radius:7px; padding:10px 12px; margin-bottom:12px; }
        .cert-rationale-label { display:flex; align-items:center; gap:5px; font-size:10px; font-weight:600;
          color:var(--brand); margin-bottom:5px; }
        .cert-rationale p { font-size:11.5px; color:var(--ink-soft); line-height:1.55; margin:0; }

        .cert-signatures { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin:12px 0; }
        .cert-sig-block { display:flex; flex-direction:column; gap:3px; }
        .cert-sig-line { height:1px; background:var(--ink); margin-bottom:4px; }
        .cert-sig-name { font-size:11px; font-weight:600; color:var(--ink); }
        .cert-sig-sub { font-size:9.5px; color:var(--ink-soft); line-height:1.35; }
        .cert-hash-block { align-items:flex-start; }
        .cert-hash-bars { display:flex; align-items:flex-end; gap:2px; height:20px; margin-bottom:4px; }
        .cert-hash-bars span { display:block; width:3px; background:var(--brand); border-radius:1px; }
        .cert-hash-code { font-family:monospace; font-size:9px; color:var(--brand); letter-spacing:.04em; }
        .cert-footer-note { font-size:9px; color:var(--ink-soft); text-align:center; margin-top:8px;
          border-top:1px solid var(--line); padding-top:8px; }

        .cert-actions { display:flex; gap:10px; padding:16px 28px; background:var(--panel-2);
          border-top:1px solid var(--line); }
        .cert-actions .btn-primary { flex:1; justify-content:center; }
        .cert-actions .btn-ghost { flex:0; white-space:nowrap; }

        /* Brief Modal */
        .brief-shell { background:#fff; border-radius:14px; max-width:640px; width:100%; max-height:90vh;
          display:flex; flex-direction:column; position:relative;
          box-shadow:0 32px 80px rgba(0,0,0,0.28); overflow:hidden;
          animation:slideUp .3s cubic-bezier(.2,.8,.2,1); }
        .brief-header { display:flex; align-items:center; justify-content:space-between; gap:12px;
          padding:18px 22px; background:var(--brand); color:#eef1e8; flex-shrink:0; }
        .brief-header-left { display:flex; align-items:center; gap:12px; }
        .brief-icon { width:38px; height:38px; border-radius:10px; background:rgba(255,255,255,.15);
          display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .brief-title { font-family:'Space Grotesk'; font-weight:700; font-size:15px; }
        .brief-sub { font-size:10.5px; opacity:.75; margin-top:2px; }
        .brief-header .modal-close { background:rgba(255,255,255,.15); color:#eef1e8; position:static;
          width:28px; height:28px; flex-shrink:0; }
        .brief-kpis { display:flex; gap:0; border-bottom:1px solid var(--line); flex-shrink:0; }
        .brief-kpi { flex:1; display:flex; flex-direction:column; align-items:center; padding:12px 8px;
          border-right:1px solid var(--line); gap:2px; }
        .brief-kpi:last-child { border-right:none; }
        .brief-kpi strong { font-family:'Space Grotesk'; font-weight:700; font-size:18px; }
        .brief-kpi span { font-size:9px; color:var(--ink-soft); text-align:center; }
        .brief-kpi.kpi-alert { background:#fff5f5; }
        .brief-section-title { font-family:'Space Grotesk'; font-weight:700; font-size:11px;
          letter-spacing:.06em; text-transform:uppercase; color:var(--brand);
          padding:10px 20px 4px; border-top:1px solid var(--panel-2); background:var(--panel-2); }
        .brief-empty { padding:8px 20px; font-size:12px; color:var(--ink-soft); }
        .brief-zone-row { display:flex; align-items:flex-start; gap:10px; padding:10px 20px;
          border-bottom:1px solid var(--panel-2); }
        .brief-zone-row:hover { background:var(--panel-2); }
        .brief-zone-row.compact { padding:8px 20px; }
        .brief-zone-id { font-family:monospace; font-size:10px; font-weight:700; padding-top:2px;
          min-width:92px; }
        .brief-zone-info { flex:1; min-width:0; }
        .brief-zone-name { font-weight:600; font-size:12.5px; }
        .brief-zone-meta { font-size:10.5px; color:var(--ink-soft); margin:2px 0; }
        .brief-site-status { display:flex; align-items:center; gap:4px; font-size:10px; margin-top:3px; }
        .brief-site-status.matched { color:var(--safe); }
        .brief-site-status.shortfall { color:var(--immediate); font-weight:600; }
        .brief-site-status.pending { color:var(--ink-soft); }
        .brief-zone-score { font-family:'Space Grotesk'; font-weight:700; font-size:16px; min-width:28px; text-align:right; }
        .brief-alert-banner { display:flex; align-items:flex-start; gap:10px; margin:10px 20px;
          background:#fff3f0; border:1px solid #f5c0b0; border-radius:8px; padding:10px 12px;
          font-size:12px; color:#8b2c2c; }
        .brief-alert-banner strong { color:var(--immediate); }
        .brief-focus-card { margin:0 20px 12px; background:var(--panel-2); border-radius:8px; padding:12px; }
        .brief-focus-name { font-family:'Space Grotesk'; font-weight:700; font-size:13px; margin-bottom:5px; }
        .brief-focus-explanation { font-size:11.5px; color:var(--ink-soft); line-height:1.55; margin:0; }
        .brief-actions { display:flex; gap:10px; padding:14px 20px; background:var(--panel-2);
          border-top:1px solid var(--line); flex-shrink:0; }
        .brief-actions .btn-primary { flex:1; justify-content:center; }
        .brief-scroll {
          overflow-y: auto;
          flex: 1 1 auto;
          min-height: 0;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior: contain;
        }
        .brief-scroll::-webkit-scrollbar { width: 6px; }
        .brief-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.03); }
        .brief-scroll::-webkit-scrollbar-thumb { background: rgba(20, 59, 93, 0.25); border-radius: 4px; }
        .brief-scroll::-webkit-scrollbar-thumb:hover { background: rgba(20, 59, 93, 0.45); }

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

          /* Hide entire page DOM by default */
          body * {
            visibility: hidden !important;
          }

          /* Only make the active modal and its contents visible */
          .modal-overlay,
          .modal-overlay * {
            visibility: visible !important;
          }

          /* Position the modal overlay to fill the printed page cleanly */
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

          .cert-shell {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .certificate {
            padding: 8mm 12mm !important;
            border: 1.5px solid #143b5d !important;
            border-radius: 8px !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .brief-shell {
            position: relative !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 1.5px solid #143b5d !important;
            background: #ffffff !important;
            max-height: none !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .brief-scroll {
            overflow: visible !important;
            max-height: none !important;
          }

          /* Hide interactive UI buttons and chrome during print */
          .modal-close,
          .cert-actions,
          .cert-generating,
          .brief-actions,
          .brief-header .modal-close,
          header,
          .header,
          nav,
          .website-nav,
          .overview-layout,
          .landing-page,
          .chatbot-container,
          .chatbot-shell,
          .chatbot-toggle,
          .cookie-banner,
          .live-strip,
          .kpi-strip {
            display: none !important;
            visibility: hidden !important;
          }
        }

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

        .reports { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px; }
        .reports-head { display:flex; justify-content:space-between; margin-bottom:10px; font-family:'Space Grotesk'; font-weight:600; font-size:13.5px; }
        .report-table { width:100%; border-collapse:collapse; font-size:12.5px; }
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
        @keyframes wave-anim { 0% { height:20%; } 100% { height:100%; } }

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
        .feedback-item-head { display:flex; justify-content:space-between; margin-bottom:4px; gap:8px; }
        .feedback-category { color:var(--brand-2); font-size:10px; margin-left:8px; }
        .feedback-item p { font-size:12px; margin:0; line-height:1.4; }
        .toast { position:fixed; bottom:20px; right:20px; background:var(--brand); color:#eef1e8; padding:10px 16px;
          border-radius:8px; font-size:12.5px; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:60; display:flex; align-items:center; gap:8px; }
        @media (max-width: 700px) { .command-heading { align-items:flex-start; flex-direction:column; } .command-heading h1 { font-size:22px; } .kpi-strip { grid-template-columns:1fr 1fr; } .map-external-link { margin-left:0; width:100%; } }

        /* ---- landing page ---- */
        .site-nav { position:sticky; top:0; z-index:20; display:flex; align-items:center; justify-content:space-between;
          padding:13px max(26px, calc((100vw - 1228px) / 2)); background:rgba(231,233,221,0.9); backdrop-filter: blur(10px); border-bottom:1px solid rgba(188,191,169,.8); }
        .site-brand-lockup { display:flex; flex-direction:column; gap:1px; }
        .site-brand-sub { color:var(--ink-soft); font:600 8px 'Inter'; letter-spacing:.12em; }
        .nav-links { display:flex; align-items:center; gap:16px; }
        .nav-section-links { display:flex; align-items:center; gap:4px; padding:4px; border:1px solid rgba(188,191,169,.75); border-radius:8px; background:rgba(246,245,238,.48); }
        .nav-links button { background:none; border:none; font-size:12px; font-weight:500; color:var(--ink-soft); cursor:pointer; font-family:'Inter'; }
        .nav-section-links button { padding:6px 9px; border-radius:5px; }
        .nav-section-links button:hover { color:var(--brand); background:var(--panel); }
        .nav-status { display:flex; align-items:center; gap:6px; color:var(--safe); font-size:10px; font-weight:600; white-space:nowrap; }
        .nav-status span { width:6px; height:6px; border-radius:50%; background:var(--safe); box-shadow:0 0 0 3px rgba(63,122,88,.14); }
        .nav-links > .btn-primary { box-shadow:0 4px 10px rgba(31,58,52,.14); }

        .hero { padding:clamp(86px,12vh,150px) 26px 110px; width: 100%; min-height:88vh; animation:rise-in .7s cubic-bezier(.2,.8,.2,1) both; background:radial-gradient(circle at 78% 30%, rgba(251,191,36,.2), transparent 28%), linear-gradient(180deg, #122941 0%, #183854 66%, #10243a 100%); isolation:isolate; }
        .site .hero::before { content:""; position:absolute; inset:0; z-index:-1; pointer-events:none; opacity:.34; background-image:linear-gradient(rgba(255,224,138,.1) 1px, transparent 1px),linear-gradient(90deg, rgba(125,211,252,.08) 1px, transparent 1px); background-size:58px 58px; mask-image:linear-gradient(90deg, #000 0%, rgba(0,0,0,.72) 55%, transparent 100%); animation:grid-drift 18s linear infinite; }
        .site .hero::after { content:""; position:absolute; left:0; right:0; top:-35%; height:35%; z-index:-1; pointer-events:none; background:linear-gradient(180deg, transparent, rgba(251,191,36,.14), rgba(255,244,189,.08), transparent); animation:hero-scan 8s linear infinite; }
        .hero-grid { max-width:1240px; margin:0 auto; width: 100%; }
        @media (max-width: 940px) { .hero-evidence { right:12px; } }
        .hero-brief { padding:14px 0 6px 4px; max-width:620px; margin-left:clamp(0px, 3vw, 48px); position:relative; }
        .hero-eyebrow { display:flex; align-items:center; gap:8px; color:#fde68a; font:600 10px 'Inter'; letter-spacing:.1em; margin-bottom:22px; animation:rise-in .55s .12s ease both; }
        .hero-slash { color:var(--immediate); }
        .eyebrow-mark { width:20px; height:2px; background:var(--immediate); display:inline-block; }
        .hero-index { display:flex; align-items:center; gap:9px; color:var(--immediate); font:700 11px 'Space Grotesk'; letter-spacing:.08em; margin-bottom:9px; }
        .hero-index span { color:var(--ink-soft); font:500 10px 'Inter'; letter-spacing:0; }
        .headline { font-family:'Space Grotesk'; font-weight:700; font-size:clamp(38px,5.2vw,70px); line-height:.98; letter-spacing:-.045em; margin:0 0 22px; max-width:9ch; color:#f8fafc; text-shadow:0 5px 24px rgba(0,0,0,.32); animation:rise-in .6s .18s ease both; }
        .sub { font-size:15px; line-height:1.65; color:rgba(226,232,240,.82); max-width:44ch; margin:0 0 28px; animation:rise-in .6s .28s ease both; }
        .cta-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:34px; animation:rise-in .6s .36s ease both; }
        .hero-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; max-width:430px; animation:rise-in .6s .44s ease both; }
        .hero-metrics > div { border-top:1px solid var(--line); padding-top:9px; }
        .hero-stats strong { font-family:'Space Grotesk'; color:#f8fafc; font-size:22px; line-height:1; display:block; }
        .hero-stats span { color:rgba(203,213,225,.76); display:block; font-size:10px; margin-top:5px; }
        .hero-note { display:flex; align-items:flex-start; gap:10px; border-left:2px solid var(--immediate); padding-left:10px; margin-top:30px; max-width:410px; color:rgba(203,213,225,.76); font-size:11px; line-height:1.45; }
        .hero-note p { margin:0; }
        .hero-note span { color:var(--immediate); font:700 9px 'Space Grotesk'; letter-spacing:.08em; white-space:nowrap; }
        .site .hero .eyebrow-mark { background:#fbbf24; box-shadow:0 0 12px rgba(251,191,36,.58); }
        .site .hero .btn-primary { background:linear-gradient(135deg,#fde68a 0%,#fbbf24 42%,#d97706 100%); color:#172033; border-color:#ffe08a; box-shadow:0 12px 28px rgba(251,191,36,.25), inset 0 1px rgba(255,255,255,.55); transition:transform .2s ease, box-shadow .2s ease, filter .2s ease; }
        .site .hero .btn-primary:hover { filter:brightness(1.1); box-shadow:0 16px 34px rgba(251,191,36,.42), inset 0 1px rgba(255,255,255,.72); transform:translateY(-2px); }
        .site .hero .btn-ghost { color:#fef3c7; border-color:rgba(253,230,138,.48); background:rgba(30,41,59,.34); transition:background .2s ease, border-color .2s ease, transform .2s ease; }
        .site .hero .btn-ghost:hover { background:rgba(180,120,20,.22); border-color:#fde68a; transform:translateY(-2px); }
        .site .hero .hero-metrics > div { border-top-color:rgba(253,230,138,.32); }
        .hero-visual { position:relative; padding:16px 0 0; animation:float-in .9s .12s cubic-bezier(.2,.8,.2,1) both; }
        .hero-visual-top, .hero-visual-footer { display:flex; justify-content:space-between; align-items:center; color:var(--ink-soft); font:600 9px 'Space Grotesk'; letter-spacing:.08em; text-transform:uppercase; }
        .hero-visual-top { margin-bottom:10px; color:var(--brand-2); }
        .hero-visual-top span:first-child { display:flex; align-items:center; gap:7px; }
        .hero-visual-badge { display:flex; align-items:center; gap:5px; background:rgba(212,81,67,.1); border:1px solid rgba(212,81,67,.25); border-radius:20px; padding:3px 9px; color:var(--immediate); font:600 9px 'Space Grotesk'; letter-spacing:.06em; }
        .badge-dot { width:5px; height:5px; border-radius:50%; background:var(--immediate); display:inline-block; animation:live-pulse 1.6s ease-in-out infinite; }
        .hero-visual-footer { padding:9px 2px 0; font:500 10px 'Inter'; letter-spacing:0; text-transform:none; }

        /* Terrain frame */
        .terrain-frame { position:relative; border-radius:14px; overflow:hidden; box-shadow:0 20px 55px rgba(20,59,93,.18), 0 4px 12px rgba(20,59,93,.1); border:1px solid rgba(255,255,255,.4); }
        .terrain-vignette { position:absolute; inset:0; pointer-events:none; background: radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(20,30,20,.28) 100%); z-index:2; }
        .terrain-hud-bar { position:absolute; bottom:0; left:0; right:0; z-index:3; display:flex; align-items:center; justify-content:center; gap:18px; padding:10px 16px; background:linear-gradient(to top, rgba(10,20,10,.6) 0%, transparent 100%); backdrop-filter:blur(2px); }
        .terrain-hud-bar span { display:flex; align-items:center; gap:5px; color:rgba(255,255,255,.85); font:600 10px 'Space Grotesk'; letter-spacing:.06em; }
        .hud-dot { width:6px; height:6px; border-radius:50%; display:inline-block; }

        /* Evidence panel - glassmorphism */
        .hero-evidence { position:absolute; right:-28px; bottom:52px; width:198px; padding:14px 15px; background:rgba(255,255,255,.92); border:1px solid rgba(200,210,200,.6); border-radius:14px; box-shadow:0 16px 40px rgba(20,59,93,.18), 0 2px 8px rgba(20,59,93,.08); backdrop-filter:blur(12px); animation:monitor-in .8s .7s ease both; }
        .evidence-head, .evidence-row { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .evidence-head { color:var(--brand); font:700 9px 'Space Grotesk'; letter-spacing:.1em; text-transform:uppercase; padding-bottom:10px; border-bottom:1px solid var(--line); margin-bottom:2px; }
        .ev-live { display:flex; align-items:center; gap:4px; color:var(--safe); font:500 9px 'Inter'; letter-spacing:0; text-transform:none; }
        .ev-live i { width:5px; height:5px; border-radius:50%; background:var(--safe); display:inline-block; animation:live-pulse 1.8s ease-in-out infinite; }
        .evidence-row { padding-top:10px; color:var(--ink-soft); font-size:10.5px; }
        .evidence-row strong { color:var(--brand); font:700 18px 'Space Grotesk'; line-height:1; }
        .evidence-key { display:flex; align-items:center; gap:6px; }
        .evidence-dot { width:7px; height:7px; border-radius:50%; display:inline-block; flex-shrink:0; }
        .dot-red { background:var(--immediate); box-shadow:0 0 0 3px rgba(212,81,67,.2); }.dot-amber { background:var(--watch); box-shadow:0 0 0 3px rgba(199,137,34,.2); }.dot-green { background:var(--safe); box-shadow:0 0 0 3px rgba(33,132,95,.2); }
        @keyframes rise-in { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float-in { from { opacity:0; transform:translateY(20px) scale(.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .terrain-caption { text-align:center; font-size:11px; color:var(--ink-soft); margin-top:8px; }
        .monitor-pulse { width:6px; height:6px; border-radius:50%; background:var(--safe); box-shadow:0 0 0 4px rgba(46,139,104,.18); animation:live-pulse 1.8s ease-in-out infinite; }
        @keyframes monitor-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes live-pulse { 0%,100% { box-shadow:0 0 0 3px rgba(46,139,104,.18); } 50% { box-shadow:0 0 0 6px rgba(46,139,104,.06); } }
        @keyframes nav-signal { 0%,100% { opacity:.35; transform:scaleX(.35); transform-origin:left; } 50% { opacity:1; transform:scaleX(1); transform-origin:right; } }
        @keyframes grid-drift { from { background-position:0 0,0 0; } to { background-position:58px 58px,58px 58px; } }
        @keyframes hero-scan { from { transform:translateY(0); } to { transform:translateY(390%); } }

        .section { max-width:1180px; margin:0 auto; padding:84px 26px; }
        .section.alt { background:var(--panel); border-radius:0; max-width:none; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
        .section-head { max-width:700px; margin-bottom:36px; }
        .section-head h2 { font-family:'Space Grotesk'; font-weight:600; font-size:clamp(21px,2.6vw,28px); margin:0 0 8px; line-height:1.25; }
        .section-head p { font-size:13.5px; margin:0; }
        .demo-section { background:#f0efe5; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
        .demo-head { max-width:none; display:flex; align-items:flex-end; justify-content:space-between; gap:20px; }
        .demo-head h2 { max-width:18ch; }
        .demo-stage { max-width:820px; border:1px solid var(--line); background:var(--panel); border-radius:12px; overflow:hidden; box-shadow:0 12px 30px rgba(31,58,52,.07); }
        .demo-rail { display:grid; grid-template-columns:repeat(4,1fr); border-bottom:1px solid var(--line); }
        .demo-step { display:flex; align-items:center; gap:9px; border:none; border-right:1px solid var(--line); background:transparent; color:var(--ink-soft); padding:13px 15px; text-align:left; font:600 12px 'Inter'; cursor:pointer; }
        .demo-step:last-child { border-right:none; }
        .demo-step:hover { background:var(--panel-2); }
        .demo-step.is-active { background:var(--brand); color:#eef1e8; }
        .demo-step-index { font:700 11px 'Space Grotesk'; opacity:.65; }
        .demo-detail { display:flex; justify-content:space-between; align-items:center; gap:24px; min-height:170px; padding:28px 30px; border-left:4px solid var(--demo-color); }
        .demo-detail-copy { max-width:42ch; flex:1; }
        .demo-kicker { color:var(--demo-color); font:700 10px 'Space Grotesk'; letter-spacing:.1em; }
        .demo-detail h3 { color:var(--brand); font:700 25px 'Space Grotesk'; margin:8px 0 6px; }
        .demo-detail p { color:var(--ink-soft); font-size:13px; line-height:1.55; margin:0; }
        .demo-progress { height:3px; background:var(--line); margin-top:18px; overflow:hidden; }
        .demo-progress span { display:block; height:100%; background:var(--demo-color); transition:width .45s ease; }
        .demo-signal-board { flex:none; width:150px; padding:13px; border:1px solid var(--line); background:#ecece1; }
        .signal-grid { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; }
        .signal-grid span { aspect-ratio:1; border-radius:2px; background:#c8cdbb; transition:background .35s ease, transform .35s ease; }
        .signal-grid span.is-lit { background:var(--demo-color); transform:scale(1.08); }
        .signal-caption { display:flex; align-items:center; gap:5px; margin-top:10px; color:var(--ink-soft); font-size:9px; white-space:nowrap; }
        .signal-live { width:5px; height:5px; border-radius:50%; background:var(--demo-color); box-shadow:0 0 0 3px color-mix(in srgb, var(--demo-color) 18%, transparent); }
        .demo-metric { flex:none; border-left:1px solid var(--line); padding-left:24px; min-width:130px; }
        .demo-metric strong { display:block; color:var(--demo-color); font:700 42px 'Space Grotesk'; line-height:1; }
        .demo-metric span { color:var(--ink-soft); font-size:11px; }
        .demo-log { border-top:1px solid var(--line); padding:14px 20px 10px; background:#f1f1e8; }
        .demo-log-head { display:flex; justify-content:space-between; color:var(--ink-soft); font:700 9px 'Space Grotesk'; letter-spacing:.08em; margin-bottom:7px; }
        .demo-log-row { display:flex; align-items:center; gap:9px; min-height:26px; color:var(--brand-2); font-size:11px; animation:demo-reveal .35s ease both; }
        .demo-log-row > span { color:var(--ink-soft); font:700 10px 'Space Grotesk'; }
        .demo-log-row p { flex:1; margin:0; color:var(--ink-soft); }
        .demo-log-row svg { color:var(--safe); }
        .demo-complete { color:var(--safe); font-weight:600; }
        @keyframes demo-reveal { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .demo-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; border-top:1px solid var(--line); padding:12px 15px; color:var(--ink-soft); font-size:11px; }
        .demo-footer > div { display:flex; align-items:center; gap:6px; }
        .demo-icon-btn { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border:1px solid var(--line); border-radius:5px; background:var(--panel); color:var(--brand); cursor:pointer; }
        .demo-icon-btn:hover { border-color:var(--brand-2); background:var(--panel-2); }

        .problem-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:0; border-top:1px solid var(--line); border-left:1px solid var(--line); }
        @media (max-width: 940px) { .problem-grid { grid-template-columns:1fr 1fr; } }
        @media (max-width: 560px) { .problem-grid { grid-template-columns:1fr; } }
        .problem-card { background:var(--panel); border-right:1px solid var(--line); border-bottom:1px solid var(--line); border-radius:0; padding:24px 18px 26px; min-height:180px; position:relative; transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; cursor: default; }
        .problem-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 16px 40px rgba(20,59,93,0.13); background: #f0f9ff; z-index: 2; }
        .problem-card::before { content:'0' counter(problem); counter-increment:problem; color:var(--immediate); font:700 11px 'Space Grotesk'; letter-spacing:.08em; }
        .problem-grid { counter-reset:problem; }
        .problem-card h3 { color:var(--brand); font-family:'Space Grotesk'; font-size:15px; margin:28px 0 8px; }
        .problem-card p { font-size:12.5px; line-height:1.55; color:var(--ink-soft); margin:0; }
        .feas-icon { color: var(--brand-2); }

        .pillar-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0; padding:0; border:1px solid var(--line); }
        @media (max-width: 900px) { .pillar-grid { grid-template-columns:1fr; padding:0 20px 24px; } }
        .pillar-card { background:#fdfcf6; border-right:1px solid var(--line); border-radius:0; padding:28px 24px; min-height:250px; transition: transform 0.3s ease, box-shadow 0.3s ease, background 0.3s ease; cursor: default; }
        .pillar-card:hover { transform: translateY(-8px); box-shadow: 0 20px 50px rgba(20,59,93,0.14); background: #ffffff; z-index: 2; }
        .pillar-card:hover .pillar-icon { transform: scale(1.15) rotate(-5deg); background: var(--brand-2); }
        .pillar-icon { transition: transform 0.3s ease, background 0.3s ease; }
        .pillar-card:last-child { border-right:none; }
        .pillar-icon { width:34px; height:34px; border-radius:8px; background:var(--brand); color:#eef1e8; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }
        .pillar-card h3 { font-family:'Space Grotesk'; font-size:16px; margin:0 0 4px; }
        .pillar-tag { font-size:11px; color:var(--brand-2); font-weight:600; margin-bottom:14px; }
        .pillar-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:9px; }
        .pillar-list li { font-size:12.5px; color:var(--ink-soft); padding-left:14px; position:relative; line-height:1.4; }
        .pillar-list li::before { content:''; position:absolute; left:0; top:6px; width:5px; height:5px; border-radius:50%; background:var(--brand-2); }

        .timeline { display:grid; grid-template-columns:repeat(3,1fr); gap:0; position:relative; border-top:2px solid var(--brand-2); }
        .timeline::before { content:''; position:absolute; top:-7px; left:0; right:0; height:12px; background:radial-gradient(circle, var(--brand-2) 0 3px, transparent 4px) left center / 33.33% 12px repeat-x; pointer-events:none; }
        @media (max-width: 900px) { .timeline { grid-template-columns:1fr; } .demo-head { align-items:flex-start; flex-direction:column; } .demo-detail { align-items:flex-start; flex-wrap:wrap; } .demo-metric { border-left:none; border-top:1px solid var(--line); padding:14px 0 0; width:100%; } .nav-status { display:none; } }
        @media (max-width: 700px) { .site-nav { padding:11px 16px; align-items:flex-start; } .site-brand-sub { display:none; } .nav-links { gap:7px; } .nav-section-links { display:none; } .nav-links > .btn-primary { padding:7px 9px; font-size:11px; } .command-actions { align-items:flex-start; flex-direction:column; } .command-actions .btn-ghost { width:100%; justify-content:center; } .citizen-welcome { align-items:flex-start; flex-direction:column; } .citizen-welcome h1 { font-size:23px; } .citizen-trust { white-space:normal; } }
        @media (max-width: 600px) { .demo-rail { grid-template-columns:1fr 1fr; } .demo-step:nth-child(2) { border-right:none; } .demo-step:nth-child(-n+2) { border-bottom:1px solid var(--line); } .demo-detail { padding:22px; } .demo-signal-board { width:100%; } .demo-log { padding-inline:14px; } .demo-footer { align-items:flex-start; flex-direction:column; } .terrain-decision-overlay { left:8px; bottom:8px; width:calc(100% - 16px); } .risk-map-title { left:42px; } .risk-map-title span { display:none; } .risk-map-legend { top:auto; right:8px; bottom:8px; flex-wrap:wrap; max-width:180px; } }
        .timeline-step { background:transparent; border:none; border-right:1px solid var(--line); border-radius:0; padding:28px 22px 14px; min-height:190px; transition: background 0.25s ease, box-shadow 0.25s ease; cursor: default; }
        .timeline-step:hover { background: rgba(30,120,144,0.05); box-shadow: inset 0 0 0 1px rgba(30,120,144,0.18); }
        .timeline-step:hover .timeline-index { transform: scale(1.12); }
        .timeline-index { transition: transform 0.25s ease; }
        .timeline-step:last-child { border-right:none; }
        .timeline-index { font-family:'Space Grotesk'; font-weight:700; font-size:20px; margin-bottom:6px; }
        .timeline-title { font-family:'Space Grotesk'; font-weight:600; font-size:15px; margin-bottom:2px; }
        .timeline-window { margin-bottom:8px; }
        .timeline-step p { font-size:12.5px; line-height:1.5; color:var(--ink-soft); margin:0; }

        .stats-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; padding:0 30px 30px; }
        @media (max-width: 800px) { .stats-strip { grid-template-columns:1fr 1fr; padding:0 20px 24px; } }
        .stat-chip { border:1px solid var(--line); border-radius:12px; padding:20px 16px; background:var(--panel); transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; cursor: default; }
        .stat-chip:hover { transform: translateY(-5px); box-shadow: 0 14px 32px rgba(20,59,93,0.12); border-color: var(--brand-2); }
        .stat-chip-num { font-family:'Space Grotesk'; font-weight:700; font-size:26px; color:var(--brand); }
        .stat-chip-lab { font-size:12px; color:var(--ink-soft); margin-top:4px; line-height:1.4; }

        .tech-strip-wrap { max-width:1180px; margin:0 auto; padding:10px 26px 52px; display:flex; flex-direction:column; gap:12px; align-items:center; text-align:center; }
        .tech-strip { display:flex; flex-wrap:wrap; gap:9px; justify-content:center; }
        .tech-chip { border:1px solid var(--line); border-radius:20px; padding:6px 14px; font-size:12px; color:var(--ink-soft); background:var(--panel); transition: transform 0.2s ease, border-color 0.2s ease, color 0.2s ease, background 0.2s ease; cursor: default; }
        .tech-chip:hover { transform: translateY(-3px) scale(1.08); border-color: var(--brand-2); color: var(--brand); background: #e8f4f8; box-shadow: 0 6px 16px rgba(30,120,144,0.13); }

        .cta-banner { max-width:1180px; margin:0 auto 60px; background:var(--brand); color:#eef1e8; border-radius:22px;
          padding:40px 34px; display:flex; align-items:center; justify-content:space-between; gap:24px; flex-wrap:wrap; }
        .cta-banner h2 { font-family:'Space Grotesk'; font-weight:600; font-size:22px; margin:0 0 6px; max-width:26ch; }
        .cta-banner p { font-size:13px; color:#c7d1c1; margin:0; max-width:42ch; }
        .cta-banner .btn-primary { background:#eef1e8; color:var(--brand); border-color:#eef1e8; }

        .footer { border-top:1px solid var(--line); padding:24px 26px 40px; }
        .footer-row { max-width:1180px; margin:0 auto; display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }

        /* ============================================================
           MOBILE NAV HAMBURGER
           ============================================================ */
        .mobile-menu-btn { display:none; background:none; border:none; cursor:pointer; padding:6px; }
        .hamburger { display:flex; flex-direction:column; gap:4px; width:22px; }
        .hamburger span { display:block; height:2px; width:100%; background:var(--brand); border-radius:2px; transition:all .25s ease; transform-origin:center; }
        .hamburger.is-open span:nth-child(1) { transform:translateY(6px) rotate(45deg); }
        .hamburger.is-open span:nth-child(2) { opacity:0; transform:scaleX(0); }
        .hamburger.is-open span:nth-child(3) { transform:translateY(-6px) rotate(-45deg); }
        .mobile-nav-drawer { display:none; flex-direction:column; background:rgba(231,233,221,0.98); backdrop-filter:blur(12px); border-bottom:1px solid rgba(188,191,169,.8); padding:8px 0 16px; position:sticky; top:60px; z-index:19; }
        .mobile-nav-drawer button { background:none; border:none; font-size:14px; font-weight:500; color:var(--ink); cursor:pointer; font-family:'Inter'; padding:12px 20px; text-align:left; border-bottom:1px solid rgba(188,191,169,.3); }
        .mobile-nav-drawer button:last-child { border-bottom:none; }

        /* ============================================================
           COMPREHENSIVE MOBILE MEDIA QUERIES
           ============================================================ */

        /* --- Tablets & small desktops (≤ 768px) --- */
        @media (max-width: 768px) {
          .mobile-menu-btn { display:flex; }
          .mobile-nav-drawer { display:flex; }
          .nav-section-links { display:none !important; }
          .nav-links > .btn-primary { display:none; }
          .nav-status { display:none; }

          /* Console header */
          .header { padding:10px 14px; gap:10px; }
          .brand-name { font-size:14px; }
          .brand-tag { font-size:9.5px; }
          .header-controls { gap:6px; }
          .header-controls select { font-size:11px; padding:5px 7px; }
          .role-toggle button { font-size:11px; padding:5px 9px; }

          /* Console nav tabs */
          .nav-tabs { padding:0 10px; }
          .nav-tabs button { padding:10px 10px; font-size:11.5px; }

          /* Console body */
          .body { padding:14px 12px 40px; }

          /* Command heading */
          .command-heading { flex-direction:column; align-items:flex-start; gap:10px; margin-bottom:12px; }
          .command-heading h1 { font-size:20px; }
          .command-actions { width:100%; flex-direction:row; align-items:center; }
          .command-actions .btn-ghost { flex:1; justify-content:center; }

          /* KPI strip */
          .kpi-strip { grid-template-columns:1fr 1fr; gap:6px; }
          .kpi-strip strong { font-size:16px; }

          /* Overview layout */
          .overview-layout { gap:10px; }
          .risk-map-workspace { grid-template-columns:1fr; padding:8px; gap:10px; }

          /* Zone list */
          .zone-list-body { max-height:240px; }

          /* Map toggle */
          .map-toggle { gap:4px; }
          .map-toggle button { font-size:10.5px; padding:5px 8px; }
          .map-hint { display:none; }

          /* Map top bar */
          .map-top-bar { left:8px; right:8px; top:8px; flex-wrap:wrap; align-items:flex-start; }
          .hazard-controls { flex-wrap:wrap; gap:2px; border-radius:8px; white-space:normal; }
          .hazard-controls button { font-size:10px; padding:3px 6px; }
          .hazard-divider { display:none; }
          .fusion-toggle { border-right:none !important; padding-right:6px !important; }
          .tile-switcher-label { display:none; }

          /* Map dimensions */
          .map-stage { min-height:340px; height:45vh; }
          .terrain-decision-overlay { left:8px; bottom:8px; width:calc(100% - 16px); }
          .risk-map-title { left:42px; }
          .risk-map-title span { display:none; }
          .risk-map-legend { right:8px; max-width:180px; flex-wrap:wrap; }

          /* Detail panel */
          .stat-grid { grid-template-columns:1fr 1fr; }
          .action-row { flex-direction:column; }
          .action-row button { width:100%; justify-content:center; }

          /* Phasing kanban */
          .kanban { grid-template-columns:1fr; gap:10px; }

          /* Analytics */
          .stat-cards { grid-template-columns:1fr 1fr; gap:8px; }
          .chart-grid { grid-template-columns:1fr; }

          /* Reports */
          .reports { padding:10px; }
          .reports-head { font-size:12.5px; gap:8px; flex-wrap:wrap; }

          /* Citizen page */
          .citizen-page { gap:12px; }
          .citizen-welcome { flex-direction:column; align-items:flex-start; gap:10px; padding-bottom:12px; }
          .citizen-welcome h1 { font-size:22px; }
          .citizen-grid { grid-template-columns:1fr; gap:12px; }

          /* Modals */
          .brief-shell { max-height:92dvh; border-radius:12px; margin:0 8px; }
          .cert-shell { max-height:92dvh; margin:0 8px; border-radius:12px; }
          .brief-kpis { grid-template-columns:1fr 1fr; gap:8px; }
          .brief-header { padding:14px 14px 10px; }
          .brief-kpi { padding:8px; }
          .brief-kpi strong { font-size:20px; }
          .brief-zone-row { padding:10px 14px; }
          .cert-data-grid { grid-template-columns:1fr 1fr; }
          .cert-signatures { flex-direction:column; gap:16px; }

          /* Toast */
          .toast { bottom:12px; right:12px; left:12px; justify-content:center; }
        }

        /* --- Phones (≤ 480px) --- */
        @media (max-width: 480px) {
          /* Header */
          .header { padding:8px 10px; }
          .brand-name { font-size:13px; }
          .role-toggle button { font-size:10px; padding:4px 7px; }

          /* Nav tabs — horizontally scrollable */
          .nav-tabs { padding:0 8px; gap:0; }
          .nav-tabs button { padding:9px 8px; font-size:10.5px; }

          /* Body */
          .body { padding:10px 8px 32px; }

          /* KPI */
          .kpi-strip strong { font-size:15px; }
          .kpi-strip span { font-size:9.5px; }

          /* Map stage */
          .map-stage { min-height:220px; }

          /* Demo section */
          .demo-section { padding:40px 14px; }
          .demo-head { flex-direction:column; align-items:flex-start; gap:12px; }
          .demo-actions { flex-wrap:wrap; gap:6px; }
          .demo-stage { border-radius:8px; }
          .demo-rail { grid-template-columns:1fr 1fr; }
          .demo-step:nth-child(2) { border-right:none; }
          .demo-step:nth-child(-n+2) { border-bottom:1px solid var(--line); }
          .demo-detail { flex-direction:column; align-items:flex-start; padding:18px 14px; gap:14px; }
          .demo-signal-board { width:100%; }
          .demo-metric { border-left:none; border-top:1px solid var(--line); padding:12px 0 0; width:100%; }
          .demo-metric strong { font-size:34px; }
          .demo-log { padding-inline:12px; }
          .demo-footer { flex-direction:column; align-items:flex-start; gap:8px; }
          .demo-footer > div { flex-wrap:wrap; gap:4px; }

          /* Sections */
          .section { padding:48px 14px; }
          .section.alt { padding:36px 14px; }
          .section-head h2 { font-size:19px; }

          /* Problem grid */
          .problem-grid { grid-template-columns:1fr; }
          .problem-card { padding:18px 14px 20px; min-height:unset; }

          /* Pillar grid */
          .pillar-grid { grid-template-columns:1fr; }
          .pillar-card { padding:20px 16px; min-height:unset; }

          /* Timeline */
          .timeline { grid-template-columns:1fr; }
          .timeline-step { padding:20px 14px 12px; min-height:unset; border-right:none; border-bottom:1px solid var(--line); }
          .timeline-step:last-child { border-bottom:none; }

          /* Stats */
          .stats-strip { grid-template-columns:1fr 1fr; padding:0 14px 20px; gap:10px; }
          .stat-chip { padding:14px 12px; }
          .stat-chip-num { font-size:22px; }

          /* Hero */
          .hero { padding:40px 14px 52px; }
          .hero-stats { grid-template-columns:1fr 1fr 1fr; gap:8px; }
          .hero-stats strong { font-size:17px; }
          .cta-row { gap:8px; }
          .cta-row .btn-primary, .cta-row .btn-ghost { width:100%; justify-content:center; }
          .hero-note { max-width:100%; }

          /* CTA banner */
          .cta-banner { padding:24px 18px; border-radius:14px; flex-direction:column; align-items:flex-start; }
          .cta-banner h2 { font-size:18px; }
          .cta-banner .btn-primary { width:100%; justify-content:center; }

          /* Tech strip */
          .tech-strip-wrap { padding:8px 14px 36px; }

          /* Footer */
          .footer { padding:18px 14px 28px; }
          .footer-row { flex-direction:column; align-items:flex-start; gap:10px; }

          /* Modals */
          .brief-shell, .cert-shell { margin:0 4px; }
          .brief-actions { flex-wrap:wrap; }
          .brief-actions button { flex:1 1 calc(50% - 5px); justify-content:center; }
          .cert-data-grid { grid-template-columns:1fr; }

          /* Citizen page */
          .citizen-risk-row { grid-template-columns:1fr 1fr; }

          /* Toast */
          .toast { font-size:11.5px; padding:8px 12px; }

          /* Zone list */
          .zone-row-name { font-size:11.5px; }
        }

        /* --- Very small phones (≤ 360px) --- */
        @media (max-width: 360px) {
          .header-controls select { max-width:100px; }
          .role-toggle { flex-shrink:0; }
          .kpi-strip { grid-template-columns:1fr 1fr; gap:5px; }
          .kpi-strip > div { padding:8px; }
          .stat-cards { grid-template-columns:1fr 1fr; }
          .hero-stats { grid-template-columns:1fr 1fr; }
          .stats-strip { grid-template-columns:1fr; }
          .demo-rail { grid-template-columns:1fr; }
          .demo-step { border-right:none !important; border-bottom:1px solid var(--line); }
          .demo-step:last-child { border-bottom:none; }
        }

        /* ---- unified dark blue + white gold theme ---- */
        .app { background:#07111f; color:var(--ink); }
        .app .header { background:linear-gradient(135deg,#081b38 0%,#173f78 56%,#102b51 100%); box-shadow:0 8px 26px rgba(2,6,23,.42); }
        .app .header::before { background:linear-gradient(90deg,#d89b24 0%,#ffe9a6 32%,#ffffff 50%,#fbbf24 72%,#a56a12 100%); box-shadow:0 0 14px rgba(251,191,36,.52); }
        .app .header::after { background:linear-gradient(90deg,transparent,#fbbf24,#fff7d1,#fbbf24,transparent); opacity:.9; }
        .app .header .brand-name { color:#ffe7a1 !important; text-shadow:0 0 16px rgba(251,191,36,.22); }
        .app .header .brand-tag { color:rgba(226,232,240,.78) !important; }
        .app .header-controls select, .app .role-toggle { background:rgba(3,12,27,.62); border-color:rgba(251,191,36,.42); }
        .app .role-toggle button.is-on { background:linear-gradient(135deg,#ffe08a,#d88a12); color:#132238; box-shadow:0 4px 16px rgba(251,191,36,.24); }
        .app .nav-tabs { background:#0b1d34; border-bottom-color:#d89b24; box-shadow:0 5px 20px rgba(2,6,23,.22); }
        .app .nav-tabs button { color:#9fb4cd; }
        .app .nav-tabs button:hover { color:#fff7d1; background:rgba(251,191,36,.08); }
        .app .nav-tabs button.is-active { color:#ffe7a1; border-bottom-color:#fbbf24; text-shadow:0 0 12px rgba(251,191,36,.25); }
        .app .body { background:radial-gradient(circle at 86% 4%,rgba(255,224,138,.18),transparent 24%),linear-gradient(180deg,#1a3e60 0%,#204f76 54%,#123250 100%); }
        .app .command-heading h1, .app .command-heading .eyebrow, .app .risk-map-list-head, .app .zone-list-head { color:#ffe7a1; }
        .app .command-status { background:rgba(16,185,129,.1); border-color:rgba(110,231,183,.35); color:#a7f3d0; }
        .app .risk-map-workspace, .app .zone-list, .app .map-wrap, .app .kpi-strip > div, .app .terrain-decision-overlay { background:linear-gradient(145deg,rgba(43,91,132,.97),rgba(21,57,91,.97)); border-color:rgba(255,224,138,.38); box-shadow:0 12px 30px rgba(2,6,23,.28),inset 0 1px rgba(255,255,255,.16); }
        .app .kpi-strip > div:hover { border-color:#fbbf24; box-shadow:0 0 0 1px rgba(251,191,36,.18),0 12px 30px rgba(251,191,36,.12); }
        .app .kpi-strip strong, .app .terrain-overlay-title strong, .app .terrain-overlay-grid strong, .app .risk-map-title strong { color:#fff7d1; }
        .app .kpi-strip .kpi-alert strong, .app .level-critical, .app .level-high { color:#fecdd3; }
        .app .kpi-strip .kpi-alert { border-color:rgba(194,65,76,.65); box-shadow:0 0 18px rgba(194,65,76,.12); }
        .app .zone-score { color:#f8fafc; }
        .app .zone-row { border-bottom-color:rgba(251,191,36,.1); color:#e8f1ff; }
        .app .zone-row:hover, .app .zone-row.is-active { background:linear-gradient(90deg,rgba(251,191,36,.16),rgba(30,64,96,.45)); }
        .app .map-wrap, .app .risk-map-wrap, .app .map-stage { box-shadow:0 16px 36px rgba(2,6,23,.3), inset 0 0 0 1px rgba(255,255,255,.04); }
        .app .risk-map-title, .app .risk-map-legend, .app .hazard-controls, .app .tile-switcher-btn, .app .tile-menu, .app .fusion-panel { background:rgba(8,24,43,.92); border-color:rgba(251,191,36,.3); color:#dbeafe; box-shadow:0 10px 28px rgba(2,6,23,.36),inset 0 1px rgba(255,255,255,.08); }
        .app .risk-map-title span, .app .risk-map-legend, .app .tile-option, .app .hazard-controls button { color:#9fb4cd; }
        .app .tile-option:hover, .app .tile-option.is-active, .app .hazard-controls button:hover, .app .hazard-controls .is-on { background:rgba(251,191,36,.14); color:#ffe7a1; }
        .app .btn-primary { background:linear-gradient(110deg,#fff7d1,#ffe08a 28%,#fbbf24 55%,#fff7d1 78%,#d89b24); background-size:220% 100%; color:#142238; border-color:#fff1b0; box-shadow:0 6px 18px rgba(251,191,36,.24),inset 0 1px rgba(255,255,255,.7); animation:button-shine 5s ease-in-out infinite; }
        .app .btn-ghost { color:#ffe7a1; border-color:rgba(251,191,36,.36); background:rgba(15,35,59,.35); }
        .app .btn-ghost:hover { background:rgba(251,191,36,.14); border-color:#ffe08a; }
        .app .back-btn { background:rgba(65,105,225,.22); border-color:rgba(147,197,253,.48); color:#fff7d1; }
        .app .map-toggle button.is-on { background:linear-gradient(135deg,#4169e1,#2948a5); border-color:#93b4ff; color:#fff; box-shadow:0 5px 16px rgba(65,105,225,.28); }
        .app .section-head h2, .app .demo-detail h3 { color:#fff7d1; }
        .app .live-strip > div, .app .terrain-overlay-kicker, .app .terrain-next-step span { color:#fcd34d; }
        .app .live-dot, .app .monitor-pulse { background:#fbbf24; box-shadow:0 0 0 3px rgba(251,191,36,.18); }
        .app .toast { background:linear-gradient(135deg,#173b60,#0a2039); border:1px solid rgba(251,191,36,.4); box-shadow:0 12px 28px rgba(2,6,23,.4),0 0 20px rgba(251,191,36,.1); }
        /* ---- white and gold finish ---- */
        .app { background:#fffdf8; color:#352b20; }
        .app .header { background:linear-gradient(135deg,#fffdf8 0%,#fff8e8 58%,#ffffff 100%); color:#352b20; box-shadow:0 8px 24px rgba(117,83,20,.12); }
        .app .header::before { background:linear-gradient(90deg,#b98216,#ffe49a,#ffffff,#f3c95b,#b98216); box-shadow:0 0 14px rgba(201,149,37,.35); }
        .app .header::after { background:linear-gradient(90deg,transparent,#c89525,#fff3c4,#c89525,transparent); }
        .app .header .brand-name { color:#805308 !important; text-shadow:0 1px 10px rgba(201,149,37,.18); }
        .app .header .brand-tag { color:#796d5e !important; }
        .app .header-controls select, .app .role-toggle { background:#ffffff; color:#4b3b28; border-color:rgba(191,143,38,.5); }
        .app .role-toggle button { color:#796d5e; }
        .app .role-toggle button.is-on { background:linear-gradient(135deg,#ffe8a4,#c89525); color:#4b2d00; box-shadow:0 4px 14px rgba(201,149,37,.22); }
        .app .nav-tabs { background:#fffdf8; border-bottom-color:#c89525; box-shadow:0 5px 18px rgba(117,83,20,.1); }
        .app .nav-tabs button { color:#796d5e; }
        .app .nav-tabs button:hover { color:#805308; background:#fff8e8; }
        .app .nav-tabs button.is-active { color:#805308; border-bottom-color:#c89525; text-shadow:0 0 10px rgba(201,149,37,.2); }
        .app .body { background:radial-gradient(circle at 86% 4%,rgba(201,149,37,.09),transparent 24%),linear-gradient(180deg,#fffdf8 0%,#fffaf0 54%,#ffffff 100%); }
        .app .command-heading h1, .app .command-heading .eyebrow, .app .risk-map-list-head, .app .zone-list-head { color:#805308; }
        .app .command-heading p, .app .muted { color:#796d5e; }
        .app .risk-map-workspace, .app .zone-list, .app .map-wrap, .app .kpi-strip > div, .app .terrain-decision-overlay { background:linear-gradient(145deg,#ffffff,#fffaf0); border-color:rgba(191,143,38,.28); box-shadow:0 12px 30px rgba(117,83,20,.09),inset 0 1px rgba(255,255,255,.9); }
        .app .kpi-strip strong, .app .terrain-overlay-title strong, .app .terrain-overlay-grid strong, .app .risk-map-title strong { color:#805308; }
        .app .zone-row { border-bottom-color:rgba(191,143,38,.12); color:#4b3b28; }
        .app .zone-row:hover, .app .zone-row.is-active { background:linear-gradient(90deg,#fff1c2,#fffaf0); }
        .app .map-wrap, .app .risk-map-wrap, .app .map-stage { box-shadow:0 16px 36px rgba(117,83,20,.1),inset 0 0 0 1px rgba(255,255,255,.8); }
        .app .risk-map-title, .app .risk-map-legend, .app .hazard-controls, .app .tile-switcher-btn, .app .tile-menu, .app .fusion-panel { background:rgba(255,255,255,.96); border-color:rgba(191,143,38,.3); color:#4b3b28; box-shadow:0 10px 28px rgba(117,83,20,.12),inset 0 1px rgba(255,255,255,.95); }
        .app .risk-map-title span, .app .risk-map-legend, .app .tile-option, .app .hazard-controls button { color:#796d5e; }
        .app .tile-option:hover, .app .tile-option.is-active, .app .hazard-controls button:hover, .app .hazard-controls .is-on { background:#fff1c2; color:#805308; }
        .app .btn-primary { background:linear-gradient(135deg,#ffe9a8,#c89525 52%,#a56a12); color:#3c290d; border-color:#e8bd56; box-shadow:0 6px 18px rgba(201,149,37,.2),inset 0 1px rgba(255,255,255,.7); }
        .app .btn-ghost { color:#805308; border-color:rgba(191,143,38,.42); background:#ffffff; }
        .app .btn-ghost:hover { background:#fff8e8; border-color:#c89525; }
        .app .live-strip > div, .app .terrain-overlay-kicker, .app .terrain-next-step span { color:#a56a12; }
        .app .live-dot, .app .monitor-pulse { background:#c89525; box-shadow:0 0 0 3px rgba(201,149,37,.18); }
        .app .toast { background:linear-gradient(135deg,#fffdf8,#fff1c2); color:#4b3b28; border:1px solid rgba(191,143,38,.4); box-shadow:0 12px 28px rgba(117,83,20,.16),0 0 20px rgba(201,149,37,.12); }
        .site .site-nav { background:rgba(255,255,255,.9); border-bottom-color:rgba(191,143,38,.24); box-shadow:0 10px 30px rgba(117,83,20,.08); }
        .site .site-nav::after { background:linear-gradient(90deg,transparent,#c89525,#fff0b7,#c89525,transparent); }
        .site .brand-name { color:#805308; }
        .site .site-brand-sub, .site .nav-links button { color:#796d5e; }
        .site .nav-section-links { background:#fffaf0; border-color:rgba(191,143,38,.28); }
        .site .nav-section-links button:hover { color:#805308; background:#fff1c2; }
        .site .hero { background:radial-gradient(circle at 78% 30%,rgba(201,149,37,.15),transparent 28%),linear-gradient(180deg,#fffdf8 0%,#fff8e8 66%,#ffffff 100%); }
        .site .hero::before { background-image:linear-gradient(rgba(191,143,38,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(191,143,38,.07) 1px,transparent 1px); opacity:.3; }
        .site .hero::after { background:linear-gradient(180deg,transparent,rgba(201,149,37,.12),rgba(255,244,189,.16),transparent); }
        .site .hero-eyebrow { color:#a56a12; }
        .site .headline { color:#4b3b28; text-shadow:0 5px 24px rgba(117,83,20,.12); }
        .site .sub, .site .hero-note { color:#796d5e; }
        .site .hero-stats strong { color:#805308; }
        .site .hero-stats span { color:#796d5e; }
        .site .site-nav { background:linear-gradient(135deg,#102a4d 0%,#173b67 100%); border-bottom-color:rgba(255,224,138,.42); box-shadow:0 10px 30px rgba(16,42,76,.2); }
        .site .site-brand-sub, .site .nav-links button { color:rgba(255,247,209,.76); }
        .site .brand-name { color:#fff1b0; }
        .site .nav-section-links { background:rgba(7,24,48,.56); border-color:rgba(255,224,138,.32); }
        .site .nav-section-links button:hover { color:#fff7d1; background:rgba(201,149,37,.22); }
        .site .nav-status { color:#9ff1ca; }
        .site .nav-status span { background:#6ee7b7; }
        .site .nav-links > .btn-primary, .site .hero .btn-primary { background:linear-gradient(135deg,#ffe8a4 0%,#c89525 56%,#8d5b10 100%); color:#2c210d; border-color:#ffe49a; box-shadow:0 8px 22px rgba(138,91,16,.25),inset 0 1px rgba(255,255,255,.72); }
        .site .nav-links > .btn-primary:hover, .site .hero .btn-primary:hover { filter:brightness(1.08); box-shadow:0 12px 28px rgba(138,91,16,.36),inset 0 1px rgba(255,255,255,.82); }
        .site .headline { color:#102a4d; text-shadow:0 5px 24px rgba(255,255,255,.48); }
        .site .hero-eyebrow { color:#8d5b10; }
        .site .hero .btn-ghost { color:#805308; border-color:rgba(191,143,38,.42); background:rgba(255,255,255,.68); }
        @media (max-width: 768px) {
          .site .mobile-menu-btn { display:none !important; }
          .site .mobile-site-nav { display:grid; }
          .app .header { padding:8px 12px 10px; gap:8px; }
          .app .header .brand-wrap { min-width:0; padding:8px 0; }
          .app .header .brand-logo-img { width:32px; height:32px; }
          .app .header .brand-name { font-size:14px; white-space:nowrap; }
          .app .header .brand-tag { display:block; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:9px; }
          .app .header-controls { width:100%; display:grid; grid-template-columns:minmax(0,1fr) auto; gap:7px; padding:3px 0 0; }
          .app .header-controls > button:first-child { grid-column:1 / -1; justify-content:center; min-height:38px; }
          .app .header-controls select { width:100%; min-width:0; min-height:38px; }
          .app .role-toggle { min-height:38px; }
          .app .role-toggle button { min-height:32px; padding-inline:10px; }
          .app .nav-tabs { padding:0 8px; gap:0; }
          .app .nav-tabs button { min-height:44px; padding:10px 11px; font-size:11px; }
          .app .body { padding:14px 10px 36px; }
          .app .command-heading { align-items:flex-start; flex-direction:column; gap:12px; }
          .app .command-heading h1 { font-size:24px; }
          .app .command-actions { width:100%; align-items:stretch; flex-direction:column; }
          .app .command-actions > * { justify-content:center; }
          .app .kpi-strip { grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
          .app .kpi-strip > div { min-width:0; padding:9px 8px; }
          .app .kpi-strip span { line-height:1.25; }
          .app .risk-map-workspace { grid-template-columns:1fr; padding:7px; gap:8px; }
          .app .risk-map-list .zone-list-body { max-height:230px; }
          .app .map-stage { min-height:360px; height:58vh; }
          .app .live-strip { align-items:flex-start; flex-direction:column; }
          .app .live-strip .refresh-btn { width:100%; margin-left:0; justify-content:center; }
          .app #tinyfish-panel { max-width:none !important; margin:8px 10px 0 !important; }
        }
        @media (max-width: 420px) {
          .app .header .brand-tag { display:none; }
          .app .header .brand-name { font-size:13px; }
          .app .kpi-strip strong { font-size:16px; }
          .app .map-stage { min-height:310px; height:55vh; }
          .app .map-toggle button { flex:1 1 calc(50% - 6px); justify-content:center; min-height:38px; }
        }
        @media (max-width: 600px) {
          .app .map-stage .fusion-panel,
          .app .map-stage .terrain-decision-overlay,
          .app .map-stage .risk-map-legend,
          .app .map-stage .risk-map-title span { display:none; }
          .app .map-stage .map-top-bar { gap:5px; }
          .app .map-stage .hazard-controls { max-height:42px; overflow:hidden; padding:3px 5px; }
          .app .map-stage .hazard-controls button { padding:4px 6px; font-size:9px; }
          .app .map-stage .hazard-controls button:nth-of-type(n+5) { display:none; }
          .app .map-stage .map-top-actions { gap:4px; }
          .app .map-stage .tile-switcher-btn,
          .app .map-stage .map-top-actions button { min-height:34px; padding:5px 7px; }
          .app .map-stage .risk-map-title { left:8px; bottom:8px; max-width:145px; }
          .app .map-stage .risk-map-title strong { font-size:10px; }
          .app .map-stage .map-label,
          .app .map-stage .site-label { display:none; }
        }
        .mobile-site-nav, .mobile-dashboard-nav { display:none; }
        @media (max-width: 768px) {
          .site .mobile-menu-btn { display:none !important; }
          .site .mobile-site-nav { position:fixed; display:grid; grid-template-columns:repeat(3,1fr); left:10px; right:10px; bottom:10px; z-index:80; padding:5px; gap:4px; background:rgba(16,42,76,.96); border:1px solid rgba(255,224,138,.45); border-radius:14px; box-shadow:0 10px 30px rgba(2,6,23,.28); backdrop-filter:blur(12px); }
          .site .mobile-site-nav button, .app .mobile-dashboard-nav button { display:flex; align-items:center; justify-content:center; gap:5px; min-height:40px; border:0; border-radius:9px; background:transparent; color:#fff7d1; font:700 10px 'Inter'; cursor:pointer; }
          .site .mobile-site-nav button.is-primary { background:linear-gradient(135deg,#ffe9a8,#c89525); color:#3c290d; }
          .app .mobile-dashboard-nav { position:fixed; display:grid; grid-template-columns:repeat(4,1fr); left:8px; right:8px; bottom:8px; z-index:80; padding:5px; gap:3px; background:rgba(255,253,248,.97); border:1px solid rgba(191,143,38,.4); border-radius:14px; box-shadow:0 10px 30px rgba(117,83,20,.2); }
          .app .mobile-dashboard-nav button { color:#805308; }
          .app .mobile-dashboard-nav button.is-active { background:#fff1c2; color:#7a4b00; }
          .site { padding-bottom:68px; }
          .app { padding-bottom:66px; }
        }
        @keyframes button-shine { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
      `}</style>
      {view === "landing" ? (
        <LandingPage
          onLaunch={(targetTab) =>
            navigate("/console", {
              state: {
                tab: typeof targetTab === "string" ? targetTab : "overview",
              },
            })
          }
          onGlobalView={() => navigate("/global-view")}
        />
      ) : (
        <ConsoleApp onBack={() => navigate("/")} />
      )}
    </div>
  );
}
