// Avant un push (node tools/check-imports.mjs) : chaque module importé (relatif, import map ou addon) doit figurer dans l'index git
// avec la casse exacte. macOS ignore la casse, GitHub Pages non. À lancer depuis la racine du dépôt.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'

const tracked = new Set(execSync('git ls-files --cached', { encoding: 'utf8' }).split('\n'))
const map = { three: 'lib/three/three.module.js', 'three/addons/': 'lib/three/addons/' }
const resolve = (from, spec) => {
  if (spec.startsWith('.')) return posix.normalize(posix.join(posix.dirname(from), spec))
  if (spec.startsWith('three/addons/')) return map['three/addons/'] + spec.slice('three/addons/'.length)
  if (spec === 'three') return map.three
  return null // node:test, etc.
}

let bad = 0
const files = execSync('git ls-files --cached "*.js" index.html', { encoding: 'utf8' }).trim().split('\n')
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const specs = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g), ...src.matchAll(/(?:src|href)="(\.\/[^"]+|[\w/.-]+\.(?:js|css))"/g)]
    .map(m => m[1])
  for (const spec of specs) {
    const target = file === 'index.html' ? posix.normalize(spec) : resolve(file, spec)
    if (target && !target.startsWith('http') && !tracked.has(target)) {
      console.log(`absent de l'index ou mauvaise casse : ${file} → ${spec}`)
      bad++
    }
  }
}
console.log(bad ? `${bad} problème(s)` : `imports OK (${files.length} fichiers)`)
process.exit(bad ? 1 : 0)
