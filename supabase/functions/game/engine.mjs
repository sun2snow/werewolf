// One engine per locked room transaction. No DOM, database or module-level game state.
import { civicPhase, civicScenes, speechOrder } from './civic.mjs';
import { TURN_MS as DEFAULT_TURN_MS, turnClock } from './turn-clock.mjs';
import '../_shared/rules.js';
import '../_shared/modes.js';
import '../_shared/bloodmoon.js';
export const Rules = globalThis.WolfRules;
export const { MODES, CUSTOM_ORDER, CUSTOM_LIMITS, buildCustomMode, modeFromOptions } = globalThis.WOLF_MODES;
export const Blood = globalThis.WOLF_BLOODMOON;
const DAWN_MS = 6000;
const SHOP_MS = 20_000;
const RESCUE_MS = 20_000;
const SHOOTER_ROLES = ['hunter', 'wolfboss'];
const BLOOD = 'bloodmoon';
const BLOOD_SKILL_COST = { shard: 3, equip: 4, supply: 2, dice: 5 };
const BLOOD_ACTIVE_SKILLS = ['xiaoshi', 'shunshou', 'bingliang', 'lebu', 'juedou', 'taoyuan', 'xietianzi'];

const REASON_LABEL = {
  wolf: '（被狼人杀害）',
  poison: '（被女巫毒杀）',
  vote: '（放逐）',
  hunter: '（被猎人带走）',
  wolfboss: '（被狼王带走）',
  duel: '（决斗出局）',
  lover: '（殉情）',
  charm: '（被狼美人带走）',
  explode: '（被白狼王自爆带走）',
  selfboom: '（自爆出局）',
  leave: '（离开房间）',
  kick: '（被站长请离）',
};

