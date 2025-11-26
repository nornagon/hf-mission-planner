import React from 'react'

const e = React.createElement

/** @param {number} n @param {string} sg @param {string} pl */
const pl = (n, sg, pl) => n === 1 ? `${n} ${sg}` : `${n} ${pl}`

/** @typedef {'burns'|'turns'|'hazards'|'radHazards'} MetricKey */

/** @typedef {import('./MapData').MapData} MapData */

/** @param {{mapData: MapData, path: PathNode[]|null, weight: {burns: number, turns: number, hazards: number, radHazards: number}, metricPriority: MetricKey[], prioritizeMetric: (metric: MetricKey) => void}} props */
function PathInfo({mapData, path, weight, metricPriority, prioritizeMetric}) {
  if (!path) return e('div')
  
  const sourcePoint = path ? mapData.points[path[0].node] : null
  const destinationPoint = path ? mapData.points[path[path.length - 1].node] : null

  const metricMeta = {
    burns: {sg: 'burn', pl: 'burns'},
    turns: {sg: 'turn', pl: 'turns'},
    hazards: {sg: 'hazard', pl: 'hazards'},
    radHazards: {sg: 'rad hazard', pl: 'rad hazards'},
  }
  const orderedMetrics = metricPriority
    .map(key => ({key, ...metricMeta[key]}))

  return e('div', {className: 'PathInfo'},
    orderedMetrics.map(({key, sg, pl: plural}) => {
      const topPriority = metricPriority[0] === key
      return e('div', {key, className: 'PathInfo-row'},
        e('span', {className: 'PathInfo-label'}, `${pl(weight[key], sg, plural)}`),
        topPriority ? null : e('button', {
          type: 'button',
          className: 'PathInfo-priorityButton' + (topPriority ? ' selected' : ''),
          'aria-pressed': topPriority,
          onClick: () => prioritizeMetric(key),
        }, '⬆'),
      )
    }),
    destinationPoint?.siteName || sourcePoint?.siteName ? e('div', {className: 'PathInfo-row PathInfo-destinationRow'},
      e('span', {className: 'PathInfo-destination'}, `${sourcePoint.siteName ?? '•'} → ${destinationPoint.siteName ?? '•'}`),
    ) : null,
  )
}

const isruLevels = [0, 1, 2, 3, 4]

const siteTypeOptions = ['C', 'S', 'M', 'V', 'D', 'H']

/** @param {{isru: number, setIsru: (value: number) => void, thrust: number, setThrust: (value: number) => void, enabledSiteTypes: Set<string>, toggleSiteType: (type: string) => void}} param0 */
function VehicleInfo({isru, setIsru, thrust, setThrust, enabledSiteTypes, toggleSiteType}) {
  /** @param {string} value */
  const updateThrust = (value) => {
    const n = Number(value)
    if (Number.isNaN(n)) return
    setThrust(n)
  }

  return e('div', {className: 'VehicleInfo'},
    e('div', {className: 'field', role: 'group', 'aria-label': 'Thrust'},
      e('div', {className: 'label-row'},
        e('span', {className: 'label'}, 'Thrust')
      ),
      e('div', {className: 'thrust-inputs'},
        e('input', {
          type: 'range',
          min: 1,
          max: 15,
          step: 1,
          value: thrust,
          onChange: (ev) => updateThrust(ev.target.value),
        }),
        e('input', {
          type: 'number',
          min: 1,
          max: 15,
          step: 1,
          value: thrust,
          inputMode: 'numeric',
          onChange: (ev) => updateThrust(ev.target.value),
        }),
      )
    ),
    e('div', {className: 'field', role: 'group', 'aria-label': 'Site Hydration'},
      e('span', {className: 'label'}, 'Site Hydration'),
      e('div', {className: 'isru-buttons'},
        isruLevels.map(level =>
          e('button', {
            key: level,
            type: 'button',
            className: 'isru-button' + (isru === level ? ' selected' : ''),
            'aria-pressed': isru === level,
            onClick: () => setIsru(level),
          }, `${level}+`)
        )
      )
    ),
    e('div', {className: 'field', role: 'group', 'aria-label': 'Spectral Type'},
      e('div', {className: 'label-row'},
        e('span', {className: 'label'}, 'Spectral Type'),
      ),
      e('div', {className: 'site-type-buttons'},
        siteTypeOptions.map(type =>
          e('button', {
            key: type,
            type: 'button',
            className: 'site-type-button' + (enabledSiteTypes.has(type) ? ' selected' : ''),
            'aria-pressed': enabledSiteTypes.has(type),
            onClick: () => toggleSiteType(type),
          }, type)
        )
      )
    )
  )
}

/** @param {{mapData: MapData, path: PathNode[]|null, weight: {burns: number, turns: number, hazards: number, radHazards: number}, metricPriority: MetricKey[], prioritizeMetric: (metric: MetricKey) => void, isru: number, setIsru: (value: number) => void, thrust: number, setThrust: (value: number) => void, enabledSiteTypes: Set<string>, toggleSiteType: (type: string) => void}} props */
export function Overlay({mapData, path, weight, metricPriority, prioritizeMetric, isru, setIsru, thrust, setThrust, enabledSiteTypes, toggleSiteType}) {
  return e(React.Fragment, null,
    PathInfo({mapData, path, weight, metricPriority, prioritizeMetric}),
    VehicleInfo({isru, setIsru, thrust, setThrust, enabledSiteTypes, toggleSiteType}),
  )
}
