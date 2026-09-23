import { completeRound, getTotals, getRanks, getChipPoints, getFinalTotals, parseChipCount, formatScore, validateNames } from './scoring.mjs';
import { loadGame, saveGame, removeGame } from './storage.mjs';

const $ = selector => document.querySelector(selector);
const colors = ['#25826d', '#447fbb', '#b9852c', '#8b6caf'];
let game = null;
let recoveryNeeded = false;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const tone = value => value > 0 ? 'positive' : value < 0 ? 'negative' : '';

function storageWarning(message) {
  $('#storage-warning').textContent = message;
  $('#storage-warning').hidden = !message;
}
try { game = loadGame(); }
catch (error) { recoveryNeeded = true; storageWarning(error.message); }

// 保存が成功してから画面を更新。保存できない結果を「登録済み」にしません。
function commit(nextGame) {
  try { saveGame(nextGame); }
  catch { throw new Error('保存できませんでした。ブラウザの保存設定や空き容量を確認してください。入力内容は残っています。'); }
  game = nextGame;
  recoveryNeeded = false;
  storageWarning('');
  render();
}

function render() {
  $('#setup').hidden = Boolean(game);
  $('#game').hidden = !game;
  if (!game) return;
  const totals = getTotals(game.rounds);
  const ranks = getRanks(totals);
  $('#round-count').textContent = `${game.rounds.length}回 終了`;
  $('#scoreboard').innerHTML = game.players.map((name, i) => `<article class="score-card ${ranks[i] === 1 && game.rounds.length ? 'leader' : ''}" style="--player:${colors[i]}"><div class="card-top"><span class="player-name">${escapeHtml(name)}</span><span class="rank">${ranks[i]}位</span></div><strong class="total ${tone(totals[i])}">${formatScore(totals[i], true)}</strong><span class="total-caption">累計収支</span></article>`).join('');
  $('#entry-title').textContent = `第${game.rounds.length + 1}回の結果`;
  $('#score-inputs').innerHTML = game.players.map((name, i) => `<label><span class="field-label"><i class="player-dot p${i}"></i>${escapeHtml(name)}</span><span class="score-control"><input name="score${i}" aria-label="${escapeHtml(name)}の収支" type="text" inputmode="decimal" maxlength="12" placeholder="例 −20" autocomplete="off" spellcheck="false" aria-describedby="score-error"><button class="sign-button" type="button" data-index="${i}" aria-label="${escapeHtml(name)}の収支の正負を切り替え">±</button></span></label>`).join('');
  $('#input-status').textContent = '0 / 3人 入力済み';
  $('#score-error').textContent = '';
  $('#history-head').innerHTML = `<tr><th scope="col">回</th>${game.players.map(name => `<th scope="col">${escapeHtml(name)}</th>`).join('')}</tr>`;
  $('#history-body').innerHTML = game.rounds.map((round, index) => `<tr><th scope="row">${index + 1}</th>${round.scores.map((score, i) => `<td><strong class="round-result ${tone(score)}">${formatScore(score, true)}</strong>${i === round.autoIndex ? '<span class="auto-tag">自動</span>' : ''}</td>`).join('')}</tr>`).join('');
  $('#history-foot').innerHTML = `<tr><th scope="row">現在累計</th>${totals.map(total => `<td class="${tone(total)}">${formatScore(total, true)}</td>`).join('')}</tr>`;
  renderChipSection(totals);
  $('.table-wrap').hidden = game.rounds.length === 0;
  $('#empty-history').hidden = game.rounds.length !== 0;
}

function renderChipSection(totals) {
  const chips = game.chips || [0, 0, 0, 0];
  $('#chip-inputs').innerHTML = game.players.map((name, i) => `<label class="chip-card" style="--player:${colors[i]}"><span class="field-label"><i class="player-dot p${i}"></i>${escapeHtml(name)}</span><span class="chip-control"><input name="chip${i}" aria-label="${escapeHtml(name)}のチップ枚数" type="text" inputmode="numeric" maxlength="4" value="${chips[i] || ''}" placeholder="0" autocomplete="off" spellcheck="false" data-previous="${chips[i] || ''}"><span class="chip-unit">枚</span></span><span class="chip-points" id="chip-points-${i}"></span><strong class="final-total" id="final-total-${i}"></strong></label>`).join('');
  updateChipResults(totals);
}

function updateChipResults(totals = getTotals(game.rounds)) {
  const chipPoints = getChipPoints(game.chips);
  const finalTotals = getFinalTotals(game.rounds, game.chips);
  game.players.forEach((_, i) => {
    $(`#chip-points-${i}`).innerHTML = `チップ点 <b class="${tone(chipPoints[i])}">${formatScore(chipPoints[i], true)}</b>`;
    $(`#final-total-${i}`).innerHTML = `最終合計 <span class="${tone(finalTotals[i])}">${formatScore(finalTotals[i], true)}</span>`;
  });
  const chipSum = game.chips.reduce((sum, count) => sum + count, 0);
  $('#chip-balance').textContent = chipSum === 0 ? '4人のチップ合計：0枚' : `4人のチップ合計：${chipSum > 0 ? '+' : ''}${chipSum}枚（合計が0枚か確認してください）`;
  $('#chip-balance').classList.toggle('chip-warning', chipSum !== 0);
}

