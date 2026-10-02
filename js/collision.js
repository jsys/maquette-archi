// Pièces solides : pas d'interpénétration. Chaque pièce est découpée en prismes convexes (son
// contour entier s'il est convexe, ses triangles sinon) ; deux prismes se heurtent si aucun axe
// ne les sépare (théorème des axes séparateurs : normales des faces des deux prismes, puis
// produits vectoriels de leurs arêtes deux à deux). Se toucher n'est pas se heurter : un
// recouvrement de moins de EPS mm est permis, celui de deux plaques posées l'une contre l'autre.
import { Box3, ShapeUtils, Vector2, Vector3 } from '../lib/three/three.core.js'
import { clean, partMatrix, signedArea, worldBox } from './geometry.js'

export const EPS = 0.01 // mm

// La table (Y = 0) est un plancher : rien ne passe dessous.
export const underTable = part => worldBox(part).min.y < -EPS

// Profondeur du recouvrement de deux pièces, 0 si elles ne se heurtent pas.
export function penetration(a, b) {
  let depth = 0
  for (const sa of solids(a)) for (const sb of solids(b)) depth = Math.max(depth, overlap(sa, sb))
  return depth
}

// Pièces de `others` que `part` heurte.
export function blockers(part, others) {
  return others.filter(o => penetration(part, o) > 0)
}

// Identifiants des pièces visibles qui en chevauchent une autre (affichées en rouge).
export function overlapping(parts) {
  const visible = parts.filter(p => !p.hidden)
  const ids = new Set()
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (penetration(visible[i], visible[j]) > 0) ids.add(visible[i].id).add(visible[j].id)
    }
  }
  return ids
}

// Fait glisser `part` (même orientation) de la position `from` vers `to` sans traverser les
// `obstacles` ni la table : X, puis Z, puis Y séparément, ce qui lui fait longer un mur au lieu
// de s'y coller ; par pas de la moitié de la plus fine épaisseur au plus, pour ne jamais sauter de
// l'autre côté d'une plaque ; contact affiné par dichotomie. Renvoie la position atteinte.
// `table: false` : la pièce est déjà sous la table, on la laisse en sortir.
export function sweep(part, from, to, obstacles, { table = true } = {}) {
  const hits = position => {
    const moved = { ...part, position }
    return (table && underTable(moved)) || obstacles.some(o => penetration(moved, o) > 0)
  }
  const maxStep = Math.max(Math.min(part.thickness, ...obstacles.map(o => o.thickness)) / 2, 0.1)
  let position = [...from]
  for (const axis of [0, 2, 1]) {
    const delta = to[axis] - position[axis]
    const steps = Math.ceil(Math.abs(delta) / maxStep)
    for (let i = 1; i <= steps; i++) {
      const next = [...position]
      next[axis] = i === steps ? to[axis] : position[axis] + Math.sign(delta) * maxStep
      if (!hits(next)) {
        position = next
        continue
      }
      let free = position[axis], blocked = next[axis]
      for (let k = 0; k < 24; k++) {
        const trial = [...position]
        trial[axis] = (free + blocked) / 2
        if (hits(trial)) blocked = trial[axis]
        else free = trial[axis]
      }
      // Le contact trouvé mord des 0,01 mm tolérés : au dixième rond, s'il reste libre (0 et non -0,01)
      const round = [...position]
      round[axis] = Math.round(free * 10) / 10
      position[axis] = hits(round) ? free : round[axis]
      break
    }
  }
  return position.map(clean)
}

// Ce qui dépasse quand une pièce bute aux bouts de sa place : le long de `axis` (le bord visé),
// ce que les pièces heurtées mordent sur son début et sur sa fin, { start, end }. null si l'une
// d'elles ne couvre aucune extrémité, ou les deux : la place est prise.
export function excessAlong(part, hits, axis) {
  const [m0, m1] = extent(vertices(part), axis)
  let start = 0, end = 0
  for (const hit of hits) {
    const [b0, b1] = extent(vertices(hit), axis)
    const coversStart = b0 <= m0 + EPS, coversEnd = b1 >= m1 - EPS
    if (coversStart === coversEnd) return null
    if (coversStart) start = Math.max(start, b1 - m0)
    else end = Math.max(end, m1 - b0)
  }
  return start + end < m1 - m0 ? { start: clean(start), end: clean(end) } : null
}

// Prismes d'une pièce dans la scène, gardés tant qu'elle ne bouge pas (les obstacles d'un glisser).
const cache = new WeakMap()
function solids(part) {
  const key = JSON.stringify([part.position, part.quaternion, part.thickness])
  const hit = cache.get(part)
  if (hit?.key === key && hit.points === part.points) return hit.solids
  const m = partMatrix(part)
  const normal = new Vector3(0, 0, 1).transformDirection(m)
  const value = convexPieces(part.points).map(polygon => {
    const bottom = polygon.map(([x, y]) => new Vector3(x, y, 0).applyMatrix4(m))
    const top = polygon.map(([x, y]) => new Vector3(x, y, part.thickness).applyMatrix4(m))
    const edges = bottom.map((p, i) => bottom[(i + 1) % bottom.length].clone().sub(p).normalize())
    return {
      vertices: [...bottom, ...top],
      normals: [normal, ...edges.map(e => new Vector3().crossVectors(e, normal).normalize())],
      edges: [normal, ...edges],
      box: new Box3().setFromPoints([...bottom, ...top]),
    }
  })
  cache.set(part, { key, points: part.points, solids: value })
  return value
}

const vertices = part => solids(part).flatMap(s => s.vertices)

function convexPieces(points) {
  if (isConvex(points)) return [points]
  const contour = points.map(([x, y]) => new Vector2(x, y))
  return ShapeUtils.triangulateShape(contour, []).map(triangle => triangle.map(i => points[i]))
}

// Convexe : à chaque sommet, le contour tourne dans le même sens que lui (ou file tout droit).
export function isConvex(points) {
  const turn = Math.sign(signedArea(points))
  return points.every(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length]
    const [x2, y2] = points[(i + 2) % points.length]
    return turn * ((x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1)) >= -1e-9
  })
}

function overlap(a, b) {
  const boxes = ['x', 'y', 'z'].every(k => Math.min(a.box.max[k], b.box.max[k]) - Math.max(a.box.min[k], b.box.min[k]) > EPS)
  if (!boxes) return 0
  let depth = Infinity
  const separates = axis => {
    const [a0, a1] = extent(a.vertices, axis), [b0, b1] = extent(b.vertices, axis)
    const o = Math.min(a1, b1) - Math.max(a0, b0)
    if (o <= EPS) return true
    depth = Math.min(depth, o)
    return false
  }
  for (const axis of a.normals) if (separates(axis)) return 0
  for (const axis of b.normals) if (separates(axis)) return 0
  const cross = new Vector3()
  for (const ea of a.edges) {
    for (const eb of b.edges) {
      const length = cross.crossVectors(ea, eb).length()
      if (length > 1e-6 && separates(cross.divideScalar(length))) return 0
    }
  }
  return depth
}

function extent(points, axis) {
  let min = Infinity, max = -Infinity
  for (const p of points) {
    const d = p.dot(axis)
    if (d < min) min = d
    if (d > max) max = d
  }
  return [min, max]
}
