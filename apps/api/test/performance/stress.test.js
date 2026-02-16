import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { BASE_URL, stages } from './config.js';
import { login, getAuthHeaders } from './helpers/auth.js';

const errors = new Counter('errors');
const successRate = new Rate('success_rate');

export const options = {
  stages: stages.stress,
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
    success_rate: ['rate>0.9'],
  },
};

export function setup() {
  const token = login();
  if (!token) throw new Error('Auth failed');
  return { token };
}

export default function (data) {
  const headers = getAuthHeaders(data.token);

  group('Heavy Read Operations', () => {
    // Multiple concurrent reads
    const responses = http.batch([
      ['GET', `${BASE_URL}/projects`, null, headers],
      ['GET', `${BASE_URL}/scm/findings?limit=100`, null, headers],
      ['GET', `${BASE_URL}/scm/scans`, null, headers],
      ['GET', `${BASE_URL}/scm/repositories`, null, headers],
      ['GET', `${BASE_URL}/compliance/score`, null, headers],
    ]);

    responses.forEach((r) => {
      const passed = check(r, { 'status ok': (res) => res.status === 200 });
      successRate.add(passed);
      if (!passed) errors.add(1);
    });
  });

  group('Search Operations', () => {
    // Simulate search with filters
    const search1 = http.get(`${BASE_URL}/scm/findings?severity=HIGH&status=OPEN`, headers);
    const search2 = http.get(`${BASE_URL}/scm/findings?severity=CRITICAL&limit=50`, headers);

    [search1, search2].forEach(r => {
      successRate.add(r.status === 200);
    });
  });

  group('Write Operations', () => {
    // Create and immediately delete a project (if write load needed)
    const createRes = http.post(`${BASE_URL}/projects`, JSON.stringify({
      name: `Load Test Project ${Date.now()}`,
      description: 'Created during stress test',
    }), headers);

    if (createRes.status === 201 || createRes.status === 200) {
      const project = JSON.parse(createRes.body);
      if (project.id) {
        http.del(`${BASE_URL}/projects/${project.id}`, null, headers);
      }
    }
  });

  sleep(Math.random() * 1);
}
