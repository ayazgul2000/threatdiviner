import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, stages } from './config.js';
import { login, getAuthHeaders } from './helpers/auth.js';

const errorRate = new Rate('errors');

export const options = {
  stages: stages.spike,
  thresholds: {
    http_req_duration: ['p(99)<3000'],
    errors: ['rate<0.2'],
  },
};

export function setup() {
  const token = login();
  if (!token) throw new Error('Auth failed');
  return { token };
}

export default function (data) {
  const headers = getAuthHeaders(data.token);

  // Rapid-fire requests during spike
  const endpoints = [
    '/health',
    '/projects',
    '/scm/findings',
    '/scm/scans',
    '/scm/repositories',
  ];

  endpoints.forEach(endpoint => {
    const res = http.get(`${BASE_URL}${endpoint}`, endpoint === '/health' ? {} : headers);
    const passed = check(res, {
      'status ok': (r) => r.status === 200,
      'response time acceptable': (r) => r.timings.duration < 3000,
    });
    errorRate.add(!passed);
  });

  sleep(0.1); // Minimal sleep during spike
}
