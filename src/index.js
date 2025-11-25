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
import { createPanMomentum } from './panMomentum'

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
  createPanMomentum({
    zoomBehavior: z,
    zoomTarget: document.documentElement,
    applyTransform: ({x, y, k}) => {
      main.style.transform = `translate(${x}px,${y}px) scale(${k})`
      main.style.transformOrigin = '0 0'
    },
  })
  select(document.documentElement).call(z).call(z.translateTo, 0.85 * canvas.width, 0.80 * canvas.height)
  draw()
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
  highlightedPath = null
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

function recomputeHighlightedPath() {
  const source = pathOrigin ?? highlightedPath?.[0].node
  if (source) {
    pathData = findPath(source)
    const pathDestination = highlightedPath?.[highlightedPath.length - 1].node
    if (pathDestination)
      highlightedPath = drawPath(pathData, source, pathDestination)
    draw()
  }
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
      recomputeHighlightedPath()
    }
  }

  if (e.code === 'Tab') { // Toggle edit mode
    editing = !editing
    e.preventDefault()
  }

  draw()
}

/**
 * Are you allowed to go to u from v, given the path previous?
 * @param {PathNode} u
 * @param {PathNode} v
 * @param {(node: PathNode) => string} id
 * @param {Record<string, PathNode>} previous
 * @returns {boolean}
 */
function allowed(u, v, id, previous) {
  const {node: uId} = u
  const {node: vId} = v

  /** @param {PathNode} n */
  const prev = (n) => previous[id(n)]
  
  // Changing state without moving is permitted. We trust getNeighbors to
  // prevent infinite cycles.
  if (uId === vId) return true

  if (prev(u) && mapData.points[u.node].type === 'site') {
    // Once you enter a site, your turn ends.
    return false
  }
  
  // Visiting a node we've previously left in the same direction is forbidden.

  // First, walk back in the path until we find a different node.
  let n = prev(u)
  while (n?.node === uId) {
    n = prev(n)
  }
  
  // Then, walk the whole rest of the path. If we find vId anywhere with the
  // same direction or null direction, filter it out to prevent a loop.
  while (n) {
    if (n.node === vId && (n.dir === v.dir || n.dir == null))
      return false
    n = prev(n)
  }
  return true
}

/** @param {PathNode} p @returns {PathNode[]} */
function getNeighbors(p) {
  // Done is a terminal state.
  if (p.done) return [];
  const {node, dir, bonus, burnsRemaining, wait} = p
  /** @type {PathNode[]} */
  const ns = [{node, dir: null, bonus: 0, done: true, burnsRemaining}] // Ending the turn is always valid. TODO: not on a lander burn!
  const { edgeLabels, points } = mapData
  if (edgeLabels[node] && dir != null && !wait) {
    for (const otherNode of Object.keys(edgeLabels[node])) {
      if (edgeLabels[node][otherNode] !== dir) {
        // Burn through a Hohmann.
        const directionChangeCost = edgeLabels[node][otherNode] === '0' ? 0 : 2
        const bonusAfterHohmann = Math.max(bonus - directionChangeCost, 0)
        const bonusBurnsUsed = bonus - bonusAfterHohmann
        const burnsRemainingAfterHohmann = burnsRemaining - directionChangeCost + bonusBurnsUsed
        const otherNodeType = points[otherNode].type
        const newDir = otherNodeType === 'hohmann' || otherNodeType === 'decorative' ? edgeLabels[node][otherNode] : null
        ns.push({node: otherNode, dir: newDir, bonus: bonusAfterHohmann, burnsRemaining: burnsRemainingAfterHohmann})
      }
    }
  }
  if (!wait && (points[node].type === 'hohmann' || ((points[node].type === 'burn' || points[node].type === 'lagrange') && burnsRemaining === 0))) {
    // Wait a turn.
    ns.push({node, dir: null, bonus: 0, wait: true, burnsRemaining: thrust})
  }
  for (const other of mapData.neighborsOf(node)) {
    if (edgeLabels[other] && edgeLabels[other][node] === '0')
      continue
    if (!(node in edgeLabels) || !(other in edgeLabels[node]) || edgeLabels[node][other] === dir || dir == null) {
      const dir = edgeLabels[other] && edgeLabels[other][node] ? edgeLabels[other][node] : null
      const entryCost = points[other].type === 'burn' ? 1 : 0
      const flybyBoost = points[other].type === 'flyby' || (points[other].type === 'venus' && venusFlybyAvailable) ? points[other].flybyBoost : 0
      const bonusAfterEntry = Math.max(bonus - entryCost + flybyBoost, 0)
      const bonusUsed = Math.max(bonus - bonusAfterEntry, 0)
      if (burnsRemaining >= entryCost - bonusUsed)
        ns.push({node: other, dir, bonus: bonusAfterEntry, burnsRemaining: burnsRemaining - (entryCost - bonusUsed)})
    }
  }
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
  const {burnsRemaining: uBurnsRemaining} = u
  const {burnsRemaining: vBurnsRemaining} = v
  return vBurnsRemaining < uBurnsRemaining ? uBurnsRemaining - vBurnsRemaining : 0
}

