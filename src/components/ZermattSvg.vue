<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as d3 from 'd3'

/* ===== Props ===== */
const props = defineProps({
  dataDir: { type: String, default: '/data' },
  year:    { type: Number, default: null }
})

/* ===== ViewBox/Layout ===== */
const vbW = 1160
const vbH = 470
const margin = { top: 92, right: 28, bottom: 48, left: 60 }
const plotL = margin.left
const plotR = vbW - margin.right
const plotT = margin.top
const plotB = vbH - margin.bottom
const plotW = plotR - plotL
const plotH = plotB - plotT
const headroomTop = 20

/* ===== Responsive HUD ===== */
const wrapEl = ref(null)
const frameW = ref(vbW), frameH = ref(vbH)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    if (!e) return
    frameW.value = e.contentRect.width || vbW
    frameH.value = e.contentRect.height || vbH
  })
  if (wrapEl.value) ro.observe(wrapEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

const scale = computed(() => Math.min(frameW.value / vbW, frameH.value / vbH))
const leftPx = computed(() => Math.round(20 * scale.value))
const topPx  = computed(() => Math.round(14 * scale.value))

/* Anschrift tiefer */
const hudOffsetPx = computed(() => Math.round(20 * scale.value))

const titleFontPx    = computed(() => Math.round(16 * scale.value) + 'px')
const subtitleFontPx = computed(() => Math.round(12 * scale.value) + 'px')
const tickFontPx     = computed(() => Math.round(11 * scale.value) + 'px')

/* ===== Daten laden & filtern ===== */
const rows = ref([])
const data = ref([]) // [{year, avg}]
const ready = computed(() => data.value.length > 1)

const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

onMounted(async () => {
  // Robuster Parser: 0 bleibt 0, leere/ungültige → null
  const csv = await d3.csv(`${props.dataDir}/lau_lvl_data_temperatures_ch.csv`, d => {
    if (d.CNTR_CODE !== 'CH') return null
    const v = d.avg_year === "" || d.avg_year == null ? null : +d.avg_year
    return { CNTR_CODE: d.CNTR_CODE, LAU_LABEL: d.LAU_LABEL, year: +d.year, avg_year: Number.isFinite(v) ? v : null }
  })
  rows.value = csv

  data.value = csv
    .filter(d =>
      d.LAU_LABEL === 'Zermatt' &&
      d.year >= 1971 &&
      d.year <= 2018 &&
      d.avg_year != null
    )
    .map(d => ({ year: d.year, avg: d.avg_year }))
    .sort((a, b) => d3.ascending(a.year, b.year))
})

/* ===== Skalen ===== */
const xDomain = computed(() => d3.extent(data.value, d => d.year) ?? [1971, 2018])
const yDomain = computed(() => {
  const ext = d3.extent(data.value, d => d.avg)
  if (!ext || ext[0] == null) return [0, 1]
  const pad = Math.max(1, (ext[1] - ext[0]) * 0.1)
  return [Math.floor(ext[0] - pad), Math.ceil(ext[1] + pad)]
})

function xScale(year) {
  const [a, b] = xDomain.value
  return plotL + ((year - a) / (b - a)) * plotW
}
function yScale(v) {
  const [y0, y1] = yDomain.value
  const t = (v - y0) / (y1 - y0)
  return plotB - t * plotH
}

/* ===== Ticks ===== */
const xTicks = computed(() => {
  const [a, b] = xDomain.value
  const out = []
  for (let y = Math.ceil(a / 5) * 5; y <= b; y += 5) out.push(y)
  return out
})
const yTicks = computed(() => {
  const [y0, y1] = yDomain.value
  const step = Math.max(1, Math.round((y1 - y0) / 6))
  const out = []
  for (let y = Math.ceil(y0); y <= Math.floor(y1); y += step) out.push(y)
  if (out.length > 0) out.pop()
  return out
})

/* ===== Linie (Cardinal Spline als Unterlage) ===== */
const pts = computed(() => data.value.map(d => [xScale(d.year), yScale(d.avg)]))
const smoothPath = computed(() => cardinalSplinePath(pts.value, 0.15))

function cardinalSplinePath(points, tension = 0.15) {
  if (!points || points.length === 0) return ''
  if (points.length < 3) return `M${points.map(p => p.join(',')).join(' L')}`
  const path = [`M${points[0][0]},${points[0][1]}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const t = tension
    const cp1x = p1[0] + (p2[0] - p0[0]) * t / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) * t / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) * t / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) * t / 6
    path.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`)
  }
  return path.join(' ')
}

