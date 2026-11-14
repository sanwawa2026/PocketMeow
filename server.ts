import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';
import { CatAppearanceSchema, SassyQuoteSchema } from './src/schemas/cat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: '12mb' }));

const AnalyzeCatRequestSchema = z.object({
  imageBase64: z.string().min(20),
  mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp|heic)$/i),
});

const GenerateQuotesRequestSchema = z.object({
  catName: z.string().min(1).max(20),
  breed: z.string().min(1).max(32),
  temperament: z.string().min(1).max(80),
});

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
  });
});

app.post('/api/analyze-cat', async (req: Request, res: Response) => {
  const parsedBody = AnalyzeCatRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: '无效的图片输入格式', details: parsedBody.error.flatten() });
    return;
  }

  const ai = createGeminiClient();
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY 未配置，已自动切换本地离线洪泛换肤。' });
    return;
  }

  try {
    const { imageBase64, mimeType } = parsedBody.data;
    const prompt = [
      '你是一名专业宠物造型师兼 3D 角色材质总监。请仔细分析这张猫咪照片，提取最精准的 3D 换肤参数。',
      '注意：',
      '1. 如果照片是白猫在阴影中，请还原其真实受光面纯白毛色 (#F4F6F9 等)，切勿误判为深灰！',
      '2. 如果照片是黑猫，请保留深炭黑质感 (#1F2229 等)，不要拍成纯黑死区。',
      '3. 请准确区分 coatPattern: solid(纯色), bicolor(双色如橘白/蓝白), tabby(虎斑/狸花), calico(三花), tortoiseshell(玳瑁), tuxedo(奶牛/燕尾服), siamese(重点色)。',
      '4. 如果有异瞳，请分别给出 leftEyeColor 和 rightEyeColor 十六进制色值。',
      '5. chonkiness 范围 0.75(苗条) 到 1.35(圆润大橘)。',
      '6. rarity 根据花色稀有度与神态评定 SSR / SR / R。',
      '7. temperament 用一句简短毒舌又可爱的中文描述它的主子性格（不超过 35 字）。',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            breedLabel: { type: Type.STRING, description: '简短中文品种与花色名称，如：中华田园三花' },
            coatPattern: {
              type: Type.STRING,
              enum: ['solid', 'bicolor', 'tabby', 'calico', 'tortoiseshell', 'tuxedo', 'siamese'],
            },
            primaryColor: { type: Type.STRING, description: '主毛色 #RRGGBB' },
            secondaryColor: { type: Type.STRING, description: '次毛色/白手套/花斑色 #RRGGBB' },
            accentColor: { type: Type.STRING, description: '斑纹/深色点缀色 #RRGGBB' },
            bellyColor: { type: Type.STRING, description: '胸腹绒毛色 #RRGGBB' },
            leftEyeColor: { type: Type.STRING, description: '左眼虹膜 #RRGGBB' },
            rightEyeColor: { type: Type.STRING, description: '右眼虹膜 #RRGGBB' },
            noseColor: { type: Type.STRING, description: '鼻头颜色 #RRGGBB' },
            collarColor: { type: Type.STRING, description: '推荐搭配项圈颜色 #RRGGBB' },
            earType: {
              type: Type.STRING,
              enum: ['pointed', 'folded', 'curled', 'tufted'],
            },
            chonkiness: { type: Type.NUMBER, description: '体型胖瘦系数 0.75 到 1.35' },
            rarity: { type: Type.STRING, enum: ['SSR', 'SR', 'R'] },
            temperament: { type: Type.STRING, description: '一句简短毒舌主子性格点评' },
          },
          required: [
            'breedLabel',
            'coatPattern',
            'primaryColor',
            'secondaryColor',
            'accentColor',
            'bellyColor',
            'leftEyeColor',
            'rightEyeColor',
            'noseColor',
            'collarColor',
            'earType',
            'chonkiness',
            'rarity',
            'temperament',
          ],
        },
      },
    });

    const rawJson = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
    const normalizeHex = (val: unknown, fallback: string): string => {
      if (typeof val !== 'string') return fallback;
      let s = val.trim().replace(/^0x/i, '').replace(/^#/, '').toUpperCase();
      if (/^[0-9A-F]{3}$/.test(s)) {
        s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
      }
      if (/^[0-9A-F]{6}$/.test(s)) return `#${s}`;
      return fallback;
    };
    const normalized = {
      ...rawJson,
      primaryColor: normalizeHex(rawJson.primaryColor, '#E58A3C'),
      secondaryColor: normalizeHex(rawJson.secondaryColor, '#FFF7EC'),
      accentColor: normalizeHex(rawJson.accentColor, '#B85A1A'),
      bellyColor: normalizeHex(rawJson.bellyColor, '#FFFDF8'),
      leftEyeColor: normalizeHex(rawJson.leftEyeColor, '#E59D2C'),
      rightEyeColor: normalizeHex(rawJson.rightEyeColor, '#E59D2C'),
      noseColor: normalizeHex(rawJson.noseColor, '#F29B9B'),
      collarColor: normalizeHex(rawJson.collarColor, '#D9482B'),
    };
    const validated = CatAppearanceSchema.safeParse(normalized);
    if (!validated.success) {
      res.status(422).json({ error: 'AI 返回的特征结构校验失败', details: validated.error.flatten() });
      return;
    }

    res.json({ appearance: validated.data });
  } catch (err) {
    console.error('[analyze-cat] Gemini API error:', err);
    res.status(500).json({ error: '视觉识图请求失败，已自动降级为本地洪泛换肤。' });
  }
});

