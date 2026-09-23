// 100点を1単位の整数として計算し、小数の丸め誤差を防ぎます。
export const BASE = 300;
export const TOTAL = 1200;
export const LIMIT = 999999; // 異常な桁数や誤入力を拒否するための上限。
export const CHIP_LIMIT = 999;

export function parseScore(value) {
  const text = String(value).trim();
  if (!/^[+-]?\d+(?:\.\d)?$/.test(text)) throw new Error('点数は半角数字で入力してください。小数は1桁まで使えます。');
  const units = Math.round(Number(text) * 10);
  if (!Number.isSafeInteger(units) || Math.abs(units) > LIMIT) throw new Error('点数は −99,999.9 〜 99,999.9 の範囲で入力してください。');
  return units;
}

export function completeRound(values) {
  if (!Array.isArray(values) || values.length !== 4) throw new Error('4人分の入力欄を確認してください。');
  const blanks = values.map((value, index) => String(value).trim() === '' ? index : -1).filter(index => index >= 0);
  if (blanks.length !== 1) throw new Error(blanks.length === 0 ? '自動計算する1人の点数を空欄にしてください。' : '3人分の点数を入力してください。空欄にできるのは1人です。');
  const autoIndex = blanks[0];
  const scores = values.map((value, index) => index === autoIndex ? 0 : parseScore(value));
  // 各回の収支は4人で合計0。空欄は入力された3人の合計の反対符号です。
  scores[autoIndex] = -scores.reduce((sum, score) => sum + score, 0);
  if (Math.abs(scores[autoIndex]) > LIMIT) throw new Error('自動計算した点数が範囲外です。入力した3人の点数を確認してください。');
  return { scores, autoIndex };
}

export function getTotals(rounds) {
  return rounds.reduce((totals, round) => totals.map((total, index) => total + round.scores[index]), [0, 0, 0, 0]);
}
export function parseChipCount(value) {
  const text = String(value).trim();
  if (text === '') return 0;
  if (!/^[+-]?\d+$/.test(text)) throw new Error('チップは枚数を半角の整数で入力してください。');
  const count = Number(text);
  if (!Number.isSafeInteger(count) || Math.abs(count) > CHIP_LIMIT) throw new Error('チップは −999枚〜999枚の範囲で入力してください。');
  return count;
}
// 画面の1点は内部で10単位。チップ1枚=5点なので50単位を加算します。
export function getChipPoints(chips) { return chips.map(count => count * 50); }
export function getFinalTotals(rounds, chips) {
  const totals = getTotals(rounds);
  return totals.map((total, index) => total + getChipPoints(chips)[index]);
}
export function getRemainingScores(round) { return round.scores.map(score => BASE + score); }
export function getRanks(totals) { return totals.map(total => 1 + totals.filter(other => other > total).length); }
export function formatScore(units, signed = false) { return (signed && units > 0 ? '+' : '') + String(units / 10); }
export function validateNames(names) {
  if (!Array.isArray(names) || names.length !== 4 || names.some(name => typeof name !== 'string' || !name.trim() || name.trim().length > 20)) throw new Error('4人全員の名前を1〜20文字で入力してください。');
  return names.map(name => name.trim());
}
