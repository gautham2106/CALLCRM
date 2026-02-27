-- Enable pg_net if not already enabled (needed for HTTP calls from cron)
create extension if not exists pg_net with schema extensions;

-- Schedule reminder pushes 4x/day (UTC = 8:30am, 11:30am, 2:30pm, 5:30pm IST)
-- Replace YOUR_APP_URL and YOUR_CRON_SECRET with your actual values before running.
select cron.schedule(
  'daily-reminders',
  '0 3,6,9,12 * * *',
  $$
  select net.http_get(
    url     := 'YOUR_APP_URL/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  )
  $$
);
