# PostgreSQL migration (Prisma)

The API currently runs on **MongoDB (Mongoose)**. A **PostgreSQL** target schema is defined in `prisma/schema.prisma` (Prisma **5.22** — pinned for classic `datasource.url` support and broad Node compatibility).

## What is already in the repo

- `prisma/schema.prisma` — relational model aligned with existing Mongoose collections (users, courses, lessons, assessments, submissions, progress, notifications, messages, live sessions, transactions, packages, promo codes, agent sessions).
- `src/db/prisma.js` — singleton `PrismaClient` (`getPrisma()`).
- `src/lib/ids.js` — UUID string validation for route IDs after cutover.
- `src/lib/toLean.js` — helpers to map Prisma `id` → legacy JSON `_id` for clients that still expect Mongo-shaped payloads.

## What still has to be done (application code)

Every file that uses `mongoose` / `require('../models/...')` must be rewritten to use `getPrisma()` (or a thin repository layer), including:

- All controllers under `src/controllers/`
- `src/utils/courseListQuery.js` and `src/utils/courseAccess.js` (Mongo query objects → Prisma `where` clauses)
- `src/middleware/auth.js`
- `src/services/*`, `src/sockets/chat.js`, `src/queues/workers.js`
- `src/init/ensureSeedStaff.js`, `src/init/sampleCoursesSeed.js`
- `scripts/seed-sample-courses.js`, `scripts/reset-seed-staff-password.js`

`src/controllers/staff.controller.js` is the heaviest: it uses Mongo aggregations (`$group`, `$facet`, `$lookup`, etc.). Those need equivalent **SQL** (`$queryRaw` or multiple Prisma queries + in-memory joins).

## Local PostgreSQL setup

1. Install PostgreSQL **16+** (or your preferred supported major).
2. Create a database, e.g. `lms`.
3. In `backend/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5432/lms?schema=public
```

4. From `backend/`:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
# or for a throwaway dev DB without migration history:
# npx prisma db push
```

5. `scripts/check-pg.js` — optional connectivity check (see `npm run check:pg` in `package.json`).

## ID format

New Prisma models use **UUID** primary keys (`@default(uuid())`), not Mongo `ObjectId`. After cutover, the REST API will expose `_id` as a UUID string if you keep the `toLean.js` mapping pattern.

## Recommended next step

Port in **vertical slices** (one bounded context at a time), e.g.:

1. Auth + `User` + `middleware/auth.js`
2. `Course` + `courseListQuery` / `courseAccess` + `course.controller.js`
3. Curriculum (`Lesson`, `SubLesson`, `Assessment`, `Submission`)
4. Staff dashboard (`staff.controller.js` — last, due to aggregations)

Until that port is finished, keep **`MONGO_URI`** set and run the API as today.
