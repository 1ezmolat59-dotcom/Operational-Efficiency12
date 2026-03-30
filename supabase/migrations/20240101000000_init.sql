-- Hospital Ops Platform — Initial Schema Migration
-- Generated from Prisma schema for Supabase PostgreSQL

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enumerations ─────────────────────────────────────────────────────────────
CREATE TYPE "RoomType"      AS ENUM ('single', 'double', 'isolation');
CREATE TYPE "RoomStatus"    AS ENUM ('dirty', 'in_progress', 'clean_ready', 'occupied', 'offline');
CREATE TYPE "CleanType"     AS ENUM ('discharge', 'checkout', 'routine');
CREATE TYPE "Equipment"     AS ENUM ('wheelchair', 'stretcher', 'none');
CREATE TYPE "JobPriority"   AS ENUM ('stat', 'routine');
CREATE TYPE "JobType"       AS ENUM ('stat', 'radiology', 'discharge', 'routine');
CREATE TYPE "JobStatus"     AS ENUM ('requested', 'accepted', 'in_progress', 'complete', 'cancelled');
CREATE TYPE "StaffRole"     AS ENUM ('housekeeper', 'transporter', 'supervisor', 'admin', 'nurse');
CREATE TYPE "ShiftType"     AS ENUM ('day', 'evening', 'off', 'overtime');
CREATE TYPE "AlertType"     AS ENUM ('bed_unassigned', 'transport_unaccepted', 'long_turnaround', 'linen_overage', 'rn_doing_transport', 'staff_no_show', 'checklist_skipped');
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- ─── Wing ─────────────────────────────────────────────────────────────────────
CREATE TABLE "Wing" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"      TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Wing_pkey" PRIMARY KEY ("id")
);

