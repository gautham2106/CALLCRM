/**
 * Brevo integration — event tracking and transactional email.
 *
 * Requires BREVO_API_KEY. Calls are silently skipped when the key is absent
 * so the rest of the application is unaffected.
 *
 * References:
 *   Events: https://developers.brevo.com/reference/create-event
 *   Email:  https://developers.brevo.com/reference/send-transac-email
 */

const BREVO_EVENTS_URL = 'https://api.brevo.com/v3/events'
const BREVO_EMAIL_URL  = 'https://api.brevo.com/v3/smtp/email'

// ---------------------------------------------------------------------------
// Transactional email
// ---------------------------------------------------------------------------

export interface BrevoEmailRecipient {
  email: string
  name?: string
}

export interface BrevoEmailOptions {
  to: BrevoEmailRecipient[]
  subject: string
  /** Inline HTML body. Use this OR templateId, not both. */
  htmlContent?: string
  /** Plain-text body. Use this OR templateId, not both. */
  textContent?: string
  /** ID of a Brevo Drag & Drop template. Use this OR htmlContent/textContent. */
  templateId?: number
  /** Variables injected into the template via {{params.KEY}} */
  params?: Record<string, string | number>
}

/**
 * Send a transactional email via Brevo.
 *
 * Sender is read from BREVO_SENDER_EMAIL / BREVO_SENDER_NAME env vars.
 * Errors are caught and logged — never throws so callers are unaffected.
 */
export async function sendBrevoEmail(options: BrevoEmailOptions): Promise<void> {
  const apiKey     = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName  = process.env.BREVO_SENDER_NAME || 'CallCRM'

  if (!apiKey || !senderEmail) return

  const payload: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: options.to,
    subject: options.subject,
  }

  if (options.templateId != null) {
    payload.templateId = options.templateId
    if (options.params) payload.params = options.params
  } else if (options.htmlContent) {
    payload.htmlContent = options.htmlContent
  } else if (options.textContent) {
    payload.textContent = options.textContent
  }

  try {
    const res = await fetch(BREVO_EMAIL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[brevo] sendBrevoEmail failed (${res.status}):`, text)
    }
  } catch (err) {
    console.error('[brevo] sendBrevoEmail network error:', err)
  }
}

// ---------------------------------------------------------------------------
// Event tracking
// ---------------------------------------------------------------------------

const BREVO_API_URL = BREVO_EVENTS_URL

export interface BrevoEventIdentifiers {
  email_id?: string
  phone_id?: string
  ext_id?: string
  contact_id?: number
}

export interface BrevoEventOptions {
  /** ISO-8601 timestamp. Defaults to now if omitted. */
  event_date?: string
  /** Arbitrary key/value pairs sent as event properties. */
  event_properties?: Record<string, string | number | boolean | object | unknown[]>
  /** Contact attribute updates to apply alongside the event. */
  contact_properties?: Record<string, string | number>
}

/**
 * Send a single event to Brevo.
 *
 * Errors are caught and logged so callers never need to handle failures —
 * event tracking is best-effort and must not interrupt the main request flow.
 */
export async function trackBrevoEvent(
  eventName: string,
  identifiers: BrevoEventIdentifiers,
  options: BrevoEventOptions = {}
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return

  const hasIdentifier =
    identifiers.email_id ||
    identifiers.phone_id ||
    identifiers.ext_id ||
    identifiers.contact_id != null

  if (!hasIdentifier) {
    console.warn('[brevo] trackBrevoEvent skipped — no identifier provided for event:', eventName)
    return
  }

  const payload: Record<string, unknown> = {
    event_name: eventName,
    identifiers,
  }

  if (options.event_date) payload.event_date = options.event_date
  if (options.event_properties) payload.event_properties = options.event_properties
  if (options.contact_properties) payload.contact_properties = options.contact_properties

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => '')
      console.error(`[brevo] event "${eventName}" failed (${res.status}):`, text)
    }
  } catch (err) {
    console.error(`[brevo] event "${eventName}" network error:`, err)
  }
}
