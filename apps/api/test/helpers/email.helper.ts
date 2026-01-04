/**
 * Email Test Helper
 * Uses MailHog API for email integration testing
 */

const MAILHOG_API = 'http://localhost:8025/api';

export interface MailHogMessage {
  ID: string;
  From: { Relays: string[]; Mailbox: string; Domain: string };
  To: { Relays: string[]; Mailbox: string; Domain: string }[];
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
    Size: number;
    MIME: null | object;
  };
  Created: string;
  Raw: { From: string; To: string[]; Data: string; Helo: string };
}

export interface MailHogMessages {
  total: number;
  count: number;
  start: number;
  items: MailHogMessage[];
}

/**
 * Get all messages from MailHog
 */
export async function getEmails(): Promise<MailHogMessages> {
  const response = await fetch(`${MAILHOG_API}/v2/messages`);
  if (!response.ok) {
    throw new Error(`MailHog API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Get a specific message by ID
 */
export async function getEmail(id: string): Promise<MailHogMessage> {
  const response = await fetch(`${MAILHOG_API}/v1/messages/${id}`);
  if (!response.ok) {
    throw new Error(`MailHog API error: ${response.status}`);
  }
  return response.json();
}

/**
 * Delete all messages from MailHog
 */
export async function clearEmails(): Promise<void> {
  const response = await fetch(`${MAILHOG_API}/v1/messages`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 200) {
    // MailHog returns 200 even when empty
    console.warn(`MailHog clear warning: ${response.status}`);
  }
}

/**
 * Search emails by query
 */
export async function searchEmails(
  kind: 'from' | 'to' | 'containing',
  query: string,
): Promise<MailHogMessages> {
  const response = await fetch(
    `${MAILHOG_API}/v2/search?kind=${kind}&query=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw new Error(`MailHog search error: ${response.status}`);
  }
  return response.json();
}

/**
 * Wait for an email to arrive (with timeout)
 */
export async function waitForEmail(
  predicate: (msg: MailHogMessage) => boolean,
  timeoutMs: number = 10000,
  pollIntervalMs: number = 500,
): Promise<MailHogMessage | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const messages = await getEmails();
    const found = messages.items.find(predicate);
    if (found) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

/**
 * Extract email body text (handles both plain and base64)
 */
export function getEmailBody(message: MailHogMessage): string {
  const body = message.Content.Body;
  // Check if base64 encoded
  if (message.Content.Headers['Content-Transfer-Encoding']?.[0] === 'base64') {
    return Buffer.from(body, 'base64').toString('utf-8');
  }
  return body;
}

/**
 * Get email subject
 */
export function getEmailSubject(message: MailHogMessage): string {
  return message.Content.Headers['Subject']?.[0] || '';
}

/**
 * Get email recipient
 */
export function getEmailTo(message: MailHogMessage): string {
  const to = message.To[0];
  return to ? `${to.Mailbox}@${to.Domain}` : '';
}

/**
 * Get email sender
 */
export function getEmailFrom(message: MailHogMessage): string {
  const from = message.From;
  return `${from.Mailbox}@${from.Domain}`;
}
