// Genera public/charla/tokens.css a partir de public/charla/tokens.json (design system Charla).
// Uso: node scripts/build-tokens.js
const fs = require('fs')
const path = require('path')
const dir = path.join(__dirname, '..', 'public', 'charla')
const t = JSON.parse(fs.readFileSync(path.join(dir, 'tokens.json'), 'utf8'))
const themes = t.color.themes.map(x => x.id)
const first = themes[0]
const val = (tok, th) => typeof tok.value === 'string' ? tok.value : (tok.value[th] || tok.value[first])
const themed = [...t.color.tokens, ...((t.shadow && t.shadow.tokens) || [])]
let css = `/* Charla — generated from tokens.json */\n`
for (const th of themes) {
  css += (th === first ? `:root, [data-theme="${th}"]` : `[data-theme="${th}"]`) + ' {\n'
  for (const tok of themed) css += `  --${tok.name}: ${val(tok, th)};\n`
  css += '}\n'
}
css += ':root {\n'
for (const fam of ['spacing', 'radius']) for (const tok of t[fam].tokens) css += `  --${tok.name}: ${tok.value};\n`
for (const [k, v] of Object.entries(t.type.families)) css += `  --font-${k}: ${v};\n`
css += '}\n'
fs.writeFileSync(path.join(dir, 'tokens.css'), css)
console.log('tokens.css generado')
