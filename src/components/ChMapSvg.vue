<template>
  <div class="map-wrap" ref="wrapEl">
    <!-- Karte: unverzerrt durch viewBox + meet -->
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
          stroke="#fff"
          stroke-width="0.003"
          vector-effect="non-scaling-stroke"
        />
      </g>
    </svg>

    <!-- HUD (skaliert mit hudScale) -->
    <div class="hud">
      <!-- Jahr -->
      <div
        class="hud-year"
        :style="{
          color: textColor,
          left: leftPx + 'px',
          top:  topPx  + 'px',
          fontSize: yearFontPx
        }"
      >{{ year }}</div>

      <!-- Legende -->
      <div
        class="hud-legend"
        v-if="colorScale"
        :style="{ right: leftPx + 'px', top: topPx + 'px' }"
      >
        <div class="legend-label" :style="{ fontSize: legendFontPx }">
          {{ domainMax.toFixed(1) }} °C
        </div>

        <svg
          class="legend-bar"
          :width="legendBarW"
          :height="legendBarH"
          viewBox="0 0 16 180"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient :id="legendId" x1="0" y1="0" x2="0" y2="1">
              <stop
                v-for="i in 101"
                :key="i"
                :offset="(i-1)/100"
                :stop-color="colorScale(legendValue(i-1))"
              />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="16" height="180" :fill="`url(#${legendId})`" rx="2" />
        </svg>

        <div class="legend-label" :style="{ fontSize: legendFontPx }">
          {{ domainMin.toFixed(1) }} °C
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  year:      { type: Number, required: true },
  dataDir:   { type: String,  default: '/data' },
  svgBg:     { type: String,  default: '#ffffff' },
  textColor: { type: String,  default: '#111' },
})

/* ===== Fixes viewBox-Koordinatensystem ===== */
const vbW = 1200
const vbH = 740

const padL = 24, padT = 24, padB = 24, padR = 24
const contentMin = [padL, padT]
const contentMax = [vbW - padR, vbH - padB]

/* ===== Daten & Skalen ===== */
let projection = d3.geoMercator()
const geoPath   = d3.geoPath().projection(projection)

const gemeinden    = ref([])
const paths        = ref([])
const byYearByName = ref(new Map())
const colorScale   = ref(null)
const domainMin    = ref(0)
const domainMax    = ref(1)

const norm = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const nameAlias = {}

/* ===== HUD – responsive Größen ===== */
const wrapEl = ref(null)
const frameW = ref(vbW)
const frameH = ref(vbH)

let ro
onMounted(() => {
  ro = new ResizeObserver(entries => {
    const r = entries[0]?.contentRect
    if (!r) return
    frameW.value = r.width || vbW
    frameH.value = r.height || vbH
  })
  if (wrapEl.value) ro.observe(wrapEl.value)
})
onBeforeUnmount(() => { ro?.disconnect() })

const hudScale = computed(() => {
  // Skaliere relativ zur viewBox; clamp für Lesbarkeit
  const s = Math.min(frameW.value / vbW, frameH.value / vbH)
  return Math.max(0.6, Math.min(2.0, s))
})
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))

// Design-Werte (bei 1200×740) → skaliert
const design = {
  gap: 24,          // Randabstand (links/rechts/oben)
  yearSize: 28,     // Jahreszahl-Basisgröße
  legendW: 8,      // Balkenbreite
  legendH: 140,     // Balkenhöhe
  legendFont: 12,   // Legenden-Text
}

const leftPx       = computed(() => Math.round(design.gap * hudScale.value))
const topPx        = computed(() => Math.round(design.gap * hudScale.value))
const yearFontPx   = computed(() => Math.round(clamp(design.yearSize * hudScale.value, 12, 40)) + 'px')
const legendBarW   = computed(() => Math.round(clamp(design.legendW * hudScale.value, 12, 36)))
const legendBarH   = computed(() => Math.round(clamp(design.legendH * hudScale.value, 90, 300)))
const legendFontPx = computed(() => Math.round(clamp(design.legendFont * hudScale.value, 9, 18)) + 'px')

// Farbverlauf (HUD-legend eigenes kleines SVG)
const legendId  = `legend-${Math.random().toString(36).slice(2)}`
function legendValue(p) {
  const t = p / 100
  return domainMax.value * (1 - t) + domainMin.value * t
}

/* ===== Laden & Fitting ===== */
onMounted(async () => {
  const geo = await d3.json(`${props.dataDir}/schweiz_gemeinden.geojson`)
  const featsAll = (geo?.features ?? [])
  const feats = featsAll.filter(f => {
    const al = f?.properties?.admin_level ?? f?.properties?.admin_leve
    const gt = f?.geometry?.type
    return String(al) === '8' && (gt === 'Polygon' || gt === 'MultiPolygon')
  })
  gemeinden.value = feats

  const fc = { type: 'FeatureCollection', features: feats }
  const b  = d3.geoBounds(fc)
  const looksLikeLonLat = !(
    b[0][0] <= -179.999 && b[0][1] <= -89.999 &&
    b[1][0] >=  179.999 && b[1][1] >=  89.999
  )
  projection = looksLikeLonLat ? d3.geoMercator() : d3.geoIdentity().reflectY(true)
  projection.fitExtent([contentMin, contentMax], fc)
  geoPath.projection(projection)

  paths.value = feats.map(f => {
    const d = geoPath(f)
    const key = f?.properties?.id ?? f?.properties?.gml_id ?? f?.properties?.name
    return d ? { d, f, key } : null
  }).filter(Boolean)

  requestAnimationFrame(async () => {
    const rows = await d3.csv(`${props.dataDir}/lau_lvl_data_temperatures_ch.csv`, (d) => {
      if (d.CNTR_CODE !== 'CH') return null
      return { year:+d.year, LAU_LABEL:d.LAU_LABEL, avg_year: d.avg_year ? +d.avg_year : null }
    })

    byYearByName.value = d3.rollup(
      rows,
      v => v.length === 1 ? v[0].avg_year : d3.mean(v, d => d.avg_year),
      d => d.year,
      d => {
        let k = norm(d.LAU_LABEL)
        if (nameAlias[k]) k = nameAlias[k]
        return k
      }
    )

    const allVals = []
    for (const m of byYearByName.value.values()) {
      for (const v of m.values()) if (v != null) allVals.push(v)
    }
    const ext = d3.extent(allVals)
    domainMin.value = ext[0]; domainMax.value = ext[1]
    colorScale.value = d3.scaleSequential().domain(ext).interpolator(d3.interpolateTurbo)
  })
})

/* ===== Farbe je Feature & Jahr ===== */
function fillFor(f) {
  if (!colorScale.value) return '#c8c8c8'
  const m = byYearByName.value.get(+props.year)
  if (!m) return '#c8c8c8'
  let k = norm(f?.properties?.name)
  if (nameAlias[k]) k = nameAlias[k]
  const val = m.get(k)
  return val != null ? colorScale.value(val) : '#c8c8c8'
}
</script>

<style scoped>
.map-wrap { position: relative; width: 100%; height: 100%; }
.map-svg  { width: 100%; height: 100%; display: block; }

/* HUD über der Karte; Maus nicht blockieren */
.hud { position: absolute; inset: 0; pointer-events: none; }

/* Jahr links oben – Größen kommen per :style */
.hud-year {
  position: absolute;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,.25);
  z-index: 3;
}

/* Legende rechts oben – Abstände/Größen per :style */
.hud-legend {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 3;
}

.legend-bar   { display: block; }
.legend-label { line-height: 1; color: #333; text-shadow: 0 1px 1px rgba(255,255,255,.4); }
</style>