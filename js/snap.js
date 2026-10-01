// Snap arête → arête (CdC § 11, § 33, § 34), règles retenues le 01/10/2026 :
// - une arête est un bord du carton, un segment du contour (voir partEdges) ;
// - bord visé : celui d'une autre pièce qui longe un bord à peu près parallèle (moins de 30°) de
//   la pièce déplacée, le milieu de l'un à moins de `radiusPx` pixels de l'autre (distance 3D
//   rapportée à la taille d'un pixel à cet endroit : la sensation reste la même quel que soit le
//   zoom, et rien n'accroche à travers la profondeur). Deux bords qui se touchent par un bout ne
//   comptent pas. Le bord `prefer` (celui où la pièce est déjà posée) compte double : une pièce
//   dans un coin ne saute pas d'un bord à l'autre ;
// - bord de la pièce déplacée : la longueur la plus proche de celle du bord visé, puis le plus proche ;
// - pose : sa tranche se pose sur la face de la cible, centrée sur le bord visé, sa face extérieure
//   affleurant la tranche de la cible (le mur posé au bord du sol), à 90° ;
// - côté : celui d'où l'on amène la pièce ; dans le plan de la cible, celui de la caméra.
import { Matrix4, Quaternion, Vector3 } from '../lib/three/three.core.js'
import { clean, partEdges, partMatrix, signedArea } from './geometry.js'

// Pose aimantée de `moving` contre l'une des `targets`, ou null. `pxToWorld(point)` : taille d'un
// pixel écran à ce point de la scène, en mm. `viewPoint` : position de la caméra. `prefer` :
// { targetId, targetEdge } du snap précédent.
export function findSnap(moving, targets, { pxToWorld, viewPoint, radiusPx = 12, prefer = null }) {
  const movingEdges = partEdges(moving)
  let best = null
  for (const target of targets) {
    for (const et of partEdges(target)) {
      const tolerance = radiusPx * pxToWorld(et.center)
      const weight = prefer?.targetId === target.id && prefer.targetEdge === et.index ? 0.5 : 1
      for (const em of movingEdges) {
        if (Math.abs(em.direction.dot(et.direction)) < PARALLEL) continue
        const distance = edgeGap(em, et)
        if (distance > tolerance) continue
        const score = weight * distance / tolerance
        if (!best || score < best.score) best = { score, target, et }
      }
    }
  }
  if (!best) return null

  const { target, et } = best
  const em = movingEdges.reduce((a, b) => {
    const da = Math.abs(a.length - et.length), db = Math.abs(b.length - et.length)
    if (Math.abs(da - db) > EPS) return da < db ? a : b
    return edgeGap(a, et) <= edgeGap(b, et) ? a : b
  })
  return { ...pose(moving, movingEdges, em, target, et, viewPoint), targetId: target.id, targetEdge: et.index, movingEdge: em.index }
}

const EPS = 1e-9
const PARALLEL = Math.cos(Math.PI / 6) // 30°

function pose(moving, movingEdges, em, target, et, viewPoint) {
  // Côté de la cible : celui où se trouve la pièce, ou celui de la caméra si elle est dans son plan
  const center = movingEdges.reduce((c, e) => c.add(e.center), new Vector3()).divideScalar(movingEdges.length)
  const offset = et.normal.dot(center.sub(et.center))
  const side = Math.abs(offset) > target.thickness ? Math.sign(offset)
    : Math.sign(et.normal.dot(viewPoint.clone().sub(et.center))) || 1

  // Bord visé sur cette face de la cible : la ligne du futur raccord
  const mT = partMatrix(target)
  const z = side > 0 ? target.thickness : 0
  const a = new Vector3(et.startLocal.x, et.startLocal.y, z).applyMatrix4(mT)
  const b = new Vector3(et.endLocal.x, et.endLocal.y, z).applyMatrix4(mT)
  const down = et.normal.clone().multiplyScalar(-side) // la tranche de la pièce regarde la face

  // Repère local du bord de la pièce : u le long du bord, v sa normale sortante, w l'épaisseur
  const turn = Math.sign(signedArea(moving.points)) || 1
  const u = em.endLocal.clone().sub(em.startLocal).normalize()
  const v = new Vector3(turn * u.y, -turn * u.x, 0)
  const local = new Matrix4().makeBasis(u, v, new Vector3(0, 0, 1)).transpose()

  // Bord parallèle ou antiparallèle au bord visé : l'orientation la plus proche de l'actuelle
  // (plier la plaque plutôt que la retourner). w suit u × v comme dans la pièce.
  const q0 = new Quaternion(...moving.quaternion)
  let pick = null
  for (const sign of [1, -1]) {
    const u2 = et.direction.clone().multiplyScalar(sign)
    const w2 = new Vector3().crossVectors(u2, down).multiplyScalar(-turn)
    const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(u2, down, w2).multiply(local))
    const closeness = Math.abs(q.dot(q0))
    if (!pick || closeness > pick.closeness) pick = { q, w2, closeness }
  }

  // Le milieu du bord, pris sur la face extérieure de la pièce, vient au milieu du bord visé
  const outer = pick.w2.dot(et.outward) > 0 ? moving.thickness : 0
  const anchor = em.startLocal.clone().lerp(em.endLocal, 0.5).setZ(outer).applyQuaternion(pick.q)
  return {
    position: a.clone().lerp(b, 0.5).sub(anchor).toArray().map(clean),
    quaternion: pick.q.toArray().map(c => (Math.abs(c) < 1e-12 ? 0 : c)),
    line: [a, b],
  }
}

// Écart entre deux bords qui se longent : le milieu de l'un rapporté à l'autre, le plus petit des
// deux. Deux bords alignés bout à bout restent loin l'un de l'autre.
export function edgeGap(a, b) {
  return Math.min(pointToSegment(a.center, b.start, b.end), pointToSegment(b.center, a.start, a.end))
}

// Distance du point p au segment [a, b].
export function pointToSegment(p, a, b) {
  const ab = b.clone().sub(a)
  const t = Math.min(1, Math.max(0, p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)))
  return a.clone().addScaledVector(ab, t).distanceTo(p)
}
