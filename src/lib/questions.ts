import raw from '../data/questions.json';

export interface Option {
  key: string;
  text: string;
  /** 原因。既有題目只有這一段較完整的說明。 */
  reason: string;
  /** 一句話回饋。沒有時沿用 reason。 */
  one?: string;
}

export type Speaker = '同事' | '上司' | '客戶';

export interface WrapUp {
  /** 今天學會的技巧名稱，例如「先講結論」 */
  learned: string;
  /** 下一句預告，例如「明天會練「報告壞消息」。」 */
  next: string;
}

export interface Question {
  id: string;
  level: number;
  level_name: string;
  framework: string;
  /** 情境正文。第 1 單元用定稿的縮短版。 */
  scenario: string;
  /** 接在情境後面的粗體作答提示。 */
  prompt?: string;
  options: Option[];
  answer: string;
  skill: string;
  background: string;
  /** 對話泡泡台詞。新題同時寫在 bubble；既有題目只有這個欄位。 */
  boss_line: string;
  /** 對話泡泡台詞。沒有時沿用 boss_line。 */
  bubble?: string;
  /** 泡泡左上角的稱呼。沒有時視為上司。 */
  speaker?: Speaker;
  /** 畫面上的標籤。沒有時用 speaker。第 1 題是「通知」，因為訊息來自好幾位同事。 */
  bubble_label?: string;
  /** 標籤前面的小圖示。bell 是 12px 的鈴鐺。 */
  bubble_icon?: 'bell';
  /** 出題階段：感受／學規則／換情境再用 */
  stage?: string;
  /**
   * 情境插圖，相對於網站根目錄（例如 scenes/u1q1.webp）。
   * 還沒到圖時留空，畫面用中性佔位圖。
   */
  scene_image?: string;
  /** 單元最後一題答完後的收尾。 */
  wrap_up?: WrapUp;
}

export const QUESTIONS: Question[] = raw as Question[];
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question {
  const q = byId.get(id);
  if (!q) throw new Error(`找不到題目 ${id}`);
  return q;
}

/** 第 1 步抽屜、以及其他選項列，用的那一句話。 */
export function optionLine(o: Option): string {
  return o.one ?? o.reason;
}

export function speechOf(q: Question): { speaker: Speaker; label: string; icon?: 'bell'; text: string; boss: boolean } {
  const speaker = q.speaker ?? '上司';
  return {
    speaker,
    label: q.bubble_label ?? speaker,
    icon: q.bubble_icon,
    text: q.bubble ?? q.boss_line,
    boss: speaker === '上司',
  };
}

/** 情境正文與粗體提示。提示若已寫在正文裡，只留粗體那一次。 */
export function scenarioParts(q: Question): { body: string; prompt?: string } {
  const prompt = q.prompt?.trim();
  if (!prompt) return { body: q.scenario.trim() };
  const body = q.scenario.replace(prompt, '').replace(/\s{2,}/g, ' ').trim();
  return { body, prompt };
}
