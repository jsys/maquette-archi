// Point d'entrée : l'état de l'application (document, sélection) et les actions qui le modifient.
import { createScene } from './scene.js'
import { createPartsView } from './parts-view.js'
import { createPointer } from './pointer.js'
import { createPanels } from './panels.js'
import { createDebugView } from './debug-view.js'
import { createDocument, createPart, duplicatePart } from './model.js'
import { nudge, placeOnTable, worldBox } from './geometry.js'

const container = document.getElementById('vue3d')
let view
try {
  view = createScene(container)
} catch (e) {
  container.innerHTML = '<p class="erreur">Ce navigateur ne sait pas afficher la 3D (WebGL 2 indisponible).</p>'
  throw e
}

const doc = createDocument()
const partsView = createPartsView(view.scene, view.size)
const debugView = createDebugView(view.scene)
let selectedId = null
let hoveredId = null

const findPart = id => doc.parts.find(p => p.id === id)

function refresh() {
  partsView.sync(doc)
  partsView.highlight(hoveredId, selectedId)
  panels.render(doc, selectedId)
  debugView.update(doc)
  view.requestRender()
}

const actions = {
  create(spec) {
    const part = createPart(doc, spec)
    placeOnTable(part, doc.parts, view.controls.target)
    doc.parts.push(part)
    actions.select(part.id)
  },
  select(id) {
    selectedId = id
    refresh()
  },
  update(id, changes) {
    Object.assign(findPart(id), changes)
    refresh()
  },
  // La copie se pose dans la zone libre la plus proche de l'original (CdC § 15)
  duplicate(id) {
    const part = findPart(id)
    const box = worldBox(part)
    const copy = duplicatePart(doc, part)
    placeOnTable(copy, doc.parts, { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 })
    doc.parts.push(copy)
    actions.select(copy.id)
  },
  remove(id) {
    doc.parts.splice(doc.parts.indexOf(findPart(id)), 1)
    if (selectedId === id) selectedId = null
    if (hoveredId === id) hoveredId = null
    refresh()
  },
  toggleHidden(id) {
    const part = findPart(id)
    part.hidden = !part.hidden
    if (part.hidden && selectedId === id) selectedId = null
    refresh()
  },
}

const panels = createPanels(actions)

// Déplacement en cours : la pièce suit sans repasser par les panneaux
function moveTo(id, position) {
  const part = findPart(id)
  part.position = position
  partsView.move(part)
  if (debugView.enabled) debugView.update(doc)
  view.requestRender()
}

createPointer({
  canvas: view.renderer.domElement,
  camera: view.camera,
  controls: view.controls,
  partsView,
  findPart,
  onHover: id => {
    hoveredId = id
    partsView.highlight(hoveredId, selectedId)
    view.requestRender()
  },
  onClick: id => actions.select(id),
  onDragStart: id => { if (id !== selectedId) actions.select(id) },
  onDrag: moveTo,
  onDragEnd: refresh,
})

// Direction horizontale « vers le fond de l'écran » : l'axe de visée plus l'axe vertical de la
// caméra, projetés sur la table (le second prend le relais quand on regarde à la verticale).
function screenAway() {
  const e = view.camera.matrixWorld.elements
  return { x: e[4] - e[8], z: e[6] - e[10] }
}

// Clavier : Échap désélectionne, Suppr ou ⌫ supprime, ⌘D ou Ctrl+D duplique, les flèches
// déplacent de 1 mm (10 mm avec Maj)
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return
  if (e.key === 'Escape') return actions.select(null)
  if (!selectedId) return
  const step = nudge(screenAway(), e.key)
  if (step) {
    e.preventDefault()
    const [x, y, z] = findPart(selectedId).position
    const d = e.shiftKey ? 10 : 1
    moveTo(selectedId, [x + step[0] * d, y, z + step[1] * d])
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    actions.remove(selectedId)
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    actions.duplicate(selectedId)
  }
})

const gridSelect = document.getElementById('grille')
view.setGrid(Number(gridSelect.value))
gridSelect.addEventListener('change', () => {
  view.setGrid(Number(gridSelect.value))
  gridSelect.blur() // rend le clavier à la scène (Espace)
})

document.getElementById('debug').addEventListener('change', e => {
  debugView.enabled = e.target.checked
  debugView.update(doc)
  view.requestRender()
  e.target.blur()
})

window.maquette = { ...view, doc, partsView, debugView, actions } // accès depuis la console, pour le débogage
refresh()
