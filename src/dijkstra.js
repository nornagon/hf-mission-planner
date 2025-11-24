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
  while (!q.isEmpty()) {
    const entry = q.removeEntry()
    if (!entry) break
    const u = entry.getValue()
    const idu = id(u)
    // Drop stale queue entries that no longer match the best known distance.
    if (distance[idu] !== undefined && lessThan(distance[idu], entry.getKey())) {
      continue
    }

    for (const v of getNeighbors(u)) {
      if (!allowed(u, v, id, previous)) continue
      const idv = id(v)
      const dv = distance[idv]
      const wuv = weight(u, v)
      const alt = add(distance[idu], wuv)
      if (dv === undefined || lessThan(alt, dv)) {
        distance[idv] = alt
        previous[idv] = u
        // Push a new entry instead of decreasing key; stale entries are skipped when popped.
        q.insert(alt, v)
      }
    }
  }

  return {distance, previous}
}
