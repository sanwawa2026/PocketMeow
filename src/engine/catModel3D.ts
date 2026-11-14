import * as THREE from 'three';
import { type CatAppearance, type PetMood } from '../schemas/cat';
import { type CatTextureBundle, generateCatTextures } from './catTextureGenerator';

const FUR_SHELL_COUNT = 5;

export interface CatRigParts {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torsoMesh: THREE.Mesh;
  chestFluff: THREE.Mesh;
  neckPivot: THREE.Group;
  headGroup: THREE.Group;
  headMesh: THREE.Mesh;
  jawMesh: THREE.Mesh;
  noseMesh: THREE.Mesh;
  leftEarPivot: THREE.Group;
  rightEarPivot: THREE.Group;
  leftEarTuft: THREE.Mesh;
  rightEarTuft: THREE.Mesh;
  leftIris: THREE.Mesh;
  rightIris: THREE.Mesh;
  leftPupil: THREE.Mesh;
  rightPupil: THREE.Mesh;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
  collarMesh: THREE.Mesh;
  bellMesh: THREE.Mesh;
  frontLeftLeg: THREE.Group;
  frontRightLeg: THREE.Group;
  backLeftLeg: THREE.Group;
  backRightLeg: THREE.Group;
  tailSegments: THREE.Group[];
  laserDot: THREE.Mesh;
  hitProxies: THREE.Object3D[];
}

/**
 * Inflates a geometry smoothly along its vertex normals with slight downward fur gravity droop
 * for concentric Shell-Textured 3D Fur rendering.
 */
function createFurShellGeometry(
  sourceGeo: THREE.BufferGeometry,
  offset: number,
  gravityDroop: number
): THREE.BufferGeometry {
  const geo = sourceGeo.clone();
  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    pos.setXYZ(
      i,
      pos.getX(i) + nx * offset,
      pos.getY(i) + ny * offset - gravityDroop,
      pos.getZ(i) + nz * offset
    );
  }
  pos.needsUpdate = true;
  return geo;
}

/**
 * High-resolution 64x48 seamless sculpted feline head with cheek ruffs, brow arch, muzzle bridge, and chin
 */
function createSculptedHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.305, 64, 48, -Math.PI / 2, Math.PI * 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Fluffy side cheek ruffs
    const cheekBand = Math.exp(-Math.pow((y + 0.055) / 0.115, 2));
    x *= 1.12 + 0.16 * cheekBand;

    // Gentle cranial dome
    y *= 0.92;

    if (z > 0.05) {
      // Soft brow arch
      const brow =
        Math.exp(-Math.pow((y - 0.085) / 0.075, 2)) *
        Math.exp(-Math.pow(x / 0.19, 2));
      z += brow * 0.028;

      // Smooth continuous feline muzzle & whisker pads (no glued spheres!)
      const muzzle =
        Math.exp(-Math.pow((y + 0.068) / 0.085, 2)) *
        Math.exp(-Math.pow(x / 0.115, 2));
      z += muzzle * 0.078;

      // Twin subtle whisker pad puffs on left/right of muzzle
      const padL = Math.exp(-Math.pow((x + 0.055) / 0.048, 2)) * Math.exp(-Math.pow((y + 0.08) / 0.045, 2));
      const padR = Math.exp(-Math.pow((x - 0.055) / 0.048, 2)) * Math.exp(-Math.pow((y + 0.08) / 0.045, 2));
      z += (padL + padR) * 0.022;

      // Subtle eye socket recesses so eyes sit naturally inside the skull
      const socketL = Math.exp(-Math.pow((x + 0.12) / 0.052, 2)) * Math.exp(-Math.pow((y - 0.032) / 0.048, 2));
      const socketR = Math.exp(-Math.pow((x - 0.12) / 0.052, 2)) * Math.exp(-Math.pow((y - 0.032) / 0.048, 2));
      z -= (socketL + socketR) * 0.018;
    }

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * 64-sample smooth spline Lathe torso (zero polygonal ring facets!)
 */
