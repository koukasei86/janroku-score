import { LIMIT, CHIP_LIMIT, getTotals, validateNames } from './scoring.mjs';
export const STORAGE_KEY = 'janroku.game.v1';
export const PLAYER_ROSTER_KEY = 'janroku.players.v1';
export const SAVED_GAMES_KEY = 'janroku.savedGames.v1';

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

function cleanPlayerRoster(value) {
  if (!Array.isArray(value)) return [];
  const names = value
    .filter(name => typeof name === 'string' && name.trim() && name.trim().length <= 20)
    .map(name => name.trim());
  return [...new Set(names)].slice(0, 50);
}

export function loadPlayerRoster(storage = localStorage) {
  try {
    const raw = storage.getItem(PLAYER_ROSTER_KEY);
    return raw === null ? [] : cleanPlayerRoster(JSON.parse(raw));
  } catch { return []; }
}

export function rememberPlayers(players, storage = localStorage) {
  const validPlayers = validateNames(players);
  const roster = cleanPlayerRoster([...loadPlayerRoster(storage), ...validPlayers]);
  storage.setItem(PLAYER_ROSTER_KEY, JSON.stringify(roster));
  return roster;
}

function isValidSavedGame(record) {
  if (!record || typeof record.id !== 'string' || typeof record.savedAt !== 'string') return false;
  try { validateNames(record.players); } catch { return false; }
  if (!Array.isArray(record.rounds) || !Array.isArray(record.chips) || record.chips.length !== 4) return false;
  if (record.chips.some(count => !Number.isSafeInteger(count) || Math.abs(count) > CHIP_LIMIT)) return false;
  return record.rounds.every(round => Array.isArray(round.scores) && round.scores.length === 4 && round.scores.every(score => Number.isSafeInteger(score) && Math.abs(score) <= LIMIT) && round.scores.reduce((a, b) => a + b, 0) === 0 && Number.isInteger(round.autoIndex) && round.autoIndex >= 0 && round.autoIndex <= 3);
}

export function loadSavedGames(storage = localStorage) {
  try {
    const raw = storage.getItem(SAVED_GAMES_KEY);
    if (raw === null) return [];
    const records = JSON.parse(raw);
    return Array.isArray(records) ? records.filter(isValidSavedGame).slice(0, 30) : [];
  } catch { return []; }
}

export function saveCompletedGame(game, storage = localStorage) {
  if (!game || !Array.isArray(game.rounds) || game.rounds.length === 0) throw new Error('結果を1回以上登録してから保存してください。');
  const id = typeof game.archiveId === 'string' && game.archiveId ? game.archiveId : `${Date.now()}`;
  const record = {
    id,
    savedAt: new Date().toISOString(),
    players: validateNames(game.players),
    rounds: game.rounds.map(round => ({ scores: [...round.scores], autoIndex: round.autoIndex })),
    chips: [...game.chips]
  };
  if (!isValidSavedGame(record)) throw new Error('保存する対局データを確認してください。');
  const records = [record, ...loadSavedGames(storage).filter(item => item.id !== id)].slice(0, 30);
  storage.setItem(SAVED_GAMES_KEY, JSON.stringify(records));
  return record;
}
