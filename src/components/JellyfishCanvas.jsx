import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const MODEL_URL = (process.env.PUBLIC_URL || '.') + '/axolotl.glb';

const INSTANCES = [
  { x: -0.55, y:  0.05, z:  0.00, scale: 1.10, speed: 0.32, phase: 0,             rotDir:  1 },
  { x:  0.70, y: -0.28, z: -0.60, scale: 0.72, speed: 0.24, phase: Math.PI * 1.3, rotDir: -1 },
];

export default function JellyfishCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(58, mount.clientWidth / mount.clientHeight, 0.1, 50);
    camera.position.set(0, 0, 4.2);

    scene.add(new THREE.AmbientLight(0x1a0510, 0.6));

    const light1 = new THREE.PointLight(0xff69b4, 4.5, 9, 2);
    light1.position.set(0, 1, 2.5);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xff1493, 2.8, 7, 2);
    light2.position.set(-2, -0.5, 1.5);
    scene.add(light2);

    const light3 = new THREE.PointLight(0xffb6c1, 2.0, 6, 2);
    light3.position.set(1.5, 2.5, -1);
    scene.add(light3);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(mount.clientWidth, mount.clientHeight),
      2.2,
      0.70,
      0.02
    );
    composer.addPass(bloom);

    const groups = [];
    let raf;
    const clock = new THREE.Clock();

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        INSTANCES.forEach((cfg) => {
          const group = new THREE.Group();
          group.position.set(cfg.x, cfg.y, cfg.z);
          group.scale.setScalar(cfg.scale);

          const clone = gltf.scene.clone(true);

          clone.traverse((child) => {
            if (!child.isMesh) return;
            child.material = new THREE.MeshStandardMaterial({
              color:             new THREE.Color(0x2d0a1a),
              emissive:          new THREE.Color(0xff69b4),
              emissiveIntensity: 2.2,
              transparent:       true,
              opacity:           0.92,
              roughness:         0.30,
              metalness:         0.05,
              side:              THREE.DoubleSide,
            });
          });

          group.add(clone);
          scene.add(group);
          groups.push({ group, cfg });
        });
      },
      undefined,
      (err) => console.warn('[AxolotlCanvas] GLB load error:', err)
    );

    function animate() {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      light1.intensity = 4.5 + Math.sin(t * 0.9)  * 0.9;
      light2.intensity = 2.8 + Math.sin(t * 1.2 + 1.5) * 0.6;

      groups.forEach(({ group, cfg }) => {
        group.position.y = cfg.y
          + Math.sin(t * cfg.speed + cfg.phase) * 0.15
          + Math.sin(t * cfg.speed * 1.7 + cfg.phase + 1.2) * 0.04;

        group.position.x = cfg.x
          + Math.sin(t * cfg.speed * 0.6 + cfg.phase + 0.5) * 0.06;

        group.rotation.y = t * cfg.speed * 0.20 * cfg.rotDir;
        group.rotation.z = Math.sin(t * cfg.speed * 0.4 + cfg.phase) * 0.05;

        const pulse = 1 + Math.sin(t * cfg.speed * 2.0 + cfg.phase) * 0.022;
        group.scale.setScalar(cfg.scale * pulse);
      });

      composer.render();
    }

    animate();

    return () => {
      cancelAnimationFrame(raf);
      composer.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      groups.forEach(({ group }) => {
        group.traverse((child) => {
          if (child.isMesh) {
            child.geometry?.dispose();
            child.material?.dispose();
          }
        });
      });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
