// Maillages des pièces. Ils se reconstruisent depuis le modèle (sync), jamais l'inverse : c'est ce
// qui permettra annuler, ouvrir et dupliquer sans code de rendu en plus.
import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { materialById } from './model.js'

// Contours : survol, sélection, chevauchement. L'épaisseur change, pas seulement la couleur (CdC § 35).
const ACCENT = 0xd9692b
const DANGER = 0xd32f2f
const OUTLINES = {
  hover: new LineMaterial({ color: ACCENT, linewidth: 2, transparent: true, opacity: 0.5 }),
  selected: new LineMaterial({ color: ACCENT, linewidth: 3.5 }),
  collision: new LineMaterial({ color: DANGER, linewidth: 2.5 }),
}
// Raccord du snap en cours (CdC § 11.4) : trait épais sur le bord visé, par-dessus tout ; vert s'il
// est possible, rouge si la pièce n'y tient pas
const SNAP = {
  ok: new LineMaterial({ color: 0x16a34a, linewidth: 5, depthTest: false }),
  blocked: new LineMaterial({ color: DANGER, linewidth: 5, depthTest: false }),
}

// `resolution` : taille de la vue en pixels CSS, tenue à jour par la scène. Les traits épais se
// calculent en pixels et la partagent.
export function createPartsView(scene, resolution) {
  for (const m of [...Object.values(OUTLINES), ...Object.values(SNAP)]) m.uniforms.resolution.value = resolution
  const group = new THREE.Group()
  scene.add(group)
  const snapLine = new LineSegments2(new LineSegmentsGeometry(), SNAP.ok)
  snapLine.renderOrder = 11
  snapLine.visible = false
  scene.add(snapLine)
  const snapLabel = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'refus' }))
  snapLabel.visible = false
  scene.add(snapLabel)
  const views = new Map() // id de pièce → { key, object, mesh, edges, outline }

  function remove(id) {
    const v = views.get(id)
    group.remove(v.object)
    for (const o of [v.mesh, v.edges, v.outline]) o.geometry.dispose()
    v.mesh.material.dispose()
    v.edges.material.dispose()
    views.delete(id)
  }

  function sync(doc) {
    const alive = new Set()
    for (const part of doc.parts) {
      alive.add(part.id)
      const key = JSON.stringify([part.points, part.thickness, part.materialId])
      if (views.get(part.id)?.key !== key) {
        if (views.has(part.id)) remove(part.id)
        const v = build(part)
        views.set(part.id, { key, ...v })
        group.add(v.object)
      }
      const { object } = views.get(part.id)
      object.position.fromArray(part.position)
      object.quaternion.fromArray(part.quaternion)
      object.visible = !part.hidden
    }
    for (const id of views.keys()) if (!alive.has(id)) remove(id)
  }

  function highlight(hovered, selected, colliding = new Set()) {
    for (const [id, v] of views) {
      const state = id === selected ? 'selected' : colliding.has(id) ? 'collision' : id === hovered ? 'hover' : null
      v.outline.visible = state !== null
      v.edges.visible = state === null
      if (state) v.outline.material = OUTLINES[state]
    }
  }

  // Déplacement seul : place l'objet sans relire tout le document (glisser, flèches)
  function move(part) {
    const { object } = views.get(part.id)
    object.position.fromArray(part.position)
    object.quaternion.fromArray(part.quaternion)
  }

  // Une géométrie neuve à chaque raccord : la remplir à nouveau laisserait ses tampons sur la carte graphique
  // `blocked` : pourquoi la pièce n'y tient pas (« Trop long de 4 mm »), écrit à côté du trait rouge ;
  // `fix` : { text, run }, le bouton qui y remédie
  let snapKey = null
  function showSnap(line, blocked = null, fix = null) {
    snapLine.visible = !!line
    snapLabel.visible = !!(line && blocked)
    if (!line) return
    snapLine.material = blocked ? SNAP.blocked : SNAP.ok
    if (blocked) {
      snapLabel.element.textContent = blocked
      if (fix) snapLabel.element.append(Object.assign(document.createElement('button'), { type: 'button', textContent: fix.text, onclick: fix.run }))
      snapLabel.position.copy(line[0]).lerp(line[1], 0.5)
    }
    const key = line.flatMap(p => p.toArray()).join()
    if (key === snapKey) return
    snapKey = key
    snapLine.geometry.dispose()
    snapLine.geometry = new LineSegmentsGeometry().setPositions(line.flatMap(p => p.toArray()))
  }

  return {
    sync,
    move,
    highlight,
    showSnap,
    pickables() {
      group.updateMatrixWorld()
      return [...views.values()].filter(v => v.object.visible).map(v => v.mesh)
    },
    idOf: mesh => mesh?.parent.userData.partId ?? null,
  }
}

// Une plaque : le contour extrudé (CdC § 7), ses arêtes d'un ton plus sombre pour qu'une plaque
// fine reste lisible, et son contour épais, caché hors survol et sélection. Le décalage de
// polygones laisse les traits devant les faces.
function build(part) {
  const shape = new THREE.Shape(part.points.map(([x, y]) => new THREE.Vector2(x, y)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false })
  const color = new THREE.Color(materialById(part.materialId).color)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }))
  mesh.castShadow = mesh.receiveShadow = true
  const edgesGeometry = new THREE.EdgesGeometry(geometry, 1)
  const edges = new THREE.LineSegments(edgesGeometry, new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.35) }))
  const outline = new LineSegments2(new LineSegmentsGeometry().fromEdgesGeometry(edgesGeometry), OUTLINES.hover)
  outline.visible = false
  const object = new THREE.Group()
  object.add(mesh, edges, outline)
  object.userData.partId = part.id
  return { object, mesh, edges, outline }
}
