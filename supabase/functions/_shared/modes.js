(function () {
  const ROLES = {
    werewolf: {
      name: '狼人', camp: 'killer', campName: '狼人阵营',
      skill: '狼人阵营。狼牌互相认识，每晚共同睁眼刀掉一名玩家，可空刀或自刀，夜里能在狼频道商量。白天警长竞选、选发言方向、讨论、放逐投票与 PK、遗言阶段均可自爆：翻牌出局，跳过当天剩余流程，立即入夜。',
      explode: '可以',
    },
    wolfking: {
      name: '白狼王', camp: 'killer', campName: '狼人阵营',
      skill: '狼人阵营，拥有狼人全部能力。白天可自爆并带走一名其他存活玩家，立即入夜；被带走者不能发动猎人技能。',
      explode: '可以（可带一人）',
    },
    wolfboss: {
      name: '狼王', camp: 'killer', campName: '狼人阵营',
      skill: '狼人阵营，拥有狼人全部能力。出局时可以翻牌带走一名其他存活玩家；被毒杀、主动离房或被请离时不能发动。白天也可自爆，自爆带人时立即入夜。',
      explode: '可以',
    },
    wolfbeauty: {
      name: '狼美人', camp: 'killer', campName: '狼人阵营',
      skill: '狼人阵营。每晚参与狼刀后可魅惑一名其他存活玩家，不能连续两晚魅惑同一人。你出局时被魅惑者殉情（被骑士决斗出局除外）。本角色不能自爆。',
      explode: '不可以',
    },
    seer: {
      name: '预言家', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。每晚查验一名玩家，得知其是好人还是狼人（不显示具体职业，也不揭示情侣归属）。',
    },
    witch: {
      name: '女巫', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。拥有一瓶解药和一瓶毒药，每晚最多用一瓶，也可都不用。解药救活当晚被刀者，不限首夜、可以自救；毒药毒死任意一名存活玩家。两瓶用尽后不再行动。',
    },
    hunter: {
      name: '猎人', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。出局时可选择翻牌开枪带走一名玩家、翻牌不开枪，或不翻牌保密身份。被毒杀、被白狼王自爆带走、被请离或主动离房时不能开枪。',
    },
    guard: {
      name: '守卫', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。每晚守护一名玩家（可自守），被守护者当晚免疫狼刀；不能连续两晚守同一人。守护不挡毒药与殉情；与女巫同守同救同一人时该玩家仍出局。',
    },
    idiot: {
      name: '白痴', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。被投票放逐时翻牌免死，此后失去投票权但保留发言权，仍可能被狼刀或毒药出局。',
    },
    fool: {
      name: '愚者', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。与白痴同技能：被投票放逐时翻牌免死，此后失去投票权但保留发言权，仍可能被狼刀或毒药出局。',
    },
    knight: {
      name: '骑士', camp: 'police', campName: '好人阵营 · 神职',
      skill: '好人阵营·神职。白天投票前可翻牌与一名玩家决斗（全局一次）：对方是狼牌则对方出局并立即天黑；对方是好人则骑士自己出局，白天继续。决斗狼美人不触发殉情。',
    },
    villager: {
      name: '平民', camp: 'civilian', campName: '好人阵营 · 平民',
      skill: '好人阵营·平民。没有任何特殊功能，每天白天发言并参与放逐投票，放逐自己心目中的狼人，靠逻辑与发言帮好人找狼。',
    },
    cupid: {
      name: '丘比特', camp: 'neutral', campName: '特殊 · 爱神',
      skill: '特殊·爱神。第一晚指定两名玩家成为情侣（可包括自己），情侣互相知道伴侣。若情侣一人一狼，则情侣与丘比特组成第三方，目标是让其他所有人出局；否则丘比特随情侣所在阵营结算。',
    },
    thief: {
      name: '盗贼', camp: 'neutral', campName: '特殊 · 变动阵营',
      skill: '特殊·变动阵营。第一晚从两张随机底牌中选一张作为自己的身份，可能因此加入狼人阵营；新身份当夜立即生效。',
    },
  };

  const MODES = [
    {
      id: 'newbie6',
      name: '6人新手局',
      desc: '第一次玩选这个：2 狼 2 民 + 预言家 + 女巫，无警长，几分钟一局。',
      play: '入门板子：两狼对预言家、女巫两神，本局不设警长、不竞选。好人重点是听查验、合理用药；狼队靠悍跳预言家或藏身份扛推好人。适合熟悉夜晚行动与白天投票的基本节奏。',
      sheriff: false,
      roles: ['werewolf', 'werewolf', 'villager', 'villager', 'seer', 'witch'],
    },
    {
      id: 'std9',
      name: '9人标准局',
      desc: '经典 9 人局：3 狼 3 民 + 预言家、女巫、猎人。',
      play: '三神（预女猎）对三狼。好人靠预言家验人带队、女巫保核、猎人威慑；狼队可悍跳、打格式或倒钩。有警长竞选，警徽归属往往决定白天归票方向。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'villager', 'villager', 'villager', 'seer', 'witch', 'hunter'],
    },
    {
      id: 'std12',
      name: '12人标准局（预女猎守）',
      desc: '最流行的 12 人竞技板子：4 狼 4 民，预言家/女巫/猎人/守卫四神，屠边局。',
      play: '四神（预女猎守）对四狼的屠边局。守卫与女巫的守救博弈（同守同救会奶穿）是核心；好人要保神职、理清狼坑，狼队靠刀法与悍跳撕开神职防线。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter', 'guard'],
    },
    {
      id: 'bww12',
      name: '12人白狼王守卫局',
      desc: '狼队爆发力强：白狼王 + 3 狼 4 民，配预女猎守四神。',
      play: '白狼王可在白天自爆带走一名关键神职（如预言家），打乱好人节奏；好人需防白狼王换神、守卫谨慎守核。狼队爆发力强，好人容错更低。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'wolfking',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter', 'guard'],
    },
    {
      id: 'byh12',
      name: '12人预女猎白',
      desc: '预女猎白：4 狼 4 民 + 预言家、女巫、猎人、白痴。',
      play: '百科同款配置（4 狼 4 民 + 预女猎白）。白痴被投出翻牌免死但失票，是好人阵营的抗推位；狼队常借白痴免死消耗好人轮次。猎人威慑与白痴站边是白天博弈重点。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter', 'idiot'],
    },
    {
      id: 'wmq12',
      name: '12人狼美人骑士局',
      desc: '官方版型：狼美人 + 3 狼 4 民，预言家/女巫/守卫/骑士四神，屠边暗牌。',
      play: '狼美人每晚魅惑一人，出局时带走被魅惑者；骑士决斗可斩狼美人且不触发殉情。好人靠骑士决斗打开缺口，狼队靠魅惑连环带走好人。无猎人，出局确认窗口较少。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'wolfbeauty',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'guard', 'knight'],
    },
    {
      id: 'qbt12',
      name: '12人丘比特局',
      desc: '爱神局：4 狼 4 民 + 预言家、女巫、猎人、丘比特。人狼情侣会组成第三方。',
      play: '第一晚连情侣，可能形成人狼第三方。情侣同生共死，丘比特随情侣阵营或独立第三方结算；场上阵营更复杂，好人与狼都需提防第三方搅局，发言中要留意情侣线索。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter', 'cupid'],
    },
    {
      id: 'dz12',
      name: '12人盗贼局',
      desc: '换牌局：4 狼 4 民 + 预言家、女巫、猎人、盗贼。盗贼从两张底牌里选身份，可能变狼。',
      play: '第一晚盗贼从两张底牌选身份，可能变狼，使狼牌数量不确定。好人不能默认四狼，需结合查验与发言判断盗贼归属；狼队也可能多出一张隐藏狼牌。',
      roles: ['werewolf', 'werewolf', 'werewolf', 'werewolf',
        'villager', 'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter', 'thief'],
    },
    {
      id: 'bloodmoon',
      name: '血月牌局（娱乐）',
      desc: '9 人娱乐局：3 狼 3 民 + 预言家、女巫、猎人。每人 4 气血、金币和手牌；狼刀扣血不直接出局，天亮先领工资逛商店。不计 Elo。',
      play: '夜里狼刀和女巫毒改为扣气血，天亮先领工资、买碎片/装备/补给/魔法骰子，再发言出牌或放技能。放逐仍是直接处决；狼人屠边或好人清狼获胜。',
      sheriff: false,
      rated: false,
      bloodmoon: true,
      roles: ['werewolf', 'werewolf', 'werewolf',
        'villager', 'villager', 'villager',
        'seer', 'witch', 'hunter'],
    },
  ];

  const CUSTOM_ORDER = [
    'werewolf', 'wolfking', 'wolfboss', 'wolfbeauty',
    'villager', 'seer', 'witch', 'hunter', 'guard', 'fool', 'idiot', 'knight', 'cupid', 'thief',
  ];
  const CUSTOM_LIMITS = {
    werewolf: 8, villager: 10, wolfking: 1, wolfboss: 1, wolfbeauty: 1,
    seer: 1, witch: 1, hunter: 1, guard: 1, fool: 1, idiot: 1, knight: 1, cupid: 1, thief: 1,
  };
  const WOLF_ROLE_KEYS = ['werewolf', 'wolfking', 'wolfboss', 'wolfbeauty'];
  const MIN_PLAYERS = 6;
  const MAX_PLAYERS = 12;

  function clampTimer(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(180000, Math.max(30000, Math.round(n / 5000) * 5000));
  }

  // Shared by the browser and the referee: one validator, one mode shape.
  function buildCustomMode(input = {}) {
    const roles = Array.isArray(input.roles) ? input.roles.filter((r) => typeof r === 'string') : [];
    const name = String(input.name || '').trim().slice(0, 20) || '自定义局';
    const custom = {
      name,
      roles: roles.slice(),
      sheriff: input.sheriff !== false,
      nightMs: clampTimer(input.nightMs, 60000),
      speechMs: clampTimer(input.speechMs, 60000),
    };
    let error = '';
    const counts = {};
    if (roles.length < MIN_PLAYERS || roles.length > MAX_PLAYERS) {
      error = `自定义局需要 ${MIN_PLAYERS}–${MAX_PLAYERS} 人`;
    }
    if (!error) {
      for (const role of roles) {
        if (!ROLES[role]) { error = '配置里有未知角色'; break; }
        counts[role] = (counts[role] || 0) + 1;
        const limit = CUSTOM_LIMITS[role] || 0;
        if (counts[role] > limit) {
          error = `${ROLES[role].name}最多 ${limit} 名`;
          break;
        }
      }
    }
    if (!error && !roles.some((role) => WOLF_ROLE_KEYS.includes(role))) {
      error = '至少需要 1 名狼人';
    }
    if (!error && !roles.some((role) => !WOLF_ROLE_KEYS.includes(role))) {
      error = '至少需要 1 名好人角色';
    }
    const mode = {
      id: 'custom',
      name,
      desc: `自定义局，${roles.length} 人；自定义房间不计入 Elo。`,
      play: '人数、职业配比、上警与行动时限由房主决定，胜利条件固定为屠边。',
      sheriff: custom.sheriff,
      rated: false,
      nightMs: custom.nightMs,
      speechMs: custom.speechMs,
      roles,
    };
    return { mode, custom, error };
  }

  function modeFromOptions(options) {
    if (options && options.custom && Array.isArray(options.custom.roles)) {
      const built = buildCustomMode(options.custom);
      if (!built.error) return built.mode;
    }
    return modeById(options && options.mode);
  }

  const CAMPS = {
    killer: { tag: 'sr-tag-killer', bar: 'sr-me-killer', name: '狼人阵营' },
    police: { tag: 'sr-tag-police', bar: 'sr-me-police', name: '好人阵营 · 神职' },
    civilian: { tag: 'sr-tag-civilian', bar: '', name: '好人阵营 · 平民' },
    neutral: { tag: 'sr-tag-neutral', bar: 'sr-me-neutral', name: '特殊角色' },
  };

  function modeById(id) {
    return MODES.find((m) => m.id === id) || MODES[2];
  }

  function summary(mode) {
    const counts = {};
    const order = [];
    mode.roles.forEach((key) => {
      if (!counts[key]) { counts[key] = 0; order.push(key); }
      counts[key] += 1;
    });
    return order.map((key) => `${ROLES[key].name} ×${counts[key]}`).join(' · ');
  }

  globalThis.WOLF_MODES = {
    ROLES, MODES, CAMPS, modeById, summary,
    CUSTOM_ORDER, CUSTOM_LIMITS, buildCustomMode, modeFromOptions,
  };
})();