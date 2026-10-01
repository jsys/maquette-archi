// Point d'entrée : l'état de l'application (document, sélection) et les actions qui le modifient.
import { createScene } from './scene.js'
import { createPartsView } from './parts-view.js'
import { createPointer } from './pointer.js'
import { createPanels } from './panels.js'
import { createDebugView } from './debug-view.js'
import { createDocument, createPart, duplicatePart } from './model.js'
import { nudge, placeOnTable, rotatedPose, worldBox } from './geometry.js'
import { findSnap } from './snap.js'
import { blockers, excessAlong, overlapping, penetration, sweep } from './collision.js'
import { download, loadLocal, readFile, saveLocal } from './storage.js'
import { createHistory } from './history.js'

const container = document.getElementById('vue3d')
let view
try {
  view = createScene(container)
} catch (e) {
  container.innerHTML = '<p class="erreur">Ce navigateur ne sait pas afficher la 3D (WebGL 2 indisponible).</p>'
  throw e
}

const doc = loadLocal() ?? createDocument() // la séance précédente, enregistrée dans ce navigateur
const partsView = createPartsView(view.scene, view.size)
const debugView = createDebugView(view.scene)
let selectedId = null
let hoveredId = null
let colliding = new Set() // pièces qui en chevauchent une autre, entourées de rouge

const findPart = id => doc.parts.find(p => p.id === id)
const fr = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

// Obstacles d'une pièce : les autres pièces visibles, sauf celles qu'elle chevauche déjà (après
// un redimensionnement, par exemple) : on doit pouvoir la dégager.
const obstaclesFor = part => doc.parts.filter(p => p !== part && !p.hidden && !penetration(part, p))

function refresh() {
  partsView.sync(doc)
  colliding = overlapping(doc.parts)
  partsView.highlight(hoveredId, selectedId, colliding)
  panels.render(doc, selectedId)
  debugView.update(doc)
  welcome.hidden = doc.parts.length > 0
  view.requestRender()
  scheduleSave()
}
const welcome = document.getElementById('accueil')

// Annuler et rétablir (CdC § 16) : on photographie le document juste avant chaque changement.
// Une rafale de même nature (frappe d'un nom, flèches sur une pièce) ne fait qu'une étape.
const undoHistory = createHistory()
const undoButton = document.getElementById('annuler')
const redoButton = document.getElementById('retablir')
let lastRecord = { key: null, time: 0 }

function remember(key = null) {
  const now = performance.now()
  const burst = key !== null && key === lastRecord.key && now - lastRecord.time < 1000
  lastRecord = { key, time: now }
  if (!burst) undoHistory.record(JSON.stringify(doc.parts))
  updateUndoButtons()
}

function travel(step) {
  if (drag) return
  const snapshot = undoHistory[step](JSON.stringify(doc.parts))
  if (!snapshot) return
  doc.parts = JSON.parse(snapshot)
  if (!findPart(selectedId)) selectedId = null
  hoveredId = null
  lastRecord = { key: null, time: 0 }
  refresh()
  updateUndoButtons()
}

function updateUndoButtons() {
  undoButton.disabled = !undoHistory.canUndo
  redoButton.disabled = !undoHistory.canRedo
}

// Enregistrement dans le navigateur, regroupé : une rafale de changements donne une écriture
const status = document.getElementById('etat')
let saveTimer = 0
function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 300)
}
function save() {
  clearTimeout(saveTimer)
  saveTimer = 0
  const ok = saveLocal(doc)
  showStatus(ok ? 'Enregistré dans ce navigateur' : 'Enregistrement impossible dans ce navigateur', !ok)
}
function showStatus(text, isError = false) {
  status.textContent = text
  status.classList.toggle('erreur-etat', isError)
}
addEventListener('pagehide', () => { if (saveTimer) save() })

// Nouveau document ou fichier ouvert : on garde le même objet, auquel tout le reste est relié
function replaceDocument(next) {
  remember()
  doc.parts = next.parts
  selectedId = hoveredId = null
  refresh()
}

