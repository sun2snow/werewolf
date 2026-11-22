const NAME_KEY = 'wolf.name';
const SESSION_KEY = 'wolf.session';
const {
  ROLES, MODES, CAMPS, modeById, CUSTOM_ORDER, CUSTOM_LIMITS, buildCustomMode, modeFromOptions,
} = window.WOLF_MODES;
const Rules = window.WolfRules;
const Blood = window.WOLF_BLOODMOON;

const DUR = {
  thief: 60000,
  cupid: 60000,
  guard: 60000,
  wolves: 60000,
  wolfbeauty: 60000,
  witch: 60000,
  seer: 60000,
  dawn: 6000,
  speech: 60000,
  vote: 60000,
  runoff: 60000,
  hunter: 60000,
  policeSignup: 60000,
  policeSpeech: 60000,
  policeVote: 60000,
  policeRunoff: 60000,
  order: 60000,
  badge: 60000,
  lastwords: 60000,
};

function modeTimer(kind) {
  const mode = currentMode();
  return kind === 'night' ? (mode.nightMs || 60000) : (mode.speechMs || 60000);
}
function modeSeconds(kind) {
  return Math.round(modeTimer(kind) / 1000);
}

const STEP_LABEL = {
  thief: '盗贼换牌',
  cupid: '丘比特连情侣',
  guard: '守卫守护',
  wolves: '狼人行动',
  wolfbeauty: '狼美人魅惑',
  witch: '女巫用药',
  seer: '预言家查验',
  dawn: '天亮了',
  day: '白天讨论',
  vote: '投票',
  runoff: 'PK 投票',
  hunter: '猎人开枪',
  policeSignup: '上警',
  policeSpeech: '候选人发言',
  policeVote: '警下投票',
  policeRunoff: '警长 PK',
  order: '警长定顺序',
  badge: '警徽移交',
  lastwords: '遗言',
  shop: '商店',
  rescue: '濒死求桃',
};

const DEATH_SHORT = {
  wolf: '被狼刀',
  poison: '被毒杀',
  vote: '放逐',
  hunter: '被猎人带走',
  wolfboss: '被狼王带走',
  duel: '决斗出局',
  lover: '殉情',
  charm: '被狼美人带走',
  explode: '自爆带走',
  selfboom: '自爆出局',
  kick: '被请离',
  leave: '离开房间',
};

const els = {
  homeView: document.querySelector('#homeView'),
  roomView: document.querySelector('#roomView'),
  authCard: document.querySelector('#authCard'),
  authModal: document.querySelector('#authModal'),
  authClose: document.querySelector('#authClose'),
  accountBtn: document.querySelector('#accountBtn'),
  accountMenu: document.querySelector('#accountMenu'),
  accountTopName: document.querySelector('#accountTopName'),
  accountTopRole: document.querySelector('#accountTopRole'),
  accountTopNote: document.querySelector('#accountTopNote'),
  accountRefreshBtn: document.querySelector('#accountRefreshBtn'),
  accountAdminBtn: document.querySelector('#accountAdminBtn'),
  pendingBadge: document.querySelector('#pendingBadge'),
  adminPendingBadge: document.querySelector('#adminPendingBadge'),
  accountLogoutBtn: document.querySelector('#accountLogoutBtn'),
  authForms: document.querySelector('#authForms'),
  loginForm: document.querySelector('#loginForm'),
  loginName: document.querySelector('#loginName'),
  loginPass: document.querySelector('#loginPass'),
  registerForm: document.querySelector('#registerForm'),
  regName: document.querySelector('#regName'),
  regPass: document.querySelector('#regPass'),
  regPass2: document.querySelector('#regPass2'),
  accountBar: document.querySelector('#accountBar'),
  accountName: document.querySelector('#accountName'),
  accountRole: document.querySelector('#accountRole'),
  accountNote: document.querySelector('#accountNote'),
  authStatus: document.querySelector('#authStatus'),
  logoutBtn: document.querySelector('#logoutBtn'),
  refreshStatusBtn: document.querySelector('#refreshStatus'),
  activeRoomCard: document.querySelector('#activeRoomCard'),
  activeRoomCode: document.querySelector('#activeRoomCode'),
  activeRoomNote: document.querySelector('#activeRoomNote'),
  backToRoomBtn: document.querySelector('#backToRoomBtn'),
  pendingCard: document.querySelector('#pendingCard'),
  pendingTitle: document.querySelector('#pendingTitle'),
  pendingText: document.querySelector('#pendingText'),
  pendingRefresh: document.querySelector('#pendingRefresh'),
  adminCard: document.querySelector('#adminCard'),
  adminBody: document.querySelector('#adminBody'),
  adminRefresh: document.querySelector('#adminRefresh'),
  startCard: document.querySelector('#start'),
  leaderboardCard: document.querySelector('#leaderboard'),
  historyCard: document.querySelector('#historyCard'),
  historyBody: document.querySelector('#historyBody'),
  historyNote: document.querySelector('#historyNote'),
  historyRefresh: document.querySelector('#historyRefresh'),
  heroStart: document.querySelector('#heroStart'),
  nameInput: document.querySelector('#playerName'),
  modeSelect: document.querySelector('#modeSelect'),
  modeHint: document.querySelector('#modeHint'),
  createBtn: document.querySelector('#createRoom'),
  customRoomBtn: document.querySelector('#customRoomBtn'),
  customModal: document.querySelector('#customModal'),
  customClose: document.querySelector('#customClose'),
  customName: document.querySelector('#customName'),
  customRoleList: document.querySelector('#customRoleList'),
  customTotal: document.querySelector('#customTotal'),
  customSkillsToggle: document.querySelector('#customSkillsToggle'),
  customSkillList: document.querySelector('#customSkillList'),
  customReset: document.querySelector('#customReset'),
  customSheriff: document.querySelector('#customSheriff'),
  customNight: document.querySelector('#customNight'),
  customSpeech: document.querySelector('#customSpeech'),
  customCreate: document.querySelector('#customCreate'),
  customStatus: document.querySelector('#customStatus'),
  joinForm: document.querySelector('#joinForm'),
  joinBtn: document.querySelector('#joinForm button'),
  codeInput: document.querySelector('#roomCode'),
  status: document.querySelector('#status'),
  leaderboardBody: document.querySelector('#leaderboardBody'),
  leaderboardNote: document.querySelector('#leaderboardNote'),
  connStatus: document.querySelector('#connStatus'),
  roomCodeLabel: document.querySelector('#roomCodeLabel'),
  copyBtn: document.querySelector('#copyCode'),
  copyInviteBtn: document.querySelector('#copyInvite'),
  inviteHint: document.querySelector('#inviteHint'),
  statusBar: document.querySelector('#statusBar'),
  phaseLabel: document.querySelector('#phaseLabel'),
  gameClock: document.querySelector('#gameClock'),
  seatCount: document.querySelector('#seatCount'),
  statusPrompt: document.querySelector('#statusPrompt'),
  modeLabel: document.querySelector('#modeLabel'),
  myBar: document.querySelector('#myBar'),
  mySeat: document.querySelector('#mySeat'),
  revealBtn: document.querySelector('#revealBtn'),
  roleCard: document.querySelector('#roleCard'),
  roleTag: document.querySelector('#roleTag'),
  roleName: document.querySelector('#roleName'),
  roleCamp: document.querySelector('#roleCamp'),
  roleSkill: document.querySelector('#roleSkill'),
  roleExplode: document.querySelector('#roleExplode'),
  roleExtra: document.querySelector('#roleExtra'),
  playerList: document.querySelector('#playerList'),
  actionArea: document.querySelector('#actionArea'),
  feed: document.querySelector('#feed'),
  chatCard: document.querySelector('#chatCard'),
  chatTitle: document.querySelector('#chatTitle'),
  chatFeed: document.querySelector('#chatFeed'),
  chatForm: document.querySelector('#chatForm'),
  chatInput: document.querySelector('#chatInput'),
  chatNote: document.querySelector('#chatNote'),
  endSpeechBtn: document.querySelector('#endSpeech'),
  retrySpeechBtn: document.querySelector('#retrySpeech'),
  modeInfo: document.querySelector('#modeInfo'),
  gameOverCard: document.querySelector('#gameOverCard'),
  winnerText: document.querySelector('#winnerText'),
  resultNote: document.querySelector('#resultNote'),
  revealBody: document.querySelector('#revealBody'),
  replayBtn: document.querySelector('#replayBtn'),
  watchReplayBtn: document.querySelector('#watchReplayBtn'),
  retrySettlement: document.querySelector('#retrySettlement'),
  leaveBtn: document.querySelector('#leaveRoom'),
  spectateBtn: document.querySelector('#spectateBtn'),
  spectateView: document.querySelector('#spectateView'),
  spectateCode: document.querySelector('#spectateCode'),
  spectateExit: document.querySelector('#spectateExit'),
  spectateReplayBtn: document.querySelector('#spectateReplayBtn'),
  spectateStatusBar: document.querySelector('#spectateStatusBar'),
  spectatePhase: document.querySelector('#spectatePhase'),
  spectateClock: document.querySelector('#spectateClock'),
  spectateCount: document.querySelector('#spectateCount'),
  spectatePrompt: document.querySelector('#spectatePrompt'),
  spectateNote: document.querySelector('#spectateNote'),
  spectateMode: document.querySelector('#spectateMode'),
  spectateSeats: document.querySelector('#spectateSeats'),
  spectateChat: document.querySelector('#spectateChat'),
  spectateFeed: document.querySelector('#spectateFeed'),
  replayView: document.querySelector('#replayView'),
  replayCode: document.querySelector('#replayCode'),
  replayBack: document.querySelector('#replayBack'),
  replayWinner: document.querySelector('#replayWinner'),
  replayMeta: document.querySelector('#replayMeta'),
  replayPlayers: document.querySelector('#replayPlayers'),
  replayTimeline: document.querySelector('#replayTimeline'),
  replayLog: document.querySelector('#replayLog'),
  replayFilters: document.querySelector('#replayFilters'),
  toast: document.querySelector('#toast'),
};

const cfg = window.WOLF_CONFIG || {};
const configured = Boolean(
  window.supabase?.createClient &&
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_KEY &&
  !cfg.SUPABASE_URL.includes('YOUR-PROJECT')
);
const client = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY) : null;

let session = null;
let pendingInviteCode = null;
let pollTimer = null;
let pollTick = 0;
let busy = false;
let room = null;
let members = [];
let myRow = null;
let roleShown = false;
let localFeed = [];
let g = null;
let wolfPicks = [];
let chatRows = [];
let wolfChatRows = [];
let ratings = new Map();
let ratingsKey = '';
let leaderboardData = [];
let submitted = new Set();
let roomSig = '';
let chatSig = '';
let lastChangeAt = 0;
let pick = null;
let bloodBuy = [];
let bloodBuyDay = 0;
let kickAsked = null;
let appointId = null;
let preSpeech = { day: 0, msgs: [] };
let preFlushing = false;
let phaseKey = '';
let feedSeeded = false;
let profile = null;
let authBusy = false;
let authChecking = Boolean(client);
let authEpoch = 0; // invalidate responses that started under a previous login
let authUserId = null; // SDK principal, even while the profile is still loading
let profileRead = null;
let pendingTimer = null;
let pendingWatchTimer = null;
let pendingCount = 0;
let lastPendingCount = -1;
let approvedRouted = false;
let spectate = null;
let spectateTimer = null;
let replayData = null;
let replayFilter = 'all';
let historyRows = [];
let historyAccount = null;
let historyRequest = null;

let toastTimer;
function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.remove('show');
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 250);
  }, 3000);
}

function pad(seat) {
  return String(seat).padStart(2, '0');
}

function setStatus(text) {
  els.status.textContent = text;
}

function setAuthNote(text) {
  els.authStatus.textContent = text || '';
  els.authStatus.hidden = !text;
}

function setConn(text, live = false) {
  els.connStatus.textContent = text;
  els.connStatus.classList.toggle('sr-conn-live', live);
}

function setBusy(value) {
  busy = value;
  els.createBtn.disabled = value || !accountApproved();
  els.joinBtn.disabled = value || !accountApproved();
  if (els.customRoomBtn) els.customRoomBtn.disabled = value || !accountApproved();
  if (els.customCreate) els.customCreate.disabled = value;
}

function closeAccountMenu() {
  if (els.accountMenu) els.accountMenu.hidden = true;
}

function openAuthModal() {
  if (authChecking) return;
  closeAccountMenu();
  if (els.authModal) els.authModal.hidden = false;
}

function closeAuthModal() {
  if (els.authModal) els.authModal.hidden = true;
}

function siteBase() {
  const room = location.pathname.match(/^(.*\/)games\/\d{6}\/?$/);
  return room ? room[1] : location.pathname.replace(/[^/]*$/, '');
}

function roomUrl(code) {
  return `${siteBase()}games/${code}`;
}

function syncUrl(url) {
  try {
    history.replaceState(history.state, '', url);
  } catch { /* file:// or sandboxed frames keep the old address. */ }
}

function showRoom() {
  endSpectate();
  els.homeView.hidden = true;
  els.roomView.hidden = false;
  els.spectateView.hidden = true;
  els.replayView.hidden = true;
  closeAccountMenu();
  if (session) syncUrl(roomUrl(session.code));
}

function showHome() {
  els.roomView.hidden = true;
  els.homeView.hidden = false;
  els.spectateView.hidden = true;
  els.replayView.hidden = true;
  endSpectate();
  closeAccountMenu();
  if (session || (pendingInviteCode === null && /\/games\/\d{6}\/?$/.test(location.pathname))) {
    syncUrl(siteBase());
  }
  updateHomeRoomCard();
  if (client && accountApproved()) {
    loadLeaderboard();
    loadHistory();
  }
}

function updateHomeRoomCard() {
  const inRoom = Boolean(session);
  const approved = accountApproved();
  els.startCard.hidden = !approved || inRoom;
  els.activeRoomCard.hidden = !(approved && inRoom);
  els.heroStart.textContent = inRoom ? '返回当前对局' : '开始游戏';
  const navStart = document.querySelector('.navbar a[href="#start"]');
  if (navStart) navStart.textContent = inRoom ? '当前对局' : '开始游戏';
  if (!inRoom) return;
  els.activeRoomCode.textContent = session.code;
  els.activeRoomNote.textContent = isHost()
    ? '你是房主。对局由服务端判定，点「返回对局」可继续。'
    : '对局还在进行，审核完点「返回对局」即可继续。';
}

function backToRoom() {
  if (!session) return;
  showRoom();
  renderRoom();
  window.scrollTo(0, 0);
}

function readName() {
  if (profile && profile.status === 'approved') return profile.username;
  const name = els.nameInput.value.trim();
  if (!name) {
    toast('先填一个昵称');
    els.nameInput.focus();
    return null;
  }
  localStorage.setItem(NAME_KEY, name);
  return name;
}

const NAME_RE = /^[\u4e00-\u9fa5A-Za-z0-9_]{2,12}$/;
let adminPage = 0;
let adminRequest = 0;

async function sha256Hex(text) {
  if (!window.crypto?.subtle) throw new Error('浏览器不支持加密接口，请用 Chrome / Edge 打开');
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function emailFor(name) {
  const hash = await sha256Hex(`wolf:${name.trim().toLowerCase()}`);
  return `u_${hash.slice(0, 24)}@werewolf.local`;
}

function accountApproved() {
  return Boolean(profile && profile.status === 'approved');
}

function isAdminAccount() {
  return accountApproved() && (profile.role === 'owner' || profile.role === 'admin');
}

function isOwnerAccount() {
  return accountApproved() && profile.role === 'owner';
}

function roleLabel(role) {
  if (role === 'owner') return '站长';
  if (role === 'admin') return '管理员';
  return '成员';
}

function roleBadgeClass(role) {
  if (role === 'owner') return 'badge-danger';
  if (role === 'admin') return 'badge-info';
  return 'badge-secondary';
}

function statusLabel(status) {
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已拒绝';
  if (status === 'banned') return '已封禁';
  return '待审核';
}

function statusBadgeClass(status) {
  if (status === 'approved') return 'badge-success';
  if (status === 'rejected') return 'badge-secondary';
  if (status === 'banned') return 'badge-danger';
  return 'badge-warning';
}

function friendlyAuthError(error) {
  const message = String(error?.message || error || '未知错误');
  if (/Invalid login credentials/i.test(message)) return '用户名或密码错误';
  if (/User already registered|already been registered/i.test(message)) return '这个用户名已经被注册了';
  if (/Password should be at least|password.*6/i.test(message)) return '密码至少 6 位';
  if (/Email not confirmed/i.test(message)) {
    return '注册需要邮箱确认：请站长先在 Supabase 关闭 Confirm email，再删掉这个账号重新注册';
  }
  if (/Email address .* is invalid/i.test(message)) {
    return 'Supabase 的「邮箱确认」还开着：请站长到 Authentication → Sign In / Providers → Email，把 Confirm email 关掉并保存，然后重新注册';
  }
  if (/rate limit|too many/i.test(message)) return '操作太频繁，等一分钟再试';
  return friendlyError(error);
}

function applyAccountUI() {
  const has = Boolean(profile);
  const approved = accountApproved();
  els.authForms.hidden = has;
  els.accountBar.hidden = !has;
  els.pendingCard.hidden = true;
  els.leaderboardCard.hidden = !approved;
  els.historyCard.hidden = !approved;
  els.adminCard.hidden = !(approved && isAdminAccount());
  if (approved && isAdminAccount()) startPendingWatch();
  else stopPendingWatch();
  els.createBtn.disabled = busy || !approved;
  els.joinBtn.disabled = busy || !approved;

  const owner = approved ? profile.id : null;
  if (owner !== historyAccount) {
    historyAccount = owner;
    historyRequest = null;
    historyRows = [];
    renderHistory();
  }
  if (!approved && spectate) showHome();

  els.accountBtn.disabled = authChecking;
  els.accountBtn.setAttribute('aria-busy', String(authChecking));
  els.accountBtn.textContent = authChecking ? '正在恢复登录状态…' : has ? `${profile.username} ▾` : '登录 / 注册';
  els.accountTopName.textContent = has ? profile.username : '游客';
  els.accountTopRole.textContent = has ? roleLabel(profile.role) : '未登录';
  els.accountTopRole.className = `badge ${has ? roleBadgeClass(profile.role) : 'badge-secondary'}`;
  els.accountRefreshBtn.hidden = !has || approved;
  els.accountAdminBtn.hidden = !(has && approved && isAdminAccount());
  els.accountLogoutBtn.hidden = !has;

  if (!has) {
    els.accountTopNote.textContent = '登录后创建或加入房间';
    closeAccountMenu();
    els.nameInput.value = '';
    els.accountNote.textContent = '';
    updateHomeRoomCard();
    return;
  }
  els.accountName.textContent = profile.username;
  els.accountRole.textContent = roleLabel(profile.role);
  els.accountRole.className = `badge ${roleBadgeClass(profile.role)}`;
  els.refreshStatusBtn.hidden = approved;
  els.accountNote.textContent = approved
    ? ''
    : profile.status === 'banned' ? '账号已被封禁'
      : profile.status === 'rejected' ? '账号未通过审核' : '账号待审核';
  els.accountTopNote.textContent = approved
    ? `状态：已通过${isOwnerAccount() ? ' · 站长' : ''}`
    : els.accountNote.textContent;
  if (approved) {
    els.nameInput.value = profile.username;
    updateHomeRoomCard();
    return;
  }
  updateHomeRoomCard();
  els.pendingCard.hidden = false;
  els.pendingTitle.textContent = profile.status === 'banned' ? '账号已被封禁'
    : profile.status === 'rejected' ? '审核未通过' : '等待审核';
  els.pendingText.textContent = profile.status === 'banned'
    ? '你的账号已被封禁，暂时无法进入游戏。'
    : profile.status === 'rejected'
      ? '你的账号没有通过审核。'
      : '账号已注册成功，正在等待审核。通过后这里会自动解锁，也可以直接点「刷新状态」。';
  els.pendingRefresh.hidden = profile.status !== 'pending';
}

function clearAuthViews() {
  ++authEpoch;
  profile = null;
  approvedRouted = false;
  stopPendingPoll();
  stopPendingWatch();
  clearRoomViews();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('wolf.prespeech:')) localStorage.removeItem(key);
  }
  replayData = null;
  for (const el of [els.spectateCode, els.spectatePrompt, els.spectateSeats, els.spectateChat, els.spectateFeed,
    els.replayCode, els.replayWinner, els.replayMeta, els.replayPlayers, els.replayTimeline, els.replayLog, els.adminBody]) el.replaceChildren();
  clearTimeout(toastTimer);
  els.toast.hidden = true; els.toast.textContent = '';
  showHome(); // also invalidates the active spectator request
}

