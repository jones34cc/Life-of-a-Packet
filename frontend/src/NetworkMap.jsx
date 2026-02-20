import React, { Suspense, useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture, Stars, Html, Cylinder, Cone } from '@react-three/drei';
import * as THREE from 'three';

const Loader = () => (
  <Html center>
    <div style={{ color: '#00ffcc', fontSize: '20px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
      LOADING 3D ASSETS...
    </div>
  </Html>
);

// ==========================================
// 🌍 SCENE 1: THE GLOBE VIEW
// ==========================================
const RealisticUniverse = () => {
  const universeRef = useRef();
  useFrame(() => {
    if (universeRef.current) universeRef.current.rotation.y += 0.0001;
  });
  const spaceTexture = useTexture('https://unpkg.com/three-globe/example/img/night-sky.png');
  return (
    <group ref={universeRef}>
      <Sphere args={[50, 64, 64]}>
        <meshBasicMaterial map={spaceTexture} side={THREE.BackSide} />
      </Sphere>
      <Stars radius={40} depth={10} count={10000} factor={2} saturation={0} fade speed={1} />
    </group>
  );
};

const latLongToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

const GlobePacket = ({ startCoord, endCoord, radius }) => {
  const packetRef = useRef();
  const curve = useMemo(() => {
    const start = latLongToVector3(startCoord[0], startCoord[1], radius);
    const end = latLongToVector3(endCoord[0], endCoord[1], radius);
    const mid = start.clone().lerp(end, 0.5);
    mid.normalize().multiplyScalar(radius + start.distanceTo(end) * 0.3); 
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [startCoord, endCoord, radius]);

  const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)), [curve]);

  useFrame(({ clock }) => {
    if (!packetRef.current) return;
    const time = (clock.getElapsedTime() * 0.4) % 1;
    packetRef.current.position.copy(curve.getPoint(time));
  });

  return (
    <group>
      <line geometry={lineGeo}>
        <lineBasicMaterial color="#00ffcc" opacity={0.3} transparent />
      </line>
      <Sphere args={[0.02, 16, 16]} position={curve.getPoint(1)}>
        <meshBasicMaterial color="#ff0055" />
      </Sphere>
      <Sphere ref={packetRef} args={[0.035, 16, 16]}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>
    </group>
  );
};

const GlobeView = ({ routeData }) => {
  const colorMap = useTexture('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
  const GLOBE_RADIUS = 2;
  return (
    <group>
      <ambientLight intensity={2.5} color="#ffffff" />
      <RealisticUniverse />
      <Sphere args={[GLOBE_RADIUS, 64, 64]}>
        <meshStandardMaterial map={colorMap} roughness={0.7} metalness={0.1} />
      </Sphere>
      {routeData.length > 0 && (
        <Sphere args={[0.02, 16, 16]} position={latLongToVector3(routeData[0].coords[0], routeData[0].coords[1], GLOBE_RADIUS)}>
          <meshBasicMaterial color="#00ffcc" />
        </Sphere>
      )}
      {routeData.map((hop, index) => {
        if (index === routeData.length - 1) return null;
        return <GlobePacket key={index} startCoord={routeData[index].coords} endCoord={routeData[index + 1].coords} radius={GLOBE_RADIUS} />;
      })}
    </group>
  );
};

// ==========================================
// 🚀 SCENE 2: THE PRO VIEW
// ==========================================
const ProRocket = ({ curve }) => {
  const rocketGroup = useRef();
  
  useFrame(({ clock }) => {
    if (!rocketGroup.current || !curve) return;
    const t = (clock.getElapsedTime() * 0.1) % 1; 
    const position = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    
    rocketGroup.current.position.copy(position);
    const target = position.clone().add(tangent);
    rocketGroup.current.lookAt(target);
  });

  return (
    <group ref={rocketGroup}>
      <Cone args={[0.15, 0.4, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]}>
        <meshStandardMaterial color="#ff0055" />
      </Cone>
      <Cylinder args={[0.15, 0.15, 0.8, 16]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.4]}>
        <meshStandardMaterial color="#222222" />
      </Cylinder>
      <Sphere args={[0.1, 16, 16]} position={[0, 0, -0.9]}>
        <meshBasicMaterial color="#00ffcc" />
      </Sphere>
    </group>
  );
};

