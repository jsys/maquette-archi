// Scène 3D : rendu, caméra, navigation, lumières, table et grille.
// Unités : 1 unité three.js = 1 mm. Y vertical, la table est le plan Y = 0.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const TABLE = 600 // côté de la grille, en mm
const FOND = 0xf4f2ee

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // PCFSoftShadowMap n'existe plus depuis r186
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(FOND)

  // Cadrée pour une maquette de 50 à 500 mm
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000)
  camera.position.set(190, 170, 250)

  // Navigation (CdC § 8) : glisser = tourner, clic droit = déplacer, molette = zoom vers le curseur
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.zoomToCursor = true
  controls.screenSpacePanning = true
  controls.maxPolarAngle = Math.PI / 2 - 0.02 // la caméra reste au-dessus de la table
  controls.minDistance = 20
  controls.maxDistance = 5000

  // Ciel diffus, plus un soleil dont les ombres sur la table aident à juger hauteurs et contacts
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a0, 2))
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(-150, 400, 250)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -TABLE / 2, right: TABLE / 2, top: TABLE / 2, bottom: -TABLE / 2, near: 10, far: 1500 })
  scene.add(sun)

  // Table : invisible, elle ne fait que recevoir les ombres. Un rien sous la grille, contre le scintillement.
  const table = new THREE.Mesh(new THREE.PlaneGeometry(TABLE * 4, TABLE * 4), new THREE.ShadowMaterial({ opacity: 0.18 }))
  table.rotation.x = -Math.PI / 2
  table.position.y = -0.05
  table.receiveShadow = true
  scene.add(table)

  // Rendu à la demande : rien n'est dessiné tant que rien ne bouge (batterie des portables)
  let needsRender = true
  const requestRender = () => { needsRender = true }
  controls.addEventListener('change', requestRender)
  renderer.setAnimationLoop(() => {
    controls.update()
    if (!needsRender) return
    needsRender = false
    renderer.render(scene, camera)
  })

  new ResizeObserver(() => {
    const w = container.clientWidth, h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    requestRender()
  }).observe(container)

  let grid = null
  function setGrid(step) {
    if (grid) {
      scene.remove(grid)
      grid.geometry.dispose()
      grid.material.dispose()
    }
    grid = makeGrid(step)
    scene.add(grid)
    requestRender()
  }

  // Espace maintenu : le clic gauche déplace la vue au lieu de la faire tourner (CdC § 8)
  const setPan = on => {
    controls.mouseButtons.LEFT = on ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
    container.classList.toggle('pan', on)
  }
  addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.target.closest?.('input, select, textarea')) return
    e.preventDefault()
    setPan(true)
  })
  addEventListener('keyup', e => { if (e.code === 'Space') setPan(false) })
  addEventListener('blur', () => setPan(false))

  return { scene, camera, renderer, controls, requestRender, setGrid }
}

// Grille de la table : un trait fin tous les `step` mm, d'autant plus pâle que le pas est serré
// (sinon moiré), un trait marqué tous les 50 mm et sur les axes. Un seul objet : pas de
// scintillement entre deux grilles superposées.
const GRID_FINE = { 1: 0xebe8e1, 5: 0xe3dfd6, 10: 0xdcd7cd }
const GRID_MAJOR = 0xcbc4b6
const GRID_AXIS = 0xb3ab9c

function makeGrid(step) {
  const half = TABLE / 2, positions = [], colors = [], c = new THREE.Color()
  for (let i = -half; i <= half; i += step) {
    c.setHex(i === 0 ? GRID_AXIS : i % 50 === 0 ? GRID_MAJOR : GRID_FINE[step])
    positions.push(-half, 0, i, half, 0, i, i, 0, -half, i, 0, half)
    for (let k = 0; k < 4; k++) colors.push(c.r, c.g, c.b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true }))
}
