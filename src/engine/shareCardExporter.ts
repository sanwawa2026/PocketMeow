import { type CatProfile, type SassyQuote } from '../schemas/cat';

export interface DecreeCardInput {
  snapshotDataUrl: string;
  cat: CatProfile;
  quote: SassyQuote;
}

function wrapChineseText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders a crisp 1080x1440 collectible PNG poster combining live 3D cat render + rarity + Imperial Decree quote
 */
export async function renderImperialDecreePoster(input: DecreeCardInput): Promise<string> {
  const W = 1080;
  const H = 1440;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建海报画布');
  }

  // Editorial warm ivory card stock background
  ctx.fillStyle = '#F7F5F0';
  ctx.fillRect(0, 0, W, H);

  // Subtle architectural border frame
  ctx.strokeStyle = '#181B22';
  ctx.lineWidth = 4;
  roundRectPath(ctx, 44, 44, W - 88, H - 88, 36);
  ctx.stroke();

  // Top Header Strip
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

  ctx.fillStyle = '#181B22';
  ctx.font = '700 32px "Outfit", "Noto Sans SC", sans-serif';
  ctx.fillText('POCKETMEOW 口袋主子', 92, 118);

  ctx.fillStyle = '#6B7280';
  ctx.font = '500 24px "JetBrains Mono", monospace';
  const rightMeta = `${dateStr} · ${input.cat.appearance.rarity} 级御猫`;
  const rightW = ctx.measureText(rightMeta).width;
  ctx.fillText(rightMeta, W - 92 - rightW, 116);

  // Hairline divider
  ctx.strokeStyle = 'rgba(24, 27, 34, 0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(92, 148);
  ctx.lineTo(W - 92, 148);
  ctx.stroke();

  // 3D Cat Snapshot Viewport
  const imgX = 92;
  const imgY = 184;
  const imgW = W - 184;
  const imgH = 680;

  ctx.save();
  roundRectPath(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.clip();

  const img = new Image();
  img.src = input.snapshotDataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('快照渲染失败'));
  });

  // Cover-fit 3D snapshot inside viewport
  const scale = Math.max(imgW / img.width, imgH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, imgX + (imgW - dw) / 2, imgY + (imgH - dh) / 2, dw, dh);
  ctx.restore();

  // Thin frame around snapshot
  ctx.strokeStyle = 'rgba(24, 27, 34, 0.12)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, imgX, imgY, imgW, imgH, 28);
  ctx.stroke();

  // Cat Name & Breed Metadata
  ctx.fillStyle = '#14171F';
  ctx.font = '700 54px "Outfit", "Noto Sans SC", sans-serif';
  ctx.fillText(input.cat.name, 92, 948);

  ctx.fillStyle = '#525866';
  ctx.font = '500 28px "Plus Jakarta Sans", "Noto Sans SC", sans-serif';
  ctx.fillText(
    `${input.cat.appearance.breedLabel}  ·  ${input.quote.decreeTitle}`,
    92,
    998
  );

  // Coat swatches strip (right-aligned next to name)
  const swatches = [
    input.cat.appearance.primaryColor,
    input.cat.appearance.secondaryColor,
    input.cat.appearance.accentColor,
    input.cat.appearance.leftEyeColor,
  ];
  swatches.forEach((hex, i) => {
    const cx = W - 92 - (swatches.length - 1 - i) * 48 - 18;
    const cy = 934;
    ctx.fillStyle = hex;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Imperial Decree Quote Box
  ctx.fillStyle = '#FFFFFF';
  roundRectPath(ctx, 92, 1036, W - 184, 240, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(24, 27, 34, 0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Imperial red stamp accent (clean editorial square seal)
  ctx.fillStyle = '#D9482B';
  roundRectPath(ctx, 130, 1076, 68, 68, 12);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 24px "Noto Sans SC", sans-serif';
  ctx.fillText('圣旨', 140, 1118);

  // Wrapped quote text
  ctx.fillStyle = '#14171F';
  ctx.font = '600 34px "Noto Sans SC", sans-serif';
  const lines = wrapChineseText(ctx, `“${input.quote.text}”`, W - 340);
  lines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, 224, 1118 + idx * 52);
  });

  // Footer
  ctx.fillStyle = '#6B7280';
  ctx.font = '500 22px "Plus Jakarta Sans", "Noto Sans SC", sans-serif';
  ctx.fillText('今日宜：按时进贡小鱼干，切忌擅自摸肚皮', 92, 1348);

  const methodTag =
    input.cat.sourceMethod === 'gemini-vision'
      ? 'AI 视觉真猫复刻'
      : input.cat.sourceMethod === 'flood-fill'
        ? '离线洪泛受光复刻'
        : '御猫档案馆藏';
  const mW = ctx.measureText(methodTag).width;
  ctx.fillText(methodTag, W - 92 - mW, 1348);

  return canvas.toDataURL('image/png');
}
