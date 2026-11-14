import {
  CatCoatPattern,
  CatProfile,
  CatProfileSchema,
  VisionApiResultSchema,
} from '../schemas/catSchema';

export interface FloodFillDiagnostics {
  width: number;
  height: number;
  totalPixels: number;
  backgroundRemovedPercent: number;
  foregroundPixelsUsed: number;
  meanLuminance: number;
  dominantColors: string[];
  processingTimeMs: number;
}

export interface OfflineVisionExtraction {
  profile: CatProfile;
  diagnostics: FloodFillDiagnostics;
  previewMaskDataUrl: string;
}

interface RgbPixel {
  r: number;
  g: number;
  b: number;
  lum: number;
  sat: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function relativeLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Simple deterministic k-means (k=3) on filtered lit-surface pixels
 */
function kMeansCluster(pixels: RgbPixel[], k: number): Array<{ r: number; g: number; b: number; count: number; lum: number; sat: number }> {
  if (pixels.length === 0) {
    return [{ r: 245, g: 242, b: 235, count: 1, lum: 0.95, sat: 0.04 }];
  }

  // Deterministic spread initialization sorted by luminance
  const sorted = [...pixels].sort((a, b) => a.lum - b.lum);
  const centroids: Array<{ r: number; g: number; b: number }> = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.min(sorted.length - 1, Math.floor(((i + 0.5) / k) * sorted.length));
    centroids.push({ r: sorted[idx].r, g: sorted[idx].g, b: sorted[idx].b });
  }

  const assignments = new Int32Array(pixels.length);

  for (let iter = 0; iter < 8; iter++) {
    const sums = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      let bestC = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = colorDistance(p.r, p.g, p.b, centroids[c].r, centroids[c].g, centroids[c].b);
        if (d < bestDist) {
          bestDist = d;
          bestC = c;
        }
      }
      assignments[i] = bestC;
      sums[bestC].r += p.r;
      sums[bestC].g += p.g;
      sums[bestC].b += p.b;
      sums[bestC].count += 1;
    }

    for (let c = 0; c < k; c++) {
      if (sums[c].count > 0) {
        centroids[c].r = sums[c].r / sums[c].count;
        centroids[c].g = sums[c].g / sums[c].count;
        centroids[c].b = sums[c].b / sums[c].count;
      }
    }
  }

  const finalClusters = centroids.map((c, idx) => {
    let count = 0;
    for (let i = 0; i < assignments.length; i++) {
      if (assignments[i] === idx) count++;
    }
    return {
      r: c.r,
      g: c.g,
      b: c.b,
      count,
      lum: relativeLuminance(c.r, c.g, c.b),
      sat: rgbSaturation(c.r, c.g, c.b),
    };
  });

  return finalClusters
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * 阶段 2 离线兜底视觉管线：
 * 1) 边缘洪泛填充（Edge Flood Fill）去除背景像素，避免浅色背景/深色地板污染猫毛主色；
 * 2) 像素亮度中上段 50–80 分位提取受光面主色，精准还原纯白猫、纯黑猫与三花/橘猫毛色。
 */
