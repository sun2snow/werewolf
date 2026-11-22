// Public daytime scenes. The caller persists all transitions under the room lock.
export const civicPhase = (phase) => ['sheriff', 'order', 'badge', 'lastwords'].includes(phase);

export function speechOrder(seats, start, dir) {
  const cycle = [...seats].sort((a, b) => dir === 'ccw' ? b - a : a - b);
  const i = Math.max(0, cycle.findIndex((s) => dir === 'ccw' ? s <= start : s >= start));
  return cycle.slice(i).concat(cycle.slice(0, i));
}

export function civicScenes(state, { enterStep, startDay, isBotSeat, isSeatOnline, tallyVotes, resume, openConfirm, announcePending, startShop }) {
  const log = (text) => state().log.push({ day: state().day, kind: 'system', text });
  function enter(phase, step = phase) {
    state().phase = phase;
    enterStep(step);
  }
  function beginDiscussion() {
    const g = state();
    if (g.aliveSeats.includes(g.sheriff) && g.aliveSeats.length > 1) {
      enter('order');
      log(`警长 ${g.sheriff} 号决定今天的发言方向`);
    } else startDay();
  }
  function sunrise() {
    const g = state();
    if (g.blood && typeof startShop === 'function') return startShop();
    if (g.day !== 1 || g.sheriffDone) return beginDiscussion();
    enter('sheriff', 'policeSignup');
    log('第 1 天警长竞选开始，请选择是否上警');
  }
  function elect(seat) {
    const g = state();
    g.sheriff = seat;
    g.sheriffDone = true;
    g.runoffSeats = null;
    log(seat == null ? '本局没有选出警长，警徽流失' : `${seat} 号当选警长，放逐票算 1.5 票`);
    // 首日先公布首夜死讯、确认与遗言、警徽移交，再由最终持徽者选发言方向。
    if (g.day === 1 && g.nightPending) announcePending('discussion');
    else beginDiscussion();
  }
  function expected(step) {
    const g = state();
    switch (step) {
      case 'policeSignup':
        return g.aliveSeats;
      case 'policeSpeech':
        return [g.policeOrder[g.policeIndex]].filter((s) => g.aliveSeats.includes(s));
      case 'policeVote':
      case 'policeRunoff':
        return g.aliveSeats.filter((s) => !g.sheriffCandidates.includes(s));
      case 'order':
        return g.aliveSeats.includes(g.sheriff) ? [g.sheriff] : [];
      case 'badge':
        return g.badgePending == null ? [] : [g.badgePending];
      case 'lastwords':
        return [g.lastWordsSeat];
      default:
        return [];
    }
  }
  function resolve(rows) {
    const g = state(), step = g.step;
    const eligible = expected(step);
    const valid = rows.filter((r) => eligible.includes(r.seat));
    if (step === 'policeSignup') {
      const seats = valid.filter((r) => r.payload.run).map((r) => r.seat).sort((a, b) => a - b);
      g.sheriffCandidates = seats;
      if (seats.length < 2) return elect(seats[0] ?? null);
      g.policeOrder = seats;
      g.policeIndex = 0;
      log(`上警座位：${seats.join('、')}，依次发言`);
      enter('sheriff', 'policeSpeech');
    } else if (step === 'policeSpeech') {
      if (++g.policeIndex < g.policeOrder.length) enter('sheriff', step);
      else {
        enter('sheriff', 'policeVote');
        log('候选人发言结束，请警下玩家投票');
      }
    } else if (step === 'policeVote' || step === 'policeRunoff') {
      const candidates = step === 'policeVote' ? g.sheriffCandidates : g.runoffSeats;
      const votes = valid.filter((r) => candidates.includes(r.target) && g.aliveSeats.includes(r.target));
      const { top } = tallyVotes(votes);
      if (votes.length) log(`警下投票：${votes.map((r) => `${r.seat}→${r.target}`).join('、')}`);
      if (top.length > 1 && step === 'policeVote') {
        g.runoffSeats = top;
        enter('sheriff', 'policeRunoff');
        log(`警长 PK：${top.join('、')} 号`);
      } else elect(top.length === 1 ? top[0] : null);
    } else if (step === 'order') {
      g.speechDir = valid[0]?.payload.dir === 'ccw' ? 'ccw' : 'cw';
      if (g.sheriff != null) log(`今天${g.speechDir === 'ccw' ? '逆' : '顺'}时针发言，警长最后发言`);
      startDay();
    } else if (step === 'badge') {
      const seat = valid[0]?.target;
      g.sheriff = g.aliveSeats.includes(seat) ? seat : null;
      g.badgePending = null;
      log(g.sheriff ? `警徽移交给 ${seat} 号` : '警徽作废');
      advance();
    } else if (step === 'lastwords') {
      g.lastWordsSeat = null;
      advance();
    }
  }
  function death({ seat, reason }, when) {
    const g = state();
    if (g.sheriff === seat) {
      if (['selfboom', 'kick', 'leave'].includes(reason)) {
        g.sheriff = null;
        g.badgePending = null;
        log('警徽作废');
      } else g.badgePending = seat;
    }
    // 遗言规则：首夜死者有遗言（按座位从小到大）；第二夜起夜死无遗言；
    // 白天放逐/技能连带有遗言；自爆、被白狼王带走、决斗、踢出/离开无遗言。
    if (
      !['selfboom', 'kick', 'leave', 'duel', 'explode'].includes(reason) &&
      (when === 'day' || g.day === 1) &&
      !isBotSeat(seat)
    ) {
      (g.lastWordsQueue ??= []).push(seat);
      if (when === 'night') g.lastWordsQueue.sort((a, b) => a - b);
    }
  }
  function advance() {
    const g = state();
    while (g.lastWordsQueue?.length) {
      const seat = g.lastWordsQueue.shift();
      if (!isSeatOnline(seat)) {
        log(`${seat} 号离线，跳过遗言`);
        continue;
      }
      g.lastWordsSeat = seat;
      enter('lastwords');
      log(`${seat} 号发表遗言`);
      return;
    }
    // 白天被放逐者先说遗言，再进入猎人/出局确认窗口开枪。
    if (g.confirmAfterWords) {
      const pending = g.confirmAfterWords;
      delete g.confirmAfterWords;
      // The window resumes whatever the whole words+confirm chain was heading to.
      g.hunterResume = g.sceneResume;
      delete g.sceneResume;
      openConfirm(pending.seats, pending.when);
      return;
    }
    if (g.badgePending != null) {
      enter('badge');
      log(`${g.badgePending} 号处理警徽`);
      return;
    }
    const next = g.sceneResume;
    delete g.sceneResume;
    resume(next);
  }
  function afterDeaths(next) {
    const g = state();
    // A departure during an existing scene must not overwrite its continuation.
    if (next?.phase === 'badge' || next?.phase === 'lastwords') return resume(next);
    g.sceneResume = next;
    advance();
  }
  return { sunrise, beginDiscussion, expected, resolve, death, afterDeaths };
}
