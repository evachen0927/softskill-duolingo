import raw from '../data/questions.json';

export interface Option {
  key: string;
  text: string;
  reason: string;
}
export interface Question {
  id: string;
  level: number;
  level_name: string;
  framework: string;
  scenario: string;
  options: Option[];
  answer: string;
  skill: string;
  background: string;
  /** 方塊上司對話泡泡的台詞：情境裡主管說的原話 */
  boss_line: string;
}

export const QUESTIONS: Question[] = raw as Question[];
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

export function getQuestion(id: string): Question {
  const q = byId.get(id);
  if (!q) throw new Error(`找不到題目 ${id}`);
  return q;
}
