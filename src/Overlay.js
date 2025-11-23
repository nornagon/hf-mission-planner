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

/** @param {{isru: number, setIsru: (value: number) => void}} param0 */
function VehicleInfo({isru, setIsru}) {
  return e('div', {className: 'VehicleInfo'},
    e('div', {className: 'field'},
      'ISRU',
      e('input', {value: isru, type: 'number', min: 0, max: 4, onChange: e => setIsru(Number(e.target.value))})
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
