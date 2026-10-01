// Géométrie pure des pièces, sans DOM : importe three.core.js directement pour tourner sous Node.
import { Box3, Matrix4, Quaternion, Vector3 } from '../lib/three/three.core.js'

const ONE = new Vector3(1, 1, 1)
const EPS = 1e-6 // mm : les quarts de tour laissent des restes de l'ordre de 1e-14

// Nettoie ces restes (et -0) avant qu'ils n'atterrissent dans le JSON.
export const clean = v => Math.round(v * 1e6) / 1e6 || 0

// Repère de la pièce : son contour vit dans le plan XY local, son épaisseur selon Z local.
export function partMatrix(part) {
  return new Matrix4().compose(new Vector3(...part.position), new Quaternion(...part.quaternion), ONE)
}

// Aire signée du contour : positive dans le sens trigonométrique.
export function signedArea(points) {
  return points.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length]
    return sum + x0 * y1 - x1 * y0
  }, 0) / 2
}

// Bords d'une pièce (CdC § 32) : un par segment du contour, c'est-à-dire une tranche du carton,
// représentée par son segment à mi-épaisseur. Chaque bord donne aussi sa normale sortante (dans
// le plan de la plaque, vers l'extérieur du contour) et la normale de la plaque. `start`, `end`,
// `center`, `direction`, `outward`, `normal` : dans la scène ; `startLocal`, `endLocal` : dans la pièce.
export function partEdges(part) {
  const m = partMatrix(part)
  const turn = Math.sign(signedArea(part.points)) || 1
  const z = part.thickness / 2
  const normal = new Vector3(0, 0, 1).transformDirection(m)
  return part.points.map(([x0, y0], index) => {
    const [x1, y1] = part.points[(index + 1) % part.points.length]
    const length = Math.hypot(x1 - x0, y1 - y0)
    const startLocal = new Vector3(x0, y0, z)
    const endLocal = new Vector3(x1, y1, z)
    const start = startLocal.clone().applyMatrix4(m)
    const end = endLocal.clone().applyMatrix4(m)
    return {
      partId: part.id,
      index,
      startLocal,
      endLocal,
      start,
      end,
      length,
      center: start.clone().lerp(end, 0.5),
      direction: end.clone().sub(start).normalize(),
      outward: new Vector3(turn * (y1 - y0), -turn * (x1 - x0), 0).transformDirection(m),
      normal: normal.clone(),
    }
  })
}

// Boîte englobante de la pièce dans la scène : le contour à z = 0 et à z = épaisseur, transformé.
export function worldBox(part, target = new Box3()) {
  const m = partMatrix(part)
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

// Glisser une pièce (CdC § 10) : le point saisi `grab` suit le rayon de la souris sur le plan
// horizontal qui le contient. Renvoie la nouvelle position, arrondie au mm, ou null quand le
// rayon file vers l'horizon ou part au-dessus du plan.
export function dragOnPlane(start, grab, ray, maxDistance = 5000) {
  const t = (grab.y - ray.origin.y) / ray.direction.y
  if (!(t > 0 && t <= maxDistance)) return null
  return [
    Math.round(start[0] + ray.origin.x + t * ray.direction.x - grab.x),
    start[1],
    Math.round(start[2] + ray.origin.z + t * ray.direction.z - grab.z),
  ]
}

// Flèches du clavier : pas d'un axe du monde, celui qui se rapproche le plus de la direction de
// l'écran. `away` : direction horizontale « vers le fond de l'écran ». ↑ s'éloigne, → va à droite.
export function nudge(away, key) {
  const [ax, az] = Math.abs(away.x) >= Math.abs(away.z) ? [Math.sign(away.x), 0] : [0, Math.sign(away.z)]
  const moves = { ArrowUp: [ax, az], ArrowDown: [-ax, -az], ArrowRight: [-az, ax], ArrowLeft: [az, -ax] }
  return moves[key]?.map(v => v || 0) ?? null // pas de -0
}

// Positions d'un anneau carré de rayon r, les plus proches du centre d'abord.
function ring(r, step) {
  if (r === 0) return [[0, 0]]
  const cells = []
  for (let t = -r; t < r; t += step) cells.push([t, -r], [r, t], [-t, r], [-r, -t])
  return cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
}
