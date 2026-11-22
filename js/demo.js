// 本地试玩：直接复用线上对局的裁判引擎与协议，在浏览器里单机跑人机局。
// 不连数据库、不登录、不上传数据；刷新页面即结束。
import { engine, MODES } from '../supabase/functions/game/engine.mjs';
import { project, submit, GameError } from '../supabase/functions/game/protocol.mjs';

const { ROLES, CAMPS, summary } = globalThis.WOLF_MODES;
const SETUP_MODES = ['newbie6', 'std9', 'std12'];
const NIGHT_STEPS = new Set(['thief', 'cupid', 'guard', 'wolves', 'wolfbeauty', 'witch', 'seer']);
const pad = (n) => String(n).padStart(2, '0');
const $ = (id) => document.getElementById(id);

const els = {
  setup: $('setupView'), game: $('gameView'),
  modeSel: $('demoMode'), roleSel: $('demoRole'), hint: $('demoHint'), start: $('demoStart'),
  restart: $('demoRestart'),
  phase: $('phaseLabel'), clock: $('gameClock'), seatCount: $('seatCount'),
  prompt: $('statusPrompt'), status: $('statusBar'),
  meBar: $('meBar'), mySeat: $('mySeat'), myRoleTag: $('myRoleTag'), myRoleName: $('myRoleName'),
  roleToggle: $('roleToggle'), roleCard: $('roleCard'), roleTag: $('roleTag'), roleName: $('roleName'),
  roleSkill: $('roleSkill'),
  seats: $('demoSeats'), action: $('demoAction'), feed: $('demoFeed'),
  chatForm: $('chatForm'), chatInput: $('chatInput'), chatSend: $('chatSend'),
  result: $('resultBar'), resultText: $('resultText'), toast: $('toast'),
};

let mode = null;
let roster = [];
let actions = [];
let game = null;
let me = null;
let clockState = { t: Date.now() };
let loop = null;
let roleOpen = false;
let sceneKey = '';
let specialMode = null; // 需要先点按钮、再点座位的操作（决斗 / 自爆带人 / 开枪 / 用毒）
let armed = null;       // 本帧可以直接点击的座位与回调
let toastTimer;

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 250);
  }, 2200);
}

function roleName(r) { return ROLES[r]?.name || r; }
function isWolf(role) { return ['werewolf', 'wolfking', 'wolfboss', 'wolfbeauty'].includes(role); }
function canExplode(role) { return role === 'werewolf' || role === 'wolfking' || role === 'wolfboss'; }

// ---------- 设置 ----------
function fillModeOptions() {
  els.modeSel.replaceChildren(...SETUP_MODES.map((id) => {
    const m = MODES.find((x) => x.id === id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = m.name;
    return opt;
  }));
  els.modeSel.value = 'std9';
  fillRoleOptions();
}

function fillRoleOptions() {
  const m = MODES.find((x) => x.id === els.modeSel.value) || MODES[0];
  const seen = new Set();
  const opts = [new Option('随机身份', '')];
  for (const r of m.roles) {
    if (seen.has(r)) continue;
    seen.add(r);
    opts.push(new Option(roleName(r), r));
  }
  els.roleSel.replaceChildren(...opts);
  els.hint.textContent = `共 ${m.roles.length} 人：${summary(m)}。`;
}

// ---------- 开局 / 重开 ----------
function startDemo() {
  stopLoop();
  mode = MODES.find((m) => m.id === els.modeSel.value) || MODES[0];
  const chosen = els.roleSel.value || null;
  const size = mode.roles.length;
  roster = Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    name: '人机',
    is_bot: i !== 0,
    online: true,
    departed: false,
    role: i === 0 ? chosen : null,
    seat: null,
    alive: true,
  }));
  actions = [];
  clockState = { t: Date.now() };
  game = engine({ state: null, roster, mode, actions, clock: () => clockState.t });
  try {
    game.start();
  } catch (error) {
    toast(error.message);
    game = null;
    return;
  }
  me = roster[0];
  for (const row of roster) row.name = row.seat === me.seat ? '你' : '人机';
  roleOpen = false;
  sceneKey = '';
  specialMode = null;
  armed = null;
  els.setup.hidden = true;
  els.game.hidden = false;
  els.result.hidden = true;
  game.tick();
  render();
  toast(`你是 ${pad(me.seat)} 号 · ${roleName(me.role)}`);
  loop = setInterval(() => {
    if (!game) return;
    if (game.state.phase === 'finished') { stopLoop(); render(); return; }
    clockState.t += 1000;
    const before = sceneSignature();
    game.tick();
    if (sceneSignature() !== before) render();
    else renderStatus(game.state, project(game.state, me));
  }, 1000);
}

