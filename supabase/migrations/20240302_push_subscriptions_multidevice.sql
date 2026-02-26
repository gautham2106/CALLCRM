-- Allow multiple push subscriptions per user (one per device/browser).
-- Previously user_id was UNIQUE, meaning only the last device subscribed
-- would receive notifications. Now each endpoint is unique instead.

-- 1. Add endpoint column (extracted from subscription JSON)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;

-- 2. Backfill from existing rows
UPDATE push_subscriptions
SET endpoint = subscription->>'endpoint'
WHERE endpoint IS NULL;

-- 3. Make it required
ALTER TABLE push_subscriptions ALTER COLUMN endpoint SET NOT NULL;

-- 4. Drop the old single-device unique constraint on user_id
ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

-- 5. Add per-endpoint unique constraint (one row per browser/device)
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
