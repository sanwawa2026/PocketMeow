import { z } from 'zod';

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '必须为标准 6 位十六进制颜色 (#RRGGBB)');

export const CatCoatPatternSchema = z.enum([
  'solid',
  'tuxedo',
  'bicolor',
  'tabby',
  'calico',
  'tortoiseshell',
  'siamese',
  'spotted',
]);

export const CatEarStyleSchema = z.enum(['pointed', 'folded', 'rounded', 'tufted']);

export const CatEmotionStateSchema = z.enum([
  'idle',
  'listening',
  'happy',
  'proud',
  'sleepy',
  'angry',
  'hungry',
]);

export const CatRaritySchema = z.enum(['R', 'SR', 'SSR', 'UR']);

export const CatProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  breed: z.string().min(1).max(32),
  coatPattern: CatCoatPatternSchema,
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  accentColor: HexColorSchema,
  noseColor: HexColorSchema,
  leftEyeColor: HexColorSchema,
  rightEyeColor: HexColorSchema,
  earStyle: CatEarStyleSchema,
  chubbiness: z.number().min(0.78).max(1.35),
  rarity: CatRaritySchema,
  personalityTag: z.string().min(1).max(24),
  snarkyBio: z.string().min(1).max(120),
  analysisSource: z.enum(['preset', 'offline-floodfill', 'gemini-vision']),
  confidenceNote: z.string().max(120).optional(),
});

export const AcousticIntentSchema = z.enum([
  'demanding_food',
  'affectionate_purr',
  'annoyed_hiss',
  'curious_chirp',
  'bored_sigh',
  'philosophical_stare',
]);

export const MeowQuoteSchema = z.object({
  id: z.string().min(1),
  intent: AcousticIntentSchema,
  text: z.string().min(2).max(100),
  moodReward: CatEmotionStateSchema,
  decreeTitle: z.string().min(2).max(20),
});

export const MeowQuoteBankSchema = z.array(MeowQuoteSchema).min(10).max(60);

export const AcousticFeaturesSchema = z.object({
  pitchHz: z.number().min(40).max(3000),
  durationMs: z.number().min(80).max(30000),
  energyRms: z.number().min(0).max(1),
  spectralCentroidHz: z.number().min(100).max(8000),
  modulationBursts: z.number().int().min(1).max(20),
  detectedIntent: AcousticIntentSchema,
  sourceMode: z.enum(['microphone', 'simulated-meow']),
});

export const MeowTranslationResultSchema = z.object({
  quote: MeowQuoteSchema,
  acoustics: AcousticFeaturesSchema,
  translatedAtIso: z.string(),
  rarityBonusLabel: z.string().min(1).max(32),
});

export const VisionApiResultSchema = z.object({
  breed: z.string().min(1).max(32),
  coatPattern: CatCoatPatternSchema,
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  accentColor: HexColorSchema,
  noseColor: HexColorSchema,
  leftEyeColor: HexColorSchema,
  rightEyeColor: HexColorSchema,
  earStyle: CatEarStyleSchema,
  chubbiness: z.number().min(0.78).max(1.35),
  rarity: CatRaritySchema,
  personalityTag: z.string().min(1).max(24),
  snarkyBio: z.string().min(1).max(120),
  confidenceNote: z.string().max(120).optional(),
});

export type CatCoatPattern = z.infer<typeof CatCoatPatternSchema>;
export type CatEarStyle = z.infer<typeof CatEarStyleSchema>;
export type CatEmotionState = z.infer<typeof CatEmotionStateSchema>;
export type CatRarity = z.infer<typeof CatRaritySchema>;
export type CatProfile = z.infer<typeof CatProfileSchema>;
export type AcousticIntent = z.infer<typeof AcousticIntentSchema>;
export type MeowQuote = z.infer<typeof MeowQuoteSchema>;
export type AcousticFeatures = z.infer<typeof AcousticFeaturesSchema>;
export type MeowTranslationResult = z.infer<typeof MeowTranslationResultSchema>;
export type VisionApiResult = z.infer<typeof VisionApiResultSchema>;
