import Heap from 'closure-heap'

export function dijkstra(getNeighbors, weight, id, source, allowed) {
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
      if (!allowed(u, v, id, previous)) continue
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
