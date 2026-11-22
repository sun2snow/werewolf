import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { engine, MODES } from '../supabase/functions/game/engine.mjs';
import { project } from '../supabase/functions/game/protocol.mjs';
import preview from '../server.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
async function page(t, overrides = {}) {
  const dom = new JSDOM(read('index.html'), {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const w = dom.window, ctx = dom.getInternalVMContext(), run = (s) => vm.runInContext(s, ctx);
  w.WOLF_CONFIG = { SUPABASE_URL: 'http://localhost', SUPABASE_KEY: 'fixture' };
  w.supabase = {
    createClient: () => ({
      auth: {
        async getSession() { return {data:{session:{user:{id:run('profile?.id')},access_token:'test'}}}; },
        onAuthStateChange(cb) { queueMicrotask(() => cb('INITIAL_SESSION', null)); },
      },
      ...overrides,
    }),
  };
  for (const el of w.document.querySelectorAll('script[src]')) {
    const src = el.getAttribute('src').split('?')[0];
    if (!src.startsWith('vendor/') && src !== 'js/config.js') {
      await new vm.Script(read(src), { filename: src }).runInContext(ctx);
    }
  }
  await Promise.resolve();
  return { w, run };
}
test('reconnect retains saved membership on error, removes it only on confirmed absence', async (t) => {
  let fail = true;
  const { run, w } = await page(t, {
    functions: { invoke: async () => fail ? { error: new Error('offline') } : { data: { gone: true } } },
  });
  const token = JSON.stringify({ code: '123456', playerId: 'p' });
  w.localStorage.setItem('wolf.session:test', token);
  run(`profile={id:'test',username:'test',status:'approved'};loadLeaderboard=loadHistory=()=>{};`);
  await run('afterApproved()');
  assert.equal(w.localStorage.getItem('wolf.session:test'), token);
  fail = false;
  await run('restoreSession()');
  assert.equal(w.localStorage.getItem('wolf.session:test'), null);
  w.localStorage.setItem('wolf.session',token);
  await run('restoreSession()'); assert.equal(w.localStorage.getItem('wolf.session'),token);
});
for (const late of ['snapshot', 'old snapshot', 'gone']) {
  test(`old tab receiving ${late} after rejoin keeps the newer reconnect record and never adopts its snapshot`, async t => {
    let finish;
    const token = {code:'123456',playerId:'new',accountId:'alice'};
    const {run,w} = await page(t, { functions:{ invoke: (_, {body}) => body.op === 'restore'
      ? Promise.resolve({data:token}) : new Promise(resolve => {finish = resolve;}) } });
    run(`profile={id:'alice',status:'approved'}; session={code:'123456',playerId:'old'};
      room={revision:1}; myRow={id:'old'}; loadLeaderboard=loadHistory=()=>{}; showRoom();
      els.roleName.textContent='OLD_CARD'; startPolling();`);
    const pending = run(`roomCommand('snapshot')`);
    // Same-origin tab B has left and rejoined while A was awaiting its snapshot.
    await new Promise(resolve => setImmediate(resolve));
    const storage = w.localStorage; storage.setItem('wolf.session:alice',JSON.stringify(token));
    finish({data:late === 'gone' ? {gone:true} : {code:token.code,revision:12,me:{id:late === 'old snapshot' ? 'old' : 'new',role:'witch'}}});
    await pending;
    assert.equal(run('session === null && room === null && myRow === null && pollTimer === null'),true);
    assert.equal(run('els.roleName.textContent'),'');
    assert.deepEqual(JSON.parse(storage.getItem('wolf.session:alice')),token);
    run(`profile.id='bob'; pollOnce=startPolling=()=>{}`); await run('restoreSession()');
    assert.equal(run('session'),null); assert.deepEqual(JSON.parse(storage.getItem('wolf.session:alice')),token);
    run(`profile.id='alice'`); await run('restoreSession()');
    assert.equal(run('session.playerId'),'new');
  });
}

test('requests bind the displayed account, pin the bearer and ignore a superseded 401 without replay', async t => {
  let id='bob', token='other', finish;
  const sent=[];
  const {run}=await page(t,{auth:{onAuthStateChange() {},async getSession(){return {data:{session:{user:{id},access_token:token}}};}},
    functions:{invoke:(_,request)=>{sent.push(request); return new Promise(resolve=>{finish=resolve;});}}});
  run(`profile={id:'alice'}; session={code:'123456',playerId:'seat-a'}`);
  await assert.rejects(run(`roomCommand('bot')`),/登录状态已变化/); assert.equal(sent.length,0);
  id='alice'; token='old'; const late=run(`roomCommand('bot')`);
  await new Promise(resolve=>setImmediate(resolve)); token='new';
  finish({error:{context:{status:401}}}); await assert.rejects(late,/凭据已变化/);
  assert.equal(sent.length,1); assert.equal(sent[0].headers.Authorization,'Bearer old');
  assert.deepEqual([sent[0].body.accountId,sent[0].body.playerId],['alice','seat-a']);
  assert.equal(run('session.playerId'),'seat-a');
});

test('stale recovery failures do not replace the next account’s status',async t=>{
  const {run,w}=await page(t); let fail;
  w.recover=()=>new Promise((_,reject)=>{fail=reject;});
  run(`profile={id:'a',username:'Alice'}; restoreSession=recover; loadLeaderboard=loadHistory=()=>{}`);
  const pending=run('afterApproved()'); run(`showAuthScreen(); setStatus('Bob')`);
  fail(new Error('late')); await pending; assert.equal(run('els.status.textContent'),'Bob');
});

test('rejoining a saved room does not fetch lobby data before or during the restore', async t => {
  const {run,w} = await page(t);
  const restore = Promise.withResolvers(), requests = [];
  w.restore = restore.promise;
  w.capture = name => requests.push(name);
  run(`profile={id:'a',username:'Alice',status:'approved'}; restoreSession=()=>restore;
    loadLeaderboard=()=>capture('leaderboard');loadHistory=()=>capture('history');`);
  const pending = run('afterApproved()');
  assert.deepEqual(requests, []);
  run(`session={code:'123456',playerId:'p'}`);
  restore.resolve();
  await pending;
  assert.deepEqual(requests, []);
  run('showHome()');
  assert.deepEqual(requests, ['leaderboard', 'history']);
});

for (const op of ['create', 'join', 'restore']) {
  test(`${op} applies the first snapshot without another game request`, async t => {
    const sent = [];
    const snapshot = {
      code:'123456', revision:2, hostId:'p', options:{mode:'newbie6',g:null},
      members:[{id:'p',name:'Alice',online:true}], me:{id:'p',seat:null,role:null},
      channel:'chat',chat:[],wolfPicks:[],submitted:[],
    };
    const {run,w} = await page(t,{ functions:{invoke:async (_,{body})=>{
      sent.push(body);
      return {data:body.op === 'snapshot' ? snapshot : {code:snapshot.code,playerId:'p',name:'Alice',snapshot}};
    }} });
    w.localStorage.setItem('wolf.session:alice',JSON.stringify({code:snapshot.code,playerId:'p',accountId:'alice'}));
    run(`profile={id:'alice',status:'approved'}; randomCode=()=> '123456'; loadRatings=async()=>{}`);
    await run({create:'createRoom()',join:`joinRoom('Alice','123456')`,restore:'restoreSession()'}[op]);
    await new Promise(r=>setImmediate(r));
    assert.deepEqual(sent.map(r=>[r.op,r.includeSnapshot]),[[op,true]]);
    assert.equal(run('room.revision'),2);
    assert.equal(run('els.roomView.hidden'),false);
    assert.match(run('els.playerList.textContent'),/Alice/);
    assert.equal(run('!!pollTimer'),true);
    const saved = JSON.parse(w.localStorage.getItem('wolf.session:alice'));
    assert.ok(!('snapshot' in saved));
  });
}

for (const unusable of ['missing', 'different member']) {
  test(`entry with ${unusable} first snapshot falls back to a membership-bound poll`, async t => {
    const sent = [];
    const snapshot = {
      code:'123456',revision:2,hostId:'p',options:{mode:'newbie6',g:null},
      members:[{id:'p',name:'Alice',online:true}],me:{id:'p',seat:null,role:null},channel:'chat',chat:[],wolfPicks:[],submitted:[],
    };
    const {run} = await page(t,{ functions:{invoke:async (_,{body})=>{
      sent.push(body);
      if (body.op === 'snapshot') return {data:snapshot};
      return {data:{code:snapshot.code,playerId:'p',name:'Alice',
        snapshot:unusable === 'missing' ? undefined : {...snapshot,me:{id:'other',role:'werewolf'}}}};
    }} });
    run(`profile={id:'alice',status:'approved'}; loadRatings=async()=>{}`);
    await run(`joinRoom('Alice','123456')`);
    await new Promise(r=>setImmediate(r));
    assert.deepEqual(sent.map(r=>r.op),['join','snapshot']);
    assert.equal(sent[1].playerId,'p');
    assert.equal(run('myRow.id'),'p');
    assert.equal(run('myRow.role'),null);
  });
}

test('a rolled-back settlement during restore still recovers the seat and starts polling', async t => {
  const sent = [];
  const {run,w} = await page(t,{ functions:{invoke:async (_,{body})=>{
    sent.push(body);
    if (body.op === 'restore' && body.includeSnapshot) return {data:{
      code:'SETTLEMENT_RETRY',error:'本次操作未保存',retry:{matchId:'m',revision:2},
    }};
    if (body.op === 'restore') return {data:{code:'123456',playerId:'p',name:'Alice'}};
    return {error:new Error('offline')};
  }} });
  w.localStorage.setItem('wolf.session:alice',JSON.stringify({code:'123456',playerId:'p',accountId:'alice'}));
  run(`profile={id:'alice',status:'approved'}`);
  await run('restoreSession()');
  await new Promise(r=>setImmediate(r));
  assert.deepEqual(sent.map(r=>[r.op,r.includeSnapshot]),[['restore',true],['restore',undefined],['snapshot',undefined]]);
  assert.equal(run('session.playerId'),'p');
  assert.equal(run('!!pollTimer'),true);
});

test('unchanged polls preserve room controls, but presence changes with the same revision still render', async t => {
  const {run,w} = await page(t);
  const snapshot = {
    code:'123456', revision:4, hostId:'p', options:{mode:'newbie6',g:null},
    members:[{id:'p',name:'Alice',online:true}], me:{id:'p',seat:null,role:null},
    channel:'chat',chat:[],wolfPicks:[],submitted:[],
  };
  w.getSnap = () => structuredClone(snapshot);
  run(`session={code:'123456',playerId:'p'}; ratingsKey='Alice'; gameRequest=async()=>getSnap();`);
  await run(`roomCommand('snapshot')`);
  const seat = w.document.querySelector('#playerList li');
  assert.ok(seat);
  for (let i = 0; i < 10; i++) await run(`roomCommand('snapshot')`);
  assert.strictEqual(w.document.querySelector('#playerList li'), seat);
  snapshot.hostId = null;
  snapshot.members[0].online = false;
  await run(`roomCommand('snapshot')`);
  assert.notStrictEqual(w.document.querySelector('#playerList li'), seat);
  assert.equal(run('members[0].online'), false);
});

test('idle polls accept a short confirmation only for the room view still on screen', async t => {
  const {run,w} = await page(t), sent = [];
  const full = {
    code:'123456',revision:4,viewTag:'a'.repeat(64),hostId:'p',options:{mode:'newbie6',g:null},
    members:[{id:'p',name:'Alice',online:true}],me:{id:'p',seat:null,role:null},
    channel:'chat',chat:[],wolfPicks:[],submitted:[],
  };
  const unchanged = {code:full.code,revision:full.revision,viewTag:full.viewTag,unchanged:true};
  let reply = full;
  w.getSnap = (_,__,args) => { sent.push(args); return structuredClone(reply); };
  run(`session={code:'123456',playerId:'p'}; ratingsKey='Alice'; gameRequest=async(...args)=>getSnap(...args);`);
  await run(`roomCommand('snapshot')`);
  const seat = w.document.querySelector('#playerList li');
  assert.ok(seat);
  reply = unchanged;
  await run(`roomCommand('snapshot')`);
  assert.deepEqual(sent.map(args=>[args.playerId,args.viewTag]),[['p',''],['p',full.viewTag]]);
  assert.strictEqual(w.document.querySelector('#playerList li'),seat);
  assert.equal(run('room.me.id'),'p');

  // An action may return a newer view before the short poll response arrives.
  w.delayed = Promise.withResolvers();
  run(`gameRequest=()=>delayed.promise;`);
  const pending = run(`roomCommand('snapshot')`);
  w.newer = {...full, revision:5, viewTag:undefined, members:[{id:'p',name:'Alice',online:false}]};
  run('applySnapshot(newer)');
  w.delayed.resolve(unchanged);
  await pending;
  assert.equal(run('room.revision'),5);
  assert.equal(run('members[0].online'),false);
});

test('chat-only polls and sends refresh messages without rebuilding controls', async t => {
  const {run,w} = await page(t);
  const snapshot = {
    code:'123456', revision:10, hostId:'p',
    options:{mode:'newbie6',g:{phase:'day',step:'day',day:1,matchId:'m',aliveSeats:[1,2],speechOrder:[1,2],speechIndex:0,teams:{wolves:[1]}}},
    members:[{id:'p',name:'Alice',seat:1,online:true},{id:'q',name:'Bob',seat:2,online:true}],
    me:{id:'p',seat:1,role:'werewolf'},channel:'chat',chat:[],wolfPicks:[],submitted:[],
  };
  w.getSnap = () => structuredClone(snapshot);
  run(`session={code:'123456',playerId:'p'}; ratingsKey='Alice|Bob'; gameRequest=async()=>getSnap();`);
  await run(`roomCommand('snapshot')`);
  const seat = w.document.querySelector('#playerList li');
  const actions = Array.from(w.document.querySelector('#actionArea').childNodes);
  assert.ok(seat && actions.length);
  for (let i = 1; i <= 10; i++) {
    snapshot.revision++;
    snapshot.chat.push({ day:1,payload:{text:`发言 ${i}`} });
    await run(i === 1 ? `roomCommand('act',{step:'chat'})` : `roomCommand('snapshot')`);
  }
  assert.equal(run('room.revision'), snapshot.revision);
  assert.match(run('els.chatFeed.textContent'), /发言 10/);
  assert.strictEqual(w.document.querySelector('#playerList li'), seat);
  assert.ok(actions.every((node, i) => w.document.querySelector('#actionArea').childNodes[i] === node));

  snapshot.revision++;
  Object.assign(snapshot.options.g,{phase:'night',step:'wolves',day:2});
  snapshot.channel = 'wolfchat';
  snapshot.chat = [{day:2,payload:{text:'夜聊'}}];
  await run(`roomCommand('snapshot')`);
  assert.notStrictEqual(w.document.querySelector('#playerList li'), seat);
  assert.match(run('els.chatFeed.textContent'), /夜聊/);
  assert.doesNotMatch(run('els.chatFeed.textContent'), /发言/);
});

test('real DOM accepts a new match and rejects delayed snapshots from the old one', async (t) => {
  const { run, w } = await page(t);
  const mode = MODES[0];
  const roster = mode.roles.map((_, i) => ({ id: 'p' + i, name: 'P' + i, is_bot: false, online: true }));
  const referee = engine({ state: null, roster, mode });
  referee.start();
  const me = roster[0];
  const data = {
    code: '123456',
    revision: 15,
    hostId: me.id,
    options: { mode: mode.id, g: project(referee.state, me) },
    me,
    members: roster.map(({ role, ...r }) => r),
    channel: 'chat',
    chat: [],
    wolfPicks: [],
    submitted: [],
  };
  w.snap = data;
  run(`session={code:'123456',playerId:'p0'};loadRatings=async()=>{};applySnapshot(snap);`);
  assert.equal(w.document.querySelectorAll('#playerList li').length, 6);
  w.next = structuredClone(data);
  w.next.revision = 17;
  w.next.options.g.matchId = crypto.randomUUID();
  run('applySnapshot(next);applySnapshot(snap)');
  assert.equal(run('g.matchId'), w.next.options.g.matchId);
  w.next = {
    ...data,
    revision: 18,
    options: { mode: mode.id, g: null },
    me: { id: me.id, role: null, seat: null },
  };
  run('applySnapshot(next)');
  assert.equal(run('g'), null);
  assert.equal(w.document.querySelector('#watchReplayBtn').hidden, true);
});
for (const chatBatch of [false,true]) {
  test(`new discussion messages wait for earlier drafts on ${chatBatch ? 'current' : 'legacy'} servers`, async t => {
    const {run,w} = await page(t), sent = [], first = Promise.withResolvers();
    w.send = (op,args) => { sent.push(args); return sent.length === 1 ? first.promise : Promise.resolve(); };
    run(`session={code:'123456',playerId:'p'}; room={chatBatch:${chatBatch}};
      g={matchId:'m',phase:'day',step:'day',day:1,aliveSeats:[1,2],speechOrder:[2,1],speechIndex:0};
      myRow={seat:1}; roomCommand=send;`);
    const type = text => { w.text = text; run(`els.chatInput.value=text; els.chatForm.requestSubmit()`); };
    type('先写的第一条'); type('先写的第二条');
    assert.equal(sent.length,0);
    run('g.speechIndex=1;updateChatForm()');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.length,1);
    type('轮到我之后写的第三条');
    assert.equal(run('JSON.parse(localStorage.getItem(preSpeechKey())).paused'),true);
    run('els.endSpeechBtn.click()');
    assert.equal(sent.length,1);
    assert.equal(run('els.endSpeechBtn.disabled'),true);
    first.resolve();
    await new Promise(resolve=>setImmediate(resolve));
    const messages = args => Array.from(args.payload.texts || [args.payload.text]);
    assert.deepEqual(sent.map(messages),chatBatch
      ? [['先写的第一条','先写的第二条'],['轮到我之后写的第三条']]
      : [['先写的第一条'],['先写的第二条'],['轮到我之后写的第三条']]);
    assert.ok(sent.every(m=>m.step==='chat' && m.payload.turn===1));
    assert.equal(run('pendingSpeechCount()'),0);
    assert.equal(run('els.endSpeechBtn.disabled'),false);
  });
}

test('a discussion batch does not continue sending queued text after a phase change', async t => {
  const {run,w} = await page(t), sent=[], first=Promise.withResolvers();
  w.send = (op,args) => { sent.push(args); return first.promise; };
  run(`session={code:'123456',playerId:'p'}; room={chatBatch:false};
    g={matchId:'m',phase:'day',step:'day',day:1,aliveSeats:[1],speechOrder:[1],speechIndex:0};
    myRow={seat:1}; roomCommand=send; queueSpeech('第一条'); queueSpeech('队尾');`);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sent.length,1);
  run(`g={...g,phase:'lastwords',step:'lastwords',lastWordsSeat:1};updateChatForm()`);
  first.resolve();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sent.length,1);
  assert.equal(run('preSpeech.msgs[0]'),'队尾');
});

