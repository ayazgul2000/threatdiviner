import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, stages } from './config.js';
import { login, getAuthHeaders } from './helpers/auth.js';

export const options = {
  stages: stages.smoke,
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

let authToken;

export function setup() {
  authToken = login();
  if (!authToken) {
    throw new Error('Failed to authenticate');
  }
  return { token: authToken };
}

export default function (data) {
  const headers = getAuthHeaders(data.token);

  // Health check
  const health = http.get(`${BASE_URL}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
  });

  // Get projects
  const projects = http.get(`${BASE_URL}/projects`, headers);
  check(projects, {
    'projects status 200': (r) => r.status === 200,
    'projects response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Get findings
  const findings = http.get(`${BASE_URL}/scm/findings`, headers);
  check(findings, {
    'findings status 200': (r) => r.status === 200,
  });

  // Get scans
  const scans = http.get(`${BASE_URL}/scm/scans`, headers);
  check(scans, {
    'scans status 200': (r) => r.status === 200,
  });

  sleep(1);
}
