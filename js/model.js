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

// Nouvelle pièce, pas encore ajoutée au document. Ses numéros ne resservent jamais.
export function createPart(doc, { points, thickness, materialId }) {
  const n = doc.parts.reduce((max, p) => Math.max(max, Number(p.id.slice(5))), 0) + 1
  return {
    id: `part-${n}`,
    name: `Pièce ${n}`,
    points,
    thickness,
    materialId,
    position: [0, 0, 0],
    quaternion: [...FLAT],
  }
}