function clearRoomViews() {
  stopPolling();
  polling = null;
  clearSettlementRetry();
  clearPreSpeech(); // while the old member's draft key is still available
  session = room = myRow = g = pick = kickAsked = appointId = null;
  members = []; localFeed = []; chatRows = []; wolfChatRows = []; wolfPicks = [];
  submitted.clear(); ratings.clear(); ratingsKey = ''; phaseKey = '';
  feedSeeded = roleShown = preFlushing = false;
  resetRoomView();
  els.chatInput.value = '';
  els.roleCard.className = 'card'; els.myBar.className = ''; els.roleTag.className = 'badge';
  els.roleExtra.hidden = els.roleExplode.hidden = true;
  els.roleExplode.classList.remove('sr-explode-no');
  els.revealBtn.textContent = '查看我的身份牌';
  for (const el of [els.roleTag, els.roleName, els.roleCamp, els.roleSkill, els.roleExplode, els.roleExtra,
    els.mySeat, els.chatTitle, els.chatNote, els.winnerText, els.resultNote, els.revealBody,
    els.roomCodeLabel, els.activeRoomCode]) el.replaceChildren();
}

function showAuthScreen(note = '') {
  authChecking = false;
  authUserId = null;
  clearAuthViews();
  applyAccountUI();
  setStatus(note || '请登录或注册');
  setAuthNote(note);
  openAuthModal();
}

function showAuthProblem(title, text) {
  authChecking = false;
  clearAuthViews();
  applyAccountUI();
  els.authForms.hidden = true;
  els.accountBar.hidden = false;
  els.accountName.textContent = '—';
  els.accountRole.textContent = '未就绪';
  els.accountRole.className = 'badge badge-secondary';
  els.accountNote.textContent = '';
  els.refreshStatusBtn.hidden = false;
  els.startCard.hidden = true;
  els.leaderboardCard.hidden = true;
  els.adminCard.hidden = true;
  els.pendingTitle.textContent = title;
  els.pendingText.textContent = text;
  els.pendingRefresh.hidden = false;
  els.pendingCard.hidden = false;
}

async function afterApproved() {
  if (approvedRouted) return;
  approvedRouted = true;
  const epoch = authEpoch;
  els.loginPass.value = '';
  els.regPass.value = '';
  els.regPass2.value = '';
  setAuthNote('');
  setStatus(`已登录：${profile.username}（${roleLabel(profile.role)}）`);
  closeAuthModal();
  // Resume the game before spending requests on lobby-only data.
  try {
    await restoreSession();
  } catch (error) {
    if (epoch !== authEpoch) return;
    setStatus('房间暂时无法恢复，重连信息已保留。刷新可重试。');
    toast(friendlyError(error));
  }
  if (epoch === authEpoch && !session) {
    loadLeaderboard();
    loadHistory();
  }
}

function fetchProfileAndRoute() {
  const epoch = authEpoch;
  if (profileRead?.epoch === epoch) return profileRead.promise;
  const promise = readProfileAndRoute(epoch).finally(() => {
    if (profileRead?.promise === promise) profileRead = null;
  });
  profileRead = { epoch, promise };
  return promise;
}

async function readProfileAndRoute(epoch, allowRepair = true, allowTokenRetry = true) {
  const { data: saved, error: sessionError } = await client.auth.getSession();
  if (epoch !== authEpoch) return false;
  if (sessionError) throw sessionError;
  const id = saved?.session?.user?.id, token = saved?.session?.access_token;
  if (!id || !token) {
    showAuthScreen();
    return false;
  }
  if (authUserId !== id) return false;
  // Local session data selects the request, not the account's privileges.
  // PostgREST validates the token and applies RLS in the same network request.
  const { data, error, status } = await client
    .from('profiles')
    .select('id, username, role, status')
    .eq('id', id)
    .setHeader('Authorization', `Bearer ${token}`)
    .maybeSingle();
  if (epoch !== authEpoch) return false;
  const { data: current, error: currentError } = await client.auth.getSession();
  if (epoch !== authEpoch) return false;
  if (currentError) throw currentError;
  const latest = current?.session;
  if (!latest?.access_token) {
    showAuthScreen('登录状态已失效，请重新登录');
    return false;
  }
  if (latest.user?.id !== id) return false;
  if (status === 401) {
    if (allowTokenRetry && latest.access_token !== token) return readProfileAndRoute(epoch, allowRepair, false);
    if (latest.access_token === token) {
      showAuthScreen('无法验证登录状态，请重新登录');
      return false;
    }
  }
  if (error) {
    showAuthProblem(
      '账号系统未就绪',
      `读取账号资料失败：${friendlyError(error)}`
    );
    return false;
  }
  if (!data) {
    const n = localStorage.getItem(NAME_KEY);
    if (allowRepair && n && NAME_RE.test(n)) {
      const repair = await client.rpc('repair_wolf_profile', { n })
        .setHeader('Authorization', `Bearer ${latest.access_token}`);
      if (epoch !== authEpoch) return false;
      if (!repair.error) return readProfileAndRoute(epoch, false, allowTokenRetry);
    }
    showAuthProblem(
      '账号资料缺失',
      '未找到账号资料。请用原用户名重新登录以恢复资料，或联系站长检查 v8 迁移。'
    );
    return false;
  }
  if (data.id !== id) throw new Error('账号资料与当前会话不一致');
  const wasApproved = accountApproved();
  authChecking = false;
  profile = data;
  applyAccountUI();
  if (data.status === 'approved') {
    stopPendingPoll();
    if (!wasApproved) await afterApproved();
    if (epoch === authEpoch && isAdminAccount()) loadAdmin();
  } else if (data.status === 'pending') {
    startPendingPoll();
  } else {
    stopPendingPoll();
  }
  return true;
}

function stopPendingPoll() {
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
}

function startPendingPoll() {
  stopPendingPoll();
  pendingTimer = setInterval(() => {
    refreshProfileQuiet().catch(() => {});
  }, 15000);
}

function renderPendingBadge(n) {
  const show = n > 0 && isAdminAccount();
  els.pendingBadge.hidden = !show;
  els.pendingBadge.textContent = n > 99 ? '99+' : String(n);
  els.pendingBadge.title = `有 ${n} 名玩家待审核，点击处理`;
  els.adminPendingBadge.hidden = !show;
  els.adminPendingBadge.textContent = `${n} 待审核`;
  els.accountAdminBtn.textContent = show ? `账号管理（${n} 待审核）` : '账号管理';
}

async function checkPending() {
  if (!client || !isAdminAccount()) return;
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error || !isAdminAccount()) return;
  const n = count || 0;
  const increased = lastPendingCount >= 0 && n > lastPendingCount;
  pendingCount = n;
  lastPendingCount = n;
  renderPendingBadge(n);
  if (increased) toast(`有 ${n} 名玩家待审核，点右上角红标处理`);
}

function startPendingWatch() {
  if (pendingWatchTimer || !isAdminAccount()) return;
  checkPending().catch(() => {});
  pendingWatchTimer = setInterval(() => checkPending().catch(() => {}), 30000);
}

function stopPendingWatch() {
  if (pendingWatchTimer) {
    clearInterval(pendingWatchTimer);
    pendingWatchTimer = null;
  }
  pendingCount = 0;
  lastPendingCount = -1;
  renderPendingBadge(0);
}

async function refreshProfileQuiet() {
  if (!profile || !client) return;
  const epoch = authEpoch;
  const { data, error } = await client
    .from('profiles')
    .select('id, username, role, status')
    .eq('id', profile.id)
    .maybeSingle();
  if (epoch !== authEpoch || !profile || error || !data) return;
  if (data.status === profile.status && data.role === profile.role) return;
  const wasApproved = accountApproved();
  profile = data;
  applyAccountUI();
  if (data.status === 'approved') {
    stopPendingPoll();
    toast('审核已通过，可以开始游戏了');
    if (!wasApproved) await afterApproved();
    if (epoch === authEpoch && isAdminAccount()) loadAdmin();
  } else {
    stopPendingPoll();
    if (data.status === 'banned') {
      toast('你的账号已被封禁');
      if (session) exitRoomLocal('你的账号已被封禁');
    } else if (data.status === 'rejected') {
      toast('账号未通过审核');
    }
  }
}

function adminMessageRow(text, cls) {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  td.colSpan = 5;
  td.className = `text-center py-3 ${cls}`;
  td.textContent = text;
  tr.append(td);
  return tr;
}

async function loadAdmin() {
  if (!isAdminAccount()) return;
  els.adminBody.replaceChildren(adminMessageRow('加载中…', 'text-muted'));
  const request = ++adminRequest;
  const size = 50;
  let query = client.from('profiles').select('id, username, role, status, created_at');
  if (document.querySelector('#adminFilter').value === 'pending') query = query.eq('status','pending');
  const {data,error} = await query.order('created_at').order('id').range(adminPage*size,(adminPage+1)*size);
  if (request !== adminRequest || !isAdminAccount()) return;
  document.querySelector('#adminPrev').disabled = adminPage === 0;
  document.querySelector('#adminNext').disabled = !data || data.length <= size;
  document.querySelector('#adminPage').textContent = `第 ${adminPage+1} 页`;
  if (error) {
    els.adminBody.replaceChildren(adminMessageRow(`读取失败：${friendlyError(error)}`, 'text-danger'));
    return;
  }
  const rows = (data || []).slice(0,size);
  if (!rows.length) {
    els.adminBody.replaceChildren(adminMessageRow('还没有注册用户', 'text-muted'));
    return;
  }
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.textContent = row.username;
    if (profile && row.username === profile.username) {
      const me = document.createElement('span');
      me.className = 'badge badge-primary ml-2';
      me.textContent = '我';
      nameTd.append(me);
    }

    const statusTd = document.createElement('td');
    const statusTag = document.createElement('span');
    statusTag.className = `badge ${statusBadgeClass(row.status)}`;
    statusTag.textContent = statusLabel(row.status);
    statusTd.append(statusTag);

    const roleTd = document.createElement('td');
    const roleTag = document.createElement('span');
    roleTag.className = `badge ${roleBadgeClass(row.role)}`;
    roleTag.textContent = roleLabel(row.role);
    roleTd.append(roleTag);

    const timeTd = document.createElement('td');
    timeTd.className = 'small text-muted';
    timeTd.textContent = row.created_at
      ? new Date(row.created_at).toLocaleString('zh-CN', { hour12: false })
      : '—';

    const actTd = document.createElement('td');
    actTd.className = 'text-right';
    if (row.role === 'owner') {
      actTd.textContent = '—';
    } else if (row.status === 'banned') {
      if (isOwnerAccount()) {
        actTd.append(makeBtn('解封', 'btn-success mr-1 mb-1', () => adminUpdate(row.id, { status: 'approved' }, `已解封 ${row.username}`)));
      } else {
        const tip = document.createElement('span');
        tip.className = 'small text-muted';
        tip.textContent = '已封禁';
        actTd.append(tip);
      }
    } else {
      if (row.status !== 'approved') {
        actTd.append(makeBtn('通过', 'btn-success mr-1 mb-1', () => adminUpdate(row.id, { status: 'approved' }, `已通过 ${row.username}`)));
      }
      if (row.status !== 'rejected') {
        actTd.append(makeBtn('拒绝', 'btn-outline-danger mr-1 mb-1', () => adminUpdate(row.id, { status: 'rejected' }, `已拒绝 ${row.username}`)));
      }
      const mayBan = row.status === 'approved'
        && (isOwnerAccount() ? row.role !== 'owner' : row.role === 'member');
      if (mayBan) {
        actTd.append(makeBtn('封禁', 'btn-danger mr-1 mb-1', () => adminUpdate(row.id, { status: 'banned' }, `已封禁 ${row.username}`)));
      }
      if (row.status === 'approved' && isOwnerAccount()) {
        if (row.role === 'admin') {
          actTd.append(makeBtn('取消管理员', 'btn-outline-secondary mr-1 mb-1', () => adminUpdate(row.id, { role: 'member' }, `已取消 ${row.username} 的管理员`)));
        } else {
          actTd.append(makeBtn('设为管理员', 'btn-outline-primary mr-1 mb-1', () => adminUpdate(row.id, { role: 'admin' }, `${row.username} 已成为管理员`)));
        }
      }
    }

    tr.append(nameTd, statusTd, roleTd, timeTd, actTd);
    frag.append(tr);
  });
  els.adminBody.replaceChildren(frag);
}

