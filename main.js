function removeMinBy(list, f) {
  let minV = null
  let minI = null
  for (let i = 0; i < list.length; i++) {
    const v = f(list[i])
    if (minV === null || v < minV) {
      minV = v
      minI = i
    }
  }
  if (minV === null) throw new Error('empty list')
  const tmp = list[list.length - 1]
  list[list.length - 1] = list[minI]
  list[minI] = tmp
  return list.pop()
}

function dijkstra(getNeighbors, weight, id, source) {
  const distance = {}
  const previous = {}
  distance[id(source)] = 0
  // TODO: pri-Q
  const q = [source]
  const inQ = new Set([id(source)])
  while (q.length) {
    const u = removeMinBy(q, u => distance[id(u)])
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
        if (!inQ.has(idv)) {
          q.push(v)
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
const edges = new Set
const edgeLabels = {}
let drawingPoints = true

if ('data' in localStorage) {
  const data = JSON.parse(localStorage.data)
  for (let p in data.points) {
    points[p] = data.points[p]
  }
  for (let e of data.edges) {
    edges.add(e)
  }
  for (let l in data.edgeLabels) {
    edgeLabels[l] = data.edgeLabels[l]
  }
  setTimeout(draw, 0)
}

function edgesAt(pId) {
  const es = []
  edges.forEach(e => {
    const [a, b] = e.split(":")
    if (a === pId || b === pId) es.push(e)
  })
  return es
}
function neighborNodes(nodeId) {
  const ns = []
  edges.forEach(e => {
    const [a, b] = e.split(":")
    if (a === nodeId || b === nodeId) {
      ns.push(a === nodeId ? b : a)
    }
  })
  return ns
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
  const es = edgesAt(npId)
  const mdx = testX - np.x
  const mdy = testY - np.y
  const mouseAngle = Math.atan2(mdy, mdx)
  let minD = Infinity
  let closestEdge = null
  es.forEach(e => {
    const [a, b] = e.split(":")
    const otherEndId = a === npId ? b : a
    const otherEnd = points[otherEndId]
    const dy = otherEnd.y - np.y
    const dx = otherEnd.x - np.x
    const angle = Math.atan2(dy, dx)
    const dAngle = clipToPi(mouseAngle - angle)
    if (Math.abs(dAngle) < minD) {
      minD = Math.abs(dAngle)
      closestEdge = e
    }
  })
  if (minD < Math.PI / 4) {
    return closestEdge
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
        const [lowId, highId] = closestId < connecting ? [closestId, connecting] : [connecting, closestId]
        const edge = `${lowId}:${highId}`
        edges.add(edge)
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
      edgesAt(closestId).forEach(e => edges.delete(e))
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
        highlightedPath = findPath(pathing, closestId)
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
      const [a, b] = ne.split(":")
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
  draw()
}

function changed() {
  localStorage.data = JSON.stringify({
    points,
    edges: Array.from(edges.values()),
    edgeLabels
  })
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
  edges.forEach(e => {
    const [a, b] = e.split(":")
    if (a === node || b === node) {
      const other = a === node ? b : a
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

window.addEventListener('keydown', e => {
  if (e.code === 'Backquote') {
    const pId = nearestPoint(mousePos.x, mousePos.y)
    if (pId) {
      const id = p => p.dir != null ? `${p.node}@${p.dir}` : p.node
      const from = {node: pId, dir: null}
      debugPathfinding = spfa(getNeighbors, weight, id, from)
      draw()
    }
  }
})

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
    edges.forEach(e => {
      const [a, b] = e.split(":")
      const pa = points[a]
      const pb = points[b]
      if (ce === e) {
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
