import { z } from 'zod';
import { type MeowEmotion, type SassyQuote, SassyQuoteSchema } from '../schemas/cat';

const STORAGE_KEY = 'pocketmeow_sassy_quotes_v1';

export const DEFAULT_30_SASSY_QUOTES: SassyQuote[] = [
  // demanding (5)
  { id: 'q01', emotion: 'demanding', decreeTitle: '加餐急诏', text: '朕的猫粮碗见底三分钟了，你是打算让我亲自点外卖吗？' },
  { id: 'q02', emotion: 'demanding', decreeTitle: '开罐圣旨', text: '少拿冻干糊弄朕，今天必须开那罐最贵的金枪鱼主食罐！' },
  { id: 'q03', emotion: 'demanding', decreeTitle: '开门御令', text: '门关着干嘛？朕不一定要出去，但门必须开着以示尊重。' },
  { id: 'q04', emotion: 'demanding', decreeTitle: '御用侍寝', text: '把电脑合上。键盘暖和归暖和，但现在轮到朕占领你的膝盖了。' },
  { id: 'q05', emotion: 'demanding', decreeTitle: '铲屎急奏', text: '砂盆里有两颗黄金了，两脚兽请立刻前往御花园清理现场。' },

  // annoyed (5)
  { id: 'q06', emotion: 'annoyed', decreeTitle: '撤手警告', text: '别摸了，手感一般，勉强给你摸两秒，多一秒算你僭越。' },
  { id: 'q07', emotion: 'annoyed', decreeTitle: '嫌弃御批', text: '你在外面是不是撸了别的猫？身上这股陌生的猫味令朕作呕。' },
  { id: 'q08', emotion: 'annoyed', decreeTitle: '禁止拍照', text: '又举着手机拍？朕的盛世美颜岂是区区像素能装得下的。' },
  { id: 'q09', emotion: 'annoyed', decreeTitle: '午休勿扰', text: '走路脚步轻点，踩到朕的阳光投影区了，赔十根猫条不过分吧？' },
  { id: 'q10', emotion: 'annoyed', decreeTitle: '审美裁决', text: '新买的猫爬架丑得像违章建筑，不过上面的纸箱朕先征用了。' },

  // affectionate (5)
  { id: 'q11', emotion: 'affectionate', decreeTitle: '勉强恩宠', text: '看在你今天按时下班的份上，允许你把脸埋进朕的肚皮里吸三口。' },
  { id: 'q12', emotion: 'affectionate', decreeTitle: '御赐踩奶', text: '肩膀不错，朕给你免费做套马杀鸡，记得用小鱼干结账。' },
  { id: 'q13', emotion: 'affectionate', decreeTitle: '慢眨示好', text: '刚才对你慢眨眼三回，意思是“你还算勉强合格”，不许得意忘形。' },
  { id: 'q14', emotion: 'affectionate', decreeTitle: '暖手特权', text: '手这么凉还敲代码？来，把爪子塞进朕厚实的围脖下面暖着。' },
  { id: 'q15', emotion: 'affectionate', decreeTitle: '留灯守候', text: '虽说你笨手笨脚的，但今晚回家推开门，朕还是第一个来接驾。' },

  // hungry (5)
  { id: 'q16', emotion: 'hungry', decreeTitle: '饥荒告急', text: '你听，这是胃在唱歌还是狮吼功？再不放饭朕就要啃数据线了！' },
  { id: 'q17', emotion: 'hungry', decreeTitle: '碗边监督', text: '碗中间明明露出一块白瓷底了，这叫“空碗”！别想拿摇一摇骗朕！' },
  { id: 'q18', emotion: 'hungry', decreeTitle: '宵夜御旨', text: '冰箱门刚才响了一下，根据《宠物保护法》，里面一半属于朕。' },
  { id: 'q19', emotion: 'hungry', decreeTitle: '营养均衡', text: '天天吃同一款猫粮会变笨的，快给朕加点三文鱼冻干提提神。' },
  { id: 'q20', emotion: 'hungry', decreeTitle: '试毒专员', text: '你手里那块鸡胸肉看起来很危险，为了你的安全，朕先替你尝十口。' },

  // sleepy (5)
  { id: 'q21', emotion: 'sleepy', decreeTitle: '摆烂宣言', text: '朕今天已经连续睡了十四小时，实在太累了，需要再补两小时回笼觉。' },
  { id: 'q22', emotion: 'sleepy', decreeTitle: '日光浴令', text: '三点钟的阳光正合适，别拿逗猫棒晃悠，这会打扰朕进行光合作用。' },
  { id: 'q23', emotion: 'sleepy', decreeTitle: '宵禁反转', text: '白天睡够了，先打个招呼——今晚凌晨三点客厅百米冲刺准时发车。' },
  { id: 'q24', emotion: 'sleepy', decreeTitle: '被窝征用', text: '你的被窝已经经过朕的体温质检，现在正式划归为皇家寝宫。' },
  { id: 'q25', emotion: 'sleepy', decreeTitle: '待机节能', text: '电量剩余 3%，呼噜声已切换至低功耗模式，有事请投喂后留言。' },

  // philosophical (5)
  { id: 'q26', emotion: 'philosophical', decreeTitle: '纸箱哲学', text: '两脚兽花大价钱买沙发，却不懂世间真正的宇宙中心永远是快递纸箱。' },
  { id: 'q27', emotion: 'philosophical', decreeTitle: '重力实验', text: '朕把水杯推下桌子并非顽皮，只是每天例行确认地球引力是否还在工作。' },
  { id: 'q28', emotion: 'philosophical', decreeTitle: '内卷忠告', text: '别卷了，看看朕——一天除了吃饭睡觉发呆，依然是这个家的最高统治者。' },
  { id: 'q29', emotion: 'philosophical', decreeTitle: '窗外观察', text: '窗台那只麻雀今天飞慢了半拍，等朕拿到飞行执照，高低得和它切磋一下。' },
  { id: 'q30', emotion: 'philosophical', decreeTitle: '红点玄学', text: '那个红色光点神出鬼没，肯定是异次元派来的刺客，幸好朕每天帮你守着。' },
];