const ProView = ({ routeData }) => {
  const points = useMemo(() => {
    const spacing = 5;
    const offset = (routeData.length * spacing) / 2;
    return routeData.map((hop, i) => new THREE.Vector3(i * spacing - offset, 0, 0));
  }, [routeData]);

  const curve = useMemo(() => {
    if (points.length < 2) return null;
    return new THREE.CatmullRomCurve3(points);
  }, [points]);

  const lineGeo = useMemo(() => {
    if (!curve) return null;
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(100));
  }, [curve]);

  return (
    <group>
      <ambientLight intensity={3} color="#ffffff" />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />

      {routeData.length === 0 && (
        <Html center>
          <div style={{ color: '#88aadd', fontSize: '24px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
            Awaiting Trace Data...
          </div>
        </Html>
      )}

      {lineGeo && (
        <line geometry={lineGeo}>
          <lineBasicMaterial color="#88aadd" linewidth={2} />
        </line>
      )}

      {routeData.map((hop, i) => (
        <group key={i} position={points[i]}>
          <Sphere args={[0.2, 32, 32]}>
            <meshStandardMaterial color="#0055ff" roughness={0.3} metalness={0.8} />
          </Sphere>
          <Html position={[0, 0.6, 0]} center zIndexRange={[100, 0]}>
            <div style={{ background: 'white', borderTop: '4px solid #0055ff', padding: '15px', borderRadius: '8px', width: '220px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)', color: '#333' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#0055ff', fontSize: '14px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                Hop {i + 1}: {hop.name}
              </h4>
              <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>IP:</strong> <span style={{ fontFamily: 'monospace' }}>{hop.ip}</span></p>
              
              {/* NEW LATENCY DISPLAY */}
              <p style={{ margin: '4px 0', fontSize: '12px' }}>
                <strong>Latency:</strong> <span style={{ color: hop.latency > 100 ? '#ff0055' : '#00aa55', fontWeight: 'bold' }}>{hop.latency} ms</span>
              </p>
              
              <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>ISP:</strong> {hop.isp}</p>
              <p style={{ margin: '4px 0', fontSize: '12px' }}><strong>ASN:</strong> {hop.as}</p>
            </div>
          </Html>
        </group>
      ))}

      {curve && <ProRocket curve={curve} />}
    </group>
  );
};

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function NetworkMap() {
  const [routeData, setRouteData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [domain, setDomain] = useState('google.com');
  const [isProView, setIsProView] = useState(false);

  const runTrace = async () => {
    setLoading(true);
    setRouteData([]);
    try {
      const response = await fetch('http://localhost:5000/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain })
      });
      const data = await response.json();
      setRouteData(data);
    } catch (err) {
      console.error(err);
      alert("Failed to connect to backend! Is your server.js running?");
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'absolute', 
      top: 0, 
      left: 0, 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden', 
      background: isProView ? '#eef2f5' : '#000000', // DYNAMIC BACKGROUND APPLIED HERE
      transition: 'background 0.5s ease' // Smooth fade when switching views
    }}>
      
      {/* RESPONSIVE UI OVERLAY */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        padding: '20px',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '15px',
        boxSizing: 'border-box',
        pointerEvents: 'none'
      }}>
        
        {/* Left Panel */}
        <div style={{ 
          background: isProView ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.8)', 
          padding: '20px', 
          borderRadius: '8px', 
          border: isProView ? '1px solid #ccc' : '1px solid #333', 
          transition: 'all 0.3s', 
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
          pointerEvents: 'auto',
          maxWidth: '100%'
        }}>
          <h3 style={{ color: isProView ? '#333' : 'white', marginTop: 0 }}>Live Network Visualizer</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              value={domain} 
              onChange={(e) => setDomain(e.target.value)}
              style={{ padding: '8px', background: isProView ? '#fff' : '#222', color: isProView ? '#000' : 'white', border: isProView ? '1px solid #aaa' : '1px solid #555', borderRadius: '4px', width: '200px', maxWidth: '100%' }}
            />
            <button 
              onClick={runTrace} 
              disabled={loading}
              style={{ padding: '8px 15px', background: loading ? '#888' : '#0055ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Tracing...' : 'Run Trace'}
            </button>
          </div>
        </div>

        {/* Right Panel / Pro Toggle */}
        <button 
          onClick={() => setIsProView(!isProView)}
          style={{ 
            padding: '12px 20px', 
            background: isProView ? '#222' : '#fff', 
            color: isProView ? '#fff' : '#000', 
            border: 'none', 
            borderRadius: '30px', 
            cursor: 'pointer', 
            fontWeight: 'bold', 
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)', 
            transition: 'all 0.3s',
            pointerEvents: 'auto'
          }}
        >
          {isProView ? '🌍 Globe View' : '🔬 Pro View'}
        </button>
      </div>

      {/* THE 3D CANVAS */}
      <Canvas style={{ width: '100%', height: '100%' }} camera={{ position: [0, 0, isProView ? 15 : 6], fov: 50 }}>
        <OrbitControls enableZoom={true} minDistance={2.5} maxDistance={30} enableRotate={true} enablePan={true} />
        <Suspense fallback={<Loader />}>
          {isProView ? <ProView routeData={routeData} /> : <GlobeView routeData={routeData} />}
        </Suspense>
      </Canvas>
      
    </div>
  );
}