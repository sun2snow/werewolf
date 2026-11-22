// Authenticated game commands. Raw roles, action rows and authoritative state
// never travel over the browser's Supabase table/realtime clients.
async function gameRequest(op, code, args = {}) {
  const epoch = authEpoch;
  const accountId = profile?.id;
  const current = (await client.auth.getSession()).data?.session;
  if (epoch !== authEpoch || !accountId || current?.user?.id !== accountId || !current.access_token) throw new Error('登录状态已变化');
  const token = current.access_token;
  const { data, error } = await client.functions.invoke('game', {
    headers: { Authorization: `Bearer ${token}` }, body: { op, code, ...args, accountId },
  });
  if (epoch !== authEpoch) throw new Error('登录状态已变化');
  if (error) {
    const status = error.context?.status;
    if (status === 401) {
      const latest = (await client.auth.getSession()).data?.session;
      if (epoch === authEpoch && latest?.access_token === token) showAuthScreen();
      else throw new Error('登录凭据已变化，请按当前状态重试');
      throw new Error('登录状态过期，请重新登录');
    }
    let reason = error.message;
    if (error.context?.headers?.get('content-type')?.includes('application/json')) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === 'string') reason = body.error;
    }
    throw new Error(`对局服务连接失败${status ? `（HTTP ${status}）` : ''}：${reason}`);
  }
  if (!data || data.error) {
    const failure = new Error(data?.error || '对局响应为空');
    if (data?.code === 'SETTLEMENT_RETRY') failure.retry = data.retry;
    throw failure;
  }
  return data;
}
async function createRoom(custom = null) {
  const epoch = authEpoch;
  const base = custom ? { mode: 'custom', custom } : { mode: els.modeSelect.value };
  for (let i = 0; i < 6; i++) {
    const saved = localStorage.getItem(membershipKey());
    const result = await gameRequest('create', randomCode(), { ...base, includeSnapshot: true });
    if (epoch !== authEpoch) return;
    if (!result.collision) {
      enterRoom(result, localStorage.getItem(membershipKey()) === saved ? result.snapshot : null);
      return;
    }
  }
  throw new Error('房间码生成失败，请重试');
}
async function joinRoom(_name, code) {
  const epoch = authEpoch;
  const saved = localStorage.getItem(membershipKey());
  const result = await gameRequest('join', code, { includeSnapshot: true });
  if (epoch === authEpoch) enterRoom(result, localStorage.getItem(membershipKey()) === saved ? result.snapshot : null);
}
function membershipKey() { return `${SESSION_KEY}:${profile?.id}`; }
function newerSeat(active) {
  try {
    const record = JSON.parse(localStorage.getItem(membershipKey()));
    return record?.code === active.code && record.playerId !== active.playerId;
  } catch { return false; }
}
window.addEventListener('storage', event => {
  if (session && event.key === membershipKey() && newerSeat(session)) exitRoomLocal('座位已变化，刷新可恢复新座位');
});
async function restoreSession() {
  const epoch = authEpoch;
  const ownKey = membershipKey();
  const key = localStorage.getItem(ownKey) === null ? SESSION_KEY : ownKey;
  const saved = localStorage.getItem(key);
  if (!saved) return;
  let parsed;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return;
  }
  if (!/^\d{6}$/.test(parsed?.code) || !parsed.playerId) {
    return;
  }
  if (parsed.accountId && parsed.accountId !== profile?.id) return;
  let result;
  try {
    result = await gameRequest('restore', parsed.code, { includeSnapshot: true });
  } catch (error) {
    if (!error.retry) throw error;
    if (epoch !== authEpoch || session || localStorage.getItem(key) !== saved) return;
    // A rolled-back settlement shouldn't prevent reconnecting. Restore only
    // the seat and let the normal snapshot poll handle settlement retries.
    result = await gameRequest('restore', parsed.code);
  }
  if (epoch !== authEpoch || session || localStorage.getItem(key) !== saved) return;
  if (key === SESSION_KEY && (localStorage.getItem(ownKey) !== null || result.playerId !== parsed.playerId)) return;
  if (result.gone) localStorage.removeItem(key);
  else {
    enterRoom(result, result.snapshot);
    if (key === SESSION_KEY && localStorage.getItem(key) === saved) localStorage.removeItem(key);
  }
}
function isPlayerOnline(member) {
  return member?.online !== false;
}
function isSeatOnline(seat) {
  return isPlayerOnline(members.find((p) => p.seat === seat));
}

