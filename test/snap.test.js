import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Vector3 } from '../lib/three/three.core.js'
import { createDocument, createPart, rectangle } from '../js/model.js'
import { worldBox } from '../js/geometry.js'
import { edgeGap, findSnap, pointToSegment } from '../js/snap.js'

// Scénario du CdC § 29 : sol de 120 × 80 à plat, centré sur l'origine (bords à x = ±60, z = ±40)
const doc = createDocument()
const part = (w, h, position) => Object.assign(createPart(doc, { points: rectangle(w, h), thickness: 2, materialId: 'carton-gris' }), { position })
const floor = part(120, 80, [-60, 0, 40])
const options = { pxToWorld: () => 0.5, viewPoint: new Vector3(200, 300, 300) } // 12 px = 6 mm
const near = (a, b) => Math.abs(a - b) < 1e-6

function boxOf(moving, snap) {
  const b = worldBox({ ...moving, position: snap.position, quaternion: snap.quaternion })
  return [b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z]
}
const assertBox = (got, want) => got.forEach((v, i) => assert.ok(near(v, want[i]), `${got} ≠ ${want}`))

test('pointToSegment et edgeGap : côte à côte proches, bout à bout lointains', () => {
  const v = (x, y, z) => new Vector3(x, y, z)
  assert.ok(near(pointToSegment(v(5, 3, 0), v(0, 0, 0), v(10, 0, 0)), 3))
  assert.ok(near(pointToSegment(v(13, 4, 0), v(0, 0, 0), v(10, 0, 0)), 5))
  const edge = (a, b) => ({ start: a, end: b, center: a.clone().lerp(b, 0.5) })
  const base = edge(v(0, 0, 0), v(100, 0, 0))
  assert.ok(near(edgeGap(edge(v(20, 3, 0), v(40, 3, 0)), base), 3)) // court qui longe un long
  assert.ok(near(edgeGap(base, edge(v(20, 3, 0), v(40, 3, 0))), 3)) // et l'inverse
  assert.ok(edgeGap(edge(v(103, 0, 0), v(163, 0, 0)), base) > 30) // bout à bout
})

test('mur aligné sur le sol, posé devant lui : le bord avant gagne, pas les bords latéraux qu’il touche par un bout', () => {
  const wall = part(120, 60, [-60, 0, 104]) // bords latéraux du mur dans le prolongement de ceux du sol
  const snap = findSnap(wall, [floor], options)
  assert.equal(snap.targetEdge, 0)
  assertBox(boxOf(wall, snap), [-60, 60, 2, 62, 38, 40])
})

test('façade à plat, à 3 mm du bord avant : elle se relève sur le sol, centrée, affleurante', () => {
  const wall = part(120, 60, [-60, 0, 103]) // emprise z ∈ [43, 103]
  const snap = findSnap(wall, [floor], options)
  assert.equal(snap.targetId, floor.id)
  assert.equal(snap.movingEdge, 2) // un bord de 120, le plus proche
  assertBox(boxOf(wall, snap), [-60, 60, 2, 62, 38, 40])
  assert.ok(near(snap.line[0].y, 2) && near(snap.line[0].z, 40)) // raccord : arête avant du dessus du sol
})

test('côté à plat près du bord gauche : il utilise son bord de 80 et se relève sur ce bord', () => {
  const side = part(80, 60, [-143, 0, 30]) // bord droit à x = -63, à 3 mm du bord gauche du sol
  const snap = findSnap(side, [floor], options)
  assertBox(boxOf(side, snap), [-60, -58, 2, 62, -40, 40])
})

test('pièce en portrait : le bord de même longueur gagne, même s’il n’est pas le plus proche', () => {
  const portrait = part(60, 120, [-30, 0, 163]) // son bord proche (60) est à 3 mm du bord avant
  assertBox(boxOf(portrait, findSnap(portrait, [floor], options)), [-60, 60, 2, 62, 38, 40])
})

test('trop loin, ou proche seulement à l’écran mais pas dans la scène : pas de snap', () => {
  assert.equal(findSnap(part(120, 60, [-60, 0, 110]), [floor], options), null) // 10 mm
  const high = part(120, 60, [-60, 50, 103]) // à 3 mm en plan mais 50 mm au-dessus
  assert.equal(findSnap(high, [floor], options), null)
})

test('pièce amenée par-dessous un sol surélevé : elle se pose sous le sol', () => {
  const raised = part(120, 80, [-60, 100, 40]) // sol à y ∈ [100, 102]
  const wall = part(120, 60, [-60, 0, 103])
  wall.quaternion = [0, 0, 0, 1] // debout, contour dans le plan XY : z ∈ [103, 105], y ∈ [0, 60]
  wall.position = [-60, 37, 41] // son bord haut à 3 mm du bord avant du sol, par en dessous
  const snap = findSnap(wall, [raised], options)
  const [, , minY, maxY] = boxOf(wall, snap)
  assert.ok(near(maxY, 100) && near(minY, 40))
})

test('pose reproductible : la pièce déjà aimantée reste en place', () => {
  const wall = part(120, 60, [-60, 0, 103])
  const first = findSnap(wall, [floor], options)
  const again = findSnap({ ...wall, position: first.position, quaternion: first.quaternion }, [floor], options)
  assert.deepEqual(again.position, first.position)
  assert.deepEqual(again.quaternion.map(c => Math.round(c * 1e9)), first.quaternion.map(c => Math.round(c * 1e9)))
})

test('mur posé dans un coin : il reste sur son bord, et le bord préféré départage les égalités', () => {
  const wall = part(120, 60, [-60, 0, 103])
  const front = findSnap(wall, [floor], options)
  const side = part(80, 60, [-143, 0, 30])
  const sideSnap = findSnap(side, [floor], options)
  const standingSide = { ...side, position: sideSnap.position, quaternion: sideSnap.quaternion }
  const standingWall = { ...wall, position: front.position, quaternion: front.quaternion }
  // Le côté debout d'abord dans la liste : à égalité, sans préférence, la façade irait contre lui
  const prefer = { targetId: floor.id, targetEdge: front.targetEdge }
  const again = findSnap(standingWall, [standingSide, floor], { ...options, prefer })
  assert.equal(again.targetId, floor.id)
  assert.deepEqual(again.position, front.position)
})