async function adminUpdate(id, patch, message) {
  if (!isAdminAccount()) return;
  const { error } = await client.from('profiles').update(patch).eq('id', id);
  if (error) {
    toast(friendlyError(error));
    return;
  }
  toast(message);
  await loadAdmin();
  checkPending().catch(() => {});
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function currentMode() {
  if (room?.options) return modeFromOptions(room.options);
  return modeById(g?.mode || 'std12');
}

function isHost() {
  return Boolean(session && room?.hostId === session.playerId);
}

function aliveSet() {
  return new Set(g?.aliveSeats || []);
}

function isAliveSeat(seat) {
  if (seat == null) return false;
  return aliveSet().has(seat);
}

function currentSpeaker() {
  if (!g || g.phase !== 'day' || !g.speechOrder) return null;
  return g.speechOrder[g.speechIndex] ?? null;
}

function isMyWolf() {
  return Boolean(myRow?.role && Rules.isWolfRole(myRow.role));
}

function note(text) {
  const span = document.createElement('span');
  span.className = 'sr-act-hint';
  span.textContent = text;
  return span;
}

function makeBtn(label, cls, onClick, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-sm ${cls}`;
  btn.textContent = label;
  btn.disabled = disabled;
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}

function canKickMember(member) {
  if (!isOwnerAccount() || !session) return false;
  if (!member || member.id === session.playerId) return false;
  if (g && g.phase === 'finished') return false;
  if (g && g.phase !== 'finished' && member.id === room?.hostId) return false;
  return true;
}

function fillModeSelect() {
  const frag = document.createDocumentFragment();
  MODES.forEach((mode) => {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = `${mode.name}（${mode.roles.length} 人）`;
    frag.append(option);
  });
  els.modeSelect.replaceChildren(frag);
  els.modeSelect.value = 'std12';
  updateModeHint();
}

function updateModeHint() {
  const mode = modeById(els.modeSelect.value);
  els.modeHint.textContent = `${mode.desc} 需 ${mode.roles.length} 人。`;
}

const CUSTOM_STANDARD = (MODES.find((mode) => mode.id === 'std12') || MODES[0]).roles.slice();
let customCounts = {};
let customSkillsReady = false;

function resetCustomCounts() {
  customCounts = {};
  CUSTOM_STANDARD.forEach((role) => { customCounts[role] = (customCounts[role] || 0) + 1; });
  renderCustomRoles();
}

function customTotalCount() {
  return Object.values(customCounts).reduce((sum, n) => sum + n, 0);
}

function renderCustomRoles() {
  if (!els.customRoleList) return;
  const frag = document.createDocumentFragment();
  CUSTOM_ORDER.forEach((roleKey) => {
    const role = ROLES[roleKey];
    if (!role) return;
    const row = document.createElement('div');
    row.className = 'sr-custom-role';
    const name = document.createElement('span');
    name.className = 'sr-custom-role-name';
    name.textContent = role.name;
    const stepper = document.createElement('span');
    stepper.className = 'sr-stepper';
    const count = customCounts[roleKey] || 0;
    const limit = CUSTOM_LIMITS[roleKey] || 0;
    const minus = makeBtn('−', 'btn-outline-secondary', () => {
      if (!customCounts[roleKey]) return;
      customCounts[roleKey] -= 1;
      renderCustomRoles();
    }, count === 0);
    minus.classList.add('sr-stepper-btn');
    const value = document.createElement('strong');
    value.textContent = count;
    const plus = makeBtn('+', 'btn-outline-secondary', () => {
      if (count >= limit || customTotalCount() >= 12) return;
      customCounts[roleKey] = count + 1;
      renderCustomRoles();
    }, count >= limit || customTotalCount() >= 12);
    plus.classList.add('sr-stepper-btn');
    stepper.append(minus, value, plus);
    row.append(name, stepper);
    frag.append(row);
  });
  els.customRoleList.replaceChildren(frag);
  els.customTotal.textContent = customTotalCount();
}

function renderCustomSkills() {
  if (!els.customSkillList || customSkillsReady) return;
  const frag = document.createDocumentFragment();
  CUSTOM_ORDER.forEach((roleKey) => {
    const role = ROLES[roleKey];
    if (!role) return;
    const item = document.createElement('div');
    item.className = 'sr-custom-skill';
    const name = document.createElement('strong');
    name.textContent = role.name;
    const text = document.createElement('span');
    text.textContent = role.skill;
    item.append(name, text);
    frag.append(item);
  });
  els.customSkillList.replaceChildren(frag);
  customSkillsReady = true;
}

function customConfigFromForm() {
  const roles = [];
  CUSTOM_ORDER.forEach((role) => {
    for (let i = 0; i < (customCounts[role] || 0); i++) roles.push(role);
  });
  return buildCustomMode({
    name: els.customName.value.trim(),
    roles,
    sheriff: els.customSheriff.checked,
    nightMs: Number(els.customNight.value),
    speechMs: Number(els.customSpeech.value),
  });
}

function customStatus(text = '', bad = false) {
  els.customStatus.textContent = text;
  els.customStatus.hidden = !text;
  els.customStatus.classList.toggle('text-danger', bad);
  els.customStatus.classList.toggle('text-muted', !bad);
}

function openCustomModal() {
  if (authChecking) return;
  closeAccountMenu();
  if (!accountApproved()) {
    openAuthModal();
    els.loginName.focus({ preventScroll: true });
    return;
  }
  if (!customTotalCount()) resetCustomCounts();
  renderCustomSkills();
  customStatus('');
  els.customModal.hidden = false;
  els.customName.focus({ preventScroll: true });
}

function closeCustomModal() {
  if (els.customModal) els.customModal.hidden = true;
}

async function createCustomRoom() {
  if (busy) return;
  if (!guardClient()) return;
  const built = customConfigFromForm();
  if (built.error) {
    customStatus(built.error, true);
    return;
  }
  setBusy(true);
  customStatus('正在创建房间…');
  els.customCreate.disabled = true;
  try {
    await createRoom(built.custom);
    closeCustomModal();
  } catch (error) {
    customStatus(friendlyError(error), true);
  } finally {
    setBusy(false);
    els.customCreate.disabled = false;
  }
}

function enterRoom({ code, playerId, name }, firstSnapshot) {
  clearSettlementRetry();
  pendingInviteCode = null;
  const active = session = { code, playerId, name };
  localStorage.setItem(membershipKey(), JSON.stringify({ ...active, accountId: profile?.id }));
  els.roomCodeLabel.textContent = code;
  room = null;
  members = [];
  myRow = null;
  g = null;
  roleShown = false;
  localFeed = [];
  chatRows = [];
  wolfChatRows = [];
  ratings = new Map();
  ratingsKey = '';
  submitted = new Set();
  roomSig = '';
  chatSig = '';
  pick = null;
  preFlushing = false;
  loadPreSpeech();
  phaseKey = '';
  feedSeeded = false;
  resetRoomView();
  showRoom();
  updateHomeRoomCard();
  setConn('连接中…');
  if (firstSnapshot?.code === code && firstSnapshot.me?.id === playerId &&
      Number.isSafeInteger(firstSnapshot.revision) && firstSnapshot.options && Array.isArray(firstSnapshot.members)) {
    applySnapshot(firstSnapshot);
  }
  if (session !== active) return;
  if (!room) pollOnce(); // Old functions return only the membership record.
  startPolling();
}

function resetRoomView() {
  els.phaseLabel.textContent = '载入中…';
  els.seatCount.textContent = '–';
  els.gameClock.textContent = '';
  els.statusPrompt.textContent = '';
  els.modeLabel.textContent = '–';
  els.myBar.hidden = true;
  els.roleCard.hidden = true;
  els.chatCard.hidden = true;
  els.gameOverCard.hidden = true;
  els.playerList.replaceChildren();
  els.actionArea.replaceChildren();
  els.modeInfo.replaceChildren();
  els.chatFeed.replaceChildren();
  els.statusBar.classList.remove('sr-night');
  renderFeed();
}

function startPolling() {
  stopPolling();
  // 首帧同步由 enterRoom 负责；轮询按间隔起步，避免与在途请求抢响应。
  schedulePoll(1600);
}
// 自适应轮询：刚有变化时跟得紧，长时间无变化时放宽，降低服务端锁竞争。
function nextPollDelay() {
  if (!session || document.hidden) return 3000;
  return Date.now() - lastChangeAt < 8000 ? 1200 : 2500;
}
function schedulePoll(delay) {
  stopPolling();
  pollTimer = setTimeout(async () => {
    await pollOnce();
    if (session) schedulePoll(nextPollDelay());
  }, delay);
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

let polling = null; // session owning the in-flight poll

async function loadRatings() {
  if (!session || !members.length) return;
  const active = session;
  const names = [...new Set(members.map((m) => m.name))];
  const key = names.slice().sort().join('|');
  const { data, error } = await client
    .from('ratings')
    .select('name, rating')
    .in('name', names);
  if (session !== active) return;
  if (error) {
    ratings = new Map(names.map((name) => [name, 1500]));
    ratingsKey = key;
    return;
  }
  ratings = new Map(names.map((name) => [name, 1500]));
  (data || []).forEach((row) => ratings.set(row.name, row.rating));
  ratingsKey = key;
}

async function loadLeaderboard() {
  if (!client) return;
  els.leaderboardNote.textContent = '加载中…';
  const { data, error } = await client
    .from('ratings')
    .select('name, rating, games, wins')
    .order('rating', { ascending: false })
    .order('games', { ascending: false })
    .order('wins', { ascending: false })
    .limit(10);
  if (error) {
    leaderboardData = [];
    renderLeaderboard(true);
    return;
  }
  leaderboardData = data || [];
  renderLeaderboard();
}

function renderLeaderboard(failed = false) {
  const frag = document.createDocumentFragment();
  if (failed) {
    els.leaderboardNote.textContent = '暂不可用';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'text-center text-muted py-3';
    td.textContent = '排行榜暂不可用，请稍后重试。';
    tr.append(td);
    frag.append(tr);
    els.leaderboardBody.replaceChildren(frag);
    return;
  }
  if (!leaderboardData.length) {
    els.leaderboardNote.textContent = '前 10 名';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'text-center text-muted py-3';
    td.textContent = '还没有对局记录，打完一局就能上榜';
    tr.append(td);
    frag.append(tr);
    els.leaderboardBody.replaceChildren(frag);
    return;
  }

  els.leaderboardNote.textContent = leaderboardData.length >= 10 ? '前 10 名' : `共 ${leaderboardData.length} 人`;
  const myName = els.nameInput.value.trim();
  leaderboardData.forEach((row, index) => {
    const tr = document.createElement('tr');
    if (myName && row.name === myName) tr.classList.add('table-info');

    const rankTd = document.createElement('td');
    rankTd.className = `sr-rank${index < 3 ? ` sr-rank-${index + 1}` : ''}`;
    rankTd.textContent = index + 1;

    const nameTd = document.createElement('td');
    nameTd.textContent = row.name;
    if (myName && row.name === myName) {
      const me = document.createElement('span');
      me.className = 'badge badge-primary ml-2';
      me.textContent = '我';
      nameTd.append(me);
    }

    const ratingTd = document.createElement('td');
    ratingTd.className = 'text-right sr-lb-rating';
    ratingTd.textContent = row.rating;

    const gamesTd = document.createElement('td');
    gamesTd.className = 'text-right';
    gamesTd.textContent = row.games || 0;

    const rateTd = document.createElement('td');
    rateTd.className = 'text-right';
    rateTd.textContent = row.games ? `${Math.round((row.wins / row.games) * 100)}%` : '—';

    tr.append(rankTd, nameTd, ratingTd, gamesTd, rateTd);
    frag.append(tr);
  });
  els.leaderboardBody.replaceChildren(frag);
}

// ---------- 历史对局回放 ----------
function winnerTextFor(winner) {
  return winner === 'wolf' ? '狼人阵营获胜' : winner === 'lovers' ? '第三方阵营获胜' : '好人阵营获胜';
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function replayReadHint(error) {
  const message = String(error?.message || error || '未知错误');
  const detail = `${error?.code || ''} ${message}`;
  if (/JWT|401|PGRST30[123]|invalid token|not authenticated/i.test(detail)) return '登录状态异常，请重新登录';
  if (/42501|403|permission denied|row-level security/i.test(detail)) return '没有回放读取权限，请确认账号已审核，并请站长检查回放只读策略';
  if (/42P01|PGRST205|does not exist|schema cache|could not find the table/i.test(detail)) return '找不到回放表，请站长按 DEPLOYMENT.md 检查迁移和接口缓存';
  if (/fetch|network|Load failed|timeout/i.test(detail)) return '网络连接失败，请检查连接后重试';
  return `回放读取失败：${message}`;
}

async function loadHistory() {
  if (!client || !accountApproved() || historyRequest) return;
  const request = historyRequest = {};
  if (!historyRows.length) els.historyNote.textContent = '加载中…';
  try {
    for (let attempt = 0; attempt < 3 && request === historyRequest; attempt++) {
      try {
        const { data, error } = await client.from('replays')
          .select('id, room_code, mode_name, winner, days, finished_at')
          .order('finished_at', { ascending: false }).limit(20);
        if (error) throw error;
        if (request !== historyRequest) return;
        historyRows = data || [];
        renderHistory();
        return;
      } catch (error) {
        if (request !== historyRequest) return;
        if (attempt === 2) renderHistory(replayReadHint(error));
        else await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }
  } finally {
    if (request === historyRequest) historyRequest = null;
  }
}

function renderHistory(failure = '') {
  const frag = document.createDocumentFragment();
  const emptyRow = (text) => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'text-center text-muted py-3';
    td.textContent = text;
    tr.append(td);
    return tr;
  };
  els.historyNote.className = failure ? 'text-danger' : 'text-muted';
  if (failure && !historyRows.length) {
    els.historyNote.textContent = failure;
    frag.append(emptyRow('历史对局暂不可用'));
    els.historyBody.replaceChildren(frag);
    return;
  }
  if (!historyRows.length) {
    els.historyNote.textContent = '每局结束时自动保存回放（含全部讨论）';
    frag.append(emptyRow('还没有对局记录'));
    els.historyBody.replaceChildren(frag);
    return;
  }
  els.historyNote.textContent = failure
    ? `刷新失败，显示上次的 ${historyRows.length} 局：${failure}`
    : `最近 ${historyRows.length} 局 · 回放包含全部发言和狼人夜间讨论`;
  historyRows.forEach((row) => {
    const tr = document.createElement('tr');
    const when = document.createElement('td');
    when.className = 'text-nowrap';
    when.textContent = formatWhen(row.finished_at);
    const mode = document.createElement('td');
    mode.textContent = row.mode_name || '—';
    const winner = document.createElement('td');
    winner.textContent = winnerTextFor(row.winner);
    const days = document.createElement('td');
    days.className = 'text-right';
    days.textContent = row.days || '—';
    const action = document.createElement('td');
    action.className = 'text-right';
    action.append(makeBtn('查看', 'btn-outline-primary', () => {
      openReplay(row.id).catch((error) => toast(friendlyError(error)));
    }));
    tr.append(when, mode, winner, days, action);
    frag.append(tr);
  });
  els.historyBody.replaceChildren(frag);
}

function showReplayView() {
  els.homeView.hidden = true;
  els.roomView.hidden = true;
  els.spectateView.hidden = true;
  els.replayView.hidden = false;
  closeAccountMenu();
  window.scrollTo(0, 0);
}

async function openReplay(id) {
  if (!guardClient()) return;
  const epoch = authEpoch;
  const { data, error } = await client.from('replays').select('*').eq('id', id).maybeSingle();
  if (epoch !== authEpoch || !accountApproved()) return;
  if (error) {
    toast(replayReadHint(error));
    return;
  }
  if (!data) {
    toast('这条回放不存在了');
    return;
  }
  replayData = data;
  replayFilter = 'all';
  endSpectate();
  showReplayView();
  renderReplay();
}

function replaySeatText(seat, name) {
  if (seat == null) return name || '—';
  return `${pad(seat)} 号${name ? ` · ${name}` : ''}`;
}

function renderReplay() {
  const data = replayData;
  if (!data) return;
  els.replayCode.textContent = data.room_code || '------';
  els.replayWinner.className = `sr-winner ${data.winner === 'wolf' ? 'sr-winner-wolf' : data.winner === 'lovers' ? 'sr-winner-lovers' : ''}`.trim();
  els.replayWinner.textContent = `${winnerTextFor(data.winner)} · ${data.win_reason || ''}`;
  const events = data.events || [];
  const talkCount = events.filter((ev) => ev.t === 'chat' || ev.t === 'wolfchat').length;
  els.replayMeta.textContent = [
    `板子：${data.mode_name || data.mode || '未知'}`,
    `共 ${data.days || 0} 天`,
    `结束于 ${formatWhen(data.finished_at)}`,
    data.rating?.unrated ? '自定义局不计分' : data.rating?.k ? `评分 K=${data.rating.k}` : '',
    `讨论 ${talkCount} 条（含狼人频道）`,
  ].filter(Boolean).join(' · ');
  renderReplayPlayers();
  renderReplayLog();
  renderReplayTimeline();
  els.replayFilters.querySelectorAll('button').forEach((btn) => {
    btn.classList.toggle('btn-dark', btn.dataset.filter === replayFilter);
    btn.classList.toggle('btn-outline-dark', btn.dataset.filter !== replayFilter);
  });
}

function renderReplayPlayers() {
  const data = replayData;
  const players = (data.players || []).slice().sort((a, b) => (a.seat || 99) - (b.seat || 99));
  const detail = new Map((data.rating?.players || []).map((item) => [item.seat, item]));
  const frag = document.createDocumentFragment();
  players.forEach((player) => {
    const tr = document.createElement('tr');
    const seatTd = document.createElement('td');
    seatTd.textContent = player.seat ? pad(player.seat) : '—';
    const nameTd = document.createElement('td');
    nameTd.textContent = player.name || '';
    if (player.is_bot) {
      const bot = document.createElement('span');
      bot.className = 'badge badge-info ml-2';
      bot.textContent = '人机';
      nameTd.append(bot);
    }
    const roleTd = document.createElement('td');
    const role = ROLES[player.role];
    if (role) {
      const tag = document.createElement('span');
      tag.className = `sr-tag ${CAMPS[role.camp]?.tag || ''}`;
      tag.textContent = role.name;
      roleTd.append(tag);
    } else {
      roleTd.textContent = '—';
    }
    const deathTd = document.createElement('td');
    deathTd.className = 'text-muted';
    if (player.kicked) {
      deathTd.textContent = '被请离';
    } else if (player.death) {
      deathTd.textContent = `第 ${player.death.day} 天 · ${DEATH_SHORT[player.death.reason] || ''}`.trim();
    } else {
      deathTd.textContent = '存活到最后';
    }
    const ratingTd = document.createElement('td');
    ratingTd.className = 'text-right';
    const item = detail.get(player.seat);
    if (player.is_bot) {
      ratingTd.className = 'text-right text-muted';
      ratingTd.textContent = '人机不计分';
    } else if (item) {
      ratingTd.className = `text-right ${item.delta >= 0 ? 'sr-delta-up' : 'sr-delta-down'}`;
      ratingTd.textContent = `${item.before} → ${item.after}（${item.delta >= 0 ? '+' : ''}${item.delta}）`;
    } else if (data.rating?.unrated) {
      ratingTd.className = 'text-right text-muted';
      ratingTd.textContent = '不计分';
    } else {
      ratingTd.textContent = '—';
    }
    tr.append(seatTd, nameTd, roleTd, deathTd, ratingTd);
    frag.append(tr);
  });
  els.replayPlayers.replaceChildren(frag);
}

function renderReplayLog() {
  const entries = replayData?.log || [];
  const frag = document.createDocumentFragment();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'text-muted small';
    empty.textContent = '没有流程记录';
    frag.append(empty);
  }
  entries.forEach((entry) => {
    const line = document.createElement('div');
    line.className = `sr-sys${entry.kind && entry.kind !== 'system' ? ` sr-sys-${entry.kind}` : ''}`;
    line.textContent = entry.text;
    frag.append(line);
  });
  els.replayLog.replaceChildren(frag);
}

function replayEventMatches(ev) {
  if (replayFilter === 'all') return true;
  if (replayFilter === 'vote') return ['vote','policeVote','policeRunoff'].includes(ev.t);
  return ev.t === replayFilter;
}

function replayNightText(ev) {
  const who = replaySeatText(ev.seat);
  const target = ev.target != null && ev.target > 0 ? `${pad(ev.target)} 号` : null;
  const payload = ev.payload || {};
  switch (ev.step) {
    case 'thief': return '盗贼换牌（底牌已选）';
    case 'cupid': return `丘比特连线：${payload.a ? `${pad(payload.a)} 号` : '?'} 与 ${payload.b ? `${pad(payload.b)} 号` : '?'}`;
    case 'guard': return `守卫 ${who} 守护 ${target || '（无）'}`;
    case 'wolves': return `狼人 ${who} 刀 ${target || '空刀'}`;
    case 'wolfbeauty': return `狼美人 ${who} 魅惑 ${target || '（无）'}`;
    case 'witch': {
      const parts = [];
      if (payload.save) parts.push('使用解药');
      if (payload.poison) parts.push(`毒 ${pad(payload.poison)} 号`);
      return `女巫 ${who} ${parts.length ? parts.join('，') : '没有用药'}`;
    }
    case 'seer': return `预言家 ${who} 查验 ${target || '（无）'}`;
    default: return `${STEP_LABEL[ev.step] || '夜间行动'}：${who}${target ? ` → ${target}` : ''}`;
  }
}

function replayEventNode(ev) {
  const line = document.createElement('div');
  const dayChip = document.createElement('span');
  dayChip.className = 'sr-ev-day';
  dayChip.textContent = ev.phase === 'night' || ev.t === 'night' || ev.t === 'wolfchat' ? `第${ev.day}夜` : `第${ev.day}天`;
  let cls = 'sr-ev';
  let text = '';
  if (ev.t === 'chat') {
    text = `${replaySeatText(ev.seat, ev.name)}：${ev.text}`;
  } else if (ev.t === 'wolfchat') {
    cls += ' sr-ev-wolf';
    text = `狼人频道 · ${replaySeatText(ev.seat, ev.name)}：${ev.text}`;
  } else if (ev.t === 'night') {
    cls += ' sr-ev-night';
    text = replayNightText(ev);
  } else if (ev.t === 'vote') {
    cls += ' sr-ev-vote';
    const target = ev.target != null && ev.target > 0 ? `${pad(ev.target)} 号` : '弃权';
    text = `${ev.step === 'runoff' ? 'PK 投票' : '投票'}：${replaySeatText(ev.seat)} → ${target}`;
  } else if (['policeSignup','policeSpeech','policeVote','policeRunoff','order','badge','lastwords'].includes(ev.t)) {
    const detail = ev.t === 'order' ? (ev.payload.dir === 'ccw' ? '逆时针' : '顺时针')
      : ev.t === 'policeSignup' ? (ev.payload.run ? '上警' : '不上警')
      : ev.target > 0 ? `→ ${pad(ev.target)} 号` : ev.target === -1 ? '放弃' : '结束';
    text = `${STEP_LABEL[ev.t]} · ${replaySeatText(ev.seat)}：${detail}`;
  } else if (ev.t === 'speech') {
    cls += ' sr-ev-muted';
    text = `${replaySeatText(ev.seat)} 结束发言`;
  } else if (ev.t === 'explode') {
    cls += ' sr-ev-warn';
    text = `${replaySeatText(ev.seat)} 自爆${ev.target ? `，带走 ${pad(ev.target)} 号` : ''}`;
  } else if (ev.t === 'duel') {
    text = `骑士 ${replaySeatText(ev.seat)} 决斗 ${replaySeatText(ev.target)}`;
  } else if (ev.t === 'deathConfirm') {
    text = `${replaySeatText(ev.seat)} 确认出局`;
  } else if (ev.t === 'hunter') {
    const shooter = ev.payload?.boss ? '狼王' : '猎人';
    text = `${shooter} ${replaySeatText(ev.seat)} ${ev.target ? `翻牌带走 ${replaySeatText(ev.target)}` : ev.payload?.reveal === true ? '翻牌但未发动' : ev.payload?.reveal === false ? '没有翻牌' : '没有发动'}`;
  } else if (ev.t === 'afk') {
    text = `${replaySeatText(ev.seat)} 回来了，解除挂机`;
  } else if (ev.t === 'leave') {
    text = `${replaySeatText(ev.seat)} 离开了房间`;
  } else if (ev.t === 'kick') {
    cls += ' sr-ev-warn';
    text = `${replaySeatText(ev.target)} 被请离了房间`;
  } else {
    cls += ' sr-ev-muted';
    text = replaySeatText(ev.seat);
  }
  line.className = cls;
  line.append(dayChip, document.createTextNode(text));
  return line;
}

function renderReplayTimeline() {
  const events = (replayData?.events || []).filter(replayEventMatches);
  const frag = document.createDocumentFragment();
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'text-muted small';
    empty.textContent = replayFilter === 'all' ? '没有记录' : '这个分类没有记录';
    frag.append(empty);
  }
  events.forEach((ev) => frag.append(replayEventNode(ev)));
  els.replayTimeline.replaceChildren(frag);
  els.replayTimeline.scrollTop = 0;
}

// ---------- 旁观进行中的对局 ----------
async function openSpectate(code) {
  if (!guardClient()) return;
  if (session?.code === code) {
    backToRoom();
    return;
  }
  if (!accountApproved()) {
    toast('先登录并等待账号审核通过');
    openAuthModal();
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    toast('请输入 6 位数字房间码');
    return;
  }
  if (spectate?.code === code) return;
  endSpectate();
  const active = spectate = { code };
  try {
    await spectateLoad();
    if (spectate !== active) return;
    showSpectateView();
    startSpectatePoll(active);
  } catch (error) {
    if (spectate !== active) return;
    toast(friendlyError(error));
    showHome();
  }
}

function setSpectateNote(text) {
  els.spectateNote.textContent = text;
  els.spectateNote.hidden = !text;
}

function startSpectatePoll(active) {
  stopSpectate();
  let failures = 0, pending = false;
  spectateTimer = setInterval(async () => {
    if (pending || active !== spectate) return;
    pending = true;
    try {
      await spectateLoad();
      if (active !== spectate) return;
      failures = 0;
      setSpectateNote('');
    } catch (error) {
      if (active !== spectate) return;
      const reason = friendlyError(error);
      if (++failures >= 5) {
        stopSpectate();
        setSpectateNote(`旁观刷新已暂停：${reason}。请返回大厅后重新进入。`);
      } else setSpectateNote(`旁观刷新失败，保留上次画面并自动重试：${reason}`);
    } finally {
      pending = false;
    }
  }, 2000);
}

function stopSpectate() {
  if (spectateTimer) {
    clearInterval(spectateTimer);
    spectateTimer = null;
  }
}

function endSpectate() {
  stopSpectate();
  spectate = null;
  setSpectateNote('');
}

function exitSpectate() {
  showHome();
}

function showSpectateView() {
  els.homeView.hidden = true;
  els.roomView.hidden = true;
  els.replayView.hidden = true;
  els.spectateView.hidden = false;
  closeAccountMenu();
  window.scrollTo(0, 0);
}

function spectatePromptText(state) {
  if (state.phase === 'finished') return '对局已结束。点右上角「查看完整回放」查看含狼人夜聊的完整记录。';
  if (state.phase === 'night') return '夜晚行动中，具体行动保密。';
  if (state.phase === 'day') {
    const order = state.speechOrder || [];
    const speaker = order[state.speechIndex] ?? null;
    if (speaker == null) return '发言结束，马上进入投票…';
    return `${order.length > 1 ? `发言顺序：${order.map(pad).join(' → ')}。` : ''}当前 ${pad(speaker)} 号发言（第 ${state.speechIndex + 1} / ${order.length} 位）。`;
  }
  if (state.phase === 'vote' || state.phase === 'runoff') return '投票中，结果在本轮结束后公布。';
  if (settling(state)) return '正在结算…';
  if (state.phase === 'dawn') return '天亮了，等待公布昨夜结果…';
  if (state.phase === 'sheriff') return '警长竞选中，结果稍后公布。';
  if (state.phase === 'order') return '警长正在决定今天的发言方向。';
  if (state.phase === 'lastwords') return '正在发表遗言。';
  if (state.phase === 'badge') return '警长出局，正在移交警徽。';
  return '';
}

function renderSpectate() {
  const state = spectate?.g;
  if (!state) return;
  const mode = spectate.room?.options
    ? modeFromOptions(spectate.room.options)
    : modeById(state.mode || 'std12');
  const total = mode.roles.length;
  els.spectateCode.textContent = spectate.code;
  els.spectatePhase.textContent = phaseTextOf(state);
  els.spectateStatusBar.classList.toggle('sr-night', state.phase === 'night');
  els.spectateStatusBar.classList.toggle('sr-over', state.phase === 'finished');
  els.spectateCount.textContent = `${(state.aliveSeats || []).length} / ${total} 存活`;
  els.spectateMode.textContent = `${mode.name} · ${total} 人`;
  els.spectatePrompt.textContent = spectatePromptText(state);
  els.spectateReplayBtn.hidden = !state.replayId;
  updateSpectateClock();
  renderSpectateSeats(state, mode);
  renderSpectateChat();
  renderSpectateFeed();
}

function renderSpectateSeats(state, mode) {
  const total = mode.roles.length;
  const bySeat = new Map();
  spectate.members.forEach((member) => {
    if (member.seat) bySeat.set(member.seat, member);
  });
  const alive = new Set(state.aliveSeats || []);
  const speaker = state.phase === 'day' ? state.speechOrder?.[state.speechIndex]
    : state.step === 'policeSpeech' ? state.policeOrder?.[state.policeIndex] : state.lastWordsSeat;
  const frag = document.createDocumentFragment();
  for (let seat = 1; seat <= total; seat += 1) {
    const member = bySeat.get(seat);
    const li = document.createElement('li');
    li.className = 'sr-seat';
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
    if (!member) {
      li.classList.add('sr-seat-empty');
      avatar.textContent = '·';
      name.textContent = '空座';
    } else {
      if (!alive.has(seat)) li.classList.add('sr-dead');
      if (speaker === seat) li.classList.add('sr-speaking');
      avatar.textContent = (member.name || '?').trim().charAt(0).toUpperCase();
      name.textContent = member.name;
      if (member.is_bot) {
        const bot = document.createElement('span');
        bot.className = 'badge badge-info';
        bot.textContent = '人机';
        marks.append(bot);
      }
      if (state.sheriff === seat) {
        const sheriff = document.createElement('span');
        sheriff.className = 'badge badge-dark';
        sheriff.textContent = '警长';
        marks.append(sheriff);
      }
      if ((state.kicked || []).includes(seat)) {
        const kicked = document.createElement('span');
        kicked.className = 'badge badge-danger';
        kicked.textContent = '已请离';
        marks.append(kicked);
      } else if (!alive.has(seat)) {
        const out = document.createElement('span');
        out.className = 'badge badge-secondary';
        out.textContent = '出局';
        marks.append(out);
      }
    }
    li.append(head, avatar, name, marks);
    frag.append(li);
  }
  els.spectateSeats.replaceChildren(frag);
}

function renderSpectateChat() {
  const frag = document.createDocumentFragment();
  if (!spectate?.chatRows.length) {
    const empty = document.createElement('div');
    empty.className = 'text-muted small';
    empty.textContent = '还没有公开发言';
    frag.append(empty);
  }
  (spectate?.chatRows || []).forEach((row) => {
    const wrap = document.createElement('div');
    wrap.className = 'sr-chat-msg';
    const who = document.createElement('span');
    who.className = 'sr-chat-who';
    who.textContent = `第${row.day}天 · ${row.payload?.name || '玩家'}`;
    const text = document.createElement('span');
    text.className = 'sr-chat-text';
    text.textContent = row.payload?.text || '';
    wrap.append(who, text);
    frag.append(wrap);
  });
  els.spectateChat.replaceChildren(frag);
  els.spectateChat.scrollTop = els.spectateChat.scrollHeight;
}

function renderSpectateFeed() {
  const entries = (spectate?.g?.log || []).slice(-120);
  const frag = document.createDocumentFragment();
  entries.forEach((entry) => {
    const line = document.createElement('div');
    line.className = `sr-sys${entry.kind && entry.kind !== 'system' ? ` sr-sys-${entry.kind}` : ''}`;
    line.textContent = entry.text;
    frag.append(line);
  });
  els.spectateFeed.replaceChildren(frag);
  els.spectateFeed.scrollTop = els.spectateFeed.scrollHeight;
}

function updateSpectateClock() {
  const state = spectate?.g;
  if (!els.spectateClock) return;
  if (!state || !state.deadline || state.phase === 'finished') {
    els.spectateClock.textContent = '';
    return;
  }
  const left = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
  els.spectateClock.textContent = left > 0
    ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
    : '加时';
}

function renderFeed() {
  const entries = [];
  localFeed.slice(-20).forEach((text) => entries.push({ kind: 'system', text }));
  if (g?.log) entries.push(...g.log.slice(-100));
  const stick = els.feed.scrollHeight - els.feed.scrollTop - els.feed.clientHeight < 40;
  const frag = document.createDocumentFragment();
  entries.forEach((entry) => {
    const line = document.createElement('div');
    line.className = `sr-sys${entry.kind && entry.kind !== 'system' ? ` sr-sys-${entry.kind}` : ''}`;
    line.textContent = entry.text;
    frag.append(line);
  });
  els.feed.replaceChildren(frag);
  if (stick) els.feed.scrollTop = els.feed.scrollHeight;
}

function preSpeechKey() {
  return session ? `wolf.prespeech:${session.code}:${session.playerId}` : null;
}

function loadPreSpeech() {
  preSpeech = { day: 0, msgs: [] };
  const key = preSpeechKey();
  if (!key) return;
  try {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw || !Array.isArray(raw.msgs)) return;
    preSpeech = {
      matchId: raw.matchId,
      day: Number(raw.day) || 0,
      paused: raw.paused === true,
      msgs: raw.msgs.filter((text) => typeof text === 'string' && text.length <= 200 && text.trim()).slice(0, 12),
    };
  } catch {
    preSpeech = { day: 0, msgs: [] };
  }
}

function savePreSpeech() {
  const key = preSpeechKey();
  if (!key) return;
  if (!preSpeech.msgs.length) {
    localStorage.removeItem(key);
    return;
  }
  // A reload during an unacknowledged send must not replay it automatically.
  localStorage.setItem(key, JSON.stringify({ ...preSpeech, paused: preSpeech.paused || preFlushing }));
}

function clearPreSpeech() {
  preSpeech = { day: 0, msgs: [] };
  savePreSpeech();
}

function pendingSpeechCount() {
  return g && preSpeech.matchId === g.matchId && preSpeech.day === g.day ? preSpeech.msgs.length : 0;
}

function canPreInput() {
  if (!g || g.phase !== 'day' || !isAliveSeat(myRow?.seat)) return false;
  const order = g.speechOrder || [];
  const myIndex = order.indexOf(myRow?.seat);
  if (myIndex < 0) return false;
  return myIndex > g.speechIndex;
}

function myDiscussionTurn() {
  return g?.phase === 'day' && isAliveSeat(myRow?.seat) && currentSpeaker() === myRow.seat &&
    !submitted.has(`${g.day}:speech`);
}

function queueSpeech(text) {
  if (text.length > 200) {
    toast('每条发言最多 200 字');
    return false;
  }
  if (preSpeech.day !== g.day || preSpeech.matchId !== g.matchId) preSpeech = { matchId:g.matchId, day:g.day, msgs:[] };
  if (preSpeech.msgs.length >= 12) {
    toast('待发队列已满，最多 12 条');
    return false;
  }
  preSpeech.msgs.push(text);
  savePreSpeech();
  renderChat();
  updateChatForm();
  return true;
}

async function flushPreSpeech() {
  if (preFlushing || !myDiscussionTurn() || !pendingSpeechCount() || preSpeech.paused || currentAction()) return;
  const active = session, queue = preSpeech, turn = g.speechIndex;
  preFlushing = true;
  updateChatForm();
  try {
    savePreSpeech();
    while (session === active && preSpeech === queue && myDiscussionTurn() && g.speechIndex === turn && pendingSpeechCount()) {
      const texts = queue.msgs.slice(0, room?.chatBatch ? 12 : 1);
      // Leave space for the envelope even if characters expand when JSON escaped.
      while (JSON.stringify(texts).length > 3500) texts.pop();
      const ok = await act('chat', null, texts.length === 1 ? { text:texts[0], turn } : { texts, turn });
      if (session !== active || preSpeech !== queue) return;
      if (ok) queue.msgs.splice(0, texts.length);
      else queue.paused = true;
      savePreSpeech();
      renderChat();
      if (!ok) break;
    }
  } finally {
    if (session === active) {
      preFlushing = false;
      if (preSpeech === queue) savePreSpeech();
      updateChatForm();
    }
  }
}

function renderChat() {
  const rows = g?.phase === 'night' ? wolfChatRows : chatRows;
  const sig = JSON.stringify([rows, g?.phase === 'day' ? preSpeech.msgs : null]);
  if (sig === chatSig) return;
  chatSig = sig;
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const wrap = document.createElement('div');
    wrap.className = 'sr-chat-msg';
    const who = document.createElement('span');
    who.className = 'sr-chat-who';
    who.textContent = row.payload?.name || '玩家';
    const text = document.createElement('span');
    text.className = 'sr-chat-text';
    text.textContent = row.payload?.text || '';
    wrap.append(who, text);
    frag.append(wrap);
  });
  if (g?.phase === 'day' && pendingSpeechCount()) {
    preSpeech.msgs.forEach((pending) => {
      const wrap = document.createElement('div');
      wrap.className = 'sr-chat-msg sr-chat-pending';
      const who = document.createElement('span');
      who.className = 'sr-chat-who';
      who.textContent = '我（待发出）';
      const text = document.createElement('span');
      text.className = 'sr-chat-text';
      text.textContent = pending;
      wrap.append(who, text);
      frag.append(wrap);
    });
  }
  els.chatFeed.replaceChildren(frag);
  els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
}

function roomSignature() {
  const action = currentAction();
  return JSON.stringify([g, members, [...submitted], wolfPicks,
    pick, kickAsked, appointId, roleShown, room?.appointments, preSpeech.msgs, preSpeech.paused,
    preFlushing, localFeed.length, action && [action.step, action.scene]]);
}
function renderRoom() {
  if (g && myRow?.seat != null && (g.kicked || []).includes(myRow.seat)) {
    exitRoomLocal('你已被请出房间');
    return;
  }
  // 状态未变不重绘：轮询多数时候快照相同，避免整片 DOM 重建带来的卡顿与滚动跳动。
  const sig = roomSignature();
  if (sig === roomSig) return;
  lastChangeAt = Date.now();
  const mode = currentMode();
  const total = mode.roles.length;
  const inGame = Boolean(g);

  els.chatCard.hidden = !inGame || (g.phase === 'night' && !isMyWolf());
  if (inGame) {
    els.seatCount.textContent = `${g.aliveSeats.length} / ${total} 存活`;
  } else {
    els.seatCount.textContent = `${members.length} / ${total}`;
  }

  if (inGame) {
    els.phaseLabel.textContent = phaseText();
    els.statusBar.classList.toggle('sr-night', g.phase === 'night');
    els.statusBar.classList.toggle('sr-over', g.phase === 'finished');
  } else {
    els.phaseLabel.textContent = '等待玩家';
    els.statusBar.classList.remove('sr-night');
    els.statusBar.classList.remove('sr-over');
  }

  els.modeLabel.textContent = `${mode.name} · ${total} 人`;
  renderActionPanel(mode, inGame);
  renderSeats(mode, inGame);
  renderModeInfo(mode);
  renderMyBar();
  renderStatusPrompt(mode, inGame);
  renderFeed();
  updateChatForm();
  updateClock();
  // 渲染期间可能初始化 pick 等交互状态，按渲染后的状态记录签名，避免下次轮询多重建一次。
  roomSig = roomSignature();
}

function phaseText() {
  return phaseTextOf(g);
}

function settling(state) { return ['hunter', 'settling'].includes(state?.phase); }

function phaseTextOf(state) {
  if (!state) return '等待玩家';
  if (state.phase === 'finished') return '对局结束';
  if (state.phase === 'night') return `第 ${state.day} 夜 · ${STEP_LABEL[state.step] || '夜晚'}`;
  if (state.phase === 'dawn') return `第 ${state.day} 天 · 天亮了`;
  if (state.phase === 'vote') return `第 ${state.day} 天 · 投票`;
  if (state.phase === 'runoff') return `第 ${state.day} 天 · PK 投票`;
  if (state.phase === 'shop') return `第 ${state.day} 天 · 商店`;
  if (state.phase === 'rescue') return `第 ${state.day} 天 · 濒死求桃`;
  if (settling(state)) return '出局结算';
  if (['sheriff','order','lastwords','badge'].includes(state.phase)) return `第 ${state.day} 天 · ${STEP_LABEL[state.step]}`;
  return `第 ${state.day} 天 · 讨论`;
}

function renderStatusPrompt(mode, inGame) {
  if (!inGame) {
    const total = mode.roles.length;
    const count = members.length;
    els.statusPrompt.textContent = count < total
      ? `还差 ${total - count} 人。把房间码发给朋友，满员后房主点「开始游戏」。`
      : '人齐了！等房主点「开始游戏」发牌。';
    return;
  }
  if (g.phase === 'finished') {
    els.statusPrompt.textContent = g.winReason || '本局结束';
    return;
  }
  if (g.phase === 'sheriff') {
    if (g.step === 'policeSignup') {
      els.statusPrompt.textContent = '警长竞选：想当警长的玩家点「上警」；不想当也请点「不上警」，超时按不上警处理。';
    } else if (g.step === 'policeSpeech') {
      const order = g.policeOrder || [];
      const seat = order[g.policeIndex];
      els.statusPrompt.textContent = seat == null
        ? '候选人发言结束，马上进入警下投票…'
        : `候选人 ${pad(seat)} 号发言（第 ${g.policeIndex + 1} / ${order.length} 位），每人 ${modeSeconds('speech')} 秒。`;
    } else if (g.step === 'policeRunoff') {
      els.statusPrompt.textContent = `警长 PK：${(g.runoffSeats || []).map(pad).join('、')} 号平票，警下玩家请重新投票。`;
    } else {
      els.statusPrompt.textContent = '警下投票：没上警的存活玩家点击候选人投票，候选人自己不能投票。';
    }
    return;
  }
  if (g.phase === 'order') {
    els.statusPrompt.textContent = `警长 ${pad(g.sheriff)} 号正在决定今天从哪一边开始发言…`;
    return;
  }
  if (g.phase === 'lastwords') {
    els.statusPrompt.textContent = g.lastWordsSeat == null
      ? '遗言结束，继续…'
      : `${pad(g.lastWordsSeat)} 号正在发表遗言（${modeSeconds('speech')} 秒）…`;
    return;
  }
  if (g.phase === 'badge') {
    els.statusPrompt.textContent = '警长已出局，正在移交警徽…';
    return;
  }
  if (g.phase === 'shop') {
    els.statusPrompt.textContent = g.bloodMe?.locked
      ? '你的商店被【乐不思蜀】锁定，今天不能购买，等待讨论开始。'
      : '商店阶段：先领工资、补手牌。选择碎片/装备/补给/魔法骰子后点「确认购物」，超时自动跳过。';
    return;
  }
  if (g.phase === 'rescue') {
    const dying = (g.blood?.rescueQueue || []).map(pad).join('、');
    els.statusPrompt.textContent = `濒死：${dying} 号气血归零，持有【桃】的玩家可以救人；没人救则出局。`;
    return;
  }
  if (!isAliveSeat(myRow?.seat)) {
    els.statusPrompt.textContent = '你已出局，可以继续围观本局。';
    return;
  }
  if (g.phase === 'night') {
    els.statusPrompt.textContent = '夜晚行动中：按顺序行动，选择目标后确认；超时未选视为放弃。';
  } else if (g.phase === 'day') {
    const order = g.speechOrder || [];
    const speaker = currentSpeaker();
    if (speaker == null) {
      els.statusPrompt.textContent = '发言结束，马上进入投票…';
    } else {
      const position = `第 ${g.speechIndex + 1} / ${order.length} 位`;
      const list = order.map(pad).join(' → ');
      const offline = isSeatOnline(speaker) ? '' : '，对方离线，将自动跳过';
      let hint;
      if (speaker === myRow?.seat) {
        hint = submitted.has(`${g.day}:speech`)
          ? '，你已结束发言，等待下一位'
          : '，轮到你发言，可连发多条，说完点「结束发言」';
      } else if (canPreInput()) {
        hint = '，还没轮到你，可以先在右侧打字排队';
      } else {
        hint = `，等待发言${offline}`;
      }
      els.statusPrompt.textContent = `${order.length > 1 ? `发言顺序：${list}。` : ''}当前 ${pad(speaker)} 号（${position}）${hint}。`;
    }
  } else if (g.phase === 'vote' || g.phase === 'runoff') {
    const weight = g.blood?.voteWeight?.[myRow?.seat] || 1;
    els.statusPrompt.textContent = `投票：点击座位选择目标，不能投自己，也可以弃权。${
      weight > 1 ? `你今天的票权重是 ${weight}。` : ''}`;
  } else if (settling(g)) {
    els.statusPrompt.textContent = '正在结算…';
  } else if (g.phase === 'dawn') {
    els.statusPrompt.textContent = '天亮了，等待公布昨夜结果…';
  }
}

function updateClock() {
  if (!g || !g.deadline || g.phase === 'finished') {
    els.gameClock.textContent = '';
    return;
  }
  const left = Math.max(0, Math.ceil((g.deadline - Date.now()) / 1000));
  els.gameClock.textContent = left > 0
    ? `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
    : '加时';
}

setInterval(() => {
  updateClock();
  updateSpectateClock();
}, 500);

function appointControls(member, mode) {
  const fixed = room?.appointments || {};
  const wrap = document.createElement('div');
  wrap.className = 'sr-kick sr-appoint';
  wrap.addEventListener('click', e => e.stopPropagation());
  if (appointId !== member.id) {
    wrap.append(makeBtn(fixed[member.id] ? `钦定 · ${ROLES[fixed[member.id]].name}` : '钦定', 'btn-outline-dark', () => {
      appointId = member.id;
      renderRoom();
    }));
    return wrap;
  }
  const select = document.createElement('select');
  select.className = 'form-control form-control-sm sr-rolepick';
  select.setAttribute('aria-label', `钦定 ${member.name} 的身份`);
  select.add(new Option('不钦定（随机）', ''));
  for (const role of new Set(mode.roles)) {
    const used = Object.entries(fixed).filter(([id, r]) => id !== member.id && r === role).length;
    const left = mode.roles.filter(r => r === role).length - used;
    if (left > 0) select.add(new Option(`${ROLES[role].name}（剩 ${left}）`, role));
  }
  select.value = fixed[member.id] || '';
  select.addEventListener('change', async () => {
    appointId = null;
    try { await roomCommand('appoint', { id: member.id, role: select.value || null }); }
    catch (error) { toast(friendlyError(error)); renderRoom(); }
  });
  wrap.append(select, makeBtn('取消', 'btn-outline-secondary', () => { appointId = null; renderRoom(); }));
  return wrap;
}

function renderSeats(mode, inGame) {
  const total = mode.roles.length;
  const hostId = room?.hostId;
  const bySeat = new Map();
  members.forEach((member, index) => {
    const seat = inGame && member.seat ? member.seat : index + 1;
    bySeat.set(seat, member);
  });
  const alive = inGame ? aliveSet() : null;
  const policeSpeaker = g?.phase === 'lastwords' ? g.lastWordsSeat : inGame && g.phase === 'sheriff' && g.step === 'policeSpeech'
    ? (g.policeOrder || [])[g.policeIndex]
    : null;

  const frag = document.createDocumentFragment();
  for (let seat = 1; seat <= total; seat += 1) {
    const member = bySeat.get(seat);
    const li = document.createElement('li');
    li.className = 'sr-seat';

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

    if (!member) {
      li.classList.add('sr-seat-empty');
      avatar.textContent = '·';
      name.textContent = '等待加入';
    } else {
      if (member.id === session.playerId) li.classList.add('sr-self');
      if (inGame && alive && !alive.has(seat)) li.classList.add('sr-dead');
      if (inGame && (currentSpeaker() === seat || policeSpeaker === seat)) li.classList.add('sr-speaking');

      if (!member.is_bot) {
        const rate = ratings.get(member.name);
        if (rate) {
          const rateTag = document.createElement('span');
          rateTag.className = 'sr-rate';
          rateTag.textContent = rate;
          marks.append(rateTag);
        }
      }

      if (member.id === hostId) {
        const host = document.createElement('span');
        host.className = 'badge badge-warning';
        host.textContent = '房主';
        head.append(host);
      }

      if (inGame && g.sheriff === seat) {
        const sheriff = document.createElement('span');
        sheriff.className = 'badge badge-dark';
        sheriff.textContent = '警长';
        marks.append(sheriff);
      }
      if (inGame && g.phase === 'sheriff' && (g.sheriffCandidates || []).includes(seat)) {
        const police = document.createElement('span');
        police.className = 'badge badge-warning';
        police.textContent = '上警';
        marks.append(police);
      }
      if (inGame && (currentSpeaker() === seat || policeSpeaker === seat)) {
        const speaking = document.createElement('span');
        speaking.className = 'badge badge-warning';
        speaking.textContent = '发言中';
        marks.append(speaking);
      }

      if (member.is_bot) {
        const bot = document.createElement('span');
        bot.className = 'badge badge-info';
        bot.textContent = '人机';
        marks.append(bot);
      }

      avatar.textContent = (member.name || '?').trim().charAt(0).toUpperCase();
      name.textContent = member.name;

      if (member.id === session.playerId) {
        const me = document.createElement('span');
        me.className = 'badge badge-primary';
        me.textContent = '我';
        marks.append(me);
      }
      if (inGame && g.kicked?.includes(seat)) {
        const kicked = document.createElement('span');
        kicked.className = 'badge badge-danger';
        kicked.textContent = '已请离';
        marks.append(kicked);
      } else if (inGame && alive && !alive.has(seat)) {
        const out = document.createElement('span');
        out.className = 'badge badge-secondary';
        out.textContent = '出局';
        marks.append(out);
      }
      if (!isPlayerOnline(member) && !member.is_bot) {
        const off = document.createElement('span');
        off.className = 'badge badge-warning';
        off.textContent = '离线';
        marks.append(off);
        li.classList.add('sr-offline');
      }
    }

    if (pick && pick.allowed.has(seat) && member && !li.classList.contains('sr-dead')) {
      li.classList.add('sr-clickable');
      if (pick.selected.includes(seat)) li.classList.add('sr-picked');
      li.addEventListener('click', () => togglePick(seat));
    }

    li.append(head, avatar, name, marks);
    if (inGame && member && g.blood?.hp?.[seat] != null) {
      const bm = g.blood;
      const stats = document.createElement('div');
      stats.className = 'sr-blood-stats';
      const hp = document.createElement('span');
      hp.textContent = `血 ${bm.hp[seat]}/${bm.maxHp || 4}`;
      if (alive?.has(seat) && bm.hp[seat] <= 1) hp.classList.add('sr-hp-low');
      const gold = document.createElement('span');
      gold.className = 'sr-gold';
      gold.textContent = `金 ${bm.gold[seat] ?? 0}`;
      const star = document.createElement('span');
      star.className = 'sr-star';
      star.textContent = `${bm.star[seat] || 1} 星`;
      const hand = document.createElement('span');
      hand.textContent = `手 ${bm.handCount?.[seat] ?? 0}`;
      stats.append(hp, gold, star, hand);
      if (bm.equipment?.[seat]) {
        const eq = document.createElement('span');
        eq.textContent = Blood?.EQUIPMENT?.[bm.equipment[seat]]?.name || bm.equipment[seat];
        stats.append(eq);
      }
      const skills = bm.skills?.[seat] || [];
      if (skills.length) {
        const sk = document.createElement('span');
        sk.textContent = `技 ${skills.length}`;
        sk.title = skills.map((id) => Blood?.SKILLS?.[id]?.name || id).join('、');
        stats.append(sk);
      }
      li.append(stats);
    }
    if (inGame && member && g.phase === 'night' && g.step === 'wolves' && isMyWolf()) {
      const pickers = wolfPicks.filter((row) => row.target === seat);
      if (pickers.length) {
        li.classList.add('sr-wolfpicked');
        const tag = document.createElement('div');
        tag.className = 'sr-wolfpick';
        tag.textContent = `被刀 ${pickers.map((row) => pad(row.seat)).join('、')}`;
        li.append(tag);
      }
    }
    if (!inGame && session && member && isOwnerAccount()) li.append(appointControls(member, mode));
    if (member && canKickMember(member)) {
      const wrap = document.createElement('div');
      wrap.className = 'sr-kick';
      const stop = (event) => event.stopPropagation();
      if (kickAsked === member.id) {
        const yes = makeBtn('确认踢出', 'btn-danger', () => { kickMember(member).catch((error) => toast(friendlyError(error))); });
        const no = makeBtn('取消', 'btn-outline-secondary', () => { kickAsked = null; renderRoom(); });
        wrap.append(yes, no);
      } else {
        const btn = makeBtn('踢出', 'btn-outline-danger', () => { kickAsked = member.id; renderRoom(); });
        wrap.append(btn);
      }
      wrap.addEventListener('click', stop);
      li.append(wrap);
    }
    frag.append(li);
  }
  els.playerList.replaceChildren(frag);
}

function togglePick(seat) {
  if (currentAction() || !pick || !pick.allowed.has(seat)) return;
  if (pick.selected.includes(seat)) {
    pick.selected = pick.selected.filter((s) => s !== seat);
  } else if (pick.max === 1) {
    pick.selected = [seat];
  } else if (pick.selected.length < pick.max) {
    pick.selected.push(seat);
  } else {
    pick.selected = [...pick.selected.slice(1), seat];
  }
  renderRoom();
}

function beginPick(kind, allowed, max, onConfirm) {
  pick = { kind, allowed: new Set(allowed), max, selected: [], onConfirm };
}

function clearPick() {
  pick = null;
  renderRoom();
}

function pickButtons(onConfirm) {
  const wrap = document.createElement('div');
  wrap.className = 'sr-act w-100';
  const label = document.createElement('span');
  label.className = 'sr-act-hint';
  label.textContent = pick.selected.length ? `已选：${pick.selected.map(pad).join('、')}` : '点击座位选择目标';
  wrap.append(label);
  const ok = makeBtn('确认', 'btn-danger', () => {
    if (!pick || pick.selected.length !== pick.max) return;
    const selected = [...pick.selected];
    pick = null;
    onConfirm(selected);
  });
  ok.disabled = pick.selected.length !== pick.max;
  const cancel = makeBtn('取消', 'btn-outline-secondary', clearPick);
  wrap.append(ok, cancel);
  return wrap;
}

function submittedHelp(step) {
  return submitted.has(`${g.day}:${step}`);
}

const BLOOD_BUY_COST = { shard: 3, equip: 4, supply: 2, dice: 5 };

function renderBloodShop(seat) {
  const b = g.blood;
  if (!b) return;
  if (bloodBuyDay !== g.day) {
    bloodBuy = [];
    bloodBuyDay = g.day;
  }
  if (submittedHelp('shop')) {
    els.actionArea.append(note('已提交购物，等待其他人…'));
    return;
  }
  const bm = g.bloodMe || {};
  if (bm.locked ?? b.locked?.[seat]) {
    els.actionArea.append(note('商店被【乐不思蜀】锁定，今天无法购物。'));
    return;
  }
  const gold = b.gold?.[seat] ?? 0;
  const star = b.star?.[seat] ?? 1;
  const shards = bm.shards ?? b.shards?.[seat] ?? 0;
  const equip = b.equipment?.[seat];
  const skills = b.skills?.[seat] || [];
  const handCount = b.handCount?.[seat] ?? 0;
  const handLimit = (Blood?.HAND_LIMIT ?? 3) + (skills.includes('shouqi') ? 1 : 0);
  const shopEquip = bm.shop?.equip;
  els.actionArea.append(note(`第 ${g.day} 天商店：你有 ${gold} 金、${star}★、${shards} 碎片、${skills.length}/2 技能。购物只对你自己可见，结算后其他人只能看到结果。`));

  const spent = bloodBuy.reduce((sum, key) => sum + BLOOD_BUY_COST[key], 0);
  const wrap = document.createElement('div');
  wrap.className = 'sr-blood-hand';
  const addOption = (key, label, disabled) => {
    const selected = bloodBuy.includes(key);
    const btn = makeBtn(`${selected ? '✓ ' : ''}${label}`, selected ? 'btn-danger' : 'btn-outline-primary',
      () => {
        bloodBuy = selected ? bloodBuy.filter((k) => k !== key) : [...bloodBuy, key];
        renderRoom();
      }, disabled && !selected);
    wrap.append(btn);
  };
  if (shopEquip && !equip) addOption('equip', `装备·${Blood?.EQUIPMENT?.[shopEquip]?.name || shopEquip}（4金）`, spent + 4 > gold);
  if (star < 3) addOption('shard', `碎片（3金，还差 ${Math.max(1, (star === 1 ? 2 : 3) - shards)} 个升星）`, spent + 3 > gold);
  if (skills.length < 2) addOption('dice', '魔法骰子（5金，抽技能）', spent + 5 > gold);
  addOption('supply', '补给（2金，摸 2 张）', spent + 2 > gold || handCount >= handLimit);
  els.actionArea.append(wrap);
  els.actionArea.append(note(`已选 ${bloodBuy.length} 项，共 ${spent} 金；结算时按选择顺序扣钱，钱不够的部分自动作废。`));
  const submit = makeBtn(`确认购物${bloodBuy.length ? `（${bloodBuy.length} 项）` : '（空过）'}`, 'btn-danger', async () => {
    const buys = bloodBuy.slice(0, 4);
    bloodBuy = [];
    await act('shop', null, { buys });
  });
  els.actionArea.append(submit);
}

function renderBloodRescue(seat) {
  const b = g.blood;
  if (!b) return;
  const queue = b.rescueQueue || [];
  if (!queue.length) {
    els.actionArea.append(note('等待濒死结算…'));
    return;
  }
  const dying = queue.map((s) => `${pad(s)} 号（${Math.max(0, b.hp?.[s] ?? 0)} 血）`).join('、');
  if (submittedHelp('rescue')) {
    els.actionArea.append(note('已用桃，等待其他濒死结算…'));
    return;
  }
  const bm = g.bloodMe || {};
  const hasTao = (bm.hand || []).includes('tao');
  if (!hasTao) {
    els.actionArea.append(note(`濒死：${dying}。你没有【桃】，等待其他人救援或 20 秒后自动结算。`));
    return;
  }
  els.actionArea.append(note(`濒死：${dying}。你手上有【桃】，可以选择救一人；不救则等待倒计时结束。`));
  queue.forEach((target) => {
    els.actionArea.append(makeBtn(`对 ${pad(target)} 号用桃（+2 血）`, 'btn-success',
      () => act('rescue', target, { target })));
  });
}

function renderActionPanel(mode, inGame) {
  els.actionArea.replaceChildren();
  if (!inGame) {
    const missing = mode.roles.length - members.length;
    if (isHost()) {
      const btn = makeBtn(
        missing > 0 ? `开始游戏（还差 ${missing} 人）` : `开始游戏（${mode.roles.length} 人）`,
        'btn-danger',
        startGame,
        missing > 0
      );
      els.actionArea.append(btn, note('满员后随机入座、发牌'));
    } else {
      els.actionArea.append(note(missing > 0
        ? `等待房主开始（还差 ${missing} 人）`
        : '人齐了，等待房主点「开始游戏」'));
    }
    if (isOwnerAccount()) els.actionArea.append(note('发牌前可在座位下方指定身份。指定只对你自己可见；其余身份和座位随机。'));
    if (isOwnerAccount() && missing > 0) {
      els.actionArea.append(makeBtn('添加人机（占位）', 'btn-outline-primary', () => {
        addBot().catch((error) => toast(friendlyError(error)));
      }));
      els.actionArea.append(note('人机由程序行动、不会发言；座位上的「踢出」可以请走玩家或人机。'));
    }
    return;
  }

  if (g.phase === 'finished') {
    els.actionArea.append(note('对局已结束。房主可以点下方「再来一局」。'));
    return;
  }

  const pending = currentAction();
  if (pending) {
    const text = note(['vote','runoff','policeVote','policeRunoff'].includes(pending.step) ? '正在提交投票…' : '正在提交操作…');
    text.setAttribute('role', 'status');
    els.actionArea.append(text);
    return;
  }

  const seat = myRow?.seat;
  const role = myRow?.role;
  const alive = isAliveSeat(seat);

  if (g.phase === 'settling' && g.step === 'deathConfirm') {
    els.actionArea.append(submittedHelp('deathConfirm') ? note('已确认，等待结算…')
      : makeBtn('确认出局（不翻牌）', 'btn-outline-secondary', () => act('deathConfirm', null)));
    return;
  }
  if (g.phase === 'hunter' && g.hunterPending === seat) {
    renderHunterPanel(seat);
    return;
  }
  if (['sheriff', 'order', 'lastwords'].includes(g.phase)) {
    if (pick && (pick.kind === 'explode' || pick.kind === 'explodeConfirm')) {
      renderExplodePick(seat, role);
      return;
    }
    if (g.phase === 'sheriff') renderSheriffPanel(seat);
    else if (g.phase === 'order') renderOrderPanel(seat);
    else renderLastWordsPanel(seat);
    appendExplodeButtons(seat, role);
    return;
  }
  if (g.phase === 'badge') return renderBadgePanel(seat);
  if (!alive) {
    els.actionArea.append(note('你已出局，可以旁观；未轮到遗言时不能发言。'));
    return;
  }

  if (g.phase === 'shop') {
    renderBloodShop(seat);
  } else if (g.phase === 'rescue') {
    renderBloodRescue(seat);
  } else if (g.phase === 'night') {
    renderNightPanel(seat, role);
  } else if (g.phase === 'day') {
    renderDayPanel(seat, role);
  } else if (g.phase === 'vote' || g.phase === 'runoff') {
    renderVotePanel(seat, role);
  } else if (settling(g)) {
    els.actionArea.append(note('等待结算…'));
  } else if (g.phase === 'dawn') {
    els.actionArea.append(note('天亮了，等待公布昨夜结果…'));
  }
}

function renderNightPanel(seat, role) {
  const step = g.step;
  if (submittedHelp(step)) {
    els.actionArea.append(note(step === 'wolves' ? '已选定袭击目标，仍可在狼人频道发言。' : '已提交，等待结算…'));
    return;
  }

  const aliveSeats = g.aliveSeats.slice();

  if (step === 'thief' && seat === g.thiefSeat) {
    const cards = g.thiefCards || [];
    els.actionArea.append(note('盗贼行动：从两张底牌中选一张作为你的身份（另一张作废）。'));
    cards.forEach((cardKey, index) => {
      const roleDef = ROLES[cardKey];
      els.actionArea.append(makeBtn(`选 ${roleDef?.name || cardKey}`, index === 0 ? 'btn-danger' : 'btn-primary',
        () => act('thief', null, { card: index })));
    });
    return;
  }
  if (step === 'cupid' && role === 'cupid') {
    if (!pick || pick.kind !== 'cupid') {
      beginPick('cupid', aliveSeats, 2, (sel) => act('cupid', null, { a: sel[0], b: sel[1] }));
    }
    els.actionArea.append(note('丘比特行动：点击两名玩家，把他们连成情侣（可以连自己）。'));
    els.actionArea.append(pickButtons((sel) => act('cupid', null, { a: sel[0], b: sel[1] })));
    return;
  }
  if (step === 'guard' && role === 'guard') {
    const allowed = aliveSeats.filter((s) => s !== g.lastGuard);
    if (!pick || pick.kind !== 'guard') {
      beginPick('guard', allowed, 1, (sel) => act('guard', sel[0]));
    }
    els.actionArea.append(note(g.lastGuard
      ? `守卫行动：昨晚守护了 ${pad(g.lastGuard)} 号，今晚不能连守，请选择新的守护目标。`
      : '守卫行动：选择今晚要守护的人（可以守自己）。'));
    els.actionArea.append(pickButtons((sel) => act('guard', sel[0])));
    return;
  }
  if (step === 'wolves' && Rules.isWolfRole(role)) {
    const allowed = aliveSeats.slice();
    if (!pick || pick.kind !== 'wolf') {
      beginPick('wolf', allowed, 1, (sel) => act('wolves', sel[0]));
    }
    const mates = g.teams.wolves.map((s) => `${pad(s)}${g.aliveSeats.includes(s) ? '' : '✝'}`).join('、');
    const picksText = wolfPicks.length
      ? wolfPicks.map((row) => `${pad(row.seat)}→${row.target ? pad(row.target) : '弃'}`).join('  ')
      : '暂无';
    els.actionArea.append(note(`狼人行动：点击要刀的人（可以自刀）。狼队友：${mates}；同伴选择：${picksText}`));
    els.actionArea.append(pickButtons((sel) => act('wolves', sel[0])));
    return;
  }
  if (step === 'wolfbeauty' && role === 'wolfbeauty') {
    const allowed = aliveSeats.filter((s) => s !== seat && s !== g.lastCharm);
    if (!pick || pick.kind !== 'charm') {
      beginPick('charm', allowed, 1, (sel) => act('wolfbeauty', sel[0]));
    }
    els.actionArea.append(note(g.lastCharm
      ? `狼美人行动：昨晚魅惑了 ${pad(g.lastCharm)} 号，今晚不能重复，请选择新的目标。`
      : '狼美人行动：选择今晚要魅惑的玩家；你出局时他/她会殉情。'));
    els.actionArea.append(pickButtons((sel) => act('wolfbeauty', sel[0])));
    return;
  }
  if (step === 'witch' && role === 'witch') {
    els.actionArea.append(note(`女巫行动（${modeSeconds('night')} 秒）：解药${g.potions.save ? '可用' : '已用'}，毒药${g.potions.poison ? '可用' : '已用'}，一晚最多用一瓶。`));
    if (g.kill != null) {
      els.actionArea.append(note(g.kill === seat
        ? `今晚 ${pad(g.kill)} 号被狼人袭击（就是你）。${g.potions.save ? '你可以用解药自救。' : '解药已用完，不能自救。'}`
        : `今晚 ${pad(g.kill)} 号被狼人袭击。`));
      if (g.potions.save) {
        els.actionArea.append(makeBtn(`用解药救 ${pad(g.kill)} 号`, 'btn-success', () => act('witch', null, { save: true })));
      }
    } else {
      els.actionArea.append(note('目前没有可以用解药救的刀口。'));
    }
    if (g.potions.poison) {
      if (pick && pick.kind === 'poison') {
        els.actionArea.append(note('毒药：点击一名玩家，再点「确认」才会生效。'));
        els.actionArea.append(pickButtons((sel) => act('witch', sel[0], { poison: sel[0] })));
      } else {
        els.actionArea.append(makeBtn('用毒药', 'btn-danger', () => {
          beginPick('poison', aliveSeats, 1, (sel) => act('witch', sel[0], { poison: sel[0] }));
          renderRoom();
        }));
        els.actionArea.append(note('用毒和救人二选一：选了解药这一晚就不能再毒人。'));
      }
    }
    els.actionArea.append(makeBtn('不用药（过）', 'btn-outline-secondary', () => act('witch', null, {})));
    return;
  }
  if (step === 'seer' && role === 'seer') {
    const allowed = aliveSeats.filter((s) => s !== seat);
    if (!pick || pick.kind !== 'seer') {
      beginPick('seer', allowed, 1, (sel) => act('seer', sel[0]));
    }
    els.actionArea.append(note('预言家行动：选择一名玩家查验身份。'));
    els.actionArea.append(pickButtons((sel) => act('seer', sel[0])));
    const checks = (g.checks || []).filter((c) => c.seat === seat);
    if (checks.length) {
      const list = checks.map((c) => `第${c.day}夜 ${pad(c.target)}号 ${c.killer ? '狼人' : '好人'}`).join('；');
      els.actionArea.append(note(`验人记录：${list}`));
    }
    return;
  }

  els.actionArea.append(note(`第 ${g.day} 夜：等待其他人行动…`));
}

function canSelfExplode(role) {
  return role === 'werewolf' || role === 'wolfking' || role === 'wolfboss';
}
function canExplodeTake(role) {
  return role === 'wolfking' || role === 'wolfboss';
}
function roleTitle(role) {
  return ROLES[role]?.name || '狼人';
}

function explodeStep() {
  return 'explode';
}

function renderExplodePick(seat, role) {
  if (!canSelfExplode(role) || !isAliveSeat(seat)) return false;
  const step = explodeStep();
  if (pick && pick.kind === 'explodeConfirm') {
    els.actionArea.append(note(canExplodeTake(role)
      ? `确认${roleTitle(role)}自爆（不带人）：你翻牌出局，今天我不能再投票，剩余流程全部跳过，直接进入黑夜。`
      : '确认自爆：你翻牌出局，今天我不能再投票，剩余流程全部跳过，直接进入黑夜。'));
    const wrap = document.createElement('div');
    wrap.className = 'sr-act w-100';
    wrap.append(
      makeBtn('确认自爆', 'btn-danger', () => {
        pick = null;
        act(step, null, { explode: true });
      }),
      makeBtn('取消', 'btn-outline-secondary', clearPick),
    );
    els.actionArea.append(wrap);
    return true;
  }
  if (pick && pick.kind === 'explode') {
    els.actionArea.append(note(`${roleTitle(role)}自爆带人：点击要带走的玩家，再点确认，立即进入黑夜。`));
    els.actionArea.append(pickButtons((sel) => act(step, sel[0], { explode: true, target: sel[0] })));
    return true;
  }
  return false;
}

function appendExplodeButtons(seat, role) {
  if (!canSelfExplode(role) || !isAliveSeat(seat)) return;
  const step = explodeStep();
  if (canExplodeTake(role)) {
    els.actionArea.append(makeBtn('自爆带人', 'btn-danger', () => {
      beginPick('explode', g.aliveSeats.filter((s) => s !== seat), 1,
        (sel) => act(step, sel[0], { explode: true, target: sel[0] }));
      renderRoom();
    }));
    els.actionArea.append(makeBtn('只自爆（不带人）', 'btn-outline-danger', () => {
      pick = { kind: 'explodeConfirm', allowed: new Set(), max: 0, selected: [] };
      renderRoom();
    }));
  } else {
    els.actionArea.append(makeBtn('自爆（立即天黑）', 'btn-outline-danger', () => {
      pick = { kind: 'explodeConfirm', allowed: new Set(), max: 0, selected: [] };
      renderRoom();
    }));
  }
  els.actionArea.append(note('自爆后你立即出局，今天的投票和剩余流程全部跳过，直接进入黑夜。'));
}

function bloodCardName(id) {
  return Blood?.CARDS?.[id]?.name || id;
}

function bloodSkillName(id) {
  return Blood?.SKILLS?.[id]?.name || id;
}

function renderBloodDayActions(seat) {
  if (!g.blood || seat == null) return false;
  if (pick && pick.kind === 'blood') {
    els.actionArea.append(note('选择目标后点「确认」。'));
    els.actionArea.append(pickButtons(pick.onConfirm));
    els.actionArea.append(makeBtn('取消', 'btn-outline-secondary', clearPick));
    return true;
  }
  const used = Boolean(g.blood.actionUsed?.[seat]) || submittedHelp('card') || submittedHelp('skill');
  if (used) {
    els.actionArea.append(note('今天已经出过牌或技能，等待发言/投票。'));
    return false;
  }
  const bm = g.bloodMe || {};
  const hand = Array.isArray(bm.hand) ? bm.hand : [];
  const skills = (g.blood.skills?.[seat] || []).filter((id) => ['xiaoshi', 'shunshou', 'bingliang', 'lebu', 'juedou', 'taoyuan', 'xietianzi'].includes(id));
  if (!hand.length && !skills.length) return false;

  const wrap = document.createElement('div');
  wrap.className = 'sr-blood-card';
  const title = document.createElement('div');
  title.className = 'sr-blood-card-title';
  title.textContent = '血月出牌：每天限 1 张牌或 1 个主动技能；出牌公开，目标有「闪」会自动抵消「杀」。';
  wrap.append(title);

  if (hand.length) {
    const row = document.createElement('div');
    row.className = 'sr-blood-hand';
    hand.forEach((card) => {
      const name = bloodCardName(card);
      const info = Blood?.CARDS?.[card]?.desc || '';
      const btn = makeBtn(name, 'btn-outline-danger', null, card === 'shan');
      btn.title = info;
      if (card !== 'shan') {
        btn.addEventListener('click', () => {
          const allowed = card === 'tao' ? g.aliveSeats.slice() : g.aliveSeats.filter((s) => s !== seat);
          beginPick('blood', allowed, 1, (sel) => act('card', sel[0], { card, target: sel[0] }));
          renderRoom();
        });
      }
      row.append(btn);
    });
    wrap.append(row);
  }

  if (skills.length) {
    const row = document.createElement('div');
    row.className = 'sr-blood-hand';
    const skillDay = bm.skillDay === g.day;
    skills.forEach((id) => {
      const usedLimited = (bm.usedSkills || []).includes(id);
      const btn = makeBtn(`技能·${bloodSkillName(id)}`, 'btn-outline-primary', null, skillDay || usedLimited);
      btn.title = Blood?.SKILLS?.[id]?.desc || '';
      if (!skillDay && !usedLimited) {
        btn.addEventListener('click', () => {
          if (id === 'taoyuan' || id === 'xiaoshi') {
            act('skill', null, { skill: id, target: null });
            return;
          }
          const allowed = id === 'xietianzi' ? g.aliveSeats.slice() : g.aliveSeats.filter((s) => s !== seat);
          beginPick('blood', allowed, 1, (sel) => act('skill', sel[0], { skill: id, target: sel[0] }));
          renderRoom();
        });
      }
      row.append(btn);
    });
    wrap.append(row);
  }
  els.actionArea.append(wrap);
  return false;
}

function renderDayPanel(seat, role) {
  if (g.blood && renderBloodDayActions(seat)) return;
  if (!submittedHelp('day') && renderExplodePick(seat, role)) return;
  if (role === 'knight' && !g.knightUsed && !submittedHelp('day')) {
    if (pick && pick.kind === 'duel') {
      els.actionArea.append(note('骑士决斗：对方是狼人则对方出局并直接天黑；对方是好人则你出局。'));
      els.actionArea.append(pickButtons((sel) => act('day', sel[0], { duel: sel[0] })));
    } else {
      els.actionArea.append(makeBtn('翻牌决斗', 'btn-primary', () => {
        beginPick('duel', g.aliveSeats.filter((s) => s !== seat), 1, (sel) => act('day', sel[0], { duel: sel[0] }));
        renderRoom();
      }));
      els.actionArea.append(note('白天可以发起一次决斗，投票前使用。'));
    }
  }
  if (!submittedHelp('day')) appendExplodeButtons(seat, role);
  if (!els.actionArea.childElementCount) {
    const speaker = currentSpeaker();
    els.actionArea.append(note(speaker === seat
      ? '轮到你发言：在右侧输入，可连发多条，说完点「结束发言」。'
      : `按固定顺序发言，等待 ${speaker != null ? `${pad(speaker)} 号` : '下一位'}；还没轮到你时也可以先在右侧打字，轮到你自动发出。`));
  }
}

function renderVotePanel(seat, role) {
  if (g.voteBanned.includes(seat)) {
    els.actionArea.append(note('你已失去投票权。'));
    return;
  }
  if (renderExplodePick(seat, role)) return;
  if (submittedHelp(g.step)) {
    els.actionArea.append(note('已投票，等待其他玩家…'));
    appendExplodeButtons(seat, role);
    return;
  }
  let allowed = g.aliveSeats.filter((s) => s !== seat);
  if (g.phase === 'runoff' && g.runoffSeats) {
    allowed = allowed.filter((s) => g.runoffSeats.includes(s));
  }
  if (!pick || pick.kind !== 'vote') {
    beginPick('vote', allowed, 1, (sel) => act(g.step, sel[0]));
  }
  els.actionArea.append(note(g.phase === 'runoff'
    ? `PK 投票：只能在 ${g.runoffSeats.map(pad).join('、')} 号中选择。`
    : '投票：点击座位选择你要放逐的人，不能投自己。'));
  els.actionArea.append(pickButtons((sel) => act(g.step, sel[0])));
  els.actionArea.append(makeBtn('弃权', 'btn-outline-secondary', () => act(g.step, -1)));
  appendExplodeButtons(seat, role);
}

function renderSheriffPanel(seat) {
  const step = g.step;
  if (g.pendingDead) {
    els.actionArea.append(note('你昨夜已出局，死讯将在竞选结束后公布；本轮不能上警或投票。'));
    return;
  }
  if (step === 'policeSignup') {
    if (!isAliveSeat(seat)) {
      els.actionArea.append(note('你已出局，只能旁观警长竞选。'));
      return;
    }
    if (submittedHelp('policeSignup')) {
      els.actionArea.append(note('已选择，等待其他玩家…'));
      return;
    }
    els.actionArea.append(note('警长竞选：上警后要发言，再接受没上警的玩家投票；不想当请点「不上警」。'));
    els.actionArea.append(makeBtn('上警', 'btn-danger', () => act('policeSignup', null, { run: true })));
    els.actionArea.append(makeBtn('不上警', 'btn-outline-secondary', () => act('policeSignup', null, { run: false })));
    return;
  }
  if (step === 'policeSpeech') {
    const order = g.policeOrder || [];
    const cand = order[g.policeIndex];
    if (cand == null) {
      els.actionArea.append(note('候选人发言结束，准备警下投票…'));
      return;
    }
    if (cand !== seat) {
      els.actionArea.append(note(`等待 ${pad(cand)} 号候选人发言（第 ${g.policeIndex + 1} / ${order.length} 位）`));
      return;
    }
    if (submittedHelp('policeSpeech')) {
      els.actionArea.append(note('已结束竞选发言，等待下一位…'));
      return;
    }
    els.actionArea.append(note('轮到你竞选发言：在右侧输入，可连发多条，说完点「结束发言」。'));
    els.actionArea.append(makeBtn('结束发言', 'btn-warning', () => act('policeSpeech', null, { turn: g.policeIndex })));
    return;
  }
  if (submittedHelp(g.step)) {
    els.actionArea.append(note('已投票，等待其他警下玩家…'));
    return;
  }
  const cands = (step === 'policeRunoff' ? g.runoffSeats : g.sheriffCandidates).filter(isAliveSeat);
  if (g.sheriffCandidates.includes(seat)) {
    els.actionArea.append(note('你是警长候选人，不能参与警下投票。'));
    return;
  }
  if (!isAliveSeat(seat)) {
    els.actionArea.append(note('你已出局，不能投票。'));
    return;
  }
  if (!pick || pick.kind !== 'police' || pick.key !== `${g.step}:${cands.join(',')}`) {
    beginPick('police', cands, 1, (sel) => act(g.step, sel[0]));
    pick.key = `${g.step}:${cands.join(',')}`;
  }
  els.actionArea.append(note(`警下投票：从 ${cands.map(pad).join('、')} 号里选一人当警长。`));
  els.actionArea.append(pickButtons((sel) => act(g.step, sel[0])));
  els.actionArea.append(makeBtn('弃权', 'btn-outline-secondary', () => act(g.step, -1)));
}

function renderOrderPanel(seat) {
  if (g.sheriff !== seat) {
    els.actionArea.append(note(`等待警长 ${pad(g.sheriff)} 号决定发言方向…`));
    return;
  }
  if (submittedHelp('order')) {
    els.actionArea.append(note('已选择，等待开始发言…'));
    return;
  }
  els.actionArea.append(note('你是警长：选择今天顺时针还是逆时针发言，其他玩家从你的下家按该方向依次发言，你最后一个发言。'));
  els.actionArea.append(makeBtn('顺时针', 'btn-primary', () => act('order', null, { dir: 'cw' })));
  els.actionArea.append(makeBtn('逆时针', 'btn-primary', () => act('order', null, { dir: 'ccw' })));
}

function renderLastWordsPanel(seat) {
  if (g.lastWordsSeat !== seat) {
    els.actionArea.append(note(g.lastWordsSeat != null ? `等待 ${pad(g.lastWordsSeat)} 号发表遗言…` : '遗言结束…'));
    return;
  }
  if (submittedHelp('lastwords')) {
    els.actionArea.append(note('遗言已结束。'));
    return;
  }
  els.actionArea.append(note('你可以发表遗言：在右侧输入，可连发多条；说完点「说完了」。'));
  els.actionArea.append(makeBtn('说完了', 'btn-warning', () => act('lastwords', null, { end: true })));
}

function renderBadgePanel(seat) {
  if (g.badgePending !== seat) {
    els.actionArea.append(note('等待警长移交警徽…'));
    return;
  }
  if (submittedHelp('badge')) {
    els.actionArea.append(note('已处理，等待结算…'));
    return;
  }
  if (!pick || pick.kind !== 'badge') {
    beginPick('badge', g.aliveSeats.slice(), 1, (sel) => act('badge', sel[0]));
  }
  els.actionArea.append(note('你已出局：可以把警徽移交给一名存活玩家，点座位选人后确认；也可以撕掉警徽。'));
  els.actionArea.append(pickButtons((sel) => act('badge', sel[0])));
  els.actionArea.append(makeBtn('撕掉警徽（不移交）', 'btn-outline-secondary', () => act('badge', -1)));
}

function renderHunterPanel(seat) {
  const isBoss = myRow?.role === 'wolfboss';
  const label = isBoss ? '狼王' : '猎人';
  if (submittedHelp('hunter')) {
    els.actionArea.append(note('已选择，等待结算…'));
    return;
  }
  if (pick && pick.kind === 'hunter') {
    els.actionArea.append(note(`请选择目标并确认翻牌，或选择「翻牌但不带走」。确认前身份仍保密。`));
    els.actionArea.append(pickButtons((sel) => act('hunter', sel[0], { reveal: true })));
    els.actionArea.append(makeBtn('翻牌但不带走', 'btn-outline-secondary', () => {
      pick = null;
      act('hunter', null, { reveal: true });
    }));
    els.actionArea.append(makeBtn('返回', 'btn-outline-secondary', () => {
      pick = null;
      renderRoom();
    }));
    return;
  }
  els.actionArea.append(note(`你已出局。翻牌会公开你的${label}身份并可以带走一人；不翻牌则身份保密。`));
  els.actionArea.append(makeBtn('翻牌（可以带走一人）', 'btn-danger', () => {
    beginPick('hunter', g.aliveSeats.slice(), 1, (sel) => act('hunter', sel[0], { reveal: true }));
    renderRoom();
  }));
  els.actionArea.append(makeBtn('不翻牌（不发动）', 'btn-outline-secondary', () => act('hunter', null, { reveal: false })));
}

function renderMyBar() {
  const roleKey = myRow?.role;
  const seat = myRow?.seat;
  if (!g || !roleKey) {
    els.myBar.hidden = true;
    els.roleCard.hidden = true;
    return;
  }
  const role = ROLES[roleKey] || { name: roleKey, camp: 'civilian', campName: '', skill: '' };
  const camp = CAMPS[role.camp] || CAMPS.civilian;

  els.myBar.hidden = false;
  els.myBar.className = `sr-me mb-3 ${camp.bar}`.trim();
  els.mySeat.textContent = seat ? `座位 ${pad(seat)}` : '座位 —';
  els.revealBtn.textContent = roleShown ? '收起身份牌' : '查看我的身份牌';

  els.roleCard.className = `card mb-3 sr-rolecard ${role.camp === 'killer' ? 'sr-rolecard-killer' : role.camp === 'police' ? 'sr-rolecard-police' : 'sr-rolecard-neutral'}`.trim();
  els.roleTag.className = `sr-tag ${camp.tag}`;
  els.roleTag.textContent = role.name;
  els.roleName.textContent = role.name;
  els.roleCamp.textContent = role.campName || camp.name;
  els.roleSkill.textContent = role.skill;
  if (role.explode) {
    els.roleExplode.hidden = false;
    els.roleExplode.textContent = role.explode === '不可以'
      ? '本角色不能自爆'
      : `白天可自爆${role.explode === '可以（可带一人）' ? '（可带一人）' : ''}`;
    els.roleExplode.classList.toggle('sr-explode-no', role.explode === '不可以');
  } else {
    els.roleExplode.hidden = true;
    els.roleExplode.textContent = '';
    els.roleExplode.classList.remove('sr-explode-no');
  }
  els.roleCard.hidden = !roleShown;

  els.myBar.querySelector('.sr-blood-mini')?.remove();
  if (g.blood && seat != null && g.blood.hp?.[seat] != null) {
    const bm = g.blood;
    const mini = document.createElement('span');
    mini.className = 'sr-blood-mini';
    const parts = [
      `气血 ${bm.hp[seat]}/${bm.maxHp || 4}`,
      `金币 ${bm.gold[seat] ?? 0}`,
      `${bm.star[seat] || 1} 星`,
      `碎片 ${bm.shards?.[seat] ?? 0}`,
    ];
    parts.forEach((text) => {
      const item = document.createElement('span');
      item.textContent = text;
      mini.append(item);
    });
    if (bm.equipment?.[seat]) {
      const eq = document.createElement('span');
      eq.textContent = Blood?.EQUIPMENT?.[bm.equipment[seat]]?.name || bm.equipment[seat];
      mini.append(eq);
    }
    const skills = bm.skills?.[seat] || [];
    if (skills.length) {
      const sk = document.createElement('span');
      sk.textContent = `技能：${skills.map((id) => Blood?.SKILLS?.[id]?.name || id).join('、')}`;
      mini.append(sk);
    }
    els.myBar.append(mini);
  }

  const extras = [];
  if (g.lovers && seat != null) {
    if (g.lovers.includes(seat)) {
      const partner = g.lovers[0] === seat ? g.lovers[1] : g.lovers[0];
      const cross = g.mixedLovers;
      extras.push(`你的情侣是 ${pad(partner)} 号${cross ? '（人狼情侣，第三方阵营）' : ''}`);
    }
    if (roleKey === 'cupid') {
      extras.push(`你连的情侣：${pad(g.lovers[0])} 号 与 ${pad(g.lovers[1])} 号`);
    }
  }
  if (Rules.isWolfRole(roleKey)) {
    const mates = g.teams.wolves.filter((s) => s !== seat);
    if (mates.length) extras.push(`狼队友：${mates.map(pad).join('、')} 号`);
  }
  if (roleKey === 'seer' && g.checks?.length) {
    const mine = g.checks.filter((check) => check.seat === seat);
    if (mine.length) {
      extras.push(`验人：${mine.map((check) => {
        let text = `${pad(check.target)} 号${check.killer ? '狼人' : '好人'}`;
        if (check.role) text += `（${ROLES[check.role]?.name || check.role}）`;
        if (check.hasTao) text += '，有桃';
        if (check.gold != null) text += `，${check.gold} 金`;
        return text;
      }).join('，')}`);
    }
  }
  els.roleExtra.hidden = extras.length === 0;
  els.roleExtra.textContent = extras.join('；');
}

function renderModeInfo(mode) {
  const title = document.createElement('div');
  title.className = 'd-flex justify-content-between align-items-baseline';
  const strong = document.createElement('strong');
  strong.textContent = mode.name;
  const need = document.createElement('span');
  need.className = 'text-muted';
  need.textContent = `需 ${mode.roles.length} 人`;
  title.append(strong, need);

  const counts = {};
  const order = [];
  mode.roles.forEach((key) => {
    if (!counts[key]) { counts[key] = 0; order.push(key); }
    counts[key] += 1;
  });
  const list = document.createElement('div');
  list.className = 'mt-2';
  order.forEach((key) => {
    const role = ROLES[key];
    const tag = document.createElement('span');
    tag.className = `sr-tag ${CAMPS[role.camp]?.tag || ''} mr-1`;
    tag.textContent = role.name;
    list.append(tag);
    const num = document.createElement('span');
    num.className = 'mr-2';
    num.textContent = `×${counts[key]}`;
    list.append(num);
  });

  const desc = document.createElement('p');
  desc.className = 'text-muted mb-0 mt-2';
  desc.textContent = mode.desc;

  els.modeInfo.replaceChildren(title, list, desc);
  if (mode.play) {
    const play = document.createElement('p');
    play.className = 'small mb-0 mt-2';
    play.textContent = `玩法：${mode.play}`;
    els.modeInfo.append(play);
  }
}

function renderGameOver() {
  const show = Boolean(g && g.phase === 'finished');
  els.gameOverCard.hidden = !show;
  els.replayBtn.hidden = !(show && isHost());
  els.watchReplayBtn.hidden = !show || !g.replayId;
  if (!show) return;

  const winner = g.winner;
  const label = winner === 'wolf' ? '狼人阵营获胜' : winner === 'lovers' ? '第三方阵营获胜' : '好人阵营获胜';
  els.winnerText.className = `sr-winner ${winner === 'wolf' ? 'sr-winner-wolf' : winner === 'lovers' ? 'sr-winner-lovers' : ''}`.trim();
  els.winnerText.textContent = `${label} · ${g.winReason || ''}`;
  els.resultNote.textContent = g.rating?.unrated
    ? `共 ${g.day} 天 · 自定义房间不计入 Elo`
    : g.rating
    ? `共 ${g.day} 天 · 评分 K=${g.rating.k} · 按昵称永久保存，零和结算`
    : `共 ${g.day} 天 · 无评分记录`;

  const detail = new Map((g.rating?.players || []).map((item) => [item.seat, item]));
  const rows = members.slice();
  rows.sort((a, b) => (a.seat || 99) - (b.seat || 99));
  const frag = document.createDocumentFragment();
  rows.forEach((row) => {
    const item = detail.get(row.seat);
    const tr = document.createElement('tr');
    const seatTd = document.createElement('td');
    seatTd.textContent = row.seat ? pad(row.seat) : '—';
    const nameTd = document.createElement('td');
    nameTd.textContent = row.name || '';
    if (row.is_bot) {
      const bot = document.createElement('span');
      bot.className = 'badge badge-info ml-2';
      bot.textContent = '人机';
      nameTd.append(bot);
    }
    const roleTd = document.createElement('td');
    roleTd.className = 'sr-role-tagcell';
    const role = ROLES[row.role];
    if (role) {
      const tag = document.createElement('span');
      tag.className = `sr-tag ${CAMPS[role.camp]?.tag || ''}`;
      tag.textContent = role.name;
      roleTd.append(tag);
    } else {
      roleTd.textContent = '—';
    }

    const lastDeath = (g.deaths || []).filter((death) => death.seat === row.seat).slice(-1)[0];
    const death = item?.death || lastDeath || null;
    const win = item ? item.win : (row.won ?? null);
    const resultTd = document.createElement('td');
    if (win == null) {
      resultTd.textContent = '—';
      resultTd.className = 'text-muted';
    } else {
      const tag = document.createElement('span');
      tag.className = win ? 'sr-win' : 'sr-lose';
      tag.textContent = win ? '胜利' : '失败';
      resultTd.append(tag);
    }

    const deathTd = document.createElement('td');
    deathTd.className = 'text-muted';
    deathTd.textContent = death
      ? `第 ${death.day} 天 ${DEATH_SHORT[death.reason] || ''}`.trim()
      : '存活到最后';

    const votesTd = document.createElement('td');
    votesTd.textContent = item
      ? item.votesReceived
      : (g.voteHistory || []).reduce((sum, vote) => sum + (vote.counts?.[row.seat] || 0), 0);

    const ratingTd = document.createElement('td');
    const current = ratings.get(row.name);
    if (row.is_bot) {
      ratingTd.className = 'text-muted';
      ratingTd.textContent = '人机不计分';
    } else if (item) {
      ratingTd.className = item.delta >= 0 ? 'sr-delta-up' : 'sr-delta-down';
      ratingTd.textContent = `${item.before} → ${item.after}（${item.delta >= 0 ? '+' : ''}${item.delta}）`;
    } else if (g.rating?.unrated) {
      ratingTd.className = 'text-muted';
      ratingTd.textContent = '本局不计分';
    } else {
      ratingTd.textContent = current ? `${current}（本局未结算）` : '—';
    }

    tr.append(seatTd, nameTd, roleTd, resultTd, deathTd, votesTd, ratingTd);
    frag.append(tr);
  });
  els.revealBody.replaceChildren(frag);
}

function updateChatForm() {
  const alive = isAliveSeat(myRow?.seat);
  const speaker = currentSpeaker();
  if (g && preSpeech.msgs.length && (preSpeech.day !== g.day || preSpeech.matchId !== g.matchId)) clearPreSpeech();
  const wolfNight = Boolean(g) && g.phase === 'night' && isMyWolf() && alive;
  const speechDone = Boolean(g) && submitted.has(`${g.day}:speech`);
  const myTurn = myDiscussionTurn();
  const preTurn = Boolean(g) && g.phase === 'day' && alive && !myTurn && !speechDone && canPreInput();
  const policeTurn = Boolean(g) && g.phase === 'sheriff' && g.step === 'policeSpeech'
    && (g.policeOrder || [])[g.policeIndex] === myRow?.seat
    && !submitted.has(`${g.day}:policeSpeech`);
  const lastTurn = Boolean(g) && g.phase === 'lastwords' && g.lastWordsSeat === myRow?.seat
    && !submitted.has(`${g.day}:lastwords`);
  const canChat = !currentAction() && (wolfNight || myTurn || preTurn || policeTurn || lastTurn);
  const pending = myTurn ? pendingSpeechCount() : 0;
  const submitBtn = els.chatForm.querySelector('button[type="submit"]');

  els.chatInput.disabled = !canChat;
  submitBtn.disabled = !canChat;
  submitBtn.textContent = preTurn ? '排队' : '发送';
  els.chatInput.placeholder = preTurn
    ? '还没轮到你，可以先打字，轮到你时自动发出'
    : lastTurn ? '输入遗言（回车发送）' : '输入发言（回车发送）';
  els.endSpeechBtn.hidden = !myTurn;
  els.endSpeechBtn.disabled = speechDone || preFlushing || Boolean(currentAction()) || (pending > 0 && !preSpeech.paused);
  els.endSpeechBtn.textContent = pending && preSpeech.paused ? '放弃待发并结束' : '结束发言';
  els.retrySpeechBtn.hidden = !(pending && preSpeech.paused);
  els.retrySpeechBtn.disabled = !canChat || preFlushing;

  if (myTurn && pending && !preSpeech.paused && !preFlushing && !currentAction()) queueMicrotask(flushPreSpeech);

  if (!g) {
    els.chatTitle.textContent = '白天发言';
    els.chatNote.textContent = '';
    return;
  }
  if (g.phase === 'night') {
    els.chatTitle.textContent = '狼人夜间频道';
    els.chatNote.textContent = isMyWolf()
      ? (alive ? '仅狼人可见 · 可随时交流' : '仅狼人可见 · 你已出局')
      : '夜晚不能发言';
    return;
  }
  els.chatTitle.textContent = '白天发言';
  if (g.phase === 'finished') {
    els.chatNote.textContent = '对局已结束';
  } else if (g.phase === 'day') {
    if (!alive) els.chatNote.textContent = '你已出局，只能旁观';
    else if (myTurn) {
      els.chatNote.textContent = `轮到你（第 ${g.speechIndex + 1} / ${g.speechOrder?.length || 0} 位）${pending ? ` · ${preSpeech.paused ? '发送暂停' : '依次发送'}（${pending} 条待发）` : ''}`;
    } else if (speaker === myRow?.seat) els.chatNote.textContent = '已结束发言，等待下一位';
    else if (preTurn) {
      els.chatNote.textContent = `等待 ${pad(speaker)} 号发言 · 可提前打字${pendingSpeechCount() ? `，已排队 ${pendingSpeechCount()} 条` : ''}`;
    } else if (speaker != null) els.chatNote.textContent = `等待 ${pad(speaker)} 号发言`;
    else els.chatNote.textContent = '发言结束，准备投票';
  } else if (g.phase === 'sheriff') {
    els.chatTitle.textContent = '竞选发言';
    if (g.step === 'policeSpeech') {
      const cand = (g.policeOrder || [])[g.policeIndex];
      els.chatNote.textContent = cand == null
        ? '候选人发言结束'
        : (cand === myRow?.seat ? '轮到你竞选发言' : `等待 ${pad(cand)} 号候选人发言`);
    } else {
      els.chatNote.textContent = '警长竞选进行中，暂时不能发言';
    }
  } else if (g.phase === 'order') {
    els.chatTitle.textContent = '警长定顺序';
    els.chatNote.textContent = '等待警长选择发言方向';
  } else if (g.phase === 'lastwords') {
    els.chatTitle.textContent = '遗言';
    els.chatNote.textContent = g.lastWordsSeat == null
      ? '遗言结束'
      : (g.lastWordsSeat === myRow?.seat ? '轮到你发表遗言（可连发多条）' : `等待 ${pad(g.lastWordsSeat)} 号发表遗言`);
  } else if (g.phase === 'badge') {
    els.chatTitle.textContent = '警徽移交';
    els.chatNote.textContent = '等待警长处理警徽';
  } else if (g.phase === 'vote' || g.phase === 'runoff') {
    els.chatNote.textContent = '投票中不能发言';
  } else if (settling(g)) {
    els.chatNote.textContent = '等待结算';
  } else {
    els.chatNote.textContent = '天亮了，等待公布结果';
  }
}

function exitRoomLocal(message) {
  if (!session) return;
  const old = session;
  clearRoomViews();
  // Another tab may have already rejoined and saved its new membership.
  const key = membershipKey();
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      const record = JSON.parse(saved);
      if (record?.code === old.code && record.playerId === old.playerId) localStorage.removeItem(key);
    } catch { /* Not this membership's record. */ }
  }
  showHome();
  setStatus(message);
  toast(message);
}

