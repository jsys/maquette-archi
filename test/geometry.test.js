import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { placeOnTable, worldBox } from '../js/geometry.js'

const near = (a, b) => Math.abs(a - b) < 1e-9
const plate = (doc, w, h, t = 2) => createPart(doc, { points: rectangle(w, h), thickness: t, materialId: 'carton-gris' })

test('worldBox : plaque à plat à l’origine, contour X → X et Y → -Z, épaisseur vers le haut', () => {
  const b = worldBox(plate(createDocument(), 120, 80))
  for (const [got, want] of [[b.min.x, 0], [b.max.x, 120], [b.min.y, 0], [b.max.y, 2], [b.min.z, -80], [b.max.z, 0]]) {
    assert.ok(near(got, want), `${got} ≠ ${want}`)
  }
})

test('placeOnTable : la première pièce est centrée sur le point visé et posée sur la table', () => {
  const p = placeOnTable(plate(createDocument(), 120, 80), [], { x: 50, z: -20 })
  const b = worldBox(p)
  assert.ok(near((b.min.x + b.max.x) / 2, 50) && near((b.min.z + b.max.z) / 2, -20))
  assert.ok(near(b.min.y, 0))
})

test('placeOnTable : position nettoyée des restes d’arrondi du quart de tour', () => {
  assert.deepEqual(placeOnTable(plate(createDocument(), 120, 80), [], { x: 0, z: 0 }).position, [-60, 0, 40])
})

test('placeOnTable : les pièces suivantes ne chevauchent pas et gardent la marge', () => {
  const doc = createDocument()
  for (let i = 0; i < 6; i++) doc.parts.push(placeOnTable(plate(doc, 120, 80), doc.parts, { x: 0, z: 0 }))
  const boxes = doc.parts.map(p => worldBox(p))
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const apart = a.max.x + 10 <= b.min.x + 1e-9 || b.max.x + 10 <= a.min.x + 1e-9 ||
        a.max.z + 10 <= b.min.z + 1e-9 || b.max.z + 10 <= a.min.z + 1e-9
      assert.ok(apart, `pièces ${i} et ${j} trop proches`)
    }
  }
})

test('placeOnTable : la deuxième pièce se pose à la marge exacte, malgré les arrondis du quart de tour', () => {
  const doc = createDocument()
  doc.parts.push(placeOnTable(plate(doc, 120, 80), doc.parts, { x: 0, z: 0 }))
  const second = worldBox(placeOnTable(plate(doc, 120, 80), doc.parts, { x: 0, z: 0 }))
  const first = worldBox(doc.parts[0])
  assert.ok(near(first.min.z - second.max.z, 10) || near(second.min.z - first.max.z, 10) ||
    near(first.min.x - second.max.x, 10) || near(second.min.x - first.max.x, 10))
})

test('placeOnTable : une pièce debout compte par son emprise au sol', () => {
  const doc = createDocument()
  const wall = plate(doc, 120, 60)
  wall.quaternion = [0, 0, 0, 1] // debout : contour dans le plan XY, épaisseur selon Z
  wall.position = [-60, 0, -1]
  doc.parts.push(wall)
  const b = worldBox(placeOnTable(plate(doc, 40, 40), doc.parts, { x: 0, z: 0 }))
  const w = worldBox(wall)
  assert.ok(b.min.z >= w.max.z + 10 - 1e-9 || b.max.z <= w.min.z - 10 + 1e-9 ||
    b.min.x >= w.max.x + 10 - 1e-9 || b.max.x <= w.min.x - 10 + 1e-9)
})
