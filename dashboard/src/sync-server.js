require('dotenv').config()

const WebSocket = require('ws')
const http = require('http')
const ywsUtils = require('y-websocket/bin/utils')
const url = require('url')

const port = process.env.SYNC_PORT || 41730
const SYNC_SECRET = process.env.INTERNAL_SYNC_SECRET

if (!SYNC_SECRET) {
  console.error('FATAL: INTERNAL_SYNC_SECRET env var is not set — sync server refusing to start')
  process.exit(1)
}

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('POW Yjs Sync Server Running')
})

const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  const params = new url.URL(req.url, 'http://localhost').searchParams
  if (params.get('token') !== SYNC_SECRET) {
    conn.close(4001, 'Unauthorized')
    return
  }
  ywsUtils.setupWSConnection(conn, req)
})

server.listen(port, () => {
  console.log(`POW Yjs Sync Server running at http://localhost:${port}`)
})
