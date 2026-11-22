import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomMode, engine, modeFromOptions } from '../supabase/functions/game/engine.mjs';
import { submit } from '../supabase/functions/game/protocol.mjs';

const ROLES = ['werewolf', 'wolfboss', 'villager', 'villager', 'seer', 'witch'];

function custom(roles = ROLES, timers = {}) {
  const built = buildCustomMode({ roles, sheriff: false, ...timers });
  assert.equal(built.error, '');
  let now = 1_000_000;
  const roster = built.mode.roles.map((_, i) => ({ id: 'p' + i, online: true, is_bot: false }));
  const actions = [];
  const ref = engine({ state: null, roster, mode: built.mode, actions, clock: () => now });
  ref.start();
  const g = ref.state;
  const row = (role) => roster.find((p) => p.role === role);
  const as = (role, step, target = null, payload = {}) => submit(
    ref, row(role), { matchId: g.matchId, day: g.day, step, target, payload }, actions,
  );
  const advance = (ms = 200_000) => { now += ms; ref.tick(); };
  return { built, g, ref, roster, row, as, advance, now: () => now };
}

test('custom mode validates composition, clamps timers and keeps the room name', () => {
  const built = buildCustomMode({
    name: '周五晚局', roles: ROLES, sheriff: false, nightMs: 75_000, speechMs: 90_000,
  });
  assert.equal(built.error, '');
  assert.equal(built.mode.name, '周五晚局');
  assert.equal(built.mode.rated, false);
  assert.equal(built.mode.nightMs, 75_000);
  assert.equal(built.mode.speechMs, 90_000);
  assert.equal(built.mode.sheriff, false);
  assert.equal(modeFromOptions({ mode: 'custom', custom: built.custom }).roles.length, 6);
  assert.match(buildCustomMode({ roles: ['werewolf', 'villager'] }).error, /6–12/);
  assert.match(buildCustomMode({ roles: ['villager', 'villager', 'villager', 'villager', 'villager', 'villager'] }).error, /狼人/);
  assert.match(buildCustomMode({ roles: ['werewolf', 'werewolf', 'werewolf', 'seer', 'seer', 'seer'] }).error, /预言家/);
});

test('custom timers drive night and speech deadlines', () => {
  const { g, advance, as, now } = custom(ROLES, { nightMs: 75_000, speechMs: 90_000 });
  assert.equal(g.phase, 'night');
  assert.equal(g.deadline - 1_000_000, 75_000);
  const target = g.aliveSeats.find((s) => !g.teams.wolves.includes(s));
  as('werewolf', 'wolves', target);
  as('wolfboss', 'wolves', target);
  advance(0);
  assert.equal(g.step, 'witch');
  assert.equal(g.deadline - 1_000_000, 75_000);
  for (let i = 0; i < 6 && g.phase === 'night'; i++) advance(75_000);
  assert.notEqual(g.phase, 'night');
  while (g.phase === 'dawn' || g.phase === 'hunter') advance(60_000);
  assert.equal(g.phase, 'lastwords');
  assert.equal(g.deadline - now(), 90_000);
});

test('a wolf king may take one player when knifed, but poison does not trigger it', () => {
  const knifed = custom(ROLES);
  const boss = knifed.row('wolfboss').seat;
  const victim = knifed.g.aliveSeats.find((s) => s !== boss && !knifed.g.teams.wolves.includes(s));
  for (const seat of knifed.g.teams.wolves) {
    const row = knifed.roster.find((p) => p.seat === seat);
    submit(knifed.ref, row, { matchId: knifed.g.matchId, day: 1, step: 'wolves', target: boss, payload: {} }, []);
  }
  knifed.ref.tick();
  for (let i = 0; i < 6 && knifed.g.phase === 'night'; i++) knifed.advance();
  assert.equal(knifed.g.phase, 'hunter');
  assert.equal(knifed.g.hunterPending, boss);
  knifed.as('wolfboss', 'hunter', victim, { reveal: true });
  knifed.ref.tick();
  assert.ok(knifed.g.deaths.some((d) => d.seat === victim && d.reason === 'wolfboss'));

  const poisoned = custom(ROLES);
  const boss2 = poisoned.row('wolfboss').seat;
  const villager = poisoned.row('villager').seat;
  for (const seat of poisoned.g.teams.wolves) {
    const row = poisoned.roster.find((p) => p.seat === seat);
    submit(poisoned.ref, row, { matchId: poisoned.g.matchId, day: 1, step: 'wolves', target: villager, payload: {} }, []);
  }
  poisoned.ref.tick();
  poisoned.as('witch', 'witch', null, { poison: boss2 });
  for (let i = 0; i < 6 && poisoned.g.phase === 'night'; i++) poisoned.advance();
  assert.ok(poisoned.g.deaths.some((d) => d.seat === boss2 && d.reason === 'poison'));
  assert.ok(!(poisoned.g.deathConfirmSeats || []).includes(boss2));
  assert.equal(poisoned.g.hunterPending, null);
});

test('a voted-out wolf king still takes one player; self-exploding without a target does not reopen the window', () => {
  const voted = custom(ROLES);
  const boss = voted.row('wolfboss').seat;
  const victim = voted.g.aliveSeats.find((s) => s !== boss && !voted.g.teams.wolves.includes(s));
  Object.assign(voted.g, { phase: 'vote', step: 'vote', deadline: voted.now() + 90_000 });
  for (const p of voted.roster) {
    const target = p.seat === boss ? -1 : boss;
    submit(voted.ref, p, { matchId: voted.g.matchId, day: voted.g.day, step: 'vote', target, payload: {} }, []);
  }
  voted.ref.tick();
  assert.equal(voted.g.phase, 'lastwords');
  voted.as('wolfboss', 'lastwords', null, { end: true });
  voted.ref.tick();
  assert.equal(voted.g.phase, 'hunter');
  assert.equal(voted.g.hunterPending, boss);
  voted.as('wolfboss', 'hunter', victim, { reveal: true });
  voted.ref.tick();
  assert.ok(voted.g.deaths.some((d) => d.seat === victim && d.reason === 'wolfboss'));

  const exploded = custom(ROLES);
  const boss2 = exploded.row('wolfboss').seat;
  Object.assign(exploded.g, { phase: 'day', step: 'day', deadline: exploded.now() + 90_000 });
  exploded.as('wolfboss', 'explode', null, { explode: true });
  exploded.ref.tick();
  assert.ok(exploded.g.deaths.some((d) => d.seat === boss2 && d.reason === 'selfboom'));
  assert.equal(exploded.g.hunterPending, null);
  assert.equal(exploded.g.bossUsed, true);
  assert.equal(exploded.g.phase, 'night');
});
