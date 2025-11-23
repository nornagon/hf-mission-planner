import ReactDOM from 'react-dom'
import React from 'react'
import { zoom } from 'd3-zoom'
import { select } from 'd3-selection'

import './index.css'
import HFMap from '../assets/hf.png'
import HF4Map from '../assets/hf4.jpg'
import { dijkstra } from './dijkstra'
import { Overlay } from './Overlay'
import { MapData } from './MapData'

/** @typedef {import('d3-zoom').ZoomTransform} ZoomTransform */

const isHF3 = location.search === '?ed=3'

const map = new Image
map.src = isHF3 ? HFMap : HF4Map
main.textContent = 'loading...'

const canvas = document.createElement('canvas')
const overlay = document.createElement('div')
overlay.setAttribute('id', 'overlay')
map.onload = () => {
  main.textContent = ''
  main.appendChild(map)
  canvas.width = map.width
  canvas.height = map.height
  main.appendChild(canvas)
  document.body.appendChild(overlay)
  const margin = 0.25
  const z = zoom()
    .scaleExtent([0.2, 1.5])
    .translateExtent([[map.width*-margin,map.height*-margin],[map.width*(1+margin),map.height*(1+margin)]])
    .filter(e => {
      // Filter out events with #overlay as an ancestor
      let el = e.target
      while (el) {
        if (el.id === "overlay") return false
        el = el.parentElement
      }
      return !e.ctrlKey && !e.button
    })
    .on("zoom", e => zoomed(e.transform))
  select(document.documentElement).call(z).call(z.translateTo, 0.85 * canvas.width, 0.80 * canvas.height)
  draw()
}

/** @param {ZoomTransform} param0 */
function zoomed({x, y, k}) {
  main.style.transform = `translate(${x}px,${y}px) scale(${k})`
  main.style.transformOrigin = '0 0'
}

let editing = false
let mapData = new MapData
/** @type {string|null} */
let connecting = null
/** @type {PathNode[]|null} */
let highlightedPath = null
let venusFlybyAvailable = false
/** @type {string|null} */
let pathOrigin = null
/** @type {PathData|null} */
let pathData = null

/** @param {MapDataJSON} json */
const loadData = (json) => {
  mapData = MapData.fromJSON(json)
  setTimeout(draw, 0)
}

if ('data' in localStorage) {
  loadData(/** @type {MapDataJSON} */ (JSON.parse(localStorage.data)))
} else if (location.protocol !== 'file:') {
  if (isHF3) {
    import('../assets/data.json').then(({default: data}) => loadData(/** @type {MapDataJSON} */ (data)))
  } else {
    import('../assets/data-hf4.json').then(({default: data}) => loadData(/** @type {MapDataJSON} */ (data)))
  }
}

function changed() {
  localStorage.data = JSON.stringify(mapData.toJSON())
}

