-- 狼人杀 · v9：按板子独立的匹配队列
-- 用法：Supabase 后台 → SQL Editor → New query → 整段粘贴 → Run
-- 只执行一次。匹配状态只能由 game Edge Function 的受信任数据库角色读写。

create table if not exists public.match_queue (
  account_id uuid primary key references public.profiles(id) on delete cascade,
  mode text not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  room_code text references public.rooms(code) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  matched_at timestamptz
);

create index if not exists match_queue_mode_waiting_idx
  on public.match_queue (mode, joined_at)
  where room_code is null;

alter table public.match_queue enable row level security;

revoke all on public.match_queue from anon, authenticated;
