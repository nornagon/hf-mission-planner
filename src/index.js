import ReactDOM from 'react-dom'
import React from 'react'
import { zoom } from 'd3-zoom'
import { select, event } from 'd3-selection'

import './index.css'
import HFMap from '../assets/hf.png'
import HF4Map from '../assets/hf4.png'
import { dijkstra } from './dijkstra'
import { PathInfo } from './PathInfo'
import { MapData } from './MapData'

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
  const z = zoom()
    .scaleExtent([0.2, 1.5])
    .translateExtent([[0,0],[map.width,map.height]])
    .on("zoom", () => zoomed(event.transform))
  select(document.documentElement).call(z).call(z.translateTo, 0.85 * canvas.width, 0.80 * canvas.height)
  draw()
}

function zoomed({x, y, k}) {
  main.style.transform = `translate(${x}px,${y}px) scale(${k})`
  main.style.transformOrigin = '0 0'
}

let editing = false
let mapData = null
let venus = false

const loadData = (json) => {
  mapData = MapData.fromJSON(json)
  setTimeout(draw, 0)
}

if ('data' in localStorage) {
  loadData(JSON.parse(localStorage.data))
} else if (location.protocol !== 'file:') {
  if (isHF3) {
    import('../assets/data.json').then(({default: data}) => loadData(data))
  } else {
    import('../assets/data-hf4.json').then(({default: data}) => loadData(data))
  }
}

function changed() {
  localStorage.data = JSON.stringify(mapData.toJSON())
}

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

function beginPathing(originId) {
  pathOrigin = originId
  pathData = findPath(originId)
}

function canPath(closestId) {
  return closestId && pathOrigin && closestId !== pathOrigin
}

function endPathing() {
  pathOrigin = null
  pathData = null
}

const mousePos = {x: 0, y: 0} // pct
canvas.onmousemove = e => {
  mousePos.x = e.offsetX / canvas.width
  mousePos.y = e.offsetY / canvas.height
  draw()

  if (pathOrigin && pathData) {
    const closestId = nearestPoint(mousePos.x, mousePos.y, id => mapData.points[id].type !== 'decorative')

    if (canPath(closestId)) {
      highlightedPath = drawPath(pathData, pathOrigin, closestId)
    }
  }
}

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

function clipToPi(a) {
  if (a < -Math.PI)
    return a + Math.PI * 2 * Math.abs(Math.floor((a + Math.PI) / (Math.PI * 2)))
  else if (a > Math.PI)
    return a - Math.PI * 2 * Math.abs(Math.ceil(((a - Math.PI) / (Math.PI * 2))))
  else
    return a
}

function nearestEdge(testX, testY) {
  const npId = nearestPoint(testX, testY)
  if (!npId) return
  const np = mapData.points[npId]
  const ns = mapData.neighborsOf(npId)
  const mdx = testX - np.x
  const mdy = testY - np.y
  const mouseAngle = Math.atan2(mdy, mdx)
  let minD = Infinity
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
  if (minD < Math.PI / 4) {
    return closestEdge.sort()
  }
}

let connecting = null
let pathOrigin = null
let pathData = null
let highlightedPath = null

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
        mapData.points[closestId].type = 'site'
        mapData.points[closestId].siteName = prompt("Site name", mapData.points[closestId].siteName)
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
  }

  if (e.code === 'KeyV') {
    venus = !venus
    if (pathData) { beginPathing(pathOrigin) }
  }

  if (e.code === 'Tab') { // Toggle edit mode
    editing = !editing
    e.preventDefault()
  }

  draw()
}

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
      const flybyBoost = points[other].type === 'flyby' || 'venus' ? points[other].flybyBoost : 0
      const bonusAfterEntry = Math.max(bonus - entryCost + flybyBoost, 0)
      if (points[other].type === 'venus' && !venus) {
        return
      }
      ns.push({node: other, dir, bonus: bonusAfterEntry})
    }
  })
  return ns
}

const ints = {
  zero: 0,
  add: (a, b) => a + b,
  lessThan: (a, b) => a < b
}

const tuple4s = {
  zero: [0, 0, 0, 0],
  add: (a, b) => a.map((x, i) => x + b[i]),
  lessThan: ([a,b,c,d], [x,y,z,w]) => {
    return (
      a < x || (a === x && (
        b < y || (b === y) && (
          c < z || (c === z) && (
            d < w)))))
  }
}

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

function turnWeight(u, v) {
  const {node: uId, dir: uDir, bonus} = u
  const {node: vId, dir: vDir} = v
  const { points } = mapData
  if (points[vId].type === 'hohmann') {
    if (uId === vId && uDir != null && vDir == null) return 1
    return 0
  }
  return 0
}

function hazardWeight(u, v) {
  const { node: uId } = u
  const { node: vId } = v
  if (uId === vId) return 0
  const { points } = mapData
  if (points[vId].hazard)
    return 1
  if (points[vId].type === 'radhaz') {
    return 0.1 // eh, close enough
  }
  return 0
}

function burnsTurnsHazardsSegments(u, v) {
  const burns = burnWeight(u, v)
  const turns = turnWeight(u, v) // Assuming infinite thrust and no waiting...
  const hazards = hazardWeight(u, v)
  return [burns, turns, hazards, 1]
}

function pathId(p) {
  return p.dir != null || p.bonus ? `${p.node}@${p.dir}@${p.bonus}` : p.node
}

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

  const source = {node: fromId, dir: null, bonus: 0}
  const pathData = dijkstra(getNeighbors, burnsTurnsHazardsSegments, tuple4s, pathId, source, allowed)

  console.timeEnd('calculating paths')

  return pathData
}

function drawPath({ distance, previous }, fromId, toId) {
  const source = {node: fromId, dir: null, bonus: 0}
  
  let shorterTo = {node: toId, dir: null, bonus: 0}
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
      if (p.type === 'flyby') {
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
    }
  }
  if (highlightedPath) {
    ctx.save()
    ctx.lineWidth = 20
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
  }
  let weight = tuple4s.zero
  if (highlightedPath) {
    for (let i = 1; i < highlightedPath.length; i++) {
      weight = tuple4s.add(weight, burnsTurnsHazardsSegments(highlightedPath[i-1], highlightedPath[i]))
    }
  }
  ReactDOM.render(React.createElement(PathInfo, {points: mapData.points, path: highlightedPath, weight}), overlay)
}