function downloadFormattedJSON() {
  const formatted = JSON.stringify(mapData.toJSON(), null, 2) + '\n'
  const blob = new Blob([formatted], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = isHF3 ? 'hf3-map-data.json' : 'hf4-map-data.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** @param {MouseEvent} e */
canvas.onclick = e => {
  if (editing) {
    const x = e.offsetX
    const y = e.offsetY
    const xPct = x / canvas.width
    const yPct = y / canvas.height
    const pointId = Math.random().toString()
    mapData.addPoint(pointId, {
      x: xPct,
      y: yPct,
      type: 'hohmann',
    })
    draw()
  } else {
    const closestId = nearestPoint(mousePos.x, mousePos.y, id => mapData.points[id].type !== 'decorative')
    if (!closestId) { return }

    if (canPath(closestId)) {
      highlightedPath = drawPath(pathData, pathOrigin, closestId)
      endPathing()
    } else {
      beginPathing(closestId)
    }

    draw()
  }
}

/** @param {string} originId */
function beginPathing(originId) {
  pathOrigin = originId
  pathData = findPath(originId)
}

/** @param {string|null|undefined} closestId */
function canPath(closestId) {
  return closestId && pathOrigin && closestId !== pathOrigin
}

function endPathing() {
  pathOrigin = null
  pathData = null
}

function refreshPath() {
  if (pathOrigin && pathData) {
    const closestId = nearestPoint(mousePos.x, mousePos.y, id => mapData.points[id].type !== 'decorative')

    if (canPath(closestId)) {
      highlightedPath = drawPath(pathData, pathOrigin, closestId)
    }
  }
}

/** @type {Vec2} */
const mousePos = {x: 0, y: 0} // pct
/** @param {MouseEvent} e */
canvas.onmousemove = e => {
  mousePos.x = e.offsetX / canvas.width
  mousePos.y = e.offsetY / canvas.height

  refreshPath()
  draw()
}

/**
 * @param {number} testX
 * @param {number} testY
 * @param {(id: string) => boolean} [filter]
 * @returns {string|undefined}
 */
function nearestPoint(testX, testY, filter = undefined) {
  let closest = null
  let dist = Infinity
  for (const pId in mapData.points) {
    if (filter && !filter(pId)) continue
    const {x, y} = mapData.points[pId]
    const dx = x - testX
    const dy = y - testY
    const testDist = Math.sqrt(dx*dx + dy*dy)
    if (testDist < dist) {
      closest = pId
      dist = testDist
    }
  }
  if (dist < 0.02)
    return closest
}

/** @param {number} a */
function clipToPi(a) {
  if (a < -Math.PI)
    return a + Math.PI * 2 * Math.abs(Math.floor((a + Math.PI) / (Math.PI * 2)))
  else if (a > Math.PI)
    return a - Math.PI * 2 * Math.abs(Math.ceil(((a - Math.PI) / (Math.PI * 2))))
  else
    return a
}

/** @param {number} testX @param {number} testY @returns {[string, string]|undefined} */
function nearestEdge(testX, testY) {
  const npId = nearestPoint(testX, testY)
  if (!npId) return
  const np = mapData.points[npId]
  const ns = mapData.neighborsOf(npId)
  const mdx = testX - np.x
  const mdy = testY - np.y
  const mouseAngle = Math.atan2(mdy, mdx)
  let minD = Infinity
  /** @type {[string, string]|null} */
  let closestEdge = null
  ns.forEach(otherEndId => {
    const otherEnd = mapData.points[otherEndId]
    const dy = otherEnd.y - np.y
    const dx = otherEnd.x - np.x
    const angle = Math.atan2(dy, dx)
    const dAngle = clipToPi(mouseAngle - angle)
    if (Math.abs(dAngle) < minD) {
      minD = Math.abs(dAngle)
      closestEdge = [npId, otherEndId]
    }
  })
  if (minD < Math.PI / 4 && closestEdge) {
    return closestEdge.sort()
  }
}

/** @param {KeyboardEvent} e */
window.onkeydown = e => {
  if (e.code === 'Escape') {
    connecting = null
    pathOrigin = null
    highlightedPath = null
  }
  if (editing) {
    if (e.code === 'KeyA') { // Add edge
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (connecting) {
        if (closestId && closestId !== connecting) {
          if (mapData.hasEdge(closestId, connecting))
            mapData.deleteEdge(closestId, connecting)
          else
            mapData.addEdge(closestId, connecting)
          changed()
          connecting = null
        }
      } else {
        if (closestId) connecting = closestId
      }
    }
    if (e.code === 'KeyM') { // Move point
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].x = mousePos.x
        mapData.points[closestId].y = mousePos.y
        changed()
      }
    }
    if (e.code === 'KeyX') { // Delete point
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.deletePoint(closestId)
        changed()
      }
    }
    if (e.code === 'KeyH') { // Set point type to hohmann
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'hohmann'
        changed()
      }
    }
    if (e.code === 'KeyL') { // Set point type to lagrange
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'lagrange'
        changed()
      }
    }
    if (e.code === 'KeyB') { // Set point type to burn / cycle through burn types
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        const p = mapData.points[closestId]
        if (p.type === 'burn') {
          if (p.landing == null) {
            p.landing = 1
          } else if (p.landing === 1) {
            p.landing = 0.5
          } else {
            delete p.landing
          }
        } else {
          p.type = 'burn'
        }
        changed()
      }
    }
    if (e.code === 'KeyD') { // Set point type to decorative
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'decorative'
        changed()
      }
    }
    if (e.code === 'KeyR') { // Set point type to radhaz
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'radhaz'
        changed()
      }
    }
    if (e.code === 'KeyZ') { // Toggle hazard
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].hazard = !mapData.points[closestId].hazard
        changed()
      }
    }
    if (e.code === 'KeyY') { // Set point type to flyby / cycle boost size
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'flyby'
        mapData.points[closestId].flybyBoost = ((mapData.points[closestId].flybyBoost || 0) % 4) + 1
        changed()
      }
    }
    if (e.code === 'KeyV') { // Set point type to be venus
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        mapData.points[closestId].type = 'venus'
        mapData.points[closestId].flybyBoost = ((mapData.points[closestId].flybyBoost || 0) % 4) + 1
        changed()
      }
    }
    if (e.code === 'KeyS') { // Set point type to site
      const closestId = nearestPoint(mousePos.x, mousePos.y)
      if (closestId) {
        const p = mapData.points[closestId]
        p.type = 'site'
        const name = prompt("Site name", p.siteName)
        const size = prompt("Site size + type", p.siteSize)
        const water = prompt("Site water", p.siteWater != null ? String(p.siteWater) : '')
        if (name !== null) p.siteName = name
        if (size !== null) p.siteSize = size
        if (water !== null) {
          const parsed = Number(water)
          if (Number.isFinite(parsed)) {
            p.siteWater = parsed
          }
        }
        changed()
      }
    }
    if (e.code.startsWith('Digit')) { // Set edge label
      const label = e.code.slice(5)
      const np = nearestPoint(mousePos.x, mousePos.y)
      const ne = nearestEdge(mousePos.x, mousePos.y)
      if (np && ne) {
        const [a, b] = ne
        const other = a === np ? b : a
        mapData.setEdgeLabel(np, other, label)
        changed()
      }
    }
    if (e.code === 'KeyJ') { // Download formatted JSON
      downloadFormattedJSON()
      e.preventDefault()
    }
  } else {
    if (e.code === 'KeyV') {
      venusFlybyAvailable = !venusFlybyAvailable
      if (pathData) {
        beginPathing(pathOrigin)
        refreshPath()
        draw()
      }
    }
  }

  if (e.code === 'Tab') { // Toggle edit mode
    editing = !editing
    e.preventDefault()
  }

  draw()
}

