# Hospital Operations Platform
### EVS & Patient Transport — Product Specification

---

## 1. Problem & Solution

### 1.1 Problem Statement

| Pain Point | Current State | Cost Impact |
|---|---|---|
| Idle staff time | Pagers & IVR dispatch | 40+ hrs/month wasted |
| Nurse doing transport | No request routing system | High RN labor cost |
| Bed turnaround | Phone-based coordination | Avg 29 min vs 23 min target |
| Linen waste | No usage tracking | $100K+ annual overage |
| Compliance gaps | Paper checklists | HAI liability, audit risk |
| Scheduling | Manual spreadsheets | Overtime & understaffing |

### 1.2 Solution Summary

A mobile-first operations platform with four user roles — **Housekeeper, Transporter, Supervisor, Administrator** — each with a purpose-built view. The system connects to the EHR discharge feed, payroll/scheduling systems, and NEMT providers via API.

### 1.3 Key Outcomes Targeted

- Bed turnaround time reduced from 29 min to under 23 min
- Labor cost per task reduced by 15%+
- Overtime rate reduced to under 3%
- Checklist compliance rate above 95%
- Zero phone-based transport coordination
- Full audit trail for every room clean and patient transport

---

## 2. User Roles & Permissions

| Role | Device | Primary Use | Key Permissions |
|---|---|---|---|
| Housekeeper | Mobile (iOS/Android) | Task queue, checklists, photo verification | View own tasks, submit completions, flag supply issues |
| Transporter | Mobile (iOS/Android) | Job queue, route tracking, status updates | View/accept jobs, update status, log equipment used |
| Supervisor | Mobile + Web | Live ops dashboard, staff management, alerts | View all staff, reassign tasks, override job assignments, review audit logs |
| Administrator | Web | Finance reports, scheduling, KPI monitoring | Full read access, export reports, manage schedules, configure alert thresholds |

---

## 3. Module Specifications

### 3.1 Housekeeping (EVS) Module — Housekeeper Mobile View

#### 3.1.1 Task Queue Screen

The home screen for housekeeping staff. Displays all assigned tasks for the current shift, grouped by priority tier.

| Element | Behavior / Data |
|---|---|
| Shift header | Staff name, wing assignment, shift end time, on-shift badge |
| Stat strip (3 tiles) | Remaining tasks · Completed tasks · Avg task time (mins) |
| Task sections | Three groups: **Urgent** (discharge cleans) · **In Progress** · **Up Next** |
| Task card | Room number · task type badge · requesting info · elapsed time · Start button |
| Task type badges | Discharge clean (coral) · Checkout (teal) · Routine (gray) · In Progress (blue) |
| Progress bar | Shown on In Progress card only — step X of Y · estimated time remaining |
| Bottom nav | Tasks · Checklist · Supplies · Profile |

**Task priority rules:**
- Discharge cleans always surface first — sorted by minutes since patient departed
- Checkout rooms second — sorted by checkout time
- Routine cleans third — sorted by scheduled time
- Lock-in areas (e.g. ED) always show on queue regardless of other tasks

#### 3.1.2 Room Checklist Screen

Opened when a housekeeper taps Start on any task card. Protocol-specific steps are loaded based on room type and clean type.

| Element | Behavior / Data |
|---|---|
| Room header | Room number, clean type, patient name if discharge, start time, step progress bar |
| Checklist sections | Grouped by zone: Bed area · Bathroom · Floor · Surfaces · Supplies restocked |
| Step item | Checkbox · step description · HAI-risk flag (coral badge) if applicable |
| HAI-risk flag | Shown on steps touching high-contact surfaces (toilet, call button, sink handles) |
| Photo verification | 2 photo slots (configurable per room type) — tap to open camera, shows thumbnail on capture |
| Submit button | Disabled until all steps checked and photos captured. Shows blocking message listing gaps if tapped early. |
| Completion timestamp | Auto-recorded on submit: staff ID, room ID, start time, end time, step data, photo URLs |

