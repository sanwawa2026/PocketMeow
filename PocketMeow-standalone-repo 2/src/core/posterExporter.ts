import { CatProfile, MeowTranslationResult } from '../schemas/catSchema';

function wrapChineseText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = chars[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export async function generateSharePosterDataUrl(params: {
  snapshotDataUrl: string;
  profile: CatProfile;
  translation: MeowTranslationResult | null;
}): Promise<string> {
  const { snapshotDataUrl, profile, translation } = params;

  const width = 1080;
  const height = 1520;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Clean gallery backdrop
  ctx.fillStyle = '#F2F4F8';
  ctx.fillRect(0, 0, width, height);

  // Outer collectible card
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(48, 48, width - 96, height - 96, 36);
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header metadata row
  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  ctx.fillStyle = '#64748B';
  ctx.font = '600 24px "Plus Jakarta Sans", "Noto Sans SC", sans-serif';
  ctx.fillText(`POCKETMEOW 口袋主子 · ${today}`, 96, 118);

  // Rarity stamp (SSR / UR / SR / R)
  const rarityColors: Record<string, string> = {
    UR: '#D97706',
    SSR: '#0F766E',
    SR: '#2563EB',
    R: '#475569',
  };
  const badgeColor = rarityColors[profile.rarity] ?? '#0F766E';
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.roundRect(width - 230, 76, 134, 58, 14);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(profile.rarity, width - 163, 115);
  ctx.textAlign = 'left';

  // 3D Cat Snapshot Frame
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('3D 画面抓取失败'));
    el.src = snapshotDataUrl;
  });

  const frameX = 96;
  const frameY = 160;
  const frameW = width - 192;
  const frameH = 720;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameW, frameH, 24);
  ctx.clip();

  // Center-crop image into 888x720 frame
  const imgAspect = img.width / img.height;
  const frameAspect = frameW / frameH;
  let drawW = frameW;
  let drawH = frameH;
  let drawX = frameX;
  let drawY = frameY;
  if (imgAspect > frameAspect) {
    drawW = frameH * imgAspect;
    drawX = frameX - (drawW - frameW) / 2;
  } else {
    drawH = frameW / imgAspect;
    drawY = frameY - (drawH - frameH) / 2;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameW, frameH, 24);
  ctx.stroke();

  // Cat Name & Breed
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 52px "Noto Sans SC", sans-serif';
  ctx.fillText(profile.name, 96, 956);

  ctx.fillStyle = '#475569';
  ctx.font = '500 28px "Noto Sans SC", sans-serif';
  ctx.fillText(`${profile.breed} · ${profile.personalityTag}`, 96, 1004);

  // Coat Palette Swatches (Primary, Secondary, Accent, Left Eye)
  const swatches = [
    { label: '主毛色', hex: profile.primaryColor },
    { label: '副毛色', hex: profile.secondaryColor },
    { label: '纹路色', hex: profile.accentColor },
    { label: '左瞳', hex: profile.leftEyeColor },
  ];
  swatches.forEach((sw, idx) => {
    const sx = 96 + idx * 224;
    const sy = 1044;
    ctx.fillStyle = sw.hex;
    ctx.beginPath();
    ctx.roundRect(sx, sy, 48, 48, 12);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '500 20px "Noto Sans SC", sans-serif';
    ctx.fillText(sw.label, sx + 62, sy + 20);
    ctx.fillStyle = '#0F172A';
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillText(sw.hex, sx + 62, sy + 44);
  });

  // Divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 1134);
  ctx.lineTo(width - 96, 1134);
  ctx.stroke();

  // Today's Meow Decree / Snarky Quote
  const decreeTitle = translation ? `今日圣旨 · ${translation.quote.decreeTitle}` : '主子御批';
  const decreeQuote = translation ? `“${translation.quote.text}”` : `“${profile.snarkyBio}”`;

  ctx.fillStyle = badgeColor;
  ctx.font = '700 26px "Noto Sans SC", sans-serif';
  ctx.fillText(decreeTitle, 96, 1188);

  ctx.fillStyle = '#0F172A';
  ctx.font = '600 38px "Noto Sans SC", sans-serif';
  wrapChineseText(ctx, decreeQuote, 96, 1252, width - 192, 54);

  // Footer acoustic telemetry or signature
  ctx.fillStyle = '#64748B';
  ctx.font = '500 22px "JetBrains Mono", "Noto Sans SC", sans-serif';
  const footerText = translation
    ? `基频 ${translation.acoustics.pitchHz} Hz · 质心 ${translation.acoustics.spectralCentroidHz} Hz · ${translation.rarityBonusLabel}`
    : `毛色评级 ${profile.rarity} · 口袋主子 3D 赛博伴侣`;
  ctx.fillText(footerText, 96, height - 92);

  return canvas.toDataURL('image/png');
}
