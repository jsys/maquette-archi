import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { worldBox, rotatedPose } from '../js/geometry.js'
import { Vector3 } from '../lib/three/three.core.js'
import { blockers, excessAlong, isConvex, overlapping, penetration, sweep } from '../js/collision.js'

const doc = createDocument()
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) < tolerance
const touching = (a, b) => near(a, b, 0.011) // le contact tolère 0,01 mm de recouvrement
// Plaque à plat (contour X → X, Y → -Z, épaisseur vers le haut) ou debout (contour dans le plan XY)
function flat(w, h, position, t = 2) {
  const part = Object.assign(createPart(doc, { points: rectangle(w, h), thickness: t, materialId: 'carton-gris' }), { position })
  doc.parts.push(part) // identifiants distincts
  return part
}
const standing = (w, h, position, t = 2) => Object.assign(flat(w, h, position, t), { quaternion: [0, 0, 0, 1] })
const L = [[0, 0], [100, 0], [100, 30], [30, 30], [30, 100], [0, 100]]

test('isConvex : rectangle et pignon oui, L non', () => {
  assert.equal(isConvex(rectangle(120, 80)), true)
  assert.equal(isConvex([[0, 0], [80, 0], [80, 60], [40, 100], [0, 60]]), true)
  assert.equal(isConvex(L), false)
})

test('penetration : se toucher ne compte pas, se chevaucher oui', () => {
  const a = flat(100, 50, [0, 0, 0])
  assert.equal(penetration(a, flat(100, 50, [100, 0, 0])), 0) // bord contre bord
  assert.ok(near(penetration(a, flat(100, 50, [99, 0, 0])), 1)) // 1 mm de recouvrement
  assert.equal(penetration(a, flat(100, 50, [0, 2, 0])), 0) // empilées
  assert.equal(penetration(a, flat(100, 50, [0, 10, 0])), 0) // au-dessus, à distance
})

test('penetration : mur posé sur le sol, coin qui chevauche, mur qui traverse', () => {
  const floor = flat(120, 80, [-60, 0, 40]) // x ∈ [-60, 60], y ∈ [0, 2], z ∈ [-40, 40]
  const front = standing(120, 60, [-60, 2, 38]) // z ∈ [38, 40], posé sur le sol
  assert.equal(penetration(front, floor), 0)
  const side = Object.assign(standing(80, 60, [0, 2, 0]), { quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] })
  side.position = [-60, 2, 40] // quart de tour : x ∈ [-60, -58], z ∈ [-40, 40]
  assert.ok(near(penetration(side, front), 2)) // le coin de 2 × 2 mm
  const through = standing(120, 60, [-60, 2, 0]) // en travers du côté
  assert.ok(penetration(through, side) > 0)
})

test('penetration : un L (concave) ne heurte pas ce qui loge dans son creux', () => {
  const l = flat(1, 1, [0, 0, 0])
  l.points = L
  assert.equal(penetration(l, flat(60, 60, [40, 0, -40])), 0) // dans le creux, à 10 mm
  assert.ok(penetration(l, flat(20, 20, [5, 0, -5])) > 0) // sur la branche
})

test('sweep : s’arrête au contact, longe l’obstacle, ne le traverse jamais', () => {
  const wall = standing(200, 60, [-100, 0, 0]) // z ∈ [0, 2]
  const plate = flat(40, 40, [-20, 0, -50]) // z ∈ [-90, -50]
  const stop = sweep(plate, plate.position, [-20, 0, 300], [wall]) // saut de 350 mm à travers le mur
  assert.ok(touching(stop[2], 0)) // bord avant à z = 0, contre le mur
  const slide = sweep(plate, plate.position, [60, 0, 20], [wall]) // en biais : glisse le long du mur
  assert.ok(near(slide[0], 60) && touching(slide[2], 0))
})

test('excessAlong : un côté de 80 entre deux façades mord de 2 mm à chaque bout ; place prise sinon', () => {
  const backF = standing(120, 60, [-60, 2, -40]) // z ∈ [-40, -38]
  const frontF = standing(120, 60, [-60, 2, 38]) // z ∈ [38, 40]
  const side = Object.assign(standing(80, 60, [-60, 2, 40]), { quaternion: [0, Math.SQRT1_2, 0, Math.SQRT1_2] })
  const hits = blockers(side, [backF, frontF])
  assert.equal(hits.length, 2)
  assert.deepEqual(excessAlong(side, hits, new Vector3(0, 0, 1)), { start: 2, end: 2 })
  assert.deepEqual(excessAlong(side, [backF], new Vector3(0, 0, 1)), { start: 2, end: 0 })
  const middle = Object.assign(standing(2, 60, [-61, 2, 1]), { quaternion: [0, 0, 0, 1] }) // en plein milieu
  assert.equal(excessAlong(side, blockers(side, [middle]), new Vector3(0, 0, 1)), null)
})

test('overlapping : désigne les pièces qui se chevauchent, pas les autres', () => {
  const a = flat(50, 50, [0, 0, 0]), b = flat(50, 50, [40, 0, 0]), c = flat(50, 50, [200, 0, 0])
  assert.deepEqual([...overlapping([a, b, c])].sort(), [a.id, b.id].sort())
})

test('rotatedPose : basculer une plaque à plat la relève sur la table, sans bouger son centre au sol', () => {
  const p = flat(120, 80, [-60, 0, 40])
  const pose = rotatedPose(p, [1, 0, 0], Math.PI / 2)
  const b = worldBox({ ...p, ...pose })
  assert.ok(near(b.min.y, 0) && near(b.max.y, 80))
  assert.ok(near((b.min.x + b.max.x) / 2, 0) && near((b.min.z + b.max.z) / 2, 0))
  const turned = worldBox({ ...p, ...rotatedPose(p, [0, 1, 0], -Math.PI / 2) })
  assert.ok(near(turned.max.x - turned.min.x, 80) && near(turned.max.z - turned.min.z, 120))
})

test('sweep : la table est un plancher, sauf pour une pièce déjà dessous', () => {
  const plate = flat(40, 40, [0, 30, 0]) // à 30 mm au-dessus de la table
  assert.equal(sweep(plate, plate.position, [0, -50, 0], [])[1], 0) // descend jusqu'à la table, pile
  assert.deepEqual(sweep(plate, plate.position, [0, 80, 0], []), [0, 80, 0]) // monte librement
  const sunk = flat(40, 40, [0, -10, 0])
  assert.deepEqual(sweep(sunk, sunk.position, [0, -5, 0], [], { table: false }), [0, -5, 0])
})
