import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { parseDocument, serialize } from '../js/storage.js'

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
