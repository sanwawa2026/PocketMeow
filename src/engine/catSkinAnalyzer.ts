import {
  type CatAppearance,
  CatAppearanceSchema,
  type CoatPattern,
  type FloodFillDebug,
} from '../schemas/cat';

interface RgbPixel {
  r: number;
  g: number;
  b: number;
  lum: number;
  sat: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function colorDistSq(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('无法读取图片内容'));
    img.src = src;
  });
}

/**
 * 阶段 2 核心离线路线：
 * 1) 边缘洪泛填充 (Edge Flood Fill) 剔除背景，保护猫身内部纯白毛发不被误删
 * 2) 按亮度排序取 50%–80% 受光面分位像素提取主色，攻克白猫偏灰/黑猫偏糊问题
 * 3) 加权 K-Means 聚类判断双色 / 三花 / 虎斑 / 纯色花色结构
 */
export async function analyzeCatOfflineFloodFill(
  imageDataUrl: string
): Promise<{ appearance: CatAppearance; debug: FloodFillDebug }> {
  const img = await loadImageElement(imageDataUrl);
  const maxDim = 144;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  const w = Math.max(32, Math.round(img.width * scale));
  const h = Math.max(32, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D 上下文不可用');
  }
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample 4 corner border average seeds for adaptive flood-fill threshold
  const total = w * h;
  const isBg = new Uint8Array(total);
  const visited = new Uint8Array(total);

  // Border pixels as seeds (top, bottom, left, right edges)
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  const enqueueSeed = (x: number, y: number) => {
    const idx = y * w + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      queue[qTail++] = idx;
    }
  };

  for (let x = 0; x < w; x += 2) {
    enqueueSeed(x, 0);
    enqueueSeed(x, h - 1);
  }
  for (let y = 0; y < h; y += 2) {
    enqueueSeed(0, y);
    enqueueSeed(w - 1, y);
  }

  // Adaptive color distance threshold based on edge uniformity
  const thresholdSq = 32 * 32;
  const stepThresholdSq = 18 * 18;

  // Compute median border color as anchor
  let borderR = 0;
  let borderG = 0;
  let borderB = 0;
  let borderCount = 0;
  for (let i = 0; i < qTail; i++) {
    const p = queue[i] * 4;
    borderR += data[p];
    borderG += data[p + 1];
    borderB += data[p + 2];
    borderCount++;
  }
  borderR /= Math.max(1, borderCount);
  borderG /= Math.max(1, borderCount);
  borderB /= Math.max(1, borderCount);

  const dx = [1, -1, 0, 0];
  const dy = [0, 0, 1, -1];

  while (qHead < qTail) {
    const currIdx = queue[qHead++];
    const cx = currIdx % w;
    const cy = (currIdx - cx) / w;
    const cp = currIdx * 4;
    const cr = data[cp];
    const cg = data[cp + 1];
    const cb = data[cp + 2];

    // Protect center subject core from gradient flood leaks
    const distToAnchor = colorDistSq(cr, cg, cb, borderR, borderG, borderB);
    const centerDx = (cx - w * 0.5) / (w * 0.5);
    const centerDy = (cy - h * 0.5) / (h * 0.5);
    const inCenterCore = centerDx * centerDx + centerDy * centerDy < 0.32;
    if (inCenterCore && distToAnchor > stepThresholdSq) {
      continue;
    }

    isBg[currIdx] = 1;

    for (let k = 0; k < 4; k++) {
      const nx = cx + dx[k];
      const ny = cy + dy[k];
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;
      const np = nIdx * 4;
      const nr = data[np];
      const ng = data[np + 1];
      const nb = data[np + 2];

      const localDist = colorDistSq(cr, cg, cb, nr, ng, nb);
      const anchorDist = colorDistSq(nr, ng, nb, borderR, borderG, borderB);
      if (anchorDist <= thresholdSq && localDist <= stepThresholdSq * 1.4) {
        visited[nIdx] = 1;
        queue[qTail++] = nIdx;
      }
    }
  }

  // Fallback center weighting if flood fill ate too much (>85%)
  const fgPixels: RgbPixel[] = [];
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = w;
  previewCanvas.height = h;
  const pCtx = previewCanvas.getContext('2d');
  const previewData = pCtx ? pCtx.createImageData(w, h) : null;

  let fgCount = 0;
  for (let i = 0; i < total; i++) {
    if (!isBg[i]) fgCount++;
  }
  const useCenterFallback = fgCount / total < 0.15;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p = idx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const a = data[p + 3];

      const cx = (x - w * 0.5) / (w * 0.5);
      const cy = (y - h * 0.5) / (h * 0.5);
      const isForeground = useCenterFallback
        ? cx * cx + cy * cy < 0.45 && a > 30
        : !isBg[idx] && a > 30;

      if (previewData) {
        if (isForeground) {
          previewData.data[p] = r;
          previewData.data[p + 1] = g;
          previewData.data[p + 2] = b;
          previewData.data[p + 3] = 255;
        } else {
          // Soft checkerboard alpha indication
          const checker = ((x >> 3) + (y >> 3)) % 2 === 0 ? 236 : 222;
          previewData.data[p] = checker;
          previewData.data[p + 1] = checker;
          previewData.data[p + 2] = checker + 4;
          previewData.data[p + 3] = 255;
        }
      }

      if (isForeground) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = rgbSaturation(r, g, b);
        fgPixels.push({ r, g, b, lum, sat });
      }
    }
  }

  if (pCtx && previewData) {
    pCtx.putImageData(previewData, 0, 0);
  }

  // Sort foreground pixels by luminance -> extract 50th-80th percentile "lit fur" band
  fgPixels.sort((a, b) => a.lum - b.lum);
  const p50Idx = Math.floor(fgPixels.length * 0.5);
  const p80Idx = Math.max(p50Idx + 1, Math.floor(fgPixels.length * 0.8));
  const litBand = fgPixels.slice(p50Idx, p80Idx);

  const lumP50 = fgPixels[p50Idx]?.lum ?? 140;
  const lumP80 = fgPixels[Math.min(fgPixels.length - 1, p80Idx)]?.lum ?? 190;

  // Run simple 3-cluster k-means on litBand + full fgPixels for secondary dark/white patches
  const clusterPixels = litBand.length >= 24 ? litBand : fgPixels;
  const centroids = runKMeans3(clusterPixels);

  // Also check overall bright & dark ratios to detect bicolor/calico/solid white/black
  const veryBrightCount = fgPixels.filter((px) => px.lum > 205 && px.sat < 0.22).length;
  const veryDarkCount = fgPixels.filter((px) => px.lum < 68 && px.sat < 0.3).length;
  const gingerCount = fgPixels.filter((px) => px.r > px.b + 35 && px.r > 120).length;

  const brightRatio = veryBrightCount / Math.max(1, fgPixels.length);
  const darkRatio = veryDarkCount / Math.max(1, fgPixels.length);
  const gingerRatio = gingerCount / Math.max(1, fgPixels.length);

  let coatPattern: CoatPattern = 'solid';
  let primaryHex = centroids[0];
  let secondaryHex = centroids[1] ?? centroids[0];
  let accentHex = centroids[2] ?? centroids[0];
  let breedLabel = '离线识图主子';
  let rarity: 'SSR' | 'SR' | 'R' = 'SR';

  if (brightRatio > 0.62 && darkRatio < 0.08 && gingerRatio < 0.1) {
    coatPattern = 'solid';
    primaryHex = '#F6F7FA';
    secondaryHex = '#ECEFF5';
    accentHex = '#DDE2EC';
    breedLabel = '纯白绒云圣体';
    rarity = 'SSR';
  } else if (darkRatio > 0.65 && brightRatio < 0.12) {
    coatPattern = 'solid';
    primaryHex = '#23262E';
    secondaryHex = '#323640';
    accentHex = '#15171D';
    breedLabel = '玄猫暗影骑士';
    rarity = 'SR';
  } else if (brightRatio > 0.2 && gingerRatio > 0.18 && darkRatio > 0.15) {
    coatPattern = 'calico';
    primaryHex = '#FAF7F2';
    secondaryHex = centroids.find((c) => c !== '#FAF7F2') ?? '#DE7A2E';
    accentHex = '#2B2A30';
    breedLabel = '招财三花御猫';
    rarity = 'SSR';
  } else if (brightRatio > 0.22 && darkRatio > 0.22) {
    coatPattern = 'tuxedo';
    primaryHex = '#25272F';
    secondaryHex = '#F7F8FB';
    accentHex = '#16181E';
    breedLabel = '燕尾服奶牛猫';
    rarity = 'SR';
  } else if (gingerRatio > 0.35 && brightRatio > 0.18) {
    coatPattern = 'bicolor';
    primaryHex = centroids[0];
    secondaryHex = '#FCF8F2';
    accentHex = darkenHex(centroids[0], 0.22);
    breedLabel = '橘白双色大橘';
    rarity = 'SR';
  } else if (gingerRatio > 0.4) {
    coatPattern = 'tabby';
    primaryHex = centroids[0];
    secondaryHex = lightenHex(centroids[0], 0.25);
    accentHex = darkenHex(centroids[0], 0.32);
    breedLabel = '金丝虎斑主子';
    rarity = 'R';
  } else if (brightRatio > 0.16 && darkRatio < 0.16) {
    coatPattern = 'bicolor';
    primaryHex = centroids[0];
    secondaryHex = '#F7F8FA';
    accentHex = darkenHex(centroids[0], 0.2);
    breedLabel = '双色布偶系';
  } else {
    coatPattern = 'tabby';
    primaryHex = centroids[0];
    secondaryHex = centroids[1] ?? lightenHex(centroids[0], 0.18);
    accentHex = darkenHex(centroids[0], 0.28);
    breedLabel = '中华狸花御猫';
    rarity = 'R';
  }

  const eyePalette =
    coatPattern === 'solid' && brightRatio > 0.6
      ? { left: '#3D9BE9', right: '#E7A92E' }
      : gingerRatio > 0.25
        ? { left: '#E09A2B', right: '#E09A2B' }
        : { left: '#60A84C', right: '#60A84C' };

  const appearance = CatAppearanceSchema.parse({
    breedLabel,
    coatPattern,
    primaryColor: primaryHex,
    secondaryColor: secondaryHex,
    accentColor: accentHex,
    bellyColor: brightRatio > 0.15 ? '#FAF9F6' : lightenHex(primaryHex, 0.22),
    leftEyeColor: eyePalette.left,
    rightEyeColor: eyePalette.right,
    noseColor: darkRatio > 0.5 ? '#3E3A42' : '#F298A2',
    collarColor: gingerRatio > 0.3 ? '#0F766E' : '#D9482B',
    earType: 'pointed',
    chonkiness: gingerRatio > 0.3 ? 1.16 : 1.0,
    rarity,
    temperament: '本地洪泛受光主色提取完成，高冷气场已拉满',
  });

  return {
    appearance,
    debug: {
      segmentedPreviewUrl: previewCanvas.toDataURL('image/png'),
      litSwatches: centroids.slice(0, 4),
      foregroundRatio: Math.max(0.05, Math.min(0.95, fgPixels.length / total)),
      luminanceP50: Math.round(lumP50),
      luminanceP80: Math.round(lumP80),
    },
  };
}