function friendlyError(error) {
  const message = String(error?.message || error || '未知错误');
  if (/JWT|401|invalid token|not authenticated/i.test(message)) return '登录状态异常，请重新登录';
  if (/fetch|network|Load failed|Failed to fetch/i.test(message)) {
    return '网络连不上服务器，检查加速器后重试';
  }
  if (/does not exist|schema cache|42703|42P01|PGRST205|permission denied|row-level security/i.test(message)) {
    return '操作不可用，请确认账号已通过审核，或联系站长按 DEPLOYMENT.md 检查 v8 部署。';
  }
  return message;
}

els.createBtn.addEventListener('click', async () => {
  if (busy) return;
  if (!guardClient()) return;
  const name = readName();
  if (!name) return;
  setBusy(true);
  try {
    await createRoom();
  } catch (error) {
    toast(friendlyError(error));
  } finally {
    setBusy(false);
  }
});

els.joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  if (!guardClient()) return;
  const name = readName();
  if (!name) return;
  const code = els.codeInput.value.trim();
  if (!/^\d{6}$/.test(code)) {
    toast('请输入 6 位数字房间码');
    return;
  }
  setBusy(true);
  try {
    await joinRoom(name, code);
  } catch (error) {
    toast(friendlyError(error));
  } finally {
    setBusy(false);
  }
});

