import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Quaternion, Vector3 } from '../lib/three/three.core.js'
import { FLAT, createDocument, createPart, duplicatePart, materialById, nextName, rectSize, rectangle } from '../js/model.js'

const plate = (doc, w = 10, h = 10) => createPart(doc, { points: rectangle(w, h), thickness: 2, materialId: 'carton-gris' })

test('rectangle : contour depuis l’origine, sens trigonométrique', () => {
  assert.deepEqual(rectangle(120, 80), [[0, 0], [120, 0], [120, 80], [0, 80]])
})

test('rectSize : reconnaît un rectangle, refuse un polygone ou un rectangle décalé', () => {
  assert.deepEqual(rectSize(rectangle(120, 80)), { width: 120, height: 80 })
  assert.equal(rectSize([[0, 0], [120, 0], [60, 80]]), null)
  assert.equal(rectSize([[5, 0], [120, 0], [120, 80], [5, 80]]), null)
})

test('FLAT : l’épaisseur (Z local) pointe vers le haut, le contour reste sur la table', () => {
  const q = new Quaternion(...FLAT)
  assert.ok(new Vector3(0, 0, 1).applyQuaternion(q).distanceTo(new Vector3(0, 1, 0)) < 1e-12)
  assert.ok(Math.abs(new Vector3(0, 1, 0).applyQuaternion(q).y) < 1e-12)
})

test('nextName : le plus petit numéro libre à partir de start', () => {
  assert.equal(nextName('Pièce', []), 'Pièce 1')
  assert.equal(nextName('Pièce', ['Pièce 1', 'Pièce 3']), 'Pièce 2')
  assert.equal(nextName('Mur', ['Mur'], 2), 'Mur 2')
})

test('createPart : identifiants jamais réattribués, noms par défaut sans trou', () => {
  const doc = createDocument()
  const add = () => { const p = plate(doc); doc.parts.push(p); return p }
  assert.equal(add().id, 'part-1')
  assert.equal(add().name, 'Pièce 2')
  doc.parts.splice(1, 1)
  assert.equal(add().id, 'part-2') // le plus grand restant est part-1
  doc.parts.splice(0, 1)
  const p = add()
  assert.equal(p.id, 'part-3')
  assert.equal(p.name, 'Pièce 1')
})

test('createPart : contour et quaternion copiés, pas partagés', () => {
  const points = rectangle(1, 1)
  const p = createPart(createDocument(), { points, thickness: 1, materialId: 'bristol' })
  p.points[0][0] = 9
  p.quaternion[0] = 1
  assert.equal(points[0][0], 0)
  assert.notEqual(FLAT[0], 1)
})

test('duplicatePart : nouvel identifiant, nom numéroté, forme et orientation copiées', () => {
  const doc = createDocument()
  const wall = plate(doc, 120, 60)
  wall.name = 'Mur'
  wall.quaternion = [0, 0, 0, 1]
  doc.parts.push(wall)
  const copy = duplicatePart(doc, wall)
  doc.parts.push(copy)
  assert.notEqual(copy.id, wall.id)
  assert.equal(copy.name, 'Mur 2')
  assert.equal(duplicatePart(doc, copy).name, 'Mur 3')
  assert.deepEqual(copy.points, wall.points)
  assert.notEqual(copy.points, wall.points)
  assert.deepEqual(copy.quaternion, wall.quaternion)
  assert.notEqual(copy.quaternion, wall.quaternion)
  assert.equal(copy.thickness, wall.thickness)
  assert.equal(copy.materialId, wall.materialId)
})

test('materialById : matériau inconnu → le premier', () => {
  assert.equal(materialById('inconnu').id, 'carton-gris')
})
