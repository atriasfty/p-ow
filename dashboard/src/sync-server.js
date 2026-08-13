require('dotenv').config()

const WebSocket = require('ws')
const http = require('http')
const ywsUtils = require('y-websocket/bin/utils')
const url = require('url')
const crypto = require('crypto')
const promClient = require('prom-client')

const port = process.env.SYNC_PORT || 41730
const SYNC_SECRET = process.env.SYNC_WS_SECRET

if (!SYNC_SECRET) {
  console.error('FATAL: SYNC_WS_SECRET env var is not set — sync server refusing to start')
  process.exit(1)
}

// --- Alerting (Discord webhook, fire-and-forget) ---
const ALERT_WEBHOOK_URL = process.env.ALERT_DISCORD_WEBHOOK_URL

function sendAlert(title, message, severity = 'critical') {
  if (!ALERT_WEBHOOK_URL) return // no webhook configured — nothing to do
  const colors = { info: 0x3b82f6, warning: 0xf59e0b, critical: 0xef4444 }
  fetch(ALERT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: '@everyone',
      allowed_mentions: { parse: ['everyone'] },
      embeds: [{
        title: `${severity === 'critical' ? '🔴' : severity === 'warning' ? '🟡' : '🔵'} ${title}`,
        description: String(message).slice(0, 3900),
        color: colors[severity] || colors.critical,
        footer: { text: `pow-sync · ${process.env.APP_ENV || process.env.NODE_ENV || 'unknown'}` },
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => { })
}

process.on('uncaughtException', (err) => {
  console.error('[FATAL] uncaughtException:', err)
  sendAlert('Sync server uncaught exception — process exiting', err.stack || err.message)
  // Attaching this listener means Node won't auto-exit; the process is now in
  // an undefined state, so exit and let PM2 restart us.
  setTimeout(() => process.exit(1), 1500)
})
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] unhandledRejection:', reason)
  sendAlert('Sync server unhandled rejection', (reason && reason.stack) || String(reason))
})

let activeConnections = 0

const promRegister = new promClient.Registry()
promClient.collectDefaultMetrics({ register: promRegister, prefix: 'pow_sync_' })
const wsConnectionsGauge = new promClient.Gauge({
  name: 'pow_sync_ws_connections',
  help: 'Current active Yjs WebSocket connections',
  registers: [promRegister],
})

const server = http.createServer(async (request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({
      ok: true,
      service: 'pow-sync',
      connections: activeConnections,
      uptimeSec: Math.round(process.uptime()),
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    }))
    return
  }

  if (request.url === '/metrics') {
    const secret = process.env.PROMETHEUS_METRICS_SECRET
    const authHeader = request.headers.authorization || ''
    const expected = `Bearer ${secret || ''}`
    const authorized = !!secret &&
      authHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))

    if (!authorized) {
      response.writeHead(401)
      response.end('Unauthorized')
      return
    }

    wsConnectionsGauge.set(activeConnections)
    const body = await promRegister.metrics()
    response.writeHead(200, { 'Content-Type': promRegister.contentType })
    response.end(body)
    return
  }

  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('POW Yjs Sync Server Running')
})

const wss = new WebSocket.Server({ server })

function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

function timingSafeEq(a, b) {
  if (a.length !== b.length || a.length === 0) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Token format issued by /api/forms/[formId]/sync-token:
 *   base64url(JSON({sub, room, exp})) + "." + base64url(HMAC_SHA256(payload, SYNC_SECRET))
 *
 * The connection is only allowed if:
 *  - signature verifies
 *  - exp has not passed
 *  - the requested doc name matches the room baked into the token
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payloadB64, sigB64] = parts

  const expected = crypto.createHmac('sha256', SYNC_SECRET).update(payloadB64).digest()
  let provided
  try { provided = b64urlDecode(sigB64) } catch { return null }
  if (!timingSafeEq(expected, provided)) return null

  let payload
  try { payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) } catch { return null }
  if (!payload || typeof payload.room !== 'string' || typeof payload.exp !== 'number') return null
  if (Math.floor(Date.now() / 1000) >= payload.exp) return null
  return payload
}

wss.on('connection', (conn, req) => {
  const reqUrl = new url.URL(req.url, 'http://localhost')
  const token = reqUrl.searchParams.get('token')

  const payload = verifyToken(token)
  if (!payload) {
    conn.close(4001, 'Unauthorized')
    return
  }

  // y-websocket reads the doc name from the path. Require it to match the
  // room the token authorizes — otherwise any valid token would let you
  // subscribe to any document.
  const docName = reqUrl.pathname.replace(/^\//, '')
  if (docName !== payload.room) {
    conn.close(4003, 'Forbidden: doc mismatch')
    return
  }

  activeConnections++
  conn.on('close', () => { activeConnections = Math.max(0, activeConnections - 1) })

  ywsUtils.setupWSConnection(conn, req)
})

server.listen(port, () => {
  console.log(`POW Yjs Sync Server running at http://localhost:${port}`)
})
