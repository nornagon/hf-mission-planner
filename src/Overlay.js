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

/** @param {{isru: number, setIsru: (value: number) => void, thrust: number, setThrust: (value: number) => void}} param0 */
function VehicleInfo({isru, setIsru, thrust, setThrust}) {
  /** @param {string} value */
  const updateThrust = (value) => {
    const n = Number(value)
    if (Number.isNaN(n)) return
    setThrust(n)
  }

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
    ,
    e('div', {className: 'field', role: 'group', 'aria-label': 'Thrust'},
      e('div', {className: 'label-row'},
        e('span', {className: 'label'}, 'Thrust')
      ),
      e('div', {className: 'thrust-inputs'},
        e('input', {
          type: 'range',
          min: 0,
          max: 15,
          step: 1,
          value: thrust,
          onChange: (ev) => updateThrust(ev.target.value),
        }),
        e('input', {
          type: 'number',
          min: 0,
          max: 15,
          step: 1,
          value: thrust,
          inputMode: 'numeric',
          onChange: (ev) => updateThrust(ev.target.value),
        }),
      )
    )
  )
}

/** @param {{path: PathNode[]|null, weight: [number, number, number, number, number], isru: number, setIsru: (value: number) => void, thrust: number, setThrust: (value: number) => void}} props */
export function Overlay({path, weight, isru, setIsru, thrust, setThrust}) {
  return e(React.Fragment, null,
    PathInfo({path, weight}),
    VehicleInfo({isru, setIsru, thrust, setThrust}),
  )
}
