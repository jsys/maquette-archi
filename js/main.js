// Point d'entrée : l'état de l'application (document, sélection) et les actions qui le modifient.
import { Object3D } from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { createScene } from './scene.js'
import { createPartsView } from './parts-view.js'
import { createPointer } from './pointer.js'
import { createPanels } from './panels.js'
import { createDebugView } from './debug-view.js'
import { createDocument, createPart, duplicatePart } from './model.js'
import { nudge, placeOnTable, rotatedPose, worldBox } from './geometry.js'
import { findSnap } from './snap.js'
import { blockers, excessAlong, overlapping, penetration, sweep, underTable } from './collision.js'
import { createLibrary, download, loadLocal, newPlanId, readFile, saveLocal } from './storage.js'
import { VERSION } from './version.js'
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

// Flèches de déplacement selon les axes, sur la pièce sélectionnée (rouge X, verte Y vers le haut,
// bleue Z) ; seulement les flèches, sans les plans de three.js. Elles tiennent un repère posé au
// centre de la pièce (l'origine de la pièce est un coin de son contour), que la pièce suit.
const gizmo = new TransformControls(view.camera, view.renderer.domElement)
Object.assign(gizmo, { size: 0.8, showXY: false, showYZ: false, showXZ: false })
const handle = new Object3D()
view.scene.add(handle, gizmo.getHelper())
gizmo.addEventListener('change', view.requestRender)

function placeHandle() {
  const part = findPart(selectedId)
  if (!part || part.hidden) return gizmo.detach()
  worldBox(part).getCenter(handle.position)
  gizmo.attach(handle)
}

function refresh() {
  partsView.sync(doc)
  placeHandle()
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
// La maquette en cours est toujours gardée (elle revient au rechargement) ; nommée, elle est en
// plus tenue à jour dans la bibliothèque du navigateur, que liste « Ouvrir… ».
const library = createLibrary(localStorage)
function save() {
  clearTimeout(saveTimer)
  saveTimer = 0
  let ok = saveLocal(doc)
  if (ok && doc.id) {
    try {
      library.save(doc)
    } catch {
      ok = false
    }
  }
  const done = doc.id ? 'Enregistrée' : 'Gardée dans ce navigateur'
  showStatus(ok ? done : 'Enregistrement impossible dans ce navigateur', !ok)
}
function showStatus(text, isError = false) {
  status.textContent = text
  status.classList.toggle('erreur-etat', isError)
}
addEventListener('pagehide', () => { if (saveTimer) save() })

// Nouveau document ou fichier ouvert : on garde le même objet, auquel tout le reste est relié
// Nouveau document ou maquette ouverte : on garde le même objet, auquel tout le reste est relié.
// L'historique d'annulation de l'ancienne ne vaut plus.
function replaceDocument(next) {
  doc.parts = next.parts
  if (next.id) Object.assign(doc, { id: next.id, name: next.name })
  else {
    delete doc.id
    delete doc.name
  }
  undoHistory.clear()
  lastRecord = { key: null, time: 0 }
  updateUndoButtons()
  selectedId = hoveredId = null
  showName()
  refresh()
}
const nameLabel = document.getElementById('nom-maquette')
function showName() {
  nameLabel.textContent = doc.name ?? 'Maquette sans nom'
  nameLabel.classList.toggle('sans-nom', !doc.id)
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
  const reached = sweep(part, part.position, position, obstaclesFor(part), { table: !underTable(part) })
  if (reached.every((v, i) => v === part.position[i])) return // bloquée
  remember(`nudge:${id}`)
  part.position = reached
  delete part.attachedTo
  partsView.move(part)
  placeHandle()
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
    table: !underTable(part),
    snap: attached ? { targetId: attached.partId, targetEdge: attached.edge } : null,
  }
}

