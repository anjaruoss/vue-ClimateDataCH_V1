<script setup>
import { useTransform } from "motion-v"

const props = defineProps({
  positionX: { type: Number, default: 0 },
  positionY: { type: Number, default: 0 },
  yRange: { type: Object, required: true },     // z.B. useScroll().scrollYProgress
  threshold: { type: Array, default: () => [0, 1] }, // [start, end]
})

// 0 → 1 innerhalb des Schwellenbereichs
const opacity = useTransform(props.yRange, props.threshold, [0, 1], { clamp: true })
</script>

<template>
  <div :style="{ position:'absolute', left: positionX+'px', top: positionY+'px', opacity: opacity }">
    <slot />
  </div>
</template>

<style scoped>
h2, p, .font-bold { margin: 0; }
.font-bold { font-weight: 700; font-size: 16px; }
</style>