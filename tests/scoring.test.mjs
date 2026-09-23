import test from 'node:test';
import assert from 'node:assert/strict';
import { completeRound, getRemainingScores, getTotals, getRanks, formatScore, validateNames } from '../dist/scoring.mjs';
import { loadGame, saveGame, removeGame, STORAGE_KEY } from '../dist/storage.mjs';

test('4人の名前・空白除去・不足時のエラー', () => {
  assert.deepEqual(validateNames([' A ', 'B', 'C', 'D']), ['A', 'B', 'C', 'D']);
  assert.throws(() => validateNames(['A', '', 'C', 'D']));
});
test('どの位置を空欄にしても収支合計0', () => {
  const expected = [-200, -100, 100, 200];
  for (let i = 0; i < 4; i++) {
    const values = ['-20', '-10', '10', '20']; values[i] = '';
    assert.deepEqual(completeRound(values), { scores: expected, autoIndex: i });
  }
});
test('負数・自動計算の負数・小数を正確に計算', () => {
  assert.deepEqual(completeRound(['-5.5', '10.1', '-2.2', '']).scores, [-55, 101, -22, -24]);
  assert.deepEqual(completeRound(['-20', '-10', '10', '']).scores, [-200, -100, 100, 200]);
  assert.deepEqual(completeRound(['0.1', '0.2', '0.3', '']).scores, [1, 2, 3, -6]);
});
test('空欄数・不正文字・範囲外の入力を拒否', () => {
  for (const values of [['', '', '', ''], ['30', '30', '', ''], ['30', '30', '30', '30'], ['abc', '30', '30', ''], ['-', '30', '30', ''], ['3.12', '30', '30', ''], ['Infinity', '30', '30', ''], ['1e2', '30', '30', ''], ['999999999', '30', '30', ''], ['-99999', '-99999', '30', '']]) assert.throws(() => completeRound(values));
});
test('履歴からの累計・同順位・符号', () => {
  const rounds = [completeRound(['-20','-10','10','']), completeRound(['10','5','-5',''])];
  assert.deepEqual(getTotals(rounds), [-100,-50,50,100]);
  assert.deepEqual(getRanks(getTotals(rounds)), [4,3,2,1]);
  assert.equal(getTotals(rounds).reduce((a,b)=>a+b), 0);
  assert.deepEqual(getRemainingScores(rounds[0]), [100,200,400,500]);
  assert.equal(formatScore(100,true), '+10');
  assert.equal(formatScore(-100,true), '-10');
});
test('保存・復元・旧形式の変換・リセット・破損データ', () => {
  const map = new Map();
  const storage = { getItem:key=>map.get(key)??null, setItem:(key,value)=>map.set(key,value), removeItem:key=>map.delete(key) };
  const game = { version:2, players:['A','B','C','D'], rounds:[completeRound(['-20','-10','10',''])] };
  saveGame(game,storage);
  assert.deepEqual(loadGame(storage), {...game,totals:[-200,-100,100,200]});
  removeGame(storage); assert.equal(loadGame(storage),null);
  const oldGame = { version:1, players:['A','B','C','D'], rounds:[{scores:[100,200,400,500],autoIndex:3}] };
  storage.setItem(STORAGE_KEY,JSON.stringify(oldGame));
  assert.deepEqual(loadGame(storage).rounds[0].scores,[-200,-100,100,200]);
  const oldMisenteredGame = { version:1, players:['A','B','C','D'], rounds:[{scores:[-200,-100,100,1400],autoIndex:3}] };
  storage.setItem(STORAGE_KEY,JSON.stringify(oldMisenteredGame));
  assert.deepEqual(loadGame(storage).rounds[0].scores,[-200,-100,100,200]);
  storage.setItem(STORAGE_KEY,'{broken'); assert.throws(()=>loadGame(storage));
  storage.setItem(STORAGE_KEY,JSON.stringify({...game, rounds:[{scores:[0,0,0,1],autoIndex:3}]})); assert.throws(()=>loadGame(storage));
});
