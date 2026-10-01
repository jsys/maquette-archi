// Point d'entrée : l'état de l'application (document, sélection) et les actions qui le modifient.
import { createScene } from './scene.js'
import { createPartsView } from './parts-view.js'
import { createPointer } from './pointer.js'
import { createPanels } from './panels.js'
import { createDocument, createPart, duplicatePart } from './model.js'
import { placeOnTable, worldBox } from './geometry.js'

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
let selectedId = null
let hoveredId = null

const findPart = id => doc.parts.find(p => p.id === id)

function refresh() {
  partsView.sync(doc)
  partsView.highlight(hoveredId, selectedId)
  panels.render(doc, selectedId)
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

createPointer({
  canvas: view.renderer.domElement,
  camera: view.camera,
  partsView,
  onHover: id => {
    hoveredId = id
    partsView.highlight(hoveredId, selectedId)
    view.requestRender()
  },
  onClick: id => actions.select(id),
})

// Clavier : Échap désélectionne, Suppr ou ⌫ supprime, ⌘D ou Ctrl+D duplique
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return
  if (e.key === 'Escape') return actions.select(null)
  if (!selectedId) return
  if (e.key === 'Delete' || e.key === 'Backspace') {
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

window.maquette = { ...view, doc, partsView, actions } // accès depuis la console, pour le débogage
refresh()
