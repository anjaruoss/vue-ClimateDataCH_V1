import { onMounted, onBeforeUnmount, Ref } from 'vue'

export type VizItem = {
  key: string
  ref: Ref<HTMLElement | null>   // Frame-Element (Container der jeweiligen Visualisierung)
  year: Ref<number>              // Jahr-Ref der Visualisierung
  min?: number                   // optional: eigene Untergrenze
  max?: number                   // optional: eigene Obergrenze
}

export type ScrubberOpts = {
  min: number                    // gemeinsame Untergrenze
  max: number                    // gemeinsame Obergrenze
  wheelPxPerYear?: number        // „Geschwindigkeit“ für Maus-/Trackpad-Wheel
  touchPxPerYear?: number        // „Geschwindigkeit“ für Touch
  tolMinPx?: number              // Mindest-Toleranz für Center-Detection
  tolRatioVp?: number            // relative Toleranz (z.B. 0.25 = 25% der Viewport-Höhe)
  wheelIdleMs?: number           // Reset-Timeout für Wheel-Accumulator
}

export function useScrubber(visualizations: VizItem[], opts: ScrubberOpts){
  // ===== Optionen (mit Defaults) =====
  const WHEEL_PX_PER_YEAR = 75
  const TOUCH_PX_PER_YEAR = 75
  const TOL_MIN_PX        = 38
  const TOL_RATIO         = 0.1
  const WHEEL_IDLE_MS     = 120

  // ===== Zustände für Eingaben =====
  let scrollCapture = false
  let wheelAccum = 0
  let wheelIdleTimer: number | null = null

  let lastTouchY: number | null = null
  let touchAccum = 0

  // ===== Hilfsfunktionen =====
  function clampYear(v: number, min = opts.min, max = opts.max){ return Math.max(min, Math.min(max, v)) }

  function resetWheelAccum(){
    wheelAccum = 0
    if (wheelIdleTimer){ window.clearTimeout(wheelIdleTimer); wheelIdleTimer = null }
  }
  function scheduleWheelReset(){
    if (wheelIdleTimer) window.clearTimeout(wheelIdleTimer)
    wheelIdleTimer = window.setTimeout(resetWheelAccum, WHEEL_IDLE_MS)
  }

  /** Scrolling-Wheel-Delta normalisieren (deltaMode: 0 px, 1 Zeilen, 2 Seiten) */
  function normalizeWheel(e: WheelEvent){
    let scale = 1
    if (e.deltaMode === 1) scale = 16
    else if (e.deltaMode === 2) scale = window.innerHeight
    return e.deltaY * scale // >0 = nach unten
  }

  /** Center-Detection für ein Frame-Element */
  function elementCentered(el: HTMLElement | null){
    if (!el) return { centered:false, dist:Infinity }
    const r = el.getBoundingClientRect()
    const vpH = window.innerHeight
    const centerY = vpH / 2
    const elCenterY = r.top + r.height / 2
    const tol = Math.max(TOL_MIN_PX, Math.round(vpH * TOL_RATIO))
    const intersects = r.bottom > 0 && r.top < vpH
    const dist = Math.abs(elCenterY - centerY)
    return { centered: intersects && dist <= tol, dist }
  }

  /** Liefert key des zentriertesten Frames (innerhalb Toleranz) */
  function getActiveTarget(){
    const candidates = visualizations
      .map(v => ({ key: v.key, ...elementCentered(v.ref?.value || null) }))
      .filter(c => c.centered)

    if (!candidates.length) return null
    candidates.sort((a,b)=>a.dist-b.dist)
    return candidates[0].key
  }

  /** Zugriff auf Wert + Setter + Grenzen (pro Target) */
  function getScrubberFor(targetKey: string | null){
    if (!targetKey) return null
    const v = visualizations.find(x => x.key === targetKey)
    if (!v) return null
    const min = v.min ?? opts.min
    const max = v.max ?? opts.max
    return {
      get: () => v.year.value,
      set: (val: number) => { v.year.value = clampYear(val, min, max) },
      min, max
    }
  }

  // ===== Event-Handler =====
  function handleWheel(e: WheelEvent){
    // Eingaben in Formularfeldern nicht kapern
    const activeEl = document.activeElement as HTMLElement | null
    if (activeEl && activeEl.tagName === 'INPUT') return

    const dPix = normalizeWheel(e)
    const targetKey = getActiveTarget()

    if (!targetKey){
      scrollCapture = false
      resetWheelAccum()
      return
    }
    scrollCapture = true

    const scr = getScrubberFor(targetKey)
    if (!scr) return

    const cur = scr.get()
    if ((dPix > 0 && cur === scr.max) || (dPix < 0 && cur === scr.min)){
      resetWheelAccum()
      return
    }

    e.preventDefault()
    wheelAccum += dPix
    if (Math.abs(wheelAccum) >= WHEEL_PX_PER_YEAR){
      const dir = wheelAccum > 0 ? 1 : -1
      scr.set(cur + dir)
      wheelAccum -= dir * WHEEL_PX_PER_YEAR
    }
    scheduleWheelReset()
  }

  function handleTouchStart(e: TouchEvent){
    if (e.touches.length === 1) lastTouchY = e.touches[0].clientY
  }

  function handleTouchMove(e: TouchEvent){
    if (lastTouchY == null) return
    const touchY = e.touches[0].clientY
    const d = lastTouchY - touchY
    const targetKey = getActiveTarget()

    if (!targetKey){
      scrollCapture = false
      touchAccum = 0
      lastTouchY = touchY
      return
    }
    scrollCapture = true

    const scr = getScrubberFor(targetKey)
    if (!scr) return
    const cur = scr.get()

    if ((d > 0 && cur === scr.max) || (d < 0 && cur === scr.min)){
      touchAccum = 0
      lastTouchY = touchY
      return
    }

    e.preventDefault()
    touchAccum += d
    while (Math.abs(touchAccum) >= TOUCH_PX_PER_YEAR){
      const dir = touchAccum > 0 ? 1 : -1
      scr.set(scr.get() + dir)
      touchAccum -= dir * TOUCH_PX_PER_YEAR
    }
    lastTouchY = touchY
  }

  function handleTouchEnd(){ lastTouchY = null; touchAccum = 0 }

  /** Keyboard: nur fürs zentrierteste Target */
  function handleKeydown(e: KeyboardEvent){
    const targetKey = getActiveTarget()
    if (!targetKey) return
    const scr = getScrubberFor(targetKey)
    if (!scr) return
    const cur = scr.get()

    if (["ArrowUp","PageUp"].includes(e.key)){ e.preventDefault(); scr.set(cur - 1) }
    else if (["ArrowDown","PageDown"].includes(e.key)){ e.preventDefault(); scr.set(cur + 1) }
    else if (e.key === "Home"){ e.preventDefault(); scr.set(scr.min) }
    else if (e.key === "End"){ e.preventDefault(); scr.set(scr.max) }
  }

  /** Window-Scroll */
  function handleWindowScroll(){ if (window.scrollY === 0) scrollCapture = false }

  // ===== Listener an Frames (Chrome braucht das) =====
  function bindFrameListeners(el: HTMLElement | null){
    if (!el) return
    el.addEventListener('wheel',      handleWheel,      { passive:false })
    el.addEventListener('touchstart', handleTouchStart, { passive:false })
    el.addEventListener('touchmove',  handleTouchMove,  { passive:false })
    el.addEventListener('touchend',   handleTouchEnd,   { passive:false })
  }
  function unbindFrameListeners(el: HTMLElement | null){
    if (!el) return
    el.removeEventListener('wheel',      handleWheel as EventListener)
    el.removeEventListener('touchstart', handleTouchStart as EventListener)
    el.removeEventListener('touchmove',  handleTouchMove as EventListener)
    el.removeEventListener('touchend',   handleTouchEnd as EventListener)
  }

  // ===== Mount/Unmount =====
  onMounted(() => {
    // Window-Listener
    window.addEventListener('wheel',      handleWheel,      { passive:false })
    window.addEventListener('touchstart', handleTouchStart, { passive:false })
    window.addEventListener('touchmove',  handleTouchMove,  { passive:false })
    window.addEventListener('touchend',   handleTouchEnd,   { passive:false })
    window.addEventListener('keydown',    handleKeydown,    true)
    window.addEventListener('scroll',     handleWindowScroll)

    // Direkt an die Frames binden
    visualizations.forEach(v => bindFrameListeners(v.ref.value))
  })

  onBeforeUnmount(() => {
    window.removeEventListener('wheel', handleWheel as EventListener)
    window.removeEventListener('touchstart', handleTouchStart as EventListener)
    window.removeEventListener('touchmove', handleTouchMove as EventListener)
    window.removeEventListener('touchend', handleTouchEnd as EventListener)
    window.removeEventListener('keydown', handleKeydown as EventListener, true as any)
    window.removeEventListener('scroll', handleWindowScroll as EventListener)

    visualizations.forEach(v => unbindFrameListeners(v.ref.value))
  })
}