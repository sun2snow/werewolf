import { buildCustomMode, engine, modeFromOptions, MODES, Rules } from './engine.mjs';
import { hostOf, project, replayEvent, requireGame as check, submit, won } from './protocol.mjs';

const modeFor = (id) => MODES.find((m) => m.id === id);
const rosterSQL = `select id, account_id, name, seat, role, alive, is_bot, departed,
  last_seen <= statement_timestamp()-interval '10 seconds' as heartbeat_due,
  (not departed and (is_bot or last_seen > clock_timestamp()-interval '45 seconds')) as online
  from public.players where room_code=$1 order by joined_at,id`;
const actionSQL = `select a.id,a.day,a.step,a.phase,p.seat,a.target_seat as target,a.payload,a.created_at
  from public.game_actions a join public.players p on p.id=a.player_id where a.match_id=$1`;

// A settlement failure aborts the entire transaction, including the action that triggered it.
export class SettlementError extends Error {
  constructor(matchId, revision, cause) {
    super('本次操作、评分和回放均未保存，可重试结算。', { cause });
    this.retry = { matchId, revision: Number(revision) };
  }
}

async function settle(q, code, g, roster, mode) {
  if (mode.rated === false) {
    g.rating = { unrated: true, k: 0, players: [] };
  } else {
    // All matches acquire overlapping rating rows in the same order, including first-time players.
    const humans = roster.filter((p) => !p.is_bot).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    );
    const entries = [];
    for (const p of humans) {
      await q('insert into public.ratings(name) values($1) on conflict(name) do nothing', [p.name]);
      const [old] = await q('select rating,games,wins from public.ratings where name=$1 for update', [p.name]);
      entries.push({ ...old, seat: p.seat, name: p.name, win: won(g, p) });
    }
    const k = roster.length <= 6 ? 32 : roster.length <= 9 ? 28 : 24;
    const scores = Rules.computeTeamElo(entries, k);
    for (const s of scores) {
      const [counts] = await q(
        `update public.ratings set rating=$2,games=games+1,wins=wins+$3,updated_at=now()
        where name=$1 returning games,wins`,
        [s.name, s.after, s.win ? 1 : 0],
      );
      Object.assign(s, counts, {
        votesReceived: g.voteHistory.reduce((n, v) => n + (v.counts[s.seat] || 0), 0),
      });
    }
    g.rating = { k, players: scores };
  }
  const players = roster.map((p) => ({
    seat: p.seat,
    name: p.name,
    role: p.role,
    is_bot: p.is_bot,
    death: g.deaths.find((d) => d.seat === p.seat) || null,
    kicked: g.kicked.includes(p.seat),
  }));
  const events = [];
  let cursor = '0';
  for (;;) {
    const page = await q(`${actionSQL} and a.id>$2 order by a.id limit 500`, [g.matchId, cursor]);
    events.push(...page.map(replayEvent));
    if (page.length < 500) break;
    cursor = page.at(-1).id;
  }
  const [replay] = await q(
    `insert into public.replays(match_id,room_code,mode,mode_name,winner,win_reason,days,players,log,events,rating)
    values($1,$2,$3,$4,$5,$6,$7,$8::text::jsonb,$9::text::jsonb,$10::text::jsonb,$11::text::jsonb) returning id`,
    [
      g.matchId,
      code,
      mode.id,
      mode.name,
      g.winner,
      g.winReason,
      g.day,
      ...[players, g.log, events, g.rating].map((v) => JSON.stringify(v)),
    ],
  );
  g.replayId = String(replay.id);
}

