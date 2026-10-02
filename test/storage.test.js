import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { createLibrary, parseDocument, serialize } from '../js/storage.js'

function sample() {
  const doc = createDocument()
  const floor = createPart(doc, { points: rectangle(120, 80), thickness: 2, materialId: 'carton-gris' })
  doc.parts.push(floor)
  const wall = createPart(doc, { points: [[0, 0], [80, 0], [80, 60], [40, 100], [0, 60]], thickness: 1.5, materialId: 'bristol' })
  Object.assign(wall, { name: 'Pignon', position: [-60, 2, 30], quaternion: [-0.5, -0.5, 0.5, 0.5], hidden: true, attachedTo: { partId: floor.id, edge: 3, ownEdge: 0 } })
  doc.parts.push(wall)
  return doc
}

const json = parts => JSON.stringify({ version: 1, units: 'mm', parts })
const valid = { id: 'part-1', points: rectangle(10, 10), thickness: 2, position: [0, 0, 0], quaternion: [0, 0, 0, 1] }

test('serialize puis parseDocument : le document revient à l’identique', () => {
  const doc = sample()
  assert.deepEqual(parseDocument(serialize(doc)), doc)
  assert.deepEqual(JSON.parse(serialize(doc)).units, 'mm')
})

test('parseDocument : complète les champs facultatifs et normalise le quaternion', () => {
  const [part] = parseDocument(json([{ ...valid, quaternion: [0, 0, 0, 2], materialId: 'inconnu' }])).parts
  assert.equal(part.name, 'part-1')
  assert.equal(part.materialId, 'carton-gris')
  assert.equal(part.hidden, false)
  assert.deepEqual(part.quaternion, [0, 0, 0, 1])
  assert.equal('attachedTo' in part, false)
})

test('parseDocument : refuse ce qui n’est pas une maquette, avec un message lisible', () => {
  assert.throws(() => parseDocument('{pas du json'), /pas du JSON/)
  assert.throws(() => parseDocument('{"version":1}'), /pas une maquette/)
  assert.throws(() => parseDocument('{"version":2,"parts":[]}'), /Version de fichier inconnue \(2\)/)
})

test('parseDocument : refuse une pièce abîmée en la désignant', () => {
  assert.throws(() => parseDocument(json([valid, valid])), /Pièce n° 2 : identifiant/)
  assert.throws(() => parseDocument(json([{ ...valid, points: [[0, 0], [1, 1]] }])), /Pièce n° 1 : il faut au moins trois points/)
  assert.throws(() => parseDocument(json([{ ...valid, points: [[0, 0], [10, 10], [10, 0], [0, 10]] }])), /recoupe/)
  assert.throws(() => parseDocument(json([{ ...valid, thickness: 0 }])), /épaisseur/)
  assert.throws(() => parseDocument(json([{ ...valid, position: [0, null, 0] }])), /position/)
  assert.throws(() => parseDocument(json([{ ...valid, quaternion: [0, 0, 0, 0] }])), /orientation/)
})

// Stockage factice, à la manière de localStorage
const fakeStore = () => {
  const m = new Map()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), size: () => m.size }
}

test('bibliothèque : enregistrer, lister (récentes d’abord), rouvrir, renommer, supprimer', async () => {
  const store = fakeStore()
  const lib = createLibrary(store)
  assert.deepEqual(lib.list(), [])
  const doc = Object.assign(sample(), { id: 'a1', name: 'Maison' })
  lib.save(doc)
  await new Promise(r => setTimeout(r, 2))
  lib.save(Object.assign(createDocument(), { id: 'b2', name: 'Abri' }))
  assert.deepEqual(lib.list().map(e => [e.name, e.count]), [['Abri', 0], ['Maison', 2]])
  assert.deepEqual(lib.load('a1'), doc)
  doc.name = 'Maison 2'
  lib.save(doc)
  assert.deepEqual(lib.list().map(e => e.name), ['Maison 2', 'Abri'])
  lib.remove('a1')
  assert.deepEqual(lib.list().map(e => e.id), ['b2'])
  assert.equal(store.size(), 2) // l'index et la maquette restante
})

test('history.clear : plus rien à annuler ni rétablir', async () => {
  const { createHistory } = await import('../js/history.js')
  const h = createHistory()
  h.record('A')
  h.undo('B')
  h.clear()
  assert.equal(h.canUndo || h.canRedo, false)
})
