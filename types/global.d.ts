declare const main: HTMLElement

declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.json' {
  const value: any
  export default value
}

type PointType = 'hohmann'|'lagrange'|'burn'|'decorative'|'radhaz'|'venus'|'site'|'flyby'

interface MapPoint {
  x: number
  y: number
  type: PointType
  hazard?: boolean
  landing?: number
  flybyBoost?: number
  siteName?: string
  siteSize?: string
  siteWater?: number|string
}

type PointMap = Record<string, MapPoint>

type MapDataJSON = {
  points: PointMap
  edges: string[]
  edgeLabels: Record<string, Record<string, string>>
}

type PathNode = {node: string, dir: string|null, bonus: number, done?: true}
type PathData = {distance: Record<string, number[]>, previous: Record<string, PathNode>}

type Vec2 = {x: number, y: number}
