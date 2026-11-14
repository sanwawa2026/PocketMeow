import { z } from 'zod';

export const CoatPatternSchema = z.enum([
  'solid',
  'bicolor',
  'tabby',
  'calico',
  'tortoiseshell',
  'tuxedo',
  'siamese',
]);
export type CoatPattern = z.infer<typeof CoatPatternSchema>;

export const EarTypeSchema = z.enum(['pointed', 'folded', 'curled', 'tufted']);
export type EarType = z.infer<typeof EarTypeSchema>;

export const PetMoodSchema = z.enum([
  'idle',
  'happy',
  'listening',
  'kneading',
  'yawning',
  'hunting',
  'tsundere',
  'sleeping',
]);
export type PetMood = z.infer<typeof PetMoodSchema>;

export const RarityTierSchema = z.enum(['SSR', 'SR', 'R']);
export type RarityTier = z.infer<typeof RarityTierSchema>;

export const MeowEmotionSchema = z.enum([
  'demanding',
  'annoyed',
  'affectionate',
  'hungry',
  'sleepy',
  'philosophical',
]);
export type MeowEmotion = z.infer<typeof MeowEmotionSchema>;

const HexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, '必须是标准的 6 位十六进制色值 (#RRGGBB)');

export const CatAppearanceSchema = z.object({
  breedLabel: z.string().min(1).max(32),
  coatPattern: CoatPatternSchema,
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  accentColor: HexColorSchema,
  bellyColor: HexColorSchema,
  leftEyeColor: HexColorSchema,
  rightEyeColor: HexColorSchema,
  noseColor: HexColorSchema,
  collarColor: HexColorSchema,
  earType: EarTypeSchema,
  chonkiness: z.number().min(0.75).max(1.38),
  rarity: RarityTierSchema,
  temperament: z.string().min(1).max(60),
});
export type CatAppearance = z.infer<typeof CatAppearanceSchema>;

export const CatProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  createdAt: z.number(),
  sourceMethod: z.enum(['preset', 'flood-fill', 'gemini-vision']),
  thumbnailDataUrl: z.string().optional(),
  appearance: CatAppearanceSchema,
});
export type CatProfile = z.infer<typeof CatProfileSchema>;

export const SassyQuoteSchema = z.object({
  id: z.string(),
  emotion: MeowEmotionSchema,
  text: z.string().min(2).max(120),
  decreeTitle: z.string().min(2).max(24),
});
export type SassyQuote = z.infer<typeof SassyQuoteSchema>;

export const AcousticMetricsSchema = z.object({
  peakHz: z.number().nonnegative(),
  rmsEnergy: z.number().min(0).max(1),
  durationMs: z.number().nonnegative(),
  contour: z.enum(['rising', 'falling', 'trill', 'steady']),
});
export type AcousticMetrics = z.infer<typeof AcousticMetricsSchema>;

export const MeowTranslationResultSchema = z.object({
  emotion: MeowEmotionSchema,
  quote: SassyQuoteSchema,
  metrics: AcousticMetricsSchema,
  timestamp: z.number(),
});
export type MeowTranslationResult = z.infer<typeof MeowTranslationResultSchema>;

export const FloodFillDebugSchema = z.object({
  segmentedPreviewUrl: z.string(),
  litSwatches: z.array(HexColorSchema),
  foregroundRatio: z.number().min(0).max(1),
  luminanceP50: z.number().min(0).max(255),
  luminanceP80: z.number().min(0).max(255),
});
export type FloodFillDebug = z.infer<typeof FloodFillDebugSchema>;

export const PRESET_CATS: CatProfile[] = [
  {
    id: 'preset-ginger-prince',
    name: '橘座亲王',
    createdAt: 1700000001000,
    sourceMethod: 'preset',
    appearance: {
      breedLabel: '中华田园大橘',
      coatPattern: 'bicolor',
      primaryColor: '#E58A3C',
      secondaryColor: '#FFF7EC',
      accentColor: '#B85A1A',
      bellyColor: '#FFFDF8',
      leftEyeColor: '#E59D2C',
      rightEyeColor: '#E59D2C',
      noseColor: '#F29B9B',
      collarColor: '#D9482B',
      earType: 'pointed',
      chonkiness: 1.22,
      rarity: 'SR',
      temperament: '十只橘猫九只胖，还有一只正盯着你的晚饭',
    },
  },
  {
    id: 'preset-white-heterochromia',
    name: '雪团圣上',
    createdAt: 1700000002000,
    sourceMethod: 'preset',
    appearance: {
      breedLabel: '波斯异瞳纯白',
      coatPattern: 'solid',
      primaryColor: '#F7F8FA',
      secondaryColor: '#EDEFF4',
      accentColor: '#E2E6EE',
      bellyColor: '#FFFFFF',
      leftEyeColor: '#3B9EE8',
      rightEyeColor: '#E8AC30',
      noseColor: '#F6A6B2',
      collarColor: '#2563EB',
      earType: 'tufted',
      chonkiness: 1.05,
      rarity: 'SSR',
      temperament: '高冷洁癖天花板，摸完不洗手休想靠近',
    },
  },
  {
    id: 'preset-calico-empress',
    name: '花卷太后',
    createdAt: 1700000003000,
    sourceMethod: 'preset',
    appearance: {
      breedLabel: '招财三花御猫',
      coatPattern: 'calico',
      primaryColor: '#FAF7F2',
      secondaryColor: '#DF782C',
      accentColor: '#2C2A2E',
      bellyColor: '#FFFFFF',
      leftEyeColor: '#5EA848',
      rightEyeColor: '#5EA848',
      noseColor: '#F0979B',
      collarColor: '#15803D',
      earType: 'pointed',
      chonkiness: 1.02,
      rarity: 'SSR',
      temperament: '脾气阴晴不定，但撒起娇来谁都扛不住',
    },
  },
  {
    id: 'preset-tuxedo-butler',
    name: '警长大人',
    createdAt: 1700000004000,
    sourceMethod: 'preset',
    appearance: {
      breedLabel: '燕尾服奶牛猫',
      coatPattern: 'tuxedo',
      primaryColor: '#23252C',
      secondaryColor: '#F8F9FB',
      accentColor: '#141519',
      bellyColor: '#FFFFFF',
      leftEyeColor: '#F0B838',
      rightEyeColor: '#F0B838',
      noseColor: '#3A3A40',
      collarColor: '#DC2626',
      earType: 'pointed',
      chonkiness: 0.96,
      rarity: 'SR',
      temperament: '猫中哈士奇，凌晨三点准时在客厅跑酷',
    },
  },
  {
    id: 'preset-siamese-duke',
    name: '煤球公爵',
    createdAt: 1700000005000,
    sourceMethod: 'preset',
    appearance: {
      breedLabel: '重点色暹罗',
      coatPattern: 'siamese',
      primaryColor: '#EFE4D2',
      secondaryColor: '#3D2E27',
      accentColor: '#261C17',
      bellyColor: '#F5EDE0',
      leftEyeColor: '#3A8CEB',
      rightEyeColor: '#3A8CEB',
      noseColor: '#362721',
      collarColor: '#0F766E',
      earType: 'pointed',
      chonkiness: 0.88,
      rarity: 'R',
      temperament: '话痨附体，每天对着空气发表半小时演讲',
    },
  },
];
