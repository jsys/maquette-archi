// Sauvegarde (CdC § 17) : le document en JSON, enregistré à chaque changement dans le navigateur,
// exporté et importé en fichier. Un fichier lu est contrôlé pièce par pièce : un fichier abîmé
// ne doit pas casser la scène.
import { MATERIALS, createDocument } from './model.js'
import { contourProblem } from './geometry.js'

const KEY = 'maquette.document'

// `id` et `name` : seulement pour une maquette enregistrée sous un nom
export function serialize(doc) {
  const named = doc.id ? { id: doc.id, name: doc.name } : {}
  return JSON.stringify({ version: 1, units: 'mm', ...named, parts: doc.parts }, null, 2)
}

// Bibliothèque des maquettes nommées, dans le stockage du navigateur (`store` : localStorage, ou
// un équivalent pour les tests). Un index léger pour la liste, une clé par maquette.
const INDEX = 'maquette.plans'
const planKey = id => `maquette.plan.${id}`
export const newPlanId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export function createLibrary(store) {
  const read = () => {
    try {
      return JSON.parse(store.getItem(INDEX)) ?? []
    } catch {
      return []
    }
  }
  const write = list => store.setItem(INDEX, JSON.stringify(list))
  return {
    // Les plus récentes d'abord
    list: () => read().sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
    save(doc) {
      store.setItem(planKey(doc.id), serialize(doc))
      const entry = { id: doc.id, name: doc.name, savedAt: new Date().toISOString(), count: doc.parts.length }
      write([...read().filter(e => e.id !== doc.id), entry])
    },
    load: id => parseDocument(store.getItem(planKey(id))),
    remove(id) {
      store.removeItem(planKey(id))
      write(read().filter(e => e.id !== id))
    },
  }
}

// Document lu depuis un texte JSON, ou une erreur au message lisible.
export function parseDocument(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Fichier illisible : ce n’est pas du JSON.')
  }
  if (!Array.isArray(data?.parts)) throw new Error('Ce fichier n’est pas une maquette.')
  if (data.version !== 1) throw new Error(`Version de fichier inconnue (${data.version}).`)
  const doc = createDocument()
  if (typeof data.id === 'string' && typeof data.name === 'string') Object.assign(doc, { id: data.id, name: data.name })
  const ids = new Set()
  data.parts.forEach((part, i) => doc.parts.push(checkPart(part, i + 1, ids)))
  return doc
}

const isNumber = v => typeof v === 'number' && Number.isFinite(v)
const isNumbers = (list, n) => Array.isArray(list) && list.length === n && list.every(isNumber)

function checkPart(p, n, ids) {
  const fail = why => { throw new Error(`Pièce n° ${n} : ${why}`) }
  if (typeof p?.id !== 'string' || !/^part-\d+$/.test(p.id) || ids.has(p.id)) fail('identifiant absent ou en double.')
  ids.add(p.id)
  if (!Array.isArray(p.points) || !p.points.every(q => isNumbers(q, 2))) fail('contour illisible.')
  const problem = contourProblem(p.points)
  if (problem) fail(problem.charAt(0).toLowerCase() + problem.slice(1))
  if (!isNumber(p.thickness) || p.thickness <= 0) fail('épaisseur invalide.')
  if (!isNumbers(p.position, 3)) fail('position invalide.')
  const length = isNumbers(p.quaternion, 4) ? Math.hypot(...p.quaternion) : 0
  if (length < 1e-9) fail('orientation invalide.')
  const a = p.attachedTo
  return {
    id: p.id,
    name: typeof p.name === 'string' ? p.name : p.id,
    points: p.points.map(q => [...q]),
    thickness: p.thickness,
    materialId: MATERIALS.some(m => m.id === p.materialId) ? p.materialId : MATERIALS[0].id,
    position: [...p.position],
    quaternion: Math.abs(length - 1) > 1e-9 ? p.quaternion.map(c => c / length) : [...p.quaternion],
    hidden: p.hidden === true,
    ...(typeof a?.partId === 'string' && Number.isInteger(a.edge) && Number.isInteger(a.ownEdge) && { attachedTo: { partId: a.partId, edge: a.edge, ownEdge: a.ownEdge } }),
  }
}

// Navigateur : stockage indisponible (navigation privée…) ou contenu abîmé → on repart à vide.
export function loadLocal() {
  try {
    const text = localStorage.getItem(KEY)
    return text ? parseDocument(text) : null
  } catch {
    return null
  }
}

export function saveLocal(doc) {
  try {
    localStorage.setItem(KEY, serialize(doc))
    return true
  } catch {
    return false
  }
}

// Fichier `maquette-AAAA-MM-JJ.json`, à la date locale (toISOString donnerait celle de Greenwich)
export function download(doc) {
  const d = new Date()
  const day = [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-')
  const url = URL.createObjectURL(new Blob([serialize(doc)], { type: 'application/json' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: `maquette-${day}.json` })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function readFile(file) {
  return parseDocument(await file.text())
}
