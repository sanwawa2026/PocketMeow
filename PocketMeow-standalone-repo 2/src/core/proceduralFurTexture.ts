import * as THREE from 'three';
import { CatProfile } from '../schemas/catSchema';

export interface ProceduralFurMaps {
  bodyMap: THREE.CanvasTexture;
  headMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function drawFurStrokes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  alpha: number,
  count: number,
  seedOffset = 1
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  let seed = seedOffset * 9301 + 49297;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 6 + rand() * 14;
    const angle = Math.PI / 2 + (rand() - 0.5) * 0.45;
    ctx.lineWidth = 1 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function createProceduralFurMaps(
  profile: CatProfile,
  maxAnisotropy: number
): ProceduralFurMaps {
  const size = 512;

  // 1. Body coat canvas
  const bodyCanvas = document.createElement('canvas');
  bodyCanvas.width = size;
  bodyCanvas.height = size;
  const bCtx = bodyCanvas.getContext('2d')!;

  bCtx.fillStyle = profile.primaryColor;
  bCtx.fillRect(0, 0, size, size);

  switch (profile.coatPattern) {
    case 'tabby': {
      bCtx.fillStyle = profile.accentColor;
      bCtx.globalAlpha = 0.55;
      for (let y = 40; y < size; y += 56) {
        bCtx.beginPath();
        bCtx.ellipse(size * 0.5, y, size * 0.46, 12, 0.08, 0, Math.PI * 2);
        bCtx.fill();
      }
      bCtx.globalAlpha = 0.92;
      bCtx.fillStyle = profile.secondaryColor;
      bCtx.beginPath();
      bCtx.ellipse(size * 0.5, size * 0.62, size * 0.24, size * 0.34, 0, 0, Math.PI * 2);
      bCtx.fill();
      break;
    }
    case 'tuxedo':
    case 'bicolor': {
      bCtx.fillStyle = profile.secondaryColor;
      bCtx.beginPath();
      bCtx.ellipse(size * 0.5, size * 0.55, size * 0.28, size * 0.42, 0, 0, Math.PI * 2);
      bCtx.fill();
      if (profile.coatPattern === 'bicolor') {
        bCtx.beginPath();
        bCtx.arc(size * 0.2, size * 0.3, 95, 0, Math.PI * 2);
        bCtx.fill();
      }
      break;
    }
    case 'calico': {
      bCtx.fillStyle = profile.secondaryColor;
      bCtx.beginPath();
      bCtx.arc(size * 0.22, size * 0.28, 110, 0, Math.PI * 2);
      bCtx.arc(size * 0.78, size * 0.64, 125, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = profile.accentColor;
      bCtx.beginPath();
      bCtx.arc(size * 0.74, size * 0.26, 92, 0, Math.PI * 2);
      bCtx.arc(size * 0.28, size * 0.74, 88, 0, Math.PI * 2);
      bCtx.fill();
      break;
    }
    case 'tortoiseshell': {
      const blobs = 28;
      for (let i = 0; i < blobs; i++) {
        bCtx.fillStyle = i % 2 === 0 ? profile.secondaryColor : profile.accentColor;
        bCtx.globalAlpha = 0.72;
        const bx = ((i * 97) % 440) + 36;
        const by = ((i * 151) % 440) + 36;
        bCtx.beginPath();
        bCtx.ellipse(bx, by, 34 + (i % 24), 22 + (i % 18), (i * 0.5) % Math.PI, 0, Math.PI * 2);
        bCtx.fill();
      }
      break;
    }
    case 'siamese': {
      const grad = bCtx.createRadialGradient(size * 0.5, size * 0.5, 60, size * 0.5, size * 0.5, 290);
      grad.addColorStop(0, profile.primaryColor);
      grad.addColorStop(0.65, profile.primaryColor);
      grad.addColorStop(1, profile.secondaryColor);
      bCtx.fillStyle = grad;
      bCtx.fillRect(0, 0, size, size);
      break;
    }
    case 'spotted': {
      bCtx.fillStyle = profile.accentColor;
      bCtx.globalAlpha = 0.7;
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 113 + 40) % 440) + 36;
        const sy = ((i * 179 + 30) % 440) + 36;
        bCtx.beginPath();
        bCtx.arc(sx, sy, 16 + (i % 12), 0, Math.PI * 2);
        bCtx.fill();
      }
      break;
    }
    case 'solid':
    default: {
      bCtx.fillStyle = profile.secondaryColor;
      bCtx.globalAlpha = 0.22;
      bCtx.beginPath();
      bCtx.ellipse(size * 0.5, size * 0.58, size * 0.25, size * 0.35, 0, 0, Math.PI * 2);
      bCtx.fill();
      break;
    }
  }

  bCtx.globalAlpha = 1;
  drawFurStrokes(bCtx, size, size, profile.secondaryColor, 0.16, 1200, 3);
  drawFurStrokes(bCtx, size, size, profile.accentColor, 0.1, 800, 7);

  // 2. Head coat canvas (with M-markings for tabby / mask for tuxedo/siamese)
  const headCanvas = document.createElement('canvas');
  headCanvas.width = size;
  headCanvas.height = size;
  const hCtx = headCanvas.getContext('2d')!;

  hCtx.fillStyle = profile.primaryColor;
  hCtx.fillRect(0, 0, size, size);

  if (profile.coatPattern === 'siamese') {
    const faceGrad = hCtx.createRadialGradient(size * 0.5, size * 0.52, 24, size * 0.5, size * 0.52, 165);
    faceGrad.addColorStop(0, profile.secondaryColor);
    faceGrad.addColorStop(0.58, profile.accentColor);
    faceGrad.addColorStop(1, profile.primaryColor);
    hCtx.fillStyle = faceGrad;
    hCtx.fillRect(0, 0, size, size);
  } else if (profile.coatPattern === 'tuxedo' || profile.coatPattern === 'bicolor') {
    hCtx.fillStyle = profile.secondaryColor;
    hCtx.beginPath();
    hCtx.moveTo(size * 0.5, size * 0.36);
    hCtx.lineTo(size * 0.26, size * 0.78);
    hCtx.lineTo(size * 0.74, size * 0.78);
    hCtx.closePath();
    hCtx.fill();
  } else if (profile.coatPattern === 'tabby') {
    hCtx.strokeStyle = profile.accentColor;
    hCtx.lineWidth = 10;
    hCtx.lineCap = 'round';
    hCtx.globalAlpha = 0.72;
    // Tabby M mark on forehead
    hCtx.beginPath();
    hCtx.moveTo(size * 0.38, size * 0.38);
    hCtx.lineTo(size * 0.43, size * 0.26);
    hCtx.lineTo(size * 0.5, size * 0.35);
    hCtx.lineTo(size * 0.57, size * 0.26);
    hCtx.lineTo(size * 0.62, size * 0.38);
    hCtx.stroke();
    hCtx.globalAlpha = 1;
  } else if (profile.coatPattern === 'calico') {
    hCtx.fillStyle = profile.secondaryColor;
    hCtx.beginPath();
    hCtx.arc(size * 0.32, size * 0.34, 85, 0, Math.PI * 2);
    hCtx.fill();
    hCtx.fillStyle = profile.accentColor;
    hCtx.beginPath();
    hCtx.arc(size * 0.68, size * 0.34, 82, 0, Math.PI * 2);
    hCtx.fill();
  }

  drawFurStrokes(hCtx, size, size, profile.secondaryColor, 0.16, 1000, 11);

  // 3. Linear roughness texture for plush fur feel
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = '#CFCFCF';
  rCtx.fillRect(0, 0, 256, 256);
  drawFurStrokes(rCtx, 256, 256, '#FFFFFF', 0.25, 900, 19);
  drawFurStrokes(rCtx, 256, 256, '#9A9A9A', 0.2, 600, 23);

  const bodyMap = new THREE.CanvasTexture(bodyCanvas);
  bodyMap.colorSpace = THREE.SRGBColorSpace;
  bodyMap.anisotropy = maxAnisotropy;

  const headMap = new THREE.CanvasTexture(headCanvas);
  headMap.colorSpace = THREE.SRGBColorSpace;
  headMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAnisotropy;

  return { bodyMap, headMap, roughnessMap };
}