function sceneSignature() {
  const g = game.state;
  return [
    g.day, g.phase, g.step, g.speechIndex, g.policeIndex, g.sheriff,
    g.aliveSeats.join(','), (g.log || []).length, actions.length,
    g.hunterPending, g.badgePending, g.lastWordsSeat, (g.kicked || []).join(','), g.winner,
  ].join('|');
}

function stopLoop() {
  if (loop) { clearInterval(loop); loop = null; }
}

function restart() {
  stopLoop();
  game = null;
  me = null;
  els.game.hidden = true;
  els.setup.hidden = false;
}

// ---------- 行动 ----------
function act(step, target = null, payload = {}) {
  if (!game || game.state.phase === 'finished') return;
  const g = game.state;
  try {
    submit(game, me, { matchId: g.matchId, day: g.day, step, target, payload }, actions);
  } catch (error) {
    toast(error instanceof GameError || error?.message ? error.message : '这个操作现在不能做');
    return;
  }
  specialMode = null;
  armed = null;
  game.tick();
  render();
}

function skip() {
  if (!game || game.state.phase === 'finished') return;
  const g = game.state;
  clockState.t = Math.max(clockState.t, (g.deadline ?? clockState.t) + 1);
  game.tick();
  render();
}

function sendChat() {
  if (!game || game.state.phase === 'finished') return;
  const text = els.chatInput.value.trim();
  if (!text) return;
  const g = game.state;
  if (g.phase === 'night' && isWolf(me.role)) act('wolfchat', null, { name: me.name, text });
  else if (canSpeak()) act('chat', null, { name: me.name, text });
  else { toast('现在不是你的发言时间'); return; }
  els.chatInput.value = '';
}

function speakerOf(g) {
  if (g.phase === 'day') return g.speechOrder?.[g.speechIndex] ?? null;
  if (g.phase === 'sheriff' && g.step === 'policeSpeech') return g.policeOrder?.[g.policeIndex] ?? null;
  if (g.phase === 'lastwords') return g.lastWordsSeat ?? null;
  return null;
}

function canSpeak() {
  if (!game) return false;
  const g = game.state;
  if (!g.aliveSeats.includes(me.seat)) return false;
  return speakerOf(g) === me.seat;
}

// ---------- 渲染 ----------
function render() {
  if (!game) return;
  const g = game.state;
  const view = project(g, me);
  const key = `${g.day}:${g.phase}:${g.step}`;
  if (key !== sceneKey) { sceneKey = key; specialMode = null; }
  if (g.phase === 'finished') {
    stopLoop();
    els.result.hidden = false;
    const label = g.winner === 'wolf' ? '狼人阵营获胜'
      : g.winner === 'lovers' ? '第三方阵营获胜' : '好人阵营获胜';
    els.resultText.textContent = `${label} · ${g.winReason || ''}`;
  } else {
    els.result.hidden = true;
  }
  renderStatus(g, view);
  renderMe(view);
  renderAction(g, view);
  renderSeats(g, view);
  renderFeed(g, view);
  renderChat(g);
}