$('#setup-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const players = validateNames([...new FormData(event.currentTarget).values()]);
    if (recoveryNeeded && !window.confirm('読み込めなかった保存データを、新しいゲームで上書きしますか？')) return;
    commit({ version: 2, players, rounds: [], chips: [0, 0, 0, 0] });
    $('#setup-error').textContent = '';
    $('#score-inputs input').focus();
  } catch (error) { $('#setup-error').textContent = error.message; }
});

function updateInputStatus() {
  const count = [...$('#score-inputs').querySelectorAll('input')].filter(input => input.value.trim() !== '').length;
  $('#input-status').textContent = `${count} / 3人 入力済み`;
  $('#score-error').textContent = '';
}
// テキスト欄にすることで「不正な入力」と「空欄」を区別します。
// 入力途中のマイナスや小数点は許容し、登録時に厳密に検証します。
$('#score-inputs').addEventListener('input', event => {
  if (!event.target.matches('input')) return;
  const input = event.target;
  if (!/^[+-]?\d*(?:\.\d?)?$/.test(input.value)) {
    input.value = input.dataset.previous || '';
    $('#score-error').textContent = '半角数字・先頭のマイナス・小数1桁で入力してください。';
    return;
  }
  input.dataset.previous = input.value;
  updateInputStatus();
});
$('#score-inputs').addEventListener('click', event => {
  const button = event.target.closest('[data-index]');
  if (!button) return;
  const input = $(`[name="score${button.dataset.index}"]`);
  input.value = input.value.startsWith('-') ? input.value.slice(1) : '-' + input.value.replace(/^\+/, '');
  input.dataset.previous = input.value;
  updateInputStatus();
  input.focus();
});

function registerRound(values) {
  if (!game) throw new Error('先に4人の名前を登録してください。');
  const round = completeRound(values);
  commit({ ...game, rounds: [...game.rounds, round] });
  $('#success').textContent = `第${game.rounds.length}回を登録しました。${game.players[round.autoIndex]}：${formatScore(round.scores[round.autoIndex], true)}（自動計算）`;
  $('#score-inputs input').focus();
  return { round: game.rounds.length, scores: round.scores.map(score => score / 10), totals: getTotals(game.rounds).map(score => score / 10) };
}
$('#score-form').addEventListener('submit', event => {
  event.preventDefault();
  try { registerRound([...new FormData(event.currentTarget).values()]); }
  catch (error) { $('#score-error').textContent = error.message; $('#success').textContent = ''; }
});

$('#chip-inputs').addEventListener('input', event => {
  if (!event.target.matches('input')) return;
  const input = event.target;
  if (!/^[+-]?\d*$/.test(input.value)) {
    input.value = input.dataset.previous || '';
    $('#chip-error').textContent = 'チップは枚数を半角の整数で入力してください。';
    return;
  }
  input.dataset.previous = input.value;
  // 「-」だけの入力途中は保存せず、数字が続くのを待ちます。
  if (input.value === '-' || input.value === '+') return;
  try {
    const index = Number(input.name.replace('chip', ''));
    const chips = [...game.chips];
    chips[index] = parseChipCount(input.value);
    saveGame({ ...game, chips });
    game = { ...game, chips };
    $('#chip-error').textContent = '';
    updateChipResults();
  } catch (error) {
    $('#chip-error').textContent = error.message || 'チップを保存できませんでした。';
  }
});

$('#reset-button').addEventListener('click', () => $('#reset-dialog').showModal());
$('#cancel-reset').addEventListener('click', () => $('#reset-dialog').close());
$('#confirm-reset').addEventListener('click', () => {
  try { removeGame(); }
  catch { $('#reset-dialog').close(); storageWarning('リセットできませんでした。ブラウザの保存設定を確認してください。'); return; }
  game = null;
  $('#reset-dialog').close();
  $('#setup-form').reset();
  $('#success').textContent = '';
  storageWarning('');
  render();
  $('#setup-form input').focus();
});

render();

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
if (isIOS && !isStandalone && sessionStorage.getItem('janroku.installGuideClosed') !== '1') {
  $('#install-guide').hidden = false;
  // Safariで開いている場合は、最初の手順を省いて迷いを減らします。
  const isSafari = /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
  if (isSafari) $('#open-safari-step').hidden = true;
}
$('#close-install-guide').addEventListener('click', () => {
  $('#install-guide').hidden = true;
  sessionStorage.setItem('janroku.installGuideClosed', '1');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

// 対応するブラウザのみ、画面と同じ登録処理をエージェントにも提供します。
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'register_mahjong_round',
      title: '麻雀の結果を登録',
      description: '開始済みゲームに1回の収支を登録して保存します。4人の順番で収支を文字列として渡し、自動計算する1人は空文字にします。',
      inputSchema: { type: 'object', properties: { scores: { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 4 } }, required: ['scores'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || !Array.isArray(input.scores) || input.scores.some(score => typeof score !== 'string')) throw new Error('scoresには4人分の文字列を指定してください。');
        return registerRound(input.scores);
      }
    })).catch(() => {});
  } catch { /* 非対応環境でも通常の入力は利用できます。 */ }
}
