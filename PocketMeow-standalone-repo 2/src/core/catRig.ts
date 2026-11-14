import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CatEmotionState, CatProfile } from '../schemas/catSchema';
import { createProceduralFurMaps, ProceduralFurMaps } from './proceduralFurTexture';

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2');
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
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface CatStageController {
  applyProfile: (profile: CatProfile) => void;
  setEmotion: (emotion: CatEmotionState) => void;
  setLaserEnabled: (enabled: boolean) => void;
  setLaserTargetNdc: (ndcX: number, ndcY: number) => void;
  triggerHeadPat: () => void;
  resetCamera: () => void;
  captureSnapshotDataUrl: () => string;
  dispose: () => void;
}

export function mountCatStage(
  container: HTMLElement,
  initialProfile: CatProfile,
  onPetCallback?: () => void
): CatStageController {
  const isSoftwareGl = detectSoftwareGl();

  const width = Math.max(300, container.clientWidth);
  const height = Math.max(300, container.clientHeight);

  const scene = new THREE.Scene();
  const bgColor = new THREE.Color('#E8ECF2');
  scene.background = bgColor;
  scene.fog = new THREE.FogExp2('#E8ECF2', 0.045);

  const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
  camera.position.set(0.35, 1.38, 3.25);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;
  pmremGenerator.dispose();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.72, 0);
  controls.enablePan = false;
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.07;
  controls.minDistance = 2.1;
  controls.maxDistance = 5.0;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.update();

  // Warm / Cool 3-Point Studio Lighting
  const hemiLight = new THREE.HemisphereLight('#F8FAFC', '#CBD5E1', 0.85);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight('#FFF5E8', 2.1);
  keyLight.position.set(2.8, 4.5, 3.2);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    keyLight.shadow.camera.left = -2.2;
    keyLight.shadow.camera.right = 2.2;
    keyLight.shadow.camera.top = 2.2;
    keyLight.shadow.camera.bottom = -2.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#DCEBFF', 1.15);
  rimLight.position.set(-2.5, 2.4, -3.0);
  scene.add(rimLight);

  // Studio Ground & Cushion Mat (y = 0 grounded)
  const floorGeo = new THREE.CircleGeometry(7, 48);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#E2E7EF',
    roughness: 0.92,
    metalness: 0.02,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = !isSoftwareGl;
  scene.add(floorMesh);

  const matGeo = new THREE.CylinderGeometry(0.92, 0.96, 0.032, 48);
  const matMaterial = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.85,
    metalness: 0.04,
  });
  const studioMat = new THREE.Mesh(matGeo, matMaterial);
  studioMat.position.y = 0.016;
  studioMat.receiveShadow = !isSoftwareGl;
  scene.add(studioMat);

  const shadowPlaneTex = createContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({
      map: shadowPlaneTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.034;
  scene.add(shadowPlane);

  // Laser Dot Toy (optional interactive play)
  const laserDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#EF4444' })
  );
  laserDot.visible = false;
  laserDot.position.set(0.45, 0.05, 0.6);
  scene.add(laserDot);

  // =========================================================================
  // Articulated 14-Part Hierarchical Cat Rig (Bottom-Center Grounded Pivot)
  // =========================================================================
  const catRoot = new THREE.Group();
  catRoot.position.y = 0.032; // Rests flush on studio mat
  scene.add(catRoot);

  // Shared Dynamic Materials
  const bodyFurMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.86,
    metalness: 0.02,
  });
  const headFurMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    roughness: 0.84,
    metalness: 0.02,
  });
  const secondaryFurMat = new THREE.MeshStandardMaterial({
    color: '#F3EFE6',
    roughness: 0.88,
    metalness: 0.02,
  });
  const innerEarMat = new THREE.MeshStandardMaterial({
    color: '#F5B5C3',
    roughness: 0.72,
    metalness: 0.0,
  });
  const noseMat = new THREE.MeshStandardMaterial({
    color: '#F4A6B8',
    roughness: 0.42,
    metalness: 0.05,
  });
  const leftIrisMat = new THREE.MeshStandardMaterial({
    color: '#38BDF8',
    roughness: 0.16,
    metalness: 0.1,
  });
  const rightIrisMat = new THREE.MeshStandardMaterial({
    color: '#F59E0B',
    roughness: 0.16,
    metalness: 0.1,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: '#0F172A',
    roughness: 0.08,
    metalness: 0.15,
  });
  const catchlightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const collarRibbonMat = new THREE.MeshStandardMaterial({
    color: '#D97706',
    roughness: 0.52,
    metalness: 0.15,
  });
  const goldBellMat = new THREE.MeshStandardMaterial({
    color: '#FBBF24',
    roughness: 0.18,
    metalness: 0.92,
  });
  const whiskerMat = new THREE.MeshStandardMaterial({
    color: '#F8FAFC',
    roughness: 0.4,
    metalness: 0.05,
  });

  // 1. Torso & Chest Bib
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.42, 0);
  catRoot.add(torsoPivot);

  const torsoGeo = new THREE.SphereGeometry(0.36, 24, 20);
  torsoGeo.scale(0.95, 1.18, 1.08);
  const torsoMesh = new THREE.Mesh(torsoGeo, bodyFurMat);
  torsoMesh.castShadow = !isSoftwareGl;
  torsoMesh.receiveShadow = !isSoftwareGl;
  torsoPivot.add(torsoMesh);

  const chestBibGeo = new THREE.SphereGeometry(0.24, 20, 16);
  chestBibGeo.scale(0.92, 1.08, 0.72);
  const chestBib = new THREE.Mesh(chestBibGeo, secondaryFurMat);
  chestBib.position.set(0, 0.06, 0.2);
  chestBib.castShadow = !isSoftwareGl;
  torsoPivot.add(chestBib);

  // Collar & Gold Bell
  const collarGeo = new THREE.TorusGeometry(0.24, 0.026, 12, 32);
  const collarMesh = new THREE.Mesh(collarGeo, collarRibbonMat);
  collarMesh.rotation.x = Math.PI / 2 + 0.18;
  collarMesh.position.set(0, 0.34, 0.06);
  torsoPivot.add(collarMesh);

  const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), goldBellMat);
  bellMesh.position.set(0, 0.27, 0.29);
  bellMesh.castShadow = !isSoftwareGl;
  torsoPivot.add(bellMesh);

  // 2. Neck & Head Hierarchy
  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 0.42, 0.08);
  torsoPivot.add(neckPivot);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.17, 0.02);
  neckPivot.add(headGroup);

  const skullGeo = new THREE.SphereGeometry(0.32, 26, 22);
  skullGeo.scale(1.1, 0.96, 0.98);
  const skullMesh = new THREE.Mesh(skullGeo, headFurMat);
  skullMesh.castShadow = !isSoftwareGl;
  skullMesh.receiveShadow = !isSoftwareGl;
  headGroup.add(skullMesh);

  // Puffy cheeks / muzzle
  const cheekGeo = new THREE.SphereGeometry(0.088, 16, 14);
  const leftCheek = new THREE.Mesh(cheekGeo, secondaryFurMat);
  leftCheek.position.set(-0.072, -0.058, 0.27);
  leftCheek.scale.set(1.1, 0.85, 0.8);
  headGroup.add(leftCheek);

  const rightCheek = new THREE.Mesh(cheekGeo, secondaryFurMat);
  rightCheek.position.set(0.072, -0.058, 0.27);
  rightCheek.scale.set(1.1, 0.85, 0.8);
  headGroup.add(rightCheek);

  // Nose
  const noseGeo = new THREE.ConeGeometry(0.036, 0.036, 3);
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.position.set(0, -0.015, 0.335);
  noseMesh.rotation.x = Math.PI * 0.55;
  noseMesh.rotation.z = Math.PI;
  headGroup.add(noseMesh);

  // Jaw / Mouth Indicator (animates on meow)
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.092, 0.275);
  headGroup.add(jawPivot);
  const mouthMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.034, 12, 10),
    innerEarMat
  );
  mouthMesh.scale.set(1.1, 0.55, 0.65);
  jawPivot.add(mouthMesh);

  // Whiskers (3 per side)
  const whiskerGeo = new THREE.CylinderGeometry(0.004, 0.002, 0.24, 6);
  [-1, 1].forEach((side) => {
    [-0.14, 0, 0.14].forEach((angle, idx) => {
      const w = new THREE.Mesh(whiskerGeo, whiskerMat);
      w.position.set(side * 0.21, -0.05 + idx * 0.014, 0.24);
      w.rotation.z = Math.PI / 2 + side * angle;
      w.rotation.y = side * -0.22;
      headGroup.add(w);
    });
  });

  // Eyes (Iris, Pupil, Catchlight, Eyelid Blink Pivot)
  const buildEye = (side: -1 | 1, irisMaterial: THREE.MeshStandardMaterial) => {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * 0.132, 0.042, 0.268);
    eyeGroup.rotation.y = side * 0.18;

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.056, 18, 16), irisMaterial);
    iris.scale.set(1, 1.06, 0.55);
    eyeGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 12), pupilMat);
    pupil.position.z = 0.022;
    pupil.scale.set(0.86, 1.15, 0.5);
    eyeGroup.add(pupil);

    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), catchlightMat);
    catchlight.position.set(-0.018, 0.02, 0.036);
    eyeGroup.add(catchlight);

    const eyelid = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      headFurMat
    );
    eyelid.scale.set(1.04, 1.04, 0.65);
    eyelid.rotation.x = -Math.PI * 0.52;
    eyeGroup.add(eyelid);

    headGroup.add(eyeGroup);
    return { eyeGroup, pupil, eyelid };
  };

  const leftEye = buildEye(-1, leftIrisMat);
  const rightEye = buildEye(1, rightIrisMat);

  // Ears (Articulated Pivots supporting Pointed / Folded / Rounded / Tufted)
  const buildEar = (side: -1 | 1) => {
    const earPivot = new THREE.Group();
    earPivot.position.set(side * 0.21, 0.22, -0.02);
    earPivot.rotation.z = side * -0.26;

    const outerGeo = new THREE.ConeGeometry(0.115, 0.22, 4);
    const outerMesh = new THREE.Mesh(outerGeo, headFurMat);
    outerMesh.position.y = 0.1;
    outerMesh.rotation.y = Math.PI / 4;
    outerMesh.castShadow = !isSoftwareGl;
    earPivot.add(outerMesh);

    const innerGeo = new THREE.ConeGeometry(0.068, 0.15, 4);
    const innerMesh = new THREE.Mesh(innerGeo, innerEarMat);
    innerMesh.position.set(0, 0.088, 0.028);
    innerMesh.rotation.y = Math.PI / 4;
    earPivot.add(innerMesh);

    const tuftMesh = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 6), secondaryFurMat);
    tuftMesh.position.set(0, 0.22, 0);
    tuftMesh.visible = false;
    earPivot.add(tuftMesh);

    headGroup.add(earPivot);
    return { earPivot, outerMesh, innerMesh, tuftMesh };
  };

  const leftEar = buildEar(-1);
  const rightEar = buildEar(1);

  // 3. Four Grounded Legs & Paws
  const buildLeg = (x: number, y: number, z: number, heightLen: number, isFront: boolean) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(x, y, z);

    const limbGeo = new THREE.CapsuleGeometry(0.068, heightLen, 8, 12);
    const limb = new THREE.Mesh(limbGeo, bodyFurMat);
    limb.position.y = -heightLen * 0.5;
    limb.castShadow = !isSoftwareGl;
    legPivot.add(limb);

    const pawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), secondaryFurMat);
    pawMesh.scale.set(1.0, 0.65, 1.25);
    pawMesh.position.set(0, -heightLen - 0.02, 0.045);
    pawMesh.castShadow = !isSoftwareGl;
    legPivot.add(pawMesh);

    if (isFront) {
      torsoPivot.add(legPivot);
    } else {
      catRoot.add(legPivot);
    }
    return legPivot;
  };

  const frontLeftLeg = buildLeg(-0.15, -0.08, 0.2, 0.25, true);
  const frontRightLeg = buildLeg(0.15, -0.08, 0.2, 0.25, true);
  const backLeftLeg = buildLeg(-0.22, 0.28, -0.14, 0.2, false);
  const backRightLeg = buildLeg(0.22, 0.28, -0.14, 0.2, false);

  // 4. Articulated 3-Segment Tail
  const tailBasePivot = new THREE.Group();
  tailBasePivot.position.set(0, 0.16, -0.32);
  catRoot.add(tailBasePivot);

  const tailSeg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.22, 8, 10), bodyFurMat);
  tailSeg1.position.set(0, 0.11, -0.08);
  tailSeg1.rotation.x = -0.6;
  tailSeg1.castShadow = !isSoftwareGl;
  tailBasePivot.add(tailSeg1);

  const tailMidPivot = new THREE.Group();
  tailMidPivot.position.set(0, 0.21, -0.16);
  tailBasePivot.add(tailMidPivot);

  const tailSeg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.043, 0.22, 8, 10), bodyFurMat);
  tailSeg2.position.set(0, 0.12, -0.03);
  tailSeg2.rotation.x = -0.25;
  tailSeg2.castShadow = !isSoftwareGl;
  tailMidPivot.add(tailSeg2);

  const tailTipPivot = new THREE.Group();
  tailTipPivot.position.set(0, 0.23, -0.05);
  tailMidPivot.add(tailTipPivot);

  const tailSeg3 = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.16, 8, 10), secondaryFurMat);
  tailSeg3.position.set(0, 0.09, 0.02);
  tailSeg3.rotation.x = 0.22;
  tailSeg3.castShadow = !isSoftwareGl;
  tailTipPivot.add(tailSeg3);

  // =========================================================================
  // Mutable State for Animation Loop (Zero-GC)
  // =========================================================================
  let currentEmotion: CatEmotionState = 'idle';
  let currentProfile: CatProfile = initialProfile;
  let currentFurMaps: ProceduralFurMaps | null = null;
  let patBoostTimer = 0;
  let laserEnabled = false;
  const laserTargetWorld = new THREE.Vector3(0.45, 0.05, 0.8);
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04);

  const applyProfile = (profile: CatProfile) => {
    currentProfile = profile;
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const maps = createProceduralFurMaps(profile, maxAniso);

    if (currentFurMaps) {
      currentFurMaps.bodyMap.dispose();
      currentFurMaps.headMap.dispose();
      currentFurMaps.roughnessMap.dispose();
    }
    currentFurMaps = maps;

    bodyFurMat.map = maps.bodyMap;
    bodyFurMat.roughnessMap = maps.roughnessMap;
    bodyFurMat.needsUpdate = true;

    headFurMat.map = maps.headMap;
    headFurMat.roughnessMap = maps.roughnessMap;
    headFurMat.needsUpdate = true;

    secondaryFurMat.color.set(profile.secondaryColor);
    noseMat.color.set(profile.noseColor);
    leftIrisMat.color.set(profile.leftEyeColor);
    rightIrisMat.color.set(profile.rightEyeColor);

    // Chubbiness morph scaling (x & z plumpness, subtle y squish)
    const c = profile.chubbiness;
    torsoMesh.scale.set(0.95 * c, 1.18 * (2 - c) * 0.52 + 0.56, 1.08 * c);
    chestBib.scale.set(0.92 * c, 1.08, 0.72 * c);
    skullMesh.scale.set(1.06 + (c - 1) * 0.25, 0.96, 0.98 + (c - 1) * 0.16);

    // Ear morphology switch
    [leftEar, rightEar].forEach((ear, idx) => {
      const side = idx === 0 ? -1 : 1;
      ear.tuftMesh.visible = profile.earStyle === 'tufted';
      if (profile.earStyle === 'folded') {
        ear.outerMesh.scale.set(1.05, 0.72, 0.95);
        ear.earPivot.rotation.set(0.55, 0, side * -0.78);
      } else if (profile.earStyle === 'rounded') {
        ear.outerMesh.scale.set(1.18, 0.82, 1.12);
        ear.earPivot.rotation.set(0, 0, side * -0.34);
      } else {
        ear.outerMesh.scale.set(1.0, 1.05, 1.0);
        ear.earPivot.rotation.set(0, 0, side * -0.24);
      }
    });
  };

  applyProfile(initialProfile);

  // Pre-warm shaders when on GPU
  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Click / Tap to Pet Raycasting
  let pointerDownPos = { x: 0, y: 0 };
  const onPointerDown = (e: PointerEvent) => {
    pointerDownPos = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 10) return; // Was dragging OrbitControls, not a tap

    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObject(catRoot, true);
    if (hits.length > 0) {
      patBoostTimer = 2.4;
      onPetCallback?.();
    }
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // Resize observer
  const handleResize = () => {
    const w = Math.max(280, container.clientWidth);
    const h = Math.max(280, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  // Animation Loop (paced safely on Software WebGL)
  const clock = new THREE.Clock();
  let frameId = 0;
  let disposed = false;

  // Kinematic targets
  let headRotX = 0;
  let headRotY = 0;
  let headRotZ = 0;
  let earTwitchOffset = 0;
  let blinkPhase = 0;
  let nextBlinkTime = 2.6;
  let jawOpen = 0;

  const updateCatKinematics = (elapsed: number, delta: number) => {
    if (patBoostTimer > 0) {
      patBoostTimer = Math.max(0, patBoostTimer - delta);
    }
    const effectiveEmotion: CatEmotionState =
      patBoostTimer > 0 && currentEmotion === 'idle' ? 'happy' : currentEmotion;

    // 1. Breathing Torso
    const breathSpeed = effectiveEmotion === 'sleepy' ? 1.4 : effectiveEmotion === 'angry' ? 4.2 : 2.3;
    const breathAmp = effectiveEmotion === 'sleepy' ? 0.032 : 0.018;
    const breath = Math.sin(elapsed * breathSpeed);
    const c = currentProfile.chubbiness;
    torsoMesh.scale.x = 0.95 * c + breath * breathAmp;
    torsoMesh.scale.z = 1.08 * c + breath * breathAmp;
    torsoPivot.position.y = 0.42 + breath * 0.008;

    // 2. Blinking & Eyelids
    if (elapsed > nextBlinkTime) {
      blinkPhase = 1;
      nextBlinkTime = elapsed + 2.5 + ((elapsed * 13.7) % 3.2);
    }
    blinkPhase = Math.max(0, blinkPhase - delta * 6.5);
    const blinkAmount = Math.sin(blinkPhase * Math.PI);

    let targetEyelidRot = -Math.PI * 0.52;
    let targetPupilScale = 1.0;

    if (effectiveEmotion === 'sleepy') {
      targetEyelidRot = -0.15;
      targetPupilScale = 0.75;
    } else if (effectiveEmotion === 'happy') {
      targetEyelidRot = -0.25 - blinkAmount * 0.5;
      targetPupilScale = 1.28;
    } else if (effectiveEmotion === 'listening') {
      targetEyelidRot = -Math.PI * 0.56 + blinkAmount * 0.85;
      targetPupilScale = 1.38;
    } else if (effectiveEmotion === 'angry') {
      targetEyelidRot = -0.35;
      targetPupilScale = 0.58;
    } else {
      targetEyelidRot = -Math.PI * 0.52 + blinkAmount * 1.1;
      targetPupilScale = 1.0;
    }

    const dampedPupil = THREE.MathUtils.damp(leftEye.pupil.scale.x, targetPupilScale, 8, delta);
    leftEye.pupil.scale.set(dampedPupil * 0.86, dampedPupil * 1.15, 0.5);
    rightEye.pupil.scale.set(dampedPupil * 0.86, dampedPupil * 1.15, 0.5);
    leftEye.eyelid.rotation.x = THREE.MathUtils.damp(leftEye.eyelid.rotation.x, targetEyelidRot, 14, delta);
    rightEye.eyelid.rotation.x = THREE.MathUtils.damp(rightEye.eyelid.rotation.x, targetEyelidRot, 14, delta);

    // 3. Head Emotion Targets & Laser Dot Tracking
    let tHeadX = Math.sin(elapsed * 0.9) * 0.04;
    let tHeadY = Math.sin(elapsed * 0.55) * 0.08;
    let tHeadZ = 0;
    let tJaw = 0;

    if (laserEnabled) {
      _vec3A.copy(laserTargetWorld);
      headGroup.worldToLocal(_vec3B.copy(_vec3A));
      tHeadY = THREE.MathUtils.clamp(Math.atan2(_vec3B.x, _vec3B.z) * 0.65, -0.55, 0.55);
      tHeadX = THREE.MathUtils.clamp(-_vec3B.y * 0.25 + 0.25, -0.2, 0.45);
      tHeadZ = Math.sin(elapsed * 4) * 0.04;
    } else {
      switch (effectiveEmotion) {
        case 'listening':
          // 录音倾听：竖耳朵 + 歪头好奇
          tHeadX = -0.1;
          tHeadY = Math.sin(elapsed * 1.8) * 0.06;
          tHeadZ = 0.28 + Math.sin(elapsed * 2.4) * 0.04;
          break;
        case 'happy':
          // 开心撒娇 / 踩奶
          tHeadX = 0.05 + Math.sin(elapsed * 5.2) * 0.04;
          tHeadY = Math.sin(elapsed * 2.5) * 0.18;
          tHeadZ = Math.sin(elapsed * 2.5) * 0.12;
          tJaw = 0.22 + Math.max(0, Math.sin(elapsed * 5)) * 0.18;
          break;
        case 'proud':
          // 傲娇转头：下巴抬高，缓慢侧撇头
          tHeadX = -0.18;
          tHeadY = -0.38 + Math.sin(elapsed * 0.7) * 0.05;
          tHeadZ = -0.08;
          break;
        case 'sleepy':
          tHeadX = 0.22 + Math.sin(elapsed * 1.2) * 0.06;
          tHeadY = Math.sin(elapsed * 0.4) * 0.04;
          tHeadZ = 0.1;
          break;
        case 'angry':
          // 哈气炸毛
          tHeadX = 0.14;
          tHeadY = Math.sin(elapsed * 8) * 0.04;
          tHeadZ = 0;
          tJaw = 0.48;
          break;
        case 'hungry':
          tHeadX = -0.22;
          tHeadY = Math.sin(elapsed * 3) * 0.09;
          tJaw = Math.max(0, Math.sin(elapsed * 4.5)) * 0.35;
          break;
        default:
          break;
      }
    }

    headRotX = THREE.MathUtils.damp(headRotX, tHeadX, 6.5, delta);
    headRotY = THREE.MathUtils.damp(headRotY, tHeadY, 6.5, delta);
    headRotZ = THREE.MathUtils.damp(headRotZ, tHeadZ, 6.5, delta);
    headGroup.rotation.set(headRotX, headRotY, headRotZ);

    jawOpen = THREE.MathUtils.damp(jawOpen, tJaw, 10, delta);
    jawPivot.position.y = -0.092 - jawOpen * 0.018;
    mouthMesh.scale.y = 0.45 + jawOpen * 0.9;

    // 4. Ear Reactions (Listening Perk vs Angry Airplane Ears)
    const baseEarZ =
      currentProfile.earStyle === 'folded'
        ? 0.78
        : currentProfile.earStyle === 'rounded'
        ? 0.34
        : 0.24;
    let targetEarX = 0;
    let targetEarZOffset = 0;
    if (effectiveEmotion === 'listening') {
      targetEarX = -0.18;
      targetEarZOffset = -0.09;
      earTwitchOffset = Math.sin(elapsed * 9) * 0.03;
    } else if (effectiveEmotion === 'angry') {
      targetEarX = 0.24;
      targetEarZOffset = 0.46; // 飞机耳
      earTwitchOffset = 0;
    } else {
      earTwitchOffset = Math.sin(elapsed * 7.5) > 0.96 ? 0.12 : 0;
    }

    leftEar.earPivot.rotation.x = THREE.MathUtils.damp(leftEar.earPivot.rotation.x, targetEarX + earTwitchOffset, 10, delta);
    rightEar.earPivot.rotation.x = THREE.MathUtils.damp(rightEar.earPivot.rotation.x, targetEarX, 10, delta);
    leftEar.earPivot.rotation.z = THREE.MathUtils.damp(leftEar.earPivot.rotation.z, baseEarZ + targetEarZOffset, 10, delta);
    rightEar.earPivot.rotation.z = THREE.MathUtils.damp(rightEar.earPivot.rotation.z, -(baseEarZ + targetEarZOffset), 10, delta);

    // 5. Front Paw Kneading (踩奶) in Happy / Hungry mode
    if (effectiveEmotion === 'happy') {
      const kL = Math.max(0, Math.sin(elapsed * 6.0));
      const kR = Math.max(0, Math.sin(elapsed * 6.0 + Math.PI));
      frontLeftLeg.rotation.x = THREE.MathUtils.damp(frontLeftLeg.rotation.x, -0.38 * kL, 12, delta);
      frontRightLeg.rotation.x = THREE.MathUtils.damp(frontRightLeg.rotation.x, -0.38 * kR, 12, delta);
    } else if (effectiveEmotion === 'hungry') {
      frontRightLeg.rotation.x = THREE.MathUtils.damp(
        frontRightLeg.rotation.x,
        -0.35 * Math.max(0, Math.sin(elapsed * 5)),
        12,
        delta
      );
      frontLeftLeg.rotation.x = THREE.MathUtils.damp(frontLeftLeg.rotation.x, 0, 10, delta);
    } else {
      frontLeftLeg.rotation.x = THREE.MathUtils.damp(frontLeftLeg.rotation.x, 0, 8, delta);
      frontRightLeg.rotation.x = THREE.MathUtils.damp(frontRightLeg.rotation.x, 0, 8, delta);
    }

    // 6. Articulated 3-Segment Tail S-Curve
    const tailFreq =
      effectiveEmotion === 'happy'
        ? 3.8
        : effectiveEmotion === 'angry'
        ? 7.5
        : effectiveEmotion === 'listening'
        ? 0.9
        : 1.65;
    const tailAmp =
      effectiveEmotion === 'listening'
        ? 0.08
        : effectiveEmotion === 'angry'
        ? 0.55
        : effectiveEmotion === 'happy'
        ? 0.34
        : 0.24;

    tailBasePivot.rotation.z = Math.sin(elapsed * tailFreq) * tailAmp;
    tailMidPivot.rotation.z = Math.sin(elapsed * tailFreq - 0.8) * (tailAmp * 1.15);
    tailTipPivot.rotation.z = Math.sin(elapsed * tailFreq - 1.6) * (tailAmp * 1.3);
    tailBasePivot.rotation.x =
      effectiveEmotion === 'happy'
        ? 0.24
        : effectiveEmotion === 'angry'
        ? -0.25
        : 0;

    // Keep unused back legs subtly settled
    backLeftLeg.rotation.y = 0.06;
    backRightLeg.rotation.y = -0.06;

    if (laserEnabled) {
      laserDot.visible = true;
      laserDot.position.x = THREE.MathUtils.damp(laserDot.position.x, laserTargetWorld.x, 16, delta);
      laserDot.position.z = THREE.MathUtils.damp(laserDot.position.z, laserTargetWorld.z, 16, delta);
      laserDot.position.y = 0.048;
    } else {
      laserDot.visible = false;
    }
  };

  const afterDraw = (cb: () => void) => {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  };

  const tick = () => {
    if (disposed) return;
    const delta = Math.min(clock.getDelta(), 0.08);
    const elapsed = clock.getElapsedTime();
    updateCatKinematics(elapsed, delta);
    controls.update();
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  };

  if (isSoftwareGl) {
    tick();
  } else {
    frameId = requestAnimationFrame(tick);
  }

  return {
    applyProfile,
    setEmotion: (emotion: CatEmotionState) => {
      currentEmotion = emotion;
    },
    setLaserEnabled: (enabled: boolean) => {
      laserEnabled = enabled;
    },
    setLaserTargetNdc: (ndcX: number, ndcY: number) => {
      pointerNdc.set(ndcX, ndcY);
      raycaster.setFromCamera(pointerNdc, camera);
      const hit = raycaster.ray.intersectPlane(floorPlane, _vec3A);
      if (hit) {
        laserTargetWorld.x = THREE.MathUtils.clamp(hit.x, -0.85, 0.85);
        laserTargetWorld.z = THREE.MathUtils.clamp(hit.z, -0.6, 0.9);
      }
    },
    triggerHeadPat: () => {
      patBoostTimer = 2.4;
    },
    resetCamera: () => {
      camera.position.set(0.35, 1.38, 3.25);
      controls.target.set(0, 0.72, 0);
      controls.update();
    },
    captureSnapshotDataUrl: () => {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      envTexture.dispose();
      shadowPlaneTex.dispose();
      if (currentFurMaps) {
        currentFurMaps.bodyMap.dispose();
        currentFurMaps.headMap.dispose();
        currentFurMaps.roughnessMap.dispose();
      }
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      renderer.dispose();
    },
  };
}
