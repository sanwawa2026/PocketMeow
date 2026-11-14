import {
  AcousticFeatures,
  AcousticFeaturesSchema,
  AcousticIntent,
  MeowQuote,
  MeowQuoteBankSchema,
  MeowTranslationResult,
  MeowTranslationResultSchema,
} from '../schemas/catSchema';

const STORAGE_KEY = 'pocket_meow_quotes_v1';

export const DEFAULT_30_QUOTES: MeowQuote[] = [
  { id: 'q01', intent: 'demanding_food', text: '碗底都已经反光到能照镜子了，你还在那儿看手机？', moodReward: 'hungry', decreeTitle: '催膳急诏' },
  { id: 'q02', intent: 'demanding_food', text: '三分钟内看不见冻干入碗，今天沙发扶手就别想要了。', moodReward: 'angry', decreeTitle: '膳食通牒' },
  { id: 'q03', intent: 'demanding_food', text: '刚才开的是冰箱门吗？我听见酸奶盖响了，分我一半。', moodReward: 'hungry', decreeTitle: '开箱巡检' },
  { id: 'q04', intent: 'demanding_food', text: '别拿廉价猫粮糊弄本座，今天的罐头必须是三文鱼味。', moodReward: 'proud', decreeTitle: '御膳钦点' },
  { id: 'q05', intent: 'demanding_food', text: '按时上供是两脚兽唯一存在的价值，去吧，别让我说第二遍。', moodReward: 'hungry', decreeTitle: '铲屎官守则' },

  { id: 'q06', intent: 'affectionate_purr', text: '勉为其难让你摸三秒下巴。多了不行，会掉本喵的高冷身价。', moodReward: 'happy', decreeTitle: '恩准摸头' },
  { id: 'q07', intent: 'affectionate_purr', text: '看在你今天按时下班的份上，今晚准你抱本喵的尾巴睡觉。', moodReward: 'happy', decreeTitle: '暖床特赦' },
  { id: 'q08', intent: 'affectionate_purr', text: '刚才我呼噜了四下，换算成人类语言就是：勉强喜欢你吧。', moodReward: 'happy', decreeTitle: '暗戳戳示爱' },
  { id: 'q09', intent: 'affectionate_purr', text: '别叹气了，过来蹭蹭。虽然你赚的不多，但本喵不嫌弃你。', moodReward: 'happy', decreeTitle: '贴贴安慰赏' },
  { id: 'q10', intent: 'affectionate_purr', text: '允许你把脸埋进本喵肚子里三秒钟，机会难得，吸完赶紧去挣罐头钱。', moodReward: 'happy', decreeTitle: '吸猫许可证' },

  { id: 'q11', intent: 'annoyed_hiss', text: '手拿开！刚才你是不是在外面偷偷摸了别的野猫？！', moodReward: 'angry', decreeTitle: '查岗警告' },
  { id: 'q12', intent: 'annoyed_hiss', text: '退后三步，现在本座周围五米属于绝对高冷禁区。', moodReward: 'angry', decreeTitle: '结界开启' },
  { id: 'q13', intent: 'annoyed_hiss', text: '别剪指甲！本喵这叫艺术美甲，动我一根爪尖我就躺地装死。', moodReward: 'angry', decreeTitle: '护爪宣言' },
  { id: 'q14', intent: 'annoyed_hiss', text: '叫什么叫，本喵正在思考猫生大事，没空配合你营业拍照。', moodReward: 'proud', decreeTitle: '拒绝营业' },
  { id: 'q15', intent: 'annoyed_hiss', text: '你的笑声吵到本座午睡了，罚你今晚多铲一次猫砂。', moodReward: 'angry', decreeTitle: '噪音罚单' },

  { id: 'q16', intent: 'curious_chirp', text: '窗外那只麻雀已经连续三天挑衅我了，快把我抱高点！', moodReward: 'listening', decreeTitle: '情报预警' },
  { id: 'q17', intent: 'curious_chirp', text: '快递箱拆完千万别扔，那是我新登基的宫殿行宫。', moodReward: 'happy', decreeTitle: '领土宣誓' },
  { id: 'q18', intent: 'curious_chirp', text: '那个红点点到底是什么绝世高手？等我抓到它一定咬碎。', moodReward: 'listening', decreeTitle: '捕猎作战' },
  { id: 'q19', intent: 'curious_chirp', text: '厕所门关这么严实干嘛？你是不是又在背着我偷偷掉进水池里？', moodReward: 'listening', decreeTitle: '浴室救援队' },
  { id: 'q20', intent: 'curious_chirp', text: '你手里拿着的塑料袋发出很危险又很诱人的声音，快交出来检查。', moodReward: 'listening', decreeTitle: '安检口谕' },

  { id: 'q21', intent: 'bored_sigh', text: '这日子真没意思，窗台晒完太阳又该睡下午觉了，好累。', moodReward: 'sleepy', decreeTitle: '咸鱼日常' },
  { id: 'q22', intent: 'bored_sigh', text: '人类怎么这么笨，逗猫棒挥得毫无章法，完全提不起本座兴趣。', moodReward: 'sleepy', decreeTitle: '陪玩差评' },
  { id: 'q23', intent: 'bored_sigh', text: '我躺平了，今天谁来劝我都不想动，罐头除外。', moodReward: 'sleepy', decreeTitle: '休眠旨意' },
  { id: 'q24', intent: 'bored_sigh', text: '盯了墙角二十分钟，什么虫子都没有，感觉喵生失去了目标。', moodReward: 'sleepy', decreeTitle: '发呆实录' },
  { id: 'q25', intent: 'bored_sigh', text: '把窗帘拉开十公分，本座要视察今天楼下的狗有没有变蠢。', moodReward: 'proud', decreeTitle: '早朝视察' },

  { id: 'q26', intent: 'philosophical_stare', text: '人类忙忙碌碌一辈子，还不是为了给我买更贵的猫砂？', moodReward: 'proud', decreeTitle: '哲学顿悟' },
  { id: 'q27', intent: 'philosophical_stare', text: '水杯放在桌边就是为了被我一巴掌推下去，这叫物理学实验。', moodReward: 'proud', decreeTitle: '引力验证' },
  { id: 'q28', intent: 'philosophical_stare', text: '不要问我为什么突然盯着空气看，说了你这种普通人类也看不见。', moodReward: 'proud', decreeTitle: '灵异结界' },
  { id: 'q29', intent: 'philosophical_stare', text: '你以为你在养猫？其实是我大发慈悲收留了一个会开罐头的室友。', moodReward: 'proud', decreeTitle: '主仆真相' },
  { id: 'q30', intent: 'philosophical_stare', text: '今日宜摸鱼、宜加餐、宜对本主子言听计从。退下吧！', moodReward: 'proud', decreeTitle: '今日吉凶签' },
];