test('failed discussion delivery preserves the queue until an explicit retry', async t => {
  const {run,w} = await page(t), sent=[];
  w.send = async (op,args) => { sent.push(args.payload.text); if (sent.length === 1) throw new Error('发送失败'); };
  run(`session={code:'123456',playerId:'p'}; room={chatBatch:true};
    g={matchId:'m',phase:'day',step:'day',day:1,aliveSeats:[1],speechOrder:[1],speechIndex:0};
    myRow={seat:1}; roomCommand=send; queueSpeech('保留这一条');`);
  await new Promise(resolve=>setImmediate(resolve));
  run('updateChatForm();updateChatForm()');
  assert.deepEqual(sent,['保留这一条']);
  assert.equal(run('els.retrySpeechBtn.hidden'),false);
  run('els.retrySpeechBtn.click()');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sent,['保留这一条','保留这一条']);
  assert.equal(run('els.retrySpeechBtn.hidden'),true);
});

test('vote shows pending immediately, ignores duplicate clicks, and waits for the referee receipt', async t => {
  const {run,w} = await page(t), sent=[];
  const snapshot = {
    code:'123456',revision:10,hostId:'p',options:{mode:'newbie6',g:{matchId:'m',phase:'vote',step:'vote',day:1,aliveSeats:[1,2],voteBanned:[]}},
    members:[{id:'p',name:'Alice',seat:1,online:true},{id:'q',name:'Bob',seat:2,online:true}],
    me:{id:'p',seat:1,role:'villager'},channel:'chat',chat:[],wolfPicks:[],submitted:[],
  };
  w.snap=snapshot;
  let result = Promise.withResolvers();
  w.ask = (op,code,args) => { sent.push([op,args?.step]); return result.promise; };
  run(`session={code:'123456',playerId:'p'}; ratingsKey='Alice|Bob'; gameRequest=ask; applySnapshot(snap)`);
  const confirmVote = () => {
    run('togglePick(2)');
    const button = [...w.document.querySelectorAll('#actionArea button')].find(b=>b.textContent==='确认');
    assert.ok(button);
    button.click(); button.click();
  };
  confirmVote();
  assert.match(run('els.actionArea.textContent'),/正在提交投票/);
  assert.doesNotMatch(run('els.actionArea.textContent'),/已投票/);
  await run('pollOnce()');
  assert.deepEqual(sent,[['act','vote']]);
  result.reject(new Error('收票失败'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(run('els.toast.textContent'),/收票失败/);
  assert.doesNotMatch(run('els.actionArea.textContent'),/正在提交/);
  result = Promise.withResolvers();
  confirmVote();
  result.resolve({...snapshot,revision:11,submitted:['1:vote']});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(run('els.actionArea.textContent'),/已投票/);
  assert.equal(sent.length,2);
});

test('sending day or wolf chat never announces a submission awaiting settlement', async (t) => {
  const { w, run } = await page(t);
  const sent = [];
  w.capture = args => sent.push(args.step);
  run(`g={phase:'day',step:'day',day:1,aliveSeats:[1,2],speechOrder:[1,2],speechIndex:0};
    myRow={seat:1,role:'villager'}; roomCommand=async(op,args)=>capture(args);`);
  for (const step of ['chat', 'wolfchat']) {
    if (step === 'wolfchat') {
      run(`g.phase='night'; g.step='wolves'; myRow.role='werewolf'; submitted.add('1:wolves')`);
    }
    run(`renderActionPanel(null,true); updateChatForm(); els.chatInput.value='测试发言'; els.chatForm.requestSubmit();`);
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(sent.at(-1), step);
    assert.equal(w.document.querySelector('#toast').hidden, true);
    assert.doesNotMatch(w.document.querySelector('#actionArea').textContent, /已提交，等待结算/);
    assert.equal(w.document.querySelector('#chatInput').disabled, false);
  }
  run(`roomCommand=async()=>{throw new Error('发送失败')}; els.chatInput.value='重试'; els.chatForm.requestSubmit()`);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(w.document.querySelector('#toast').textContent, /发送失败/);
});

test('candidates and last words use the public chat form; police ballots highlight eligible seats', async t => {
  const {w, run} = await page(t); const sent = [];
  w.capture = args => sent.push(args);
  run(`session={code:'123456',playerId:'p1'}; myRow={id:'p1',seat:1,role:'villager'};
    members=[1,2,3].map(seat=>({seat,id:'p'+seat,name:'P'+seat,online:true}));
    roomCommand=async(op,args)=>capture(args); g={phase:'sheriff',step:'policeVote',day:1,aliveSeats:[1,2,3],sheriffCandidates:[2,3]};
    renderActionPanel(null,true); renderSeats({roles:[1,2,3]},true);`);
  assert.equal(run('pick.allowed.has(2)&&pick.allowed.has(3)&&!pick.allowed.has(1)'),true);
  assert.equal(w.document.querySelectorAll('#playerList .sr-clickable').length,2);
  run(`Object.assign(g,{step:'policeSpeech',policeOrder:[1,2],policeIndex:0});`);
  for (const phase of ['sheriff','lastwords']) {
    if (phase === 'lastwords') run(`Object.assign(g,{phase:'lastwords',step:'lastwords',aliveSeats:[2,3],lastWordsSeat:1})`);
    run(`renderActionPanel(null,true); updateChatForm(); els.chatInput.value='测试'; els.chatForm.requestSubmit()`);
    await Promise.resolve(); assert.equal(sent.at(-1).step,'chat');
    assert.equal(w.document.querySelector('#chatInput').disabled,false);
    assert.match(w.document.querySelector('#actionArea').textContent,phase === 'lastwords' ? /说完了/ : /结束发言/);
  }
  run(`myRow.seat=2;updateChatForm()`); assert.equal(w.document.querySelector('#chatInput').disabled,true);
});

test('only the lobby owner sees appointment controls; exhausted cards are not offered', async t => {
  const { w, run } = await page(t); const sent = [];
  w.capture = (op, args) => sent.push([op,args.id,args.role]);
  run(`session={code:'123456',playerId:'p'}; members=[{id:'p',name:'Owner'},{id:'q',name:'Guest'}];
    profile={role:'owner',status:'approved'}; room={appointments:{q:'seer'}}; roomCommand=async(op,args)=>capture(op,args);
    appointId='p'; renderSeats(MODES[0],false);`);
  const select = w.document.querySelector('.sr-rolepick'); assert.ok(select);
  assert.ok(!Array.from(select.options).some(o => o.value === 'seer'));
  select.value='witch'; select.dispatchEvent(new w.Event('change'));
  assert.deepEqual(sent,[['appoint','p','witch']]);
  run(`profile.role='member'; renderSeats(MODES[0],false)`);
  assert.equal(w.document.querySelectorAll('.sr-appoint').length,0);
});

test('moderation can filter pending users and page beyond the first 200', async (t) => {
  const fetched = [];
  const { run, w } = await page(t, {
    from: () => {
      let filter = null;
      return {
        select() {
          return this;
        },
        eq(k, v) {
          filter = v;
          return this;
        },
        order() {
          return this;
        },
        async range(lo, hi) {
          fetched.push([lo, hi, filter]);
          return { data: [{ id: 'fixture', username: 'user' + lo, role: 'member', status: 'pending' }] };
        },
      };
    },
  });
  run(`profile={id:'admin',role:'admin',status:'approved'};adminPage=4;`);
  await run('loadAdmin()');
  assert.deepEqual(fetched.pop(), [200, 250, 'pending']);
  assert.match(w.document.querySelector('#adminBody').textContent, /user200/);
});
test('history retries a failed read without dropping the previous list or duplicating requests', async (t) => {
  let calls = 0, failure = null;
  const { run, w } = await page(t, { from: () => ({
    select() { return this; }, order() { return this; },
    async limit() {
      calls++;
      return failure ? { error: failure } : { data: [{ id: 42, mode_name: '保留的回放', days: 2 }] };
    },
  }) });
  w.setTimeout = fn => queueMicrotask(fn); // retry backoff without wall-clock sleeps
  run(`profile={id:'user', status:'approved'}; applyAccountUI();`);
  await run('loadHistory()');
  failure = { code: '42501', message: 'read denied' };
  await run('Promise.all([loadHistory(),loadHistory()])');
  assert.equal(calls, 4); // initial success + three attempts, not six
  assert.match(w.document.querySelector('#historyBody').textContent, /保留的回放/);
  assert.match(w.document.querySelector('#historyNote').textContent, /上次.*读取权限/);
  failure = null;
  await run('loadHistory()');
  assert.doesNotMatch(w.document.querySelector('#historyNote').textContent, /失败/);
  run('showAuthScreen()');
  assert.doesNotMatch(w.document.querySelector('#historyBody').textContent, /保留的回放/);
});

test('spectating another room keeps the seat and last frame, recovers then pauses after five failures', async (t) => {
  let fail = false, refresh, calls = 0;
  const { run, w } = await page(t, { functions: { invoke: async (_, { body }) => {
    assert.equal(body.op, 'spectate');
    assert.equal(body.code, '654321');
    calls++;
    return fail ? { error: new Error('network offline') } : { data: {
      revision: 1, options: { mode: 'std9', g: { mode: 'std9', day: 1, phase: 'night', aliveSeats: [1], log: [] } },
      members: [], chat: [{ day: 1, payload: { text: '公开发言' } }],
    } };
  } } });
  w.scrollTo = () => {};
  w.setInterval = fn => { refresh = fn; return 1; };
  w.clearInterval = () => { refresh = null; };
  run(`profile={id:'u',status:'approved'}; session={code:'123456',playerId:'p'}; applyAccountUI();`);
  assert.equal(w.document.querySelector('#activeRoomCard').hidden, false);
  assert.ok(w.document.querySelector('#activeRoomCard #otherSpectate'));
  await run(`openSpectate('654321')`);
  assert.equal(w.document.querySelector('#spectateView').hidden, false);
  assert.equal(run('session.code'), '123456');
  const note = w.document.querySelector('#spectateNote');
  fail = true;
  await refresh();
  assert.match(note.textContent, /自动重试/);
  assert.match(w.document.querySelector('#spectateChat').textContent, /公开发言/);
  fail = false; await refresh();
  assert.equal(note.hidden, true);
  fail = true;
  for (let i = 0; i < 5; i++) await refresh();
  assert.equal(refresh, null);
  assert.match(note.textContent, /已暂停/);
  await run(`openSpectate('123456')`);
  assert.equal(calls, 8);
  assert.equal(run('spectate'), null);
  assert.equal(w.document.querySelector('#roomView').hidden, false);
  assert.equal(note.hidden, true);
});

test('SIGNED_OUT purges private DOM, drafts and polling; late room and replay responses cannot restore them', async t => {
  let authChanged, finishRoom, finishReplay;
  const { run, w } = await page(t, {
    auth: { onAuthStateChange(cb) { authChanged = cb; }, async getSession() { return {data:{session:{user:{id:'old'},access_token:'test'}}}; } },
    functions: { invoke: () => new Promise(resolve => { finishRoom = resolve; }) },
    from: () => ({select() { return this; }, eq() { return this; }, maybeSingle() {
      return new Promise(resolve => { finishReplay = resolve; });
    }}),
  });
  run(`profile={id:'old',status:'approved'}; session={code:'123456',playerId:'p'};
    room={revision:1}; myRow={seat:1,role:'werewolf'}; g={phase:'night'}; roleShown=true;
    wolfChatRows=[{payload:{name:'狼',text:'PRIVATE_CHAT'}}]; renderChat();
    els.roleName.textContent='PRIVATE_ROLE'; els.chatInput.value='unsent';
    preSpeech={day:1,msgs:['PRIVATE_DRAFT']}; savePreSpeech(); showRoom(); startPolling();`);
  const lateRoom = run(`roomCommand('snapshot')`), lateReplay = run(`openReplay(1)`);
  await new Promise(resolve => setImmediate(resolve));
  authChanged('SIGNED_OUT');
  assert.equal(run('session === null && g === null && myRow === null && !roleShown && pollTimer === null'),true);
  assert.equal(run('wolfChatRows.length + preSpeech.msgs.length'),0);
  assert.equal(w.localStorage.getItem('wolf.prespeech:123456:p'),null);
  assert.equal(w.document.querySelector('#chatInput').value,'');
  assert.equal(w.document.querySelector('#roomView').hidden,true);
  assert.doesNotMatch(w.document.body.textContent,/PRIVATE_ROLE|PRIVATE_CHAT/);
  run(`profile={id:'new',status:'approved'}`);
  finishRoom({data:{revision:10,code:'123456'}}); finishReplay({data:{room_code:'old'}});
  await assert.rejects(lateRoom,/登录状态已变化/); await lateReplay;
  assert.equal(run('room === null && replayData === null && els.replayView.hidden'),true);
});

test('kick and leave send the original member, match or waiting-room revision', async t => {
  const { run, w } = await page(t); const sent=[]; w.capture=(op,args)=>sent.push([op,JSON.parse(JSON.stringify(args))]);
  run(`session={code:'123456',playerId:'me'}; room={revision:12}; roomCommand=capture;`);
  await run(`kickMember({id:'you'})`); run(`g={matchId:'new'}`); await run(`leaveRoom()`);
  assert.deepEqual(sent,[['kick',{id:'you',playerId:'me',matchId:null,lobbyRevision:12}],['leave',{playerId:'me',matchId:'new'}]]);
});

test('manual settlement retry repeats only a confirmed rolled-back operation with its precondition', async (t) => {
  const requests = [], retry = { matchId: 'match', revision: 9 };
  const { run, w } = await page(t, { functions: { invoke: async (_, { body }) => {
    requests.push(body);
    return { data: requests.length === 1 ? { error: '事务已回滚', code: 'SETTLEMENT_RETRY', retry } : { gone: true } };
  } } });
  run(`profile={id:'test'}; session={code:'123456',playerId:'p'}; localStorage.setItem(membershipKey(),JSON.stringify(session)); g={matchId:'match'};room={revision:9};`);
  await assert.rejects(run(`leaveRoom()`), /已回滚/);
  const button = w.document.querySelector('#retrySettlement');
  assert.equal(button.hidden, false);
  assert.match(button.textContent, /重试离房/);
  await run('retrySettlement()');
  await run('retrySettlement()');
  assert.equal(requests.length, 2);
  for (const req of requests) assert.deepEqual([req.op, req.matchId, req.playerId], ['leave','match','p']);
  assert.deepEqual(JSON.parse(JSON.stringify(requests[1].retry)), retry);
  assert.equal(run('session'), null);
  assert.equal(button.hidden, true);
  assert.equal(w.localStorage.getItem('wolf.session:test'), null);
});

test('ordinary victim can acknowledge an actual settlement snapshot without a hunter action', async (t) => {
  const { run, w } = await page(t);
  const mode = MODES.find(m => m.id === 'std9'), roster = mode.roles.map((_, i) => ({ id: `p${i}`, online: true }));
  const ref = engine({ state: null, roster, mode });
  ref.start();
  const victim = roster.find(p => p.role === 'villager');
  Object.assign(ref.state, { phase: 'vote', step: 'vote' });
  for (const p of roster) ref.record(p.seat, 'vote', p === victim ? -1 : victim.seat);
  ref.tick();
  w.view = project(ref.state, victim);
  w.victim = victim;
  run(`g=view; myRow=victim; act=(step)=>window.clicked=step; renderActionPanel(null,true)`);
  const panel = w.document.querySelector('#actionArea');
  // 白天被放逐者先说遗言，再确认出局。
  assert.equal(panel.querySelectorAll('button').length, 1);
  assert.match(panel.textContent, /说完了/);
  panel.querySelector('button').click();
  assert.equal(w.clicked, 'lastwords');
  ref.record(victim.seat, 'lastwords', null, { end: true });
  ref.tick();
  w.view = project(ref.state, victim);
  run(`g=view; submitted=new Set(); renderActionPanel(null,true)`);
  assert.equal(panel.querySelectorAll('button').length, 1);
  assert.match(panel.textContent, /确认出局/);
  panel.querySelector('button').click();
  assert.equal(w.clicked, 'deathConfirm');
  run(`submitted.add(g.day+':deathConfirm'); renderActionPanel(null,true)`);
  assert.equal(panel.querySelector('button'), null);
});

test('guest rulebook opens from the home page, with working anchors and the actual deals', (t) => {
  const home = new JSDOM(read('index.html'), { url: 'http://localhost/werewolf/' });
  t.after(() => home.window.close());
  for (const region of ['.navbar', '#rules', '#authModal']) {
    const link = home.window.document.querySelector(`${region} a[href$="rules.html"]`);
    assert.equal(link?.href, 'http://localhost/werewolf/rules.html', region);
  }
  const file = preview.assetPath('/rules.html');
  assert.ok(file);
  const book = new JSDOM(readFileSync(file, 'utf8'));
  t.after(() => book.window.close());
  const doc = book.window.document;
  assert.equal(doc.querySelector('script'), null); // no login, JS, or database needed
  for (const a of doc.querySelectorAll('a[href^="#"]')) {
    assert.ok(doc.getElementById(a.hash.slice(1)), a.hash);
  }
  assert.ok(doc.querySelector('a[href="./index.html"]'));
  const { ROLES } = globalThis.WOLF_MODES;
  assert.equal(doc.querySelectorAll('tr[data-mode]').length, MODES.length);
  for (const mode of MODES) {
    const row = doc.querySelector(`tr[data-mode="${mode.id}"]`);
    assert.ok(row, mode.id);
    const [name, wolves, villagers, others] = Array.from(row.cells, cell => cell.textContent);
    assert.equal(name, mode.name);
    const expected = mode.roles.map(role => ROLES[role].name).sort();
    const pack = wolves.split('、').flatMap(group => {
      const [wolf, count] = group.split('×');
      return Array(Number(count)).fill(wolf);
    });
    assert.deepEqual([...pack, ...Array(Number(villagers)).fill('平民'), ...others.split('、')].sort(), expected, mode.id);
  }
});

test('preview serves only frontend assets and rejects invalid paths in the parser', () => {
  assert.ok(preview.assetPath('/supabase/functions/_shared/modes.js?v=8'));
  assert.equal(preview.assetPath('/supabase/functions/game/index.ts'), null);
  assert.throws(() => preview.assetPath('/%'), URIError);
});

test('act shows submitting instantly, blocks duplicates, yields polls, rolls back on failure', async (t) => {
  const { w, run } = await page(t);
  const mode = MODES.find((m) => m.id === 'std9') || MODES[0];
  const roster = mode.roles.map((_, i) => ({ id: 'p' + i, name: 'P' + i, is_bot: false, online: true }));
  const referee = engine({ state: null, roster, mode });
  referee.start();
  const wolfSeat = referee.state.teams.wolves[0];
  const me = roster.find((p) => p.seat === wolfSeat);
  const target = referee.state.aliveSeats.find((s) => !referee.state.teams.wolves.includes(s));
  const data = {
    code: '123456', revision: 1, hostId: roster[0].id,
    options: { mode: mode.id, g: project(referee.state, me) },
    me, members: roster.map(({ role, ...r }) => r),
    channel: 'wolfchat', chat: [], wolfPicks: [], submitted: [],
  };
  w.snap = data;
  run(`profile={id:'${me.id}',status:'approved'}; session={code:'123456',playerId:'${me.id}'};
    loadRatings=async()=>{}; applySnapshot(snap);`);
  assert.equal(run('g.step'), 'wolves');
  let calls = 0;
  w.bump = () => calls++;
  run(`roomCommand=(op,args)=>{bump(); return new Promise(res=>{finishAct=()=>res({});});};`);
  const pending = run(`act('wolves', ${target})`);
  assert.equal(run('currentAction() !== null'), true, 'pending action set before server response');
  assert.equal(run('acting'), 1);
  assert.match(w.document.querySelector('#actionArea').textContent, /正在提交/);
  assert.equal(await run(`act('wolves', ${target})`), false, 'duplicate click ignored');
  assert.equal(calls, 1);
  run('pollOnce()');
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1, 'poll yields to in-flight action');
  run('finishAct()');
  assert.equal(await pending, true);
  assert.equal(run('currentAction() !== null || acting !== 0'), false);
  run(`roomCommand=async()=>{throw new Error('网络失败')};`);
  assert.equal(await run(`act('wolves', ${target})`), false);
  assert.equal(run('currentAction()'), null, 'failure rolls back pending action');
  assert.match(w.document.querySelector('#toast').textContent, /网络失败/);
});

test('bloodmoon shop, card and rescue panels submit the expected intents', async (t) => {
  const { w, run } = await page(t);
  const mode = MODES.find((m) => m.id === 'bloodmoon');
  assert.ok(mode, '血月牌局模式存在');
  const roster = mode.roles.map((_, i) => ({ id: 'p' + i, name: 'P' + i, online: true, is_bot: false }));
  const referee = engine({ state: null, roster, mode });
  referee.start();
  const me = roster[0];
  const seat = me.seat;
  const target = referee.state.aliveSeats.find((s) => s !== seat);
  const data = {
    code: '123456', revision: 1, hostId: me.id,
    options: { mode: mode.id, g: project(referee.state, me) },
    me, members: roster.map(({ role, ...r }) => r),
    channel: 'chat', chat: [], wolfPicks: [], submitted: [],
  };
  w.snap = data;
  run(`profile={id:'${me.id}',status:'approved'}; session={code:'123456',playerId:'${me.id}'};
    loadRatings=async()=>{}; applySnapshot(snap); sent=[]; roomCommand=async(op,args)=>{sent.push({op,args});};`);
  const area = w.document.querySelector('#actionArea');
  const click = (re) => {
    const btn = [...area.querySelectorAll('button')].find((b) => re.test(b.textContent));
    assert.ok(btn, `找不到按钮：${re}`);
    btn.click();
  };

  run(`g.phase='shop'; g.step='shop'; g.bloodMe.shop={equip:'bagua',locked:false}; g.bloodMe.locked=false;
    g.bloodMe.shards=0; g.bloodMe.hand=['sha']; g.bloodMe.skillDay=0; g.bloodMe.usedSkills=[];
    g.blood.gold[${seat}]=10; g.blood.star[${seat}]=1; g.blood.shards[${seat}]=0; g.blood.equipment[${seat}]=null;
    g.blood.skills[${seat}]=[]; g.blood.handCount[${seat}]=1; g.blood.locked[${seat}]=false; submitted=new Set(); renderRoom();`);
  assert.match(area.textContent, /商店/);
  click(/碎片/);
  click(/魔法骰子/);
  click(/确认购物/);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].args.step, 'shop');
  assert.deepEqual([...w.sent[0].args.payload.buys], ['shard', 'dice']);

  run(`g.phase='day'; g.step='day'; g.bloodMe.hand=['sha']; g.bloodMe.skillDay=0; g.bloodMe.usedSkills=[];
    g.blood.skills[${seat}]=[]; g.blood.actionUsed[${seat}]=false; g.blood.hp[${seat}]=4; g.blood.rescueQueue=[];
    submitted=new Set(); sent=[]; renderRoom();`);
  click(/^杀$/);
  assert.equal(run('pick && pick.kind'), 'blood');
  run(`togglePick(${target}); renderRoom();`);
  assert.deepEqual([...run('pick.selected')], [target]);
  click(/^确认$/);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].args.step, 'card');
  assert.equal(w.sent[0].args.target, target);
  assert.equal(w.sent[0].args.payload.card, 'sha');

  run(`g.phase='rescue'; g.step='rescue'; g.blood.rescueQueue=[${target}]; g.blood.hp[${target}]=0;
    g.bloodMe.hand=['tao']; submitted=new Set(); sent=[]; renderRoom();`);
  click(/用桃/);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].args.step, 'rescue');
  assert.equal(w.sent[0].args.target, target);
  assert.equal(w.sent[0].args.payload.target, target);
});

