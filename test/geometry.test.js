import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Ray, Vector3 } from '../lib/three/three.core.js'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { containsPoint, dragOnPlane, nudge, placeOnTable, worldBox } from '../js/geometry.js'

const near = (a, b) => Math.abs(a - b) < 1e-9
const plate = (doc, w, h, t = 2) => createPart(doc, { points: rectangle(w, h), thickness: t, materialId: 'carton-gris' })

test('worldBox : plaque à plat à l’origine, contour X → X et Y → -Z, épaisseur vers le haut', () => {
  const b = worldBox(plate(createDocument(), 120, 80))
  for (const [got, want] of [[b.min.x, 0], [b.max.x, 120], [b.min.y, 0], [b.max.y, 2], [b.min.z, -80], [b.max.z, 0]]) {
    assert.ok(near(got, want), `${got} ≠ ${want}`)
  }
})

test('containsPoint : dans le contour et entre les deux faces', () => {
  const floor = Object.assign(plate(createDocument(), 120, 80), { position: [-60, 0, 40] })
  const gable = Object.assign(createPart(createDocument(), { points: [[0, 0], [80, 0], [80, 60], [40, 100], [0, 60]], thickness: 2, materialId: 'carton-gris' }), {
    position: [0, 0, 0], quaternion: [0, 0, 0, 1], // debout dans le plan XY
  })
  assert.ok(containsPoint(floor, new Vector3(0, 1, 0)) && containsPoint(floor, new Vector3(59, 1, -39)))
  assert.ok(!containsPoint(floor, new Vector3(0, 3, 0)) && !containsPoint(floor, new Vector3(61, 1, 0)))
  assert.ok(containsPoint(gable, new Vector3(40, 90, 1)) && !containsPoint(gable, new Vector3(10, 90, 1)))
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

test('placeOnTable : avec `eye`, pas derrière un mur qui la cacherait à la caméra', () => {
  const doc = createDocument()
  doc.parts.push(placeOnTable(plate(doc, 120, 80), doc.parts, { x: 0, z: 0 }))
  const wall = plate(doc, 120, 60)
  Object.assign(wall, { quaternion: [0, 0, 0, 1], position: [-60, 2, -40] }) // debout au fond du sol
  doc.parts.push(wall)
  const behind = worldBox(placeOnTable(plate(doc, 120, 60), doc.parts, { x: 0, z: 0 }))
  assert.ok(behind.max.z <= -40 - 10 + 1e-9) // sans `eye` : derrière le mur, à égalité de distance
  const seen = worldBox(placeOnTable(plate(doc, 120, 60), doc.parts, { x: 0, z: 0 }, { eye: new Vector3(0, 200, 300) }))
  assert.ok(seen.min.z >= 40 + 10 - 1e-9)
})

test('dragOnPlane : le point saisi suit le rayon sur son plan horizontal, au mm près', () => {
  const grab = new Vector3(0, 2, 0)
  const down = new Vector3(0, -1, 0)
  assert.deepEqual(dragOnPlane([-60, 0, 40], grab, new Ray(new Vector3(30.4, 102, -20), down)), [-30, 0, 20])
  const oblique = new Ray(new Vector3(0, 102, 100), new Vector3(0, -1, -1).normalize())
  assert.deepEqual(dragOnPlane([0, 5, 0], grab, oblique), [0, 5, 0]) // touche le plan en (0, 2, 0)
})

test('dragOnPlane : rayon rasant, parallèle ou tourné vers le haut → null', () => {
  const grab = new Vector3(0, 2, 0)
  assert.equal(dragOnPlane([0, 0, 0], grab, new Ray(new Vector3(0, 102, 0), new Vector3(1, 0, 0))), null)
  assert.equal(dragOnPlane([0, 0, 0], grab, new Ray(new Vector3(0, 102, 0), new Vector3(0, 1, 0))), null)
  const grazing = new Ray(new Vector3(0, 102, 0), new Vector3(1, -0.001, 0).normalize())
  assert.equal(dragOnPlane([0, 0, 0], grab, grazing), null) // à plus de 5 m
})

test('nudge : flèches selon l’axe du monde le plus proche de l’écran, sans -0', () => {
  const towardMinusZ = { x: 0, z: -1 } // caméra par défaut, regarde vers -Z
  assert.deepEqual(nudge(towardMinusZ, 'ArrowUp'), [0, -1])
  assert.deepEqual(nudge(towardMinusZ, 'ArrowRight'), [1, 0])
  assert.deepEqual(nudge(towardMinusZ, 'ArrowLeft'), [-1, 0])
  assert.deepEqual(nudge(towardMinusZ, 'ArrowDown'), [0, 1])
  assert.deepEqual(nudge({ x: 0.9, z: 0.2 }, 'ArrowUp'), [1, 0])
  assert.deepEqual(nudge({ x: 0.9, z: 0.2 }, 'ArrowRight'), [0, 1])
  assert.equal(nudge(towardMinusZ, 'a'), null)
})