export async function runOfflineFloodFillAnalysis(
  imageDataUrl: string,
  customName?: string
): Promise<OfflineVisionExtraction> {
  const start = performance.now();

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('无法读取上传的图片文件'));
    el.src = imageDataUrl;
  });

  const maxDim = 144;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(32, Math.round(img.width * scale));
  const h = Math.max(32, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D 上下文初始化失败');
  }

  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const totalPixels = w * h;

  // Estimate border background reference via 4 corners + edge samples
  const cornerSamples: Array<[number, number, number]> = [];
  const sampleCoords = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [0, Math.floor(h / 2)],
    [w - 1, Math.floor(h / 2)],
  ];
  for (const [sx, sy] of sampleCoords) {
    const i = (sy * w + sx) * 4;
    cornerSamples.push([data[i], data[i + 1], data[i + 2]]);
  }

  // BFS Flood Fill from all 4 edges
  const isBg = new Uint8Array(totalPixels);
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueue = (x: number, y: number) => {
    const idx = y * w + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = 0; x < w; x++) {
    enqueue(x, 0);
    enqueue(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    enqueue(0, y);
    enqueue(w - 1, y);
  }

  const bgTolerance = 42;
  const neighborTolerance = 26;

  const matchesCorner = (r: number, g: number, b: number): boolean => {
    for (let s = 0; s < cornerSamples.length; s++) {
      const [sr, sg, sb] = cornerSamples[s];
      if (colorDistance(r, g, b, sr, sg, sb) < bgTolerance) return true;
    }
    return false;
  };

  while (head < tail) {
    const idx = queue[head++];
    const pIdx = idx * 4;
    const r = data[pIdx];
    const g = data[pIdx + 1];
    const b = data[pIdx + 2];

    const x = idx % w;
    const y = Math.floor(idx / w);
    const onEdge = x === 0 || x === w - 1 || y === 0 || y === h - 1;

    if (onEdge && matchesCorner(r, g, b)) {
      isBg[idx] = 1;
    } else if (!isBg[idx]) {
      continue;
    }

    const dirs = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    for (const [nx, ny] of dirs) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nIdx = ny * w + nx;
      if (visited[nIdx]) continue;
      const np = nIdx * 4;
      const nr = data[np];
      const ng = data[np + 1];
      const nb = data[np + 2];
      if (colorDistance(r, g, b, nr, ng, nb) < neighborTolerance || matchesCorner(nr, ng, nb)) {
        visited[nIdx] = 1;
        isBg[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }
  }

  // Collect foreground pixels; fallback to central ellipse if flood fill removed > 86%
  let bgCount = 0;
  for (let i = 0; i < totalPixels; i++) if (isBg[i]) bgCount++;
  const useCenterFallback = bgCount > totalPixels * 0.86;

  const fgPixels: RgbPixel[] = [];
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext('2d');
  const maskImg = maskCtx ? maskCtx.createImageData(w, h) : null;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const pIdx = idx * 4;
      const r = data[pIdx];
      const g = data[pIdx + 1];
      const b = data[pIdx + 2];

      const dx = (x - w / 2) / (w * 0.34);
      const dy = (y - h / 2) / (h * 0.36);
      const inCenter = dx * dx + dy * dy <= 1;

      const isForeground = useCenterFallback ? inCenter : !isBg[idx];
      if (isForeground) {
        fgPixels.push({
          r,
          g,
          b,
          lum: relativeLuminance(r, g, b),
          sat: rgbSaturation(r, g, b),
        });
        if (maskImg) {
          maskImg.data[pIdx] = r;
          maskImg.data[pIdx + 1] = g;
          maskImg.data[pIdx + 2] = b;
          maskImg.data[pIdx + 3] = 255;
        }
      } else if (maskImg) {
        maskImg.data[pIdx] = 226;
        maskImg.data[pIdx + 1] = 232;
        maskImg.data[pIdx + 2] = 240;
        maskImg.data[pIdx + 3] = 70;
      }
    }
  }

  if (maskCtx && maskImg) {
    maskCtx.putImageData(maskImg, 0, 0);
  }

  // Sort foreground by luminance and pick 50-80th percentile "lit surface" band
  const sortedByLum = [...fgPixels].sort((a, b) => a.lum - b.lum);
  const p50 = Math.floor(sortedByLum.length * 0.5);
  const p80 = Math.max(p50 + 1, Math.floor(sortedByLum.length * 0.8));
  const litBand = sortedByLum.slice(p50, p80);

  const clusters = kMeansCluster(litBand.length >= 16 ? litBand : fgPixels, 3);
  const allClusters = kMeansCluster(fgPixels, 3);

  const primary = clusters[0];
  const secondary = clusters[1] ?? allClusters[1] ?? primary;
  const accent = allClusters[allClusters.length - 1] ?? secondary;

  // White cat / Black cat accuracy guardrails
  const avgLitLum = litBand.reduce((acc, p) => acc + p.lum, 0) / Math.max(1, litBand.length);
  const avgLitSat = litBand.reduce((acc, p) => acc + p.sat, 0) / Math.max(1, litBand.length);

  let primaryHex = rgbToHex(primary.r, primary.g, primary.b);
  let secondaryHex = rgbToHex(secondary.r, secondary.g, secondary.b);
  let accentHex = rgbToHex(accent.r, accent.g, accent.b);
  let coatPattern: CatCoatPattern = 'bicolor';
  let breed = '中华田园定制猫';

  if (avgLitLum > 0.72 && avgLitSat < 0.16) {
    // Pure White / Cream White Cat guard: prevent shadowed gray misjudgment
    primaryHex = rgbToHex(
      Math.max(238, primary.r),
      Math.max(235, primary.g),
      Math.max(228, primary.b)
    );
    secondaryHex = '#ECE7DD';
    accentHex = '#DCD5C7';
    coatPattern = 'solid';
    breed = '纯白雪团主子';
  } else if (avgLitLum < 0.24 && allClusters[0].lum < 0.28) {
    // Pure Black Cat guard
    primaryHex = '#1F222A';
    secondaryHex = '#323744';
    accentHex = '#13151B';
    coatPattern = 'solid';
    breed = '墨玉黑猫宗师';
  } else {
    const spread = colorDistance(
      allClusters[0].r,
      allClusters[0].g,
      allClusters[0].b,
      accent.r,
      accent.g,
      accent.b
    );
    if (allClusters.length >= 3 && spread > 110 && primary.sat > 0.25) {
      coatPattern = 'calico';
      breed = '三花/多彩花猫';
    } else if (primary.sat > 0.34 && primary.r > primary.b * 1.3) {
      coatPattern = 'tabby';
      breed = '橘白/虎斑小主';
      secondaryHex = '#FAF5EC';
    } else if (spread > 90 && (allClusters[0].lum > 0.65 || accent.lum < 0.28)) {
      coatPattern = 'tuxedo';
      breed = '奶牛/双色绅士';
    } else if (spread < 45) {
      coatPattern = 'solid';
      breed = '纯色绒毛猫';
    } else {
      coatPattern = 'tabby';
      breed = '狸花/云纹猫';
    }
  }

  const eyePalette =
    avgLitLum > 0.72
      ? { left: '#38BDF8', right: '#F59E0B' }
      : primary.sat > 0.3
      ? { left: '#D97706', right: '#D97706' }
      : { left: '#22C55E', right: '#22C55E' };

  const profile = CatProfileSchema.parse({
    id: `scan-${Date.now()}`,
    name: customName?.trim() || '本尊主子',
    breed,
    coatPattern,
    primaryColor: primaryHex,
    secondaryColor: secondaryHex,
    accentColor: accentHex,
    noseColor: avgLitLum < 0.24 ? '#3E3E48' : '#F29CA8',
    leftEyeColor: eyePalette.left,
    rightEyeColor: eyePalette.right,
    earStyle: 'pointed',
    chubbiness: 1.04,
    rarity: coatPattern === 'calico' ? 'UR' : avgLitLum > 0.72 ? 'SSR' : 'SR',
    personalityTag: '本地极速识图还原',
    snarkyBio: '边缘洪泛去背＋中上段受光面取色已完成，本喵的真实盛世美颜岂容像素误差？',
    analysisSource: 'offline-floodfill',
    confidenceNote: `去背 ${Math.round((bgCount / totalPixels) * 100)}% · 50-80分位亮度 ${Math.round(avgLitLum * 100)}%`,
  });

  const elapsed = Math.round((performance.now() - start) * 10) / 10;

  return {
    profile,
    diagnostics: {
      width: w,
      height: h,
      totalPixels,
      backgroundRemovedPercent: Math.round((bgCount / totalPixels) * 100),
      foregroundPixelsUsed: litBand.length,
      meanLuminance: Math.round(avgLitLum * 100) / 100,
      dominantColors: [primaryHex, secondaryHex, accentHex],
      processingTimeMs: elapsed,
    },
    previewMaskDataUrl: maskCanvas.toDataURL('image/png'),
  };
}

/**
 * 联网增强解析：在本地 0ms 换肤后，后台请求服务端 Gemini 4 Hydrogen 视觉模型进行高阶毛色/瞳孔/耳型/体型与毒舌性格解析。
 */
export async function enhanceCatWithGeminiVision(
  imageDataUrl: string,
  baseProfile: CatProfile
): Promise<CatProfile | null> {
  try {
    const res = await fetch('/api/pocket-meow/analyze-cat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
    });

    if (!res.ok) return null;
    const payload = (await res.json()) as { success?: boolean; data?: unknown };
    if (!payload.success || !payload.data) return null;

    const validated = VisionApiResultSchema.parse(payload.data);
    return CatProfileSchema.parse({
      ...baseProfile,
      ...validated,
      analysisSource: 'gemini-vision',
    });
  } catch {
    return null;
  }
}
