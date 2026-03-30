import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

let io: SocketIOServer;

export function initializeSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // JWT authentication on handshake
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server configuration error'));
      }
      const decoded = jwt.verify(token, secret) as JwtPayload;
      (socket as Socket & { user: JwtPayload }).user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as Socket & { user: JwtPayload }).user;
    console.log(`[Socket] Client connected: ${user.name} (${user.role}) - ${socket.id}`);

    // Supervisors and admins join the global ops room for all events
    if (user.role === 'supervisor' || user.role === 'admin') {
      socket.join('ops-room');
      console.log(`[Socket] ${user.name} joined ops-room`);
    }

    // All staff join their wing room if they have one
    if (user.wingId) {
      socket.join(`wing:${user.wingId}`);
      console.log(`[Socket] ${user.name} joined wing:${user.wingId}`);
    }

    // Join personal room for direct notifications
    socket.join(`user:${user.userId}`);

    // Join role-based room
    socket.join(`role:${user.role}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${user.name} - ${reason}`);
    });

    socket.on('error', (error) => {
      console.error(`[Socket] Error for ${user.name}:`, error);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io || null
}

// Emit helpers — all silently no-op when Socket.io is not initialized (e.g. Vercel serverless)
export function emitRoomUpdate(roomId: string, status: string, roomNumber: string, wingId?: string | null): void {
  if (!io) return
  const payload = { roomId, status, roomNumber, updatedAt: new Date() }
  io.to('ops-room').emit('room:status-updated', payload)
  if (wingId) io.to(`wing:${wingId}`).emit('room:status-updated', payload)
}

export function emitRoomCompleted(roomId: string, cleanRecord: object, turnaroundMinutes: number, wingId?: string | null): void {
  if (!io) return
  const payload = { roomId, cleanRecord, turnaroundMinutes }
  io.to('ops-room').emit('room:completed', payload)
  if (wingId) io.to(`wing:${wingId}`).emit('room:completed', payload)
}

export function emitRoomAssigned(roomId: string, patientName: string, nurseId: string): void {
  if (!io) return
  const payload = { roomId, patientName, nurseId }
  io.to('ops-room').emit('room:assigned', payload)
  io.to('role:nurse').emit('room:assigned', payload)
}

export function emitJobUpdate(jobId: string, status: string, timestamps: object): void {
  if (!io) return
  const payload = { jobId, status, timestamps }
  io.to('ops-room').emit('transport:job-updated', payload)
  io.to('role:transporter').emit('transport:job-updated', payload)
}

export function emitJobCreated(job: object): void {
  if (!io) return
  const payload = { job }
  io.to('ops-room').emit('transport:job-created', payload)
  io.to('role:transporter').emit('transport:job-created', payload)
}

export function emitJobAccepted(jobId: string, transporterId: string, transporter: object): void {
  if (!io) return
  const payload = { jobId, transporterId, transporter }
  io.to('ops-room').emit('transport:job-accepted', payload)
  io.to('role:nurse').emit('transport:job-accepted', payload)
}

export function emitAlert(alert: object): void {
  if (!io) return
  io.to('ops-room').emit('alert:new', { alert })
  io.to('role:supervisor').emit('alert:new', { alert })
  io.to('role:admin').emit('alert:new', { alert })
}

export function emitAlertResolved(alertId: string): void {
  if (!io) return
  io.to('ops-room').emit('alert:resolved', { alertId })
}

export function emitStaffStatusUpdate(staffId: string, status: boolean, currentTask: string | null): void {
  if (!io) return
  io.to('ops-room').emit('staff:status-updated', { staffId, status, currentTask })
}

export function emitActivityEntry(type: string, message: string, data: object | null, createdAt: Date): void {
  if (!io) return
  io.to('ops-room').emit('activity:new', { type, message, data, createdAt })
}