function stepLabel(step) {
  return {
    guard: '守卫守护', wolves: '狼人刀人', witch: '女巫用药', seer: '预言家查验',
    wolfbeauty: '狼美人魅惑', thief: '盗贼选牌', cupid: '丘比特连人',
  }[step] || step;
}

function describe(g, view) {
  if (g.phase === 'finished') return ['对局结束', '点「重新开始」再来一局。'];
  if (g.phase === 'night') {
    const mine = view.step !== 'night' && NIGHT_STEPS.has(view.step);
    if (!mine) return [`第 ${g.day} 夜 · 天黑请闭眼`, '其他角色正在行动，点「跳过本步」可快进。'];
    return [`第 ${g.day} 夜 · ${stepLabel(view.step)}`, '轮到你行动，按提示操作。'];
  }
  if (g.phase === 'dawn') return [`第 ${g.day} 天 · 天亮了`, '即将公布昨夜出局情况…'];
  if (g.phase === 'sheriff') {
    return {
      policeSignup: ['警长竞选 · 上警', '选择是否参加警长竞选。'],
      policeSpeech: ['警长竞选 · 候选人发言', '候选人按座位顺序发言，警下玩家稍后投票。'],
      policeVote: ['警长竞选 · 警下投票', '没上警的玩家投票选警长，可以弃权。'],
      policeRunoff: ['警长竞选 · 平票再投', '平票候选人之间再投一次，再平票则警徽流失。'],
    }[g.step] || ['警长竞选', ''];
  }
  if (g.phase === 'order') return ['警长选发言方向', '警长选择顺时针或逆时针，但自己最后一个发言。'];
  if (g.phase === 'day') return [`第 ${g.day} 天 · 讨论`, '按顺序发言，轮到你时在下方输入，说完点「结束发言」。'];
  if (g.phase === 'vote') return [`第 ${g.day} 天 · 放逐投票`, '点座位投票，不能投自己，也可以弃权。'];
  if (g.phase === 'runoff') return [`第 ${g.day} 天 · 放逐 PK`, '只能在平票的玩家中选择。'];
  if (g.phase === 'lastwords') return ['遗言', '出局玩家按顺序留遗言。'];
  if (g.phase === 'hunter') return ['出局确认', '等待出局结算…'];
  if (g.phase === 'badge') return ['移交警徽', '出局的警长可以移交或撕掉警徽。'];
  return [g.phase, ''];
}

function renderStatus(g, view) {
  const [label, prompt] = describe(g, view);
  els.phase.textContent = label;
  els.prompt.textContent = prompt;
  els.status.classList.toggle('sr-night', g.phase === 'night');
  els.seatCount.textContent = `存活 ${g.aliveSeats.length} / ${roster.length}`;
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - clockState.t) / 1000)) : null;
  els.clock.textContent = left == null ? '' : `剩余 ${left} 秒`;
}

function renderMe(view) {
  els.meBar.hidden = !me;
  if (!me) return;
  els.mySeat.textContent = `座位 ${pad(me.seat)}`;
  const info = ROLES[me.role] || {};
  els.myRoleTag.className = `sr-tag ${CAMPS[info.camp]?.tag || ''}`;
  els.myRoleTag.textContent = info.name || roleName(me.role);
  els.myRoleName.textContent = CAMPS[info.camp]?.name || '';
  const bar = CAMPS[info.camp]?.bar || '';
  els.meBar.className = `sr-me mb-3 ${bar}`;
  els.roleToggle.textContent = roleOpen ? '收起身份牌' : '查看身份牌';
  els.roleCard.hidden = !roleOpen;
  els.roleTag.className = `sr-tag ${CAMPS[info.camp]?.tag || ''}`;
  els.roleTag.textContent = info.name || roleName(me.role);
  els.roleName.textContent = info.campName || '';
  els.roleSkill.textContent = info.skill || '按规则行动。';
}

function note(text) {
  const div = document.createElement('div');
  div.className = 'sr-act-hint';
  div.textContent = text;
  return div;
}

