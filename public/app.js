/* TalkToMe — cliente con el design system Charla */
(function () {
  var C = window.Charla
  var h = React.createElement
  var useState = React.useState
  var useEffect = React.useEffect
  var useRef = React.useRef

  var cfg = window.TALKTOME_CONFIG || {}
  var WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.hostname + ':' + (cfg.wsPort || 3001)

  function hhmm (iso) {
    var d = iso ? new Date(iso) : new Date()
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
  }

  function App () {
    var wsRef = useRef(null)
    var activeRef = useRef(null)

    var meS = useState(null); var me = meS[0]; var setMe = meS[1]
    var connS = useState(false); var connecting = connS[0]; var setConnecting = connS[1]
    var loginErrS = useState(null); var loginErr = loginErrS[0]; var setLoginErr = loginErrS[1]
    var onlineS = useState([]); var online = onlineS[0]; var setOnline = onlineS[1]
    var roomsS = useState([]); var rooms = roomsS[0]; var setRooms = roomsS[1]
    var activeS = useState(null); var activeId = activeS[0]; var setActiveState = activeS[1]
    var msgsS = useState({}); var messages = msgsS[0]; var setMessages = msgsS[1]
    var unreadS = useState({}); var unread = unreadS[0]; var setUnread = unreadS[1]
    var codeErrS = useState(null); var codeErr = codeErrS[0]; var setCodeErr = codeErrS[1]
    var chatErrS = useState(null); var chatErr = chatErrS[0]; var setChatErr = chatErrS[1]

    function setActive (id) {
      activeRef.current = id
      setActiveState(id)
      setChatErr(null)
      if (id) setUnread(function (u) { var n = Object.assign({}, u); delete n[id]; return n })
    }

    function sendRaw (payload) {
      var ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
    }

    function reset () {
      setMe(null); setOnline([]); setRooms([]); setMessages({}); setUnread({}); setActive(null)
    }

    function handle (data) {
      switch (data.type) {
        case 'welcome':
          setMe(data.user)
          setOnline(data.online)
          setRooms(data.rooms)
          setLoginErr(null)
          setConnecting(false)
          data.rooms.filter(function (r) { return r.joined }).forEach(function (r) { sendRaw({ type: 'history', room: r.id }) })
          break
        case 'presence':
          setOnline(data.online)
          break
        case 'rooms':
          setRooms(data.rooms)
          break
        case 'joined':
          setMessages(function (m) { var n = Object.assign({}, m); n[data.room] = data.history; return n })
          break
        case 'left':
          setMessages(function (m) { var n = Object.assign({}, m); delete n[data.room]; return n })
          if (activeRef.current === data.room) setActive(null)
          break
        case 'message':
          var msg = data.message
          setMessages(function (m) { var n = Object.assign({}, m); n[msg.room] = (n[msg.room] || []).concat(msg); return n })
          if (msg.room !== activeRef.current && !msg.system) {
            setUnread(function (u) { var n = Object.assign({}, u); n[msg.room] = (n[msg.room] || 0) + 1; return n })
          }
          break
        case 'error':
          if (data.code === 'invalid_name' || data.code === 'name_taken') {
            setLoginErr(data.message); setConnecting(false)
            if (wsRef.current) wsRef.current.close()
          } else if (data.code === 'invalid_room') {
            setCodeErr(data.message)
          } else {
            setChatErr(data.message)
          }
          break
      }
    }

    function login (values) {
      var name = values.username
      if (!name) { setLoginErr('Escribí un nombre para entrar.'); return }
      setConnecting(true); setLoginErr(null)
      var ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen = function () { ws.send(JSON.stringify({ type: 'login', name: name })) }
      ws.onmessage = function (e) { try { handle(JSON.parse(e.data)) } catch (err) { console.error(err) } }
      ws.onerror = function () { setLoginErr('No se pudo conectar con el servidor.'); setConnecting(false) }
      ws.onclose = function () {
        if (wsRef.current !== ws) return
        wsRef.current = null
        setConnecting(false)
        setMe(function (current) {
          if (current) setLoginErr('Se perdió la conexión con el servidor. Volvé a entrar.')
          return null
        })
        reset()
      }
    }

    function logout () {
      var ws = wsRef.current
      wsRef.current = null
      if (ws) ws.close()
      reset()
    }

    useEffect(function () { return function () { if (wsRef.current) wsRef.current.close() } }, [])

    // Bajar al último mensaje cuando llega uno nuevo o se cambia de sala
    useEffect(function () {
      var log = document.querySelector('[data-testid="message-list"]')
      if (log) log.scrollTop = log.scrollHeight
    }, [messages, activeId])

    // ---------- Login ----------
    if (!me) {
      return h('div', { className: 'app-login' },
        h('div', null,
          h('p', { className: 'app-brand' }, 'TalkToMe'),
          h(C.LoginForm, {
            withPassword: false,
            usernameLabel: 'Nombre',
            usernameHint: 'Así te van a ver los demás. Tiene que ser único.',
            subtitle: 'Elegí un nombre para entrar al chat.',
            error: loginErr,
            loading: connecting,
            onSubmit: login
          })))
    }

    // ---------- Chat ----------
    function join (id) { setCodeErr(null); sendRaw({ type: 'join', room: id }); setActive(id) }
    function joinCode (code) {
      setCodeErr(null)
      var existing = rooms.filter(function (r) { return r.id.toLowerCase() === code.toLowerCase() })[0]
      var id = existing ? existing.id : code
      sendRaw({ type: 'join', room: id })
      setActive(id)
    }

    var list = rooms.map(function (r) {
      var msgs = messages[r.id] || []
      var last = msgs[msgs.length - 1]
      var preview = 'Sin mensajes'
      if (last) {
        preview = last.system ? last.text
          : (last.from === me ? 'Vos' : last.from) + (last.to ? ' (privado)' : '') + ': ' + last.text
      }
      return {
        id: r.id, name: r.name, joined: r.joined, memberCount: r.members.length,
        lastMessage: preview, time: last ? hhmm(last.at) : undefined, unread: unread[r.id]
      }
    })

    var active = rooms.filter(function (r) { return r.id === activeId && r.joined })[0]
    var members = active ? active.members.map(function (n) { return { id: n, name: n, online: online.indexOf(n) >= 0 } }) : []

    var sidebar = h(React.Fragment, null,
      h('div', { className: 'app-user' },
        h(C.Avatar, { name: me, size: 'sm', online: true }),
        h('strong', null, me),
        h(C.Button, { variant: 'ghost', onClick: logout, 'data-testid': 'logout' }, 'Salir')),
      h(C.ConversationList, { conversations: list, activeId: activeId, onSelect: setActive, onJoin: join }),
      h(C.JoinByCode, { onJoin: joinCode, error: codeErr }))

    if (!active) {
      return h('div', { className: 'app-shell' },
        h(C.ChatLayout, { sidebar: sidebar, header: null, composer: null },
          h('p', { className: 'app-empty' }, 'Elegí una conversación o unite a una.')))
    }

    var header = h(C.ChatHeader, {
      title: active.name,
      members: members,
      actions: h(C.Button, { variant: 'ghost', onClick: function () { sendRaw({ type: 'leave', room: active.id }) }, 'data-testid': 'leave-room' }, 'Salir de la sala')
    })

    var composer = h(React.Fragment, null,
      chatErr ? h('p', { className: 'ch-form-error app-error', role: 'alert', 'data-testid': 'chat-error' }, chatErr) : null,
      h(C.MessageComposer, {
        key: active.id,
        members: members,
        currentUserId: me,
        onSend: function (m) { setChatErr(null); sendRaw({ type: 'message', room: active.id, to: m.to, text: m.text }) }
      }))

    return h('div', { className: 'app-shell' },
      h(C.ChatLayout, { sidebar: sidebar, header: header, composer: composer },
        (messages[active.id] || []).map(function (m) {
          if (m.system) return h(C.MessageBubble, { key: m.id, system: true, text: m.text })
          return h(C.MessageBubble, {
            key: m.id, own: m.from === me, author: m.from, text: m.text, time: hhmm(m.at),
            to: m.to || undefined
          })
        })))
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App))
})()
