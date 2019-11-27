import React, { useEffect, useRef } from 'react'

const e = React.createElement

const pl = (n, sg, pl) => n === 1 ? `${n} ${sg}` : `${n} ${pl}`

export function PathInfo({path, weight: [burns, turns, hazards], points}) {
  if (!path) return null
  else {
    return e('div', {className: 'PathInfo'},
      e('div', {}, `${pl(burns, 'burn', 'burns')}`),
      e('div', {}, `${pl(turns, 'turn', 'turns')}`),
      e('div', {}, `${pl(Math.floor(hazards), 'hazard', 'hazards')}`)
    )
  }
}
