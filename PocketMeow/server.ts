import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
});

const VisionResponseSchema = z.object({
  breed: z.string().min(1).max(32),
  coatPattern: z.enum(['solid', 'tuxedo', 'bicolor', 'tabby', 'calico', 'tortoiseshell', 'siamese', 'spotted']),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  noseColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  leftEyeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  rightEyeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  earStyle: z.enum(['pointed', 'folded', 'rounded', 'tufted']),
  chubbiness: z.number().min(0.78).max(1.35),
  rarity: z.enum(['R', 'SR', 'SSR', 'UR']),
  personalityTag: z.string().min(1).max(24),
  snarkyBio: z.string().min(1).max(120),
  confidenceNote: z.string().max(120).optional(),
});

const QuoteListSchema = z.array(
  z.object({
    id: z.string().min(1),
    intent: z.enum(['demanding_food', 'affectionate_purr', 'annoyed_hiss', 'curious_chirp', 'bored_sigh', 'philosophical_stare']),
    text: z.string().min(2).max(100),
    moodReward: z.enum(['idle', 'listening', 'happy', 'proud', 'sleepy', 'angry', 'hungry']),
    decreeTitle: z.string().min(2).max(20),
  })
).min(10).max(60);

app.post('/api/pocket-meow/analyze-cat', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }
    const parsedBody = z.object({ imageDataUrl: z.string().min(32) }).safeParse(req.body);
    if (!parsedBody.success) return res.status(400).json({ success: false, error: 'Invalid image payload' });

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(parsedBody.data.imageDataUrl);
    if (!match) return res.status(400).json({ success: false, error: 'Expected base64 image data URL' });

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          { inlineData: { mimeType: match[1], data: match[2] } },
          { text: 'Analyze this cat photo for a 3D stylized low-poly cat avatar. Accurately identify coat pattern, lit-surface fur hex colors (keep white cats warm pearl #F5F2EB+), eye colors including heterochromia, ear shape, chubbiness (0.85 to 1.3), rarity tier, and write a witty tsundere Chinese bio under 55 characters.' },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            breed: { type: Type.STRING },
            coatPattern: { type: Type.STRING, enum: ['solid', 'tuxedo', 'bicolor', 'tabby', 'calico', 'tortoiseshell', 'siamese', 'spotted'] },
            primaryColor: { type: Type.STRING },
            secondaryColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            noseColor: { type: Type.STRING },
            leftEyeColor: { type: Type.STRING },
            rightEyeColor: { type: Type.STRING },
            earStyle: { type: Type.STRING, enum: ['pointed', 'folded', 'rounded', 'tufted'] },
            chubbiness: { type: Type.NUMBER },
            rarity: { type: Type.STRING, enum: ['R', 'SR', 'SSR', 'UR'] },
            personalityTag: { type: Type.STRING },
            snarkyBio: { type: Type.STRING },
            confidenceNote: { type: Type.STRING },
          },
          required: ['breed', 'coatPattern', 'primaryColor', 'secondaryColor', 'accentColor', 'noseColor', 'leftEyeColor', 'rightEyeColor', 'earStyle', 'chubbiness', 'rarity', 'personalityTag', 'snarkyBio'],
        },
      },
    });
    const validated = VisionResponseSchema.parse(JSON.parse((response.text ?? '{}').trim()));
    return res.json({ success: true, data: validated });
  } catch {
    return res.status(500).json({ success: false, error: 'Vision analysis failed' });
  }
});

app.post('/api/pocket-meow/generate-quotes', async (req: Request, res: Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY not configured' });
    }
    const parsedBody = z.object({ catName: z.string().min(1), breed: z.string().min(1), personalityTag: z.string().min(1) }).safeParse(req.body);
    if (!parsedBody.success) return res.status(400).json({ success: false, error: 'Invalid quote request' });

    const { catName, breed, personalityTag } = parsedBody.data;
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `为一只名叫「${catName}」的「${breed}」（性格：${personalityTag}）生成 30 条中文傲娇/毒舌/治愈猫语语录，覆盖 6 种意图：demanding_food, affectionate_purr, annoyed_hiss, curious_chirp, bored_sigh, philosophical_stare。`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              intent: { type: Type.STRING, enum: ['demanding_food', 'affectionate_purr', 'annoyed_hiss', 'curious_chirp', 'bored_sigh', 'philosophical_stare'] },
              text: { type: Type.STRING },
              moodReward: { type: Type.STRING, enum: ['idle', 'listening', 'happy', 'proud', 'sleepy', 'angry', 'hungry'] },
              decreeTitle: { type: Type.STRING },
            },
            required: ['id', 'intent', 'text', 'moodReward', 'decreeTitle'],
          },
        },
      },
    });
    const validated = QuoteListSchema.parse(JSON.parse((response.text ?? '[]').trim()));
    return res.json({ success: true, quotes: validated });
  } catch {
    return res.status(500).json({ success: false, error: 'Quote generation failed' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(__dirname, 'dist');
  if (isProd && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`[PocketMeow] Running on http://0.0.0.0:${PORT}`));
}
startServer();