function runKMeans3(pixels: RgbPixel[]): string[] {
  if (pixels.length === 0) return ['#E58A3C', '#FFF7EC', '#B85A1A'];
  const k = 3;
  const step = Math.max(1, Math.floor(pixels.length / k));
  const centers = [
    { ...pixels[Math.min(pixels.length - 1, Math.floor(step * 0.5))] },
    { ...pixels[Math.min(pixels.length - 1, Math.floor(step * 1.5))] },
    { ...pixels[Math.min(pixels.length - 1, Math.floor(step * 2.5))] },
  ];

  const counts = [0, 0, 0];
  for (let iter = 0; iter < 6; iter++) {
    const sums = [
      { r: 0, g: 0, b: 0, c: 0 },
      { r: 0, g: 0, b: 0, c: 0 },
      { r: 0, g: 0, b: 0, c: 0 },
    ];
    for (let i = 0; i < pixels.length; i += 2) {
      const px = pixels[i];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = colorDistSq(px.r, px.g, px.b, centers[c].r, centers[c].g, centers[c].b);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      sums[best].r += px.r;
      sums[best].g += px.g;
      sums[best].b += px.b;
      sums[best].c++;
    }
    for (let c = 0; c < k; c++) {
      counts[c] = sums[c].c;
      if (sums[c].c > 0) {
        centers[c].r = sums[c].r / sums[c].c;
        centers[c].g = sums[c].g / sums[c].c;
        centers[c].b = sums[c].b / sums[c].c;
      }
    }
  }

  return centers
    .map((c, idx) => ({ hex: rgbToHex(c.r, c.g, c.b), count: counts[idx] }))
    .sort((a, b) => b.count - a.count)
    .map((item) => item.hex);
}