**Blocking logic on submit:**
- If any required step is unchecked → list unchecked steps, prevent submit
- If required photo slots are empty → highlight empty slots, prevent submit
- On successful submit → fire completion event (see Section 4: Core Event Flows)

#### 3.1.3 Linen & Supply Tracking Screen

Accessible via bottom nav. Allows staff to log linen usage per room and flag low stock.

- Log linen count per clean (sheets, pillowcases, towels, gowns)
- Flag supply cart as low — pushes alert to supervisor dashboard
- Usage logged against room and staff ID for waste reporting

---

### 3.2 Patient Transport Module — Transporter Mobile View

#### 3.2.1 Job Queue Screen

Home screen for transport staff. Shows active job, incoming job requests, and shift stats.

| Element | Behavior / Data |
|---|---|
| Availability toggle | On/Off — when Off, no new jobs are dispatched to this transporter |
| Stat strip (3 tiles) | Jobs in queue · Done today · Avg job time (mins) |
| Active job banner | Patient name, route (From → To), progress bar, Mark Delivered button |
| Incoming job card | Patient name, pickup location, destination, badge (Stat/Radiology/Discharge), equipment needed, requester name, timestamp, Accept/Decline actions |
| Job type badges | Stat (coral) · Radiology (purple) · Discharge (teal) · Routine (gray) |
| Shift summary | Done, Pending, Avg time — shown at bottom of queue |
| Bottom nav | Queue · History · Map · Profile |

**Job assignment logic:**
- System dispatches to nearest available transporter based on current floor/location
- If no acceptance within 5 minutes, job escalates to supervisor alert
- Transporter can only hold 1 active job at a time — incoming jobs queue behind it
- Stat jobs interrupt queue order and surface at top regardless of position

#### 3.2.2 Job Status Flow

Each transport job passes through four states. Timestamps are recorded at each transition.

| State | Trigger | Who Acts |
|---|---|---|
| Requested | Nurse assigns patient to room OR clinical staff submits transport form | System auto or nurse |
| Accepted | Transporter taps Accept on job card | Transporter |
| In Progress | Transporter taps Mark en route / arrives at pickup | Transporter |
| Complete | Transporter taps Mark delivered at destination | Transporter |

#### 3.2.3 NEMT / Ride Coordination

For post-discharge external transport. Supervisor or admin can schedule external rides.

- Select patient, destination address, time, and mobility requirements
- Integrates with NEMT API to confirm ride and return ETA
- Patient receives reminder via SMS (if phone on file)
- Missed/late NEMT rides flag to supervisor dashboard

---

### 3.3 Supervisor Dashboard — Web + Mobile View

#### 3.3.1 Live Operations View

| Panel | Content |
|---|---|
| Metric strip (4 tiles) | Dirty beds count · Avg turnover time · Pending transport jobs · Compliance rate |
| EVS staff panel | Avatar · name · current task · status dot (green = active, amber = overdue, gray = break) |
| Transport staff panel | Avatar · name · current job route · status dot |
| Room status grid | All rooms on wing, color coded: Dirty (coral) · In Progress (blue) · Clean & Ready (teal) · Occupied (gray) · Offline (light gray) |
| Alerts feed | Auto-generated alerts sorted by severity |

#### 3.3.2 Alert Types

| Alert | Trigger Condition | Severity |
|---|---|---|
| Bed unassigned | Room clean > 30 min with no patient assigned | Warning |
| Transport unaccepted | Job request unaccepted for > 5 min | Warning |
| Long turnaround | Discharge clean time exceeds 45 min | Warning |
| Linen overage | Daily linen usage > 20% above wing average | Info |
| RN doing transport | Nurse role submits a transport completion | Warning |
| Staff no-show | Staff marked On Shift but no task activity for 30 min | Warning |
| Checklist skipped | Room marked complete with < 100% steps (manual override) | Critical |

#### 3.3.3 Compliance Audit Trail

