import React from 'react'

const e = React.createElement

/** @param {number} n @param {string} sg @param {string} pl */
const pl = (n, sg, pl) => n === 1 ? `${n} ${sg}` : `${n} ${pl}`

/** @param {{path: PathNode[]|null, weight: [number, number, number, number, number]}} props */
function PathInfo({path, weight: [burns, turns, hazards, radhazards]}) {
  if (!path) return e('div')
  else {
    return e('div', {className: 'PathInfo'},
      e('div', {}, `${pl(burns, 'burn', 'burns')}`),
      e('div', {}, `${pl(turns, 'turn', 'turns')}`),
      e('div', {}, `${pl(hazards, 'hazard', 'hazards')}`),
      e('div', {}, `${pl(radhazards, 'rad hazard', 'rad hazards')}`),
    )
  }
}

const isruLevels = [0, 1, 2, 3, 4]

/** @param {{isru: number, setIsru: (value: number) => void}} param0 */
function VehicleInfo({isru, setIsru}) {
  return e('div', {className: 'VehicleInfo'},
    e('div', {className: 'field', role: 'group', 'aria-label': 'ISRU level'},
      e('span', {className: 'label'}, 'ISRU'),
      e('div', {className: 'isru-buttons'},
        isruLevels.map(level =>
          e('button', {
            key: level,
            type: 'button',
            className: 'isru-button' + (isru === level ? ' selected' : ''),
            'aria-pressed': isru === level,
            onClick: () => setIsru(level),
          }, level)
        )
      )
    )
  )
}

/** @param {{path: PathNode[]|null, weight: [number, number, number, number, number], isru: number, setIsru: (value: number) => void}} props */
export function Overlay({path, weight, isru, setIsru}) {
  return e(React.Fragment, null,
    PathInfo({path, weight}),
    VehicleInfo({isru, setIsru}),
  )
}
