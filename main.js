function dijkstra(getNeighbors, weight, id, source) {
  const distance = {}
  const previous = {}
  distance[id(source)] = 0
  const q = new Heap()
  q.insert(0, source)
  const inQ = new Set([id(source)])
  while (!q.isEmpty()) {
    const u = q.remove()
    const idu = id(u)
    inQ.delete(idu)

    for (const v of getNeighbors(u)) {
      const idv = id(v)
      const dv = idv in distance ? distance[idv] : Infinity
      const wuv = weight(u, v)
      if (wuv < 0) throw new Error('negative weights not allowed')
      const alt = distance[idu] + wuv
      if (alt < dv) {
        distance[idv] = alt
        previous[idv] = u
        if (inQ.has(idv)) {
          // already in the queue, adjust its priority
          const index = q.nodes_.findIndex(n => id(n.getValue()) === idv)
          if (index < 0) throw new Error('programming error, inQ did not match q')
          q.nodes_[index].key_ = alt
          q.moveUp_(index)
        } else {
          q.insert(alt, v)
          inQ.add(idv)
        }
      }
    }
  }

  return {distance, previous}
}



const map = new Image
map.src = "hf.png"
main.appendChild(map)

const canvas = document.createElement('canvas')
map.onload = () => {
  canvas.width = map.width
  canvas.height = map.height
  main.appendChild(canvas)
  draw()
}

const points = {}
const edgeSet_ = new Set
const neighbors_ = new Map
const addEdge = (a, b) => {
  const [low, high] = a < b ? [a, b] : [b, a]
  edgeSet_.add(`${low}:${high}`)
  if (!neighbors_.has(a)) neighbors_.set(a, new Set)
  if (!neighbors_.has(b)) neighbors_.set(b, new Set)
  neighbors_.get(a).add(b)
  neighbors_.get(b).add(a)
}
const deleteEdge = (a, b) => {
  const [low, high] = a < b ? [a, b] : [b, a]
  edgeSet_.delete(`${low}:${high}`)
  if (!neighbors_.has(a)) neighbors_.set(a, new Set)
  if (!neighbors_.has(b)) neighbors_.set(b, new Set)
  neighbors_.get(a).delete(b)
  neighbors_.get(b).delete(a)
}
const edgeLabels = {}
let drawingPoints = true

const loadData = (data) => {
  for (let p in data.points) {
    points[p] = data.points[p]
  }
  for (let e of data.edges) {
    const [a, b] = e.split(':')
    addEdge(a, b)
  }
  for (let l in data.edgeLabels) {
    edgeLabels[l] = data.edgeLabels[l]
  }
  setTimeout(draw, 0)
}

if ('data' in localStorage) {
  loadData(JSON.parse(localStorage.data))
} else if (location.protocol !== 'file:') {
  fetch('data.json').then(r => r.json()).then(loadData)
}
function changed() {
  localStorage.data = JSON.stringify({
    points,
    edges: Array.from(edgeSet_.values()),
    edgeLabels
  })
}


function neighborNodes(nodeId) {
  return Array.from(neighbors_.get(nodeId) || [])
}

canvas.onclick = e => {
  const x = e.offsetX
  const y = e.offsetY
  const xPct = x / canvas.width
  const yPct = y / canvas.height
  const pointId = Math.random().toString()
  points[pointId] = {
    x: xPct,
    y: yPct,
    type: 'hohmann',
  }
  draw()
}

const mousePos = {x: 0, y: 0} // pct
canvas.onmousemove = e => {
  mousePos.x = e.offsetX / canvas.width
  mousePos.y = e.offsetY / canvas.height
  draw()
}

function nearestPoint(testX, testY) {
  let closest = null
  let dist = Infinity
  for (let pId in points) {
    const {x, y} = points[pId]
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
  const np = points[npId]
  const ns = neighborNodes(npId)
  const mdx = testX - np.x
  const mdy = testY - np.y
  const mouseAngle = Math.atan2(mdy, mdx)
  let minD = Infinity
  let closestEdge = null
  ns.forEach(otherEndId => {
    const otherEnd = points[otherEndId]
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
let pathing = null
let highlightedPath = null
let debugPathfinding = null

window.onkeydown = e => {
  if (e.code === 'Escape') {
    connecting = null
    pathing = null
    highlightedPath = null
    debugPathfinding = null
  }
  if (e.code === 'KeyA') {
    // find nearest point to cursor
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (connecting) {
      if (closestId && closestId !== connecting) {
        addEdge(closestId, connecting)
        changed()
        connecting = null
      }
    } else {
      if (closestId) connecting = closestId
    }
  }
  if (e.code === 'KeyX') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      delete points[closestId]
      neighborNodes(closestId).forEach(n => deleteEdge(closestId, n))
      delete edgeLabels[closestId]
      for (let pId in edgeLabels) {
        delete edgeLabels[pId][closestId]
      }
      changed()
    }
  }
  if (e.code === 'KeyH') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'hohmann'
      changed()
    }
  }
  if (e.code === 'KeyL') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'lagrange'
      changed()
    }
  }
  if (e.code === 'KeyB') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'burn'
      changed()
    }
  }
  if (e.code === 'KeyD') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'decorative'
      changed()
    }
  }
  if (e.code === 'KeyR') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'radhaz'
      changed()
    }
  }
  if (e.code === 'KeyZ') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].hazard = !points[closestId].hazard
      changed()
    }
  }
  if (e.code === 'KeyY') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'flyby'
      points[closestId].flybyBoost = ((points[closestId].flybyBoost || 0) % 4) + 1
      changed()
    }
  }
  if (e.code === 'KeyS') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (closestId) {
      points[closestId].type = 'site'
      points[closestId].siteName = prompt("Site name")
      changed()
    }
  }
  if (e.code === 'KeyF') {
    const closestId = nearestPoint(mousePos.x, mousePos.y)
    if (pathing) {
      if (closestId && closestId !== pathing) {
        console.time('finding path')
        highlightedPath = findPath(pathing, closestId)
        console.timeEnd('finding path')
        pathing = null
      }
    } else {
      if (closestId) pathing = closestId
    }
  }
  if (e.code.startsWith('Digit')) {
    const label = e.code.slice(5)
    const np = nearestPoint(mousePos.x, mousePos.y)
    const ne = nearestEdge(mousePos.x, mousePos.y)
    if (np && ne) {
      const [a, b] = ne
      const other = a === np ? b : a
      if (!edgeLabels[np]) edgeLabels[np] = {}
      edgeLabels[np][other] = label
      changed()
    }
  }
  if (e.code === 'Tab') {
    drawingPoints = !drawingPoints
    e.preventDefault()
  }
  if (e.code === 'Backquote') {
    const pId = nearestPoint(mousePos.x, mousePos.y)
    if (pId) {
      const id = p => p.dir != null ? `${p.node}@${p.dir}` : p.node
      const from = {node: pId, dir: null}
      debugPathfinding = dijkstra(getNeighbors, weight, id, from)
      draw()
    }
  }
  draw()
}