function sameSnapshot(before, after) {
  // Presence and the viewer's permitted fields can change at the same revision.
  return before?.revision === after.revision && JSON.stringify(before) === JSON.stringify(after);
}

function roomViewWithoutChat({ revision, chat, viewTag, ...view }) {
  return view;
}

function updateRoomChat(data) {
  chatRows = data.channel === 'chat' ? data.chat : [];
  wolfChatRows = data.channel === 'wolfchat' ? data.chat : [];
}

function noteRoomSynced() {
  // The clock updates independently, but a queued draft may need another attempt.
  if (pendingSpeechCount()) updateChatForm();
  setConn('已连接 · 服务端同步中', true);
}

function checkUnchangedView(data, code, viewTag) {
  if (!viewTag || data.code !== code || data.viewTag !== viewTag) throw new Error('房间同步响应不匹配');
}

function applySnapshot(data, allowPartial = false) {
  if (!session || data.code !== session.code || data.revision < (room?.revision ?? -1)) return;
  if (newerSeat(session) || data.me?.id !== session.playerId) {
    exitRoomLocal('此标签页的座位已失效。刷新可恢复当前座位，或用房间码重新加入。');
    return;
  }
  if (allowPartial && room && JSON.stringify(roomViewWithoutChat(room)) === JSON.stringify(roomViewWithoutChat(data))) {
    // A message advances the revision but need not reset seat controls.
    const chatChanged = JSON.stringify(room.chat) !== JSON.stringify(data.chat);
    room = data;
    if (chatChanged) {
      updateRoomChat(data);
      renderChat();
    }
    noteRoomSynced();
    return;
  }
  const previous = g;
  room = data;
  members = data.members;
  myRow = data.me;
  g = data.options.g;
  if (previous && previous.matchId !== g?.matchId) {
    clearPreSpeech();
    roleShown = false;
  }
  const next = g ? `${g.matchId}:${g.day}:${g.phase}:${g.step}` : 'waiting';
  if (next !== phaseKey) {
    phaseKey = next;
    pick = null;
    kickAsked = null;
  }
  submitted = new Set(data.submitted);
  wolfPicks = data.wolfPicks;
  updateRoomChat(data);
  if (!feedSeeded) {
    localFeed.push(`房间 ${session.code} · ${currentMode().name}`);
    feedSeeded = true;
  }
  renderRoom();
  renderChat();
  renderGameOver();
  updateHomeRoomCard();
  const key = members.map((p) => p.name).sort().join('|');
  if (key && key !== ratingsKey) {
    loadRatings().then(() => {
      if (session) renderRoom();
    });
  }
  setConn('已连接 · 服务端同步中', true);
}
let failedSettlement = null;
function clearSettlementRetry() {
  failedSettlement = null;
  els.retrySettlement.hidden = true;
}
async function retrySettlement() {
  const last = failedSettlement;
  if (!last || last.active !== session) return;
  clearSettlementRetry();
  await roomCommand(last.op, { ...last.args, retry: last.retry });
}
async function roomCommand(op, args) {
  const active = session;
  if (!active) return;
  const viewTag = op === 'snapshot' && !args?.retry ? room?.viewTag ?? '' : undefined;
  let data;
  try {
    if (newerSeat(active)) { exitRoomLocal('座位已变化，刷新可恢复新座位'); return; }
    data = await gameRequest(op, active.code, { ...args, playerId: active.playerId, viewTag });
  } catch (error) {
    const retry = error.retry;
    if (retry && active === session && retry.matchId === g?.matchId && retry.revision >= room?.revision &&
        (op !== 'snapshot' || !failedSettlement || failedSettlement.retry.revision < retry.revision)) {
      failedSettlement = { active, retry, op, args };
      const label = { leave: '离房', kick: '请离', act: '行动', snapshot: '同步' }[op];
      els.retrySettlement.textContent = `重试${label || '操作'}并保存结算`;
      els.retrySettlement.hidden = false;
    }
    throw error;
  }
  if (active !== session) return;
  const unchanged = data.unchanged === true;
  if (unchanged) {
    checkUnchangedView(data, active.code, viewTag);
    if (newerSeat(active)) { exitRoomLocal('座位已变化，刷新可恢复新座位'); return; }
    if (room?.viewTag !== viewTag || room.revision !== data.revision) return;
    data = room;
  }
  if (failedSettlement && data.revision >= failedSettlement.retry.revision &&
      (data.revision > failedSettlement.retry.revision || data.options?.g?.matchId !== failedSettlement.retry.matchId ||
        (op === 'snapshot' && failedSettlement.op === 'snapshot'))) {
    clearSettlementRetry();
  }
  if (data.gone) exitRoomLocal(op === 'leave' ? '已退出房间' : '你已不在该房间');
  else if (unchanged) noteRoomSynced();
  else applySnapshot(data, op === 'snapshot' || (op === 'act' && ['chat', 'wolfchat'].includes(args?.step)));
}
async function pollOnce() {
  if (!session || document.hidden || polling || acting) return;
  // Give a just-clicked action priority over the next background request.
  if (Date.now() - (currentAction()?.startedAt ?? 0) < 1600) return;
  const active = polling = session;
  try {
    if (++pollTick % 8 === 0) refreshProfileQuiet().catch(() => {});
    await roomCommand('snapshot');
  } catch (error) {
    if (session === active) setConn(`同步失败，正在重试：${friendlyError(error)}`);
  } finally {
    if (polling === active) polling = null;
  }
}
document.addEventListener('visibilitychange', pollOnce);