/** @param {PathNode} u @param {PathNode} v */
function turnWeight(u, v) {
  const {wait} = v
  return wait ? 1 : 0
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

/** @param {PathNode} u @param {PathNode} v */
function segmentWeight(u, v) {
  const { points } = mapData
  const vType = points[v.node].type
  if (vType === 'decorative') {
    return 0
  }
  return 1
}

/** @param {PathNode} u @param {PathNode} v @returns {number[]} */
function nodeWeight(u, v) {
  const burns = burnWeight(u, v)
  const turns = turnWeight(u, v)
  const hazards = hazardWeight(u, v)
  const radHazards = radHazardWeight(u, v)
  const segment = segmentWeight(u, v)
  return [burns, turns, hazards, radHazards, segment]
}

const PATH_ID = Symbol('pathId')

/** @param {PathNode} p */
function pathId(p) {
  // @ts-ignore
  if (p[PATH_ID]) return p[PATH_ID]
  // Fast, collision-resistant encoding for path state.
  const id = p.done
    ? p.node
    : `s:${p.node}|${p.dir ?? ''}|${p.bonus}|${p.burnsRemaining}|${p.wait ? 1 : 0}`
  // Cache on the object; symbol property stays non-enumerable in JSON/stringify.
  Object.defineProperty(p, PATH_ID, {value: id})
  return id
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

  const source = /** @type {PathNode} */ ({node: fromId, dir: null, bonus: 0, burnsRemaining: thrust})
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
  const source = /** @type {PathNode} */ ({node: fromId, dir: null, bonus: 0, burnsRemaining: thrust})

  let shorterTo = /** @type {PathNode} */ ({node: toId, dir: null, bonus: 0, done: true})
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

/** @param {MapPoint} p @returns {number|null} */
function siteSizeValue(p) {
  if (!p.siteSize) return null
  const match = String(p.siteSize).match(/^\d+/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

/** @param {MapPoint} p @returns {string|null} */
function siteTypeValue(p) {
  if (!p.siteSize) return null
  const match = String(p.siteSize).match(/[A-Za-z]+$/)
  if (!match) return null
  const letters = match[0]
  if (!letters.length) return null
  return letters[letters.length - 1].toUpperCase()
}

/** @param {MapPoint} p @returns {boolean} */
function isSiteTypeEnabled(p) {
  const type = siteTypeValue(p)
  if (!type) return true
  return enabledSiteTypes.has(type)
}

const siteTypeOptions = ['C', 'S', 'M', 'V', 'D', 'H']

let isru = 0
let thrust = 12
/** @type {Set<string>} */
let enabledSiteTypes = new Set(siteTypeOptions)
/** @param {number} e */
function setIsru(e) {
  isru = e
  draw()
}

/** @param {number} value */
function setThrust(value) {
  const rounded = Math.round(value)
  const clamped = Math.max(1, Math.min(15, rounded))
  thrust = clamped
  recomputeHighlightedPath()
}

/** @param {string} type */
function toggleSiteType(type) {
  if (!siteTypeOptions.includes(type)) return
  const next = new Set(enabledSiteTypes)
  if (next.has(type)) next.delete(type)
  else next.add(type)
  enabledSiteTypes = next
  draw()
}

/** @param {MapPoint} p @param {number} width @param {number} height */
function toCanvasPoint(p, width, height) {
  return { x: p.x * width, y: p.y * height }
}

/**
 * Draw a catmull-rom spline through the provided points, which can include
 * decorative points as intermediate handles.
 * @param {CanvasRenderingContext2D} ctx
 * @param {MapPoint[]} pts
 * @param {number} width
 * @param {number} height
 */
function drawSplineSegment(ctx, pts, width, height) {
  if (pts.length < 2) return
  const canvasPts = pts.map(p => toCanvasPoint(p, width, height))
  for (let i = 0; i < canvasPts.length - 1; i++) {
    const p0 = canvasPts[i - 1] || canvasPts[i]
    const p1 = canvasPts[i]
    const p2 = canvasPts[i + 1]
    const p3 = canvasPts[i + 2] || p2
    const cp1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const cp2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y)
  }
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
    const unlabeledHohmannEdges = mapData.hohmannEdgesMissingLabels()
    const unlabeledEdgeMidpoints = []
    const seenUnlabeledEdges = new Set
    for (const { node, neighbor } of unlabeledHohmannEdges) {
      const key = [node, neighbor].sort().join(':')
      if (seenUnlabeledEdges.has(key)) continue
      seenUnlabeledEdges.add(key)
      const a = points[node]
      const b = points[neighbor]
      if (!a || !b) continue
      unlabeledEdgeMidpoints.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      })
    }
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
    if (unlabeledEdgeMidpoints.length) {
      ctx.save()
      const glowRadius = 22
      const innerRadius = 16
      const fillRadius = 12
      const glowAlpha = 0.6
      const fillAlpha = 0.35
      unlabeledEdgeMidpoints.forEach(({x, y}) => {
        const cx = x * width
        const cy = y * height
        // Outer glow
        ctx.save()
        ctx.strokeStyle = `rgba(255,0,0,${glowAlpha})`
        ctx.lineWidth = 14
        ctx.shadowBlur = 12
        ctx.shadowColor = `rgba(255,0,0,0.8)`
        ctx.beginPath()
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        // Inner ring
        ctx.save()
        ctx.strokeStyle = '#ffefef'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
        // Center fill
        ctx.save()
        ctx.fillStyle = `rgba(255,0,0,${fillAlpha})`
        ctx.beginPath()
        ctx.arc(cx, cy, fillRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
      ctx.restore()
    }
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
        const siteSize = siteSizeValue(p)
        const hasThrust = siteSize != null && thrust > siteSize
        if (p.type === 'site' && siteWater >= isru && hasThrust && isSiteTypeEnabled(p)) {
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
    /** @type {MapPoint[]} */
    let segmentPoints = [p0]
    let segmentHasDecorative = false

    for (let i = 1; i < highlightedPath.length; i++) {
      const currentPoint = mapData.points[highlightedPath[i].node]
      segmentPoints.push(currentPoint)
      segmentHasDecorative = segmentHasDecorative || currentPoint.type === 'decorative'

      const isAnchor = currentPoint.type !== 'decorative'
      const isLast = i === highlightedPath.length - 1
      if (isAnchor || isLast) {
        if (segmentPoints.length > 1) {
          if (!segmentHasDecorative && segmentPoints.length === 2) {
            const end = segmentPoints[1]
            ctx.lineTo(end.x * width, end.y * height)
          } else {
            drawSplineSegment(ctx, segmentPoints, width, height)
          }
        }
        segmentPoints = [currentPoint]
        segmentHasDecorative = false
      }
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
  ReactDOM.render(React.createElement(Overlay, {path: highlightedPath, weight, isru, setIsru, thrust, setThrust, enabledSiteTypes, toggleSiteType}), overlay)
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