/**
 * @param {PathNode} u
 * @param {PathNode} v
 * @param {(node: PathNode) => string} id
 * @param {Record<string, PathNode>} previous
 * @returns {boolean}
 */
function allowed(u, v, id, previous) {
  const {node: uId} = u
  const {node: vId} = v
  if (uId === vId) return true
  if ((id(u) in previous) && mapData.points[u.node].type === 'site') {
    // Once you enter a site, your turn ends.
    return false
  }
  // Find the last node we were in.
  let n = u
  let p
  while (p = previous[id(n)]) {
    if (p.node !== uId) break
    n = p
  }
  // If the last node we entered is the same as where we just came from, this
  // transition is forbidden. (H4e. No U-Turns)
  return !p || p.node !== vId
}

/** @param {PathNode} p @returns {PathNode[]} */
function getNeighbors(p) {
  const {node, dir, bonus} = p
  const ns = []
  const { edgeLabels, points } = mapData
  if (edgeLabels[node]) {
    Object.keys(edgeLabels[node]).forEach(otherNode => {
      if (edgeLabels[node][otherNode] !== dir) {
        const directionChangeCost = edgeLabels[node][otherNode] === '0' ? 0 : 2
        const bonusAfterDirectionChangeBurn = Math.max(bonus - directionChangeCost, 0)
        ns.push({node, dir: edgeLabels[node][otherNode], bonus: bonusAfterDirectionChangeBurn})
      }
    })
  }
  if (bonus > 0 || dir != null) {
    // you can always throw away your extra burns if you want.
    // this also allows the path finder to not have to search for the
    // destination node at different amounts of bonus.
    ns.push({node, dir: null, bonus: 0})
  }
  mapData.neighborsOf(node).forEach(other => {
    if (edgeLabels[other] && edgeLabels[other][node] === '0') {
      return
    }
    if (!(node in edgeLabels) || !(other in edgeLabels[node]) || edgeLabels[node][other] === dir) {
      const dir = edgeLabels[other] && edgeLabels[other][node] ? edgeLabels[other][node] : null
      const entryCost = points[other].type === 'burn' ? 1 : 0
      const flybyBoost = points[other].type === 'flyby' || (points[other].type === 'venus' && venusFlybyAvailable) ? points[other].flybyBoost : 0
      const bonusAfterEntry = Math.max(bonus - entryCost + flybyBoost, 0)
      ns.push({node: other, dir, bonus: bonusAfterEntry})
    }
  })
  return ns
}

