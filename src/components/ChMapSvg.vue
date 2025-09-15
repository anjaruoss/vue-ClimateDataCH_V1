<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as d3 from 'd3'

const YEAR_MIN = 1971, YEAR_MAX = 2018

const props = defineProps({
  year:      { type: Number, required: true },
  dataDir:   { type: String,  default: '/data' },
  svgBg:     { type: String,  default: '#fff' },
  textColor: { type: String,  default: '#000' },
})

/* ===== Fixes viewBox-Koordinatensystem ===== */
const vbW = 1200, vbH = 740
const padL = 24, padT = 24, padB = 24, padR = 24
const contentMin = [padL, padT]
const contentMax = [vbW - padR, vbH - padB]

/* ===== Daten & Skalen ===== */
let projection = d3.geoMercator()
const geoPath   = d3.geoPath().projection(projection)

const paths        = ref([])
const byYearByName = ref(new Map())
const colorScale   = ref(null)
const domainMin    = ref(0)
const domainMax    = ref(1)

const norm = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const nameAlias = {}

const NO_DATA = '#b0b0b0'

/* ===== Eigene Farbpalette =====*/
const PALETTE = [
  "#0e2741", "#153d6a", "#1f5a92", "#2f79af", "#5497c0",
  "#80b4cf", "#b3cfdd", "#c9dbe6", "#dfe6ef", "#e8d6bf",
  "#efb884", "#e47f57", "#de6d4d", "#d35245", "#c83f3e",
  "#a71f3a", "#6f0b25"
]

// LCH wenn verfügbar, sonst Lab – als sanfter Interpolator
const interpolateBase = d3.interpolateLch || d3.interpolateLab
const interpolateCustom = d3.piecewise(interpolateBase, PALETTE)

/* (noch vorhanden, aber ungenutzt – lassen wir für minimale Änderungen drin) */
function buildThresholdScale(min, max, palette = PALETTE){
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max){
    const mid = palette[Math.floor(palette.length/2)] ?? "#ccc"
    return d3.scaleThreshold().domain([min]).range([mid, mid])
  }
  const n = palette.length
  const ticks = d3.ticks(min, max, n)
  const thresholds = ticks.slice(1, -1)
  let range = palette
  if (thresholds.length + 1 !== palette.length){
    range = d3.quantize(t => d3.interpolateRgbBasis(palette)(t), thresholds.length + 1)
  }
  return d3.scaleThreshold().domain(thresholds).range(range)
}

/* ===== HUD – responsive Größen (an viewBox gekoppelt) ===== */
const wrapEl = ref(null)
const frameW = ref(vbW)
const frameH = ref(vbH)

let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => {
    const r = e?.contentRect
    if (!r) return
    frameW.value = r.width  || vbW
    frameH.value = r.height || vbH
  })
  if (wrapEl.value) ro.observe(wrapEl.value)
})
onBeforeUnmount(() => ro?.disconnect())

const hudScale = computed(() => {
  const s = Math.min(frameW.value / vbW, frameH.value / vbH)
  return Math.max(0.6, Math.min(2.0, s))
})
const clamp = (x,a,b) => Math.min(b, Math.max(a, x))

// Design-Werte (bei 1200×740) → skaliert
const design = { gap:24, yearSize:36, legendW:8, legendH:140, legendFont:12 }

const leftPx       = computed(() => Math.round(design.gap * hudScale.value))
const topPx        = computed(() => Math.round(design.gap * hudScale.value))
const yearFontPx   = computed(() => Math.round(clamp(design.yearSize * hudScale.value, 12, 40)) + 'px')
const legendBarW   = computed(() => Math.round(clamp(design.legendW  * hudScale.value, 10, 36)))
const legendBarH   = computed(() => Math.round(clamp(design.legendH  * hudScale.value, 80, 300)))
const legendFontPx = computed(() => Math.round(clamp(design.legendFont* hudScale.value, 9, 18)) + 'px')

// Legenden-Gradient
const legendId = `legend-${Math.random().toString(36).slice(2)}`
function legendValue(p){ const t=p/100; return domainMax.value*(1-t) + domainMin.value*t }

