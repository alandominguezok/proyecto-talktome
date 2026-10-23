const express = require('express')
const http = require('http')
const path = require('path')
const { WebSocketServer, WebSocket } = require('ws')
const store = require('./store')

const HTTP_PORT = Number(process.env.HTTP_PORT) || 8080
const WS_PORT = Number(process.env.WS_PORT) || 3001
const HOST = '0.0.0.0'
const ALLOWED_ORIGINS = [
  `http://localhost:${HTTP_PORT}`,
  `http://127.0.0.1:${HTTP_PORT}`,
  process.env.PUBLIC_ORIGIN
].filter(Boolean)

const NAME_RE = /^[\p{L}\p{N}_.\- ]{2,24}$/u
const ROOM_CODE_RE = /^[A-Za-z0-9_-]{3,32}$/
const MAX_TEXT = 2000

// usuario conectado -> socket
const online = new Map()

// --- Servidor HTTP del cliente (puerto 8080): sirve la app ---
const app = express()
app.get('/config.js', (req, res) => {
  res.type('application/javascript')
  res.send(`window.TALKTOME_CONFIG = ${JSON.stringify({ wsPort: WS_PORT })};`)
})
app.use(express.static(path.join(__dirname, 'public')))

app.listen(HTTP_PORT, HOST, () =>
  console.log(`Cliente en http://localhost:${HTTP_PORT}`)
)

// --- Servidor WebSocket (puerto 3001) ---
const wsHttpServer = http.createServer((req, res) => {
  res.writeHead(404)
  res.end()
})

const sockserver = new WebSocketServer({
  server: wsHttpServer,
  maxPayload: 16 * 1024,
  verifyClient: ({ origin }) => ALLOWED_ORIGINS.includes(origin)
})

function send (ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
}

function sendToUser (user, payload) {
  send(online.get(user), payload)
}

function sendError (ws, code, message) {
  send(ws, { type: 'error', code, message })
}

function broadcastPresence () {
  const users = [...online.keys()]
  for (const ws of online.values()) send(ws, { type: 'presence', online: users })
}

// Cada usuario recibe su propia lista (las salas privadas solo las ven sus miembros).
function broadcastRooms () {
  for (const [user, ws] of online) send(ws, { type: 'rooms', rooms: store.roomsForUser(user) })
}

// Entrega un mensaje ya guardado a quien corresponde.
function deliver (roomId, message) {
  const room = store.getRoom(roomId)
  if (!room) return
  for (const member of room.members) {
    if (store.canSee(message, member)) sendToUser(member, { type: 'message', message })
  }
}

function systemMessage (roomId, text) {
  const message = store.saveMessage(roomId, { system: true, text })
  deliver(roomId, message)
}

const handlers = {
  login (ws, data) {
    if (ws.user) return sendError(ws, 'already_logged_in', 'Ya iniciaste sesión.')
    const name = String(data.name || '').trim()
    if (!NAME_RE.test(name)) {
      return sendError(ws, 'invalid_name', 'El nombre debe tener entre 2 y 24 caracteres (letras, números, espacios, punto, guion).')
    }
    if (online.has(name)) {
      return sendError(ws, 'name_taken', `El nombre ${name} ya está en uso.`)
    }
    ws.user = name
    online.set(name, ws)
    console.log(`Login: ${name}`)
    send(ws, { type: 'welcome', user: name, online: [...online.keys()], rooms: store.roomsForUser(name) })
    broadcastPresence()
  },

  join (ws, data) {
    const code = String(data.room || '').trim()
    let room = store.getRoom(code) || store.getRoom(code.toLowerCase())
    let created = false
    if (!room) {
      if (!ROOM_CODE_RE.test(code)) {
        return sendError(ws, 'invalid_room', 'El código debe tener entre 3 y 32 caracteres (letras, números, guion).')
      }
      room = store.createRoom(code, code, false)
      created = true
    }
    if (store.isMember(room.id, ws.user)) {
      return send(ws, { type: 'joined', room: room.id, history: store.historyForUser(room.id, ws.user) })
    }
    store.addMember(room.id, ws.user)
    systemMessage(room.id, created ? `${ws.user} creó la sala` : `${ws.user} se unió a la conversación`)
    send(ws, { type: 'joined', room: room.id, history: store.historyForUser(room.id, ws.user) })
    broadcastRooms()
  },

  leave (ws, data) {
    const roomId = String(data.room || '')
    if (!store.isMember(roomId, ws.user)) return sendError(ws, 'not_member', 'No estás en esa conversación.')
    systemMessage(roomId, `${ws.user} salió de la conversación`)
    store.removeMember(roomId, ws.user)
    send(ws, { type: 'left', room: roomId })
    broadcastRooms()
  },

  history (ws, data) {
    const roomId = String(data.room || '')
    if (!store.isMember(roomId, ws.user)) return sendError(ws, 'not_member', 'No estás en esa conversación.')
    send(ws, { type: 'joined', room: roomId, history: store.historyForUser(roomId, ws.user) })
  },

  message (ws, data) {
    const roomId = String(data.room || '')
    const text = String(data.text || '').trim()
    const to = data.to ? String(data.to) : null

    if (!store.isMember(roomId, ws.user)) return sendError(ws, 'not_member', 'Primero unite a la conversación.')
    if (!text) return sendError(ws, 'empty', 'El mensaje está vacío.')
    if (text.length > MAX_TEXT) return sendError(ws, 'too_long', `El mensaje supera los ${MAX_TEXT} caracteres.`)
    if (to) {
      if (to === ws.user) return sendError(ws, 'invalid_recipient', 'No podés mandarte un mensaje privado a vos.')
      if (!store.isMember(roomId, to)) return sendError(ws, 'invalid_recipient', `${to} no está en esta conversación.`)
    }

    // "from" lo fija el servidor, nunca el cliente
    const message = store.saveMessage(roomId, { from: ws.user, to, text })
    deliver(roomId, message)
  }
}

sockserver.on('connection', ws => {
  ws.on('message', raw => {
    let data
    try {
      data = JSON.parse(raw)
    } catch (error) {
      return sendError(ws, 'bad_json', 'Mensaje inválido.')
    }
    const handler = handlers[data && data.type]
    if (!handler) return sendError(ws, 'unknown_type', 'Acción desconocida.')
    if (data.type !== 'login' && !ws.user) return sendError(ws, 'not_logged_in', 'Primero iniciá sesión.')
    handler(ws, data)
  })

  ws.on('close', () => {
    if (ws.user && online.get(ws.user) === ws) {
      online.delete(ws.user)
      console.log(`Logout: ${ws.user}`)
      broadcastPresence()
    }
  })

  ws.on('error', err => console.log('websocket error', err.message))
})

wsHttpServer.listen(WS_PORT, HOST, () =>
  console.log(`WebSocket en ws://localhost:${WS_PORT}`)
)