/* ===== Gemeinsame Domain für die Farbe ===== */
const globalExtent = computed(() => {
  if (!rows.value?.length) return [0, 1]
  const vals = rows.value
    .filter(d => d.avg_year != null && d.year >= 1971 && d.year <= 2018)
    .map(d => d.avg_year)
  const ext = d3.extent(vals)
  return (ext[0] == null) ? [0, 1] : ext
})

/* ===== Farb-Logik ===== */

/* Eigene Farbpalette */
const PALETTE = [
  "#0e2741", "#153d6a", "#1f5a92", "#2f79af", "#5497c0",
  "#80b4cf", "#b3cfdd", "#c9dbe6", "#dfe6ef", "#e8d6bf",
  "#efb884", "#e47f57", "#de6d4d", "#d35245", "#c83f3e",
  "#a71f3a", "#6f0b25"
]

const interpolateBase = d3.interpolateLch || d3.interpolateLab
const interpolateCustom = d3.piecewise(interpolateBase, PALETTE)

/* Kontinuierliche Skala (geclamped), gemeinsame Domain */
const colorScaleVal = computed(() =>
  d3.scaleSequential(interpolateCustom)
    .domain(globalExtent.value)  // gleiche Domain wie die Karte
    .clamp(true)
)

/* ===== Segmente (für Gradients) ===== */
const segGradUID = `seg-${Math.random().toString(36).slice(2)}`
const segments = computed(() => {
  const out = []
  for (let i = 0; i < data.value.length - 1; i++) {
    const a = data.value[i]
    const b = data.value[i + 1]
    if (!Number.isFinite(a.avg) || !Number.isFinite(b.avg)) continue
    out.push({
      i, a, b,
      x1: xScale(a.year), y1: yScale(a.avg),
      x2: xScale(b.year), y2: yScale(b.avg)
    })
  }
  return out
})

/* ===== Aktuelles Jahr + Marker-Farbe (nach Wert) ===== */
const minYear = computed(() => xDomain.value[0])
const maxYear = computed(() => xDomain.value[1])

const chosenYear = computed(() => {
  if (!data.value.length) return null
  const y = (props.year ?? maxYear.value)
  return Math.min(maxYear.value, Math.max(minYear.value, Math.round(y)))
})

const cur = computed(() => {
  if (!data.value.length || chosenYear.value == null) return null
  let best = data.value[0], dbest = Math.abs(best.year - chosenYear.value)
  for (const d of data.value) {
    const dd = Math.abs(d.year - chosenYear.value)
    if (dd < dbest) { best = d; dbest = dd }
  }
  return best
})
const curPt = computed(() => (cur.value ? [xScale(cur.value.year), yScale(cur.value.avg)] : null))
const curColor = computed(() => cur.value ? colorScaleVal.value(cur.value.avg) : '#888')

/* ===== Helper ===== */
function formatTemp(v, digits = 1) {
  if (v == null || Number.isNaN(v)) return ''
  const num = Math.abs(v).toFixed(digits)
  return (v < 0 ? '−' : '') + num + '°C'
}
</script>