export function loadQuoteBank(): MeowQuote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_30_QUOTES));
      return DEFAULT_30_QUOTES;
    }
    const parsed = MeowQuoteBankSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // fallback safely
  }
  return DEFAULT_30_QUOTES;
}

export function saveQuoteBank(quotes: MeowQuote[]): MeowQuote[] {
  const validated = MeowQuoteBankSchema.parse(quotes);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export async function refreshQuotesWithGemini(
  catName: string,
  breed: string,
  personalityTag: string
): Promise<MeowQuote[] | null> {
  try {
    const res = await fetch('/api/pocket-meow/generate-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ catName, breed, personalityTag }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { success?: boolean; quotes?: unknown };
    if (!payload.success || !payload.quotes) return null;
    return saveQuoteBank(MeowQuoteBankSchema.parse(payload.quotes));
  } catch {
    return null;
  }
}

export function classifyAcousticsToIntent(
  pitchHz: number,
  energyRms: number,
  spectralCentroidHz: number,
  modulationBursts: number,
  durationMs: number
): AcousticIntent {
  if (energyRms > 0.24 && spectralCentroidHz > 1850) {
    return 'annoyed_hiss';
  }
  if (pitchHz >= 520 && modulationBursts >= 2) {
    return 'curious_chirp';
  }
  if (pitchHz >= 380 && energyRms >= 0.1) {
    return 'demanding_food';
  }
  if (pitchHz < 230 && durationMs > 1200) {
    return 'bored_sigh';
  }
  if (energyRms < 0.08) {
    return 'philosophical_stare';
  }
  return 'affectionate_purr';
}

export function buildTranslationResult(
  acousticsInput: AcousticFeatures,
  quotes: MeowQuote[]
): MeowTranslationResult {
  const acoustics = AcousticFeaturesSchema.parse(acousticsInput);
  const matching = quotes.filter((q) => q.intent === acoustics.detectedIntent);
  const pool = matching.length > 0 ? matching : quotes;
  const seed = Math.floor(
    (acoustics.pitchHz + acoustics.durationMs + acoustics.spectralCentroidHz) % pool.length
  );
  const quote = pool[Math.abs(seed) % pool.length];

  const rarityBonusLabel =
    acoustics.pitchHz > 560
      ? '高音傲娇 · SSR 圣旨'
      : acoustics.energyRms > 0.2
      ? '威严震慑 · SR 口谕'
      : '呼噜治愈 · 每日吉签';

  return MeowTranslationResultSchema.parse({
    quote,
    acoustics,
    translatedAtIso: new Date().toISOString(),
    rarityBonusLabel,
  });
}

/**
 * 零外部文件依赖：Web Audio API 程序化猫叫/呼噜反馈音效
 */
export function playProceduralMeowTone(mood: 'chirp' | 'purr' | 'royal', muted: boolean): void {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.Q.value = 3.2;

    if (mood === 'purr') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(86, now + 0.35);
      filter.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (mood === 'royal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(390, now + 0.36);
      filter.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(790, now + 0.11);
      osc.frequency.exponentialRampToValueAtTime(510, now + 0.25);
      filter.frequency.setValueAtTime(1500, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // Ignore audio context autoplay errors safely
  }
}

export interface LiveMicSession {
  getSpectrumBars: () => number[];
  stopAndAnalyze: () => AcousticFeatures;
}

export async function startRealMicrophoneSession(): Promise<LiveMicSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Uint8Array(analyser.fftSize);
  const startedAt = performance.now();

  let maxEnergy = 0.05;
  let pitchSum = 0;
  let pitchSamples = 0;
  let centroidSum = 0;
  let bursts = 1;
  let prevAbove = false;

  const sampleNow = () => {
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / timeData.length);
    if (rms > maxEnergy) maxEnergy = rms;
    const isAbove = rms > 0.06;
    if (isAbove && !prevAbove) bursts = Math.min(20, bursts + 1);
    prevAbove = isAbove;

    const nyquist = ctx.sampleRate / 2;
    let peakBin = 4;
    let peakVal = 0;
    let weightedFreq = 0;
    let totalMag = 0;

    for (let i = 2; i < freqData.length; i++) {
      const mag = freqData[i];
      const f = (i / freqData.length) * nyquist;
      if (f >= 120 && f <= 1600 && mag > peakVal) {
        peakVal = mag;
        peakBin = i;
      }
      weightedFreq += f * mag;
      totalMag += mag;
    }

    if (totalMag > 10) {
      const peakHz = (peakBin / freqData.length) * nyquist;
      pitchSum += peakHz;
      centroidSum += weightedFreq / totalMag;
      pitchSamples++;
    }
  };

  return {
    getSpectrumBars: () => {
      sampleNow();
      const bars: number[] = [];
      const step = Math.floor(freqData.length / 16);
      for (let i = 0; i < 16; i++) {
        bars.push(Math.max(0.1, freqData[i * step] / 255));
      }
      return bars;
    },
    stopAndAnalyze: () => {
      sampleNow();
      const durationMs = Math.max(250, Math.round(performance.now() - startedAt));
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});

      const avgPitch = pitchSamples > 0 ? Math.round(pitchSum / pitchSamples) : 440;
      const avgCentroid = pitchSamples > 0 ? Math.round(centroidSum / pitchSamples) : 1350;
      const clampedPitch = Math.max(85, Math.min(1800, avgPitch));
      const clampedCentroid = Math.max(250, Math.min(6000, avgCentroid));
      const energy = Math.min(0.95, Math.max(0.04, Math.round(maxEnergy * 100) / 100));

      return AcousticFeaturesSchema.parse({
        pitchHz: clampedPitch,
        durationMs,
        energyRms: energy,
        spectralCentroidHz: clampedCentroid,
        modulationBursts: bursts,
        detectedIntent: classifyAcousticsToIntent(
          clampedPitch,
          energy,
          clampedCentroid,
          bursts,
          durationMs
        ),
        sourceMode: 'microphone',
      });
    },
  };
}
