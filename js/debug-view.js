// Mode debug (CdC § 42) : sommets, bords et leur index, normales sortantes. Dessiné par-dessus
// les pièces, reconstruit à chaque changement tant qu'il est actif.
import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { partEdges } from './geometry.js'

const COLOR = 0x2f6fde
const ON_TOP = { color: COLOR, depthTest: false, transparent: true }

export function createDebugView(scene) {
  const group = new THREE.Group()
  scene.add(group)
  let enabled = false

  function clear() {
    for (const o of [...group.children]) {
      group.remove(o) // une étiquette retire son élément HTML d'elle-même
      o.geometry?.dispose()
      o.material?.dispose()
    }
  }

  function update(doc) {
    clear()
    if (!enabled) return
    const edges = [], normals = [], vertices = []
    for (const part of doc.parts) {
      if (part.hidden) continue
      for (const e of partEdges(part)) {
        edges.push(...e.start.toArray(), ...e.end.toArray())
        vertices.push(...e.start.toArray())
        normals.push(...e.center.toArray(), ...e.center.clone().addScaledVector(e.outward, 8).toArray())
        group.add(label(e.index, e.center.clone().addScaledVector(e.outward, 14)))
      }
    }
    group.add(segments(edges, 1), segments(normals, 0.6), dots(vertices))
  }

  return {
    update,
    get enabled() { return enabled },
    set enabled(on) { enabled = on },
  }
}

function segments(positions, opacity) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ ...ON_TOP, opacity }))
  lines.renderOrder = 10
  return lines
}

function dots(positions) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ ...ON_TOP, size: 6, sizeAttenuation: false }))
  points.renderOrder = 10
  return points
}

function label(text, position) {
  const element = document.createElement('div')
  element.className = 'etiquette'
  element.textContent = text
  const object = new CSS2DObject(element)
  object.position.copy(position)
  return object
}
