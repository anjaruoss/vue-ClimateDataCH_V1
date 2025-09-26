<script setup>
import { onMounted, onBeforeUnmount, ref, computed } from "vue"

const props = defineProps({
  anchor: { type: String, default: null },
  height: { type: String, default: "3px" },
  color:  { type: String, default: "#111" },
  track:  { type: String, default: "rgba(0,0,0,.08)" },
  top:    { type: String, default: "0" },
})

const stuck = ref(false)
const progress = ref(0) 

let io = null
let raf = null

function computeProgress(){
  const sh = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  )
  const ch = window.innerHeight
  const max = Math.max(1, sh - ch)
  const y = window.scrollY || window.pageYOffset || 0
  progress.value = Math.min(1, Math.max(0, y / max))
}

function onScroll(){
  // rAF-throttle
  if (raf) return
  raf = requestAnimationFrame(() => {
    computeProgress()
    raf = null
  })
}

onMounted(() => {
  computeProgress()
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll, { passive: true })

  // Anchor beobachten → stuck toggeln
  if (props.anchor){
    const el = document.querySelector(props.anchor)
    if (el && "IntersectionObserver" in window){
      io = new IntersectionObserver(([entry]) => {
        // stuck = Anchor ist NICHT sichtbar (oberhalb rausgescrollt)
        stuck.value = !entry.isIntersecting && (entry.boundingClientRect.top <= 0)
      }, { root: null, threshold: [0] })
      io.observe(el)
    } else {
      // Fallback: wenn kein IO oder kein El → immer sticky oben
      stuck.value = true
    }
  }
})
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll)
  window.removeEventListener("resize", onScroll)
  if (io) io.disconnect()
  if (raf) cancelAnimationFrame(raf)
})

const barStyle = computed(() => ({
  "--sp-h": props.height,
  "--sp-color": props.color,
  "--sp-track": props.track,
  "--sp-top": props.top,
  "--sp-p": String(progress.value),
}))
</script>

<template>
  <!-- Wrapper rendert zwei Varianten: inline (unter dem Subtitel) und fixed (stuck) -->
  <div class="sp-wrap" :style="barStyle">
    <div class="sp-inline" :class="{ hidden: stuck }">
      <div class="sp-track">
        <div class="sp-bar" :style="{ transform: `scaleX(${progress})` }"/>
      </div>
    </div>

    <div class="sp-fixed" :class="{ shown: stuck }" aria-hidden="true">
      <div class="sp-track">
        <div class="sp-bar" :style="{ transform: `scaleX(${progress})` }"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sp-wrap { position: relative; width: 100%; }

/* Inline-Variante: nimmt Breite des Inhalts an */
.sp-inline { width: 100%; }
.sp-inline.hidden { display: none; }

/* Fixed-Variante: klebt oben über die ganze Viewportbreite */
.sp-fixed {
  position: fixed;
  left: 0; right: 0;
  top: var(--sp-top);
  z-index: 1000;
  display: none;
}
.sp-fixed.shown { display: block; }

.scroll-progress { touch-action: pan-y; }

/* Track + Bar */
.sp-track {
  height: var(--sp-h);
  background: var(--sp-track);
  transform: translateZ(0);
}
.sp-bar {
  height: 100%;
  background: var(--sp-color);
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform 80ms linear;
}
</style>