test('unchanged snapshots skip DOM rebuilds; poll cadence adapts to recent activity', async (t) => {
  const { w, run } = await page(t);
  const mode = MODES[0];
  const roster = mode.roles.map((_, i) => ({ id: 'p' + i, name: 'P' + i, is_bot: false, online: true }));
  const referee = engine({ state: null, roster, mode });
  referee.start();
  const me = roster[0];
  const data = {
    code: '123456', revision: 1, hostId: me.id,
    options: { mode: mode.id, g: project(referee.state, me) },
    me, members: roster.map(({ role, ...r }) => r),
    channel: 'chat', chat: [{ day: 1, payload: { name: 'P1', text: '你好' } }], wolfPicks: [], submitted: [],
  };
  w.snap = data;
  run(`session={code:'123456',playerId:'p0'}; loadRatings=async()=>{}; applySnapshot(snap);
    let rebuilds=0, chatBuilds=0;
    const seatOrig=els.playerList.replaceChildren.bind(els.playerList);
    els.playerList.replaceChildren=(...a)=>{rebuilds++;return seatOrig(...a);};
    const chatOrig=els.chatFeed.replaceChildren.bind(els.chatFeed);
    els.chatFeed.replaceChildren=(...a)=>{chatBuilds++;return chatOrig(...a);};
    renderRoom(); renderChat();`);
  assert.equal(run('rebuilds'), 0, 'identical state does not rebuild seats');
  assert.equal(run('chatBuilds'), 0, 'identical chat does not rebuild feed');
  w.next = structuredClone(data);
  w.next.revision = 2;
  w.next.options.g.phase = 'day';
  w.next.options.g.step = 'day';
  w.next.chat = [...data.chat, { day: 1, payload: { name: 'P2', text: '新消息' } }];
  run('applySnapshot(next);');
  assert.equal(run('chatBuilds'), 1, 'new chat message renders');
  assert.equal(run('lastChangeAt > 0'), true);
  assert.equal(run('lastChangeAt=Date.now(); nextPollDelay()'), 1200);
  assert.equal(run('lastChangeAt=Date.now()-9000; nextPollDelay()'), 2500);
  run(`session=null;`);
  assert.equal(run('nextPollDelay()'), 3000);
});