Every room clean and transport job is permanently recorded. Accessible by supervisors and admins.

- **Room clean record:** staff ID, room, clean type, start/end timestamps, step checklist, photo URLs, duration
- **Transport record:** staff ID, patient ID, route, equipment, request source, timestamps per state
- Audit records are read-only — cannot be edited after submission
- Export to CSV available for Joint Commission or infection control review

---

### 3.4 Administration & Reporting Module — Administrator Web View

#### 3.4.1 Finance & KPI Dashboard

| KPI | Calculation | Target |
|---|---|---|
| Cost per EVS task | Total labor cost / total tasks completed in period | < $9.00 |
| Cost per transport | Total labor cost / total jobs completed in period | < $13.00 |
| Avg bed turnaround | Mean(discharge timestamp → room ready timestamp) | < 25 min |
| Overtime rate | OT hours / total scheduled hours | < 3% |
| Checklist compliance | Rooms with 100% steps / total rooms cleaned | > 95% |
| Photo compliance | Rooms with all photos captured / total rooms cleaned | > 90% |
| On-time transport | Jobs completed within estimated time / total jobs | > 85% |

#### 3.4.2 Report Exports

- **PDF summary report:** KPIs, labor hours, top cost items, compliance rates — by date range
- **CSV labor export:** staff ID, role, hours worked, tasks completed, OT hours — per period
- **CSV compliance export:** room ID, clean type, completion %, staff, timestamps — per period
- **Payroll sync:** labor hours export formatted for payroll system import (configurable format)

---

### 3.5 Smart Scheduling Module — Supervisor + Admin

#### 3.5.1 Shift Schedule View

Weekly grid view showing all EVS and transport staff shifts. Demand forecast bars shown above the grid.

| Element | Behavior |
|---|---|
| Demand forecast bar chart | 7-day projected demand based on historical census data. High-demand days flagged in amber. |
| Shift grid | Rows = staff, Columns = days. Cells show shift type: Day / Evening / Off / OT (overtime flagged in coral) |
| Empty cell | Dashed border — tap to assign shift. Triggers staff availability check. |
| AI suggestion banner | Surfaces when projected demand exceeds staffed capacity. Suggests specific shift changes with one-tap apply. |
| Insight tiles | Projected labor cost · Overtime risk days · Coverage gaps · Pending shift swap requests |

#### 3.5.2 Demand Forecasting Logic

- Pulls 90-day historical task volume data per day of week
- Weights recent 30 days more heavily than older data
- Incorporates census feed if EHR integration is active — higher census = higher predicted demand
- Flags days where current staffing is below 85% of predicted demand

---

## 4. Core Event Flow: Room Completion

This is the most critical event chain in the system. Every actor and data system involved when a housekeeper submits a room as complete.

### 4.1 Pre-Submission Validation

When the housekeeper taps **Mark Complete**, the client performs local validation before the API call:

- All checklist steps are checked — if any unchecked, list them and block
- All required photo slots are filled — if any empty, highlight and block
- On validation pass → `POST /api/rooms/{roomId}/complete`

### 4.2 Server-Side on Completion

On receipt of the completion POST, the server executes the following in parallel:

| Action | System | Recipient |
|---|---|---|
| Record completion timestamp + full payload | Database | Audit log |
| Update room status: dirty → clean_ready | Room state service | All dashboard clients |
| Push notification: Room {N} is ready | Push notification service | Charge nurse / RN assigned to wing |
| Log turnaround time | Analytics service | Supervisor dashboard KPI tiles |
| Update compliance score | Compliance service | Admin finance dashboard |
| Update housekeeper task queue | Task service | Housekeeper mobile app |
| Write finance record (cost per task) | Finance service | Admin reporting module |

### 4.3 Nurse Bed Assignment Flow

- Nurse receives push notification and opens app
- Bed board shows room in **Clean & Ready** state with turnaround time and cleaner name
- Nurse taps **Assign Patient** → bottom sheet opens showing: room details, clean verification summary, waiting patient list from ED queue
- Nurse selects patient → confirms → `POST /api/rooms/{roomId}/assign`
- On assignment: room status updates to **Assigned**, transport request auto-created if patient mobility flag is set