async function startGame() {
  if (busy) return;
  busy = true;
  try {
    await roomCommand('start');
  } catch (e) {
    toast(friendlyError(e));
  } finally {
    busy = false;
  }
}
function replayGame() {
  return roomCommand('reset', { matchId: g?.matchId });
}
function departureContext() {
  if (!room || !session) throw new Error('房间尚未同步，请稍后重试');
  return { playerId: session.playerId, matchId: g?.matchId ?? null, ...(!g ? { lobbyRevision: room.revision } : {}) };
}
async function leaveRoom() {
  return roomCommand('leave', departureContext());
}
function addBot() {
  return roomCommand('bot');
}
async function kickMember(member) {
  kickAsked = null;
  return roomCommand('kick', { id: member.id, ...departureContext() });
}
let pendingAction = null;
let acting = 0; // in-flight action requests; polls yield to them to avoid lock contention
function actionScene() {
  return g && [g.matchId, g.day, g.phase, g.step, g.speechIndex, g.policeIndex, g.lastWordsSeat].join(':');
}

function currentAction() {
  return pendingAction?.active === session && pendingAction?.scene === actionScene() ? pendingAction : null;
}

async function act(step, target, payload = {}) {
  if (!g) return false;
  const active = session;
  const args = { matchId: g.matchId, day: g.day, step, target: target ?? null, payload };
  let pending;
  if (active && step !== 'chat' && step !== 'wolfchat') {
    if (currentAction()) return false;
    pending = pendingAction = { active, step, scene: actionScene(), startedAt: Date.now() };
    renderRoom();
  }
  acting++;
  try {
    await roomCommand('act', args);
    return active === session;
  } catch (e) {
    if (active === session) toast(friendlyError(e));
    return false;
  } finally {
    acting--;
    if (pending && pending === pendingAction) {
      const repaint = currentAction() === pending;
      pendingAction = null;
      if (repaint) renderRoom();
    }
  }
}
async function spectateLoad() {
  const active = spectate;
  if (!active) return;
  const viewTag = active.room?.viewTag ?? '';
  const data = await gameRequest('spectate', active.code, { viewTag });
  if (spectate !== active) return;
  if (data.unchanged === true) {
    checkUnchangedView(data, active.code, viewTag);
    return;
  }
  if (!data.options?.g) {
    exitSpectate();
    toast(data.gone ? '旁观的房间不存在' : '这局尚未开始或已重置');
    return;
  }
  if (data.revision < (active.room?.revision ?? -1) || sameSnapshot(active.room, data)) return;
  Object.assign(active, { room: data, g: data.options.g, members: data.members, chatRows: data.chat });
  renderSpectate();
}