export function engine({ state: g, roster, mode, actions = [], clock = Date.now }) {
  const NIGHT_MS = Number(mode.nightMs) > 0 ? Number(mode.nightMs) : DEFAULT_TURN_MS;
  const SPEECH_MS = Number(mode.speechMs) > 0 ? Number(mode.speechMs) : DEFAULT_TURN_MS;
  const pending = [];
  const timer = turnClock(() => g, clock);
  const aliveSet = () => new Set(g.aliveSeats);
  const isAliveSeat = (seat) => g.aliveSeats.includes(seat);
  const rowBySeat = (seat) => roster.find((r) => r.seat === seat);
  const roleSeat = (role) => roster.find((r) => r.role === role)?.seat;
  const isBotSeat = (seat) => rowBySeat(seat)?.is_bot;
  const isSeatOnline = (seat) => rowBySeat(seat)?.online;
  const currentSpeaker = () => g.speechOrder?.[g.speechIndex];
  const pad = (seat) => String(seat).padStart(2, '0');
  const civic = civicScenes(() => g, {
    enterStep, startDay, isBotSeat, isSeatOnline, tallyVotes: Rules.tallyVotes, resume,
    openConfirm: openConfirmation, announcePending, startShop,
  });
  function fetchActions(day, step) {
    const latest = new Map();
    for (const a of actions) {
      // Ordinary victims and the hunter share one private confirmation window.
      if (a.day === day && (a.step === step || (step === 'hunter' && a.step === 'deathConfirm'))) latest.set(a.seat, a);
    }
    return [...latest.values()];
  }
  function record(seat, step, target, payload = {}) {
    const confirmation = step === 'hunter' || step === 'deathConfirm';
    const phase = confirmation ? g.hunterFrom : g.phase;
    const action = { day: g.day, phase, step, seat, target, payload };
    actions.push(action);
    pending.push(action);
  }
  function start() {
    const total = mode.roles.length;
    if (g || roster.length !== total) throw new Error('未满员或对局已经开始');
    const pool = [...mode.roles];
    for (const row of roster) {
      if (row.role == null) continue;
      const i = pool.indexOf(row.role);
      if (i === -1) throw new Error('钦定身份与板子不符');
      pool.splice(i, 1);
    }
    const free = Rules.shuffle(pool);
    const seats = Rules.shuffle(roster.map((_, i) => i + 1));
    roster.forEach((row, i) => Object.assign(row, { role: row.role ?? free.pop(), seat: seats[i], alive: true }));
    const rolesBySeat = {};
    roster.forEach((row) => {
      rolesBySeat[row.seat] = row.role;
    });
    const teams = Rules.groupsFromRoles(rolesBySeat);
    const thiefSeat = roster.find((r) => r.role === 'thief')?.seat ?? null;
    const cupidSeat = roster.find((r) => r.role === 'cupid')?.seat ?? null;

    g = {
      mode: mode.id,
      phase: 'night',
      step: null,
      day: 1,
      deadline: null,
      aliveSeats: roster.map((r) => r.seat).sort((a, b) => a - b),
      teams,
      lovers: null,
      cupidSeat,
      thiefSeat,
      thiefCards: thiefSeat ? drawThiefCards() : null,
      checks: [],
      potions: { save: true, poison: true },
      lastGuard: null,
      lastCharm: null,
      charmTarget: null,
      kill: null,
      guarded: null,
      saved: false,
      poison: null,
      knightUsed: false,
      voteBanned: [],
      idiotRevealed: [],
      hunterPending: null,
      hunterFrom: null,
      hunterRole: null,
      hunterUsed: false,
      bossUsed: false,
      nightQueue: [],
      nightIndex: 0,
      votes: null,
      runoffSeats: null,
      voteHistory: [],
      sheriff: null,
      sheriffDone: mode.sheriff === false,
      speechDir: 'cw',
      speechOrder: null,
      speechIndex: 0,
      deaths: [],
      kicked: [],
      log: [{ day: 1, kind: 'system', text: `板子：${mode.name}，共 ${total} 人` }],
      winner: null,
      winReason: '',
    };
    if (mode.id === BLOOD) g.blood = createBloodState(roster);
    g.log.push({ day: 1, kind: 'night', text: '第 1 夜 · 天黑请闭眼' });
    if (g.blood) {
      g.log.push({
        day: 1,
        kind: 'system',
        text: `血月牌局：每人 ${Blood.MAX_HP} 气血、${Blood.START_GOLD} 金、1 张手牌；狼刀扣血，放逐直接出局`,
      });
    }
    g.matchId = crypto.randomUUID();
    startNightInternal(true);
  }

  function createBloodState(players) {
    const hp = {}, gold = {}, hand = {}, star = {}, shards = {}, equipment = {};
    const skills = {}, skillUsed = {}, skillDay = {}, equipmentUsed = {}, actionUsed = {};
    const shop = {}, shopLock = {}, incomePenalty = {};
    const spoke = {}, voteHit = {}, voteWeight = {};
    players.forEach((p) => {
      hp[p.seat] = Blood.MAX_HP;
      gold[p.seat] = Blood.START_GOLD;
      hand[p.seat] = [Blood.randomCard()];
      star[p.seat] = 1;
      shards[p.seat] = 0;
      equipment[p.seat] = null;
      skills[p.seat] = [];
      skillUsed[p.seat] = [];
      skillDay[p.seat] = 0;
      equipmentUsed[p.seat] = false;
      actionUsed[p.seat] = false;
      shop[p.seat] = { equip: Blood.randomEquipment(), locked: false };
      shopLock[p.seat] = false;
      incomePenalty[p.seat] = 0;
      spoke[p.seat] = [];
      voteHit[p.seat] = [];
      voteWeight[p.seat] = 1;
    });
    return {
      hp, gold, hand, star, shards, equipment, skills, skillUsed, skillDay, equipmentUsed,
      actionUsed, shop, shopLock, incomePenalty, spoke, voteHit, voteWeight,
      cardPlayed: [], skillPlayed: [],
      rescueQueue: [], rescueSaved: [],
      nightHits: {}, nightReasons: {}, lastHits: [],
      cardResolved: [], skillResolved: [],
      shopResolved: false,
    };
  }

  // ---- 血月牌局：经济、商店、手牌、技能与气血 ----
  const bloodHas = (seat, skill) => Boolean(g.blood?.skills[seat]?.includes(skill));
  const bloodStar = (seat) => g.blood?.star[seat] || 1;
  const bloodHandLimit = (seat) => Blood.handleLimit(g.blood.skills[seat]);

  function bloodLog(text, kind = 'system') {
    g.log.push({ day: g.day, kind, text });
  }

  function bloodHeal(seat, amount) {
    if (!g.blood || !isAliveSeat(seat)) return 0;
    const before = g.blood.hp[seat];
    g.blood.hp[seat] = Math.min(Blood.MAX_HP, before + amount);
    return g.blood.hp[seat] - before;
  }

  function bloodDraw(seat, count = 1) {
    if (!g.blood || !isAliveSeat(seat)) return;
    const limit = bloodHandLimit(seat);
    for (let i = 0; i < count; i += 1) {
      if (g.blood.hand[seat].length >= limit) break;
      g.blood.hand[seat].push(Blood.randomCard());
    }
  }

  function bloodTakeCard(seat, card) {
    const hand = g.blood.hand[seat] || [];
    const index = hand.indexOf(card);
    if (index === -1) return false;
    hand.splice(index, 1);
    return true;
  }

  function bloodSkillUsedToday(seat, skill) {
    if (g.blood.skillDay[seat] === g.day) return true;
    return g.blood.skillUsed[seat].includes(skill);
  }

  function bloodMarkSkill(seat, skill) {
    g.blood.skillDay[seat] = g.day;
    const def = Blood.skillById(skill);
    if (def && (def.limited || def.type === 'limited')) g.blood.skillUsed[seat].push(skill);
  }

  function bloodUpgradeStar(seat) {
    const bm = g.blood;
    if (bm.star[seat] >= 3) return;
    let need = bm.star[seat] === 1 ? 2 : 3;
    while (bm.shards[seat] >= need && bm.star[seat] < 3) {
      bm.shards[seat] -= need;
      bm.star[seat] += 1;
      bloodLog(`${pad(seat)} 号升到 ${bm.star[seat]} 星`);
      if (bm.star[seat] === 3 && rowBySeat(seat)?.role === 'witch') {
        bm.hand[seat].push('tao');
        bloodLog(`${pad(seat)} 号的三星女巫额外获得 1 张【桃】`);
      }
      need = 3;
    }
  }

  function bloodIncome(seat) {
    const bm = g.blood;
    const prev = g.day - 1;
    const interestCap = 3 + (bloodHas(seat, 'tunji') ? 1 : 0);
    const interest = Math.min(interestCap, Math.floor(bm.gold[seat] / 10));
    let pay = 3 + interest;
    if ((bm.spoke[seat] || []).includes(prev)) pay += 1;
    if ((bm.voteHit[seat] || []).includes(prev)) pay += 1;
    if (bm.hp[seat] <= 1) pay += 1;
    if (bloodHas(seat, 'rijin')) pay += 2;
    if (bloodHas(seat, 'fuguo')) pay += 5;
    if (rowBySeat(seat)?.role === 'villager' && bloodStar(seat) >= 2) pay += 1;
    pay -= bm.incomePenalty[seat] || 0;
    return Math.max(0, pay);
  }

  function bloodPayIncome() {
    const bm = g.blood;
    g.aliveSeats.forEach((seat) => {
      bm.gold[seat] += bloodIncome(seat);
      bm.incomePenalty[seat] = 0;
      let draw = 1;
      if (bloodHas(seat, 'shouqi')) draw += 1;
      if (rowBySeat(seat)?.role === 'villager' && bloodStar(seat) >= 3) draw += 1;
      bloodDraw(seat, draw);
    });
  }

  function startShop() {
    if (!g.blood || g.phase === 'finished') return;
    const bm = g.blood;
    bloodPayIncome();
    g.aliveSeats.forEach((seat) => {
      bm.actionUsed[seat] = false;
      bm.voteWeight[seat] = 1;
      bm.shopResolved = false;
      const locked = Boolean(bm.shopLock[seat]);
      bm.shop[seat] = {
        equip: locked ? null : Blood.randomEquipment(),
        locked,
      };
      if (locked) {
        bloodLog(`${pad(seat)} 号的商店被【乐不思蜀】锁定，今天无法购物`);
      }
    });
    bm.cardPlayed = [];
    bm.skillPlayed = [];
    g.phase = 'shop';
    g.step = 'shop';
    g.deadline = clock() + SHOP_MS;
    bloodLog(`第 ${g.day} 天商店开门：发工资、补 1 张手牌，${SHOP_MS / 1000} 秒内完成购物`);
  }

  function botShopChoice(seat) {
    const bm = g.blood;
    const buys = [];
    if (bm.shop[seat]?.locked) return { target: null, payload: { buys } };
    let gold = bm.gold[seat];
    let shards = bm.shards[seat];
    let star = bm.star[seat];
    let equipment = bm.equipment[seat];
    const push = (key, cost) => {
      if (gold < cost) return false;
      gold -= cost;
      buys.push(key);
      return true;
    };
    if (!equipment && bm.shop[seat]?.equip && Math.random() < 0.75) {
      if (push('equip', BLOOD_SKILL_COST.equip)) equipment = bm.shop[seat].equip;
    }
    if (star < 3 && Math.random() < 0.7) {
      let want = star === 1 ? 2 : 3;
      while (star < 3 && shards >= want) {
        shards -= want;
        star += 1;
        want = 3;
      }
      if (star < 3 && gold >= BLOOD_SKILL_COST.shard && (shards >= want - 1 || Math.random() < 0.35)) {
        push('shard', BLOOD_SKILL_COST.shard);
      }
    }
    if (bm.skills[seat].length < 2 && gold >= BLOOD_SKILL_COST.dice && Math.random() < 0.55) {
      push('dice', BLOOD_SKILL_COST.dice);
    }
    if (gold >= BLOOD_SKILL_COST.supply && bm.hand[seat].length < bloodHandLimit(seat) && Math.random() < 0.55) {
      push('supply', BLOOD_SKILL_COST.supply);
    }
    return { target: null, payload: { buys } };
  }

  function bloodApplyBuy(seat, key) {
    const bm = g.blood;
    const cost = BLOOD_SKILL_COST[key];
    if (cost == null || bm.gold[seat] < cost) return false;
    if (key === 'equip') {
      const item = bm.shop[seat]?.equip;
      if (!item || bm.equipment[seat]) return false;
      bm.gold[seat] -= cost;
      bm.equipment[seat] = item;
      bm.shop[seat].equip = null;
      return true;
    }
    if (key === 'shard') {
      if (bm.star[seat] >= 3) return false;
      bm.gold[seat] -= cost;
      bm.shards[seat] += 1;
      bloodUpgradeStar(seat);
      return true;
    }
    if (key === 'dice') {
      if (bm.skills[seat].length >= 2) return false;
      const skill = Blood.randomSkill(bm.skills[seat]);
      if (!skill) return false;
      bm.gold[seat] -= cost;
      const roll = 1 + Math.floor(Math.random() * 6);
      const tier = roll <= 3 ? 'common' : roll <= 5 ? 'rare' : 'legendary';
      const picked = Blood.randomSkill(bm.skills[seat], tier) || skill;
      bm.skills[seat].push(picked);
      bloodLog(`${pad(seat)} 号掷出 ${roll} 点，获得${Blood.TIERS[tier]}技能【${Blood.SKILLS[picked].name}】`);
      return true;
    }
    if (key === 'supply') {
      bm.gold[seat] -= cost;
      bloodDraw(seat, 2);
      return true;
    }
    return false;
  }

  function resolveShop(actions) {
    if (!g.blood || g.phase !== 'shop') return;
    const bm = g.blood;
    if (bm.shopResolved) return;
    bm.shopResolved = true;
    actions.forEach((action) => {
      if (!isAliveSeat(action.seat) || bm.shop[action.seat]?.locked) return;
      const buys = Array.isArray(action.payload?.buys) ? action.payload.buys.slice(0, 4) : [];
      buys.forEach((key) => bloodApplyBuy(action.seat, key));
    });
    g.aliveSeats.forEach((seat) => { bm.shopLock[seat] = false; });
    civic.beginDiscussion();
  }

  function bloodMitigate(seat, amount, kind) {
    if (amount <= 0) return 0;
    const bm = g.blood;
    let left = amount;
    if (bm.equipment[seat] === 'renwang') left = Math.max(1, left - 1);
    else if (!bm.equipment[seat] && bloodHas(seat, 'qingzhuang')) left = Math.max(1, left - 1);
    return left;
  }

  function bloodDamage(seat, amount, { floor = 1 } = {}) {
    if (!g.blood || !isAliveSeat(seat) || amount <= 0) return 0;
    const bm = g.blood;
    let left = bloodMitigate(seat, amount, 'hit');
    if (floor > 0) left = Math.min(left, Math.max(0, bm.hp[seat] - floor));
    if (left <= 0) return 0;
    const before = bm.hp[seat];
    bm.hp[seat] = Math.max(0, before - left);
    const dealt = before - bm.hp[seat];
    if (bm.hp[seat] <= 0 && bloodHas(seat, 'niepan') && !bm.skillUsed[seat].includes('niepan')) {
      bm.skillUsed[seat].push('niepan');
      bm.hp[seat] = 2;
      bloodDraw(seat, 2);
      bloodLog(`${pad(seat)} 号触发【涅槃】，回复到 2 点气血并摸 2 张牌`);
    }
    return dealt;
  }

  function bloodTryWuxie(seat, label) {
    if (bloodHas(seat, 'wuxie') && !g.blood.skillUsed[seat].includes('wuxie')) {
      g.blood.skillUsed[seat].push('wuxie');
      bloodLog(`${pad(seat)} 号发动【无懈可击】，抵消了${label}`);
      return true;
    }
    return false;
  }

  function bloodYiya(target, source) {
    if (!isAliveSeat(target) || !isAliveSeat(source)) return;
    if (!bloodHas(target, 'yiya') || g.blood.skillDay[target] === g.day) return;
    g.blood.skillDay[target] = g.day;
    const done = bloodDamage(source, 1, { floor: 1 });
    if (done > 0) bloodLog(`${pad(target)} 号发动【以牙还牙】，对 ${pad(source)} 号造成 1 点伤害`);
  }

  function playBloodCard(seat, card, target) {
    const bm = g.blood;
    const def = Blood.cardById(card);
    if (!def || !isAliveSeat(seat)) return;
    if (card === 'shan' || !bloodTakeCard(seat, card)) return;
    bm.actionUsed[seat] = true;
    bm.cardPlayed.push({ seat, card, target });
    if (card === 'tao') {
      if (!isAliveSeat(target)) return;
      bloodLog(`${pad(seat)} 号打出【桃】，${pad(target)} 号回复气血`);
      bloodHeal(target, 2);
      return;
    }
    if (!isAliveSeat(target) || target === seat) return;
    if (card === 'sha') {
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号打出【杀】`);
      if (bloodHas(target, 'jianji')) bloodDraw(target, 1);
      if (bloodTryWuxie(target, '【杀】')) return;
      const bm2 = g.blood;
      if (bm2.equipment[target] === 'bagua' && !bm2.equipmentUsed[target]) {
        bm2.equipmentUsed[target] = true;
        bloodLog(`${pad(target)} 号的【八卦阵】抵消了这次【杀】`);
        return;
      }
      const wushuang = bloodHas(seat, 'wushuang') && !bm2.skillUsed[seat].includes('wushuang');
      if (!wushuang && bm2.hand[target].includes('shan')) {
        bloodTakeCard(target, 'shan');
        bloodLog(`${pad(target)} 号打出【闪】，抵消了【杀】`);
        return;
      }
      if (wushuang) {
        bm2.skillUsed[seat].push('wushuang');
        bloodLog(`${pad(seat)} 号发动【天下无双】，这一刀无法被闪避`);
      }
      const amount = bloodDamage(target, wushuang ? 3 : 1, { floor: 1 });
      if (amount > 0) bloodYiya(target, seat);
      return;
    }
    if (card === 'chai') {
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号打出【拆】`);
      if (bloodTryWuxie(target, '【拆】')) return;
      if (g.blood.equipment[target]) {
        g.blood.equipment[target] = null;
        bloodLog(`${pad(target)} 号的装备被拆掉`);
      } else {
        const lost = Math.min(1, g.blood.gold[target]);
        g.blood.gold[target] -= lost;
        bloodLog(`${pad(target)} 号没有装备，失去 ${lost} 金`);
      }
    }
  }

  function playBloodSkill(seat, skill, target) {
    const bm = g.blood;
    const def = Blood.skillById(skill);
    if (!def || !bloodHas(seat, skill) || !isAliveSeat(seat)) return;
    if (bloodSkillUsedToday(seat, skill)) return;
    bm.actionUsed[seat] = true;
    bm.skillPlayed.push({ seat, skill, target });
    if (skill === 'taoyuan') {
      bloodMarkSkill(seat, skill);
      g.aliveSeats.forEach((s) => bloodHeal(s, 1));
      bloodLog(`${pad(seat)} 号发动【桃园结义】，所有存活玩家回复 1 点气血`);
      return;
    }
    if (skill === 'xiaoshi') {
      bloodMarkSkill(seat, skill);
      const card = bm.hand[seat][0];
      if (card) {
        bloodTakeCard(seat, card);
        bloodDraw(seat, 1);
        bloodLog(`${pad(seat)} 号发动【小试身手】，弃 1 张摸 1 张`);
      }
      return;
    }
    if (skill === 'xietianzi') {
      if (!isAliveSeat(target)) return;
      bloodMarkSkill(seat, skill);
      bm.voteWeight[target] = 3;
      bloodLog(`${pad(seat)} 号发动【挟天子以令诸侯】，${pad(target)} 号今天的投票算 3 票`);
      return;
    }
    if (!isAliveSeat(target) || target === seat) return;
    if (bloodTryWuxie(target, `【${def.name}】`)) return;
    if (skill === 'shunshou') {
      bloodMarkSkill(seat, skill);
      const stolen = Math.min(1, bm.gold[target]);
      bm.gold[target] -= stolen;
      bm.gold[seat] += stolen;
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号发动【顺手牵羊】，获得 ${stolen} 金`);
      return;
    }
    if (skill === 'bingliang') {
      bloodMarkSkill(seat, skill);
      bm.incomePenalty[target] += 3;
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号发动【兵粮寸断】，其下次工资 -3 金`);
      return;
    }
    if (skill === 'lebu') {
      bloodMarkSkill(seat, skill);
      bm.shopLock[target] = true;
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号发动【乐不思蜀】，其明天商店锁定`);
      return;
    }
    if (skill === 'juedou') {
      bloodMarkSkill(seat, skill);
      if (bloodTakeCard(target, 'sha')) {
        bloodLog(`${pad(seat)} 号对 ${pad(target)} 号发动【决斗】，${pad(target)} 号弃掉 1 张【杀】`);
        return;
      }
      const amount = bloodDamage(target, 2, { floor: 1 });
      bloodLog(`${pad(seat)} 号对 ${pad(target)} 号发动【决斗】，${pad(target)} 号没有【杀】，受到 ${amount} 点伤害`);
    }
  }

  function processBloodDayActions() {
    if (!g.blood || g.phase !== 'day') return false;
    const cardActions = fetchActions(g.day, 'card')
      .filter((a) => !g.blood.cardResolved.includes(`${a.seat}:${a.day}`));
    if (cardActions.length) {
      const action = cardActions[0];
      g.blood.cardResolved.push(`${action.seat}:${action.day}`);
      if (isAliveSeat(action.seat) && !g.blood.actionUsed[action.seat]) {
        playBloodCard(action.seat, action.payload?.card, Number(action.target));
      }
      return true;
    }
    const skillActions = fetchActions(g.day, 'skill')
      .filter((a) => !g.blood.skillResolved.includes(`${a.seat}:${a.day}`));
    if (skillActions.length) {
      const action = skillActions[0];
      g.blood.skillResolved.push(`${action.seat}:${action.day}`);
      if (isAliveSeat(action.seat) && !g.blood.actionUsed[action.seat]) {
        playBloodSkill(action.seat, action.payload?.skill, Number(action.target));
      }
      return true;
    }
    return false;
  }

  function botBloodPlay(seat) {
    if (!g.blood || g.blood.actionUsed[seat] || !isAliveSeat(seat)) return;
    const bm = g.blood;
    const others = g.aliveSeats.filter((s) => s !== seat);
    if (!others.length) return;
    if (bm.hp[seat] <= 2 && bm.hand[seat].includes('tao') && Math.random() < 0.8) {
      record(seat, 'card', seat, { card: 'tao', target: seat });
      return;
    }
    const skill = bm.skills[seat].find((s) => BLOOD_ACTIVE_SKILLS.includes(s) && !bloodSkillUsedToday(seat, s));
    if (skill && Math.random() < 0.55) {
      const target = skill === 'taoyuan' ? null : randomOf(others);
      record(seat, 'skill', target, { skill, target });
      return;
    }
    if (bm.hand[seat].includes('sha') && Math.random() < 0.55) {
      const target = randomOf(others);
      record(seat, 'card', target, { card: 'sha', target });
    } else if (bm.hand[seat].includes('chai') && Math.random() < 0.35) {
      const target = randomOf(others);
      record(seat, 'card', target, { card: 'chai', target });
    }
  }

  function startRescue() {
    g.phase = 'rescue';
    g.step = 'rescue';
    g.deadline = clock() + RESCUE_MS;
    bloodLog(`濒死：${g.blood.rescueQueue.map(pad).join('、')} 号，持有【桃】的玩家可以救人（${RESCUE_MS / 1000} 秒）`, 'warning');
  }

  function botRescueChoice(seat) {
    const target = randomOf(g.blood.rescueQueue);
    return target == null ? null : { target, payload: { target } };
  }

  function resolveRescue(actions) {
    if (!g.blood || g.phase !== 'rescue') return;
    const bm = g.blood;
    const saved = [];
    const queue = [...bm.rescueQueue];
    queue.forEach((target) => {
      if (bm.hp[target] > 0) {
        saved.push(target);
        return;
      }
      const row = actions.find((a) => a.target === target && isAliveSeat(a.seat) &&
        bm.hand[a.seat]?.includes('tao'));
      if (!row) return;
      bloodTakeCard(row.seat, 'tao');
      bloodHeal(target, 2);
      saved.push(target);
      bloodLog(`${pad(row.seat)} 号打出【桃】，救回 ${pad(target)} 号`);
    });
    bm.rescueSaved = saved;
    bm.rescueQueue = [];
    const deaths = queue
      .filter((seat) => !saved.includes(seat))
      .map((seat) => ({ seat, reason: bm.nightReasons[seat] || 'wolf' }));
    if (deaths.length) {
      if (applyDeaths(deaths, 'night') === 'continue') civic.afterDeaths('dawn');
      return;
    }
    bloodLog('所有濒死玩家都被救回');
    civic.afterDeaths('dawn');
  }

  function finishBloodNight() {
    const bm = g.blood;
    const hits = [];
    const totals = new Map();
    const note = (seat, amount) => {
      if (amount > 0) totals.set(seat, (totals.get(seat) || 0) + amount);
    };
    const aliveWolves = g.teams.wolves.filter(isAliveSeat);
    const knifeStar = aliveWolves.length ? Math.max(...aliveWolves.map(bloodStar)) : 1;
    const witchSeat = roleSeat('witch');
    const poisonStar = witchSeat != null && isAliveSeat(witchSeat) ? bloodStar(witchSeat) : 1;
    const knifeDamage = knifeStar >= 2 ? 3 : 2;
    const poisonDamage = poisonStar >= 2 ? 3 : 2;
    const knifeTarget = g.kill;
    const poisonTarget = g.poison;

    if (knifeTarget != null && isAliveSeat(knifeTarget)) {
      let blocked = false;
      if (bm.equipment[knifeTarget] === 'bagua' && !bm.equipmentUsed[knifeTarget] && knifeStar < 3) {
        bm.equipmentUsed[knifeTarget] = true;
        blocked = true;
        bloodLog(`${pad(knifeTarget)} 号的【八卦阵】挡下了一次夜间伤害`);
      }
      if (!blocked && g.saved) {
        bloodHeal(knifeTarget, poisonStar >= 2 ? 3 : 2);
      } else if (!blocked) {
        const dealt = bloodDamage(knifeTarget, knifeDamage, { floor: 0 });
        note(knifeTarget, dealt);
        bm.nightReasons[knifeTarget] ??= 'wolf';
      }
    }
    if (poisonTarget != null && isAliveSeat(poisonTarget)) {
      const dealt = bloodDamage(poisonTarget, poisonDamage, { floor: 0 });
      note(poisonTarget, dealt);
      bm.nightReasons[poisonTarget] ??= 'poison';
    }

    totals.forEach((amount, seat) => {
      if (amount > 0) {
        hits.push({ seat, amount });
        bloodLog(`${pad(seat)} 号受到 ${amount} 点伤害，当前气血 ${bm.hp[seat]}/${Blood.MAX_HP}`, 'dawn');
      }
    });
    bm.lastHits = hits;
    bm.nightHits = {};

    g.kill = null;
    g.guarded = null;
    g.saved = false;
    g.poison = null;
    bloodLog(`第 ${g.day} 天 · 天亮了`, 'dawn');

    const dying = [];
    for (const seat of g.aliveSeats) {
      if (bm.hp[seat] > 0) continue;
      const saver = g.aliveSeats.find((s) => s !== seat && bloodHas(s, 'qisi') &&
        !bm.skillUsed[s].includes('qisi'));
      if (saver != null) {
        bm.skillUsed[saver].push('qisi');
        bm.hp[seat] = 2;
        bloodLog(`${pad(saver)} 号发动【起死回生】，将 ${pad(seat)} 号从濒死中救回`);
        continue;
      }
      dying.push(seat);
    }
    if (dying.length) {
      bm.rescueQueue = dying;
      startRescue();
      return;
    }
    civic.afterDeaths('dawn');
  }

  function drawThiefCards() {
    const pool = ['villager', 'villager', 'werewolf', 'guard'];
    return Rules.shuffle(pool).slice(0, 2);
  }

  function buildNightQueue() {
    const queue = [];
    if (g.day === 1 && g.thiefSeat && isAliveSeat(g.thiefSeat)) queue.push('thief');
    if (g.day === 1 && g.cupidSeat && isAliveSeat(g.cupidSeat)) queue.push('cupid');
    const guard = roleSeat('guard');
    if (guard && isAliveSeat(guard)) queue.push('guard');
    if (g.teams.wolves.some((s) => isAliveSeat(s))) queue.push('wolves');
    const beast = roleSeat('wolfbeauty');
    if (beast && isAliveSeat(beast)) queue.push('wolfbeauty');
    const witch = roleSeat('witch');
    if (witch && isAliveSeat(witch) && (g.potions.save || g.potions.poison)) queue.push('witch');
    const seer = roleSeat('seer');
    if (seer && isAliveSeat(seer)) queue.push('seer');
    return queue;
  }

  function startNightInternal(first) {
    if (!first) g.day += 1;
    g.phase = 'night';
    g.kill = null;
    g.guarded = null;
    g.saved = false;
    g.poison = null;
    g.charmTarget = null;
    g.votes = null;
    g.runoffSeats = null;
    g.step = null;
    if (g.blood) {
      g.blood.nightReasons = {};
      g.blood.rescueQueue = [];
      g.blood.rescueSaved = [];
      g.blood.lastHits = [];
    }
    g.nightQueue = buildNightQueue();
    g.nightIndex = 0;
    if (!first) g.log.push({ day: g.day, kind: 'night', text: `第 ${g.day} 夜 · 天黑请闭眼` });
    if (g.nightQueue.length) enterStep(g.nightQueue[0]);
    else finishNight();
  }

  function enterStep(step) {
    g.step = step;
    g.stepStart = clock();
    g.deadline = g.stepStart + (civicPhase(g.phase) ? SPEECH_MS : NIGHT_MS);
  }

  function expectedSeats(step) {
    if (step === 'thief') return g.thiefSeat && isAliveSeat(g.thiefSeat) ? [g.thiefSeat] : [];
    if (step === 'cupid') return g.cupidSeat && isAliveSeat(g.cupidSeat) ? [g.cupidSeat] : [];
    if (step === 'guard') {
      const seat = roleSeat('guard');
      return seat && isAliveSeat(seat) ? [seat] : [];
    }
    if (step === 'wolves') return g.teams.wolves.filter((s) => isAliveSeat(s));
    if (step === 'wolfbeauty') {
      const seat = roleSeat('wolfbeauty');
      return seat && isAliveSeat(seat) ? [seat] : [];
    }
    if (step === 'witch') {
      const seat = roleSeat('witch');
      return seat && isAliveSeat(seat) ? [seat] : [];
    }
    if (step === 'seer') {
      const seat = roleSeat('seer');
      return seat && isAliveSeat(seat) ? [seat] : [];
    }
    if (step === 'hunter' && g.phase === 'hunter') {
      // Old v8 rooms may already be waiting for a hunter without a batch of seats.
      return (g.deathConfirmSeats ?? [g.hunterPending]).filter(s => s != null && !rowBySeat(s)?.departed);
    }
    if (step === 'vote' || step === 'runoff') {
      return g.aliveSeats.filter((s) => !g.voteBanned.includes(s));
    }
    if (g.blood && step === 'shop') return g.aliveSeats;
    if (g.blood && step === 'rescue') {
      return g.aliveSeats.filter((s) => g.blood.hand[s]?.includes('tao'));
    }
    return civicPhase(g.phase) ? civic.expected(step) : [];
  }

  function allActed(step, actions) {
    const expected = expectedSeats(step);
    if (!expected.length) return true;
    const acted = new Set(actions.filter((a) => a.payload && !a.payload.ignore).map((a) => a.seat));
    // 夜晚回合固定等满 60 秒或全员行动，不因短暂离线提前跳过（避免吞掉女巫等回合）。
    return expected.every((seat) => acted.has(seat));
  }

  function tick() {
    if (!g || g.phase === 'finished') return;
    let actions = fetchActions(g.day, g.step || 'day');
    const now = clock();
    if (['day', 'vote', 'runoff', 'sheriff', 'order', 'lastwords'].includes(g.phase)) {
      const boom = findExplodeAction(fetchActions(g.day, 'explode'));
      if (boom) {
        resolveExplode(boom);
        return;
      }
    }
    if (g.phase === 'night') {
      if (fillBotActions(g.step, actions)) actions = fetchActions(g.day, g.step);
      if (allActed(g.step, actions) || timer.expired(now)) {
        resolveNightStep(actions);
      }
    } else if (g.phase === 'shop') {
      if (fillBotActions(g.step, actions)) actions = fetchActions(g.day, g.step);
      if (allActed(g.step, actions) || now >= g.deadline) resolveShop(actions);
    } else if (g.phase === 'rescue') {
      if (fillBotActions(g.step, actions)) actions = fetchActions(g.day, g.step);
      if (allActed(g.step, actions) || now >= g.deadline) resolveRescue(actions);
    } else if (g.phase === 'dawn') {
      if (now >= g.deadline) civic.sunrise();
    } else if (civicPhase(g.phase)) {
      if (fillBotActions(g.step, actions)) actions = fetchActions(g.day, g.step);
      const solo = ['policeSpeech', 'lastwords', 'badge'].includes(g.step);
      if (allActed(g.step, actions) || now >= g.deadline ||
          (solo && !isSeatOnline(expectedSeats(g.step)[0]))) civic.resolve(actions);
    } else if (g.phase === 'day') {
      const handled = handleDaySpecial(actions);
      if (handled) return;
      if (processBloodDayActions()) return;
      const speaker = currentSpeaker();
      if (speaker == null) {
        startVote();
        return;
      }
      if (!isAliveSeat(speaker)) {
        advanceSpeech();
        return;
      }
      if (isBotSeat(speaker)) {
        if (g.blood) {
          botBloodPlay(speaker);
          processBloodDayActions();
        }
        g.log.push({ day: g.day, kind: 'system', text: `${pad(speaker)} 号（人机）不发言，跳过` });
        advanceSpeech();
        return;
      }
      if (!isSeatOnline(speaker)) {
        g.log.push({ day: g.day, kind: 'system', text: `${pad(speaker)} 号离线，跳过发言` });
        advanceSpeech();
        return;
      }
      const speechActions = fetchActions(g.day, 'speech');
      const ended = speechActions.some(
        (row) => row.seat === speaker && Number(row.payload?.turn) === g.speechIndex,
      );
      if (ended || timer.expired(now)) advanceSpeech();
    } else if (g.phase === 'vote' || g.phase === 'runoff') {
      if (fillBotActions(g.step, actions)) actions = fetchActions(g.day, g.step);
      const boom = findExplodeAction(actions);
      if (boom) {
        resolveExplode(boom);
        return;
      }
      if (allActed(g.step, actions) || timer.expired(now)) resolveVote(actions);
    } else if (g.phase === 'hunter') {
      if (fillBotActions('hunter', actions)) actions = fetchActions(g.day, 'hunter');
      if (allActed('hunter', actions) || timer.expired(now)) resolveHunter(actions);
    }
  }

  function depart(target, reason) {
    const row = rowBySeat(target);
    if (!row || !g || g.phase === 'finished' || g.kicked.includes(target)) return;
    if (reason === 'kick') g.kicked.push(target);
    g.log.push({
      day: g.day,
      kind: 'system',
      text: reason === 'kick'
        ? `站长把 ${pad(target)} 号请出了房间`
        : `${pad(target)} 号离开房间，按出局处理`,
    });
    if (!isAliveSeat(target)) {
      return;
    }
    const deaths = Rules.expandDeaths([{ seat: target, reason }], {
      alive: aliveSet(),
      lovers: g.lovers,
      wolfbeautySeat: roleSeat('wolfbeauty'),
      charmTarget: g.charmTarget,
    });
    // Pause, don't discard, the interrupted turn. Another departure during a
    // confirmation may add deaths but must not replace the original continuation.
    const resume = { phase: g.phase, step: g.step, stepStart: g.stepStart, deadline: g.deadline, pausedAt: clock() };
    const result = applyDeaths(deaths, g.phase === 'night' ? 'night' : 'day');
    if (result === 'pending' && resume.phase !== 'hunter') g.hunterResume = resume;
    if (result === 'continue') civic.afterDeaths(resume);
  }

  function randomOf(list) {
    return list && list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  function botNightChoice(step, seat, role) {
    const others = g.aliveSeats.filter((s) => s !== seat);
    if (step === 'thief') return { target: null, payload: { card: Math.random() < 0.5 ? 0 : 1 } };
    if (step === 'cupid') {
      const a = randomOf(g.aliveSeats);
      const rest = g.aliveSeats.filter((s) => s !== a);
      const b = randomOf(rest);
      return { target: null, payload: a != null && b != null ? { a, b } : {} };
    }
    if (step === 'guard') {
      const pool = others.filter((s) => s !== g.lastGuard);
      return { target: randomOf(pool), payload: {} };
    }
    if (step === 'wolves') {
      const good = g.aliveSeats.filter((s) => !g.teams.wolves.includes(s));
      return { target: randomOf(good.length ? good : g.aliveSeats), payload: {} };
    }
    if (step === 'wolfbeauty') {
      const pool = others.filter((s) => s !== g.lastCharm);
      return { target: randomOf(pool), payload: {} };
    }
    if (step === 'witch') {
      if (isAliveSeat(g.kill) && g.potions.save && Math.random() < 0.5) {
        return { target: null, payload: { save: true } };
      }
      if (g.potions.poison && Math.random() < 0.3) {
        const target = randomOf(others);
        if (target != null) return { target, payload: { poison: target } };
      }
      return { target: null, payload: {} };
    }
    if (step === 'seer') {
      const checked = new Set((g.checks || []).filter((c) => c.seat === seat).map((c) => c.target));
      const fresh = others.filter((s) => !checked.has(s));
      return { target: randomOf(fresh.length ? fresh : others), payload: {} };
    }
    return null;
  }

  function botVoteChoice(step, seat) {
    let pool = g.aliveSeats.filter((s) => s !== seat);
    if (step === 'runoff' && g.runoffSeats) pool = pool.filter((s) => g.runoffSeats.includes(s));
    const target = randomOf(pool);
    return { target: target ?? -1, payload: {} };
  }

  function botHunterChoice(seat) {
    const reveal = Math.random() < 0.6;
    const target = reveal && Math.random() < 0.6 ? randomOf(g.aliveSeats.filter((s) => s !== seat)) : null;
    return { target, payload: { reveal } };
  }

  function fillBotActions(step, actions) {
    const expected = expectedSeats(step);
    if (!expected.length) return false;
    const acted = new Set(actions.map((a) => a.seat));
    let added = false;
    for (const seat of expected) {
      if (acted.has(seat) || !isBotSeat(seat)) continue;
      const row = rowBySeat(seat);
      if (!row) continue;
      let choice;
      if (step === 'hunter' && seat !== g.hunterPending) {
        record(seat, 'deathConfirm', null);
        added = true;
        continue;
      }
      if (step === 'hunter') choice = botHunterChoice(seat);
      else if (step === 'vote' || step === 'runoff') choice = botVoteChoice(step, seat);
      else if (step === 'policeSignup') choice = { target: null, payload: { run: false } };
      else if (step === 'policeVote' || step === 'policeRunoff') {
        const candidates = step === 'policeVote' ? g.sheriffCandidates : g.runoffSeats;
        choice = { target: randomOf(candidates.filter(isAliveSeat)) ?? -1, payload: {} };
      } else if (step === 'order' || step === 'badge') choice = null; // timeout gives the default
      else if (step === 'shop') choice = botShopChoice(seat);
      else if (step === 'rescue') choice = botRescueChoice(seat);
      else choice = botNightChoice(step, seat, row.role);
      if (!choice) continue;
      record(seat, step, choice.target, choice.payload);
      added = true;
    }
    return added;
  }

  function resolveNightStep(actions) {
    const step = g.step;
    const get = (seat) => isAliveSeat(seat) && actions.find((a) => a.seat === seat);

    if (step === 'thief' && isAliveSeat(g.thiefSeat)) {
      const row = get(g.thiefSeat);
      const index = row?.payload?.card === 1 ? 1 : 0;
      const chosen = g.thiefCards?.[index] || 'villager';
      applyThiefChoice(g.thiefSeat, chosen);
      g.nightQueue = buildNightQueue();
      g.log.push({ day: g.day, kind: 'system', text: '盗贼已经换牌' });
    } else if (step === 'cupid' && isAliveSeat(g.cupidSeat)) {
      const row = get(g.cupidSeat);
      const a = row?.payload?.a;
      const b = row?.payload?.b;
      if (a && b && a !== b && isAliveSeat(a) && isAliveSeat(b)) g.lovers = [a, b];
      g.log.push({ day: g.day, kind: 'system', text: '丘比特行动结束' });
    } else if (step === 'guard') {
      const seat = roleSeat('guard');
      const row = get(seat);
      const target = row?.target;
      if (target && target !== g.lastGuard && isAliveSeat(target)) {
        g.guarded = target;
      }
      g.lastGuard = g.guarded;
    } else if (step === 'wolves') {
      const top = Rules.wolfKillTop(actions, expectedSeats('wolves'), aliveSet());
      g.kill = top.length ? top[Math.floor(Math.random() * top.length)] : null;
    } else if (step === 'wolfbeauty') {
      const seat = roleSeat('wolfbeauty');
      const row = get(seat);
      const target = row?.target;
      if (target && target !== seat && target !== g.lastCharm && isAliveSeat(target)) {
        g.charmTarget = target;
      }
      g.lastCharm = g.charmTarget;
    } else if (step === 'witch') {
      const seat = roleSeat('witch');
      const row = get(seat);
      const payload = row?.payload || {};
      const save = Boolean(payload.save) && g.potions.save && isAliveSeat(g.kill);
      let poison = payload.poison;
      if (poison != null && (!isAliveSeat(poison) || !g.potions.poison)) poison = null;
      if (save && poison != null) poison = null;
      if (save) {
        g.saved = true;
        g.potions.save = false;
      }
      if (poison != null) {
        g.poison = poison;
        g.potions.poison = false;
      }
    } else if (step === 'seer') {
      const seat = roleSeat('seer');
      const row = get(seat);
      const target = row?.target;
      if (target && target !== seat && isAliveSeat(target)) {
        const check = { day: g.day, target, killer: g.teams.wolves.includes(target), seat };
        if (g.blood && bloodStar(seat) >= 2) {
          check.role = rowBySeat(target)?.role;
          check.handCount = g.blood.hand[target]?.length || 0;
          check.hasTao = Boolean(g.blood.hand[target]?.includes('tao'));
        }
        if (g.blood && bloodStar(seat) >= 3) check.gold = g.blood.gold[target];
        g.checks.push(check);
      }
    }

    g.nightIndex += 1;
    if (g.nightIndex < g.nightQueue.length) {
      enterStep(g.nightQueue[g.nightIndex]);
    } else {
      finishNight();
    }
  }

  function applyThiefChoice(seat, roleKey) {
    const row = roster.find((r) => r.seat === seat);
    if (!row) return;
    row.role = roleKey;
    const rolesBySeat = {};
    roster.forEach((r) => {
      rolesBySeat[r.seat] = r.role;
    });
    g.teams = Rules.groupsFromRoles(rolesBySeat);
  }

  function finishNight() {
    if (g.blood) return finishBloodNight();
    const alive = aliveSet();
    const rawDeaths = [];
    if (g.kill != null) {
      const guarded = g.guarded === g.kill;
      const survives = guarded !== g.saved;
      if (!survives) rawDeaths.push({ seat: g.kill, reason: 'wolf' });
    }
    if (g.poison != null) rawDeaths.push({ seat: g.poison, reason: 'poison' });

    const beast = roleSeat('wolfbeauty');
    const deaths = Rules.expandDeaths(rawDeaths, {
      alive,
      lovers: g.lovers,
      wolfbeautySeat: beast,
      charmTarget: g.charmTarget,
    });

    g.kill = null;
    g.guarded = null;
    g.saved = false;
    g.poison = null;

    g.log.push({ day: g.day, kind: 'dawn', text: `第 ${g.day} 天 · 天亮了` });
    // 首日先竞选警长，竞选结束后才公布昨夜死讯与遗言。
    if (g.day === 1 && !g.sheriffDone && deaths.length) {
      markDeaths(deaths, 'night', true);
      g.nightPending = deaths;
      const win = checkWin();
      // 判胜前必须先给首夜死者开出局确认窗口：猎人那一枪可能改变屠边结果。
      if (win && confirmSeats(deaths).length) {
        announcePending('dawn');
        return;
      }
      if (win) {
        for (const d of deaths) announceDeath(d, 'night');
        delete g.nightPending;
        finishGame(win.winner, win.reason);
        return;
      }
      civic.afterDeaths('dawn');
      return;
    }
    if (applyDeaths(deaths, 'night') === 'continue') civic.afterDeaths('dawn');
  }

  function announceDeath(death, when) {
    if (g.blood) g.blood.hp[death.seat] = 0;
    g.deaths.push({ day: g.day, seat: death.seat, reason: death.reason });
    civic.death(death, when);
    g.log.push({
      day: g.day,
      kind: 'death',
      text: `${pad(death.seat)} 号出局${when === 'night' ? '' : REASON_LABEL[death.reason] || ''}`,
    });
    rowBySeat(death.seat).alive = false;
  }

  function markDeaths(deaths, when, silent = false) {
    if (!deaths.length && when === 'night') {
      g.log.push({ day: g.day, kind: 'dawn', text: '昨夜是平安夜' });
    }
    deaths.forEach((death) => {
      g.aliveSeats = g.aliveSeats.filter((s) => s !== death.seat);
      if (!silent) announceDeath(death, when);
    });
    if (!isAliveSeat(g.kill)) g.kill = null;
  }

  function confirmSeats(deaths) {
    const hunterOpen = mode.roles.includes('hunter') && !g.hunterRevealed;
    const bossOpen = mode.roles.includes('wolfboss') && !g.bossUsed;
    if (!hunterOpen && !bossOpen) return [];
    const cover = hunterOpen ? ['wolf', 'vote', 'lover', 'charm'] : [];
    const bossTrigger = ['wolf', 'vote', 'lover', 'charm', 'selfboom', 'explode', 'hunter', 'wolfboss'];
    return deaths
      .filter((d) => cover.includes(d.reason) ||
        (bossOpen && rowBySeat(d.seat)?.role === 'wolfboss' && bossTrigger.includes(d.reason)))
      .map(d => d.seat);
  }

  // Publish the deferred first-night deaths, then their confirmation/last words.
  function announcePending(next) {
    const deaths = g.nightPending;
    if (!deaths) return false;
    delete g.nightPending;
    for (const d of deaths) announceDeath(d, 'night');
    const seats = confirmSeats(deaths);
    if (seats.length) {
      g.hunterResume = next;
      openConfirmation(seats, 'night');
      return true;
    }
    civic.afterDeaths(next);
    return true;
  }

  function openConfirmation(seats, when) {
    g.deathConfirmSeats = seats;
    const shooter = seats.find((seat) => {
      const role = rowBySeat(seat)?.role;
      if (role === 'hunter') return !g.hunterUsed;
      if (role === 'wolfboss') return !g.bossUsed;
      return false;
    });
    g.hunterPending = shooter ?? null;
    g.hunterRole = shooter != null ? rowBySeat(shooter).role : null;
    if (g.hunterRole === 'hunter') g.hunterUsed = true;
    if (g.hunterRole === 'wolfboss') g.bossUsed = true;
    g.hunterFrom = when;
    g.phase = g.step = 'hunter'; // internal v8 name; the public phase is always 'settling'
    g.deadline = clock() + (g.hunterFrom === 'night' ? NIGHT_MS : SPEECH_MS);
  }

  function applyDeaths(deaths, when) {
    markDeaths(deaths, when);
    // Use only public facts to decide whether a confirmation window exists.
    // A hunter who concealed the card must NOT disable cover on later deaths.
    const seats = confirmSeats(deaths);
    // A pending hunter/confirmation can still change the outcome, so victory
    // must wait for it; only settle immediately when no window is possible.
    const pendingConfirm = seats.length || g.confirmAfterWords || g.phase === 'hunter';
    if (!pendingConfirm) {
      const win = checkWin();
      if (win) {
        // 首夜死讯尚未公布时（警上自爆等），先公布并开确认窗口，确认后再判胜。
        if (g.nightPending && confirmSeats(g.nightPending).length) {
          announcePending('night');
          return 'pending';
        }
        clearScenes();
        finishGame(win.winner, win.reason);
        return 'finished';
      }
    }
    if (g.phase === 'hunter') {
      if (seats.length) (g.queuedConfirmSeats ??= []).push(...seats);
      return 'pending';
    }
    if (seats.length) {
      if (when === 'day') {
        // 白天被放逐者先发表遗言，遗言结束后再开确认窗口（猎人先遗言后开枪）。
        const prior = g.confirmAfterWords?.seats || [];
        g.confirmAfterWords = { seats: [...prior, ...seats], when };
        return 'continue';
      }
      openConfirmation(seats, when);
      return 'pending';
    }
    return 'continue';
  }

  function clearScenes() {
    g.lastWordsQueue = [];
    g.lastWordsSeat = null;
    g.confirmAfterWords = null;
    g.badgePending = null;
  }

  function settleVictory(next) {
    const win = checkWin();
    if (!win) return 'continue';
    // A daytime confirmation can finish before the deferred first-night batch.
    if (g.nightPending && confirmSeats(g.nightPending).length) {
      announcePending(next);
      return 'pending';
    }
    finishGame(win.winner, win.reason);
    return 'finished';
  }

  function checkWin() {
    return Rules.winCheck({
      alive: aliveSet(),
      teams: g.teams,
      lovers: g.lovers,
      cupidSeat: g.cupidSeat,
    });
  }

  function finishGame(winner, reason) {
    // 终局前必须公布仍被保密的首夜死讯，否则公开存活名单与回放会漏掉这些死者。
    if (g.nightPending) {
      for (const d of g.nightPending) announceDeath(d, 'night');
      delete g.nightPending;
    }
    clearScenes();
    g.phase = 'finished';
    g.step = 'finished';
    g.deadline = null;
    g.winner = winner;
    g.winReason = reason;
    const label = winner === 'wolf'
      ? '狼人阵营获胜'
      : winner === 'lovers'
      ? '第三方阵营获胜'
      : '好人阵营获胜';
    g.log.push({ day: g.day, kind: 'finish', text: `游戏结束：${label}（${reason}）` });
  }

  function startDawn() {
    g.phase = 'dawn';
    g.step = 'dawn';
    g.deadline = clock() + DAWN_MS;
  }

  function startDay() {
    if (g.nightPending) {
      announcePending('day');
      return;
    }
    g.phase = 'day';
    g.step = 'day';
    // 血月牌局让每个人机也占一个发言位，人机回合会快速出牌/跳过，牌才能真正进入循环。
    const alive = (g.blood ? [...g.aliveSeats] : g.aliveSeats.filter((s) => !isBotSeat(s)))
      .sort((a, b) => a - b);
    const hasBots = g.aliveSeats.some((s) => isBotSeat(s));
    const deaths = g.deaths.filter(d => d.day === g.day);
    const sheriff = alive.includes(g.sheriff) && alive.length > 1;
    const start = sheriff ? g.sheriff : deaths.length ? Math.min(...deaths.map(d => d.seat)) + 1 : 1;
    g.speechDir = sheriff && g.speechDir === 'ccw' ? 'ccw' : 'cw';
    g.speechOrder = speechOrder(alive, start, g.speechDir);
    // 警长决定发言方向，但按规则最后一个发言。
    if (sheriff) g.speechOrder.push(g.speechOrder.shift());
    g.speechIndex = 0;
    g.deadline = g.speechOrder.length ? clock() + SPEECH_MS : 0;
    g.log.push({
      day: g.day,
      kind: 'system',
      text: `第 ${g.day} 天讨论开始，发言顺序：${g.speechOrder.map(pad).join(' → ') || '无'}（每人 ${
        SPEECH_MS / 1000
      } 秒${hasBots ? '，人机不发言' : ''}）`,
    });
    if (!g.speechOrder.length) {
      startVote();
      return;
    }
  }

  function advanceSpeech() {
    if (!g || g.phase !== 'day') return;
    const doneSeat = g.speechOrder?.[g.speechIndex];
    if (g.blood && doneSeat != null && isAliveSeat(doneSeat) && !isBotSeat(doneSeat)) {
      const talked = fetchActions(g.day, 'speech').some((a) => a.seat === doneSeat) ||
        fetchActions(g.day, 'chat').some((a) => a.seat === doneSeat);
      if (talked) g.blood.spoke[doneSeat].push(g.day);
    }
    const skipped = [];
    g.speechIndex += 1;
    while (g.speechIndex < g.speechOrder.length) {
      const seat = g.speechOrder[g.speechIndex];
      if (!isAliveSeat(seat)) {
        g.speechIndex += 1;
        continue;
      }
      if (!isSeatOnline(seat)) {
        skipped.push(seat);
        g.speechIndex += 1;
        continue;
      }
      break;
    }
    if (skipped.length) {
      g.log.push({ day: g.day, kind: 'system', text: `${skipped.map(pad).join('、')} 号离线，跳过发言` });
    }
    if (g.speechIndex >= g.speechOrder.length) {
      startVote();
      return;
    }
    g.deadline = clock() + SPEECH_MS;
  }

  function handleDaySpecial(actions) {
    const knightSeat = roleSeat('knight');
    const duel = knightSeat != null && !g.knightUsed
      ? actions.find((a) => isAliveSeat(knightSeat) && a.seat === knightSeat && a.payload?.duel)
      : null;
    if (duel) {
      const target = Number(duel.payload.duel);
      g.knightUsed = true;
      if (!isAliveSeat(target) || target === knightSeat) {
        return true;
      }
      if (g.teams.wolves.includes(target)) {
        g.log.push({
          day: g.day,
          kind: 'system',
          text: `骑士 ${pad(knightSeat)} 号决斗 ${pad(target)} 号：${
            pad(target)
          } 号是狼人，立即出局，直接进入黑夜`,
        });
        const deaths = Rules.expandDeaths([{ seat: target, reason: 'duel' }], {
          alive: aliveSet(),
          lovers: g.lovers,
          wolfbeautySeat: roleSeat('wolfbeauty'),
          charmTarget: g.charmTarget,
        });
        const outcome = applyDeaths(deaths, 'day');
        if (outcome === 'continue') civic.afterDeaths('night');
      } else {
        g.log.push({
          day: g.day,
          kind: 'system',
          text: `骑士 ${pad(knightSeat)} 号决斗 ${pad(target)} 号：${
            pad(target)
          } 号是好人，骑士出局，白天继续`,
        });
        const deaths = Rules.expandDeaths([{ seat: knightSeat, reason: 'duel' }], {
          alive: aliveSet(),
          lovers: g.lovers,
          wolfbeautySeat: roleSeat('wolfbeauty'),
          charmTarget: g.charmTarget,
        });
        // Preserve the existing 15-second discussion grace after a failed duel.
        const nextDeadline = Math.max(g.deadline, clock() + 15000);
        const next = {phase:'day', step:'day', deadline:nextDeadline, pausedAt:clock()};
        const outcome = applyDeaths(deaths, 'day');
        if (outcome === 'continue') civic.afterDeaths(next);
        if (outcome === 'pending') g.hunterResume = next;
      }
      return true;
    }

    const boom = findExplodeAction(actions);
    if (boom) {
      resolveExplode(boom);
      return true;
    }
    return false;
  }

  // 普通狼人、白狼王可自爆；狼美人不能自爆
  function findExplodeAction(actions) {
    return actions.find((action) => {
      if (!action.payload?.explode) return false;
      if (!isAliveSeat(action.seat)) return false;
      const row = rowBySeat(action.seat);
      return row && ['wolfking', 'wolfboss', 'werewolf'].includes(row.role);
    }) || null;
  }

  function resolveExplode(action) {
    const seat = action.seat;
    const row = rowBySeat(seat);
    const isKing = row?.role === 'wolfking';
    const isBoss = row?.role === 'wolfboss';
    const canTake = isKing || isBoss;
    let target = canTake && action.payload.target != null ? Number(action.payload.target) : null;
    if (target != null && (!isAliveSeat(target) || target === seat)) target = null;
    // 自爆打断一切白天流程：剩余遗言/确认窗口作废；警上自爆则竞选作废、警徽流失。
    const duringElection = g.phase === 'sheriff';
    g.lastWordsQueue = [];
    g.lastWordsSeat = null;
    g.confirmAfterWords = null;
    if (duringElection) {
      g.sheriff = null;
      g.sheriffDone = true;
      g.sheriffCandidates = null;
      g.policeOrder = null;
      g.runoffSeats = null;
      g.log.push({ day: g.day, kind: 'system', text: '警长竞选被自爆打断，本局警徽流失' });
    }
    g.log.push({
      day: g.day,
      kind: 'system',
      text: `${isKing ? '白狼王' : isBoss ? '狼王' : '狼人'} ${pad(seat)} 号自爆${
        target != null ? `，带走 ${pad(target)} 号` : ''
      }，今天剩余流程全部跳过，立即进入黑夜`,
    });
    // 狼王自爆即视为用掉带人机会：即使只自爆不带人，也不再补开窗口。
    if (isBoss) g.bossUsed = true;
    const raw = [{ seat, reason: 'selfboom' }];
    if (target != null) raw.push({ seat: target, reason: 'explode' });
    const deaths = Rules.expandDeaths(raw, {
      alive: aliveSet(),
      lovers: g.lovers,
      wolfbeautySeat: roleSeat('wolfbeauty'),
      charmTarget: g.charmTarget,
    });
    const outcome = applyDeaths(deaths, 'day');
    if (outcome === 'continue') {
      // 警上自爆不吞首夜遗言：先公布昨夜死讯并留遗言，再入夜。
      if (!announcePending('night')) civic.afterDeaths('night');
    }
  }

  function startVote() {
    g.phase = 'vote';
    g.step = 'vote';
    g.deadline = clock() + SPEECH_MS;
    g.votes = null;
    g.runoffSeats = null;
    g.log.push({
      day: g.day,
      kind: 'vote',
      text: `投票开始（${SPEECH_MS / 1000} 秒），不能投自己，可以弃权`,
    });
  }

  function bloodTallyVotes(rows) {
    const counts = {};
    rows.forEach(({ seat, target }) => {
      if (target == null || target <= 0) return;
      counts[target] = (counts[target] || 0) + (g.blood.voteWeight[seat] || 1);
    });
    let max = 0;
    Object.values(counts).forEach((n) => { if (n > max) max = n; });
    return { counts, top: max === 0 ? [] : Object.keys(counts).filter((k) => counts[k] === max).map(Number), max };
  }

  function resolveVote(actions) {
    const eligible = g.aliveSeats.filter((s) => !g.voteBanned.includes(s));
    let rows = actions.filter((a) => eligible.includes(a.seat) && (a.target === -1 || isAliveSeat(a.target)));
    if (g.phase === 'runoff' && g.runoffSeats) {
      rows = rows.map((a) => ({ ...a, target: g.runoffSeats.includes(a.target) ? a.target : -1 }));
    }
    const voteText = rows.map((a) => `${pad(a.seat)}→${a.target > 0 ? pad(a.target) : '弃'}`).join('、');
    const tally = g.blood ? bloodTallyVotes(rows) : Rules.tallyVotes(rows, g.sheriff);
    g.votes = tally.counts;
    g.voteHistory = g.voteHistory || [];
    g.voteHistory.push({ day: g.day, phase: g.phase, counts: { ...tally.counts } });

    if (voteText) g.log.push({ day: g.day, kind: 'vote', text: `投票结果：${voteText}` });

    if (!tally.top.length) {
      g.log.push({ day: g.day, kind: 'vote', text: '无人得票，本轮无人出局' });
      startNightInternal(false);
      return;
    }

    if (tally.top.length > 1) {
      if (g.phase === 'vote') {
        g.phase = 'runoff';
        g.step = 'runoff';
        g.runoffSeats = tally.top;
        g.deadline = clock() + SPEECH_MS;
        g.log.push({
          day: g.day,
          kind: 'vote',
          text: `平票：${tally.top.map(pad).join('、')} 号进入 PK，请重新投票`,
        });
        return;
      }
      g.log.push({ day: g.day, kind: 'vote', text: '再次平票，本轮无人出局' });
      startNightInternal(false);
      return;
    }

    const target = tally.top[0];
    if (g.blood) {
      rows.filter((a) => a.target === target).forEach((a) => {
        if (isAliveSeat(a.seat)) g.blood.voteHit[a.seat].push(g.day);
      });
    }
    const targetRow = rowBySeat(target);
    g.log.push({ day: g.day, kind: 'vote', text: `${pad(target)} 号得票最多（${tally.counts[target]} 票）` });

    if (targetRow && ['idiot', 'fool'].includes(targetRow.role)) {
      const label = targetRow.role === 'fool' ? '愚者' : '白痴';
      if (!g.idiotRevealed.includes(target)) {
        g.idiotRevealed.push(target);
        g.voteBanned.push(target);
        g.log.push({
          day: g.day,
          kind: 'warning',
          text: `${pad(target)} 号翻开${label}牌，免于放逐，之后失去投票权`,
        });
      } else {
        g.log.push({ day: g.day, kind: 'vote', text: `${pad(target)} 号${label}已翻牌，本轮无人出局` });
      }
      startNightInternal(false);
      return;
    }

    const deaths = Rules.expandDeaths([{ seat: target, reason: 'vote' }], {
      alive: aliveSet(),
      lovers: g.lovers,
      wolfbeautySeat: roleSeat('wolfbeauty'),
      charmTarget: g.charmTarget,
    });
    const outcome = applyDeaths(deaths, 'day');
    if (outcome === 'continue') civic.afterDeaths('night');
  }

  function resolveHunter(actions) {
    const seat = g.hunterPending;
    const role = rowBySeat(seat)?.role || g.hunterRole;
    const isBoss = role === 'wolfboss';
    const label = isBoss ? '狼王' : '猎人';
    const row = actions.find((a) => a.seat === seat);
    const reveal = row?.payload?.reveal ?? (row?.target != null);
    const target = reveal ? row?.target : null;
    const from = g.hunterFrom || 'night';
    g.hunterPending = null;
    g.hunterRole = null;
    g.hunterFrom = null;
    delete g.deathConfirmSeats;
    if (reveal && !isBoss) g.hunterRevealed = true;

    if (target && isAliveSeat(target)) {
      if (g.blood && bloodStar(seat) >= 2) {
        const bonus = bloodStar(seat) - 1;
        g.aliveSeats.forEach((s) => {
          if (!g.teams.wolves.includes(s)) g.blood.gold[s] += bonus;
        });
        bloodLog(`${pad(seat)} 号的 ${bloodStar(seat)} 星猎人留下一笔遗产：存活好人各 +${bonus} 金`);
      }
      // 夜间死因不公开：夜猎开枪不播报翻牌/带走，只公布出局座位。
      if (from !== 'night') {
        g.log.push({
          day: g.day,
          kind: 'death',
          text: `${pad(seat)} 号翻开${label}牌，带走 ${pad(target)} 号`,
        });
      }
      const deaths = Rules.expandDeaths([{ seat: target, reason: isBoss ? 'wolfboss' : 'hunter' }], {
        alive: aliveSet(),
        lovers: g.lovers,
        wolfbeautySeat: roleSeat('wolfbeauty'),
        charmTarget: g.charmTarget,
      });
      markDeaths(deaths, from === 'night' ? 'night' : 'day');
    } else if (reveal && from !== 'night') {
      g.log.push({ day: g.day, kind: 'system', text: `${pad(seat)} 号翻开${label}牌，没有发动` });
    }

    const queued = g.queuedConfirmSeats;
    delete g.queuedConfirmSeats;
    if (queued?.length) {
      openConfirmation(queued, from);
      return;
    }
    const next = g.hunterResume || (from === 'night' ? 'dawn' : 'night');
    delete g.hunterResume;
    if (settleVictory(next) === 'continue') civic.afterDeaths(next);
  }

  function resume(next) {
    if (typeof next === 'object') {
      const { phase, step, deadline, pausedAt } = next;
      const paused = clock() - pausedAt;
      Object.assign(g, { phase, step, deadline: deadline + paused });
      if (phase === 'night') g.stepStart = (next.stepStart ?? deadline - NIGHT_MS) + paused;
    } else if (next === 'dawn') startDawn();
    else if (next === 'day') startDay();
    else if (next === 'discussion') civic.beginDiscussion();
    else startNightInternal(false);
  }

  return {
    start,
    tick,
    depart,
    expectedSeats,
    inTime: timer.inTime,
    record,
    pending,
    get state() {
      return g;
    },
  };
}