export function loadCachedQuotes(): SassyQuote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_30_SASSY_QUOTES));
      return DEFAULT_30_SASSY_QUOTES;
    }
    const parsed = z.array(SassyQuoteSchema).min(1).safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Fallback cleanly
  }
  return DEFAULT_30_SASSY_QUOTES;
}

export function pickQuoteForEmotion(emotion: MeowEmotion, lastId?: string): SassyQuote {
  const all = loadCachedQuotes();
  const pool = all.filter((q) => q.emotion === emotion && q.id !== lastId);
  const candidates = pool.length > 0 ? pool : all;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function refreshQuotesViaGemini(params: {
  catName: string;
  breed: string;
  temperament: string;
}): Promise<{ quotes: SassyQuote[]; fromAI: boolean; message: string }> {
  try {
    const resp = await fetch('/api/generate-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      return {
        quotes: loadCachedQuotes(),
        fromAI: false,
        message: err.error ?? '当前离线或未配置密钥，继续使用精选本地 30 条毒舌语录。',
      };
    }

    const data = (await resp.json()) as { quotes?: unknown };
    const validated = z.array(SassyQuoteSchema).min(1).safeParse(data.quotes);
    if (!validated.success) {
      return {
        quotes: loadCachedQuotes(),
        fromAI: false,
        message: '语录格式校验未通过，已保留原缓存。',
      };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(validated.data));
    return {
      quotes: validated.data,
      fromAI: true,
      message: `已为「${params.catName}」生成并缓存 ${validated.data.length} 条专属毒舌语录！`,
    };
  } catch {
    return {
      quotes: loadCachedQuotes(),
      fromAI: false,
      message: '网络不可用，已切换本地零延迟语录缓存。',
    };
  }
}