function getNeighbors(p) {
  const {node, dir, from, bonus} = p
  const ns = []
  if (edgeLabels[node]) {
    Object.keys(edgeLabels[node]).forEach(otherNode => {
      if (edgeLabels[node][otherNode] !== dir) {
        const bonusAfterDirectionChangeBurn = Math.max(bonus - 2, 0)
        ns.push({node, dir: edgeLabels[node][otherNode], from: null, bonus: bonusAfterDirectionChangeBurn})
      }
    })
  }
  if (bonus) {
    // you can always throw away your extra burns if you want.
    // this also allows the path finder to not have to search for the
    // destination node at different amounts of bonus.
    ns.push({node, dir, from, bonus: 0})
  }
  neighborNodes(node).forEach(other => {
    if (other === from) { return }
    if (edgeLabels[other] && edgeLabels[other][node] === '0') {
      return
    }
    if (!(node in edgeLabels) || edgeLabels[node][other] === dir) {
      const dir = edgeLabels[other] && edgeLabels[other][node] ? edgeLabels[other][node] : null
      const entryCost = points[other].type === 'burn' ? 1 : 0
      const flybyBoost = points[other].type === 'flyby' ? points[other].flybyBoost : 0
      const bonusAfterEntry = Math.max(bonus - entryCost + flybyBoost, 0)
      ns.push({node: other, dir, from: node, bonus: bonusAfterEntry})
    }
  })
  return ns
}

function weight(u, v) {
  const {node: uId, dir: uDir, bonus} = u
  const {node: vId, dir: vDir} = v
  if (points[vId].type === 'burn') {
    return bonus > 0 ? 0 : 1
  } else if (points[vId].type === 'hohmann') {
    return uId === vId && uDir != null && vDir != null && uDir !== vDir ? 2 : 0;
  } else if (points[vId].type === 'flyby') {
    return 0
  } else {
    return 0
  }
}

function findPath(fromId, toId) {
  // NB for pathfinding along Hohmanns each
  // hohmann is kind of like two nodes, one for
  // each direction. Moving into either node is
  // free, but switching from one to the other
  // costs 2 burns (or a turn).
  // point: {node: string; dir: string?, id: string}
  const id = p => p.dir != null || p.from != null || p.bonus ? `${p.node}@${p.dir}@${p.from}@${p.bonus}` : p.node
  const from = {node: fromId, dir: null, from: null, bonus: 0}
  const {distance, previous} = dijkstra(getNeighbors, weight, id, from)

  let shorterTo = {node: toId, dir: null, from: null, bonus: 0}
  let shorterToId = id(shorterTo)
  neighborNodes(toId).forEach(n => {
    const l = toId in edgeLabels ? edgeLabels[toId][n] : null
    const testP = {node: toId, dir: l, from: n, bonus: 0}
    const testId = id(testP)
    if (testId in distance && (!(shorterToId in distance) || distance[testId] < distance[shorterToId])) {
      shorterToId = testId
      shorterTo = testP
    }
  })

  if (shorterToId in distance) {
    const path = [shorterTo]
    let cur = shorterTo
    while (id(cur) !== id(from)) {
      const n = previous[id(cur)]
      path.unshift(n)
      cur = n
    }
    return path
  }
}

function draw() {
  const ctx = canvas.getContext('2d')
  const {width, height} = ctx.canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.lineWidth = 2
  const nearestToCursor = nearestPoint(mousePos.x, mousePos.y)
  if (drawingPoints) {
    const ce = nearestEdge(mousePos.x, mousePos.y)
    edgeSet_.forEach(e => {
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

      if (debugPathfinding) {
        ctx.save()
        ctx.fillStyle = 'magenta'
        ctx.font = '14px bold helvetica'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        const {distance} = debugPathfinding
        if (pId in edgeLabels) {
        } else {
          ctx.fillText(distance[pId], p.x * width, p.y * height)
        }
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
  }
  if (highlightedPath) {
    ctx.save()
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(255,0,0,0.5)'
    const p0 = points[highlightedPath[0].node]
    ctx.beginPath()
    ctx.moveTo(p0.x * width, p0.y * height)
    for (let p of highlightedPath.slice(1)) {
      const point = points[p.node]
      ctx.lineTo(point.x * width, point.y * height)
    }
    ctx.stroke()
    ctx.restore()
  }
}
