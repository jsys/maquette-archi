// Géométrie pure des pièces, sans DOM : importe three.core.js directement pour tourner sous Node.
import { Box3, Matrix4, Quaternion, Vector3 } from '../lib/three/three.core.js'

const ONE = new Vector3(1, 1, 1)
const EPS = 1e-6 // mm : les quarts de tour laissent des restes de l'ordre de 1e-14
const clean = v => Math.round(v * 1e6) / 1e6 || 0 // nettoie ces restes (et -0) avant le JSON

// Boîte englobante de la pièce dans la scène : le contour à z = 0 et à z = épaisseur, transformé.
export function worldBox(part, target = new Box3()) {
  const m = new Matrix4().compose(new Vector3(...part.position), new Quaternion(...part.quaternion), ONE)
  const v = new Vector3()
  target.makeEmpty()
  for (const [x, y] of part.points) {
    target.expandByPoint(v.set(x, y, 0).applyMatrix4(m))
    target.expandByPoint(v.set(x, y, part.thickness).applyMatrix4(m))
  }
  return target
}

// Pose la pièce sur la table (Y = 0), dans la zone libre la plus proche de `center` (le point de
// la table que regarde la caméra), à `margin` mm au moins de l'emprise au sol des autres pièces.
export function placeOnTable(part, others, center, { margin = 10, step = 10, maxRadius = 2000 } = {}) {
  part.position = [0, 0, 0]
  const box = worldBox(part)
  const size = box.getSize(new Vector3())
  const occupied = others.map(p => worldBox(p))
  const at = (minX, minZ) => { part.position = [minX - box.min.x, -box.min.y, minZ - box.min.z].map(clean) }
  const isFree = (minX, minZ) => occupied.every(o =>
    o.max.x + margin <= minX + EPS || o.min.x - margin >= minX + size.x - EPS ||
    o.max.z + margin <= minZ + EPS || o.min.z - margin >= minZ + size.z - EPS)

  for (let r = 0; r <= maxRadius; r += step) {
    for (const [dx, dz] of ring(r, step)) {
      const minX = center.x + dx - size.x / 2, minZ = center.z + dz - size.z / 2
      if (isFree(minX, minZ)) return at(minX, minZ), part
    }
  }
  return at(center.x - size.x / 2, center.z - size.z / 2), part // table pleine : au centre
}

// Positions d'un anneau carré de rayon r, les plus proches du centre d'abord.
function ring(r, step) {
  if (r === 0) return [[0, 0]]
  const cells = []
  for (let t = -r; t < r; t += step) cells.push([t, -r], [r, t], [-t, r], [-r, -t])
  return cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
}
