export const BASE_URL = __ENV.API_URL || 'http://localhost:3001';

export const defaultOptions = {
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

export const stages = {
  smoke: [
    { duration: '1m', target: 5 },
  ],
  load: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  stress: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  spike: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 500 },
    { duration: '1m', target: 10 },
  ],
};

export function getAuthHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `accessToken=${token}`,
    },
  };
}
