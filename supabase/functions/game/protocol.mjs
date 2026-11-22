import { Rules } from './engine.mjs';

const SHOOTER_ROLES = ['hunter', 'wolfboss'];

export class GameError extends Error {}
export function requireGame(condition, message) {
  if (!condition) throw new GameError(message);
}
export const hostOf = (roster) => roster.find((p) => !p.is_bot && !p.departed && p.online)?.id ?? null;
export function won(g, row) {
  const lovers = g.lovers || [], wolves = g.teams.wolves;
  const mixed = lovers.length === 2 && wolves.includes(lovers[0]) !== wolves.includes(lovers[1]);
  if (mixed && (lovers.includes(row.seat) || row.seat === g.cupidSeat)) return g.winner === 'lovers';
  if (g.winner === 'lovers') return false;
  const wolfTeam = row.role === 'cupid'
    ? lovers.length > 0 && lovers.every((s) => wolves.includes(s))
    : wolves.includes(row.seat);
  return wolfTeam === (g.winner === 'wolf');
}

// Positive list: adding a field to the referee state must never publish it.
export function project(g, me) {
  if (!g) return null;
  const out = {};
  for (
    const k of [
      'matchId',
      'mode',
      'day',
      'phase',
      'deadline',
      'aliveSeats',
      'speechOrder',
      'speechIndex', 'sheriff', 'sheriffCandidates', 'policeOrder', 'policeIndex', 'speechDir',
      'voteBanned',
      'runoffSeats',
      'knightUsed',
      'kicked',
      'log',
      'winner',
      'winReason',
    ]
  ) out[k] = g[k];
  // 首日竞选期间死讯未公布：对外仍显示这些座位存活。
  if (g.nightPending?.length) {
    out.aliveSeats = [...g.aliveSeats, ...g.nightPending.map((d) => d.seat)].sort((a, b) => a - b);
  }
  // A pending choice is private, not a public reveal of the victim's role.
  if (g.phase === 'hunter') out.phase = 'settling';
  out.step = out.phase === 'settling' ? 'settling' : g.phase === 'night' ? 'night' : g.step;
  if (g.phase === 'badge') out.badgePending = g.badgePending;
  if (g.phase === 'lastwords') out.lastWordsSeat = g.lastWordsSeat;
  if (g.phase === 'finished') {
    Object.assign(out, {
      rating: g.rating,
      deaths: g.deaths,
      voteHistory: g.voteHistory,
      replayId: g.replayId,
    });
  }
  if (!me || me.departed) return out;
  if (g.nightPending?.some((d) => d.seat === me.seat)) out.pendingDead = true;
  if (g.phase === 'hunter' && me.seat === g.hunterPending) {
    Object.assign(out, { phase: 'hunter', step: 'hunter', hunterPending: me.seat });
  } else if (g.phase === 'hunter' && g.deathConfirmSeats?.includes(me.seat)) {
    out.step = 'deathConfirm'; // only the victim sees the confirmation button
  }
  const wolf = Rules.isWolfRole(me.role);
  if (g.phase === 'night' && (me.role === g.step || (wolf && g.step === 'wolves'))) out.step = g.step;
  if (wolf) out.teams = { wolves: g.teams.wolves };
  if (me.role === 'guard') out.lastGuard = g.lastGuard;
  if (me.role === 'wolfbeauty') out.lastCharm = g.lastCharm;
  if (me.role === 'thief') Object.assign(out, { thiefSeat: me.seat, thiefCards: g.thiefCards });
  if (me.role === 'witch' && g.step === 'witch' && g.aliveSeats.includes(me.seat)) {
    Object.assign(out, { kill: g.aliveSeats.includes(g.kill) ? g.kill : null, potions: g.potions });
  }
  if (me.role === 'seer') out.checks = g.checks.filter((c) => c.seat === me.seat);
  if (g.lovers && (me.role === 'cupid' || g.lovers.includes(me.seat))) {
    out.lovers = g.lovers;
    out.mixedLovers = g.teams.wolves.includes(g.lovers[0]) !== g.teams.wolves.includes(g.lovers[1]);
  }
  return out;
}