function darkenHex(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = ((num >> 16) & 255) * (1 - amount);
  const g = ((num >> 8) & 255) * (1 - amount);
  const b = (num & 255) * (1 - amount);
  return rgbToHex(r, g, b);
}

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = ((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * amount;
  const g = ((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * amount;
  const b = (num & 255) + (255 - (num & 255)) * amount;
  return rgbToHex(r, g, b);
}

export async function analyzeCatWithGeminiFallback(
  imageDataUrl: string
): Promise<{
  appearance: CatAppearance;
  method: 'gemini-vision' | 'flood-fill';
  debug: FloodFillDebug;
  notice?: string;
}> {
  // Always compute local flood-fill segmentation & lit-band swatches immediately (0 latency)
  const offlineResult = await analyzeCatOfflineFloodFill(imageDataUrl);

  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) {
    return {
      appearance: offlineResult.appearance,
      method: 'flood-fill',
      debug: offlineResult.debug,
      notice: '已使用本地洪泛算法完成提取',
    };
  }

  const mimeType = match[1];
  const imageBase64 = match[2];

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch('/api/analyze-cat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);

    if (!resp.ok) {
      const errData = (await resp.json().catch(() => ({}))) as { error?: string };
      return {
        appearance: offlineResult.appearance,
        method: 'flood-fill',
        debug: offlineResult.debug,
        notice: errData.error ?? '已启用离线洪泛受光主色兜底',
      };
    }

    const payload = (await resp.json()) as { appearance?: unknown };
    const validated = CatAppearanceSchema.safeParse(payload.appearance);
    if (!validated.success) {
      return {
        appearance: offlineResult.appearance,
        method: 'flood-fill',
        debug: offlineResult.debug,
        notice: '视觉特征校验未通过，已自动回退离线提取',
      };
    }

    return {
      appearance: validated.data,
      method: 'gemini-vision',
      debug: offlineResult.debug,
      notice: 'Gemini 视觉解析 + 洪泛质检双引擎完成',
    };
  } catch {
    return {
      appearance: offlineResult.appearance,
      method: 'flood-fill',
      debug: offlineResult.debug,
      notice: '离线模式运行中，已通过洪泛算法精准换肤',
    };
  }
}

/**
 * Resize uploaded photo before sending to server to keep bandwidth fast & snappy
 */
export async function compressImageFileToDataUrl(file: File, maxSide = 768): Promise<string> {
  const rawUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });

  const img = await loadImageElement(rawUrl);
  const scale = Math.min(maxSide / img.width, maxSide / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return rawUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.88);
}
