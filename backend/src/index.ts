import 'dotenv/config'
import http from 'http'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import db from './config/database'
import { initializeSocket } from './socket/index'

import { router as authRouter } from './routes/auth'
import { router as roomsRouter } from './routes/rooms'
import { router as transportRouter } from './routes/transport'
import { router as scheduleRouter } from './routes/schedule'
import { router as reportsRouter } from './routes/reports'
import { router as suppliesRouter } from './routes/supplies'
import { router as staffRouter } from './routes/staff'
import { router as alertsRouter } from './routes/alerts'
import { router as activityRouter } from './routes/activity'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)
const isServerless = !!process.env.VERCEL

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}))

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.get('/health', async (_req, res) => {
  try {
    const { error } = await db.from('Wing').select('id').limit(1)
    if (error) throw error
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'hospital-ops-backend',
      database: 'connected',
      realtime: isServerless ? 'disabled (serverless)' : 'enabled',
      version: process.env.npm_package_version || '1.0.0',
    })
  } catch {
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), service: 'hospital-ops-backend', database: 'disconnected' })
  }
})

app.use('/api/auth', authRouter)
app.use('/api/rooms', roomsRouter)
app.use('/api/transport', transportRouter)
app.use('/api/schedule', scheduleRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/supplies', suppliesRouter)
app.use('/api/staff', staffRouter)
app.use('/api/alerts', alertsRouter)
app.use('/api/activity', activityRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err)
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message, code: 'SERVER_ERROR' })
})

// On Railway/local: start HTTP server + Socket.io. On Vercel serverless: export app only.
if (!isServerless) {
  const httpServer = http.createServer(app)
  initializeSocket(httpServer)

  httpServer.listen(PORT, () => {
    console.log(`\n🏥 Hospital Ops Backend running on port ${PORT}`)
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   Health check: http://localhost:${PORT}/health\n`)
  })

  const shutdown = (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`)
    httpServer.close(() => { console.log('[Server] HTTP server closed'); process.exit(0) })
    setTimeout(() => { console.error('[Server] Forced shutdown after timeout'); process.exit(1) }, 10_000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

process.on('unhandledRejection', (reason, promise) => { console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason) })
process.on('uncaughtException', (error) => { console.error('[Server] Uncaught Exception:', error); process.exit(1) })

export default app