function dragMove(id, target, free) {
  const part = findPart(id)
  part.quaternion = [...drag.quaternion]
  drag.position = sweep({ ...part, position: drag.position }, drag.position, target, drag.obstacles, { table: drag.table })
  part.position = drag.position
  const targets = doc.parts.filter(p => p !== part && !p.hidden)
  const snap = free ? null : findSnap(part, targets, { pxToWorld, viewPoint: view.camera.position, prefer: drag.snap })
  let blocked = null
  if (snap) {
    const posed = { ...part, position: snap.position, quaternion: snap.quaternion }
    const hits = blockers(posed, drag.obstacles)
    if (drag.table && underTable(posed)) blocked = 'Sous la table'
    else if (hits.length) {
      const excess = excessAlong(posed, hits, snap.line[1].clone().sub(snap.line[0]).normalize())
      blocked = excess === null ? 'Place occupée' : `Trop long de ${fr(excess)} mm`
    } else {
      part.position = snap.position
      part.quaternion = snap.quaternion
    }
  }
  drag.snap = blocked ? null : snap
  partsView.move(part)
  placeHandle()
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

// Flèches de déplacement : la pièce suit la flèche saisie, sans traverser les autres ni la table.
// Un geste, une étape d'annulation.
let axisDrag = null // { part, start, handleStart, position: dernière pose valide, obstacles, table }
gizmo.addEventListener('dragging-changed', e => { view.controls.enabled = !e.value })
gizmo.addEventListener('mouseDown', () => {
  const part = findPart(selectedId)
  remember()
  axisDrag = {
    part,
    start: [...part.position],
    handleStart: handle.position.clone(),
    position: [...part.position],
    obstacles: obstaclesFor(part),
    table: !underTable(part),
  }
})
gizmo.addEventListener('objectChange', () => {
  if (!axisDrag) return
  const { part, start, handleStart } = axisDrag
  const delta = handle.position.clone().sub(handleStart).round() // au mm
  const target = [start[0] + delta.x, start[1] + delta.y, start[2] + delta.z]
  axisDrag.position = sweep(part, axisDrag.position, target, axisDrag.obstacles, { table: axisDrag.table })
  part.position = axisDrag.position
  handle.position.copy(handleStart).add({ x: part.position[0] - start[0], y: part.position[1] - start[1], z: part.position[2] - start[2] })
  delete part.attachedTo
  partsView.move(part)
  if (debugView.enabled) debugView.update(doc)
})
gizmo.addEventListener('mouseUp', () => {
  axisDrag = null
  refresh()
})

createPointer({
  canvas: view.renderer.domElement,
  camera: view.camera,
  controls: view.controls,
  gizmo,
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
  const command = e.metaKey || e.ctrlKey
  if (command && e.key.toLowerCase() === 's') {
    e.preventDefault()
    return openSave()
  }
  if (e.target.closest?.('input, select, textarea, .editeur, dialog')) return
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
  // Monter et descendre : Alt+↑/↓, ou Pg.préc./Pg.suiv. (fn+↑/↓ sur Mac)
  const lift = { PageUp: 1, PageDown: -1, ...(e.altKey && { ArrowUp: 1, ArrowDown: -1 }) }[e.key]
  const step = !lift && nudge(screenAway(), e.key)
  if (lift) {
    e.preventDefault()
    const [x, y, z] = findPart(selectedId).position
    moveTo(selectedId, [x, y + lift * (e.shiftKey ? 10 : 1), z])
  } else if (step) {
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

// Fichiers (CdC § 17). Une maquette nommée est déjà enregistrée ; une maquette sans nom serait
// perdue en la remplaçant : on le demande.
const replaceOk = () => doc.id || !doc.parts.length || confirm('La maquette en cours n’a pas de nom : elle sera remplacée et perdue. Continuer ?')
document.getElementById('nouveau').addEventListener('click', () => {
  if (replaceOk()) replaceDocument(createDocument())
})

// Enregistrer… : nommer la maquette. Déjà nommée, un autre nom en enregistre une copie (l'original
// reste dans la bibliothèque tel qu'enregistré) ; « Renommer » change le nom sans copier.
const saveDialog = document.getElementById('enregistrer-sous')
const nameInput = saveDialog.querySelector('input')
function openSave() {
  nameInput.value = doc.name ?? ''
  saveDialog.classList.toggle('nommee', !!doc.id)
  saveDialog.showModal()
  nameInput.select()
}
document.getElementById('enregistrer').addEventListener('click', openSave)
saveDialog.querySelector('form').addEventListener('submit', e => {
  const choice = e.submitter?.value
  if (choice !== 'ok' && choice !== 'renommer') return
  const name = nameInput.value.trim()
  if (!name) return e.preventDefault()
  if (saveTimer) save() // l'original garde ses derniers changements
  if (!doc.id || (choice === 'ok' && name !== doc.name)) doc.id = newPlanId()
  doc.name = name
  showName()
  save()
})

// Ouvrir… : les maquettes enregistrées dans ce navigateur, plus l'import d'un fichier
const libraryDialog = document.getElementById('bibliotheque')
const planList = libraryDialog.querySelector('.plans')
const dateFr = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
function renderLibrary() {
  const plans = library.list()
  if (!plans.length) {
    planList.innerHTML = '<li class="vide">Aucune maquette enregistrée : « Enregistrer… » nomme la maquette en cours.</li>'
    return
  }
  planList.replaceChildren(...plans.map(plan => {
    const item = document.createElement('li')
    item.dataset.id = plan.id
    item.classList.toggle('courante', plan.id === doc.id)
    item.innerHTML = '<span class="titre-plan"><strong></strong><small></small></span>'
      + '<button type="button" class="secondaire" data-action="ouvrir-plan">Ouvrir</button>'
      + '<button type="button" class="secondaire" data-action="exporter-plan" title="Télécharger en fichier JSON">Exporter</button>'
      + '<button type="button" class="secondaire" data-action="supprimer-plan">Supprimer</button>'
    item.querySelector('strong').textContent = plan.name
    item.querySelector('small').textContent = `${dateFr(plan.savedAt)} · ${plan.count} pièce${plan.count > 1 ? 's' : ''}`
    return item
  }))
}
document.getElementById('ouvrir').addEventListener('click', () => {
  renderLibrary()
  libraryDialog.showModal()
})
planList.addEventListener('click', e => {
  const item = e.target.closest('li[data-id]')
  const action = e.target.closest('button')?.dataset.action
  if (!item || !action) return
  const { id } = item.dataset
  const name = item.querySelector('strong').textContent
  if (action === 'exporter-plan') {
    if (id === doc.id && saveTimer) save()
    return download(library.load(id))
  }
  if (action === 'ouvrir-plan') {
    if (id !== doc.id) {
      if (!replaceOk()) return
      if (saveTimer) save() // ne rien perdre de la maquette qu'on quitte
      try {
        replaceDocument(library.load(id))
      } catch (err) {
        return showStatus(`« ${name} » : ${err.message}`, true)
      }
    }
    libraryDialog.close()
  } else if (confirm(`Supprimer « ${name} » de ce navigateur ? C’est définitif.`)) {
    library.remove(id)
    if (id === doc.id) replaceDocument({ parts: doc.parts }) // la maquette reste à l'écran, sans nom
    renderLibrary()
  }
})

// Importer un fichier JSON : il arrive sans nom, à enregistrer sous le sien
const fileInput = document.getElementById('fichier')
libraryDialog.querySelector('[data-action="importer"]').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files
  fileInput.value = '' // rouvrir le même fichier redéclenche l'événement
  if (!file || !replaceOk()) return
  try {
    replaceDocument({ parts: (await readFile(file)).parts })
    libraryDialog.close()
  } catch (e) {
    showStatus(`${file.name} : ${e.message}`, true)
  }
})
undoButton.addEventListener('click', () => travel('undo'))
redoButton.addEventListener('click', () => travel('redo'))
document.getElementById('aide').addEventListener('click', () => help.showModal())

document.getElementById('debug').addEventListener('change', e => {
  debugView.enabled = e.target.checked
  debugView.update(doc)
  view.requestRender()
  e.target.blur()
})

document.getElementById('version').textContent = `V${VERSION}`
showName()
window.maquette = { ...view, doc, partsView, debugView, actions } // accès depuis la console, pour le débogage
refresh()