const ints = {
  /** @type {number} */ zero: 0,
  /** @type {(a: number, b: number) => number} */ add: (a, b) => a + b,
  /** @type {(a: number, b: number) => boolean} */ lessThan: (a, b) => a < b
}

/** @type {{zero: number[], add: (a: number[], b: number[]) => number[], lessThan: (a: number[], b: number[]) => boolean}} */
const tupleNs = {
  zero: [],
  add: (a, b) => {
    const n = Math.max(a.length, b.length)
    const r = []
    for (let i = 0; i < n; i++) {
      r[i] = (a[i] ?? 0) + (b[i] ?? 0)
    }
    return r
  },
  lessThan: (a, b) => {
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const ai = a[i] ?? 0
      const bi = b[i] ?? 0
      if (ai !== bi) return ai < bi
    }
    return false
  }
}

/** @param {PathNode} u @param {PathNode} v */
function burnWeight(u, v) {
  const {node: uId, dir: uDir, bonus} = u
  const {node: vId, dir: vDir} = v
  const { points } = mapData
  if (points[vId].type === 'burn') {
    return bonus > 0 && !points[vId].landing ? 0 : 1
  } else if (points[vId].type === 'hohmann') {
    return uId === vId && uDir != null && vDir != null && uDir !== vDir ? Math.max(0, 2 - bonus) : 0;
  } else if (points[vId].type === 'flyby' || points[vId].type === 'venus') {
    return 0
  } else {
    return 0
  }
}

/** @param {PathNode} u @param {PathNode} v */
function turnWeight(u, v) {
  const {node: uId, dir: uDir} = u
  const {node: vId, dir: vDir} = v
  const { points } = mapData
  if (points[vId].type === 'hohmann') {
    if (uId === vId && uDir != null && vDir == null) return 1
    return 0
  }
  return 0
}

/** @param {PathNode} u @param {PathNode} v */
function hazardWeight(u, v) {
  const { node: uId } = u
  const { node: vId } = v
  if (uId === vId) return 0
  const { points } = mapData
  if (points[vId].hazard)
    return 1
  return 0
}

/** @param {PathNode} u @param {PathNode} v */
function radHazardWeight(u, v) {
  const { node: uId } = u
  const { node: vId } = v
  if (uId === vId) return 0
  const { points } = mapData
  if (points[vId].type === 'radhaz') {
    return 1
  }
  return 0
}

/** @param {PathNode} u @param {PathNode} v @returns {number[]} */
function nodeWeight(u, v) {
  const burns = burnWeight(u, v)
  const turns = turnWeight(u, v) // Assuming infinite thrust and no waiting...
  const hazards = hazardWeight(u, v)
  const radHazards = radHazardWeight(u, v)
  return [burns, turns, hazards, radHazards, 1]
}

/** @param {PathNode} p */
function pathId(p) {
  return p.dir != null || p.bonus ? `${p.node}@${p.dir}@${p.bonus}` : p.node
}

/** @param {string} fromId */
function findPath(fromId) {
  // NB for pathfinding along Hohmanns each
  // hohmann is kind of like two nodes, one for
  // each direction. Moving into either node is
  // free, but switching from one to the other
  // costs 2 burns (or a turn).
  //  .
  //   `-.         ,-'
  //      `-O.  ,-'
  //      2 | `-.
  //       ,O'   `-.
  //    ,-'         `-
  // .-'
  // point: {node: string; dir: string?, id: string}
  console.time('calculating paths')

  const source = /** @type {PathNode} */ ({node: fromId, dir: null, bonus: 0})
  const pathData = dijkstra(getNeighbors, nodeWeight, tupleNs, pathId, source, allowed)

  console.timeEnd('calculating paths')

  return pathData
}