<template>
  <div class="chart-wrap" ref="wrapEl">
    <svg
      class="chart-svg"
      :viewBox="`0 ${-headroomTop} ${vbW} ${vbH + headroomTop}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Hintergrund -->
      <rect :x="0" :y="-headroomTop" :width="vbW" :height="vbH + headroomTop" fill="#fff" />

      <!-- Grosse Temperaturenanzeige + Jahr darunter -->
      <text
        x="50%"
        :y="-headroomTop"
        dominant-baseline="hanging"
        text-anchor="middle"
        font-size="70"
        font-weight="700"
        :fill="curColor"
        style="font-family: inherit; letter-spacing: 1.5px;"
      >
        {{ cur ? formatTemp(cur.avg, 1) : '' }}
        <tspan x="50%" dy="2.5em" font-size="32" font-weight="700">
          {{ cur ? cur.year : '' }}
        </tspan>
      </text>

      <!-- Gradients: Ein Gradient pro Liniensegment (weiche Übergänge a->b) -->
      <defs v-if="ready">
        <linearGradient
          v-for="s in segments"
          :key="`g-${segGradUID}-${s.i}`"
          :id="`seg-grad-${segGradUID}-${s.i}`"
          gradientUnits="userSpaceOnUse"
          :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
        >
          <stop offset="0" :stop-color="colorScaleVal(s.a.avg)" />
          <stop offset="1" :stop-color="colorScaleVal(s.b.avg)" />
        </linearGradient>
      </defs>

      <!-- Grid + Achsen -->
      <g v-if="ready">
        <g v-for="(t, i) in yTicks" :key="'y-'+i">
           <line :x1="labelColumnX" :x2="labelColumnX" :y1="plotT - 40" :y2="plotB" />
          <text :x="labelColumnX + 2" :y="yScale(t)" text-anchor="start" dominant-baseline="middle" :font-size="tickFontPx * 1.3" fill="#4b4b4b">
            {{ t.toFixed(0) }}°C
          </text>
        </g>

        <line :x1="plotL" :x2="plotR" :y1="plotB" :y2="plotB" stroke="#000" opacity="0.15"/>
        <g v-for="(yr, i) in xTicks" :key="`x-${i}`">
          <line :x1="xScale(yr)" :x2="xScale(yr)" :y1="plotB" :y2="plotB + 6" stroke="#000" opacity="0.4"/>
          <text :x="xScale(yr)" :y="plotB + 28" text-anchor="middle" :font-size="tickFontPx * 1.3" fill="#4b4b4b">
            {{ yr }}
          </text>
        </g>

        <!-- Datengesteuerte, segmentierte Linie mit Verlaufs-Stroke -->
        <g>
          <line
            v-for="s in segments"
            :key="`seg-${s.i}`"
            :x1="s.x1" :y1="s.y1"
            :x2="s.x2" :y2="s.y2"
            :stroke="`url(#seg-grad-${segGradUID}-${s.i})`"
            stroke-width="7"
            stroke-linecap="round"
            fill="none"
            opacity="0.95"
          />
        </g>

        <!-- Highlight-Marker (aktuelles Jahr) -->
        <g v-if="curPt">
          <circle :cx="curPt[0]" :cy="curPt[1]" r="15" fill="#fff" :stroke="curColor" stroke-width="4.5" />
          <circle :cx="curPt[0]" :cy="curPt[1]" r="7.5" :fill="curColor" />
        </g>
      </g>
    </svg>

    <!-- "Anschrift" der Grafik -->
    <div
      class="linien-title"
      :style="{ left: leftPx + 'px', top: (topPx + hudOffsetPx + 40*scale) + 'px'}"
    >
      Zermatt · 1971–2018
    </div>
    <div
      class="linien-subtitle"
      :style="{ left: leftPx + 'px', top: (topPx + hudOffsetPx + 70*scale) + 'px'}"
    >
      Ø Jahrestemperatur
    </div>
  </div>
</template>

<style scoped>
.chart-wrap { position: relative; width: 100%; height: 100%; }
.chart-svg  { width: 100%; height: 100%; display: block; }

.linien-title {
  position: absolute;
  font-size: 14px;
  font-weight: 700;
  color: #222;
  font-family: "Source Serif 4", ui-serif, Georgia, "Times New Roman", Times, serif;
}
.linien-subtitle {
  position: absolute;
  font-size: 9px;
  font-weight: 600;
  color: #444;
  font-family: "Source Serif 4", ui-serif, Georgia, "Times New Roman", Times, serif;
  margin-top: 5px;
}

text { font-family: "Source Serif 4", ui-serif, Georgia, "Times New Roman", Times, serif; }
</style>