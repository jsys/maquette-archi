// Éditeur 2D de la nouvelle plaque (CdC § 6). Rectangle : aperçu coté. Polygone : un clic pose un
// point, un clic sur le premier (ou Entrée) ferme le contour, glisser un point le déplace, un
// double-clic le supprime, ⌫ retire le dernier pendant le tracé. Les points s'aimantent à la
// grille (⌘ ou Ctrl : au mm). Coordonnées en mm, Y vers le haut comme dans la pièce : le SVG,
// dont l'axe Y descend, les dessine en (x, -y).
import { contourProblem, normalizeContour } from './geometry.js'
import { rectangle } from './model.js'

const AREA = 200 // mm, côté de la zone de dessin du polygone (au-delà, la précision au clic se perd)
const PAD = 14 // mm, marge autour, pour les cotes
const CLICK_PX = 4
const fr = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })

export function createEditor2d(svg, { step, onChange }) {
  let mode = 'rectangle'
  let size = { width: 120, height: 80 }
  let points = []
  let closed = false
  let cursor = null // point aimanté sous la souris, au bout de l'élastique
  let drag = null // { index, moved, x, y }
  let closedAt = -Infinity

  const clamp = v => Math.min(AREA, Math.max(0, v))
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]

  function toMm(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse())
    const s = e.metaKey || e.ctrlKey ? 1 : step()
    return [clamp(Math.round(p.x / s) * s), clamp(Math.round(-p.y / s) * s)]
  }

  function changed() {
    render()
    onChange()
  }

  function close(e) {
    closed = true
    cursor = null
    closedAt = e.timeStamp
    changed()
  }

  svg.addEventListener('pointerdown', e => {
    if (mode !== 'polygone' || e.button !== 0) return
    svg.focus()
    const index = e.target.dataset.index
    if (index !== undefined) {
      drag = { index: Number(index), moved: false, x: e.clientX, y: e.clientY }
      return
    }
    if (closed) return
    const p = toMm(e)
    if (points.length >= 3 && same(p, points[0])) return close(e)
    if (!same(p, points.at(-1))) points.push(p)
    changed()
  })

  svg.addEventListener('pointermove', e => {
    if (mode !== 'polygone') return
    if (drag) {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) <= CLICK_PX) return
        // Capturé seulement maintenant : un simple clic ou un double-clic garde le point pour cible
        drag.moved = true
        svg.setPointerCapture(e.pointerId)
      }
      points[drag.index] = toMm(e)
      return changed()
    }
    if (closed) return
    cursor = toMm(e)
    render()
  })

  svg.addEventListener('pointerup', e => {
    if (!drag) return
    const { index, moved } = drag
    drag = null
    if (!moved && index === 0 && !closed && points.length >= 3) close(e)
  })

  svg.addEventListener('pointerleave', () => {
    if (!cursor) return
    cursor = null
    render()
  })

  // Le double-clic qui vient de fermer le contour sur le premier point ne le supprime pas
  svg.addEventListener('dblclick', e => {
    const index = e.target.dataset.index
    if (index === undefined || e.timeStamp - closedAt < 500 || (closed && points.length <= 3)) return
    points.splice(Number(index), 1)
    changed()
  })

  svg.addEventListener('keydown', e => {
    if (mode !== 'polygone' || closed) return
    if (e.key === 'Enter' && points.length >= 3) close(e)
    else if ((e.key === 'Backspace' || e.key === 'Delete') && points.length) {
      points.pop()
      changed()
    } else return
    e.preventDefault()
  })

  function render() {
    if (mode === 'rectangle') return renderRectangle()
    svg.setAttribute('viewBox', `${-PAD} ${-AREA - PAD} ${AREA + 2 * PAD} ${AREA + 2 * PAD}`)
    let html = grid()
    if (points.length) {
      const trail = closed ? [...points, points[0]] : cursor ? [...points, cursor] : points
      html += closed
        ? `<polygon class="forme" points="${points.map(svgXY).join(' ')}"/>`
        : `<polyline class="trace" points="${trail.map(svgXY).join(' ')}"/>`
      if (!closed && cursor && points.length >= 2) html += `<line class="fermeture" ${line(cursor, points[0])}/>`
      html += trail.slice(1).map((p, i) => lengthLabel(trail[i], p, 9)).join('')
      html += points.map((p, i) => `<circle class="point${i === 0 && !closed ? ' premier' : ''}" data-index="${i}" cx="${p[0]}" cy="${-p[1]}" r="5"/>`).join('')
    }
    svg.innerHTML = html
  }

  function renderRectangle() {
    const { width: w, height: h } = size
    const m = Math.max(w, h) * 0.2 + 4
    const fontSize = (Math.max(w, h) + 2 * m) * 0.045
    svg.setAttribute('viewBox', `${-m} ${-h - m} ${w + 2 * m} ${h + 2 * m}`)
    svg.innerHTML = `<rect class="forme" x="0" y="${-h}" width="${w}" height="${h}"/>`
      + text(`${fr(w)} mm`, w / 2, m / 2, fontSize)
      + text(`${fr(h)} mm`, -m / 2, -h / 2, fontSize, -90)
  }

  function status() {
    if (mode === 'rectangle') return null
    if (!points.length) return 'Cliquez dans la grille pour poser les points du contour.'
    if (!closed) return points.length < 3 ? 'Il faut au moins trois points.' : 'Cliquez sur le premier point (ou Entrée) pour fermer le contour.'
    return contourProblem(points) ?? 'Glissez un point pour le déplacer, double-cliquez pour le supprimer.'
  }

  render()
  return {
    status,
    // Contour prêt à extruder, ou null
    contour() {
      if (mode === 'rectangle') return rectangle(size.width, size.height)
      return closed && !contourProblem(points) ? normalizeContour(points) : null
    },
    setMode(value) {
      mode = value
      cursor = null
      changed()
    },
    setSize(width, height) {
      size = { width, height }
      if (mode === 'rectangle') render()
    },
    clear() {
      points = []
      closed = false
      cursor = null
      changed()
    },
  }
}

const svgXY = ([x, y]) => `${x},${-y}`
const line = (a, b) => `x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}"`

function grid() {
  let minor = '', major = ''
  for (let v = 0; v <= AREA; v += 10) {
    const d = `M${v} 0V${-AREA}M0 ${-v}H${AREA}`
    if (v % 50) minor += d
    else major += d
  }
  return `<path class="grille" d="${minor}"/><path class="grille majeure" d="${major}"/>`
}

function text(content, x, y, fontSize, angle = 0) {
  return `<text class="cote" x="${x}" y="${y}" font-size="${fontSize}" transform="rotate(${angle} ${x} ${y})">${content}</text>`
}

function lengthLabel(a, b, fontSize) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  return length ? text(fr(length), (a[0] + b[0]) / 2, -(a[1] + b[1]) / 2, fontSize) : ''
}
