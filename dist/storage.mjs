import { LIMIT, CHIP_LIMIT, getTotals, validateNames } from './scoring.mjs';
export const STORAGE_KEY = 'janroku.game.v1';

export function loadGame(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const game = JSON.parse(raw);
    if (![1, 2].includes(game.version) || !Array.isArray(game.rounds)) throw new Error();
    game.players = validateNames(game.players);
    // Ver.1は終了時の持ち点を保存していたため、収支へ変換して引き継ぎます。
    if (game.version === 1) {
      game.rounds = game.rounds.map(round => {
        // 旧画面に収支を直接入力していた履歴は、入力した3人に負数が含まれることで判別します。
        const enteredAsResults = round.scores.some((score, index) => index !== round.autoIndex && score < 0);
        if (enteredAsResults) {
          const scores = [...round.scores];
          scores[round.autoIndex] = -scores.reduce((sum, score, index) => index === round.autoIndex ? sum : sum + score, 0);
          return { ...round, scores };
        }
        return { ...round, scores: round.scores.map(score => score - 300) };
      });
      game.version = 2;
    }
    for (const round of game.rounds) {
      if (!Array.isArray(round.scores) || round.scores.length !== 4 || round.scores.some(score => !Number.isSafeInteger(score) || Math.abs(score) > LIMIT) || round.scores.reduce((a, b) => a + b, 0) !== 0 || !Number.isInteger(round.autoIndex) || round.autoIndex < 0 || round.autoIndex > 3) throw new Error();
    }
    if (game.chips === undefined) game.chips = [0, 0, 0, 0];
    if (!Array.isArray(game.chips) || game.chips.length !== 4 || game.chips.some(count => !Number.isSafeInteger(count) || Math.abs(count) > CHIP_LIMIT)) throw new Error();
    // 履歴を正とし、保存された累計にずれがあっても再計算します。
    game.totals = getTotals(game.rounds);
    return game;
  } catch { throw new Error('保存データを読み込めませんでした。再読み込みしても直らない場合は、名前を入力して新しく始めてください。'); }
}
export function saveGame(game, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...game, totals: getTotals(game.rounds) }));
}
export function removeGame(storage = localStorage) { storage.removeItem(STORAGE_KEY); }
