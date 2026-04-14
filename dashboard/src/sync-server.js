const WebSocket = require('ws')
const http = require('http')
const ywsUtils = require('y-websocket/bin/utils')
const setupWSConnection = ywsUtils.setupWSConnection

const port = process.env.SYNC_PORT || 41730

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('POW Yjs Sync Server Running')
})

const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  // We can add auth checks by reading req.url or req.headers here optionally
  ywsUtils.setupWSConnection(conn, req)
})

server.listen(port, () => {
  console.log(`POW Yjs Sync Server running at http://localhost:${port}`)
})
