import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PocketCatRig } from '../engine/catModel3D';
import { type CatAppearance, type PetMood } from '../schemas/cat';

export interface CatStageHandle {
  captureSnapshot: () => string | null;
  resetCamera: () => void;
}

interface CatStage3DProps {
  appearance: CatAppearance;
  mood: PetMood;
  onPetZone?: (zone: 'head' | 'belly' | 'paws' | 'bell') => void;
}

// Pre-allocated math helpers outside render loop (zero GC)
const _ndc = new THREE.Vector2();
const _rayOriginPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hitPoint = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 122);
    grad.addColorStop(0, 'rgba(20, 24, 34, 0.36)');
    grad.addColorStop(0.55, 'rgba(20, 24, 34, 0.14)');
    grad.addColorStop(1, 'rgba(20, 24, 34, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const CatStage3D = forwardRef<CatStageHandle, CatStage3DProps>(
  function CatStage3D({ appearance, mood, onPetZone }, ref) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const [contextLost, setContextLost] = useState(false);

    // Keep mutable props in refs so React UI updates never rebuild the WebGL scene
    const moodRef = useRef<PetMood>(mood);
    moodRef.current = mood;

    const onPetZoneRef = useRef(onPetZone);
    onPetZoneRef.current = onPetZone;

    const rigRef = useRef<PocketCatRig | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const cameraGoalRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);

    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        const renderer = rendererRef.current;
        const scene = sceneRef.current;
        const camera = cameraRef.current;
        if (!renderer || !scene || !camera) return null;
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      },
      resetCamera: () => {
        cameraGoalRef.current = {
          pos: new THREE.Vector3(0.96, 1.06, 1.96),
          target: new THREE.Vector3(0, 0.54, 0.06),
        };
      },
    }));

    // Update appearance textures & morphology without tearing down WebGL context
    useEffect(() => {
      if (rigRef.current) {
        rigRef.current.applyAppearance(appearance);
      }
    }, [appearance]);

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const bgHex = '#E1E5EC';
      scene.background = new THREE.Color(bgHex);
      scene.fog = new THREE.FogExp2(bgHex, 0.075);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
      camera.position.set(0.96, 1.06, 1.96);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.06;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current = renderer;

      container.appendChild(renderer.domElement);

      // Studio Environment Reflection (RoomEnvironment)
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();

      // Sculptural 3-Point Studio Lighting Rig for high-contrast 3D depth
      const hemi = new THREE.HemisphereLight('#DCE8FF', '#B5A898', 0.48);
      scene.add(hemi);

      const keyLight = new THREE.DirectionalLight('#FFF3E0', 2.15);
      keyLight.position.set(2.6, 4.2, 2.8);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(2048, 2048);
      keyLight.shadow.camera.left = -2.0;
      keyLight.shadow.camera.right = 2.0;
      keyLight.shadow.camera.top = 2.0;
      keyLight.shadow.camera.bottom = -2.0;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 12;
      keyLight.shadow.bias = -0.0004;
      keyLight.shadow.normalBias = 0.018;
      keyLight.shadow.radius = 2.5;
      scene.add(keyLight);

      // Strong cool rim light to trace velvety fur sheen halo
      const rimLight = new THREE.DirectionalLight('#CBE0FF', 1.55);
      rimLight.position.set(-2.8, 2.4, -2.6);
      scene.add(rimLight);

      // Subtle warm bounce fill from opposite low angle
      const fillLight = new THREE.DirectionalLight('#FFEAD5', 0.48);
      fillLight.position.set(-2.2, 1.1, 2.2);
      scene.add(fillLight);

      // Studio Ground & Woven Cat Mat Plinth (with Y offsets to prevent Z-fighting)
      const floorGeo = new THREE.CircleGeometry(14, 48);
      floorGeo.rotateX(-Math.PI / 2);
      const floorMat = new THREE.MeshStandardMaterial({
        color: '#D8DDE6',
        roughness: 0.92,
        metalness: 0.0,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      const rugGeo = new THREE.CylinderGeometry(1.16, 1.21, 0.032, 56);
      const rugMat = new THREE.MeshStandardMaterial({
        color: '#F3EFE6',
        roughness: 0.94,
        metalness: 0.0,
      });
      const rugMesh = new THREE.Mesh(rugGeo, rugMat);
      rugMesh.position.y = 0.016;
      rugMesh.receiveShadow = true;
      scene.add(rugMesh);

      const rugRingGeo = new THREE.RingGeometry(1.00, 1.06, 56);
      rugRingGeo.rotateX(-Math.PI / 2);
      const rugRingMat = new THREE.MeshStandardMaterial({
        color: '#CFC8BC',
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const rugRing = new THREE.Mesh(rugRingGeo, rugRingMat);
      rugRing.position.y = 0.034;
      scene.add(rugRing);

      // Grounded Ceramic Cat Bowl Prop (gives spatial depth & material roughness contrast)
      const bowlPoints = [
        new THREE.Vector2(0.001, 0),
        new THREE.Vector2(0.15, 0),
        new THREE.Vector2(0.175, 0.075),
        new THREE.Vector2(0.16, 0.088),
        new THREE.Vector2(0.138, 0.08),
        new THREE.Vector2(0.125, 0.025),
        new THREE.Vector2(0.001, 0.025),
      ];
      const bowlGeo = new THREE.LatheGeometry(bowlPoints, 32);
      const bowlMat = new THREE.MeshPhysicalMaterial({
        color: '#FAFAFA',
        roughness: 0.22,
        metalness: 0.02,
        clearcoat: 0.85,
        clearcoatRoughness: 0.12,
      });
      const bowlMesh = new THREE.Mesh(bowlGeo, bowlMat);
      bowlMesh.position.set(-0.68, 0.032, 0.56);
      bowlMesh.castShadow = true;
      bowlMesh.receiveShadow = true;
      scene.add(bowlMesh);

      const kibbleGeo = new THREE.SphereGeometry(0.11, 20, 12);
      kibbleGeo.scale(1, 0.24, 1);
      const kibbleMat = new THREE.MeshStandardMaterial({
        color: '#8C5832',
        roughness: 0.85,
      });
      const kibbleMesh = new THREE.Mesh(kibbleGeo, kibbleMat);
      kibbleMesh.position.set(-0.68, 0.06, 0.56);
      scene.add(kibbleMesh);

      // Contact Shadow directly under cat
      const shadowTex = createContactShadowTexture();
      const contactGeo = new THREE.PlaneGeometry(1.55, 1.75);
      contactGeo.rotateX(-Math.PI / 2);
      const contactMat = new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
      });
      const contactPlane = new THREE.Mesh(contactGeo, contactMat);
      contactPlane.position.set(0, 0.036, -0.02);
      scene.add(contactPlane);

      // Build Articulated 3D Cat Rig sitting flush on mat (y = 0.032)
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const rig = new PocketCatRig(appearance, maxAniso);
      rig.parts.root.position.y = 0.032;
      scene.add(rig.parts.root);
      rigRef.current = rig;

      // OrbitControls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0.54, 0.06);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.enablePan = false;
      controls.minDistance = 1.45;
      controls.maxDistance = 4.2;
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = Math.PI * 0.485;
      controls.update();
      controlsRef.current = controls;

      const onControlStart = () => {
        cameraGoalRef.current = null;
      };
      controls.addEventListener('start', onControlStart);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // Raycasting for petting & laser pointer
      const raycaster = new THREE.Raycaster();
      raycaster.layers.set(1);
      let pointerDownX = 0;
      let pointerDownY = 0;
      let lastMoveTime = 0;

      const updateNdc = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      };

      const onPointerDown = (e: PointerEvent) => {
        pointerDownX = e.clientX;
        pointerDownY = e.clientY;
      };

      const onPointerMove = (e: PointerEvent) => {
        const now = performance.now();
        if (now - lastMoveTime < 32) return;
        lastMoveTime = now;

        updateNdc(e.clientX, e.clientY);
        rig.setPointerLook(_ndc.x, _ndc.y);

        if (moodRef.current === 'hunting') {
          raycaster.setFromCamera(_ndc, camera);
          if (raycaster.ray.intersectPlane(_rayOriginPlane, _hitPoint)) {
            rig.setLaserPosition(_hitPoint.x, _hitPoint.z);
          }
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const moved = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
        if (moved > 10) return; // Was orbiting camera, not tapping cat

        updateNdc(e.clientX, e.clientY);
        raycaster.setFromCamera(_ndc, camera);
        const hits = raycaster.intersectObjects(rig.parts.hitProxies, false);
        if (hits.length > 0) {
          const zone = (hits[0].object.userData.hitZone as 'head' | 'belly' | 'paws' | 'bell') ?? 'head';
          rig.triggerPetPulse();
          onPetZoneRef.current?.(zone);
        }
      };

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

      const onContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const onContextRestored = () => {
        setContextLost(false);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

      // Resize handler
      const onResize = () => {
        if (!container) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);

      // Animation Loop with Software-WebGL afterDraw pacing
      let frameId = 0;
      let disposed = false;
      const clock = new THREE.Clock();

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function tick() {
        if (disposed) return;
        const dt = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        if (cameraGoalRef.current) {
          const g = cameraGoalRef.current;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, g.pos.x, 7, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, g.pos.y, 7, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, g.pos.z, 7, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, g.target.x, 7, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, g.target.y, 7, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, g.target.z, 7, dt);
          if (camera.position.distanceTo(g.pos) < 0.02) {
            cameraGoalRef.current = null;
          }
        }

        rig.update(dt, elapsed, moodRef.current);
        controls.update();
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('resize', onResize);
        controls.removeEventListener('start', onControlStart);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

        controls.dispose();
        rig.dispose();
        floorGeo.dispose();
        floorMat.dispose();
        rugGeo.dispose();
        rugMat.dispose();
        rugRingGeo.dispose();
        rugRingMat.dispose();
        bowlGeo.dispose();
        bowlMat.dispose();
        kibbleGeo.dispose();
        kibbleMat.dispose();
        contactGeo.dispose();
        contactMat.dispose();
        shadowTex.dispose();
        envTex.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div className="relative h-full w-full select-none overflow-hidden bg-[#E5E8EE]">
        <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
        {contextLost && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#E5E8EE] p-6 text-center">
            <p className="font-display text-lg font-semibold text-slate-900">
              3D 渲染画布正在恢复中
            </p>
            <p className="mt-1 text-sm text-slate-600">
              系统正在重新连接显卡上下文，请稍候片刻。
            </p>
          </div>
        )}
      </div>
    );
  }
);
