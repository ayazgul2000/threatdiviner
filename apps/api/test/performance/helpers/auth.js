import http from 'k6/http';
import { BASE_URL } from '../config.js';

export function login(email = 'admin@acme.com', password = 'admin123', tenantSlug = 'acme-corp') {
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email,
    password,
    tenantSlug,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 200 && res.status !== 201) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return null;
  }

  // Extract token from cookies
  const cookies = res.cookies;
  const accessToken = cookies.accessToken ? cookies.accessToken[0].value : null;

  return accessToken;
}

export function getAuthHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `accessToken=${token}`,
    },
  };
}