/**
 * @param {PathData} param0
 * @param {string} fromId
 * @param {string} toId
 * @returns {PathNode[]|undefined}
 */
function drawPath({ distance, previous }, fromId, toId) {
  const source = /** @type {PathNode} */ ({node: fromId, dir: null, bonus: 0})

  let shorterTo = /** @type {PathNode} */ ({node: toId, dir: null, bonus: 0})
  let shorterToId = pathId(shorterTo)

  if (shorterToId in distance) {
    const path = [shorterTo]
    let cur = shorterTo
    while (pathId(cur) !== pathId(source)) {
      const n = previous[pathId(cur)]
      path.unshift(n)
      cur = n
    }

    return path
  }
}

/** @param {PathNode[]|null|undefined} path @returns {number[]} */
function pathWeight(path) {
  let weight = tupleNs.zero
  if (path) {
    for (let i = 1; i < path.length; i++) {
      weight = tupleNs.add(weight, nodeWeight(path[i-1], path[i]))
    }
  }
  return weight
}

let isru = 0
/** @param {number} e */
function setIsru(e) {
  isru = e
  draw()
}

function draw() {
  if (!mapData) return
  const { points, edges, edgeLabels } = mapData
  const ctx = canvas.getContext('2d')
  const {width, height} = ctx.canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 2
  const nearestToCursor = nearestPoint(mousePos.x, mousePos.y)
  if (editing) {
    const ce = nearestEdge(mousePos.x, mousePos.y)
    edges.forEach(e => {
      const [a, b] = e.split(":")
      const pa = points[a]
      const pb = points[b]
      if (ce && ce[0] === a && ce[1] === b) {
        ctx.strokeStyle = 'lightgreen'
      } else {
        ctx.strokeStyle = 'white'
      }
      ctx.beginPath()
      ctx.moveTo(pa.x * width, pa.y * height)
      ctx.lineTo(pb.x * width, pb.y * height)
      ctx.stroke()
    })
    for (let pId in points) {
      const p = points[pId]
      ctx.fillStyle = 'transparent'
      ctx.strokeStyle = 'white'
      if (p.type === 'hohmann') {
        ctx.fillStyle = 'green'
      } else if (p.type === 'lagrange' || p.type === 'flyby') {
        ctx.fillStyle = 'transparent'
        ctx.strokeStyle = '#c66932'
        if (p.hazard) {
          ctx.fillStyle = '#d5cde5'
        }
      } else if (p.type === 'radhaz') {
        ctx.fillStyle = 'yellow'
      } else if (p.type === 'venus') {
        ctx.fillStyle = 'orange'
      } else if (p.type === 'site') {
        ctx.fillStyle = 'black'
      } else if (p.type === 'burn') {
        ctx.fillStyle = '#d60f7a'
      } else {
        ctx.fillStyle = 'cornflowerblue'
      }
      if (nearestToCursor === pId) {
        ctx.fillStyle = 'red'
      }
      const r = p.type === 'decorative' ? 3 : 10
      ctx.beginPath()
      if (p.type === 'site') {
        ctx.save()
        ctx.translate(p.x * width, p.y * height)
        const siteR = 15
        ctx.moveTo(siteR, 0)
        for (let t = 1; t < Math.PI*2; t += Math.PI*2/6) {
          ctx.lineTo(Math.cos(t) * siteR, Math.sin(t) * siteR)
        }
        ctx.closePath()
        ctx.restore()
      } else if (p.type === 'burn' && p.landing) {
        ctx.rect(p.x * width - r, p.y * height - r, r * 2 * p.landing, r * 2)
      } else {
        ctx.arc(p.x * width, p.y * height, r, 0, Math.PI*2)
      }
      ctx.fill()
      ctx.stroke()
      if (p.hazard) {
        ctx.save()
        ctx.fillStyle = p.type === 'burn' ? 'white' : 'black'
        ctx.font = '22px menlo'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('☠︎', p.x * width, p.y * height)
        ctx.restore()
      }
      if (p.type === 'flyby' || p.type === 'venus') {
        ctx.save()
        ctx.fillStyle = 'white'
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.shadowColor = 'black'
        ctx.font = '14px helvetica'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(`+${p.flybyBoost}`, p.x * width, p.y * height)
        ctx.restore()
      }
      if (p.type === 'site') {
        ctx.save()
        ctx.fillStyle = 'white'
        ctx.font = '12px helvetica'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(`${p.siteSize}`, p.x * width, p.y * height - 6)
        ctx.fillText(`${p.siteWater}`, p.x * width, p.y * height + 6)
        ctx.restore()
      }

      ctx.save()
      ctx.fillStyle = 'white'
      ctx.shadowOffsetX = 1
      ctx.shadowOffsetY = 1
      ctx.shadowColor = 'black'
      ctx.font = '12px helvetica'
      for (let otherId in (edgeLabels[pId] || {})) {
        const otherPoint = points[otherId]
        const label = edgeLabels[pId][otherId]
        const dx = (otherPoint.x - p.x) * width
        const dy = (otherPoint.y - p.y) * height
        const d = Math.sqrt(dx * dx + dy * dy)
        const nx = dx / d
        const ny = dy / d
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        const displacement = 12
        ctx.fillText(label, p.x * width + nx * displacement, p.y * height + ny * displacement)
      }
      ctx.restore()
    }
  } else {
    for (let pId in points) {
      const p = points[pId]
      if (p.type === 'venus') {
        if (!venusFlybyAvailable) {
          ctx.save()
          ctx.lineWidth = 8
          ctx.strokeStyle = "red"
          ctx.lineCap = "round"
          ctx.beginPath()
          const r = 15
          ctx.moveTo(p.x * width - r, p.y * height - r)
          ctx.lineTo(p.x * width + r, p.y * height + r)
          ctx.moveTo(p.x * width + r, p.y * height - r)
          ctx.lineTo(p.x * width - r, p.y * height + r)
          ctx.stroke()
          ctx.restore()
        }
        ctx.save()
        ctx.font = 'italic bold 14px helvetica'
        ctx.fillStyle = 'white'
        ctx.shadowColor = 'black'
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
        ctx.textBaseline = 'bottom'
        ctx.textAlign = 'center'
        ctx.fillText(`Press [V] to toggle`, p.x * width, p.y * height - 25)
        ctx.restore()
      }
    }
    const nearest = nearestPoint(mousePos.x, mousePos.y, id => points[id].type !== 'decorative')
    if (nearest != null) {
      const p = points[nearest]
      ctx.save()
      ctx.strokeStyle = "yellow"
      ctx.lineWidth = 4
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 15, 0, 2*Math.PI)
      ctx.stroke()
      ctx.restore()
    }
    if (pathOrigin != null) {
      const p = points[pathOrigin]
      ctx.save()
      ctx.strokeStyle = "red"
      ctx.lineWidth = 4
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.arc(p.x * width, p.y * height, 15, 0, 2*Math.PI)
      ctx.stroke()
      ctx.restore()

      for (const pId in points) {
        if (pId === pathOrigin) continue;
        const p = points[pId]
        const siteWater = Number(p.siteWater ?? 0)
        if (p.type === 'site' && siteWater >= isru) {
          ctx.save()
          ctx.font = 'bold 70px helvetica'
          ctx.shadowColor = 'black'
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
          ctx.shadowBlur = 10
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'center'
          const path = drawPath(pathData, pathOrigin, pId)
          const weight = pathWeight(path)[0] ?? 0
          const colors = [
            '#ffffb2',
            '#fecc5c',
            '#fd8d3c',
            '#f03b20',
            '#bd0026',
          ]
          ctx.fillStyle = colors[Math.min(colors.length - 1, weight)]
          ctx.fillText(String(weight), p.x * width, p.y * height)
          ctx.restore()
        }
      }
    }
  }
  if (highlightedPath) {
    ctx.save()
    const highlightedLineWidth = 20
    ctx.lineWidth = highlightedLineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(214,15,122,0.7)'
    const p0 = mapData.points[highlightedPath[0].node]
    ctx.beginPath()
    ctx.moveTo(p0.x * width, p0.y * height)
    for (let p of highlightedPath.slice(1)) {
      const point = mapData.points[p.node]
      ctx.lineTo(point.x * width, point.y * height)
    }
    ctx.stroke()
    ctx.restore()
    ctx.save()
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'
    for (let i = 1; i < highlightedPath.length - 1; i++) {
      const p = highlightedPath[i]
      const next = highlightedPath[i + 1]
      if (turnWeight(p, next) > 0) {
        const { node: prevId } = highlightedPath[i - 1]
        const { node: pId } = p
        const nextDifferentNode = highlightedPath.slice(i + 1).find(p => p.node !== pId)
        if (!nextDifferentNode) continue
        const nextP = mapData.points[nextDifferentNode.node]
        const prevP = mapData.points[prevId]
        const currP = mapData.points[pId]
        const marker = pauseMarkerSpan(prevP, currP, nextP, highlightedLineWidth, width, height)
        if (!marker) continue
        const { dir, pos, neg } = marker
        ctx.beginPath()
        ctx.moveTo(currP.x * width - dir.x * neg, currP.y * height - dir.y * neg)
        ctx.lineTo(currP.x * width + dir.x * pos, currP.y * height + dir.y * pos)
        ctx.stroke()
      }
    }
    ctx.restore()
  }
  const weight = pathWeight(highlightedPath)
  ReactDOM.render(React.createElement(Overlay, {path: highlightedPath, weight, isru, setIsru}), overlay)
}

