/**
 * Brevo event tracking integration.
 *
 * Fires contact interaction events to Brevo via POST /v3/events.
 * The BREVO_API_KEY environment variable must be set; if it is absent the
 * calls are silently skipped so the rest of the application is unaffected.
 *
 * Reference: https://developers.brevo.com/reference/create-event
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/events'

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