app.post('/api/generate-quotes', async (req: Request, res: Response) => {
  const parsedBody = GenerateQuotesRequestSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: '请求参数格式有误' });
    return;
  }

  const ai = createGeminiClient();
  if (!ai) {
    res.status(503).json({ error: 'GEMINI_API_KEY 未配置，使用本地精选毒舌语录库。' });
    return;
  }

  try {
    const { catName, breed, temperament } = parsedBody.data;
    const prompt = [
      `你现在是名叫「${catName}」的猫咪主子，品种/花色是「${breed}」，性格特征：「${temperament}」。`,
      '请以第一人称“朕”或高冷猫咪口吻，批量创作 30 条风格鲜明、傲娇毒舌又不失可爱的中文猫语翻译语录。',
      '要求：',
      '- 每条 text 控制在 12~45 字之间，有画面感、带生活槽点（铲屎、加罐头、加班、摸肚子、凌晨跑酷、快递纸箱等）。',
      '- 每条附带一个 4~8 字的 decreeTitle（圣旨标题，例如：赐罐头旨、宵禁御令、勉强准奏）。',
      '- 均匀覆盖 6 种情绪：demanding, annoyed, affectionate, hungry, sleepy, philosophical。',
    ].join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              emotion: {
                type: Type.STRING,
                enum: ['demanding', 'annoyed', 'affectionate', 'hungry', 'sleepy', 'philosophical'],
              },
              text: { type: Type.STRING },
              decreeTitle: { type: Type.STRING },
            },
            required: ['id', 'emotion', 'text', 'decreeTitle'],
          },
        },
      },
    });

    const rawArray = JSON.parse((response.text ?? '[]').trim());
    const validated = z.array(SassyQuoteSchema).min(1).safeParse(rawArray);
    if (!validated.success) {
      res.status(422).json({ error: '生成的语录格式校验未通过' });
      return;
    }

    res.json({ quotes: validated.data.slice(0, 30) });
  } catch (err) {
    console.error('[generate-quotes] Gemini API error:', err);
    res.status(500).json({ error: '语录生成失败，已保留本地缓存语录。' });
  }
});

async function startServer() {
  const httpServer = createHttpServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PocketMeow server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PocketMeow server:', err);
  process.exit(1);
});