// Accept intent only. Actor, chat name, phase and replay event are server-derived.
export function submit(engine, me, cmd, actions) {
  const g = engine.state, { step, target = null, payload = {} } = cmd, seat = me.seat;
  requireGame(
    g && cmd.matchId === g.matchId && cmd.day === g.day && g.phase !== 'finished',
    '阶段已结束，请刷新',
  );
  const alive = (s) => g.aliveSeats.includes(s);
  const repeat = actions.some((a) => a.day === g.day && a.step === step && a.seat === seat);
  const check = (value) => requireGame(value, '当前不能执行这个行动');
  check(!me.departed);
  if (step === 'deathConfirm') {
    check(g.phase === 'hunter' && g.deathConfirmSeats?.includes(seat) && seat !== g.hunterPending &&
      !repeat && target === null && !payload.reveal && engine.inTime(seat));
    engine.record(seat, step, null, {});
    return;
  }
  const lastTurn = g.phase === 'lastwords' && g.lastWordsSeat === seat;
  const policeTurn = g.phase === 'sheriff' && g.step === 'policeSpeech' && g.policeOrder[g.policeIndex] === seat;
  check(alive(seat) || (step === 'hunter' && seat === g.hunterPending) ||
    (step === 'badge' && g.phase === 'badge' && g.badgePending === seat) ||
    (lastTurn && ['chat','lastwords'].includes(step)));
  const special = step === 'day' || step === 'wolfchat' ||
    (['vote', 'runoff', 'explode'].includes(step) && payload.explode === true &&
      ['werewolf', 'wolfking', 'wolfboss'].includes(me.role));
  check(engine.inTime(seat, special));
  if (step === 'chat' || step === 'wolfchat' || step === 'speech') {
    if (step === 'wolfchat') check(g.phase === 'night' && Rules.isWolfRole(me.role));
    else {
      const normal = g.phase === 'day' && g.speechOrder[g.speechIndex] === seat;
      check(normal || (step === 'chat' && (lastTurn || policeTurn)));
      if (step === 'chat' && (payload.turn !== undefined || payload.texts !== undefined)) {
        requireGame(normal && payload.turn === g.speechIndex, '讨论发言轮次已变化，请核对后重试');
      }
      const end = lastTurn ? 'lastwords' : policeTurn ? 'policeSpeech' : 'speech';
      check(!actions.some(a => a.step === end && a.seat === seat && a.day === g.day));
    }
    if (step === 'speech') {
      check(payload.turn === g.speechIndex);
      engine.record(seat, step, null, { turn: g.speechIndex });
    } else {
      const texts = payload.texts === undefined ? [payload.text] : payload.texts;
      check(payload.texts === undefined || step === 'chat');
      check(Array.isArray(texts) && texts.length > 0 && texts.length <= 12 &&
        texts.every(text => typeof text === 'string' && text.length <= 200 && text.trim()));
      for (const text of texts) engine.record(seat, step, null, { name: me.name, text: text.trim() });
    }
    return;
  }
  if (['day', 'vote', 'runoff', 'explode'].includes(step) && payload.explode === true) {
    check(['day', 'vote', 'runoff', 'sheriff', 'order', 'lastwords'].includes(g.phase) &&
      ['werewolf', 'wolfking', 'wolfboss'].includes(me.role));
    check(target === null ||
      (['wolfking', 'wolfboss'].includes(me.role) && alive(target) && target !== seat));
    engine.record(seat, 'explode', target, { explode: true, target });
    return;
  }
  check(step === g.step && !repeat);
  if (step === 'day') {
    check(me.role === 'knight' && !g.knightUsed && alive(target) && target !== seat);
    engine.record(seat, step, target, { duel: target });
    return;
  }
  check(engine.expectedSeats(step).includes(seat));
  let data = {};
  switch (step) {
    case 'policeSignup':
      check(typeof payload.run === 'boolean'); data = {run:payload.run}; break;
    case 'policeSpeech':
      check(policeTurn && payload.turn === g.policeIndex); data = {turn:g.policeIndex}; break;
    case 'policeVote': case 'policeRunoff': {
      const pool = step === 'policeVote' ? g.sheriffCandidates : g.runoffSeats;
      check(target === -1 || (alive(target) && pool.includes(target))); break;
    }
    case 'order':
      check(['cw','ccw'].includes(payload.dir)); data = {dir:payload.dir}; break;
    case 'badge':
      check(target === -1 || alive(target)); break;
    case 'lastwords':
      check(lastTurn && payload.end === true); data = {end:true}; break;
    case 'thief':
      check([0, 1].includes(payload.card));
      data = { card: payload.card };
      break;
    case 'cupid':
      check(alive(payload.a) && alive(payload.b) && payload.a !== payload.b);
      data = { a: payload.a, b: payload.b };
      break;
    case 'wolves':
      check(alive(target));
      break;
    case 'guard':
      check(alive(target) && target !== g.lastGuard);
      break;
    case 'wolfbeauty':
      check(alive(target) && target !== seat && target !== g.lastCharm);
      break;
    case 'seer':
      check(alive(target) && target !== seat);
      break;
    case 'witch':
      if (payload.save) {
        check(g.potions.save && alive(g.kill) && payload.poison == null);
        data = { save: true };
      }
      if (payload.poison != null) {
        check(g.potions.poison && alive(payload.poison));
        data = { poison: payload.poison };
      }
      break;
    case 'vote':
    case 'runoff':
      check(
        target === -1 ||
          (alive(target) && target !== seat && (step !== 'runoff' || g.runoffSeats.includes(target))),
      );
      break;
    case 'hunter': {
      check(g.phase === 'hunter' && seat === g.hunterPending && SHOOTER_ROLES.includes(me.role));
      const reveal = payload.reveal ?? (target !== null); // accept the previous v8 client too
      check(typeof reveal === 'boolean' && (target === null || (reveal && alive(target))));
      data = { reveal, boss: me.role === 'wolfboss' };
      break;
    }
    default:
      check(false);
  }
  engine.record(seat, step, target, data);
}

export function replayEvent(a) {
  const { seat, day, step, phase, target, payload, created_at: at } = a;
  const t = payload.explode
    ? 'explode'
    : payload.duel
    ? 'duel'
    : step === 'hunter'
    ? 'hunter'
    : ['chat', 'wolfchat', 'speech', 'kick', 'leave', 'afk', 'deathConfirm', 'policeSignup', 'policeSpeech', 'policeVote', 'policeRunoff', 'order', 'badge', 'lastwords'].includes(step)
    ? step
    : ['vote', 'runoff'].includes(step)
    ? 'vote'
    : 'night';
  return { t, phase, day, step, seat, target, payload, at, name: payload.name, text: payload.text };
}
