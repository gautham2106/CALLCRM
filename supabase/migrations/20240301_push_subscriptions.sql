-- Push notification subscriptions
-- Run this in your Supabase SQL editor before enabling push notifications

create table if not exists push_subscriptions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null references users(id) on delete cascade,
  college_id  uuid not null,
  subscription jsonb not null,
  created_at  timestamptz default now(),
  unique (user_id)
);

-- Only the user themselves (or service role) should access subscriptions
alter table push_subscriptions enable row level security;

create policy "Users can manage own push subscription"
  on push_subscriptions for all
  using (auth.uid() = (select auth_id from users where id = user_id));