const actions = {
  create(spec) {
    remember()
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
    remember(`update:${id}:${Object.keys(changes)}`)
    Object.assign(findPart(id), changes)
    refresh()
  },
  // La copie se pose dans la zone libre la plus proche de l'original (CdC § 15)
  duplicate(id) {
    remember()
    const part = findPart(id)
    const box = worldBox(part)
    const copy = duplicatePart(doc, part)
    placeOnTable(copy, doc.parts, { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 })
    doc.parts.push(copy)
    actions.select(copy.id)
  },
  remove(id) {
    remember()
    doc.parts.splice(doc.parts.indexOf(findPart(id)), 1)
    if (selectedId === id) selectedId = null
    if (hoveredId === id) hoveredId = null
    refresh()
  },
  // Quart de tour autour de la verticale (« turn », R) ou bascule vers soi autour de l'axe
  // horizontal de l'écran (« tilt », B) ; Maj pour l'autre sens. Refusé si la pièce en heurterait une autre.
  rotate(id, kind, reverse = false) {
    const part = findPart(id)
    const [dx, dz] = nudge(screenAway(), 'ArrowRight')
    const [axis, angle] = kind === 'turn' ? [[0, 1, 0], -Math.PI / 2] : [[dx, 0, dz], Math.PI / 2]
    const pose = rotatedPose(part, axis, reverse ? -angle : angle)
    if (blockers({ ...part, ...pose }, obstaclesFor(part)).length) {
      return showStatus('Rotation impossible : la pièce en heurterait une autre.', true)
    }
    remember()
    Object.assign(part, pose)
    delete part.attachedTo
    refresh()
  },
  toggleHidden(id) {
    remember()
    const part = findPart(id)
    part.hidden = !part.hidden
    if (part.hidden && selectedId === id) selectedId = null
    refresh()
  },
}

const panels = createPanels(actions)

// Flèches du clavier : la pièce avance jusqu'au contact au plus, sans repasser par les panneaux
function moveTo(id, position) {
  const part = findPart(id)
  const reached = sweep(part, part.position, position, obstaclesFor(part))
  if (reached.every((v, i) => v === part.position[i])) return // bloquée
  remember(`nudge:${id}`)
  part.position = reached
  delete part.attachedTo
  partsView.move(part)
  if (debugView.enabled) debugView.update(doc)
  view.requestRender()
  scheduleSave()
}

// Glisser avec snap (CdC § 11) : la pose libre suit la souris avec l'orientation du départ, sans
// traverser les autres pièces (elle s'arrête au contact et longe l'obstacle). Le snap la remplace
// s'il trouve un bord et que la pièce y tient ; sinon le raccord s'affiche en rouge avec la
// raison. Au relâché, la pièce retient le bord où elle s'appuie (`attachedTo`), préféré ensuite.
let drag = null // { quaternion, position: dernière pose libre, obstacles, snap }

// Taille d'un pixel écran au point donné de la scène, en mm
const pxToWorld = point => 2 * view.camera.position.distanceTo(point) * Math.tan(view.camera.fov * Math.PI / 360) / view.size.y

function dragStart(id) {
  if (id !== selectedId) actions.select(id)
  remember()
  const part = findPart(id)
  const attached = part.attachedTo
  drag = {
    quaternion: [...part.quaternion],
    position: [...part.position],
    obstacles: obstaclesFor(part),
    snap: attached ? { targetId: attached.partId, targetEdge: attached.edge } : null,
  }
}

function dragMove(id, target, free) {
  const part = findPart(id)
  part.quaternion = [...drag.quaternion]
  drag.position = sweep({ ...part, position: drag.position }, drag.position, target, drag.obstacles)
  part.position = drag.position
  const targets = doc.parts.filter(p => p !== part && !p.hidden)
  const snap = free ? null : findSnap(part, targets, { pxToWorld, viewPoint: view.camera.position, prefer: drag.snap })
  let blocked = null
  if (snap) {
    const posed = { ...part, position: snap.position, quaternion: snap.quaternion }
    const hits = blockers(posed, drag.obstacles)
    if (hits.length) {
      const excess = excessAlong(posed, hits, snap.line[1].clone().sub(snap.line[0]).normalize())
      blocked = excess === null ? 'Place occupée' : `Trop long de ${fr(excess)} mm`
    } else {
      part.position = snap.position
      part.quaternion = snap.quaternion
    }
  }
  drag.snap = blocked ? null : snap
  partsView.move(part)
  partsView.showSnap(snap?.line, blocked)
  if (debugView.enabled) debugView.update(doc, drag.snap)
  view.requestRender()
}