els.copyBtn.addEventListener('click', async () => {
  if (!session) return;
  try {
    await navigator.clipboard.writeText(session.code);
    toast('房间码已复制');
  } catch {
    toast(`复制失败，房间码是 ${session.code}`);
  }
});

els.copyInviteBtn.addEventListener('click', async () => {
  if (!session) return;
  const url = new URL(roomUrl(session.code), location.href).toString();
  try {
    await navigator.clipboard.writeText(url);
    toast('邀请链接已复制，朋友打开会自动填好房号');
  } catch {
    toast(`复制失败，邀请链接是 ${url}`);
  }
});

els.revealBtn.addEventListener('click', () => {
  roleShown = !roleShown;
  renderMyBar();
  if (roleShown) els.roleCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

els.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!g || currentAction()) return;
  const text = els.chatInput.value.trim();
  if (!text) return;
  const seat = myRow?.seat;
  if ((g.phase === 'lastwords' && g.lastWordsSeat === seat) ||
      (g.step === 'policeSpeech' && g.policeOrder[g.policeIndex] === seat && isAliveSeat(seat))) {
    els.chatInput.value = '';
    act('chat', null, {text});
    return;
  }
  if (!isAliveSeat(seat)) return;
  if (g.phase === 'night' && isMyWolf()) {
    els.chatInput.value = '';
    act('wolfchat', null, { text });
    return;
  }
  if ((myDiscussionTurn() || canPreInput()) && queueSpeech(text)) els.chatInput.value = '';
});