function makeBtn(text, cls, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-sm ${cls}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function actedToday(step) {
  const g = game.state;
  return actions.some((a) => a.day === g.day && a.step === step && a.seat === me.seat);
}

function aliveSeatsExcept(seat) {
  return game.state.aliveSeats.filter((s) => s !== seat);
}

function armPick(allowed, onPick) {
  armed = { allowed: new Set(allowed), onPick };
}

function appendSkip() {
  els.action.append(makeBtn('跳过本步（模拟超时）', 'btn-outline-secondary', skip));
}

function appendExplode() {
  const g = game.state;
  if (!canExplode(me.role) || !g.aliveSeats.includes(me.seat)) return;
  if (!['day', 'vote', 'runoff', 'sheriff', 'order', 'lastwords'].includes(g.phase)) return;
  if (me.role === 'wolfking') {
    els.action.append(makeBtn('自爆带人', 'btn-danger', () => {
      specialMode = 'explodeTarget';
      render();
    }));
    els.action.append(makeBtn('只自爆', 'btn-outline-danger', () => act('explode', null, { explode: true })));
    els.action.append(note('自爆后立即翻牌出局并进入黑夜；带人只能选一名其他存活玩家。'));
  } else {
    els.action.append(makeBtn('自爆（立即天黑）', 'btn-outline-danger', () => act('explode', null, { explode: true })));
    els.action.append(note('自爆后你立即出局，今天剩余流程全部跳过，直接进入黑夜。'));
  }
}

function renderAction(g, view) {
  els.action.replaceChildren();
  armed = null;
  if (!me) return;
  if (g.phase === 'finished') {
    els.action.append(note('对局已经结束。'));
    return;
  }

  // 出局结算优先：确认 / 猎人
  if (view.step === 'deathConfirm') {
    els.action.append(note('你出局了。可以选择翻牌（普通角色不翻牌）并确认；超时同样视为不翻牌。'));
    els.action.append(makeBtn('确认出局（不翻牌）', 'btn-primary', () => act('deathConfirm')));
    return;
  }
  if (view.hunterPending === me.seat) {
    if (specialMode === 'hunterShoot') {
      els.action.append(note('猎人开枪：点击要带走的玩家。'));
      armPick(aliveSeatsExcept(me.seat), (seat) => act('hunter', seat, { reveal: true }));
      els.action.append(makeBtn('取消', 'btn-outline-secondary', () => { specialMode = null; render(); }));
      return;
    }
    els.action.append(note('你是猎人：可以翻牌开枪带走一人，或翻牌不开枪，或不翻牌直接出局。毒杀、被白狼王带走不会触发。'));
    els.action.append(makeBtn('翻牌开枪', 'btn-danger', () => { specialMode = 'hunterShoot'; render(); }));
    els.action.append(makeBtn('翻牌不开枪', 'btn-outline-danger', () => act('hunter', null, { reveal: true })));
    els.action.append(makeBtn('不翻牌出局', 'btn-outline-secondary', () => act('hunter', null, { reveal: false })));
    appendSkip();
    return;
  }
  if (g.phase === 'badge') {
    if (view.badgePending !== me.seat) { els.action.append(note('等待出局警长处理警徽…')); appendSkip(); return; }
    els.action.append(note('你出局了：点一名存活玩家移交警徽，或者撕掉。'));
    armPick(g.aliveSeats, (seat) => act('badge', seat));
    els.action.append(makeBtn('撕掉警徽（不移交）', 'btn-outline-secondary', () => act('badge', -1)));
    return;
  }
  if (g.phase === 'lastwords') {
    if (view.lastWordsSeat !== me.seat) {
      els.action.append(note(view.lastWordsSeat != null ? `等待 ${pad(view.lastWordsSeat)} 号发表遗言…` : '遗言结束…'));
      appendSkip();
      return;
    }
    els.action.append(note('发表遗言：在下方输入，可连发多条，说完点「说完了」。'));
    els.action.append(makeBtn('说完了', 'btn-warning', () => act('lastwords', null, { end: true })));
    return;
  }

  if (view.pendingDead) {
    els.action.append(note('你昨夜已出局，死讯会在竞选结束后公布；本轮不能上警或投票。'));
    appendSkip();
    return;
  }
  if (!g.aliveSeats.includes(me.seat)) {
    els.action.append(note('你已出局，等待本局结束。'));
    appendSkip();
    return;
  }

  if (g.phase === 'night') {
    renderNightPanel(g, view);
    appendSkip();
    return;
  }
  if (g.phase === 'dawn') { els.action.append(note('天亮了…')); appendSkip(); return; }
  if (g.phase === 'sheriff') { renderSheriffPanel(g, view); appendSkip(); return; }
  if (g.phase === 'order') {
    if (view.sheriff !== me.seat) { els.action.append(note(`等待警长 ${pad(view.sheriff)} 号决定发言方向…`)); }
    else {
      els.action.append(note('你是警长：选顺时针或逆时针，其他人从你的下家开始，你最后一个发言。'));
      els.action.append(makeBtn('顺时针', 'btn-primary', () => act('order', null, { dir: 'cw' })));
      els.action.append(makeBtn('逆时针', 'btn-primary', () => act('order', null, { dir: 'ccw' })));
    }
    appendSkip();
    return;
  }
  if (g.phase === 'day') { renderDayPanel(g, view); appendSkip(); return; }
  if (g.phase === 'vote' || g.phase === 'runoff') { renderVotePanel(g, view); appendSkip(); return; }
  els.action.append(note('等待推进…'));
  appendSkip();
}

function renderNightPanel(g, view) {
  const step = view.step;
  if (step === 'night' || !NIGHT_STEPS.has(step)) {
    els.action.append(note(`第 ${g.day} 夜：等待其他角色行动…`));
    return;
  }
  if (step === 'guard') {
    els.action.append(note(`守卫：点一名存活玩家守护，不能连续两晚守同一人${view.lastGuard ? `（上一晚守了 ${pad(view.lastGuard)} 号）` : ''}。`));
    armPick(g.aliveSeats.filter((s) => s !== view.lastGuard), (seat) => act('guard', seat));
    return;
  }
  if (step === 'wolves') {
    const mates = (view.teams?.wolves || []).filter((s) => s !== me.seat);
    els.action.append(note(`狼人：点一名玩家作为刀口${mates.length ? `（狼队友：${mates.map(pad).join('、')} 号）` : ''}。可空刀，也可以在狼频道聊天。`));
    armPick(g.aliveSeats, (seat) => act('wolves', seat));
    return;
  }
  if (step === 'witch') {
    const kill = view.kill;
    const potions = view.potions || {};
    els.action.append(note(`女巫：${kill ? `今晚刀口是 ${pad(kill)} 号。` : '今晚没有刀口。'}解药${potions.save ? '还在' : '已用'}，毒药${potions.poison ? '还在' : '已用'}。`));
    if (specialMode === 'poison') {
      els.action.append(note('毒药：点击要毒的人（可以毒自己）。'));
      armPick(g.aliveSeats, (seat) => act('witch', seat, { poison: seat }));
      els.action.append(makeBtn('取消', 'btn-outline-secondary', () => { specialMode = null; render(); }));
      return;
    }
    if (potions.save && kill) {
      els.action.append(makeBtn(`用解药救 ${pad(kill)} 号`, 'btn-success', () => act('witch', null, { save: true })));
    }
    if (potions.poison) {
      els.action.append(makeBtn('用毒药', 'btn-danger', () => { specialMode = 'poison'; render(); }));
    }
    els.action.append(makeBtn('不用药', 'btn-outline-secondary', () => act('witch', null, {})));
    return;
  }
  if (step === 'seer') {
    const checks = (view.checks || []).map((c) => `${pad(c.target)} 号→${c.killer ? '狼人' : '好人'}`).join('；');
    els.action.append(note(`预言家：点一名玩家查验。${checks ? `已验：${checks}` : ''}`));
    armPick(aliveSeatsExcept(me.seat), (seat) => act('seer', seat));
    return;
  }
  if (step === 'wolfbeauty') {
    els.action.append(note('狼美人：点一名其他存活玩家魅惑，不能连续两晚选同一人。'));
    armPick(g.aliveSeats.filter((s) => s !== me.seat && s !== view.lastCharm), (seat) => act('wolfbeauty', seat));
    return;
  }
  els.action.append(note('等待行动…'));
}

function renderSheriffPanel(g, view) {
  const step = g.step;
  if (step === 'policeSignup') {
    if (actedToday('policeSignup')) { els.action.append(note('已选择，等待其他玩家…')); return; }
    els.action.append(note('警长竞选：上警后要发言，再接受警下投票；不想当请点「不上警」。'));
    els.action.append(makeBtn('上警', 'btn-danger', () => act('policeSignup', null, { run: true })));
    els.action.append(makeBtn('不上警', 'btn-outline-secondary', () => act('policeSignup', null, { run: false })));
    return;
  }
  if (step === 'policeSpeech') {
    const cand = view.policeOrder?.[view.policeIndex];
    if (cand == null) { els.action.append(note('候选人发言结束，准备警下投票…')); return; }
    if (cand !== me.seat) {
      els.action.append(note(`等待 ${pad(cand)} 号候选人发言（${view.policeIndex + 1}/${view.policeOrder.length}）。`));
      return;
    }
    els.action.append(note('轮到你竞选发言：在下方输入，说完点「结束发言」。'));
    els.action.append(makeBtn('结束发言', 'btn-warning', () => act('policeSpeech', null, { turn: view.policeIndex })));
    return;
  }
  const cands = (step === 'policeRunoff' ? view.runoffSeats : view.sheriffCandidates) || [];
  if (cands.includes(me.seat)) { els.action.append(note('你是候选人，不能参与警下投票。')); return; }
  if (actedToday(step)) { els.action.append(note('已投票，等待其他玩家…')); return; }
  if (!cands.length) { els.action.append(note('没有候选人，等待警徽结果…')); return; }
  els.action.append(note(`警下投票：从 ${cands.map(pad).join('、')} 号里选一人当警长。`));
  armPick(cands, (seat) => act(step, seat));
  els.action.append(makeBtn('弃权', 'btn-outline-secondary', () => act(step, -1)));
}

function renderDayPanel(g, view) {
  if (specialMode === 'knight') {
    els.action.append(note('骑士决斗：点击一名玩家。对方是狼则对方出局并直接天黑；对方是好人则你出局。'));
    armPick(aliveSeatsExcept(me.seat), (seat) => act('day', seat, { duel: seat }));
    els.action.append(makeBtn('取消', 'btn-outline-secondary', () => { specialMode = null; render(); }));
    return;
  }
  if (specialMode === 'explodeTarget') {
    els.action.append(note('白狼王自爆带人：点击要带走的玩家。'));
    armPick(aliveSeatsExcept(me.seat), (seat) => act('explode', seat, { explode: true, target: seat }));
    els.action.append(makeBtn('取消', 'btn-outline-secondary', () => { specialMode = null; render(); }));
    return;
  }
  if (me.role === 'knight' && !view.knightUsed) {
    els.action.append(makeBtn('翻牌决斗', 'btn-primary', () => { specialMode = 'knight'; render(); }));
    els.action.append(note('骑士白天可以决斗一次，投票开始前使用。'));
  }
  appendExplode();
  const speaker = view.speechOrder?.[view.speechIndex];
  if (speaker === me.seat) {
    els.action.append(note('轮到你发言：在下方输入，可连发多条，说完点「结束发言」。'));
    els.action.append(makeBtn('结束发言', 'btn-warning', () => act('speech', null, { turn: view.speechIndex })));
  } else if (speaker != null) {
    els.action.append(note(`按顺序发言，等待 ${pad(speaker)} 号…`));
  } else {
    els.action.append(note('讨论结束，准备投票…'));
  }
}

function renderVotePanel(g, view) {
  if ((view.voteBanned || []).includes(me.seat)) { els.action.append(note('你已失去投票权。')); appendExplode(); return; }
  if (specialMode === 'explodeTarget') {
    els.action.append(note('白狼王自爆带人：点击要带走的玩家。'));
    armPick(aliveSeatsExcept(me.seat), (seat) => act('explode', seat, { explode: true, target: seat }));
    els.action.append(makeBtn('取消', 'btn-outline-secondary', () => { specialMode = null; render(); }));
    return;
  }
  if (actedToday(g.step)) { els.action.append(note('已投票，等待其他玩家…')); appendExplode(); return; }
  let allowed = aliveSeatsExcept(me.seat);
  if (g.phase === 'runoff' && view.runoffSeats) allowed = allowed.filter((s) => view.runoffSeats.includes(s));
  if (!allowed.length) { els.action.append(note('没有可投的人，转入下一夜…')); return; }
  els.action.append(note(g.phase === 'runoff'
    ? `PK 投票：只能在 ${view.runoffSeats.map(pad).join('、')} 号中选择。`
    : '投票：点座位选择你要放逐的人，不能投自己。'));
  armPick(allowed, (seat) => act(g.step, seat));
  els.action.append(makeBtn('弃权', 'btn-outline-secondary', () => act(g.step, -1)));
  appendExplode();
}

function renderSeats(g, view) {
  const bySeat = new Map(roster.map((p) => [p.seat, p]));
  const alive = new Set(view.aliveSeats);
  const speaker = speakerOf(g);
  const wolfMates = isWolf(me.role) ? new Set(view.teams?.wolves || []) : new Set();
  const checks = new Map((view.checks || []).map((c) => [c.target, c.killer]));
  const frag = document.createDocumentFragment();
  for (let seat = 1; seat <= roster.length; seat += 1) {
    const row = bySeat.get(seat);
    const li = document.createElement('li');
    li.className = 'sr-seat';
    if (seat === me.seat) li.classList.add('sr-self');
    if (!alive.has(seat)) li.classList.add('sr-dead');
    if (speaker === seat) li.classList.add('sr-speaking');
    const clickable = armed && armed.allowed.has(seat);
    if (clickable) {
      li.classList.add('sr-clickable');
      li.tabIndex = 0;
      const fire = () => {
        const cb = armed.onPick;
        armed = null;
        cb(seat);
      };
      li.addEventListener('click', fire);
      li.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fire(); } });
    }
    const head = document.createElement('div');
    head.className = 'sr-seat-head';
    const num = document.createElement('span');
    num.className = 'sr-num';
    num.textContent = pad(seat);
    head.append(num);
    const avatar = document.createElement('div');
    avatar.className = 'sr-avatar';
    const name = document.createElement('span');
    name.className = 'sr-name';
    const marks = document.createElement('div');
    marks.className = 'sr-marks';
    if (!row) {
      li.classList.add('sr-seat-empty');
      avatar.textContent = '·';
      name.textContent = '空座';
    } else {
      avatar.textContent = (row.name || '?').trim().charAt(0);
      name.textContent = row.name;
      if (view.sheriff === seat) marks.append(badge('警长', 'badge-dark'));
      if ((view.kicked || []).includes(seat)) marks.append(badge('已请离', 'badge-danger'));
      else if (!alive.has(seat)) marks.append(badge('出局', 'badge-secondary'));
      if (g.phase === 'finished' && row.role) {
        const info = ROLES[row.role] || {};
        const tag = document.createElement('span');
        tag.className = `sr-tag ${CAMPS[info.camp]?.tag || ''}`;
        tag.textContent = info.name || row.role;
        marks.append(tag);
      } else if (wolfMates.has(seat)) {
        marks.append(badge('狼', 'badge-danger'));
      }
      if (checks.has(seat)) marks.append(badge(checks.get(seat) ? '查杀' : '金水', checks.get(seat) ? 'badge-danger' : 'badge-success'));
    }
    li.append(head, avatar, name, marks);
    frag.append(li);
  }
  els.seats.replaceChildren(frag);
}

