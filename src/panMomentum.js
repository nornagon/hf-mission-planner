import { zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'

/** @typedef {import('d3-zoom').ZoomTransform} ZoomTransform */
/** @typedef {{x: number, y: number}} Vec2 */

// Momentum integrator with framerate-independent decay
class Momentum {
  /** @param {Vec2} [start] @param {Vec2} [v0] */
  constructor(start = {x: 0, y: 0}, v0 = {x: 0, y: 0}) {
    this.pos = {...start}
    this.v = {...v0}
    this.tPrev = performance.now() / 1000
  }

  /** Call on each frame. λ≈5–8 s⁻¹ works well. cutoff in px/s. */
  tick(lambda = 6.5, cutoff = 10) {
    const t = performance.now() / 1000
    let dt = t - this.tPrev
    this.tPrev = t

    // clamp dt to survive background tabs / jank
    if (dt > 1 / 15) dt = 1 / 15

    // exponential decay v *= e^(−λ·dt)
    const decay = Math.exp(-lambda * dt)
    this.v.x *= decay
    this.v.y *= decay

    // integrate position: x += v*dt
    this.pos.x += this.v.x * dt
    this.pos.y += this.v.y * dt

    // small velocity cutoff to stop forever-gliding
    if (Math.hypot(this.v.x, this.v.y) < cutoff) this.v = {x: 0, y: 0}

    return {pos: this.pos, v: this.v}
  }

  /** Call when the user lifts their finger/mouse to “fling” */
  /** @param {Vec2} v */
  setVelocity(v) { this.v = {...v} }

  /** Reset position/velocity and sync time to now. */
  /** @param {Vec2} [pos] */
  reset(pos = this.pos) {
    this.pos = {...pos}
    this.v = {x: 0, y: 0}
    this.tPrev = performance.now() / 1000
  }
}

/**
 * @param {Object} param0
 * @param {import('d3-zoom').ZoomBehavior<Element, unknown>} param0.zoomBehavior
 * @param {(t: ZoomTransform) => void} param0.applyTransform
 * @param {Element} [param0.zoomTarget=document.documentElement]
 */
export function createPanMomentum({zoomBehavior, applyTransform, zoomTarget = document.documentElement}) {
  const panMomentum = new Momentum()
  /** @type {ZoomTransform} */
  let currentTransform = zoomIdentity
  /** @type {number|null} */
  let momentumFrame = null
  /** @type {boolean} */
  let isPointerPanning = false
  /** @type {boolean} */
  let isProgrammaticZoom = false
  /** @type {Vec2} */
  let lastPanPos = {x: 0, y: 0}
  /** @type {Vec2} */
  let lastPanVelocity = {x: 0, y: 0}
  /** @type {number} */
  let lastPanSampleTime = performance.now() / 1000
  /** @type {TouchList|null} */
  let activeTouches = null

  /** @param {ZoomTransform} transform */
  function constrainTransform(transform) {
    const extentFn = zoomBehavior.extent()
    const translateExtent = zoomBehavior.translateExtent()
    const constrainFn = zoomBehavior.constrain()
    const extent = typeof extentFn === 'function'
      ? extentFn.call(zoomTarget)
      : extentFn
    return constrainFn(transform, extent, translateExtent)
  }

  /** @param {Vec2} velocity */
  function startMomentum(velocity) {
    stopMomentum()
    panMomentum.reset({x: currentTransform.x, y: currentTransform.y})
    panMomentum.setVelocity(velocity)

    const tickMomentum = () => {
      const {pos, v} = panMomentum.tick()
      const unconstrained = zoomIdentity.translate(pos.x, pos.y).scale(currentTransform.k)
      const nextTransform = constrainTransform(unconstrained)
      if (nextTransform.x !== unconstrained.x) panMomentum.v.x = 0
      if (nextTransform.y !== unconstrained.y) panMomentum.v.y = 0
      panMomentum.pos = {x: nextTransform.x, y: nextTransform.y}
      isProgrammaticZoom = true
      select(zoomTarget).call(zoomBehavior.transform, nextTransform)
      isProgrammaticZoom = false
      if (v.x !== 0 || v.y !== 0) {
        momentumFrame = requestAnimationFrame(tickMomentum)
      } else {
        momentumFrame = null
      }
    }
    momentumFrame = requestAnimationFrame(tickMomentum)
  }

  function stopMomentum() {
    if (momentumFrame != null) {
      cancelAnimationFrame(momentumFrame)
      momentumFrame = null
    }
    panMomentum.reset({x: currentTransform.x, y: currentTransform.y})
  }

  /** @param {import('d3-zoom').D3ZoomEvent<Element, unknown>} e */
  function handleZoomStarted(e) {
    if (isProgrammaticZoom || !e.sourceEvent) return
    stopMomentum()
    const sourceEvent = e.sourceEvent
    const touches = sourceEvent && 'touches' in sourceEvent ? sourceEvent.touches : null
    activeTouches = touches ?? null
    const isMultiTouch = touches && touches.length > 1
    const isPointerStart = sourceEvent && !isMultiTouch && ['mousedown', 'touchstart', 'pointerdown'].includes(sourceEvent.type)
    if (isPointerStart) {
      isPointerPanning = true
      lastPanPos = {x: e.transform.x, y: e.transform.y}
      lastPanVelocity = {x: 0, y: 0}
      lastPanSampleTime = performance.now() / 1000
      panMomentum.reset(lastPanPos)
    } else {
      isPointerPanning = false
    }
  }

  /** @param {import('d3-zoom').D3ZoomEvent<Element, unknown>} e */
  function handleZoomed(e) {
    const {x, y} = e.transform
    currentTransform = e.transform
    applyTransform(e.transform)
    panMomentum.pos = {x, y}

    if (isProgrammaticZoom) return

    const se = e.sourceEvent
    const isMove = se && ['mousemove', 'pointermove', 'touchmove'].includes(se.type)
    if (isPointerPanning && isMove) {
      const now = performance.now() / 1000
      const dt = now - lastPanSampleTime
      if (dt > 0) {
        lastPanVelocity = {x: (x - lastPanPos.x) / dt, y: (y - lastPanPos.y) / dt}
        lastPanPos = {x, y}
        lastPanSampleTime = now
      }
    }
  }

  /** @param {import('d3-zoom').D3ZoomEvent<Element, unknown>} e */
  function handleZoomEnded(e) {
    if (isPointerPanning) {
      const sourceEvent = e.sourceEvent
      const touches = sourceEvent && 'touches' in sourceEvent ? sourceEvent.touches : null
      const touchCount = touches ? touches.length : (activeTouches ? activeTouches.length : 0)
      const endedWithPan = !touchCount || touchCount === 1
      isPointerPanning = false
      activeTouches = null
      const speed = Math.hypot(lastPanVelocity.x, lastPanVelocity.y)
      if (endedWithPan && speed > 0) {
        startMomentum(lastPanVelocity)
      }
    }
  }

  /** @param {ZoomTransform} transform */
  function syncTransform(transform) {
    currentTransform = transform
    panMomentum.reset({x: transform.x, y: transform.y})
  }

  zoomBehavior
    .on('start', handleZoomStarted)
    .on('zoom', handleZoomed)
    .on('end', handleZoomEnded)

  function syncFromBehavior() {
    const t = select(zoomTarget).property('__zoom')
    if (t) syncTransform(t)
  }
  syncFromBehavior()

  return {
    syncTransform,
  }
}
