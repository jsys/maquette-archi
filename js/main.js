// Point d'entrée : monte la scène et branche l'interface sur le modèle.
import { createScene } from './scene.js'
import { createPartsView } from './parts-view.js'
import { MATERIALS, THICKNESSES, createDocument, createPart, materialById, rectangle } from './model.js'
import { placeOnTable } from './geometry.js'

const container = document.getElementById('vue3d')
let view
try {
  view = createScene(container)
} catch (e) {
  container.innerHTML = '<p class="erreur">Ce navigateur ne sait pas afficher la 3D (WebGL 2 indisponible).</p>'
  throw e
}

const doc = createDocument()
const partsView = createPartsView(view.scene)
window.maquette = { ...view, doc, partsView } // accès depuis la console, pour le débogage

function refresh() {
  partsView.sync(doc)
  view.requestRender()
}

const gridSelect = document.getElementById('grille')
view.setGrid(Number(gridSelect.value))
gridSelect.addEventListener('change', () => {
  view.setGrid(Number(gridSelect.value))
  gridSelect.blur() // rend le clavier à la scène (Espace)
})

// Panneau « Nouvelle plaque » (CdC § 6)
const form = document.getElementById('nouvelle-plaque')
const chips = document.getElementById('epaisseurs')
const fr = n => n.toLocaleString('fr-FR')

for (const m of MATERIALS) form.materiau.add(new Option(m.name, m.id))
for (const t of THICKNESSES) {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.value = t
  chip.textContent = fr(t)
  chips.append(chip)
}
const markChip = () => {
  for (const chip of chips.children) chip.setAttribute('aria-pressed', Number(chip.value) === form.epaisseur.valueAsNumber)
}
chips.addEventListener('click', e => {
  if (e.target.value === undefined) return
  form.epaisseur.value = e.target.value
  markChip()
})
form.epaisseur.addEventListener('input', markChip)
form.materiau.addEventListener('change', () => {
  form.epaisseur.value = materialById(form.materiau.value).thickness
  markChip()
})
markChip()

form.addEventListener('submit', e => {
  e.preventDefault()
  const part = createPart(doc, {
    points: rectangle(form.largeur.valueAsNumber, form.hauteur.valueAsNumber),
    thickness: form.epaisseur.valueAsNumber,
    materialId: form.materiau.value,
  })
  placeOnTable(part, doc.parts, view.controls.target)
  doc.parts.push(part)
  refresh()
})
