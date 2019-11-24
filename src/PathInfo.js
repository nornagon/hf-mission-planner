import React from 'react'

const e = React.createElement

const pl = (n, sg, pl) => n === 1 ? `${n} ${sg}` : `${n} ${pl}`

export function PathInfo({path, weight, points}) {
  if (!path) return null
  else {
    let burns = 0
    let hazards = 0
    for (let i = 1; i < path.length; i++) {
      burns += weight(path[i-1], path[i])
    }
    for (let i = 1; i < path.length; i++) {
      if (path[i].node !== path[i-1].node) {
        // only count hazards once, when we move into the node
        hazards += points[path[i].node].hazard ? 1 : 0
      }
    }
    return e('div', {className: 'PathInfo'}, `${pl(burns, 'burn', 'burns')}, ${pl(hazards, 'hazard', 'hazards')}`)
  }
}
