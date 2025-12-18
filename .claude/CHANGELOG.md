# ThreatDiviner - Changelog

## 2025-12-19 Session 1
**Completed:**
- Scaffolded fresh Next.js 14.1.0 with create-next-app to fix ActionQueueContext bug
- Moved auth module from @altaniche/auth symlink to local libs folder
- Built dashboard login page with tenant/email/password form
- Built protected dashboard page with user info display
- Added auth state redirect on home page
- Updated layout metadata (title: ThreatDiviner)

**Dashboard Pages:**
- `/login` - Login form with Organization, Email, Password fields
- `/dashboard` - Protected page showing user info, tenant info, logout button
- `/` - Redirects to /login or /dashboard based on auth state

**Login Flow:**
1. Visit localhost:3000 → redirects to /login
2. Enter credentials → POST to API → sets httpOnly cookies
3. Redirects to /dashboard → fetches profile → shows welcome
4. Logout → clears cookies → redirects to /login

**Result:**
- Full auth flow working end-to-end
- Dashboard integrates with API via httpOnly cookies
- CORS configured for cross-origin requests

**Note:** Next.js 14.1.0 has a security advisory - will need to upgrade later

**Next:** Role-based guards, API key management

---

## 2025-12-18 Session 2
**Duration:** 3 hours
**Completed:**
- Auth module extracted to @altaniche/auth
- Symlink integrated with ThreatDiviner
- Dashboard Next.js downgrade attempted

**Blockers:**
- Dashboard hydration still broken

**Next:** Fix dashboard, then switch auth to local copy

---

## 2025-12-18 Session 1
**Duration:** 2 hours
**Completed:**
- Docker Compose (Postgres, Redis, MinIO, Qdrant)
- NestJS API scaffold + health check
- Next.js dashboard scaffold
- Prisma schema + RLS policies
- Seed data (2 tenants, 4 users)
- JWT auth with httpOnly cookies

**Blockers:**
- Postgres port conflict (fixed: 5433)

**Next:** Test auth endpoints
