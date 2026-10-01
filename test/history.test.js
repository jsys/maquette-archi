import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHistory } from '../js/history.js'

test('annuler puis rétablir parcourt les instantanés dans les deux sens', () => {
  const h = createHistory()
  assert.equal(h.canUndo, false)
  h.record('A') // état avant la première action
  h.record('B')
  assert.equal(h.undo('C'), 'B')
  assert.equal(h.undo('B'), 'A')
  assert.equal(h.undo('A'), null)
  assert.equal(h.redo('A'), 'B')
  assert.equal(h.redo('B'), 'C')
  assert.equal(h.redo('C'), null)
})

test('une nouvelle action efface ce qu’on pouvait rétablir', () => {
  const h = createHistory()
  h.record('A')
  h.undo('B')
  assert.equal(h.canRedo, true)
  h.record('A2')
  assert.equal(h.canRedo, false)
})

test('la pile garde au plus `limit` instantanés, les plus récents', () => {
  const h = createHistory(2)
  for (const s of ['A', 'B', 'C']) h.record(s)
  assert.equal(h.undo('D'), 'C')
  assert.equal(h.undo('C'), 'B')
  assert.equal(h.undo('B'), null)
})
