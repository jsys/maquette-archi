// Modèle de la maquette : données pures, sérialisables en JSON (CdC § 17), sans three.js.
// Une pièce est un contour 2D en mm, extrudé de son épaisseur le long de son axe Z local,
// puis posé dans la scène par une position et un quaternion.

export const MATERIALS = [
  { id: 'carton-gris', name: 'Carton gris', thickness: 2, color: '#a39c90' },
  { id: 'carton-plume', name: 'Carton plume', thickness: 5, color: '#f4f3ef' },
  { id: 'bristol', name: 'Bristol', thickness: 0.5, color: '#ece3cf' },
]

export const THICKNESSES = [1, 1.5, 2, 3, 5] // valeurs courantes, CdC § 6.3

// Pièce posée à plat : un quart de tour autour de X amène son épaisseur (Z local) vers le haut.
export const FLAT = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2]

export function createDocument() {
  return { version: 1, units: 'mm', parts: [] }
}

export function materialById(id) {
  return MATERIALS.find(m => m.id === id) ?? MATERIALS[0]
}

export function rectangle(width, height) {
  return [[0, 0], [width, 0], [width, height], [0, height]]
}

// Largeur et hauteur d'un contour issu de rectangle(), sinon null (polygone libre).
export function rectSize(points) {
  const [a, b, c, d] = points
  return points.length === 4 && a[0] === 0 && a[1] === 0 && b[1] === 0 && c[0] === b[0] && d[0] === 0 && d[1] === c[1]
    ? { width: b[0], height: c[1] }
    : null
}

// `base N` avec le plus petit N ≥ start encore libre.
export function nextName(base, names, start = 1) {
  for (let n = start; ; n++) if (!names.includes(`${base} ${n}`)) return `${base} ${n}`
}

// Nouvelle pièce, pas encore ajoutée au document. Ses identifiants ne resservent jamais.
export function createPart(doc, { points, thickness, materialId }) {
  const n = doc.parts.reduce((max, p) => Math.max(max, Number(p.id.slice(5))), 0) + 1
  return {
    id: `part-${n}`,
    name: nextName('Pièce', doc.parts.map(p => p.name)),
    points: points.map(p => [...p]),
    thickness,
    materialId,
    position: [0, 0, 0],
    quaternion: [...FLAT],
    hidden: false,
  }
}

// Copie (CdC § 15) : même forme, épaisseur, matériau et orientation ; nouvel identifiant, nom
// numéroté (« Mur » donne « Mur 2 », « Mur 2 » donne « Mur 3 »).
export function duplicatePart(doc, part) {
  const copy = createPart(doc, part)
  copy.name = nextName(part.name.replace(/ \d+$/, ''), doc.parts.map(p => p.name), 2)
  copy.quaternion = [...part.quaternion]
  return copy
}