function badge(text, cls) {
  const span = document.createElement('span');
  span.className = `badge ${cls}`;
  span.textContent = text;
  return span;
}

function renderFeed(g, view) {
  const rows = [];
  const privateNotes = [];
  if (view.teams?.wolves && isWolf(me.role)) {
    privateNotes.push(`狼队友（含你）：${view.teams.wolves.map(pad).join('、')} 号`);
  }
  if (me.role === 'seer' && view.checks?.length) {
    for (const c of view.checks) privateNotes.push(`你查验：第 ${c.day} 夜 ${pad(c.target)} 号 → ${c.killer ? '狼人' : '好人'}`);
  }
  if (me.role === 'witch' && view.potions && g.phase === 'night') {
    if (view.kill) privateNotes.push(`今晚刀口：${pad(view.kill)} 号`);
    privateNotes.push(`解药${view.potions.save ? '还在' : '已用'} · 毒药${view.potions.poison ? '还在' : '已用'}`);
  }
  for (const text of privateNotes) rows.push(ev(text, 'sr-ev-wolf'));

  const maxDay = Math.max(g.day, ...(g.log || []).map((e) => e.day || 1));
  for (let day = 1; day <= maxDay; day += 1) {
    const dayLogs = (g.log || []).filter((e) => (e.day || 1) === day);
    const dayChats = actions.filter((a) => a.day === day && (a.step === 'chat' || (a.step === 'wolfchat' && isWolf(me.role))));
    if (!dayLogs.length && !dayChats.length) continue;
    rows.push(ev(`第 ${day} 天`, 'sr-ev-muted'));
    for (const e of dayLogs) rows.push(ev(e.text, logClass(e.kind)));
    for (const a of dayChats) {
      const who = a.step === 'wolfchat' ? `狼频道 ${pad(a.seat)}` : `${pad(a.seat)} 号`;
      rows.push(ev(`${who}：${a.payload?.text || ''}`, a.step === 'wolfchat' ? 'sr-ev-wolf' : ''));
    }
  }
  els.feed.replaceChildren(...rows);
  els.feed.scrollTop = els.feed.scrollHeight;
}