### 4.4 Auto-Transport Request

If the patient has a mobility flag (wheelchair, stretcher) on their record, a transport job is auto-created on bed assignment:

- Job created with: patient ID, pickup location (current patient location), destination (assigned room), equipment needed, requesting nurse ID
- Job dispatched to nearest available transporter
- Nurse transport tracker updates in real time as transporter accepts and progresses
- If no acceptance in 5 min → supervisor alert fires

### 4.5 Supervisor Live Feed

Every event in the chain (room cleaned, bed assigned, transport accepted) appears as a timestamped entry in the supervisor activity feed. The feed is a real-time WebSocket stream — no refresh required.

---

## 5. API Contracts

All endpoints require JWT authentication. Role-based access enforced server-side.

### 5.1 Room Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/rooms` | Supervisor, Admin | List all rooms with current status |
| GET | `/api/rooms/{id}` | All | Get room detail including last clean record |
| POST | `/api/rooms/{id}/start-clean` | Housekeeper | Begin a clean — records start timestamp |
| POST | `/api/rooms/{id}/complete` | Housekeeper | Submit clean — triggers event chain (Section 4) |
| POST | `/api/rooms/{id}/assign` | Nurse, Supervisor | Assign patient to clean room |
| GET | `/api/rooms/{id}/audit` | Supervisor, Admin | Full audit trail for room |

### 5.2 Transport Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/transport/jobs` | Transporter, Supervisor | List jobs — filtered by status and assignee |
| POST | `/api/transport/jobs` | Nurse, Supervisor, System | Create transport request |
| PATCH | `/api/transport/jobs/{id}/accept` | Transporter | Accept job — records timestamp |
| PATCH | `/api/transport/jobs/{id}/status` | Transporter | Update status: en_route, arrived, complete |
| GET | `/api/transport/jobs/{id}` | All | Get job detail with full status history |

### 5.3 Scheduling Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/schedule` | Supervisor, Admin | Get weekly schedule for all staff |
| PUT | `/api/schedule/{staffId}/{date}` | Supervisor, Admin | Set or update a shift |
| GET | `/api/schedule/forecast` | Supervisor, Admin | Demand forecast for next 7 days |
| POST | `/api/schedule/suggestions` | Supervisor, Admin | Get AI staffing suggestions for date range |