els.retrySpeechBtn.addEventListener('click', () => {
  if (!myDiscussionTurn() || currentAction() || !preSpeech.paused) return;
  preSpeech.paused = false;
  savePreSpeech();
  flushPreSpeech();
});

els.endSpeechBtn.addEventListener('click', async () => {
  if (!myDiscussionTurn() || preFlushing || currentAction()) return;
  const active = session, queue = preSpeech, discard = pendingSpeechCount() > 0;
  if (discard && (!queue.paused || !window.confirm('放弃待发消息并结束本轮发言？'))) return;
  if (await act('speech', null, { turn: g.speechIndex }) && discard && session === active && preSpeech === queue) {
    clearPreSpeech();
    renderChat();
    updateChatForm();
  }
});

els.leaveBtn.addEventListener('click', () => {
  leaveRoom().catch((error) => toast(friendlyError(error)));
});

els.replayBtn.addEventListener('click', () => {
  replayGame().catch((error) => toast(friendlyError(error)));
});

els.watchReplayBtn.addEventListener('click', () => {
  if (g?.replayId) openReplay(g.replayId).catch((error) => toast(friendlyError(error)));
});

els.spectateBtn.addEventListener('click', () => {
  const code = els.codeInput.value.trim();
  openSpectate(code).catch((error) => toast(friendlyError(error)));
});