function ev(text, cls) {
  const div = document.createElement('div');
  div.className = `sr-ev ${cls || ''}`.trim();
  div.textContent = text;
  return div;
}

function logClass(kind) {
  return { night: 'sr-ev-night', death: 'sr-ev-warn', finish: 'sr-ev-warn', vote: 'sr-ev-vote', warning: 'sr-ev-warn' }[kind] || '';
}

function renderChat(g) {
  let placeholder = '现在不是你的发言时间';
  let on = false;
  if (g.phase !== 'finished' && g.aliveSeats.includes(me?.seat ?? -1)) {
    if (g.phase === 'night' && isWolf(me.role)) { placeholder = '狼频道：和狼队友商量（仅你们可见）'; on = true; }
    else if (canSpeak()) { placeholder = '输入发言，说完点「结束发言」'; on = true; }
  }
  els.chatInput.disabled = !on;
  els.chatSend.disabled = !on;
  els.chatInput.placeholder = placeholder;
}

els.modeSel.addEventListener('change', fillRoleOptions);
els.start.addEventListener('click', startDemo);
els.restart.addEventListener('click', restart);
els.roleToggle.addEventListener('click', () => { roleOpen = !roleOpen; render(); });
els.chatForm.addEventListener('submit', (event) => { event.preventDefault(); sendChat(); });

fillModeOptions();