### 5.4 Reporting Endpoints

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/api/reports/kpi` | Admin | KPI summary for date range |
| GET | `/api/reports/labor` | Admin | Labor hours by staff and department |
| GET | `/api/reports/compliance` | Supervisor, Admin | Checklist + photo compliance rates |
| GET | `/api/reports/cost-per-task` | Admin | Cost per task by department and period |
| GET | `/api/reports/export/pdf` | Admin | Generate PDF summary report |
| GET | `/api/reports/export/csv` | Admin | Export raw data as CSV |

---

## 6. Third-Party Integrations

| Integration | Purpose | Direction | Notes |
|---|---|---|---|
| EHR (e.g. Epic, Cerner) | Discharge events, patient census, patient mobility flags | Inbound | HL7 FHIR R4 preferred. Webhook or polling fallback. Required for auto-transport trigger. |
| Payroll system | Labor hours export for payroll processing | Outbound | CSV export, format configurable per hospital system |
| NEMT provider API | External ride scheduling and ETA | Bidirectional | REST API — provider-specific. Lyft Health, Modivcare, or custom. |
| Push notification | Real-time alerts to mobile apps | Outbound | Firebase Cloud Messaging (FCM) for Android, APNs for iOS |
| WebSocket server | Live dashboard updates | Bidirectional | All supervisor and admin dashboard data streams over WebSocket |

---

## 7. Core Data Model

Simplified entity overview. Full ERD to be produced in separate schema document.

### Room
```
room_id           PK
wing_id           FK
room_number
room_type         single | double | isolation
status            dirty | in_progress | clean_ready | occupied | offline
current_patient_id  FK, nullable
last_clean_id     FK
mobility_equipment_required
```

### Clean Record
```
clean_id          PK
room_id           FK
staff_id          FK
clean_type        discharge | checkout | routine
started_at
completed_at
steps_completed   JSON
photos            JSON array of URLs
compliance_score
```

### Transport Job
```
job_id            PK
patient_id        FK
requested_by      FK → staff
assigned_to       FK → staff, nullable
from_location
to_location
equipment         wheelchair | stretcher | none
priority          stat | routine
status            requested | accepted | in_progress | complete
timestamps        JSON per status
```

### Staff
```
staff_id          PK
name
role              housekeeper | transporter | supervisor | admin | nurse
wing_id           FK, nullable
current_location  floor, nullable
availability_status
shift_start
shift_end
```

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Task queue load time < 1.5 seconds on 4G connection
- Room status update visible on supervisor dashboard within 2 seconds of submission
- Push notification delivered within 5 seconds of trigger event
- Dashboard WebSocket reconnects automatically within 3 seconds of dropped connection

### 8.2 Reliability
- Offline mode required for housekeeper and transporter apps — checklist steps and photo capture must work without connectivity, sync on reconnect
- Offline queue: store up to 50 pending sync events locally
- Target uptime: 99.5% (< 3.6 hrs downtime/month) — hospital operational hours are 24/7

### 8.3 Security & Compliance
- PHI handling: patient name and ID shown only to authorized roles. Transport job cards show patient name to assigned transporter only.
- JWT tokens expire every 8 hours (aligned to shift length). Refresh token on active use.
- All audit records are immutable — no UPDATE or DELETE permitted on completion records
- HIPAA compliance required — all PHI encrypted at rest (AES-256) and in transit (TLS 1.2+)
- Photo uploads stored in HIPAA-compliant object storage (e.g. AWS S3 with BAA)

### 8.4 Accessibility
- WCAG 2.1 AA minimum for web dashboard
- Mobile apps: minimum touch target 44×44pt, minimum contrast 4.5:1
- All alerts communicated via text + color (never color alone)

---

## 9. Build Phases

| Phase | Scope | Deliverable |
|---|---|---|
| Phase 1 — Core Mobile | Housekeeper task queue + checklist · Transporter job queue + status flow · Basic supervisor room status grid | MVP — replaces pager/IVR workflow |
| Phase 2 — Event Chain | Room completion event → nurse notification → bed assignment → auto-transport request · Supervisor live activity feed | Full discharge-to-admit loop automated |
| Phase 3 — Dashboard & Reporting | Full supervisor dashboard (alerts, staff panels) · Admin finance & KPI reporting · CSV/PDF exports | Management visibility complete |
| Phase 4 — Scheduling & Integrations | Smart scheduling with demand forecast · EHR discharge feed integration · Payroll export · NEMT API | Full platform with external data |

> Each phase is designed to be independently shippable and deliver standalone value. Phase 1 alone replaces the pager/IVR system and begins capturing compliance data.

---

## 10. Open Questions for Engineering

1. **EHR integration method:** Does the target hospital system support FHIR webhooks, or will polling be required?
2. **Offline sync conflict resolution:** If a checklist is completed offline and the room status changed server-side in the interim, what is the merge strategy?
3. **Photo storage:** What is the maximum photo retention period required for compliance? (Affects storage cost.)
4. **NEMT provider:** Has a specific NEMT vendor been selected, or is the integration interface to remain generic?
5. **Scheduling AI:** Is the demand forecasting model to be built in-house or integrated from a third-party workforce management platform?
6. **Multi-hospital:** Is this a single-hospital deployment or multi-facility SaaS? (Affects data isolation architecture.)
7. **Nurse app:** Is the nurse bed assignment view a standalone module or expected to embed into an existing nurse-facing system?
