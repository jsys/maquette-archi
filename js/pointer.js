// Survol et clic sur les pièces. Un clic, c'est appuyer et relâcher à moins de 4 px : au-delà, le
// geste appartient à la caméra (OrbitControls).
import * as THREE from 'three'

const CLICK_PX = 4

export function createPointer({ canvas, camera, partsView, onHover, onClick }) {
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let down = null
  let hovered = null

  function pick(e) {
    const r = canvas.getBoundingClientRect()
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(partsView.pickables(), false)[0]
    return hit ? partsView.idOf(hit.object) : null
  }

  function hover(id) {
    if (id === hovered) return
    hovered = id
    canvas.parentElement.classList.toggle('survol', id !== null)
    onHover(id)
  }

  canvas.addEventListener('pointermove', e => { if (!e.buttons) hover(pick(e)) })
  canvas.addEventListener('pointerleave', () => hover(null))
  canvas.addEventListener('pointerdown', e => { down = e.button === 0 ? [e.clientX, e.clientY] : null })
  canvas.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) <= CLICK_PX) onClick(pick(e))
    down = null
  })
}
