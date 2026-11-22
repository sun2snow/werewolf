(function () {
  const MAX_HP = 4;
  const START_GOLD = 8;
  const HAND_LIMIT = 3;
  const CARD_POOL = [
    ['sha', 40],
    ['shan', 30],
    ['tao', 20],
    ['chai', 10],
  ];
  const CARDS = {
    sha: { name: '杀', desc: '对一名玩家造成 1 点伤害；目标有「闪」时自动抵消。' },
    shan: { name: '闪', desc: '被「杀」指定时自动打出，抵消这次伤害。' },
    tao: { name: '桃', desc: '回复 2 点气血，最多 4；夜里濒死时可以用来救人。' },
    chai: { name: '拆', desc: '拆掉目标装备；目标没有装备则失去 1 金。' },
  };
  const EQUIPMENT = {
    bagua: {
      name: '八卦阵',
      desc: '每局一次：免疫一次狼刀或「杀」的伤害；3 星狼刀无视。',
    },
    renwang: {
      name: '仁王盾',
      desc: '受到的每次伤害 -1，最低 1。',
    },
  };
  const SKILLS = {
    rijin: { name: '日进斗金', tier: 'common', type: 'passive', desc: '每天发工资时额外 +2 金。' },
    shouqi: { name: '手气不错', tier: 'common', type: 'passive', desc: '每天多摸 1 张牌，手牌上限 +1。' },
    xiaoshi: { name: '小试身手', tier: 'common', type: 'active', desc: '弃 1 张手牌，摸 1 张牌。' },
    jianji: { name: '见机行事', tier: 'common', type: 'trigger', desc: '成为「杀」的目标时，摸 1 张牌。' },
    tunji: { name: '囤积癖', tier: 'common', type: 'passive', desc: '利息上限 +1（最多 +4）。' },
    qingzhuang: { name: '轻装上阵', tier: 'common', type: 'passive', desc: '没有装备时，受到的伤害 -1（最低 1）。' },

    shunshou: { name: '顺手牵羊', tier: 'rare', type: 'active', target: 'other', desc: '获得另一名玩家 1 金。' },
    bingliang: { name: '兵粮寸断', tier: 'rare', type: 'active', target: 'other', desc: '选择一名玩家，他下次发工资少 3 金。' },
    lebu: { name: '乐不思蜀', tier: 'rare', type: 'active', target: 'other', desc: '选择一名玩家，他明天的商店锁定，不能购买。' },
    yiya: { name: '以牙还牙', tier: 'rare', type: 'trigger', desc: '受到其他玩家牌造成的伤害后，对其造成 1 点伤害；每天 1 次。' },
    juedou: { name: '决斗', tier: 'rare', type: 'active', target: 'other', desc: '目标弃 1 张「杀」，否则受到 2 点伤害。' },
    taoyuan: { name: '桃园结义', tier: 'rare', type: 'limited', desc: '所有存活玩家回复 1 点气血（最多 4）。每局 1 次。' },

    niepan: { name: '涅槃', tier: 'legendary', type: 'limited', desc: '濒死时自动回复到 2 气血并摸 2 张牌。每局 1 次。' },
    wushuang: { name: '天下无双', tier: 'legendary', type: 'limited', desc: '你打出的第一张「杀」伤害 +2，且不能被闪抵消。每局 1 次。' },
    xietianzi: { name: '挟天子以令诸侯', tier: 'legendary', type: 'active', limited: true, target: 'any', desc: '选择一名玩家，他今天的投票算 3 票。每局 1 次。' },
    fuguo: { name: '富可敌国', tier: 'legendary', type: 'passive', desc: '每天发工资时额外 +5 金。' },
    qisi: { name: '起死回生', tier: 'legendary', type: 'limited', desc: '一名其他玩家夜间死亡时，自动救回他并回复 2 气血。每局 1 次。' },
    wuxie: { name: '无懈可击', tier: 'legendary', type: 'limited', desc: '自动取消一次针对你的「杀」「拆」或主动技能。每局 1 次。' },
  };
  const SKILL_POOL = {
    common: ['rijin', 'shouqi', 'xiaoshi', 'jianji', 'tunji', 'qingzhuang'],
    rare: ['shunshou', 'bingliang', 'lebu', 'yiya', 'juedou', 'taoyuan'],
    legendary: ['niepan', 'wushuang', 'xietianzi', 'fuguo', 'qisi', 'wuxie'],
  };
  const TIERS = { common: '普通', rare: '稀有', legendary: '传说' };

  function weighted(pool, rng) {
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;
    for (const [key, weight] of pool) {
      roll -= weight;
      if (roll < 0) return key;
    }
    return pool[pool.length - 1][0];
  }

  function randomCard(rng = Math.random) {
    return weighted(CARD_POOL, rng);
  }

  function randomEquipment(rng = Math.random) {
    return rng() < 0.5 ? 'bagua' : 'renwang';
  }

  function randomSkill(owned, tier, rng = Math.random) {
    const have = new Set(owned || []);
    const order = tier ? [tier] : ['legendary', 'rare', 'common'];
    for (const key of order) {
      const pool = (SKILL_POOL[key] || []).filter((id) => !have.has(id));
      if (pool.length) return pool[Math.floor(rng() * pool.length)];
    }
    return null;
  }

  function handleLimit(owned) {
    return 3 + (owned && owned.includes('shouqi') ? 1 : 0);
  }

  function skillById(id) {
    return SKILLS[id] || null;
  }

  function cardById(id) {
    return CARDS[id] || null;
  }

  function equipmentById(id) {
    return EQUIPMENT[id] || null;
  }

  globalThis.WOLF_BLOODMOON = {
    MAX_HP,
    START_GOLD,
    HAND_LIMIT,
    CARDS,
    EQUIPMENT,
    SKILLS,
    SKILL_POOL,
    TIERS,
    randomCard,
    randomEquipment,
    randomSkill,
    handleLimit,
    skillById,
    cardById,
    equipmentById,
  };
})();
