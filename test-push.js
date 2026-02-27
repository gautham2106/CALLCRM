// Quick manual push notification test
// Usage: node test-push.js

const webpush = require('web-push')
const { createClient } = require('@supabase/supabase-js')

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'your_supabase_project_url'
const SERVICE_ROLE_KEY = 'your_supabase_service_role_key'
const VAPID_PUBLIC = 'BAv-QpU-sA1ilWFrUOT_wJftlH5pu3T-4uLdnPKsTyDOkbTHEmMJNi-JjN8R5DtoG4rKJY54YDaGelBIljngS4c'
const VAPID_PRIVATE = 'j5-VPO9g5pfQ9xLVWEKAHs-4efjDsUBzquKrAWuujjI'
const VAPID_EMAIL = 'mailto:admin@callcrm.app'

// Optional: target a specific user. Leave null to test all subscriptions.
const TARGET_USER_ID = 'c7c4b0f4-5054-44f3-91e2-d1a598ff1768'
// ────────────────────────────────────────────────────────────────────────────

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  let query = admin.from('push_subscriptions').select('id, user_id, subscription')
  if (TARGET_USER_ID) query = query.eq('user_id', TARGET_USER_ID)

  const { data: subs, error } = await query
  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!subs?.length) { console.log('No subscriptions found'); process.exit(0) }

  console.log(`Found ${subs.length} subscription(s). Sending...`)

  const payload = JSON.stringify({
    title: 'Test Notification',
    body: '🔔 Push is working! Manual test.',
    url: '/counsellor',
    tag: 'test',
  })

  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload)
      console.log(`✅ Sent to user ${row.user_id} (sub id: ${row.id})`)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        console.log(`⚠️  Expired subscription ${row.id} — delete it from DB`)
      } else {
        console.error(`❌ Failed (sub id: ${row.id}):`, err.message)
      }
    }
  }
}

main()
