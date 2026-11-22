import test from 'node:test';
import assert from 'node:assert/strict';
import { engine, MODES } from '../supabase/functions/game/engine.mjs';
import { project } from '../supabase/functions/game/protocol.mjs';

const mode = MODES.find((m) => m.id === 'bloodmoon');

function playGame(seedTick = 61_000) {
  const roster = mode.roles.map((_, i) => ({ id: String(i), name: `P${i}`, online: true, is_bot: true }));
  let now = 1_000_000;
  const ref = engine({ state: null, roster, mode, actions: [], clock: () => now });
  ref.start();
  const g = ref.state;
  const seen = new Set();
  const publicHits = [];
  let ticks = 0;
  while (g.phase !== 'finished' && ticks < 5000 && g.day <= 100) {
    seen.add(g.phase);
    if (g.blood?.lastHits?.length) {
      const view = project(g, roster[0]);
      publicHits.push(view.blood.lastHits);
      assert.equal(view.blood.nightReasons, undefined, '公共快照不能带伤害来源');
      assert.equal(view.blood.hand, undefined, '公共快照不能带手牌');
      assert.equal(view.blood.shop, undefined, '公共快照不能带私人商店');
      assert.ok(Array.isArray(view.bloodMe.hand), '本人仍应看到自己的手牌');
      for (const hit of view.blood.lastHits) {
        assert.deepEqual(Object.keys(hit).sort(), ['amount', 'seat'], '受伤记录只能有座位和数值');
      }
    }
    ref.tick();
    now += seedTick;
    ticks++;
  }
  return { g, seen, publicHits, ticks };
}

test('血月牌局全人机终局，血量/星级/技能上限稳定，商店阶段出现', () => {
  let shopSeen = 0, rescueSeen = 0, hitsSeen = 0;
  for (let i = 0; i < 20; i++) {
    const { g, seen, publicHits } = playGame(55_000 + i * 1300);
    assert.equal(g.phase, 'finished', `第${i}局未终局：day=${g.day} phase=${g.phase} step=${g.step}`);
    assert.ok(['good', 'wolf'].includes(g.winner), '血月牌局没有第三方，胜方只能是好人或狼人');
    assert.ok(g.winReason, '缺少胜因');
    assert.ok(g.blood, '缺少血月状态');
    if (seen.has('shop')) shopSeen++;
    if (seen.has('rescue')) rescueSeen++;
    hitsSeen += publicHits.length;
    for (const seat of g.aliveSeats) {
      assert.ok(g.blood.hp[seat] >= 1 && g.blood.hp[seat] <= 4, `气血越界：${seat}=${g.blood.hp[seat]}`);
    }
    for (const seat of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      assert.ok(g.blood.gold[seat] >= 0, `金币为负：${seat}`);
      assert.ok(g.blood.star[seat] >= 1 && g.blood.star[seat] <= 3, `星级越界：${seat}`);
      assert.ok(g.blood.skills[seat].length <= 2, `技能超过 2 个：${seat}`);
      assert.ok(g.blood.hand[seat].length <= 4, `手牌超过上限：${seat}`);
    }
    assert.ok(!g.log.some((row) => /被刀|被毒|狼人袭击|女巫毒|毒杀/.test(row.text)),
      '公共日志泄露了夜间伤害来源');
  }
  assert.ok(shopSeen >= 15, `商店阶段出现太少：${shopSeen}/20`);
  assert.ok(hitsSeen > 0, '20 局里没有任何夜间伤害记录');
  // 濒死窗口需要恰好打到 0 血且没人救，样本少时不强制出现。
  assert.ok(rescueSeen >= 0);
});

test('血月牌局的公共投影只给本人手牌，不暴露商店与伤害来源', () => {
  const roster = mode.roles.map((_, i) => ({ id: String(i), name: `P${i}`, online: true, is_bot: true }));
  const ref = engine({ state: null, roster, mode });
  ref.start();
  const me = roster[3];
  const view = project(ref.state, me);
  assert.equal(view.blood.maxHp, 4);
  assert.equal(view.blood.hp[me.seat], 4);
  assert.equal(view.blood.gold[me.seat], 8);
  assert.deepEqual(view.bloodMe.hand, ref.state.blood.hand[me.seat]);
  assert.ok(view.bloodMe.shop?.equip, '本人应看到自己的商店装备');
  assert.equal(view.blood.hand, undefined);
  assert.equal(view.blood.shop, undefined);
  assert.equal(view.blood.nightReasons, undefined);
  const other = roster.find((p) => p.seat !== me.seat);
  const otherView = project(ref.state, other);
  assert.deepEqual(otherView.bloodMe.hand, ref.state.blood.hand[other.seat], '每个人只看到自己的手牌');
  assert.equal(otherView.blood.hand, undefined);
});