// q executes on ONE transaction/connection. The caller commits only after this
// returns; any read, scoring, replay or snapshot error rolls everything back.
export async function dispatch(q, uid, cmd) {
  const { op, code } = cmd;
  check(cmd.accountId === uid, '登录账号已变化，请刷新');
  const [account] = await q(`select username,role from public.profiles where id=$1 and status='approved'`, [
    uid,
  ]);
  check(account, '账号未通过审核');
  check(typeof code === 'string' && /^\d{6}$/.test(code), '请输入六位房间码');
  if (op === 'create') {
    let options;
    if (cmd.mode === 'custom') {
      const built = buildCustomMode(cmd.custom);
      check(!built.error, built.error || '自定义配置无效');
      options = { mode: 'custom', phase: 'waiting', custom: built.custom };
    } else {
      check(modeFor(cmd.mode), '未知板子');
      options = { mode: cmd.mode, phase: 'waiting' };
    }
    const made = await q(
      `insert into public.rooms(code,protocol,options) values($1,8,$2::text::jsonb)
      on conflict(code) do nothing returning code`,
      [code, JSON.stringify(options)],
    );
    if (!made.length) return { collision: true };
  }
  const [room] = await q(
    'select options,revision from public.rooms where code=$1 and protocol=8 for update',
    [code],
  );
  if (!room && ['snapshot', 'restore', 'spectate'].includes(op)) return { gone: true };
  check(room, '房间不存在');
  let rows = await q(rosterSQL, [code]);
  let me = rows.find((r) => r.account_id === uid && !r.departed);
  const mode = modeFromOptions(room.options);
  check(mode, '未知板子');
  let g = room.options.g || null;
  let entry = null;
  if (op === 'join' || op === 'create') {
    if (!me) {
      check(!g, '本局已开始');
      check(rows.length < mode.roles.length, '房间已满');
      check(!rows.some((p) => p.name === account.username), '房间里已有同名玩家');
      [me] = await q(
        'insert into public.players(room_code,account_id,name) values($1,$2,$3) returning id,name',
        [code, uid, account.username],
      );
      const [updated] = await q('update public.rooms set revision=revision+1 where code=$1 returning revision', [code]);
      room.revision = updated.revision;
      if (cmd.includeSnapshot === true) {
        rows = await q(rosterSQL, [code]);
        me = rows.find((p) => p.account_id === uid && !p.departed);
      }
    }
    entry = { code, playerId: me.id, name: me.name };
    if (cmd.includeSnapshot !== true) return entry;
  }
  if (op !== 'spectate') {
    if (!me && ['restore', 'snapshot', 'leave'].includes(op)) return { gone: true };
    check(me, '你不是房间成员');
    // A repeated leave for an already absent seat returns gone above, even if
    // the other request won the race. Never apply an old retry to a new seat.
    if (cmd.retry) {
      check(g && g.phase !== 'finished' && cmd.retry.matchId === g.matchId && cmd.retry.revision === Number(room.revision),
        '对局已推进，请按当前状态操作');
    }
    if (op === 'leave' || op === 'kick') {
      // Check the original membership and deal under the room lock, including first attempts.
      // Waiting rooms have no match UUID; their revision also distinguishes successive lobbies.
      check(cmd.playerId === me.id && cmd.matchId === (g?.matchId ?? null) &&
        (g || cmd.lobbyRevision === Number(room.revision)), '房间或对局已变化，请刷新后重试');
    }
    if (op === 'restore') {
      entry = { code, playerId: me.id, name: me.name };
      if (cmd.includeSnapshot !== true) return entry;
    }
    if (cmd.playerId !== me.id && op === 'snapshot') return { gone: true };
    // For entry, the seat was just selected by Auth UID under this room lock.
    check(entry || cmd.playerId === me.id, '房间成员已变化，请刷新');
    // Keep the 45-second presence window without writing on every poll.
    if (me.heartbeat_due) await q('update public.players set last_seen=clock_timestamp() where id=$1', [me.id]);
    me.online = true;
  }
  const before = JSON.stringify(g), wasFinished = g?.phase === 'finished';
  const oldSeats = new Map(rows.map(({ id, role, seat, alive }) => [id, { role, seat, alive }]));
  const privileged = account.role === 'owner';
  let changed = false;
  // Never convert a failed read into an empty vote. Chat is paged separately.
  const actions = g && !wasFinished && op !== 'spectate'
    ? await q(
      `${actionSQL}
    and a.day=$2 and a.step not in ('chat','wolfchat') order by a.id`,
      [g.matchId, g.day],
    )
    : [];
  const referee = engine({ state: g, roster: rows, mode, actions });
  if (op === 'start') {
    check(!g && hostOf(rows) === me.id && rows.length === mode.roles.length, '仅在线房主可在满员时开局');
    referee.start();
  } else if (op === 'reset') {
    check(wasFinished && g.matchId === cmd.matchId && hostOf(rows) === me.id, '不能重置对局');
    await q('delete from public.players where room_code=$1 and departed', [code]);
    await q('update public.players set seat=null,role=null,alive=true where room_code=$1', [code]);
    g = null;
    changed = true;
  } else if (op === 'appoint') {
    check(privileged && !g, '仅入房站长可在发牌前钦定身份');
    const target = rows.find(p => p.id === cmd.id && !p.departed);
    check(target, '玩家不在房间内');
    if (cmd.role !== null) {
      const limit = mode.roles.filter(role => role === cmd.role).length;
      check(limit > 0, '这个板子里没有这个角色');
      check(rows.filter(p => p !== target && p.role === cmd.role).length < limit, '该身份的名额已用完');
    }
    await q('update public.players set role=$2 where id=$1', [target.id, cmd.role]);
    target.role = cmd.role;
    changed = true;
  } else if (op === 'bot') {
    check(privileged && !g && rows.length < mode.roles.length, '不能添加人机');
    let n = 1;
    while (rows.some((p) => p.name === `人机${n}`)) n++;
    await q('insert into public.players(room_code,name,is_bot) values($1,$2,true)', [code, `人机${n}`]);
    changed = true;
  } else if (op === 'kick' || op === 'leave') {
    const p = op === 'leave' ? me : rows.find((p) => p.id === cmd.id && !p.departed);
    check(
      p && (op === 'leave' || (privileged && p !== me && !wasFinished && (!g || p.id !== hostOf(rows)))),
      '不能踢出这名玩家',
    );
    if (g) {
      if (!wasFinished) {
        referee.record(me.seat, op, p.seat, {});
        referee.depart(p.seat, op);
      }
      p.departed = true;
      p.online = false;
      await q('update public.players set departed=true where id=$1', [p.id]);
    } else await q('delete from public.players where id=$1', [p.id]);
    changed = true;
  } else if (op === 'act' || op === 'snapshot' || entry) {
    if (op === 'act') submit(referee, me, cmd, actions);
    referee.tick();
  } else check(op === 'spectate', '不支持的操作');
  if (op !== 'reset') g = referee.state;
  if (referee.pending.length) {
    const events = referee.pending.map((a, seq) => ({
      seq, day:a.day, phase:a.phase, step:a.step, player_id:rows.find(p => p.seat === a.seat).id,
      target_seat:a.target ?? null, payload:a.payload,
    }));
    await q(
      `insert into public.game_actions(match_id,room_code,day,phase,step,player_id,target_seat,payload)
      select $1,$2,a.day,a.phase,a.step,a.player_id,a.target_seat,a.payload
      from jsonb_to_recordset($3::text::jsonb) as a(seq int,day int,phase text,step text,player_id uuid,target_seat int,payload jsonb)
      order by a.seq`,
      [g.matchId, code, JSON.stringify(events)],
    );
  }
  if (g && JSON.stringify(g) !== before) {
    // The room lock protects both snapshots. Phase-only updates need no roster
    // write; deals, transformations and deaths still commit with the game state.
    const seats = [];
    for (const { id, role, seat, alive } of rows) {
      const old = oldSeats.get(id);
      if (role !== old.role || seat !== old.seat || alive !== old.alive) seats.push({ id, role, seat, alive });
    }
    if (seats.length) {
      await q(
        `update public.players as p set role=v.role, seat=v.seat, alive=v.alive
        from jsonb_to_recordset($2::text::jsonb) as v(id uuid, role text, seat int, alive boolean)
        where p.room_code=$1 and p.id=v.id`,
        [code, JSON.stringify(seats)],
      );
    }
    if (!wasFinished && g.phase === 'finished') {
      try {
        await settle(q, code, g, rows, mode);
      } catch (cause) {
        throw new SettlementError(g.matchId, room.revision, cause);
      }
    }
    changed = true;
  }
  if (changed || referee.pending.length) {
    const options = {
      ...room.options,
      mode: mode.id,
      phase: !g ? 'waiting' : g.phase === 'finished' ? 'finished' : 'playing',
      g,
    };
    const [updated] = await q(
      'update public.rooms set options=$2::text::jsonb,revision=revision+1 where code=$1 returning revision',
      [code, JSON.stringify(options)],
    );
    room.revision = updated.revision;
  }
  if (op === 'leave') return { gone: true };
  if (['bot', 'reset', 'kick'].includes(op)) rows = await q(rosterSQL, [code]);
  me = op === 'spectate' ? null : rows.find((p) => p.id === me.id);
  const pub = project(g, me);
  const channel = me && g?.phase === 'night' && Rules.isWolfRole(me.role) ? 'wolfchat' : 'chat';
  const chat = g && (!me || g.phase !== 'night' || channel === 'wolfchat')
    ? await q(
      `select day,payload from public.game_actions
    where match_id=$1 and step=$2 and ($2 <> 'wolfchat' or day=$3) order by id desc limit $4`,
      [g.matchId, channel, g.day, me ? 120 : 500],
    )
    : [];
  const snapshot = {
    code,
    revision: Number(room.revision),
    hostId: hostOf(rows),
    options: {
      mode: mode.id,
      phase: !g ? 'waiting' : g.phase === 'finished' ? 'finished' : 'playing',
      ...(room.options.custom ? { custom: room.options.custom } : {}),
      g: pub,
    },
    members: rows.map(({ id, name, seat, alive, is_bot, online, role }) => ({
      id,
      name,
      seat,
      alive,
      is_bot,
      online,
      ...(g?.phase === 'finished' ? { role, won: won(g, { role, seat }) } : {}),
    })),
    ...(!g && me && privileged ? { appointments: Object.fromEntries(rows.filter(p => p.role).map(p => [p.id, p.role])) } : {}),
    me: me && { id: me.id, seat: me.seat, role: g ? me.role : null },
    ...(me && { chatBatch: true }),
    chat: chat.reverse(),
    channel,
    submitted: me && g
      ? actions.filter((a) => a.seat === me.seat && a.day === g.day && a.step !== 'chat' && a.step !== 'wolfchat')
        .map((a) => `${g.day}:${a.step}`)
      : [],
    wolfPicks: channel === 'wolfchat' && g.step === 'wolves'
      ? actions.filter((a) => a.step === 'wolves' && a.day === g.day).map(({ seat, target }) => ({
        seat,
        target,
      }))
      : [],
  };
  return entry ? { ...entry, snapshot } : snapshot;
}
