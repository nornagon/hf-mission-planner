import Heap from './heap'

export function dijkstra(getNeighbors, weight, {zero, add, lessThan}, id, source, allowed) {
  const distance = {}
  const previous = {}
  distance[id(source)] = zero
  const q = new Heap(null, lessThan)
  q.insert(zero, source)
  const inQ = new Set([id(source)])
  while (!q.isEmpty()) {
    const u = q.remove()
    const idu = id(u)
    inQ.delete(idu)

    for (const v of getNeighbors(u)) {
      if (!allowed(u, v, id, previous)) continue
      const idv = id(v)
      const dv = distance[idv]
      const wuv = weight(u, v)
      const alt = add(distance[idu], wuv)
      if (dv === undefined || lessThan(alt, dv)) {
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
