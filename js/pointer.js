// Survol, clic et glisser des pièces. Un appui relâché à moins de 4 px est un clic ; au-delà, le
// geste glisse la pièce saisie (CdC § 10), ou fait tourner la caméra s'il a commencé dans le vide.
import * as THREE from 'three'
import { dragOnPlane } from './geometry.js'

const CLICK_PX = 4

export function createPointer({ canvas, camera, controls, partsView, findPart, onHover, onClick, onDragStart, onDrag, onDragEnd }) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const container = canvas.parentElement
  let hovered = null
  let press = null // appui en cours : { x, y, id, grab, start, dragging }

  function aim(e) {
    const r = canvas.getBoundingClientRect()
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
  }

  function pick(e) {
    aim(e)
    return raycaster.intersectObjects(partsView.pickables(), false)[0] ?? null
  }

  function hover(id) {
    if (id === hovered) return
    hovered = id
    container.classList.toggle('survol', id !== null)
    onHover(id)
  }

  function release() {
    press = null
    controls.enabled = true
    container.classList.remove('glisse')
  }

  // En phase de capture, sur le conteneur : on sait avant OrbitControls si l'appui saisit une
  // pièce, et on le lui retire. Espace maintenu : le clic gauche reste à la caméra.
  container.addEventListener('pointerdown', e => {
    if (e.target !== canvas || e.button !== 0) return
    const hit = controls.mouseButtons.LEFT === THREE.MOUSE.PAN ? null : pick(e)
    press = { x: e.clientX, y: e.clientY, id: hit && partsView.idOf(hit.object), grab: hit?.point, dragging: false }
    if (!hit) return
    controls.enabled = false
    canvas.setPointerCapture(e.pointerId)
  }, true)

  canvas.addEventListener('pointermove', e => {
    if (!press) {
      if (!e.buttons) hover(partsView.idOf(pick(e)?.object))
      return
    }
    if (!press.id) return
    if (!press.dragging) {
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= CLICK_PX) return
      press.dragging = true
      press.start = [...findPart(press.id).position]
      container.classList.add('glisse')
      onDragStart(press.id)
    }
    aim(e)
    const position = dragOnPlane(press.start, press.grab, raycaster.ray)
    if (position) onDrag(press.id, position, e.metaKey || e.ctrlKey) // ⌘ ou Ctrl : sans aimant
  })

  canvas.addEventListener('pointerup', e => {
    if (!press) return
    const { id, x, y, dragging } = press
    release()
    if (dragging) onDragEnd(id)
    else if (Math.hypot(e.clientX - x, e.clientY - y) <= CLICK_PX) onClick(id)
  })
  canvas.addEventListener('pointercancel', () => {
    if (press?.dragging) onDragEnd(press.id)
    release()
  })
  canvas.addEventListener('pointerleave', () => { if (!press) hover(null) })
}
