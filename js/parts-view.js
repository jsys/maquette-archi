// Maillages des pièces. Ils se reconstruisent depuis le modèle (sync), jamais l'inverse : c'est ce
// qui permettra annuler, ouvrir et dupliquer sans code de rendu en plus.
import * as THREE from 'three'
import { materialById } from './model.js'

export function createPartsView(scene) {
  const group = new THREE.Group()
  scene.add(group)
  const views = new Map() // id de pièce → { key, object }

  function remove(id) {
    const { object } = views.get(id)
    group.remove(object)
    object.traverse(o => { o.geometry?.dispose(); o.material?.dispose() })
    views.delete(id)
  }

  function sync(doc) {
    const alive = new Set()
    for (const part of doc.parts) {
      alive.add(part.id)
      const key = JSON.stringify([part.points, part.thickness, part.materialId])
      if (views.get(part.id)?.key !== key) {
        if (views.has(part.id)) remove(part.id)
        const object = build(part)
        views.set(part.id, { key, object })
        group.add(object)
      }
      const { object } = views.get(part.id)
      object.position.fromArray(part.position)
      object.quaternion.fromArray(part.quaternion)
    }
    for (const id of views.keys()) if (!alive.has(id)) remove(id)
  }

  return { group, sync, objectOf: id => views.get(id)?.object }
}

// Une plaque : le contour extrudé (CdC § 7), et ses arêtes d'un ton plus sombre pour qu'une
// plaque fine reste lisible. Le décalage de polygones laisse les arêtes devant les faces.
function build(part) {
  const shape = new THREE.Shape(part.points.map(([x, y]) => new THREE.Vector2(x, y)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false })
  const color = new THREE.Color(materialById(part.materialId).color)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }))
  mesh.castShadow = mesh.receiveShadow = true
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 1),
    new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.35) }),
  )
  const object = new THREE.Group()
  object.add(mesh, edges)
  object.userData.partId = part.id
  return object
}