function dragEnd(id) {
  const part = findPart(id)
  const { snap } = drag
  if (snap) part.attachedTo = { partId: snap.targetId, edge: snap.targetEdge, ownEdge: snap.movingEdge }
  else delete part.attachedTo
  drag = null
  partsView.showSnap(null)
  refresh()
}

createPointer({
  canvas: view.renderer.domElement,
  camera: view.camera,
  controls: view.controls,
  partsView,
  findPart,
  onHover: id => {
    hoveredId = id
    partsView.highlight(hoveredId, selectedId, colliding)
    view.requestRender()
  },
  onClick: id => actions.select(id),
  onDragStart: dragStart,
  onDrag: dragMove,
  onDragEnd: dragEnd,
})

// Direction horizontale « vers le fond de l'écran » : l'axe de visée plus l'axe vertical de la
// caméra, projetés sur la table (le second prend le relais quand on regarde à la verticale).
function screenAway() {
  const e = view.camera.matrixWorld.elements
  return { x: e[4] - e[8], z: e[6] - e[10] }
}

// Clavier (fiche « ? ») : ⌘Z ou Ctrl+Z annule, avec Maj rétablit ; Échap désélectionne ; Suppr ou
// ⌫ supprime, ⌘D ou Ctrl+D duplique, les flèches déplacent de 1 mm (10 mm avec Maj). Dans un
// champ ou le dessin 2D, le clavier leur appartient.
const help = document.getElementById('raccourcis')
addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea, .editeur, dialog')) return
  const command = e.metaKey || e.ctrlKey
  if (command && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    return travel(e.shiftKey ? 'redo' : 'undo')
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    return travel('redo')
  }
  if (e.key === '?') return help.showModal()
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
  } else if (command && e.key.toLowerCase() === 'd') {
    e.preventDefault()
    actions.duplicate(selectedId)
  } else if (!command && e.key.toLowerCase() === 'r') {
    actions.rotate(selectedId, 'turn', e.shiftKey)
  } else if (!command && e.key.toLowerCase() === 'b') {
    actions.rotate(selectedId, 'tilt', e.shiftKey)
  }
})

const gridSelect = document.getElementById('grille')
view.setGrid(Number(gridSelect.value))
gridSelect.addEventListener('change', () => {
  view.setGrid(Number(gridSelect.value))
  gridSelect.blur() // rend le clavier à la scène (Espace)
})

// Fichiers (CdC § 17). Remplacer une maquette non vide se confirme : l'enregistrement
// automatique écraserait l'ancienne.
const replaceOk = () => !doc.parts.length || confirm('Remplacer la maquette en cours ? Exportez-la d’abord pour la garder.')
const fileInput = document.getElementById('fichier')
document.getElementById('nouveau').addEventListener('click', () => {
  if (replaceOk()) replaceDocument(createDocument())
})
document.getElementById('ouvrir').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files
  fileInput.value = '' // rouvrir le même fichier redéclenche l'événement
  if (!file || !replaceOk()) return
  try {
    replaceDocument(await readFile(file))
  } catch (e) {
    showStatus(`${file.name} : ${e.message}`, true)
  }
})
document.getElementById('exporter').addEventListener('click', () => download(doc))
undoButton.addEventListener('click', () => travel('undo'))
redoButton.addEventListener('click', () => travel('redo'))
document.getElementById('aide').addEventListener('click', () => help.showModal())

document.getElementById('debug').addEventListener('change', e => {
  debugView.enabled = e.target.checked
  debugView.update(doc)
  view.requestRender()
  e.target.blur()
})

window.maquette = { ...view, doc, partsView, debugView, actions } // accès depuis la console, pour le débogage
refresh()
