/**
 * Webhook Test Helper
 * Uses MockServer API for webhook integration testing
 */

const MOCKSERVER_URL = 'http://localhost:1080';

export interface MockServerExpectation {
  id?: string;
  httpRequest: {
    method?: string;
    path?: string;
    headers?: Record<string, string[]>;
    body?: object | string;
  };
  httpResponse?: {
    statusCode?: number;
    headers?: Record<string, string[]>;
    body?: object | string;
  };
  times?: {
    remainingTimes?: number;
    unlimited?: boolean;
  };
}

export interface MockServerRequest {
  method: string;
  path: string;
  headers: Record<string, string[]>;
  body?: object | string;
  timestamp: string;
}

/**
 * Create an expectation in MockServer
 */
export async function createExpectation(
  expectation: MockServerExpectation,
): Promise<void> {
  const response = await fetch(`${MOCKSERVER_URL}/mockserver/expectation`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expectation),
  });
  if (!response.ok) {
    throw new Error(`MockServer expectation error: ${response.status}`);
  }
}

/**
 * Verify that a request was received
 */
export async function verifyRequest(request: {
  method?: string;
  path?: string;
}): Promise<boolean> {
  const response = await fetch(`${MOCKSERVER_URL}/mockserver/verify`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      httpRequest: request,
    }),
  });
  return response.status === 202;
}

/**
 * Get all recorded requests
 */
export async function getRecordedRequests(filter?: {
  method?: string;
  path?: string;
}): Promise<MockServerRequest[]> {
  const response = await fetch(`${MOCKSERVER_URL}/mockserver/retrieve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'REQUESTS',
      httpRequest: filter || {},
    }),
  });
  if (!response.ok) {
    return [];
  }
  return response.json();
}

/**
 * Clear all expectations and recorded requests
 */
export async function clearMockServer(): Promise<void> {
  await fetch(`${MOCKSERVER_URL}/mockserver/reset`, {
    method: 'PUT',
  });
}

/**
 * Clear specific expectation
 */
export async function clearExpectation(request: {
  method?: string;
  path?: string;
}): Promise<void> {
  await fetch(`${MOCKSERVER_URL}/mockserver/clear`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      httpRequest: request,
    }),
  });
}

/**
 * Setup a webhook endpoint that accepts POST requests
 */
export async function setupWebhookEndpoint(
  path: string,
  statusCode: number = 200,
  responseBody?: object,
): Promise<void> {
  await createExpectation({
    httpRequest: {
      method: 'POST',
      path,
    },
    httpResponse: {
      statusCode,
      headers: { 'Content-Type': ['application/json'] },
      body: responseBody || { received: true },
    },
    times: {
      unlimited: true,
    },
  });
}

/**
 * Wait for a request to arrive at MockServer
 */
export async function waitForRequest(
  filter: { method?: string; path?: string },
  timeoutMs: number = 10000,
  pollIntervalMs: number = 500,
): Promise<MockServerRequest | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const requests = await getRecordedRequests(filter);
    if (requests.length > 0) {
      return requests[requests.length - 1];
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

/**
 * Count requests matching a filter
 */
export async function countRequests(filter: {
  method?: string;
  path?: string;
}): Promise<number> {
  const requests = await getRecordedRequests(filter);
  return requests.length;
}
