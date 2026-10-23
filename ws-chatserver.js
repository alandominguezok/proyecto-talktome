const express = require('express')
const http = require('http')
const { WebSocketServer } = require('ws')

const HTTP_PORT = 8080
const WS_PORT = 3001
const HOST = '0.0.0.0'
const ALLOWED_ORIGINS = [
  `http://localhost:${HTTP_PORT}`,
  `http://127.0.0.1:${HTTP_PORT}`,
  process.env.PUBLIC_ORIGIN
].filter(Boolean)

const users = new Map()

// --- Servidor HTTP del cliente (puerto 8080): solo sirve el HTML ---
const app = express()
app.get('/', (req, res) =>
  res.sendFile('wsclient.html', { root: __dirname })
)

app.listen(HTTP_PORT, HOST, () =>
  console.log(`Cliente HTML en http://localhost:${HTTP_PORT}`)
)

// --- Servidor WebSocket (puerto 3001): solo WebSocket ---
const wsHttpServer = http.createServer((req, res) => {
  res.writeHead(404)
  res.end()
})

const sockserver = new WebSocketServer({
  server: wsHttpServer,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.includes(origin)
})

sockserver.on('connection', ws => {
  console.log('New client connected!')
  ws.send(JSON.stringify({ msg: 'connection established' }))

  ws.on('close', () => {
    if (ws.userId) {
      users.delete(ws.userId)
      console.log(`User ${ws.userId} has disconnected!`)
    } else {
      console.log('Client has disconnected!')
    }
  })

  ws.on('error', err => console.log('websocket error', err.message))

  ws.on('message', data => {
    let message
    try {
      message = JSON.parse(data)
    } catch (error) {
      console.error('Error al parsear JSON:', error)
      return
    }
    console.log('Received JSON:', message)

    if (message.join) {
      if (users.has(message.join)) {
        ws.send(JSON.stringify({ msg: `Error: ${message.join} ya está en uso.` }))
        return
      }
      ws.userId = message.join
      users.set(message.join, ws)
      console.log(`User registered: ${message.join}`)
      ws.send(JSON.stringify({ msg: `Registrado como ${message.join}` }))
      return
    }

    if (!ws.userId) {
      ws.send(JSON.stringify({ msg: 'Error: primero debes hacer join.' }))
      return
    }

    if (message.to && message.msg) {
      const { to, msg } = message
      const payload = JSON.stringify({ from: ws.userId, to, msg }) // from lo fija el servidor

      if (to === 'all') {
        sockserver.clients.forEach(client => {
          if (client.readyState === ws.OPEN) client.send(payload)
        })
      } else {
        const target = users.get(to)
        if (target && target.readyState === ws.OPEN) {
          target.send(payload)
          ws.send(payload)
        } else {
          ws.send(JSON.stringify({ msg: `Error: Usuario ${to} no encontrado.` }))
        }
      }
    }
  })
})

wsHttpServer.listen(WS_PORT, HOST, () =>
  console.log(`WebSocket Server en ws://localhost:${WS_PORT}`)
)