-- ─── Staff ────────────────────────────────────────────────────────────────────
CREATE TABLE "Staff" (
  "id"                 TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "name"               TEXT        NOT NULL,
  "email"              TEXT        NOT NULL,
  "passwordHash"       TEXT        NOT NULL,
  "role"               "StaffRole" NOT NULL,
  "wingId"             TEXT,
  "currentLocation"    TEXT,
  "availabilityStatus" BOOLEAN     NOT NULL DEFAULT true,
  "shiftStart"         TIMESTAMPTZ,
  "shiftEnd"           TIMESTAMPTZ,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- ─── Room ─────────────────────────────────────────────────────────────────────
CREATE TABLE "Room" (
  "id"                        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "wingId"                    TEXT         NOT NULL,
  "roomNumber"                TEXT         NOT NULL,
  "roomType"                  "RoomType"   NOT NULL,
  "status"                    "RoomStatus" NOT NULL DEFAULT 'dirty',
  "currentPatientId"          TEXT,
  "patientName"               TEXT,
  "lastCleanId"               TEXT,
  "mobilityEquipmentRequired" BOOLEAN      NOT NULL DEFAULT false,
  "isLockIn"                  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"                 TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- ─── CleanRecord ──────────────────────────────────────────────────────────────
CREATE TABLE "CleanRecord" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "roomId"          TEXT        NOT NULL,
  "staffId"         TEXT        NOT NULL,
  "cleanType"       "CleanType" NOT NULL,
  "startedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"     TIMESTAMPTZ,
  "stepsCompleted"  JSONB,
  "photos"          JSONB,
  "complianceScore" FLOAT8,
  "duration"        INTEGER,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CleanRecord_pkey" PRIMARY KEY ("id")
);

-- ─── TransportJob ─────────────────────────────────────────────────────────────
CREATE TABLE "TransportJob" (
  "id"            TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "patientId"     TEXT          NOT NULL,
  "patientName"   TEXT          NOT NULL,
  "requestedBy"   TEXT          NOT NULL,
  "assignedTo"    TEXT,
  "fromLocation"  TEXT          NOT NULL,
  "toLocation"    TEXT          NOT NULL,
  "roomId"        TEXT,
  "equipment"     "Equipment"   NOT NULL DEFAULT 'none',
  "priority"      "JobPriority" NOT NULL DEFAULT 'routine',
  "jobType"       "JobType"     NOT NULL DEFAULT 'routine',
  "status"        "JobStatus"   NOT NULL DEFAULT 'requested',
  "timestamps"    JSONB         NOT NULL DEFAULT '{}',
  "requesterName" TEXT,
  "createdAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "TransportJob_pkey" PRIMARY KEY ("id")
);

-- ─── Schedule ─────────────────────────────────────────────────────────────────
CREATE TABLE "Schedule" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "staffId"   TEXT         NOT NULL,
  "date"      TIMESTAMPTZ  NOT NULL,
  "shiftType" "ShiftType"  NOT NULL,
  "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Schedule_staffId_date_key" ON "Schedule"("staffId", "date");

-- ─── Alert ────────────────────────────────────────────────────────────────────
CREATE TABLE "Alert" (
  "id"        TEXT            NOT NULL DEFAULT gen_random_uuid()::text,
  "type"      "AlertType"     NOT NULL,
  "severity"  "AlertSeverity" NOT NULL,
  "message"   TEXT            NOT NULL,
  "roomId"    TEXT,
  "staffId"   TEXT,
  "jobId"     TEXT,
  "resolved"  BOOLEAN         NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- ─── SupplyLog ────────────────────────────────────────────────────────────────
CREATE TABLE "SupplyLog" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "staffId"     TEXT        NOT NULL,
  "roomId"      TEXT        NOT NULL,
  "sheets"      INTEGER     NOT NULL DEFAULT 0,
  "pillowcases" INTEGER     NOT NULL DEFAULT 0,
  "towels"      INTEGER     NOT NULL DEFAULT 0,
  "gowns"       INTEGER     NOT NULL DEFAULT 0,
  "flaggedLow"  BOOLEAN     NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SupplyLog_pkey" PRIMARY KEY ("id")
);

-- ─── ActivityLog ──────────────────────────────────────────────────────────────
CREATE TABLE "ActivityLog" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "type"      TEXT        NOT NULL,
  "message"   TEXT        NOT NULL,
  "data"      JSONB,
  "staffId"   TEXT,
  "roomId"    TEXT,
  "jobId"     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────
ALTER TABLE "Staff"
  ADD CONSTRAINT "Staff_wingId_fkey"
  FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Room"
  ADD CONSTRAINT "Room_wingId_fkey"
  FOREIGN KEY ("wingId") REFERENCES "Wing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CleanRecord"
  ADD CONSTRAINT "CleanRecord_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CleanRecord"
  ADD CONSTRAINT "CleanRecord_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransportJob"
  ADD CONSTRAINT "TransportJob_requestedBy_fkey"
  FOREIGN KEY ("requestedBy") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransportJob"
  ADD CONSTRAINT "TransportJob_assignedTo_fkey"
  FOREIGN KEY ("assignedTo") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransportJob"
  ADD CONSTRAINT "TransportJob_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Schedule"
  ADD CONSTRAINT "Schedule_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SupplyLog"
  ADD CONSTRAINT "SupplyLog_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Indexes for common queries ───────────────────────────────────────────────
CREATE INDEX "Room_wingId_status_idx"          ON "Room"("wingId", "status");
CREATE INDEX "CleanRecord_roomId_idx"          ON "CleanRecord"("roomId");
CREATE INDEX "CleanRecord_staffId_idx"         ON "CleanRecord"("staffId");
CREATE INDEX "CleanRecord_completedAt_idx"     ON "CleanRecord"("completedAt");
CREATE INDEX "TransportJob_status_idx"         ON "TransportJob"("status");
CREATE INDEX "TransportJob_assignedTo_idx"     ON "TransportJob"("assignedTo");
CREATE INDEX "Alert_resolved_severity_idx"     ON "Alert"("resolved", "severity");
CREATE INDEX "ActivityLog_createdAt_idx"       ON "ActivityLog"("createdAt" DESC);

-- ─── Updated-at trigger function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Staff_updatedAt"       BEFORE UPDATE ON "Staff"        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER "Room_updatedAt"        BEFORE UPDATE ON "Room"         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER "TransportJob_updatedAt" BEFORE UPDATE ON "TransportJob" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER "Schedule_updatedAt"    BEFORE UPDATE ON "Schedule"     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Seed: demo wings and users (password: password123) ───────────────────────
INSERT INTO "Wing" ("id", "name") VALUES
  ('wing-a', 'Wing A'),
  ('wing-b', 'Wing B');

-- Bcrypt hash for "password123" (cost 10)
INSERT INTO "Staff" ("id", "name", "email", "passwordHash", "role", "wingId") VALUES
  ('staff-hk1',   'Maria Santos',   'housekeeper@hospital.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'housekeeper', 'wing-a'),
  ('staff-hk2',   'James Carter',   'housekeeper2@hospital.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'housekeeper', 'wing-a'),
  ('staff-tp1',   'David Kim',      'transporter@hospital.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'transporter', NULL),
  ('staff-tp2',   'Aisha Johnson',  'transporter2@hospital.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'transporter', NULL),
  ('staff-sup1',  'Dr. Lisa Chen',  'supervisor@hospital.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'supervisor',  'wing-a'),
  ('staff-adm1',  'Robert Hughes',  'admin@hospital.com',        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'admin',       NULL),
  ('staff-nur1',  'Sarah Williams', 'nurse@hospital.com',        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lihO', 'nurse',       'wing-a');

INSERT INTO "Room" ("id", "wingId", "roomNumber", "roomType", "status", "mobilityEquipmentRequired") VALUES
  ('room-201', 'wing-a', '201', 'single',    'dirty',       false),
  ('room-202', 'wing-a', '202', 'double',    'in_progress', false),
  ('room-203', 'wing-a', '203', 'isolation', 'clean_ready', false),
  ('room-204', 'wing-a', '204', 'single',    'occupied',    true),
  ('room-205', 'wing-a', '205', 'single',    'dirty',       false),
  ('room-206', 'wing-a', '206', 'double',    'clean_ready', false),
  ('room-301', 'wing-b', '301', 'single',    'occupied',    false),
  ('room-302', 'wing-b', '302', 'single',    'dirty',       true),
  ('room-303', 'wing-b', '303', 'isolation', 'offline',     false),
  ('room-304', 'wing-b', '304', 'double',    'clean_ready', false);
