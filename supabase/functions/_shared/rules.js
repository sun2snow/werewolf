(function () {
  const WOLF_ROLES = ['werewolf', 'wolfking', 'wolfboss', 'wolfbeauty'];
  const GOD_ROLES = ['seer', 'witch', 'hunter', 'guard', 'idiot', 'fool', 'knight', 'cupid'];

  function isWolfRole(role) {
    return WOLF_ROLES.includes(role);
  }

  function isGodRole(role) {
    return GOD_ROLES.includes(role);
  }

  function groupsFromRoles(rolesBySeat) {
    const wolves = [];
    const gods = [];
    const villagers = [];
    Object.keys(rolesBySeat).forEach((seatKey) => {
      const seat = Number(seatKey);
      const role = rolesBySeat[seatKey];
      if (isWolfRole(role)) wolves.push(seat);
      else if (isGodRole(role)) gods.push(seat);
      else if (role === 'villager') villagers.push(seat);
    });
    return { wolves, gods, villagers };
  }

  // 死亡链：情侣殉情 + 狼美人魅惑对象殉情（被骑士决斗时单死）
  function expandDeaths(initial, ctx) {
    const alive = ctx.alive;
    const deaths = new Map();
    initial.forEach((death) => {
      if (death.seat != null && alive.has(death.seat)) deaths.set(death.seat, death.reason);
    });
    let changed = true;
    while (changed) {
      changed = false;
      for (const entry of [...deaths]) {
        const seat = entry[0];
        const reason = entry[1];
        if (ctx.lovers) {
          const partner = ctx.lovers[0] === seat ? ctx.lovers[1]
            : ctx.lovers[1] === seat ? ctx.lovers[0] : null;
          if (partner != null && alive.has(partner) && !deaths.has(partner)) {
            deaths.set(partner, 'lover');
            changed = true;
          }
        }
        if (seat === ctx.wolfbeautySeat && reason !== 'duel'
          && ctx.charmTarget != null && alive.has(ctx.charmTarget) && !deaths.has(ctx.charmTarget)) {
          deaths.set(ctx.charmTarget, 'charm');
          changed = true;
        }
      }
    }
    return [...deaths.entries()].map(([seat, reason]) => ({ seat, reason }));
  }

  // 狼人各自投票，返回最高票目标（可能并列）
  function wolfKillTop(picks, wolfSeats, alive) {
    const tally = new Map();
    picks.forEach(({ seat, target }) => {
      if (!wolfSeats.includes(seat)) return;
      if (target == null || target <= 0) return;
      if (!alive.has(target)) return;
      tally.set(target, (tally.get(target) || 0) + 1);
    });
    if (!tally.size) return [];
    const max = Math.max(...tally.values());
    return [...tally.entries()].filter(([, n]) => n === max).map(([seat]) => seat);
  }

  function tallyVotes(voteRows, sheriff = null) {
    const counts = {};
    voteRows.forEach(({ seat, target }) => {
      if (target != null && target > 0) counts[target] = (counts[target] || 0) + (sheriff != null && seat === sheriff ? 1.5 : 1);
    });
    let max = 0;
    Object.values(counts).forEach((n) => { if (n > max) max = n; });
    const top = Object.keys(counts).filter((key) => counts[key] === max).map(Number);
    return { counts, top: max === 0 ? [] : top, max };
  }

  // 胜负：爱神第三方 > 屠边/狼刀在先 > 好人
  function winCheck(opts) {
    const alive = opts.alive;
    const teams = opts.teams;
    const lovers = opts.lovers;
    const cupidSeat = opts.cupidSeat;
    const wolvesAlive = teams.wolves.filter((seat) => alive.has(seat));
    const godsAlive = teams.gods.filter((seat) => alive.has(seat));
    const villagersAlive = teams.villagers.filter((seat) => alive.has(seat));

    let thirdActive = false;
    if (lovers) {
      const aWolf = teams.wolves.includes(lovers[0]);
      const bWolf = teams.wolves.includes(lovers[1]);
      thirdActive = aWolf !== bWolf && alive.has(lovers[0]) && alive.has(lovers[1]);
    }

    if (thirdActive) {
      const others = [...alive].filter((seat) => !lovers.includes(seat) && seat !== cupidSeat);
      if (others.length === 0) {
        return { winner: 'lovers', reason: '人狼情侣存活到了最后，第三方阵营获胜' };
      }
    }

    const godsWiped = teams.gods.length > 0 && godsAlive.length === 0;
    const villagersWiped = teams.villagers.length > 0 && villagersAlive.length === 0;
    const wolfWin = !thirdActive && (godsWiped || villagersWiped);
    const goodWin = wolvesAlive.length === 0;

    if (wolfWin) {
      return { winner: 'wolf', reason: godsWiped ? '神职全部出局，狼人屠边获胜' : '平民全部出局，狼人屠边获胜' };
    }
    if (goodWin) {
      return { winner: 'good', reason: '所有狼人均已出局，好人阵营获胜' };
    }
    return null;
  }

  // 团队零和 Elo：每人与所有“胜负不同”的玩家算期望，再让胜方总加分等于负方总扣分
  function computeTeamElo(entries, k) {
    const K = k || 24;
    const players = entries.map((entry) => ({ ...entry, win: Boolean(entry.win) }));
    const raw = players.map((player) => {
      const opponents = players.filter((other) => other.win !== player.win);
      if (!opponents.length) return 0;
      let expected = 0;
      opponents.forEach((other) => {
        expected += 1 / (1 + Math.pow(10, (other.rating - player.rating) / 400));
      });
      expected /= opponents.length;
      return K * ((player.win ? 1 : 0) - expected);
    });
    let winTotal = 0;
    let loseTotal = 0;
    players.forEach((player, index) => {
      if (player.win) winTotal += raw[index];
      else loseTotal += -raw[index];
    });
    const target = (winTotal + loseTotal) / 2;
    const winScale = winTotal > 1e-9 ? target / winTotal : 1;
    const loseScale = loseTotal > 1e-9 ? target / loseTotal : 1;
    const scaled = raw.map((value, index) => value * (players[index].win ? winScale : loseScale));
    const rounded = scaled.map((value) => Math.round(value));
    const residual = rounded.reduce((sum, value) => sum + value, 0);
    if (residual !== 0) {
      let biggest = 0;
      for (let i = 1; i < rounded.length; i += 1) {
        if (Math.abs(rounded[i]) > Math.abs(rounded[biggest])) biggest = i;
      }
      rounded[biggest] -= residual;
    }
    // Distribute only points that losers can pay. Largest remainders keep
    // integer gains proportional without inventing points at the floor.
    const losses = players.map((p, i) => p.win ? 0 : Math.min(Math.max(0, -rounded[i]), Math.max(0, p.rating - 100)));
    const budget = losses.reduce((a, b) => a + b, 0);
    const gains = scaled.map((n, i) => players[i].win ? Math.max(0, n) : 0);
    const sum = gains.reduce((a, b) => a + b, 0);
    const shares = gains.map(n => sum ? budget * n / sum : 0);
    const deltas = shares.map((n, i) => players[i].win ? Math.floor(n) : 0 - losses[i]);
    const remaining = -deltas.reduce((a, b) => a + b, 0);
    players.map((p, i) => i).filter(i => players[i].win)
      .sort((a, b) => (shares[b] - deltas[b]) - (shares[a] - deltas[a]))
      .slice(0, remaining).forEach(i => { deltas[i] += 1; });
    return players.map((player, index) => ({
      seat: player.seat,
      name: player.name,
      win: player.win,
      delta: deltas[index],
      before: player.rating,
      after: player.rating + deltas[index],
    }));
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  const api = {
    WOLF_ROLES,
    GOD_ROLES,
    isWolfRole,
    isGodRole,
    groupsFromRoles,
    expandDeaths,
    wolfKillTop,
    tallyVotes,
    winCheck,
    computeTeamElo,
    shuffle,
  };

  globalThis.WolfRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
