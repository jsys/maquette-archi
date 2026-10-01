import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contourProblem, normalizeContour, signedArea } from '../js/geometry.js'
import { rectangle } from '../js/model.js'

const gable = [[0, 0], [80, 0], [80, 60], [40, 90], [0, 60]] // pignon de 80, faîte à 90

test('contourProblem : rectangle, pignon et polygone concave acceptés', () => {
  assert.equal(contourProblem(rectangle(120, 80)), null)
  assert.equal(contourProblem(gable), null)
  assert.equal(contourProblem([[0, 0], [100, 0], [100, 100], [50, 40], [0, 100]]), null)
})

test('contourProblem : refuse moins de trois points, points confondus, croisement, surface nulle', () => {
  assert.match(contourProblem([[0, 0], [10, 0]]), /trois points/)
  assert.match(contourProblem([[0, 0], [10, 0], [10, 0], [0, 10]]), /confondus/)
  assert.match(contourProblem([[0, 0], [10, 10], [10, 0], [0, 10]]), /recoupe/) // nœud papillon
  assert.match(contourProblem([[0, 0], [10, 0], [5, 0], [0, 5]]), /recoupe/) // un côté revient sur un autre
  assert.match(contourProblem([[0, 0], [10, 0], [20, 0]]), /surface/)
})

test('normalizeContour : sens trigonométrique et cadre ramené à l’origine', () => {
  const shifted = gable.map(([x, y]) => [x + 30, y + 50]).reverse() // sens horaire, décalé
  const n = normalizeContour(shifted)
  assert.ok(signedArea(n) > 0)
  assert.equal(Math.min(...n.map(p => p[0])), 0)
  assert.equal(Math.min(...n.map(p => p[1])), 0)
  assert.equal(signedArea(n), signedArea(gable))
})
