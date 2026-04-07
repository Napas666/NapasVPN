import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// URL works in CRA dev (localhost:3000/jellyfish.glb) and Electron prod (./jellyfish.glb)
const MODEL_URL = process.env.PUBLIC_URL + '/jellyfish.glb';

// Preload so both instances share one download
useGLTF.preload(MODEL_URL);

// ── One floating jellyfish instance ─────────────────────────────────────────
function JellyfishInstance({ position, scale, speed, phase, rotDir = 1 }) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef   = useRef();

  // Clone scene so each instance has independent materials
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if (!child.isMesh) return;

      // Deep-clone material so instances don't share state
      const mat = new THREE.MeshStandardMaterial({
        color:             new THREE.Color(0x5a0000),
        emissive:          new THREE.Color(0xff1a1a),
        emissiveIntensity: 1.8,
        transparent:       true,
        opacity:           0.82,
        roughness:         0.25,
        metalness:         0.05,
        side:              THREE.DoubleSide,
      });

      // If original had a texture, keep it but tint red
      if (child.material?.map) {
        mat.map            = child.material.map;
        mat.emissiveMap    = child.material.map;
        mat.color          = new THREE.Color(0x3a0000);
        mat.emissiveIntensity = 1.4;
      }

      child.material = mat;
      child.castShadow    = false;
      child.receiveShadow = false;
    });
    return c;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Vertical float  — smooth sine wave
    groupRef.current.position.y =
      position[1] + Math.sin(t * speed + phase) * 0.18
                  + Math.sin(t * speed * 1.7 + phase + 1.2) * 0.04;

    // Slight horizontal drift
    groupRef.current.position.x =
      position[0] + Math.sin(t * speed * 0.6 + phase + 0.5) * 0.08;

    // Slow spin + subtle tilt
    groupRef.current.rotation.y  = t * speed * 0.25 * rotDir;
    groupRef.current.rotation.z  = Math.sin(t * speed * 0.4 + phase) * 0.06;

    // Pulsing scale — organic breathing
    const pulse = 1 + Math.sin(t * speed * 2.0 + phase) * 0.03;
    groupRef.current.scale.setScalar(scale * pulse);
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive object={cloned} />
    </group>
  );
}

// ── Scene lights ─────────────────────────────────────────────────────────────
function Lights() {
  const light1Ref = useRef();
  const light2Ref = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (light1Ref.current) {
      // First light orbits slowly — creates moving red caustics on model
      light1Ref.current.intensity = 3.5 + Math.sin(t * 0.8) * 0.8;
    }
    if (light2Ref.current) {
      light2Ref.current.intensity = 2.0 + Math.sin(t * 1.1 + 1.5) * 0.5;
    }
  });

  return (
    <>
      <ambientLight intensity={0.05} color="#1a0000" />
      {/* Main red front light */}
      <pointLight ref={light1Ref} position={[0, 1, 2.5]} color="#ff2020" intensity={3.5} distance={8} decay={2} />
      {/* Side fill */}
      <pointLight ref={light2Ref} position={[-2, -0.5, 1.5]} color="#ff0000" intensity={2.0} distance={6} decay={2} />
      {/* Subtle top back rim */}
      <pointLight position={[1, 3, -1]} color="#ff4040" intensity={1.2} distance={5} decay={2} />
    </>
  );
}

// ── Fallback — shown while GLB loads ────────────────────────────────────────
function Fallback() {
  return null; // transparent while loading — no flash
}

// ── Main exported component ──────────────────────────────────────────────────
export default function JellyfishCanvas({ width = 380, height = 500 }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 58 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        dpr={[1, 1.5]}
      >
        <Lights />

        <Suspense fallback={<Fallback />}>
          {/* Large jellyfish — left-centre */}
          <JellyfishInstance
            position={[-0.75, 0.10, 0]}
            scale={1.25}
            speed={0.38}
            phase={0}
            rotDir={1}
          />
          {/* Smaller jellyfish — right, slightly behind */}
          <JellyfishInstance
            position={[0.85, -0.35, -0.8]}
            scale={0.80}
            speed={0.28}
            phase={Math.PI * 1.3}
            rotDir={-1}
          />
        </Suspense>

        {/* Bloom gives the neon red glow effect */}
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.05}
            luminanceSmoothing={0.85}
            intensity={2.4}
            radius={0.7}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
