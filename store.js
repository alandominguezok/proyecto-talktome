// Almacenamiento en memoria de salas y mensajes.
// Todo el acceso a datos pasa por este módulo: cuando haya base de datos,
// se reemplaza la implementación de estas funciones sin tocar el servidor.

const MAX_HISTORY = 200

const PUBLIC_ROOMS = [
  { id: 'general', name: 'General' },
  { id: 'qa', name: 'Equipo QA' },
  { id: 'random', name: 'Random' }
]

// id -> { id, name, isPublic, members: Set<string>, messages: [] }
const rooms = new Map()
let nextMessageId = 1

for (const r of PUBLIC_ROOMS) {
  rooms.set(r.id, { id: r.id, name: r.name, isPublic: true, members: new Set(), messages: [] })
}

function getRoom (id) {
  return rooms.get(id) || null
}

function createRoom (id, name, isPublic = false) {
  const room = { id, name, isPublic, members: new Set(), messages: [] }
  rooms.set(id, room)
  return room
}

function addMember (roomId, user) {
  const room = rooms.get(roomId)
  if (room) room.members.add(user)
  return room
}

function removeMember (roomId, user) {
  const room = rooms.get(roomId)
  if (room) room.members.delete(user)
  return room
}

function isMember (roomId, user) {
  const room = rooms.get(roomId)
  return !!room && room.members.has(user)
}

// Salas que ve un usuario: las públicas y las privadas de las que es miembro.
function roomsForUser (user) {
  const list = []
  for (const room of rooms.values()) {
    const joined = room.members.has(user)
    if (!room.isPublic && !joined) continue
    list.push({
      id: room.id,
      name: room.name,
      isPublic: room.isPublic,
      joined,
      members: [...room.members]
    })
  }
  return list
}

function saveMessage (roomId, message) {
  const room = rooms.get(roomId)
  if (!room) return null
  const saved = { id: nextMessageId++, room: roomId, at: new Date().toISOString(), ...message }
  room.messages.push(saved)
  if (room.messages.length > MAX_HISTORY) room.messages.shift()
  return saved
}

// Historial visible para un usuario: mensajes públicos, de sistema,
// y privados donde es emisor o destinatario.
function historyForUser (roomId, user) {
  const room = rooms.get(roomId)
  if (!room) return []
  return room.messages.filter(m => canSee(m, user))
}

function canSee (message, user) {
  return !message.to || message.to === user || message.from === user
}

module.exports = {
  getRoom,
  createRoom,
  addMember,
  removeMember,
  isMember,
  roomsForUser,
  saveMessage,
  historyForUser,
  canSee
}