document.querySelector('#roomLobby').addEventListener('click', showHome);
const otherSpectateForm = document.querySelector('#otherSpectate');
otherSpectateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  openSpectate(document.querySelector('#otherRoomCode').value.trim()).catch(error => toast(friendlyError(error)));
});
els.retrySettlement.addEventListener('click', () => retrySettlement().catch(error => toast(friendlyError(error))));
els.spectateExit.addEventListener('click', exitSpectate);

els.spectateReplayBtn.addEventListener('click', () => {
  if (spectate?.g?.replayId) openReplay(spectate.g.replayId).catch((error) => toast(friendlyError(error)));
});

els.replayBack.addEventListener('click', () => {
  replayData = null;
  showHome();
});

els.historyRefresh.addEventListener('click', () => {
  loadHistory();
});

els.replayFilters.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-filter]');
  if (!btn) return;
  replayFilter = btn.dataset.filter;
  renderReplayTimeline();
  els.replayFilters.querySelectorAll('button').forEach((item) => {
    item.classList.toggle('btn-dark', item.dataset.filter === replayFilter);
    item.classList.toggle('btn-outline-dark', item.dataset.filter !== replayFilter);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeAccountMenu();
  if (els.customModal && !els.customModal.hidden) closeCustomModal();
  if (els.authModal && !els.authModal.hidden && profile) closeAuthModal();
});

