<!-- Scrolly.vue -->
<template>
  <section ref="root" class="scrolly">
    <!-- Sticky Bühne -->
    <div class="stage" :style="{ height: viewportHeight + 'px' }">
      <slot name="stage" :progress="progress" :year="year" :yRange="progressRef" />
    </div>

    <!-- Scroll-Strecke -->
    <div class="scrub" :style="{ height: scrubPx + 'px' }" />
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue"

const props = defineProps({
  start:       { type: Number, default: 1971 },
  end:         { type: Number, default: 2018 },
  pxPerYear:   { type: Number, default: 28 },   // 28 px pro Jahr (Feinheit der Scrub-Strecke)
  tailPx:      { type: Number, default: 600 },  // zusätzlicher Auslauf am Ende
  clamp:       { type: Boolean, default: true } // Fortschritt clampen 0..1
})

const root     = ref(null)
const progress = ref(0)         // 0..1
const progressRef = progress    // für kompatible Übergabe an <Annotation yRange=...>
const yearsSpan = computed(() => Math.max(0, props.end - props.start))
const baseLen   = computed(() => Math.max(1, yearsSpan.value * props.pxPerYear))
const scrubPx   = computed(() => Math.round(baseLen.value + props.tailPx + 1))
const year      = computed(() => Math.round(props.start + progress.value * yearsSpan.value))
const viewportHeight = ref(0)

let ro, ticking = false

function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    if (!root.value) { ticking = false; return }
    const rect = root.value.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    // Fortschritt der unteren Kante der sticky Bühne durch die Scrub-Div
    const start = rect.top
    const end   = rect.top + scrubPx.value
    let p = (vh - start) / (end - start)
    if (props.clamp) p = Math.min(1, Math.max(0, p))
    progress.value = isFinite(p) ? p : 0
    ticking = false
  })
}

onMounted(() => {
  viewportHeight.value = window.innerHeight || document.documentElement.clientHeight
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll)
  // ResizeObserver hält Messwerte bei Layoutänderungen frisch
  ro = new ResizeObserver(onScroll)
  ro.observe(root.value)
  onScroll()
})
onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll)
  window.removeEventListener("resize", onScroll)
  if (ro) ro.disconnect()
})
</script>

<style scoped>
.scrolly { position: relative; width: 100%; }
.stage   { position: sticky; top: 0; width: 100%; }
.scrub   { width: 100%; }
</style>