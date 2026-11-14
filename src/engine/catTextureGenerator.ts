import * as THREE from 'three';
import { type CatAppearance } from '../schemas/cat';

export interface CatTextureBundle {
  headMap: THREE.CanvasTexture;
  bodyMap: THREE.CanvasTexture;
  tailMap: THREE.CanvasTexture;
  pawMap: THREE.CanvasTexture;
  leftIrisMap: THREE.CanvasTexture;
  rightIrisMap: THREE.CanvasTexture;
  furShellAlphaMaps: THREE.CanvasTexture[];
  dispose: () => void;
}

function makeCanvas(size = 512): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas unavailable');
  }
  return { canvas, ctx };
}

function paintOrganicFurFibers(
  ctx: CanvasRenderingContext2D,
  size: number,
  strength = 0.085
): void {
  ctx.save();
  for (let i = 0; i < 4200; i++) {
    const rx = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * size;
    const ry = Math.abs((Math.sin(i * 78.233) * 19341.123) % 1) * size;
    const len = 6 + (i % 9);
    const light = i % 2 === 0;
    ctx.strokeStyle = light
      ? `rgba(255,255,255,${strength})`
      : `rgba(18,16,24,${strength * 0.65})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + ((i % 3) - 1) * 1.1, ry + len);
    ctx.stroke();
  }
  ctx.restore();
}

function toColorTexture(canvas: HTMLCanvasElement, maxAnisotropy: number): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates radial fibrous feline iris texture (dark limbal ring + striated fibers + inner amber glint)
 */
function generateIrisTexture(hexColor: string, maxAnisotropy: number): THREE.CanvasTexture {
  const S = 256;
  const { canvas, ctx } = makeCanvas(S);
  const cx = S / 2;
  const cy = S / 2;
  const base = new THREE.Color(hexColor);
  const darker = base.clone().multiplyScalar(0.45);
  const lighter = base.clone().lerp(new THREE.Color('#FFF8D6'), 0.42);

  const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, 122);
  grad.addColorStop(0, `#${lighter.getHexString()}`);
  grad.addColorStop(0.55, `#${base.getHexString()}`);
  grad.addColorStop(0.88, `#${darker.getHexString()}`);
  grad.addColorStop(1, '#1A1C22');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Radial iris muscle fibers
  for (let i = 0; i < 120; i++) {
    const angle = (i / 120) * Math.PI * 2;
    const r0 = 28 + (i % 3) * 6;
    const r1 = 108 + (i % 5) * 3;
    ctx.strokeStyle =
      i % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(15,18,24,0.22)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.stroke();
  }

  return toColorTexture(canvas, maxAnisotropy);
}

/**
 * Generates concentric Fur-Shell Alpha Maps (layer 0 = dense base tufts -> layer 4 = fine outer wisps)
 * Used with alphaTest cutout so shells render crisp 3D fluff silhouettes with zero z-sorting artifacts.
 */
function generateFurShellAlphaMaps(layers: number, maxAnisotropy: number): THREE.CanvasTexture[] {
  const S = 256;
  const maps: THREE.CanvasTexture[] = [];
  const totalStrands = 5400;

  // Precompute deterministic strand positions so hairs align radially across concentric shells!
  const strands: { x: number; y: number; r: number; maxLayer: number }[] = [];
  for (let i = 0; i < totalStrands; i++) {
    const x = Math.abs((Math.sin(i * 12.9898 + 1.7) * 43758.5453) % 1) * S;
    const y = Math.abs((Math.sin(i * 78.233 + 3.1) * 19341.123) % 1) * S;
    const randLen = Math.abs((Math.sin(i * 41.17) * 29183.11) % 1);
    strands.push({
      x,
      y,
      r: 1.5 + randLen * 2.1,
      maxLayer: Math.floor(randLen * layers),
    });
  }

  for (let l = 0; l < layers; l++) {
    const { canvas, ctx } = makeCanvas(S);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, S, S);

    const taper = 1 - (l / layers) * 0.58;
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < strands.length; i++) {
      const st = strands[i];
      if (st.maxLayer < l) continue;
      const rad = Math.max(0.85, st.r * taper);
      ctx.beginPath();
      ctx.ellipse(st.x, st.y, rad, rad * 1.45, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    tex.anisotropy = Math.min(4, maxAnisotropy);
    tex.needsUpdate = true;
    maps.push(tex);
  }
  return maps;
}

/**
 * Generates procedural 512x512 fur albedo textures, realistic iris textures, and concentric fur-shell alpha maps
 */
export function generateCatTextures(
  appearance: CatAppearance,
  maxAnisotropy = 4
): CatTextureBundle {
  const S = 512;
  const { coatPattern, primaryColor, secondaryColor, accentColor, bellyColor } = appearance;

  // 1) HEAD TEXTURE (Sphere UV with phiStart=-PI/2 puts u=0.5 directly at +Z front face)
  const head = makeCanvas(S);
  head.ctx.fillStyle = primaryColor;
  head.ctx.fillRect(0, 0, S, S);

  if (coatPattern === 'bicolor' || coatPattern === 'tuxedo') {
    head.ctx.fillStyle = secondaryColor;
    head.ctx.beginPath();
    head.ctx.moveTo(S * 0.5, S * 0.43);
    head.ctx.bezierCurveTo(S * 0.42, S * 0.54, S * 0.34, S * 0.74, S * 0.3, S);
    head.ctx.lineTo(S * 0.7, S);
    head.ctx.bezierCurveTo(S * 0.66, S * 0.74, S * 0.58, S * 0.54, S * 0.5, S * 0.43);
    head.ctx.closePath();
    head.ctx.fill();
  } else if (coatPattern === 'calico') {
    head.ctx.fillStyle = secondaryColor;
    head.ctx.beginPath();
    head.ctx.ellipse(S * 0.34, S * 0.36, 98, 82, -0.35, 0, Math.PI * 2);
    head.ctx.fill();

    head.ctx.fillStyle = accentColor;
    head.ctx.beginPath();
    head.ctx.ellipse(S * 0.67, S * 0.34, 88, 72, 0.38, 0, Math.PI * 2);
    head.ctx.fill();
  } else if (coatPattern === 'tortoiseshell') {
    const patches = [
      { x: 0.25, y: 0.32, r: 78, c: secondaryColor },
      { x: 0.68, y: 0.44, r: 84, c: accentColor },
      { x: 0.48, y: 0.28, r: 60, c: secondaryColor },
      { x: 0.36, y: 0.62, r: 64, c: accentColor },
    ];
    for (const pt of patches) {
      head.ctx.fillStyle = pt.c;
      head.ctx.beginPath();
      head.ctx.arc(pt.x * S, pt.y * S, pt.r, 0, Math.PI * 2);
      head.ctx.fill();
    }
  } else if (coatPattern === 'siamese') {
    const grad = head.ctx.createRadialGradient(S * 0.5, S * 0.56, 22, S * 0.5, S * 0.56, 158);
    grad.addColorStop(0, secondaryColor);
    grad.addColorStop(0.55, secondaryColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    head.ctx.fillStyle = grad;
    head.ctx.fillRect(0, 0, S, S);
  }

  if (coatPattern === 'tabby') {
    head.ctx.strokeStyle = accentColor;
    head.ctx.lineWidth = 9;
    head.ctx.lineCap = 'round';
    head.ctx.lineJoin = 'round';
    head.ctx.beginPath();
    head.ctx.moveTo(S * 0.42, S * 0.38);
    head.ctx.lineTo(S * 0.45, S * 0.30);
    head.ctx.lineTo(S * 0.5, S * 0.35);
    head.ctx.lineTo(S * 0.55, S * 0.30);
    head.ctx.lineTo(S * 0.58, S * 0.38);
    head.ctx.stroke();

    for (const dir of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        head.ctx.beginPath();
        head.ctx.moveTo(S * (0.5 + dir * 0.14), S * (0.54 + row * 0.06));
        head.ctx.quadraticCurveTo(
          S * (0.5 + dir * 0.22),
          S * (0.55 + row * 0.07),
          S * (0.5 + dir * 0.30),
          S * (0.5 + row * 0.08)
        );
        head.ctx.stroke();
      }
    }
  }

  head.ctx.fillStyle = 'rgba(244, 134, 150, 0.16)';
  head.ctx.beginPath();
  head.ctx.ellipse(S * 0.35, S * 0.6, 26, 14, 0, 0, Math.PI * 2);
  head.ctx.ellipse(S * 0.65, S * 0.6, 26, 14, 0, 0, Math.PI * 2);
  head.ctx.fill();

  paintOrganicFurFibers(head.ctx, S, 0.08);

  // 2) BODY TEXTURE
  const body = makeCanvas(S);
  body.ctx.fillStyle = primaryColor;
  body.ctx.fillRect(0, 0, S, S);

  if (coatPattern === 'tabby') {
    body.ctx.strokeStyle = accentColor;
    body.ctx.lineWidth = 18;
    body.ctx.lineCap = 'round';
    body.ctx.fillStyle = accentColor;
    body.ctx.fillRect(0, 0, 28, S);
    body.ctx.fillRect(S - 28, 0, 28, S);

    for (let y = 76; y < S - 48; y += 72) {
      body.ctx.beginPath();
      body.ctx.moveTo(0, y);
      body.ctx.quadraticCurveTo(S * 0.2, y + 26, S * 0.36, y + 12);
      body.ctx.stroke();

      body.ctx.beginPath();
      body.ctx.moveTo(S, y);
      body.ctx.quadraticCurveTo(S * 0.8, y + 26, S * 0.64, y + 12);
      body.ctx.stroke();
    }
  } else if (coatPattern === 'calico') {
    const spots = [
      { x: 0.16, y: 0.35, rx: 92, ry: 72, c: secondaryColor },
      { x: 0.84, y: 0.44, rx: 95, ry: 76, c: accentColor },
      { x: 0.22, y: 0.72, rx: 78, ry: 66, c: accentColor },
      { x: 0.78, y: 0.75, rx: 84, ry: 58, c: secondaryColor },
    ];
    for (const sp of spots) {
      body.ctx.fillStyle = sp.c;
      body.ctx.beginPath();
      body.ctx.ellipse(sp.x * S, sp.y * S, sp.rx, sp.ry, 0.3, 0, Math.PI * 2);
      body.ctx.fill();
    }
  } else if (coatPattern === 'tortoiseshell') {
    for (let i = 0; i < 18; i++) {
      body.ctx.fillStyle = i % 2 === 0 ? secondaryColor : accentColor;
      body.ctx.beginPath();
      const px = ((i * 97) % 100) / 100;
      const py = ((i * 53 + 20) % 100) / 100;
      body.ctx.ellipse(px * S, py * S, 58, 42, i * 0.5, 0, Math.PI * 2);
      body.ctx.fill();
    }
  }

  const bellyGrad = body.ctx.createLinearGradient(S * 0.24, 0, S * 0.76, 0);
  const chestColor = coatPattern === 'bicolor' || coatPattern === 'tuxedo' ? secondaryColor : bellyColor;
  bellyGrad.addColorStop(0, 'rgba(255,255,255,0)');
  bellyGrad.addColorStop(0.28, chestColor);
  bellyGrad.addColorStop(0.72, chestColor);
  bellyGrad.addColorStop(1, 'rgba(255,255,255,0)');
  body.ctx.fillStyle = bellyGrad;
  body.ctx.fillRect(S * 0.2, 0, S * 0.6, S);

  paintOrganicFurFibers(body.ctx, S, 0.08);

  // 3) TAIL TEXTURE
  const tail = makeCanvas(256);
  tail.ctx.fillStyle = coatPattern === 'siamese' ? secondaryColor : primaryColor;
  tail.ctx.fillRect(0, 0, 256, 256);
  if (coatPattern === 'tabby') {
    tail.ctx.fillStyle = accentColor;
    for (let y = 18; y < 245; y += 40) {
      tail.ctx.fillRect(0, y, 256, 16);
    }
  } else if (coatPattern === 'calico') {
    tail.ctx.fillStyle = secondaryColor;
    tail.ctx.fillRect(0, 48, 256, 72);
    tail.ctx.fillStyle = accentColor;
    tail.ctx.fillRect(0, 150, 256, 76);
  }
  if (coatPattern === 'bicolor' || coatPattern === 'tuxedo') {
    tail.ctx.fillStyle = secondaryColor;
    tail.ctx.fillRect(0, 192, 256, 64);
  }
  paintOrganicFurFibers(tail.ctx, 256, 0.065);

  // 4) PAW/LIMB TEXTURE
  const paw = makeCanvas(256);
  paw.ctx.fillStyle = primaryColor;
  paw.ctx.fillRect(0, 0, 256, 256);
  if (coatPattern === 'bicolor' || coatPattern === 'tuxedo') {
    paw.ctx.fillStyle = secondaryColor;
    paw.ctx.fillRect(0, 150, 256, 106);
  } else if (coatPattern === 'siamese') {
    paw.ctx.fillStyle = secondaryColor;
    paw.ctx.fillRect(0, 120, 256, 136);
  } else if (coatPattern === 'tabby') {
    paw.ctx.fillStyle = accentColor;
    paw.ctx.fillRect(0, 46, 256, 18);
    paw.ctx.fillRect(0, 106, 256, 18);
  }
  paintOrganicFurFibers(paw.ctx, 256, 0.06);

  const headMap = toColorTexture(head.canvas, maxAnisotropy);
  const bodyMap = toColorTexture(body.canvas, maxAnisotropy);
  const tailMap = toColorTexture(tail.canvas, maxAnisotropy);
  const pawMap = toColorTexture(paw.canvas, maxAnisotropy);
  const leftIrisMap = generateIrisTexture(appearance.leftEyeColor, maxAnisotropy);
  const rightIrisMap = generateIrisTexture(appearance.rightEyeColor, maxAnisotropy);
  const furShellAlphaMaps = generateFurShellAlphaMaps(5, maxAnisotropy);

  return {
    headMap,
    bodyMap,
    tailMap,
    pawMap,
    leftIrisMap,
    rightIrisMap,
    furShellAlphaMaps,
    dispose: () => {
      headMap.dispose();
      bodyMap.dispose();
      tailMap.dispose();
      pawMap.dispose();
      leftIrisMap.dispose();
      rightIrisMap.dispose();
      furShellAlphaMaps.forEach((t) => t.dispose());
    },
  };
}
