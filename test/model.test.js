import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Quaternion, Vector3 } from '../lib/three/three.core.js'
import { FLAT, createDocument, createPart, materialById, rectangle } from '../js/model.js'

test('rectangle : contour depuis l’origine, sens trigonométrique', () => {
  assert.deepEqual(rectangle(120, 80), [[0, 0], [120, 0], [120, 80], [0, 80]])
})

test('FLAT : l’épaisseur (Z local) pointe vers le haut, le contour reste sur la table', () => {
  const q = new Quaternion(...FLAT)
  const up = new Vector3(0, 0, 1).applyQuaternion(q)
  assert.ok(up.distanceTo(new Vector3(0, 1, 0)) < 1e-12)
  assert.ok(Math.abs(new Vector3(0, 1, 0).applyQuaternion(q).y) < 1e-12)
})

test('createPart : numéros croissants, jamais réattribués après suppression', () => {
  const doc = createDocument()
  const add = () => { const p = createPart(doc, { points: rectangle(10, 10), thickness: 2, materialId: 'carton-gris' }); doc.parts.push(p); return p }
  assert.equal(add().id, 'part-1')
  assert.equal(add().name, 'Pièce 2')
  doc.parts.splice(1, 1)
  assert.equal(add().id, 'part-2') // le plus grand restant est part-1
  doc.parts.splice(0, 1)
  assert.equal(add().id, 'part-3')
})

test('createPart : copie indépendante du quaternion', () => {
  const p = createPart(createDocument(), { points: rectangle(1, 1), thickness: 1, materialId: 'bristol' })
  p.quaternion[0] = 1
  assert.notEqual(FLAT[0], 1)
})

test('materialById : matériau inconnu → le premier', () => {
  assert.equal(materialById('inconnu').id, 'carton-gris')
})