function createSculptedTorsoGeometry(): THREE.BufferGeometry {
  const spline = new THREE.SplineCurve([
    new THREE.Vector2(0.002, -0.43),
    new THREE.Vector2(0.16, -0.40),
    new THREE.Vector2(0.245, -0.30),
    new THREE.Vector2(0.258, -0.16),
    new THREE.Vector2(0.236, -0.01),
    new THREE.Vector2(0.252, 0.15),
    new THREE.Vector2(0.244, 0.28),
    new THREE.Vector2(0.168, 0.38),
    new THREE.Vector2(0.002, 0.42),
  ]);

  const smoothPts = spline.getPoints(64);
  const geo = new THREE.LatheGeometry(smoothPts, 52, Math.PI * 0.5, Math.PI * 2);
  geo.rotateX(Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);

    x *= 0.90;
    // Natural feline spine curve & soft belly fullness
    const spineArch = Math.sin(((z + 0.43) / 0.85) * Math.PI) * 0.025;
    const bellyDrop = y < 0 ? Math.sin(((z + 0.43) / 0.85) * Math.PI) * -0.022 : 0;
    y = y * 1.03 + spineArch + bellyDrop;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth organic cat ear shell sculpted from subdivided cone-arc (curls back slightly, cupped in front)
 */
function createOrganicEarGeometry(): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.115, 0.25, 28, 12);
  geo.translate(0, 0.115, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const hRatio = THREE.MathUtils.clamp(y / 0.24, 0, 1);
    // Flatten front-to-back & slightly cup front surface
    z *= 0.52;
    if (z > 0) {
      z -= Math.exp(-Math.pow(x / 0.06, 2)) * (1 - hRatio) * 0.032;
    }
    // Round the pointed tip softly
    x *= 1 - 0.15 * Math.pow(hRatio, 2);
    // Slight natural backward curve at ear tip
    z -= Math.pow(hRatio, 2) * 0.022;

    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth tapered organic leg limb using SplineCurve Lathe (no straight cylinder seam!)
 */
function createOrganicLimbGeometry(topRadius: number, midRadius: number, pawRadius: number, length: number): THREE.BufferGeometry {
  const spline = new THREE.SplineCurve([
    new THREE.Vector2(0.002, 0),
    new THREE.Vector2(topRadius * 0.85, -0.02),
    new THREE.Vector2(topRadius, -length * 0.18),
    new THREE.Vector2(midRadius, -length * 0.55),
    new THREE.Vector2(pawRadius * 0.92, -length * 0.88),
    new THREE.Vector2(pawRadius, -length * 0.97),
    new THREE.Vector2(0.002, -length),
  ]);
  const pts = spline.getPoints(28);
  return new THREE.LatheGeometry(pts, 28, Math.PI, Math.PI * 2);
}

function createSculptedNoseGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.018);
  shape.quadraticCurveTo(0.026, -0.003, 0.028, 0.014);
  shape.quadraticCurveTo(0, 0.024, -0.028, 0.014);
  shape.quadraticCurveTo(-0.026, -0.003, 0, -0.018);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.007,
    bevelThickness: 0.007,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export class PocketCatRig {
  public readonly parts: CatRigParts;
  private textures: CatTextureBundle | null = null;
  private headMaterial: THREE.MeshPhysicalMaterial;
  private bodyMaterial: THREE.MeshPhysicalMaterial;
  private tailMaterial: THREE.MeshPhysicalMaterial;
  private pawMaterial: THREE.MeshPhysicalMaterial;
  private headShellMaterials: THREE.MeshPhysicalMaterial[] = [];
  private bodyShellMaterials: THREE.MeshPhysicalMaterial[] = [];
  private tailShellMaterials: THREE.MeshPhysicalMaterial[] = [];
  private earInnerMaterial: THREE.MeshStandardMaterial;
  private noseMaterial: THREE.MeshPhysicalMaterial;
  private collarMaterial: THREE.MeshStandardMaterial;
  private leftIrisMaterial: THREE.MeshStandardMaterial;
  private rightIrisMaterial: THREE.MeshStandardMaterial;
  private appearance: CatAppearance;

  private blinkTimer = 2.4;
  private blinkAmount = 0;
  private petPulse = 0;
  private pointerLook = new THREE.Vector2(0, 0);
  private laserPos = new THREE.Vector3(0.45, 0.025, 0.85);
  private maxAnisotropy: number;

  constructor(initialAppearance: CatAppearance, maxAnisotropy = 4) {
    this.appearance = initialAppearance;
    this.maxAnisotropy = maxAnisotropy;

    this.headMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.9,
      metalness: 0.0,
      sheen: 0.92,
      sheenRoughness: 0.65,
    });
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.94,
      sheenRoughness: 0.68,
    });
    this.tailMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.9,
      metalness: 0.0,
      sheen: 0.95,
      sheenRoughness: 0.62,
    });
    this.pawMaterial = new THREE.MeshPhysicalMaterial({
      roughness: 0.9,
      metalness: 0.0,
      sheen: 0.84,
      sheenRoughness: 0.68,
    });

    for (let l = 0; l < FUR_SHELL_COUNT; l++) {
      const alphaCutout = 0.24 + l * 0.075;
      const makeShellMat = () =>
        new THREE.MeshPhysicalMaterial({
          roughness: 0.94,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.55,
          alphaTest: alphaCutout,
          side: THREE.FrontSide,
        });
      this.headShellMaterials.push(makeShellMat());
      this.bodyShellMaterials.push(makeShellMat());
      this.tailShellMaterials.push(makeShellMat());
    }

    this.earInnerMaterial = new THREE.MeshStandardMaterial({
      color: '#F2A7B4',
      roughness: 0.78,
      metalness: 0.0,
    });
    this.noseMaterial = new THREE.MeshPhysicalMaterial({
      color: initialAppearance.noseColor,
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
    });
    this.collarMaterial = new THREE.MeshStandardMaterial({
      color: initialAppearance.collarColor,
      roughness: 0.44,
      metalness: 0.08,
    });
    this.leftIrisMaterial = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.16,
      metalness: 0.02,
    });
    this.rightIrisMaterial = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.16,
      metalness: 0.02,
    });

    this.parts = this.buildRig();
    this.applyAppearance(initialAppearance);
  }

  private attachFurShells(
    parent: THREE.Object3D,
    baseGeo: THREE.BufferGeometry,
    shellMats: THREE.MeshPhysicalMaterial[],
    maxThickness: number,
    droopFactor: number
  ): void {
    for (let l = 0; l < FUR_SHELL_COUNT; l++) {
      const t = (l + 1) / FUR_SHELL_COUNT;
      const shellGeo = createFurShellGeometry(
        baseGeo,
        maxThickness * t,
        droopFactor * t
      );
      const shellMesh = new THREE.Mesh(shellGeo, shellMats[l]);
      shellMesh.castShadow = false;
      shellMesh.receiveShadow = true;
      parent.add(shellMesh);
    }
  }

  private buildRig(): CatRigParts {
    const root = new THREE.Group();
    const hitProxies: THREE.Object3D[] = [];

    // Grounded natural quadruped pivot (paws sit flush at y = 0)
    const bodyPivot = new THREE.Group();
    bodyPivot.position.set(0, 0.47, -0.04);
    root.add(bodyPivot);

    // 1) Smooth 64-ring Organic Torso + 5 Fur Shells
    const torsoGeo = createSculptedTorsoGeometry();
    const torsoMesh = new THREE.Mesh(torsoGeo, this.bodyMaterial);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    torsoMesh.userData.hitZone = 'belly';
    torsoMesh.layers.enable(1);
    hitProxies.push(torsoMesh);
    bodyPivot.add(torsoMesh);
    this.attachFurShells(torsoMesh, torsoGeo, this.bodyShellMaterials, 0.032, 0.009);

    // 2) Fluffy Chest Ruff + Fur Shells
    const fluffGeo = new THREE.SphereGeometry(0.195, 32, 24, -Math.PI / 2, Math.PI * 2);
    fluffGeo.scale(0.96, 1.08, 0.72);
    const chestFluff = new THREE.Mesh(fluffGeo, this.bodyMaterial);
    chestFluff.position.set(0, 0.02, 0.33);
    chestFluff.castShadow = true;
    bodyPivot.add(chestFluff);
    this.attachFurShells(chestFluff, fluffGeo, this.bodyShellMaterials, 0.030, 0.008);

    // 3) Neck Pivot & Collar + Brass Bell
    const neckPivot = new THREE.Group();
    neckPivot.position.set(0, 0.13, 0.30);
    bodyPivot.add(neckPivot);

    const neckGeo = new THREE.CylinderGeometry(0.145, 0.185, 0.16, 28);
    const neckMesh = new THREE.Mesh(neckGeo, this.bodyMaterial);
    neckMesh.position.set(0, 0.04, 0.02);
    neckMesh.rotation.x = 0.25;
    neckMesh.castShadow = true;
    neckPivot.add(neckMesh);
    this.attachFurShells(neckMesh, neckGeo, this.bodyShellMaterials, 0.024, 0.005);

    const collarGeo = new THREE.TorusGeometry(0.172, 0.024, 16, 42);
    collarGeo.rotateX(Math.PI / 2 + 0.24);
    const collarMesh = new THREE.Mesh(collarGeo, this.collarMaterial);
    collarMesh.position.set(0, 0.015, 0.035);
    collarMesh.castShadow = true;
    neckPivot.add(collarMesh);

    const bellMat = new THREE.MeshStandardMaterial({
      color: '#F6CA5A',
      metalness: 0.94,
      roughness: 0.16,
    });
    const bellLoop = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0045, 8, 16), bellMat);
    bellLoop.position.set(0, -0.02, 0.212);
    neckPivot.add(bellLoop);

    const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.044, 22, 18), bellMat);
    bellMesh.position.set(0, -0.056, 0.22);
    bellMesh.castShadow = true;
    bellMesh.userData.hitZone = 'bell';
    bellMesh.layers.enable(1);
    hitProxies.push(bellMesh);
    neckPivot.add(bellMesh);

    // 4) Seamless Sculpted Feline Head + 5 Fluffy Fur Shells
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.24, 0.075);
    neckPivot.add(headGroup);

    const headGeo = createSculptedHeadGeometry();
    const headMesh = new THREE.Mesh(headGeo, this.headMaterial);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    headMesh.userData.hitZone = 'head';
    headMesh.layers.enable(1);
    hitProxies.push(headMesh);
    headGroup.add(headMesh);
    this.attachFurShells(headMesh, headGeo, this.headShellMaterials, 0.028, 0.006);

    // Jaw (subtle chin for yawning)
    const jawGeo = new THREE.SphereGeometry(0.052, 20, 14, -Math.PI / 2, Math.PI * 2);
    jawGeo.scale(1.12, 0.58, 0.85);
    const jawMesh = new THREE.Mesh(jawGeo, this.headMaterial);
    jawMesh.position.set(0, -0.118, 0.255);
    headGroup.add(jawMesh);

    // Sculpted Nose sitting snugly on muzzle bridge
    const noseGeo = createSculptedNoseGeometry();
    const noseMesh = new THREE.Mesh(noseGeo, this.noseMaterial);
    noseMesh.position.set(0, -0.032, 0.348);
    noseMesh.rotation.x = 0.15;
    noseMesh.castShadow = true;
    headGroup.add(noseMesh);

    // Soft curved feline whiskers
    const whiskerMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      roughness: 0.32,
      metalness: 0.04,
      transparent: true,
      opacity: 0.88,
    });
    for (const side of [-1, 1]) {
      for (const row of [-1, 0, 1]) {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(side * 0.08, -0.068 + row * 0.016, 0.315),
          new THREE.Vector3(side * 0.20, -0.062 + row * 0.022, 0.305),
          new THREE.Vector3(side * 0.31, -0.085 + row * 0.032, 0.255)
        );
        const wGeo = new THREE.TubeGeometry(curve, 8, 0.0022, 6, false);
        headGroup.add(new THREE.Mesh(wGeo, whiskerMat));
      }
    }

    // 5) Organic Cupped Ears + Inner Ear Furnishing Tufts + Fur Shells
    const earGeo = createOrganicEarGeometry();
    const buildEar = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.195, 0.175, -0.015);
      pivot.rotation.z = side * -0.32;
      pivot.rotation.x = 0.14;
      pivot.rotation.y = side * 0.22;
      headGroup.add(pivot);

      const outerMesh = new THREE.Mesh(earGeo, this.headMaterial);
      outerMesh.castShadow = true;
      outerMesh.receiveShadow = true;
      pivot.add(outerMesh);
      this.attachFurShells(outerMesh, earGeo, this.headShellMaterials, 0.018, 0.002);

      // Soft recessed pink inner ear
      const innerGeo = new THREE.ConeGeometry(0.065, 0.155, 20);
      innerGeo.translate(0, 0.088, 0);
      const innerMesh = new THREE.Mesh(innerGeo, this.earInnerMaterial);
      innerMesh.scale.set(1, 1, 0.18);
      innerMesh.position.set(0, 0.02, 0.024);
      pivot.add(innerMesh);

      // Fluffy white inner ear furnishing wisps
      const earFluffGeo = new THREE.ConeGeometry(0.025, 0.085, 10);
      earFluffGeo.translate(0, 0.04, 0);
      const earFluff = new THREE.Mesh(earFluffGeo, this.headMaterial);
      earFluff.position.set(side * -0.02, 0.035, 0.035);
      earFluff.rotation.z = side * -0.55;
      pivot.add(earFluff);

      const tuftGeo = new THREE.ConeGeometry(0.022, 0.085, 10);
      tuftGeo.translate(0, 0.23, -0.015);
      const tuftMesh = new THREE.Mesh(tuftGeo, this.headMaterial);
      tuftMesh.visible = false;
      pivot.add(tuftMesh);

      return { pivot, tuftMesh };
    };

    const leftEar = buildEar(-1);
    const rightEar = buildEar(1);

    // 6) Realistic Multi-Layer Feline Eyes (Sclera + Fibrous Iris Texture + Vertical Slit Pupil + Glossy Cornea + Organic Eyelid)
    const scleraMat = new THREE.MeshStandardMaterial({
      color: '#F5F4F0',
      roughness: 0.18,
      metalness: 0.0,
    });
    const pupilMat = new THREE.MeshStandardMaterial({
      color: '#0A0B10',
      roughness: 0.05,
      metalness: 0.02,
    });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: '#FFFFFF',
      roughness: 0.03,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const catchlightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

    const buildEye = (side: -1 | 1, irisMat: THREE.MeshStandardMaterial) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(side * 0.122, 0.038, 0.252);
      eyeGroup.rotation.y = side * 0.25;
      headGroup.add(eyeGroup);

      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.060, 26, 20), scleraMat);
      sclera.scale.set(1, 1.02, 0.56);
      eyeGroup.add(sclera);

      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.053, 26, 20, -Math.PI / 2, Math.PI * 2),
        irisMat
      );
      iris.scale.set(1, 1.02, 0.50);
      iris.position.set(0, 0, 0.013);
      eyeGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 18, 16), pupilMat);
      pupil.scale.set(0.55, 1.18, 0.45);
      pupil.position.set(0, 0, 0.026);
      eyeGroup.add(pupil);

      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 18), corneaMat);
      cornea.scale.set(1.01, 1.03, 0.62);
      cornea.position.set(0, 0, 0.008);
      cornea.renderOrder = 2;
      eyeGroup.add(cornea);

      const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), catchlightMat);
      catchlight.position.set(0.016, 0.018, 0.038);
      eyeGroup.add(catchlight);

      const lidGeo = new THREE.SphereGeometry(0.065, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
      const eyelid = new THREE.Mesh(lidGeo, this.headMaterial);
      eyelid.scale.set(1.03, 1.04, 0.64);
      eyelid.rotation.x = -Math.PI * 0.46;
      eyelid.position.set(0, 0.008, 0.006);
      eyeGroup.add(eyelid);

      return { iris, pupil, eyelid };
    };

    const leftEye = buildEye(-1, this.leftIrisMaterial);
    const rightEye = buildEye(1, this.rightIrisMaterial);

    // 7) Plush Sculpted Quadruped Legs (Blending smoothly into shoulders/haunches + Fluffy Paws)
    const frontLimbGeo = createOrganicLimbGeometry(0.088, 0.062, 0.058, 0.34);
    const buildFrontLeg = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.135, -0.09, 0.24);
      bodyPivot.add(pivot);

      const limb = new THREE.Mesh(frontLimbGeo, this.pawMaterial);
      limb.castShadow = true;
      limb.receiveShadow = true;
      limb.userData.hitZone = 'paws';
      limb.layers.enable(1);
      hitProxies.push(limb);
      pivot.add(limb);
      this.attachFurShells(limb, frontLimbGeo, this.bodyShellMaterials, 0.016, 0.003);

      const pawGroup = new THREE.Group();
      pawGroup.position.set(0, -0.345, 0.034);
      pivot.add(pawGroup);

      const pawBaseGeo = new THREE.SphereGeometry(0.060, 20, 14);
      pawBaseGeo.scale(1.04, 0.56, 1.28);
      const pawBase = new THREE.Mesh(pawBaseGeo, this.pawMaterial);
      pawBase.castShadow = true;
      pawGroup.add(pawBase);

      for (const tx of [-0.025, 0, 0.025]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), this.pawMaterial);
        toe.scale.set(0.9, 0.72, 1.15);
        toe.position.set(tx, -0.007, 0.058 - Math.abs(tx) * 0.25);
        toe.castShadow = true;
        pawGroup.add(toe);
      }

      return pivot;
    };

    const hindShinGeo = createOrganicLimbGeometry(0.078, 0.058, 0.056, 0.27);
    const buildHindLeg = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.155, -0.05, -0.24);
      bodyPivot.add(pivot);

      const thighGeo = new THREE.SphereGeometry(0.135, 28, 22);
      thighGeo.scale(0.84, 1.24, 1.18);
      const thigh = new THREE.Mesh(thighGeo, this.bodyMaterial);
      thigh.position.set(0, -0.06, 0.01);
      thigh.rotation.x = 0.2;
      thigh.castShadow = true;
      thigh.receiveShadow = true;
      pivot.add(thigh);
      this.attachFurShells(thigh, thighGeo, this.bodyShellMaterials, 0.024, 0.006);

      const shin = new THREE.Mesh(hindShinGeo, this.pawMaterial);
      shin.position.set(0, -0.125, -0.045);
      shin.rotation.x = -0.22;
      shin.castShadow = true;
      shin.userData.hitZone = 'paws';
      shin.layers.enable(1);
      hitProxies.push(shin);
      pivot.add(shin);

      const pawGroup = new THREE.Group();
      pawGroup.position.set(0, -0.385, 0.036);
      pivot.add(pawGroup);

      const pawBaseGeo = new THREE.SphereGeometry(0.060, 20, 14);
      pawBaseGeo.scale(1.04, 0.56, 1.3);
      const pawBase = new THREE.Mesh(pawBaseGeo, this.pawMaterial);
      pawBase.castShadow = true;
      pawGroup.add(pawBase);

      for (const tx of [-0.025, 0, 0.025]) {
        const toe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), this.pawMaterial);
        toe.scale.set(0.9, 0.72, 1.15);
        toe.position.set(tx, -0.007, 0.06 - Math.abs(tx) * 0.25);
        toe.castShadow = true;
        pawGroup.add(toe);
      }

      return pivot;
    };

    const frontLeftLeg = buildFrontLeg(-1);
    const frontRightLeg = buildFrontLeg(1);
    const backLeftLeg = buildHindLeg(-1);
    const backRightLeg = buildHindLeg(1);

    // 8) Fluffy 5-Segment Seamless Tail with Outer Fur Shells
    const tailSegments: THREE.Group[] = [];
    let parentTail: THREE.Object3D = bodyPivot;
    const segLengths = [0.15, 0.15, 0.14, 0.13, 0.12];
    const segRadii = [0.056, 0.052, 0.048, 0.043, 0.036];

    for (let i = 0; i < segLengths.length; i++) {
      const segPivot = new THREE.Group();
      if (i === 0) {
        segPivot.position.set(0, 0.06, -0.39);
      } else {
        segPivot.position.set(0, segLengths[i - 1], 0);
      }
      parentTail.add(segPivot);

      const rTop = segRadii[i] * 0.94;
      const rBot = segRadii[i];
      const len = segLengths[i];

      const jointSphere = new THREE.Mesh(new THREE.SphereGeometry(rBot, 16, 12), this.tailMaterial);
      jointSphere.castShadow = true;
      segPivot.add(jointSphere);

      let segGeo: THREE.BufferGeometry;
      if (i === segLengths.length - 1) {
        segGeo = new THREE.CapsuleGeometry(rTop, len * 0.68, 8, 18);
        segGeo.translate(0, len * 0.5, 0);
      } else {
        segGeo = new THREE.CylinderGeometry(rTop, rBot, len, 20);
        segGeo.translate(0, len * 0.5, 0);
      }
      const segMesh = new THREE.Mesh(segGeo, this.tailMaterial);
      segMesh.castShadow = true;
      segPivot.add(segMesh);
      this.attachFurShells(segMesh, segGeo, this.tailShellMaterials, 0.024, 0.004);

      tailSegments.push(segPivot);
      parentTail = segPivot;
    }

    // 9) Laser Pointer Dot
    const laserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.030, 14, 12),
      new THREE.MeshBasicMaterial({ color: '#FF2E43' })
    );
    laserDot.visible = false;
    laserDot.position.set(0.45, 0.025, 0.85);
    root.add(laserDot);

    return {
      root,
      bodyPivot,
      torsoMesh,
      chestFluff,
      neckPivot,
      headGroup,
      headMesh,
      jawMesh,
      noseMesh,
      leftEarPivot: leftEar.pivot,
      rightEarPivot: rightEar.pivot,
      leftEarTuft: leftEar.tuftMesh,
      rightEarTuft: rightEar.tuftMesh,
      leftIris: leftEye.iris,
      rightIris: rightEye.iris,
      leftPupil: leftEye.pupil,
      rightPupil: rightEye.pupil,
      leftEyelid: leftEye.eyelid,
      rightEyelid: rightEye.eyelid,
      collarMesh,
      bellMesh,
      frontLeftLeg,
      frontRightLeg,
      backLeftLeg,
      backRightLeg,
      tailSegments,
      laserDot,
      hitProxies,
    };
  }

  public applyAppearance(next: CatAppearance): void {
    this.appearance = next;
    const oldTextures = this.textures;
    const bundle = generateCatTextures(next, this.maxAnisotropy);
    this.textures = bundle;

    const sheenTint = new THREE.Color(next.primaryColor).lerp(new THREE.Color('#FFFFFF'), 0.5);

    this.headMaterial.map = bundle.headMap;
    this.headMaterial.sheenColor.copy(sheenTint);
    this.headMaterial.needsUpdate = true;

    this.bodyMaterial.map = bundle.bodyMap;
    this.bodyMaterial.sheenColor.copy(sheenTint);
    this.bodyMaterial.needsUpdate = true;

    this.tailMaterial.map = bundle.tailMap;
    this.tailMaterial.sheenColor.copy(sheenTint);
    this.tailMaterial.needsUpdate = true;

    this.pawMaterial.map = bundle.pawMap;
    this.pawMaterial.sheenColor.copy(sheenTint);
    this.pawMaterial.needsUpdate = true;

    // Bind fur shell maps & outer tip luminance gradient
    for (let l = 0; l < FUR_SHELL_COUNT; l++) {
      const tipBright = 1.0 + (l / FUR_SHELL_COUNT) * 0.14;
      const alphaMap = bundle.furShellAlphaMaps[l];

      const hMat = this.headShellMaterials[l];
      hMat.map = bundle.headMap;
      hMat.alphaMap = alphaMap;
      hMat.color.setScalar(tipBright);
      hMat.sheenColor.copy(sheenTint);
      hMat.needsUpdate = true;

      const bMat = this.bodyShellMaterials[l];
      bMat.map = bundle.bodyMap;
      bMat.alphaMap = alphaMap;
      bMat.color.setScalar(tipBright);
      bMat.sheenColor.copy(sheenTint);
      bMat.needsUpdate = true;

      const tMat = this.tailShellMaterials[l];
      tMat.map = bundle.tailMap;
      tMat.alphaMap = alphaMap;
      tMat.color.setScalar(tipBright);
      tMat.sheenColor.copy(sheenTint);
      tMat.needsUpdate = true;
    }

    this.noseMaterial.color.set(next.noseColor);
    this.collarMaterial.color.set(next.collarColor);
    this.leftIrisMaterial.map = bundle.leftIrisMap;
    this.leftIrisMaterial.needsUpdate = true;
    this.rightIrisMaterial.map = bundle.rightIrisMap;
    this.rightIrisMaterial.needsUpdate = true;

    const c = next.chonkiness;
    this.parts.torsoMesh.scale.set(c, 0.96 + (c - 1) * 0.25, 1 + (c - 1) * 0.08);
    this.parts.chestFluff.scale.set(c * 1.02, 1, 1);

    this.parts.leftEarTuft.visible = next.earType === 'tufted';
    this.parts.rightEarTuft.visible = next.earType === 'tufted';

    if (oldTextures) {
      oldTextures.dispose();
    }
  }

  public triggerPetPulse(): void {
    this.petPulse = 1.0;
  }

  public setPointerLook(nx: number, ny: number): void {
    this.pointerLook.set(nx, ny);
  }

  public setLaserPosition(x: number, z: number): void {
    this.laserPos.set(
      THREE.MathUtils.clamp(x, -1.25, 1.25),
      0.025,
      THREE.MathUtils.clamp(z, -0.9, 1.35)
    );
  }

  public update(dt: number, elapsed: number, mood: PetMood): void {
    const p = this.parts;
    const safeDt = Math.min(dt, 0.05);

    this.blinkTimer -= safeDt;
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 2.6 + Math.random() * 2.8;
      this.blinkAmount = 1.0;
    }
    this.blinkAmount = THREE.MathUtils.damp(this.blinkAmount, 0, 14, safeDt);
    this.petPulse = THREE.MathUtils.damp(this.petPulse, 0, 6, safeDt);

    const earFoldX =
      this.appearance.earType === 'folded'
        ? 0.82
        : this.appearance.earType === 'curled'
          ? -0.36
          : 0.14;
    const earFoldZ = this.appearance.earType === 'folded' ? 0.44 : 0.30;

    let bodyY = 0.47 + Math.sin(elapsed * 2.1) * 0.008;
    let bodyRotX = 0;
    let neckRotX = 0;
    let neckRotY = this.pointerLook.x * 0.22;
    let neckRotZ = 0;
    let earPerkX = earFoldX;
    let jawRotX = 0;
    let lidCloseTarget = this.blinkAmount > 0.15 ? 1 : 0;
    let pupilScale = 1.0;

    let flRotX = 0;
    let frRotX = 0;
    let blRotX = 0;
    let brRotX = 0;
    let tailSwishSpeed = 2.2;
    let tailSwishAmp = 0.16;
    let tailCurlPitch = -0.35;

    p.laserDot.visible = mood === 'hunting';

    switch (mood) {
      case 'happy': {
        bodyY = 0.49 + Math.abs(Math.sin(elapsed * 5.8)) * 0.028;
        neckRotZ = Math.sin(elapsed * 4.5) * 0.11;
        neckRotX = -0.06;
        lidCloseTarget = 0.88;
        tailSwishSpeed = 6.0;
        tailSwishAmp = 0.24;
        tailCurlPitch = -0.18;
        break;
      }
      case 'listening': {
        neckRotZ = 0.30;
        neckRotX = -0.08;
        neckRotY = 0.08 * Math.sin(elapsed * 3.0);
        earPerkX = earFoldX - 0.26 + Math.sin(elapsed * 9) * 0.04;
        pupilScale = 1.38;
        tailSwishSpeed = 1.4;
        tailSwishAmp = 0.06;
        break;
      }
      case 'kneading': {
        bodyY = 0.44;
        bodyRotX = 0.08;
        flRotX = Math.sin(elapsed * 5.2) * 0.36 - 0.22;
        frRotX = -Math.sin(elapsed * 5.2) * 0.36 - 0.22;
        neckRotX = 0.14;
        lidCloseTarget = 0.72;
        tailSwishSpeed = 1.8;
        break;
      }
      case 'yawning': {
        const yawnWave = Math.max(0, Math.sin(elapsed * 2.4));
        neckRotX = -0.30 * yawnWave;
        jawRotX = 0.48 * yawnWave;
        lidCloseTarget = 0.92;
        earPerkX = earFoldX + 0.24 * yawnWave;
        break;
      }
      case 'hunting': {
        const lx = this.laserPos.x + Math.sin(elapsed * 2.7) * 0.22;
        const lz = this.laserPos.z + Math.cos(elapsed * 1.9) * 0.15;
        p.laserDot.position.set(lx, 0.025, lz);

        const lookAngleY = Math.atan2(lx, lz + 0.15);
        neckRotY = THREE.MathUtils.clamp(lookAngleY, -0.7, 0.7);
        neckRotX = 0.24;
        bodyY = 0.39 + Math.sin(elapsed * 14) * 0.008;
        bodyRotX = 0.14;
        flRotX = -0.22;
        frRotX = -0.22;
        blRotX = 0.18;
        brRotX = 0.18;
        pupilScale = 1.65;
        tailSwishSpeed = 8.2;
        tailSwishAmp = 0.28;
        tailCurlPitch = -0.82;
        break;
      }
      case 'tsundere': {
        neckRotY = -0.58;
        neckRotZ = -0.14;
        neckRotX = -0.12;
        lidCloseTarget = 0.42;
        earPerkX = earFoldX + 0.20;
        tailSwishSpeed = 3.8;
        tailSwishAmp = 0.28;
        break;
      }
      case 'sleeping': {
        bodyY = 0.24 + Math.sin(elapsed * 1.3) * 0.008;
        bodyRotX = 0.04;
        flRotX = -1.15;
        frRotX = -1.15;
        blRotX = 1.05;
        brRotX = 1.05;
        neckRotX = 0.34;
        neckRotZ = 0.22;
        lidCloseTarget = 1.0;
        tailCurlPitch = -1.35;
        tailSwishSpeed = 0.8;
        tailSwishAmp = 0.04;
        break;
      }
      case 'idle':
      default: {
        neckRotX = -this.pointerLook.y * 0.12 + Math.sin(elapsed * 1.1) * 0.025;
        break;
      }
    }

    if (this.petPulse > 0.01) {
      bodyY += this.petPulse * 0.025;
      neckRotX -= this.petPulse * 0.14;
      lidCloseTarget = Math.max(lidCloseTarget, this.petPulse * 0.9);
    }

    p.bodyPivot.position.y = THREE.MathUtils.damp(p.bodyPivot.position.y, bodyY, 8, safeDt);
    p.bodyPivot.rotation.x = THREE.MathUtils.damp(p.bodyPivot.rotation.x, bodyRotX, 8, safeDt);

    p.neckPivot.rotation.x = THREE.MathUtils.damp(p.neckPivot.rotation.x, neckRotX, 9, safeDt);
    p.neckPivot.rotation.y = THREE.MathUtils.damp(p.neckPivot.rotation.y, neckRotY, 9, safeDt);
    p.neckPivot.rotation.z = THREE.MathUtils.damp(p.neckPivot.rotation.z, neckRotZ, 9, safeDt);

    const twitch = Math.sin(elapsed * 11) > 0.985 ? 0.18 : 0;
    p.leftEarPivot.rotation.x = THREE.MathUtils.damp(p.leftEarPivot.rotation.x, earPerkX, 12, safeDt);
    p.rightEarPivot.rotation.x = THREE.MathUtils.damp(
      p.rightEarPivot.rotation.x,
      earPerkX + twitch,
      12,
      safeDt
    );
    p.leftEarPivot.rotation.z = THREE.MathUtils.damp(p.leftEarPivot.rotation.z, earFoldZ, 10, safeDt);
    p.rightEarPivot.rotation.z = THREE.MathUtils.damp(p.rightEarPivot.rotation.z, -earFoldZ, 10, safeDt);

    p.jawMesh.position.y = THREE.MathUtils.damp(p.jawMesh.position.y, -0.118 - jawRotX * 0.045, 12, safeDt);
    p.jawMesh.scale.y = THREE.MathUtils.damp(p.jawMesh.scale.y, 0.58 + jawRotX * 0.65, 12, safeDt);

    const lidRotX = THREE.MathUtils.lerp(-Math.PI * 0.46, 0.10, lidCloseTarget);
    p.leftEyelid.rotation.x = THREE.MathUtils.damp(p.leftEyelid.rotation.x, lidRotX, 18, safeDt);
    p.rightEyelid.rotation.x = THREE.MathUtils.damp(p.rightEyelid.rotation.x, lidRotX, 18, safeDt);

    p.leftPupil.scale.x = THREE.MathUtils.damp(p.leftPupil.scale.x, 0.55 * pupilScale, 8, safeDt);
    p.rightPupil.scale.x = THREE.MathUtils.damp(p.rightPupil.scale.x, 0.55 * pupilScale, 8, safeDt);

    p.frontLeftLeg.rotation.x = THREE.MathUtils.damp(p.frontLeftLeg.rotation.x, flRotX, 10, safeDt);
    p.frontRightLeg.rotation.x = THREE.MathUtils.damp(p.frontRightLeg.rotation.x, frRotX, 10, safeDt);
    p.backLeftLeg.rotation.x = THREE.MathUtils.damp(p.backLeftLeg.rotation.x, blRotX, 10, safeDt);
    p.backRightLeg.rotation.x = THREE.MathUtils.damp(p.backRightLeg.rotation.x, brRotX, 10, safeDt);

    p.tailSegments.forEach((seg, idx) => {
      const targetX = idx === 0 ? tailCurlPitch : 0.24 + Math.cos(elapsed * tailSwishSpeed - idx * 0.45) * 0.05;
      seg.rotation.x = THREE.MathUtils.damp(seg.rotation.x, targetX, 8, safeDt);
      seg.rotation.z = Math.sin(elapsed * tailSwishSpeed - idx * 0.55) * tailSwishAmp;
    });

    p.bellMesh.rotation.z = Math.sin(elapsed * 5) * 0.08 + this.petPulse * 0.35;
  }

  public dispose(): void {
    this.textures?.dispose();
    this.headMaterial.dispose();
    this.bodyMaterial.dispose();
    this.tailMaterial.dispose();
    this.pawMaterial.dispose();
    this.headShellMaterials.forEach((m) => m.dispose());
    this.bodyShellMaterials.forEach((m) => m.dispose());
    this.tailShellMaterials.forEach((m) => m.dispose());
    this.earInnerMaterial.dispose();
    this.noseMaterial.dispose();
    this.collarMaterial.dispose();
    this.leftIrisMaterial.dispose();
    this.rightIrisMaterial.dispose();
    this.parts.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
  }
}