els.modeSelect.addEventListener('change', updateModeHint);
els.customRoomBtn.addEventListener('click', openCustomModal);
els.customClose.addEventListener('click', closeCustomModal);
els.customModal.querySelector('[data-custom-close]').addEventListener('click', closeCustomModal);
els.customReset.addEventListener('click', () => {
  resetCustomCounts();
  customStatus('');
});
els.customSkillsToggle.addEventListener('click', () => {
  const show = els.customSkillList.hidden;
  els.customSkillList.hidden = !show;
  els.customSkillsToggle.textContent = show ? '收起角色技能' : '查看角色技能';
});
els.customCreate.addEventListener('click', createCustomRoom);
els.customSheriff.addEventListener('change', () => customStatus(''));
els.customName.addEventListener('input', () => customStatus(''));

document.querySelector('#heroStart').addEventListener('click', (event) => {
  event.preventDefault();
  if (session) {
    backToRoom();
    return;
  }
  if (!accountApproved()) {
    openAuthModal();
    els.loginName.focus({ preventScroll: true });
    return;
  }
  els.startCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  els.nameInput.focus({ preventScroll: true });
});

document.querySelector('.navbar a[href="#start"]').addEventListener('click', (event) => {
  event.preventDefault();
  if (session) {
    backToRoom();
    return;
  }
  if (!accountApproved()) {
    openAuthModal();
    return;
  }
  els.startCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.querySelector('.navbar a[href="#historyCard"]').addEventListener('click', (event) => {
  event.preventDefault();
  if (els.homeView.hidden) showHome();
  if (!accountApproved()) {
    openAuthModal();
    return;
  }
  loadHistory();
  els.historyCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

els.backToRoomBtn.addEventListener('click', backToRoom);

els.accountBtn.addEventListener('click', () => {
  if (!profile) {
    openAuthModal();
    return;
  }
  els.accountMenu.hidden = !els.accountMenu.hidden;
});

els.accountAdminBtn.addEventListener('click', () => {
  closeAccountMenu();
  if (session) showHome();
  if (isAdminAccount()) {
    if (pendingCount > 0) {
      document.querySelector('#adminFilter').value = 'pending';
      adminPage = 0;
    }
    loadAdmin();
    checkPending().catch(() => {});
  }
  els.adminCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

els.pendingBadge.addEventListener('click', () => {
  closeAccountMenu();
  if (session) showHome();
  if (isAdminAccount()) {
    document.querySelector('#adminFilter').value = 'pending';
    adminPage = 0;
    loadAdmin();
  }
  els.adminCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

els.accountRefreshBtn.addEventListener('click', () => {
  closeAccountMenu();
  manualRefreshAccount();
});

document.addEventListener('click', (event) => {
  if (!els.accountMenu || els.accountMenu.hidden) return;
  if (els.accountBtn.contains(event.target) || els.accountMenu.contains(event.target)) return;
  closeAccountMenu();
});

els.authClose.addEventListener('click', closeAuthModal);
els.authModal.querySelectorAll('[data-auth-close]').forEach((node) => {
  node.addEventListener('click', closeAuthModal);
});

els.authCard.querySelectorAll('[data-auth-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.authTab;
    els.authCard.querySelectorAll('[data-auth-tab]').forEach((item) => {
      item.classList.toggle('active', item === btn);
    });
    els.loginForm.hidden = tab !== 'login';
    els.registerForm.hidden = tab !== 'register';
  });
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (authBusy || !guardClient()) return;
  const name = els.loginName.value.trim();
  const pass = els.loginPass.value;
  if (!NAME_RE.test(name)) {
    toast('用户名是 2–12 位中文、字母、数字或下划线');
    return;
  }
  if (!pass) {
    toast('请输入密码');
    return;
  }
  authBusy = true;
  setStatus('登录中…');
  setAuthNote('登录中…');
  try {
    const email = await emailFor(name);
    const { error } = await client.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    localStorage.setItem(NAME_KEY, name);
    setAuthNote('');
    await fetchProfileAndRoute();
  } catch (error) {
    const reason = friendlyAuthError(error);
    setStatus(`登录失败 · ${reason}`);
    setAuthNote(`登录失败：${reason}`);
    toast(reason);
  } finally {
    authBusy = false;
  }
});

els.registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (authBusy || !guardClient()) return;
  const name = els.regName.value.trim();
  const pass = els.regPass.value;
  const pass2 = els.regPass2.value;
  if (!NAME_RE.test(name)) {
    toast('用户名需 2–12 位中文、字母、数字或下划线');
    return;
  }
  if (pass.length < 6) {
    toast('密码至少 6 位');
    return;
  }
  if (pass !== pass2) {
    toast('两次输入的密码不一致');
    return;
  }
  authBusy = true;
  setStatus('注册中…');
  setAuthNote('注册中…');
  try {
    const email = await emailFor(name);
    const { data: taken, error: takenError } = await client.rpc('username_taken', { name });
    if (takenError) throw takenError;
    if (taken) throw new Error('这个用户名已经被注册了');
    const { data: signData, error: signError } = await client.auth.signUp({ email, password: pass, options: { data: { wolf_username: name } } });
    if (signError) throw signError;
    if (!signData.session) {
      throw new Error('账号已创建但未取得登录态，请联系站长检查邮箱确认设置后重新登录。');
    }
    localStorage.setItem(NAME_KEY, name);
    await fetchProfileAndRoute();
    toast('注册成功，等待审核');
  } catch (error) {
    const reason = friendlyAuthError(error);
    setStatus(`注册失败 · ${reason}`);
    setAuthNote(`注册失败：${reason}`);
    toast(reason);
  } finally {
    authBusy = false;
  }
});

async function manualRefreshAccount() {
  if (!guardClient() || authBusy) return;
  authBusy = true;
  try {
    await fetchProfileAndRoute();
  } catch (error) {
    const reason = friendlyAuthError(error);
    setAuthNote(reason);
    toast(reason);
  } finally {
    authBusy = false;
  }
}

els.refreshStatusBtn.addEventListener('click', manualRefreshAccount);
els.pendingRefresh.addEventListener('click', manualRefreshAccount);
document.querySelector('#adminFilter').addEventListener('change',()=>{ adminPage=0; loadAdmin(); });
document.querySelector('#adminPrev').addEventListener('click',()=>{ adminPage=Math.max(0,adminPage-1); loadAdmin(); });
document.querySelector('#adminNext').addEventListener('click',()=>{ adminPage++; loadAdmin(); });
els.adminRefresh.addEventListener('click', () => {
  if (!isAdminAccount()) return;
  loadAdmin();
});

async function doLogout() {
  if (authBusy) return;
  if (session) {
    toast('对局进行中，先点「返回对局」继续；要退出请先结束或离开房间');
    return;
  }
  authBusy = true;
  try {
    stopPendingPoll();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    // SIGNED_OUT clears the old view; don't wipe a more recent login or another tab's seat.
    if (authUserId !== null) return;
    els.loginForm.reset();
    els.registerForm.reset();
    setStatus('已退出登录 · 请重新登录');
    setAuthNote('已退出登录，请重新登录');
  } catch (error) {
    toast(friendlyError(error));
  } finally {
    authBusy = false;
  }
}

els.logoutBtn.addEventListener('click', doLogout);
els.accountLogoutBtn.addEventListener('click', () => {
  closeAccountMenu();
  doLogout();
});

els.codeInput.addEventListener('input', () => {
  els.codeInput.value = els.codeInput.value.replace(/\D/g, '').slice(0, 6);
});

els.nameInput.addEventListener('input', () => {
  if (leaderboardData.length) renderLeaderboard();
});

function guardClient() {
  if (client) return true;
  toast('服务器还没配置好，稍等主人填一下地址');
  return false;
}

function onAuthChange(event, sdkSession) {
  const id = sdkSession?.user?.id;
  if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !id)) {
    showAuthScreen();
    return;
  }
  if (!id || id === authUserId) return; // same user: token refresh/refocus is not a logout
  if (authUserId !== null || (profile && profile.id !== id)) {
    clearAuthViews(); // synchronous: no old frame or outstanding response survives a switch
  } else ++authEpoch;
  authUserId = id;
  authChecking = true;
  applyAccountUI();
  closeAuthModal();
  setStatus('正在恢复登录状态…');
  const epoch = authEpoch;
  // Supabase holds its auth lock during callbacks. Defer all SDK reads until it releases it.
  setTimeout(() => {
    if (epoch !== authEpoch || profile?.id === id) return;
    fetchProfileAndRoute().catch(error => {
      if (epoch === authEpoch) showAuthProblem('读取账号失败', friendlyAuthError(error));
    });
  }, 0);
}

function boot() {
  fillModeSelect();

  const savedName = localStorage.getItem(NAME_KEY);
  if (savedName) {
    els.loginName.value = savedName;
    els.regName.value = savedName;
  }

  const params = new URLSearchParams(location.search);
  const pathRoom = location.pathname.match(/\/games\/(\d{6})\/?$/);
  const fromUrl = params.get('room') || (pathRoom ? pathRoom[1] : '');
  if (fromUrl && /^\d{6}$/.test(fromUrl)) {
    pendingInviteCode = fromUrl;
    els.codeInput.value = fromUrl;
    if (els.inviteHint) {
      els.inviteHint.textContent = `朋友邀请你加入房间 ${fromUrl}，房号已填好；登录后点「加入房间」即可。`;
      els.inviteHint.hidden = false;
    }
  }

  if (!client) {
    setStatus('服务器未配置 · 等待 js/config.js 填入 Supabase 地址');
    applyAccountUI();
    return;
  }

  setStatus('正在恢复登录状态…');
  applyAccountUI();
  // INITIAL_SESSION also handles startup; don't race it with a separate getSession().
  client.auth.onAuthStateChange(onAuthChange);
}

boot();
