import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from '../lib/three/three.core.js'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { partEdges, signedArea } from '../js/geometry.js'

const close = (v, [x, y, z]) => v.distanceTo(new Vector3(x, y, z)) < 1e-9
const plate = (points, t = 2) => createPart(createDocument(), { points, thickness: t, materialId: 'carton-gris' })

test('signedArea : positive dans le sens trigonométrique, négative sinon', () => {
  assert.equal(signedArea(rectangle(120, 80)), 9600)
  assert.equal(signedArea([...rectangle(120, 80)].reverse()), -9600)
})

test('partEdges : un bord par segment du contour, à mi-épaisseur, dans la scène', () => {
  const p = plate(rectangle(120, 80))
  p.position = [-60, 0, 40] // à plat : contour X → X, Y → -Z, épaisseur vers le haut
  const edges = partEdges(p)
  assert.equal(edges.length, 4)
  const [e0, e1] = edges
  assert.deepEqual([e0.partId, e0.index, e0.length, e1.length], [p.id, 0, 120, 80])
  assert.ok(close(e0.start, [-60, 1, 40]) && close(e0.end, [60, 1, 40]))
  assert.ok(close(e0.center, [0, 1, 40]) && close(e0.direction, [1, 0, 0]))
  assert.ok(close(e0.startLocal, [0, 0, 1]))
  assert.ok(close(e0.normal, [0, 1, 0]))
})

test('partEdges : la normale sortante pointe hors du contour, quel que soit son sens', () => {
  for (const points of [rectangle(120, 80), [...rectangle(120, 80)].reverse()]) {
    const p = plate(points)
    p.quaternion = [0, 0, 0, 1] // repère local = scène
    for (const e of partEdges(p)) {
      const outside = e.center.clone().addScaledVector(e.outward, 1)
      assert.ok(outside.x < 0 || outside.x > 120 || outside.y < 0 || outside.y > 80, `bord ${e.index}`)
      assert.ok(Math.abs(e.outward.dot(e.direction)) < 1e-12 && Math.abs(e.outward.dot(e.normal)) < 1e-12)
    }
  }
})