/* ===== Laden & Fitting ===== */
onMounted(async () => {
  const geo = await d3.json(`${props.dataDir}/gemeinden.geojson`)

  const featsAll = (geo?.features ?? [])
  const feats = featsAll.filter(f => {
    const gt = f?.geometry?.type
    return gt === 'Polygon' || gt === 'MultiPolygon'
  })

  const fc = { type: 'FeatureCollection', features: feats }
  projection = d3.geoMercator().fitExtent([contentMin, contentMax], fc)
  geoPath.projection(projection)

  paths.value = feats.map(f => {
    const d = geoPath(f)
    const key = f?.properties?.id ?? f?.properties?.gml_id ?? f?.properties?.NAME ?? f?.properties?.name
    return d ? { d, f, key } : null
  }).filter(Boolean)

  // *** Parser fix: 0 bleibt 0, nur leere/ungültige Werte → null
  const rows = await d3.csv(`${props.dataDir}/lau_lvl_data_temperatures_ch.csv`, d => {
    if (d.CNTR_CODE !== 'CH') return null
    const v = d.avg_year === "" || d.avg_year == null ? null : +d.avg_year
    return { year:+d.year, LAU_LABEL:d.LAU_LABEL, avg_year: Number.isFinite(v) ? v : null }
  })

  byYearByName.value = d3.rollup(
    rows.filter(d => d.year >= 1971 && d.year <= 2018),
    v => v.length === 1 ? v[0].avg_year : d3.mean(v, d => d.avg_year),
    d => d.year,
    d => {
      let k = norm(d.LAU_LABEL)
      if (nameAlias[k]) k = nameAlias[k]
      return k
    }
  )

  const allVals = []
  for (const [yr, m] of byYearByName.value.entries()) {
    if (yr < 1971 || yr > 2018) continue
    for (const v of m.values()) if (v != null) allVals.push(v)
  }

  const ext = d3.extent(allVals)
  domainMin.value = ext[0]; domainMax.value = ext[1]

  // *** Kontinuierliche Skala mit sanfter LCH/Lab-Interpolation
  colorScale.value = d3.scaleSequential(interpolateCustom)
    .domain([domainMin.value, domainMax.value])
    .clamp(true)
})

/* Seen erkennen */
function isLakeFeature(f){
  const p = f?.properties || {}
  const gem = +p.GEM_FLAECH || 0
  const see = +p.SEE_FLAECH || 0
  const pop = +p.EINWOHNERZ || 0
  return see > 0 && Math.abs(gem - see) < 1e-9 && pop === 0
}

/* ===== Farbe je Feature & Jahr ===== */
function fillFor(f) {
  if (isLakeFeature(f)) return '#ffffff'   // Seen: weiss
  if (!colorScale.value) return NO_DATA
  const m = byYearByName.value.get(+props.year); if (!m) return NO_DATA
  let k = norm(f?.properties?.NAME || f?.properties?.name); if (nameAlias[k]) k = nameAlias[k]
  const val = m.get(k)
  return Number.isFinite(val) ? colorScale.value(val) : NO_DATA
}
</script>

<template>
  <div class="map-wrap" ref="wrapEl">
    <svg
      class="map-svg"
      :viewBox="`0 0 ${vbW} ${vbH}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Karte Schweiz"
    >
      <rect :width="vbW" :height="vbH" :fill="svgBg" />
      <g v-if="paths.length">
        <path
          v-for="p in paths"
          :key="p.key"
          :d="p.d"
          :fill="fillFor(p.f)"
          stroke="none"
          stroke-width="0"
        />
      </g>
    </svg>

    <!-- HUD -->
    <div class="hud">
      <!-- Jahr -->
      <div
        class="hud-year"
        :style="{ color:textColor, left:leftPx + 'px', top:topPx + 'px', fontSize:yearFontPx }"
      >{{ year }}</div>

      <!-- Legende -->
      <div class="hud-legend" v-if="colorScale" :style="{ right:leftPx+'px', top:topPx+'px' }">
        <div class="legend-label" :style="{ fontSize: legendFontPx }">{{ domainMax.toFixed(1) }} °C</div>
        <svg class="legend-bar" :width="legendBarW" :height="legendBarH" viewBox="0 0 16 180" preserveAspectRatio="none">
          <defs>
            <linearGradient :id="legendId" x1="0" y1="0" x2="0" y2="1">
              <stop v-for="i in 101" :key="i" :offset="(i-1)/100" :stop-color="colorScale(legendValue(i-1))" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="16" height="180" :fill="`url(#${legendId})`" rx="2" />
        </svg>
        <div class="legend-label" :style="{ fontSize: legendFontPx }">{{ domainMin.toFixed(1) }} °C</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-wrap { position: relative; width: 100%; height: 100%; }
.map-svg  { width: 100%; height: 100%; display: block; stroke: none; stroke-width: 0; }

.hud { position: absolute; inset: 0; pointer-events: none; }

.hud-year {
  position: absolute;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,.25);
  z-index: 3;
}

.hud-legend{
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 3;
  pointer-events: none;
}

.legend-bar{ display:block; }
.legend-label{ line-height:1; color:#000; }
</style>