/**
 * @param {MapPoint} prev
 * @param {MapPoint} curr
 * @param {MapPoint} next
 * @param {number} lineWidth
 * @param {number} width
 * @param {number} height
 * @returns {{dir: Vec2, pos: number, neg: number}|null}
 */
function pauseMarkerSpan(prev, curr, next, lineWidth, width, height) {
  /** @param {{x: number, y: number}} param0 */
  const toCanvas = ({ x, y }) => ({ x: x * width, y: y * height })
  const a = toCanvas(prev)
  const b = toCanvas(curr)
  const c = toCanvas(next)

  const vIn = { x: b.x - a.x, y: b.y - a.y }
  const vOut = { x: c.x - b.x, y: c.y - b.y }
  const normIn = Math.hypot(vIn.x, vIn.y)
  const normOut = Math.hypot(vOut.x, vOut.y)
  if (normIn === 0 || normOut === 0) return null

  const uIn = { x: vIn.x / normIn, y: vIn.y / normIn }
  const uOut = { x: vOut.x / normOut, y: vOut.y / normOut }

  const bisectorDir = { x: uIn.x + uOut.x, y: uIn.y + uOut.y }
  const bisectorLen = Math.hypot(bisectorDir.x, bisectorDir.y)
  const dir = bisectorLen === 0
    ? { x: -uIn.y, y: uIn.x }
    : { x: -bisectorDir.y / bisectorLen, y: bisectorDir.x / bisectorLen }

  const radius = lineWidth / 2

  /** @param {Vec2} p @param {Vec2} s0 @param {Vec2} s1 */
  const distToSegment = (p, s0, s1) => {
    const vx = s1.x - s0.x
    const vy = s1.y - s0.y
    const l2 = vx * vx + vy * vy
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - s0.x) * vx + (p.y - s0.y) * vy) / l2))
    const proj = { x: s0.x + t * vx, y: s0.y + t * vy }
    return Math.hypot(p.x - proj.x, p.y - proj.y)
  }

  /** @param {number} t */
  const strokeDistance = (t) => {
    const p = { x: b.x + dir.x * t, y: b.y + dir.y * t }
    return Math.min(distToSegment(p, a, b), distToSegment(p, b, c))
  }

  /** @param {number} sign */
  const extent = (sign) => {
    const maxT = radius * 20
    /** @param {number} t */
    const inside = (t) => strokeDistance(sign * t) <= radius
    if (!inside(0)) return 0

    let t = radius
    while (inside(t) && t < maxT) {
      t *= 2
    }
    let lo = 0
    let hi = Math.min(t, maxT)
    for (let i = 0; i < 25; i++) {
      const mid = (lo + hi) / 2
      if (inside(mid)) lo = mid
      else hi = mid
    }
    return lo
  }

  const pos = extent(1)
  const neg = extent(-1)

  if (pos === 0 && neg === 0) return null
  return { dir, pos, neg }
}
