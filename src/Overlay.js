import React from 'react'

const e = React.createElement

const pl = (n, sg, pl) => n === 1 ? `${n} ${sg}` : `${n} ${pl}`

function PathInfo({path, weight: [burns, turns, hazards]}) {
  if (!path) return e('div')
  else {
    return e('div', {className: 'PathInfo'},
      e('div', {}, `${pl(burns, 'burn', 'burns')}`),
      e('div', {}, `${pl(turns, 'turn', 'turns')}`),
      e('div', {}, `${pl(Math.floor(hazards), 'hazard', 'hazards')}`)
    )
  }
}

function VehicleInfo({isru, setIsru}) {
  return e('div', {className: 'VehicleInfo'},
    e('div', {className: 'field'},
      'ISRU',
      e('input', {value: isru, type: 'number', min: 0, max: 4, onChange: e => setIsru(Number(e.target.value))})
    )
  )
}

export function Overlay({path, weight, isru, setIsru}) {
  return [
    PathInfo({path, weight}),
    VehicleInfo({isru, setIsru}),
  ]
}
