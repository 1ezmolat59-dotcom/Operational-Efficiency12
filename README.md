# Hospital Ops Platform

A mobile-first operations platform for hospital EVS (housekeeping) and patient transport departments.

## Stack

| Layer | Technology |
|---|---|
| Backend API | Node.js + Express + TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Real-time | Socket.io + Supabase Realtime |
| Web Dashboard | React + TypeScript + Vite + Tailwind CSS |
| Mobile App | React Native + Expo |

## Roles

| Role | Platform | Access |
|---|---|---|
| Housekeeper | Mobile | Task queue, checklists, supplies |
| Transporter | Mobile | Job queue, status updates |
| Supervisor | Web + Mobile | Live dashboard, scheduling, alerts |
| Administrator | Web | KPI reporting, exports, full scheduling |

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL (or Supabase account)
- Expo CLI (`npm install -g expo-cli`)

### 1. Backend

```bash
cd backend
cp .env.example .env      # fill in your Supabase DATABASE_URL and keys
npm install
npx prisma generate
npm run dev               # → http://localhost:3001
```

### 2. Web Dashboard

```bash
cd web
cp .env.example .env      # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # → http://localhost:3000
```

### 3. Mobile App

```bash
cd mobile
npm install
npx expo start            # scan QR with Expo Go app
```

### Demo Credentials

All demo users have password: `password123`

| Email | Role |
|---|---|
| supervisor@hospital.com | Supervisor |
| admin@hospital.com | Administrator |
| housekeeper@hospital.com | Housekeeper |
| transporter@hospital.com | Transporter |
| nurse@hospital.com | Nurse |

## Build Phases

- **Phase 1 ✅** — Core mobile (task queue, job queue, room checklist)
- **Phase 2 ✅** — Event chain (room completion → nurse notification → auto-transport)
- **Phase 3 ✅** — Dashboard & reporting (supervisor live view, admin KPIs, exports)
- **Phase 4 🔲** — Integrations (EHR/FHIR, NEMT, payroll export) — stubs in place

## Database

Schema is managed via Supabase migrations in `supabase/migrations/`.

To push schema changes:
```bash
npx supabase db push
```
