import Heap from './heap'

/**
 * @template Node
 * @template Weight
 * @param {(node: Node) => Iterable<Node>} getNeighbors
 * @param {(u: Node, v: Node) => Weight} weight
 * @param {{zero: Weight, add: (a: Weight, b: Weight) => Weight, lessThan: (a: Weight, b: Weight) => boolean}} monoid
 * @param {(node: Node) => string} id
 * @param {Node} source
 * @param {(u: Node, v: Node, id: (node: Node) => string, previous: Record<string, Node>) => boolean} allowed
 * @returns {{distance: Record<string, Weight>, previous: Record<string, Node>}}
 */
export function dijkstra(getNeighbors, weight, {zero, add, lessThan}, id, source, allowed) {
  /** @type {Record<string, Weight>} */
  const distance = {}
  /** @type {Record<string, Node>} */
  const previous = {}
  distance[id(source)] = zero
  /** @type {Heap<Weight, Node>} */
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
