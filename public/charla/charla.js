/* @ds-bundle: {"format":4,"namespace":"Charla","components":[{"name":"Avatar"},{"name":"Button"},{"name":"TextField"},{"name":"LoginForm"},{"name":"ConversationList"},{"name":"JoinByCode"},{"name":"ChatHeader"},{"name":"MessageBubble"},{"name":"RecipientPicker"},{"name":"MessageComposer"},{"name":"ChatLayout"}]} */
(function () {
  var R = window.React;
  var h = R.createElement;
  var useState = R.useState;

  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }
  function omit(obj, keys) {
    var out = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k) && keys.indexOf(k) < 0) out[k] = obj[k];
    return out;
  }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function findMember(members, id) {
    for (var i = 0; i < (members || []).length; i++) if (members[i].id === id) return members[i];
    return null;
  }

  /* ---------- Avatar ---------- */
  function Avatar(p) {
    var size = p.size || 'md';
    return h('span', { className: cx('ch-avatar', 'ch-avatar-' + size, p.className), title: p.name },
      h('span', { 'aria-hidden': true }, initials(p.name)),
      p.online == null ? null : h('span', {
        className: cx('ch-presence', p.online ? 'is-on' : 'is-off'),
        role: 'img',
        'aria-label': p.online ? 'En línea' : 'Desconectado'
      })
    );
  }

  /* ---------- Button ---------- */
  function Button(p) {
    var rest = omit(p, ['variant', 'className', 'children', 'type']);
    return h('button', Object.assign({ type: p.type || 'button' }, rest, {
      className: cx('ch-btn', 'ch-btn-' + (p.variant || 'primary'), p.className)
    }), p.children);
  }

  /* ---------- TextField ---------- */
  function TextField(p) {
    var autoId = R.useId();
    var id = p.id || autoId;
    var rest = omit(p, ['label', 'hint', 'error', 'id', 'className', 'multiline']);
    var describedBy = p.error ? id + '-err' : p.hint ? id + '-hint' : undefined;
    return h('div', { className: cx('ch-field', p.error && 'has-error', p.className) },
      p.label ? h('label', { className: 'ch-label', htmlFor: id }, p.label) : null,
      h(p.multiline ? 'textarea' : 'input', Object.assign({ id: id, className: 'ch-input', 'aria-invalid': p.error ? true : undefined, 'aria-describedby': describedBy }, rest)),
      p.error ? h('p', { id: id + '-err', className: 'ch-field-error', role: 'alert' }, p.error)
        : p.hint ? h('p', { id: id + '-hint', className: 'ch-field-hint' }, p.hint) : null
    );
  }

  /* ---------- LoginForm ---------- */
  function LoginForm(p) {
    var u = useState(''), user = u[0], setUser = u[1];
    var pw = useState(''), pass = pw[0], setPass = pw[1];
    var title = p.title || 'Iniciar sesión';
    var withPassword = p.withPassword !== false;
    function submit(e) {
      e.preventDefault();
      if (p.onSubmit) p.onSubmit(withPassword ? { username: user.trim(), password: pass } : { username: user.trim() });
    }
    return h('form', { className: 'ch-login', onSubmit: submit, 'data-testid': 'login-form', noValidate: true },
      h('h1', { className: 'ch-login-title' }, title),
      p.subtitle ? h('p', { className: 'ch-login-sub' }, p.subtitle) : null,
      h(TextField, { label: p.usernameLabel || 'Usuario', hint: p.usernameHint, name: 'username', autoComplete: 'username', autoFocus: true, maxLength: 24, value: user, onChange: function (e) { setUser(e.target.value); }, 'data-testid': 'login-username' }),
      !withPassword ? null : h(TextField, { label: 'Contraseña', name: 'password', type: 'password', autoComplete: 'current-password', value: pass, onChange: function (e) { setPass(e.target.value); }, 'data-testid': 'login-password' }),
      p.error ? h('p', { className: 'ch-form-error', role: 'alert', 'data-testid': 'login-error' }, p.error) : null,
      h(Button, { type: 'submit', disabled: p.loading, 'data-testid': 'login-submit', className: 'ch-btn-block' }, p.loading ? 'Entrando…' : 'Entrar')
    );
  }

  /* ---------- ConversationList ---------- */
  function ConversationList(p) {
    var list = p.conversations || [];
    var joined = list.filter(function (c) { return c.joined; });
    var open = list.filter(function (c) { return !c.joined; });
    return h('nav', { className: 'ch-convs', 'aria-label': 'Conversaciones' },
      h('h2', { className: 'ch-section-title' }, 'Mis conversaciones'),
      joined.length === 0 ? h('p', { className: 'ch-empty' }, 'Todavía no estás en ninguna conversación.') :
      h('ul', { className: 'ch-conv-list' }, joined.map(function (c) {
        var active = c.id === p.activeId;
        return h('li', { key: c.id },
          h('button', {
            type: 'button',
            className: cx('ch-conv', active && 'is-active'),
            'aria-current': active ? 'true' : undefined,
            onClick: function () { p.onSelect && p.onSelect(c.id); },
            'data-testid': 'conversation-' + c.id
          },
            h(Avatar, { name: c.name, size: 'md' }),
            h('span', { className: 'ch-conv-main' },
              h('span', { className: 'ch-conv-top' },
                h('span', { className: 'ch-conv-name' }, c.name),
                c.time ? h('span', { className: 'ch-conv-time' }, c.time) : null),
              h('span', { className: 'ch-conv-bottom' },
                h('span', { className: 'ch-conv-last' }, c.lastMessage || ''),
                c.unread ? h('span', { className: 'ch-unread', 'aria-label': c.unread + ' sin leer' }, c.unread) : null)
            )
          )
        );
      })),
      open.length ? h(R.Fragment, null,
        h('h2', { className: 'ch-section-title' }, 'Disponibles para unirte'),
        h('ul', { className: 'ch-conv-list' }, open.map(function (c) {
          return h('li', { key: c.id, className: 'ch-conv ch-conv-open' },
            h(Avatar, { name: c.name, size: 'md' }),
            h('span', { className: 'ch-conv-main' },
              h('span', { className: 'ch-conv-name' }, c.name),
              h('span', { className: 'ch-conv-last' }, (c.memberCount || 0) + ((c.memberCount === 1) ? ' miembro' : ' miembros'))),
            h(Button, { variant: 'quiet', onClick: function () { p.onJoin && p.onJoin(c.id); }, 'data-testid': 'join-' + c.id }, 'Unirme')
          );
        }))
      ) : null
    );
  }

  /* ---------- JoinByCode ---------- */
  function JoinByCode(p) {
    var s = useState(''), code = s[0], setCode = s[1];
    function submit(e) {
      e.preventDefault();
      if (code.trim() && p.onJoin) p.onJoin(code.trim());
    }
    return h('form', { className: 'ch-joincode', onSubmit: submit, 'data-testid': 'join-by-code' },
      h(TextField, { label: 'Unirse con código', placeholder: 'Ej: QA-2026', value: code, error: p.error, onChange: function (e) { setCode(e.target.value); }, 'data-testid': 'join-code-input' }),
      h(Button, { type: 'submit', variant: 'quiet', disabled: !code.trim(), 'data-testid': 'join-code-submit' }, 'Unirme')
    );
  }

  /* ---------- ChatHeader ---------- */
  function ChatHeader(p) {
    var members = p.members || [];
    var online = members.filter(function (m) { return m.online; }).length;
    var shown = members.slice(0, 4);
    return h('header', { className: 'ch-header', 'data-testid': 'chat-header' },
      h('div', { className: 'ch-header-text' },
        h('h2', { className: 'ch-header-title' }, p.title),
        h('p', { className: 'ch-header-meta' }, members.length + (members.length === 1 ? ' miembro · ' : ' miembros · ') + online + ' en línea')),
      h('div', { className: 'ch-stack', 'aria-hidden': true },
        shown.map(function (m) { return h(Avatar, { key: m.id, name: m.name, size: 'sm' }); }),
        members.length > 4 ? h('span', { className: 'ch-avatar ch-avatar-sm ch-avatar-more' }, '+' + (members.length - 4)) : null),
      p.actions || null
    );
  }

  /* ---------- MessageBubble ---------- */
  function MessageBubble(p) {
    if (p.system) {
      return h('p', { className: 'ch-system', 'data-testid': 'message-system' }, p.text);
    }
    var isPrivate = !!p.to;
    var label = null;
    if (isPrivate) {
      label = p.own ? 'Privado · para ' + p.to : 'Privado · solo para vos';
    }
    return h('div', {
      className: cx('ch-msg', p.own ? 'is-own' : 'is-other', isPrivate && 'is-private'),
      'data-testid': 'message',
      'data-private': isPrivate ? 'true' : 'false'
    },
      !p.own ? h(Avatar, { name: p.author, size: 'sm' }) : null,
      h('div', { className: 'ch-msg-body' },
        !p.own && p.showAuthor !== false ? h('span', { className: 'ch-msg-author' }, p.author) : null,
        h('div', { className: 'ch-bubble' },
          label ? h('span', { className: 'ch-private-tag' },
            h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true },
              h('path', { d: 'M4.5 7V5a3.5 3.5 0 0 1 7 0v2h.5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h.5Zm1.5 0h4V5a2 2 0 0 0-4 0v2Z', fill: 'currentColor' })),
            label) : null,
          h('p', { className: 'ch-msg-text' }, p.text),
          p.time ? h('time', { className: 'ch-msg-time' }, p.time) : null)
      )
    );
  }

  /* ---------- RecipientPicker ---------- */
  function RecipientPicker(p) {
    var others = (p.members || []).filter(function (m) { return m.id !== p.currentUserId; });
    var value = p.value == null ? null : p.value;
    var selectId = R.useId();
    var lastPick = R.useRef(others[0] ? others[0].id : null);
    if (value != null) lastPick.current = value;
    function set(v) { if (p.onChange) p.onChange(v); }
    return h('div', { className: cx('ch-recipient', value != null && 'is-private'), 'data-testid': 'recipient-picker' },
      h('div', { className: 'ch-seg', role: 'radiogroup', 'aria-label': 'Enviar a' },
        h('button', { type: 'button', role: 'radio', 'aria-checked': value == null, className: 'ch-seg-opt', onClick: function () { set(null); }, 'data-testid': 'recipient-all' },
          'Todos (' + (p.members || []).length + ')'),
        h('button', { type: 'button', role: 'radio', 'aria-checked': value != null, className: 'ch-seg-opt', disabled: others.length === 0, onClick: function () { set(lastPick.current); }, 'data-testid': 'recipient-one' },
          'Una persona')),
      value != null ? h('span', { className: 'ch-recipient-select' },
        h('label', { htmlFor: selectId, className: 'ch-sr' }, 'Destinatario'),
        h('select', { id: selectId, className: 'ch-select', value: value, onChange: function (e) { set(e.target.value); }, 'data-testid': 'recipient-select' },
          others.map(function (m) { return h('option', { key: m.id, value: m.id }, m.name); }))) : null
    );
  }

  /* ---------- MessageComposer ---------- */
  function MessageComposer(p) {
    var controlled = p.recipient !== undefined;
    var rs = useState(null), innerTo = rs[0], setInnerTo = rs[1];
    var to = controlled ? p.recipient : innerTo;
    var ts = useState(''), text = ts[0], setText = ts[1];
    var target = to != null ? findMember(p.members, to) : null;
    function setTo(v) { if (!controlled) setInnerTo(v); if (p.onRecipientChange) p.onRecipientChange(v); }
    function send() {
      var t = text.trim();
      if (!t) return;
      if (p.onSend) p.onSend({ text: t, to: to });
      setText('');
    }
    return h('div', { className: cx('ch-composer', target && 'is-private'), 'data-testid': 'composer' },
      h(RecipientPicker, { members: p.members, currentUserId: p.currentUserId, value: to, onChange: setTo }),
      target ? h('p', { className: 'ch-composer-note' }, 'Solo ' + target.name + ' va a ver este mensaje.') : null,
      h('div', { className: 'ch-composer-row' },
        h('label', { className: 'ch-sr', htmlFor: 'ch-composer-input' }, 'Mensaje'),
        h('textarea', {
          id: 'ch-composer-input',
          className: 'ch-composer-input',
          rows: 1,
          value: text,
          placeholder: target ? 'Mensaje privado para ' + target.name + '…' : 'Escribí un mensaje para todos…',
          onChange: function (e) { setText(e.target.value); },
          onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
          'data-testid': 'composer-input'
        }),
        h(Button, { onClick: send, disabled: !text.trim(), 'data-testid': 'composer-send' }, 'Enviar'))
    );
  }

  /* ---------- ChatLayout ---------- */
  function ChatLayout(p) {
    return h('div', { className: 'ch-layout' },
      h('aside', { className: 'ch-sidebar' }, p.sidebar),
      h('section', { className: 'ch-main', 'aria-label': 'Chat' },
        p.header,
        h('div', { className: 'ch-messages', role: 'log', 'aria-live': 'polite', 'data-testid': 'message-list' }, p.children),
        p.composer)
    );
  }

  window.Charla = Object.assign(window.Charla || {}, {
    Avatar: Avatar, Button: Button, TextField: TextField, LoginForm: LoginForm,
    ConversationList: ConversationList, JoinByCode: JoinByCode, ChatHeader: ChatHeader,
    MessageBubble: MessageBubble, RecipientPicker: RecipientPicker,
    MessageComposer: MessageComposer, ChatLayout: ChatLayout
  });
})();
