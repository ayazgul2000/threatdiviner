import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, stages } from './config.js';
import { login, getAuthHeaders } from './helpers/auth.js';

// Custom metrics
const apiErrors = new Counter('api_errors');
const projectsLatency = new Trend('projects_latency');
const findingsLatency = new Trend('findings_latency');
const scansLatency = new Trend('scans_latency');

export const options = {
  stages: stages.load,
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    api_errors: ['count<100'],
    projects_latency: ['p(95)<800'],
    findings_latency: ['p(95)<1000'],
    scans_latency: ['p(95)<800'],
  },
};

export function setup() {
  const token = login();
  if (!token) throw new Error('Auth failed');
  return { token };
}

export default function (data) {
  const headers = getAuthHeaders(data.token);

  group('Dashboard APIs', () => {
    // Projects list
    const projects = http.get(`${BASE_URL}/projects`, headers);
    projectsLatency.add(projects.timings.duration);
    if (!check(projects, { 'projects ok': (r) => r.status === 200 })) {
      apiErrors.add(1);
    }

    // Findings list with pagination
    const findings = http.get(`${BASE_URL}/scm/findings?limit=50`, headers);
    findingsLatency.add(findings.timings.duration);
    if (!check(findings, { 'findings ok': (r) => r.status === 200 })) {
      apiErrors.add(1);
    }

    // Scans list
    const scans = http.get(`${BASE_URL}/scm/scans?limit=20`, headers);
    scansLatency.add(scans.timings.duration);
    if (!check(scans, { 'scans ok': (r) => r.status === 200 })) {
      apiErrors.add(1);
    }
  });

  group('Detail APIs', () => {
    // Get repositories
    const repos = http.get(`${BASE_URL}/scm/repositories`, headers);
    check(repos, { 'repos ok': (r) => r.status === 200 });

    // Get compliance
    const compliance = http.get(`${BASE_URL}/compliance/score`, headers);
    check(compliance, { 'compliance ok': (r) => r.status === 200 });

    // Get alerts
    const alerts = http.get(`${BASE_URL}/alerts/rules`, headers);
    check(alerts, { 'alerts ok': (r) => r.status === 200 });
  });

  group('Filter Operations', () => {
    // Filter findings by severity
    const critical = http.get(`${BASE_URL}/scm/findings?severity=CRITICAL`, headers);
    check(critical, { 'critical findings ok': (r) => r.status === 200 });

    // Filter scans by status
    const completed = http.get(`${BASE_URL}/scm/scans?status=COMPLETED`, headers);
    check(completed, { 'completed scans ok': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1); // 1-3 seconds
}
