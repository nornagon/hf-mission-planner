export class MapData {
  constructor() {
    this._points = {}
    this._edgeSet = new Set
    this._neighbors = new Map
    this._edgeLabels = {}
  }

  get points() { return this._points }
  get edges() { return this._edgeSet }
  get neighbors() { return this._neighbors }
  get edgeLabels() { return this._edgeLabels }

  neighborsOf(nodeId) {
    return Array.from(this._neighbors.get(nodeId) || [])
  }

  addPoint(id, point) {
    this._points[id] = point
  }
  deletePoint(id) {
    delete this._points[id]
    this.neighborsOf(id).forEach(n => this.deleteEdge(id, n))
  }
  addEdge(a, b) {
    const [low, high] = a < b ? [a, b] : [b, a]
    this._edgeSet.add(`${low}:${high}`)
    if (!this._neighbors.has(a)) this._neighbors.set(a, new Set)
    if (!this._neighbors.has(b)) this._neighbors.set(b, new Set)
    this._neighbors.get(a).add(b)
    this._neighbors.get(b).add(a)
  }
  hasEdge(a, b) {
    const [low, high] = a < b ? [a, b] : [b, a]
    return this._edgeSet.has(`${low}:${high}`)
  }
  deleteEdge(a, b) {
    const [low, high] = a < b ? [a, b] : [b, a]
    this._edgeSet.delete(`${low}:${high}`)
    if (!this._neighbors.has(a)) this._neighbors.set(a, new Set)
    if (!this._neighbors.has(b)) this._neighbors.set(b, new Set)
    this._neighbors.get(a).delete(b)
    this._neighbors.get(b).delete(a)
  
    if (a in this._edgeLabels) {
      delete this._edgeLabels[a][b]
    }
    if (b in this._edgeLabels) {
      delete this._edgeLabels[b][a]
    }
  }

  setEdgeLabel(a, b, label) {
    if (!(a in this._points) || !(b in this._points) || !(this.hasEdge(a, b)))
      throw new Error(`Invalid edge label from '${a}' to '${b}'`)
    if (!(a in this._edgeLabels)) {
      this._edgeLabels[a] = {}
    }
    this._edgeLabels[a][b] = label
  }

  static fromJSON(json) {
    const mapData = new MapData
    for (let p in json.points) {
      mapData.addPoint(p, json.points[p])
    }
    for (let e of json.edges) {
      const [a, b] = e.split(':')
      if (!((a in json.points) && (b in json.points))) {
        console.warn(`dropping dead edge: ${e}`)
      } else {
        mapData.addEdge(a, b)
      }
    }
    for (const l in json.edgeLabels) {
      for (const l2 in json.edgeLabels[l]) {
        try {
          mapData.setEdgeLabel(l, l2, json.edgeLabels[l][l2])
        } catch (e) {
          console.warn('Bad edge label:', e)
        }
      }
    }
    return mapData
  }

  toJSON() {
    return {
      points: this._points,
      edges: Array.from(this._edgeSet.values()),
      edgeLabels: this._edgeLabels,
    }
  }
}