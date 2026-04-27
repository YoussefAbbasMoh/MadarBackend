# MUDAR — multi-tenant SaaS architecture (incremental)

This document records **Phase 1** decisions for evolving the LMS into **MUDAR** without a ground-up rewrite.

## 1. Tenancy model (shared database, `tenant_id`)

We use a **single PostgreSQL database** with a **`Tenant` row per client workspace** and **`tenantId` on core rows** (`User`, `Course` in Phase 1). This matches common B2B SaaS scale paths (Teachable-style) before considering schema-per-tenant or DB-per-tenant.

- **Resolution:** `src/middleware/tenantContext.js` loads the tenant from:
  - Subdomain: `{slug}.<MUDAR_BASE_DOMAIN>` (e.g. `academy.mudar.com`), or
  - Dev header: `X-Mudar-Tenant-Slug: academy` when the browser host has no subdomain (e.g. `localhost`).
- **Request shape:** `req.tenant` (plain object), `req.tenantId`, `req.platformMode` (no tenant → HQ / marketing / global APIs).
- **Isolation:** Phase 1 attaches context only. **Query filters by `tenantId` are not yet enforced everywhere** — that is Phase 2 to avoid breaking existing APIs in one step.

## 2. Roles

Prisma enum `UserRole` gained: `mudar_super_admin`, `client_super_admin`, `parent`. Legacy values (`super_admin`, `instructor`, …) remain for backward compatibility.

Helpers: `src/constants/mudarRoles.js` (`dashboardBucketForRole`, `isPlatformRole`, …).

## 3. Subscription / feature flags

`SubscriptionPlan` + `Tenant.planId` provide a **placeholder** for caps (`maxTeachers`, `maxStudents`, `maxCourses`) and JSON `features` for toggles. Billing integration (Stripe, etc.) is a later phase.

## 4. API surface

- `GET /api/v1/platform/context` — returns resolved tenant + `platformMode` for the SPA topbar / routing.

## 5. Database migrations

After pulling schema changes:

```bash
cd backend
npx prisma migrate dev --name mudar_phase1_tenant
```

Or `npx prisma db push` for local-only prototyping (not for production).

Then backfill: create at least one `Tenant` row and set `User.tenantId` / `Course.tenantId` for existing data (script or SQL — follow-up task).

## 6. Next phases (recommended order)

1. Enforce `tenantId` on all reads/writes for tenant-scoped routes; HQ routes skip filter.
2. Composite uniqueness `(tenantId, email)` for users; same pattern for org-scoped codes.
3. Rename “course” to “classroom” in API/UI while keeping `Course` table for minimal churn, or add `Classroom` as a facade model.
4. HQ dashboard routes + RBAC middleware bound to `mudar_super_admin`.
5. Client super-admin dashboard + onboarding + branding from `Tenant.branding`.
