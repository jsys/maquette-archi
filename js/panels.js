// Panneaux HTML : nouvelle plaque (CdC § 6), pièce sélectionnée (§ 9, § 20), liste des pièces (§ 14).
import { MATERIALS, THICKNESSES, materialById, rectSize, rectangle } from './model.js'

const fr = n => n.toLocaleString('fr-FR')

const EYE = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1 8s2.6-5 7-5 7 5 7 5-2.6 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>'
const EYE_OFF = EYE.replace('</svg>', '<path d="M2.5 13.5 13.5 2.5" stroke="currentColor" stroke-width="1.3"/></svg>')

export function createPanels(actions) {
  setupNewPlate(actions.create)
  const renderSelection = setupSelection(actions)
  const renderList = setupList(actions)
  return {
    render(doc, selectedId) {
      renderSelection(doc, selectedId)
      renderList(doc, selectedId)
    },
  }
}

// Matériau et puces d'épaisseur, communs aux deux formulaires. Choisir un matériau propose son
// épaisseur courante. Renvoie la fonction qui remet à jour la puce enfoncée.
function bindMaterialAndThickness(form, onChange = () => {}) {
  const chips = form.querySelector('.choix')
  for (const m of MATERIALS) form.materiau.add(new Option(m.name, m.id))
  for (const t of THICKNESSES) {
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.value = t
    chip.textContent = fr(t)
    chips.append(chip)
  }
  const mark = () => {
    for (const chip of chips.children) chip.setAttribute('aria-pressed', Number(chip.value) === form.epaisseur.valueAsNumber)
  }
  chips.addEventListener('click', e => {
    if (e.target.value === undefined) return
    form.epaisseur.value = e.target.value
    mark()
    onChange()
  })
  form.epaisseur.addEventListener('input', mark)
  form.epaisseur.addEventListener('change', onChange)
  form.materiau.addEventListener('change', () => {
    form.epaisseur.value = materialById(form.materiau.value).thickness
    mark()
    onChange()
  })
  mark()
  return mark
}

function setupNewPlate(create) {
  const form = document.getElementById('nouvelle-plaque')
  bindMaterialAndThickness(form)
  form.addEventListener('submit', e => {
    e.preventDefault()
    create({
      points: rectangle(form.largeur.valueAsNumber, form.hauteur.valueAsNumber),
      thickness: form.epaisseur.valueAsNumber,
      materialId: form.materiau.value,
    })
  })
}

// Panneau de la pièce sélectionnée : nom, cotes du rectangle, matériau, épaisseur, actions.
// Un champ en cours de saisie n'est jamais réécrit.
function setupSelection(actions) {
  const form = document.getElementById('selection')
  let part = null
  const set = (input, value) => { if (input !== document.activeElement) input.value = value }

  const mark = bindMaterialAndThickness(form, () => {
    if (form.epaisseur.valueAsNumber > 0) actions.update(part.id, { materialId: form.materiau.value, thickness: form.epaisseur.valueAsNumber })
    else form.epaisseur.value = part.thickness
  })
  form.addEventListener('submit', e => e.preventDefault())
  form.nom.addEventListener('input', () => actions.update(part.id, { name: form.nom.value }))
  for (const input of [form.largeur, form.hauteur]) {
    input.addEventListener('change', () => {
      const width = form.largeur.valueAsNumber, height = form.hauteur.valueAsNumber
      if (width > 0 && height > 0) return actions.update(part.id, { points: rectangle(width, height) })
      const rect = rectSize(part.points)
      form.largeur.value = rect.width
      form.hauteur.value = rect.height
    })
  }
  form.querySelector('[data-action="dupliquer"]').addEventListener('click', () => actions.duplicate(part.id))
  form.querySelector('[data-action="supprimer"]').addEventListener('click', () => actions.remove(part.id))

  return function render(doc, selectedId) {
    part = doc.parts.find(p => p.id === selectedId) ?? null
    form.hidden = !part
    if (!part) return
    const rect = rectSize(part.points)
    set(form.nom, part.name)
    set(form.largeur, rect?.width ?? '')
    set(form.hauteur, rect?.height ?? '')
    form.largeur.disabled = form.hauteur.disabled = !rect
    set(form.materiau, part.materialId)
    set(form.epaisseur, part.thickness)
    mark()
  }
}

// Barre des pièces : cliquer sélectionne, l'œil masque ou affiche.
function setupList(actions) {
  const list = document.querySelector('#pieces ul')
  list.addEventListener('click', e => {
    const item = e.target.closest('li[data-id]')
    if (!item) return
    if (e.target.closest('.oeil')) actions.toggleHidden(item.dataset.id)
    else actions.select(item.dataset.id)
  })

  return function render(doc, selectedId) {
    if (!doc.parts.length) {
      list.innerHTML = '<li class="vide">Aucune pièce : créez une plaque.</li>'
      return
    }
    list.replaceChildren(...doc.parts.map(part => {
      const item = document.createElement('li')
      item.dataset.id = part.id
      item.classList.toggle('choisie', part.id === selectedId)
      item.classList.toggle('masquee', part.hidden)
      item.innerHTML = `<button type="button" class="nom"></button>`
        + `<button type="button" class="oeil" title="${part.hidden ? 'Afficher' : 'Masquer'}">${part.hidden ? EYE_OFF : EYE}</button>`
      item.firstChild.textContent = part.name || 'Sans nom'
      return item
    }))
  }
}
