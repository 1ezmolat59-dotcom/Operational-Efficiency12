import { PrismaClient, RoomType, RoomStatus, CleanType, JobStatus, Equipment, JobPriority, JobType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // ─── Clear existing data ────────────────────────────────────────────────────
  await prisma.activityLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.supplyLog.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.transportJob.deleteMany();
  await prisma.cleanRecord.deleteMany();
  await prisma.room.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.wing.deleteMany();

  console.log('  ✓ Cleared existing data');

  // ─── Wings ──────────────────────────────────────────────────────────────────
  const wingA = await prisma.wing.create({
    data: { name: 'Wing A' },
  });

  const wingB = await prisma.wing.create({
    data: { name: 'Wing B' },
  });

  console.log('  ✓ Created wings');

  // ─── Hash password ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 12);

  // ─── Staff ───────────────────────────────────────────────────────────────────
  const housekeeper1 = await prisma.staff.create({
    data: {
      name: 'Maria Santos',
      email: 'housekeeper@hospital.com',
      passwordHash,
      role: 'housekeeper',
      wingId: wingA.id,
      availabilityStatus: true,
      currentLocation: 'Wing A - Floor 1',
    },
  });

  const housekeeper2 = await prisma.staff.create({
    data: {
      name: 'James Wilson',
      email: 'housekeeper2@hospital.com',
      passwordHash,
      role: 'housekeeper',
      wingId: wingA.id,
      availabilityStatus: true,
      currentLocation: 'Wing A - Floor 2',
    },
  });

  const transporter1 = await prisma.staff.create({
    data: {
      name: 'Carlos Rivera',
      email: 'transporter@hospital.com',
      passwordHash,
      role: 'transporter',
      availabilityStatus: true,
      currentLocation: 'Main Lobby',
    },
  });

  const transporter2 = await prisma.staff.create({
    data: {
      name: 'Aisha Johnson',
      email: 'transporter2@hospital.com',
      passwordHash,
      role: 'transporter',
      availabilityStatus: true,
      currentLocation: 'Radiology',
    },
  });

  const supervisor = await prisma.staff.create({
    data: {
      name: 'Dr. Patricia Chen',
      email: 'supervisor@hospital.com',
      passwordHash,
      role: 'supervisor',
      wingId: wingA.id,
      availabilityStatus: true,
      currentLocation: 'Supervisor Station',
    },
  });

  const admin = await prisma.staff.create({
    data: {
      name: 'Robert Hayes',
      email: 'admin@hospital.com',
      passwordHash,
      role: 'admin',
      availabilityStatus: true,
    },
  });

  const nurse = await prisma.staff.create({
    data: {
      name: 'Nurse Emily Clark',
      email: 'nurse@hospital.com',
      passwordHash,
      role: 'nurse',
      wingId: wingA.id,
      availabilityStatus: true,
      currentLocation: 'Nurses Station - Wing A',
    },
  });

  console.log('  ✓ Created staff accounts');

  // ─── Rooms ───────────────────────────────────────────────────────────────────
  // Wing A — 6 rooms
  const roomA101 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-101',
      roomType: RoomType.single,
      status: RoomStatus.dirty,
    },
  });

  const roomA102 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-102',
      roomType: RoomType.single,
      status: RoomStatus.in_progress,
    },
  });

  const roomA103 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-103',
      roomType: RoomType.double,
      status: RoomStatus.clean_ready,
    },
  });

  const roomA104 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-104',
      roomType: RoomType.isolation,
      status: RoomStatus.occupied,
      currentPatientId: 'patient-001',
      patientName: 'John Doe',
      isLockIn: true,
    },
  });

  const roomA105 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-105',
      roomType: RoomType.single,
      status: RoomStatus.dirty,
      mobilityEquipmentRequired: true,
    },
  });

  const roomA106 = await prisma.room.create({
    data: {
      wingId: wingA.id,
      roomNumber: 'A-106',
      roomType: RoomType.double,
      status: RoomStatus.offline,
    },
  });

  // Wing B — 4 rooms
  const roomB201 = await prisma.room.create({
    data: {
      wingId: wingB.id,
      roomNumber: 'B-201',
      roomType: RoomType.single,
      status: RoomStatus.dirty,
    },
  });

  const roomB202 = await prisma.room.create({
    data: {
      wingId: wingB.id,
      roomNumber: 'B-202',
      roomType: RoomType.double,
      status: RoomStatus.occupied,
      currentPatientId: 'patient-002',
      patientName: 'Jane Smith',
    },
  });

  const roomB203 = await prisma.room.create({
    data: {
      wingId: wingB.id,
      roomNumber: 'B-203',
      roomType: RoomType.single,
      status: RoomStatus.clean_ready,
    },
  });

  const roomB204 = await prisma.room.create({
    data: {
      wingId: wingB.id,
      roomNumber: 'B-204',
      roomType: RoomType.isolation,
      status: RoomStatus.dirty,
    },
  });

  console.log('  ✓ Created 10 rooms across both wings');

  // ─── Clean Records ────────────────────────────────────────────────────────────
  const now = new Date();

  // Completed clean for A-103 (currently clean_ready)
  const cleanRecord1 = await prisma.cleanRecord.create({
    data: {
      roomId: roomA103.id,
      staffId: housekeeper1.id,
      cleanType: CleanType.discharge,
      startedAt: new Date(now.getTime() - 45 * 60 * 1000),
      completedAt: new Date(now.getTime() - 10 * 60 * 1000),
      stepsCompleted: [
        { id: 'step-1', label: 'Strip bed linens', checked: true, required: true },
        { id: 'step-2', label: 'Clean bathroom surfaces', checked: true, required: true },
        { id: 'step-3', label: 'Mop floor', checked: true, required: true },
        { id: 'step-4', label: 'Wipe down high-touch surfaces', checked: true, required: true },
        { id: 'step-5', label: 'Replace bed linens', checked: true, required: true },
        { id: 'step-6', label: 'Restock supplies', checked: true, required: true },
      ],
      photos: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
      complianceScore: 100,
      duration: 35,
    },
  });

  // Update A-103 with last clean reference
  await prisma.room.update({
    where: { id: roomA103.id },
    data: { lastCleanId: cleanRecord1.id },
  });

  // Active clean for A-102 (in_progress)
  await prisma.cleanRecord.create({
    data: {
      roomId: roomA102.id,
      staffId: housekeeper2.id,
      cleanType: CleanType.checkout,
      startedAt: new Date(now.getTime() - 20 * 60 * 1000),
    },
  });

  // Completed clean with compliance issue (95%)
  await prisma.cleanRecord.create({
    data: {
      roomId: roomB203.id,
      staffId: housekeeper1.id,
      cleanType: CleanType.routine,
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      completedAt: new Date(now.getTime() - 90 * 60 * 1000),
      stepsCompleted: [
        { id: 'step-1', label: 'Strip bed linens', checked: true, required: true },
        { id: 'step-2', label: 'Clean bathroom surfaces', checked: true, required: true },
        { id: 'step-3', label: 'Mop floor', checked: false, required: true },
        { id: 'step-4', label: 'Wipe down high-touch surfaces', checked: true, required: true },
        { id: 'step-5', label: 'Replace bed linens', checked: true, required: true },
        { id: 'step-6', label: 'Restock supplies', checked: true, required: true },
      ],
      photos: ['https://example.com/photo3.jpg'],
      complianceScore: 83.33,
      duration: 28,
    },
  });

  // Historical records for demand forecasting (last 90 days)
  const historicalCleans = [];
  for (let i = 1; i <= 90; i++) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dow = date.getDay();
    // More cleans on weekdays
    const cleanCount = dow === 0 || dow === 6 ? 2 : 4;

    for (let j = 0; j < cleanCount; j++) {
      const startTime = new Date(date);
      startTime.setHours(8 + j * 2, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

      const rooms = [roomA101, roomA105, roomB201, roomB204];
      const targetRoom = rooms[j % rooms.length];
      const staffMembers = [housekeeper1, housekeeper2];
      const targetStaff = staffMembers[j % staffMembers.length];

      historicalCleans.push({
        roomId: targetRoom.id,
        staffId: targetStaff.id,
        cleanType: j % 3 === 0 ? CleanType.discharge : CleanType.routine,
        startedAt: startTime,
        completedAt: endTime,
        stepsCompleted: [
          { id: 'step-1', label: 'Strip bed linens', checked: true, required: true },
          { id: 'step-2', label: 'Clean bathroom surfaces', checked: true, required: true },
          { id: 'step-3', label: 'Mop floor', checked: true, required: true },
          { id: 'step-4', label: 'Wipe down high-touch surfaces', checked: true, required: true },
          { id: 'step-5', label: 'Replace bed linens', checked: true, required: true },
          { id: 'step-6', label: 'Restock supplies', checked: true, required: true },
        ],
        photos: ['https://example.com/historical-photo.jpg'],
        complianceScore: 100,
        duration: 30,
      });
    }
  }

  // Batch insert historical records
  await prisma.cleanRecord.createMany({ data: historicalCleans });

  console.log('  ✓ Created clean records (including 90-day history)');

  // ─── Transport Jobs ───────────────────────────────────────────────────────────
  // Active job (requested, not yet accepted)
  await prisma.transportJob.create({
    data: {
      patientId: 'patient-003',
      patientName: 'Michael Brown',
      requestedBy: nurse.id,
      assignedTo: transporter1.id,
      fromLocation: 'A-104',
      toLocation: 'Radiology - Room 2',
      roomId: roomA104.id,
      equipment: Equipment.wheelchair,
      priority: JobPriority.stat,
      jobType: JobType.radiology,
      status: JobStatus.requested,
      timestamps: { requested: new Date(now.getTime() - 3 * 60 * 1000).toISOString() },
      requesterName: nurse.name,
    },
  });

  // In-progress job
  await prisma.transportJob.create({
    data: {
      patientId: 'patient-002',
      patientName: 'Jane Smith',
      requestedBy: nurse.id,
      assignedTo: transporter2.id,
      fromLocation: 'B-202',
      toLocation: 'Physical Therapy',
      roomId: roomB202.id,
      equipment: Equipment.wheelchair,
      priority: JobPriority.routine,
      jobType: JobType.routine,
      status: JobStatus.in_progress,
      timestamps: {
        requested: new Date(now.getTime() - 40 * 60 * 1000).toISOString(),
        accepted: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
        en_route: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      },
      requesterName: nurse.name,
    },
  });

  // Completed job
  await prisma.transportJob.create({
    data: {
      patientId: 'patient-001',
      patientName: 'John Doe',
      requestedBy: nurse.id,
      assignedTo: transporter1.id,
      fromLocation: 'A-104',
      toLocation: 'Discharge Lounge',
      roomId: roomA104.id,
      equipment: Equipment.stretcher,
      priority: JobPriority.routine,
      jobType: JobType.discharge,
      status: JobStatus.complete,
      timestamps: {
        requested: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        accepted: new Date(now.getTime() - 115 * 60 * 1000).toISOString(),
        en_route: new Date(now.getTime() - 100 * 60 * 1000).toISOString(),
        complete: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      },
      requesterName: nurse.name,
    },
  });

  console.log('  ✓ Created transport jobs');

  // ─── Schedules ────────────────────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduleData = [];
  const staffToSchedule = [housekeeper1, housekeeper2, transporter1, transporter2, supervisor];
  const shiftTypes = ['day', 'day', 'evening', 'day', 'off'] as const;

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dow = date.getDay();

    for (let s = 0; s < staffToSchedule.length; s++) {
      const staff = staffToSchedule[s];
      let shiftType: 'day' | 'evening' | 'off' | 'overtime';

      if (dow === 0 || dow === 6) {
        // Weekend: reduced staffing
        shiftType = s < 2 ? 'day' : 'off';
      } else {
        shiftType = shiftTypes[s];
      }

      scheduleData.push({
        staffId: staff.id,
        date,
        shiftType,
      });
    }
  }

  await prisma.schedule.createMany({ data: scheduleData });

  console.log('  ✓ Created 7-day schedules');

  // ─── Supply Logs ──────────────────────────────────────────────────────────────
  await prisma.supplyLog.createMany({
    data: [
      {
        staffId: housekeeper1.id,
        roomId: roomA103.id,
        sheets: 2,
        pillowcases: 4,
        towels: 3,
        gowns: 1,
        flaggedLow: false,
      },
      {
        staffId: housekeeper2.id,
        roomId: roomA102.id,
        sheets: 2,
        pillowcases: 4,
        towels: 2,
        gowns: 1,
        flaggedLow: false,
      },
      {
        staffId: housekeeper1.id,
        roomId: roomB203.id,
        sheets: 6,
        pillowcases: 8,
        towels: 5,
        gowns: 2,
        flaggedLow: true,
      },
    ],
  });

  console.log('  ✓ Created supply logs');

  // ─── Alerts ───────────────────────────────────────────────────────────────────
  await prisma.alert.createMany({
    data: [
      {
        type: 'bed_unassigned',
        severity: 'warning',
        message: 'Room B-203 has been clean and ready for over 30 minutes with no patient assigned.',
        roomId: roomB203.id,
        resolved: false,
      },
      {
        type: 'checklist_skipped',
        severity: 'critical',
        message: 'Room B-203 completed with 83.3% checklist compliance. Some steps were skipped.',
        roomId: roomB203.id,
        staffId: housekeeper1.id,
        resolved: false,
      },
    ],
  });

  console.log('  ✓ Created alerts');

  // ─── Activity Logs ────────────────────────────────────────────────────────────
  await prisma.activityLog.createMany({
    data: [
      {
        type: 'room_cleaned',
        message: 'Room A-103 cleaned in 35 minutes by Maria Santos',
        data: { duration: 35, complianceScore: 100 },
        staffId: housekeeper1.id,
        roomId: roomA103.id,
      },
      {
        type: 'room_clean_started',
        message: 'Cleaning started for room A-102',
        data: { cleanType: 'checkout' },
        staffId: housekeeper2.id,
        roomId: roomA102.id,
      },
      {
        type: 'transport_job_created',
        message: 'Transport job created for Michael Brown',
        data: { priority: 'stat' },
        staffId: nurse.id,
      },
    ],
  });

  console.log('  ✓ Created activity logs');

  console.log('\n✅ Seed complete!');
  console.log('\n📋 Login credentials (password: password123):');
  console.log('   housekeeper@hospital.com   — Housekeeper (Wing A)');
  console.log('   housekeeper2@hospital.com  — Housekeeper (Wing A)');
  console.log('   transporter@hospital.com   — Transporter');
  console.log('   transporter2@hospital.com  — Transporter');
  console.log('   supervisor@hospital.com    — Supervisor (Wing A)');
  console.log('   admin@hospital.com         — Admin');
  console.log('   nurse@hospital.com         — Nurse (Wing A)\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
