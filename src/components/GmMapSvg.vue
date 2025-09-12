<script setup>
const emit = defineEmits(['gemeinde-selected', 'close-gemeinde-info'])
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import * as d3 from 'd3'

/* Props */
const props = defineProps({
  dataDir:   { type: String,  default: '/data' },
  year:      { type: Number,  default: 2018 },
  svgBg:     { type: String,  default: '#ffffff' },
  searchPlaceholder: { type: String, default: 'Gemeinde suchen …' },
  minZoom:   { type: Number,  default: 0.5 },
  maxZoom:   { type: Number,  default: 8 },
  uiScale:   { type: Number,  default: 1.0 },   // weiterhin für Search/Buttons
  zoomScale: { type: Number,  default: 1.0 },   // weiterhin für Buttons
})

/* ViewBox & Layout */
const vbW = 1200, vbH = 740
const padL = 24, padT = 24, padB = 24, padR = 24
const contentMin = [padL, padT]
const contentMax = [vbW - padR, vbH - padB]

/* D3 path/projection */
let projection = d3.geoMercator()
const geoPath   = d3.geoPath().projection(projection)

/* State */
const wrapEl = ref(null)
const svgEl  = ref(null)
const ready  = ref(false)

const paths  = ref([])
const featuresByKey = ref(new Map())
const nameByKey     = ref(new Map())

const hoveredKey  = ref(null)
const selectedKey = ref(null)

const tooltip = ref({ show:false, x:0, y:0, name:'' })
const infoPos = ref({ show:false, x:0, y:0 })

/* Suche */
const searchQuery   = ref('')
const suggestions   = ref([])
const suggestIndex  = ref(-1)

/* Werte */
const variationByKey = ref(new Map())
const colorScale   = ref(null)
const domainMin    = ref(0)
const domainMax    = ref(1)

/* ===== UI-Skalierung (bestehend) ===== */
const internalScale = ref(1)
function updateUiScale(){
  const r = svgEl.value?.getBoundingClientRect()
  if (!r) return
  internalScale.value = Math.min(r.width / vbW, r.height / vbH) || 1
}
const uiScaleNum   = computed(()=>Math.min(1.6, Math.max(0.75, internalScale.value * props.uiScale)))
const zoomScaleNum = computed(()=>Math.min(1.8, Math.max(0.6,  internalScale.value * props.zoomScale)))
const uiScaleCss   = computed(()=>uiScaleNum.value.toFixed(3))
const zoomScaleCss = computed(()=>zoomScaleNum.value.toFixed(3))

/* ===== Legende (Option A – viewBox-basiert, unabhängig von uiScale) ===== */
const hudScaleLegend = computed(() => Math.max(0.6, Math.min(2.0, internalScale.value)))
const clamp = (x,a,b) => Math.min(b, Math.max(a, x))
const legendBarW = computed(()=> Math.round(clamp(8   * hudScaleLegend.value, 10, 36)))
const legendBarH = computed(()=> Math.round(clamp(140 * hudScaleLegend.value, 80, 300)))
const legendFontPx = computed(()=> Math.round(clamp(12 * hudScaleLegend.value, 10, 18)) + 'px')
const legendId = `legend-${Math.random().toString(36).slice(2)}`
function legendValue(p){ const t=p/100; return domainMax.value*(1-t)+domainMin.value*t }

// (nur für Position im Layout – bestehende Offsets weiterverwenden)
const fitBtnScale   = computed(() => isExpanded.value ? 0.9 : 1.0)
const closeBtnScale = computed(() => isExpanded.value ? 1.1 : 1.2)
const legendOffset  = computed(() => isExpanded.value ? '38px' : '18px')
const searchOffset  = computed(() => isExpanded.value ? '38px' : '18px')

/* Zoom & Pan */
const zoomK = ref(1), panX = ref(0), panY = ref(0)

/* „Hand“-Pan (Pointer Events) */
const isPanning = ref(false)
let lastClientX = 0, lastClientY = 0
let downX = 0, downY = 0, downTime = 0
let moved = false, usedCapture = false
const CLICK_TOL_PX = 6, CLICK_TOL_MS = 300

function onPointerDown(e){
  if (e.button !== 0) return
  isPanning.value = true
  moved = false
  downX = lastClientX = e.clientX
  downY = lastClientY = e.clientY
  downTime = performance.now()
  usedCapture = false
  if (svgEl.value?.setPointerCapture) { svgEl.value.setPointerCapture(e.pointerId); usedCapture = true }
}
function onPointerMove(e){
  if (!isPanning.value) return
  const dxCss = e.clientX - lastClientX
  const dyCss = e.clientY - lastClientY
  lastClientX = e.clientX; lastClientY = e.clientY
  if (!moved && (Math.abs(e.clientX - downX) > CLICK_TOL_PX || Math.abs(e.clientY - downY) > CLICK_TOL_PX)) moved = true
  const rect = svgEl.value.getBoundingClientRect()
  panX.value += (dxCss / rect.width)  * vbW
  panY.value += (dyCss / rect.height) * vbH
  tooltip.value.show = false
  updateInfoBoxPosition()
}
function onPointerUp(e){
  if (svgEl.value?.releasePointerCapture) svgEl.value.releasePointerCapture(e.pointerId)
  const wasClick = !moved && (performance.now() - downTime) < CLICK_TOL_MS
  isPanning.value = false
  if (usedCapture && wasClick) hitSelectAt(e.clientX, e.clientY)
}

function hitSelectAt(clientX, clientY){
  const el = document.elementFromPoint(clientX, clientY)
  if (!el) { clearSelection(); return }
  const inThisSvg = !!svgEl.value && (el === svgEl.value || svgEl.value.contains(el))
  if (!inThisSvg){ clearSelection(); return }
  const pathEl = el.closest('path')
  if (pathEl && svgEl.value.contains(pathEl)) {
    const key = pathEl.getAttribute('data-key')
    if (key) { const p = paths.value.find(x => x.key === key); if (p) { onSelect(p); return } }
  }
  clearSelection()
}

/* Trackpad-Pinch (wheel + ctrlKey) */
function onWheel(e){
  if (!e.ctrlKey) return
  e.preventDefault()
  const factor = Math.pow(1.018, -e.deltaY)
  zoomAtCss(e.clientX, e.clientY, factor)
}
function zoomAtCss(clientX, clientY, factor){
  const k1 = zoomK.value
  const k2 = clamp(k1 * factor, props.minZoom, props.maxZoom)
  if (k1 === k2) return
  const rect = svgEl.value.getBoundingClientRect()
  const Ax = ((clientX - rect.left) / rect.width)  * vbW
  const Ay = ((clientY - rect.top ) / rect.height) * vbH
  const x0 = (Ax - panX.value) / k1
  const y0 = (Ay - panY.value) / k1
  panX.value = Ax - k2 * x0
  panY.value = Ay - k2 * y0
  zoomK.value = k2
  nextTick().then(updateInfoBoxPosition)
}

/* Name-Normalisierung */
const norm = s => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const nameAlias = {}

/* Laden */
let ro
function onWindowResize(){ updateUiScale(); updateInfoBoxPosition() }

onMounted(async () => {
  const [geo, raw] = await Promise.all([
    d3.json(`${props.dataDir}/schweiz_gemeinden.geojson`),
    d3.csv(`${props.dataDir}/lau_lvl_data_temperatures_ch.csv`, d => {
      const yr=+d.year
      if (d.CNTR_CODE==='CH' && yr===+props.year) return { LAU_LABEL:d.LAU_LABEL, variation:d.variation_periods!==''?+d.variation_periods:null }
      return null
    })
  ])
  const rows = raw.filter(Boolean)

  const featsAll = (geo?.features ?? [])
  const feats = featsAll.filter(f =>
    (String(f?.properties?.admin_level) === '8') &&
    (f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon')
  )

  const fc = { type:'FeatureCollection', features:feats }
  const b  = d3.geoBounds(fc)
  const looksLikeLonLat = !(
    b[0][0] <= -179.999 && b[0][1] <= -89.999 &&
    b[1][0] >=  179.999 && b[1][1] >=  89.999
  )
  projection = looksLikeLonLat ? d3.geoMercator() : d3.geoIdentity().reflectY(true)
  projection.fitExtent([contentMin, contentMax], fc)
  geoPath.projection(projection)

  variationByKey.value = new Map()
  for (const r of rows){
    let k = norm(r.LAU_LABEL); if (nameAlias[k]) k = nameAlias[k]
    if (!variationByKey.value.has(k)) variationByKey.value.set(k, r.variation)
  }

  const vals = Array.from(variationByKey.value.values()).filter(v => v!=null && !isNaN(v))
  const ext = d3.extent(vals)
  domainMin.value = ext[0]; domainMax.value = ext[1]
  colorScale.value = d3.scaleSequential().domain(ext).interpolator(d3.interpolateTurbo)

  const P=[], fByKey=new Map(), nByKey=new Map()
  for (const f of feats){
    const d = geoPath(f); if(!d) continue
    const rawName = f?.properties?.name || ''
    let k = norm(rawName); if (nameAlias[k]) k = nameAlias[k]
    const c = geoPath.centroid(f)
    P.push({ d, key:k, f, centroid:c, rawName })
    fByKey.set(k,f); nByKey.set(k,rawName)
  }
  paths.value=P; featuresByKey.value=fByKey; nameByKey.value=nByKey

  ready.value = true
  await nextTick()

  updateUiScale()
  ro = new ResizeObserver(updateUiScale)
  if (svgEl.value) ro.observe(svgEl.value)
  window.addEventListener('resize', onWindowResize, { passive:true })

  // Pointer & Wheel Listener
  const svg = svgEl.value
  svg.addEventListener('pointerdown', onPointerDown)
  svg.addEventListener('pointermove', onPointerMove)
  svg.addEventListener('pointerup', onPointerUp)
  svg.addEventListener('pointercancel', onPointerUp)
  svg.addEventListener('wheel', onWheel, { passive:false })

  // Click-Away + ESC
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('resize', onWindowResize)
  const svg = svgEl.value
  if (svg){
    svg.removeEventListener('pointerdown', onPointerDown)
    svg.removeEventListener('pointermove', onPointerMove)
    svg.removeEventListener('pointerup', onPointerUp)
    svg.removeEventListener('pointercancel', onPointerUp)
    svg.removeEventListener('wheel', onWheel)
  }
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onKeydown)
})

/* Auswahl/Hintergrund/Click-Away */
function clearSelection(){
  if (isPanning.value) return
  selectedKey.value = null
  infoPos.value.show = false
  tooltip.value.show = false
  emit('close-gemeinde-info')
}
function onBackgroundClick(){ clearSelection() }
function onDocumentClick(e){
  const root = wrapEl.value
  if (!root) return
  if (!root.contains(e.target)) {
    if (isExpanded.value) closeExpanded(); else clearSelection()
    return
  }
  if ( isExpanded.value && svgEl.value && !svgEl.value.contains(e.target)) {
    closeExpanded()
    return
  }
}
function onKeydown(e){
  if (e.key === 'Escape'){
    if (isExpanded.value){ closeExpanded(); return }
    clearSelection()
  }
}

/* Farben */
function fillForKey(k){
  const v = variationByKey.value.get(k)
  return (v != null && !isNaN(v)) ? colorScale.value(v) : '#c8c8c8'
}

/* Tooltip/Hover */
function onEnter(p, evt){
  if (isPanning.value) return
  hoveredKey.value = p.key
  tooltip.value.show = true
  tooltip.value.name = p.rawName || ''
  onMove(evt)
}
function onMove(evt){
  if (!tooltip.value.show) return
  const wrap = wrapEl.value?.getBoundingClientRect()
  const x = evt.clientX - (wrap?.left || 0)
  const y = evt.clientY - (wrap?.top  || 0)
  const pad = 10
  tooltip.value.x = Math.max(pad, Math.min(x + 16, (wrap?.width || 0) - 160))
  tooltip.value.y = Math.max(pad, Math.min(y - 10, (wrap?.height|| 0) - 40))
}
function onLeave(){ hoveredKey.value = null; tooltip.value.show = false }

/* Auswahl & Info-Box */
const selectedRawName = computed(()=> nameByKey.value.get(selectedKey.value) || '')
const selectedVariationDisplay = computed(()=>{
  const v = variationByKey.value.get(selectedKey.value)
  return (v != null && !isNaN(v)) ? `${Math.round(v*10)/10} °C` : 'Keine Daten'
})
function onSelect(p){
  if (selectedKey.value === p.key){ 
    selectedKey.value=null; 
    infoPos.value.show=false; 
    emit('gemeinde-selected','close-gemeinde-info');
    return 
  }
  selectedKey.value = p.key
  centerOnKey(p.key, 1.8)
  updateInfoBoxPosition()
  // Emit event with the selected Gemeinde name or key
  emit('gemeinde-selected', nameByKey.value.get(p.key) || p.key)
}
function updateInfoBoxPosition(){
  if (!selectedKey.value || !svgEl.value) return
  const p = paths.value.find(x => x.key === selectedKey.value); if(!p) return
  const xT = zoomK.value * p.centroid[0] + panX.value
  const yT = zoomK.value * p.centroid[1] + panY.value
  const rect = svgEl.value.getBoundingClientRect()
  const xCss = (xT / vbW) * rect.width
  const yCss = (yT / vbH) * rect.height
  infoPos.value = { show:true, x:Math.round(xCss), y:Math.round(yCss - 18) }
}

/* Programmatische Zooms */
function zoomBy(factor){
  const Cx = vbW/2, Cy = vbH/2
  const k1 = zoomK.value
  const k2 = clamp(k1 * factor, props.minZoom, props.maxZoom)
  if (k1 === k2) return
  const x0 = (Cx - panX.value) / k1
  const y0 = (Cy - panY.value) / k1
  panX.value = Cx - k2 * x0
  panY.value = Cy - k2 * y0
  zoomK.value = k2
  nextTick().then(updateInfoBoxPosition)
}
function centerOnKey(key, targetK=null){
  const p = paths.value.find(x => x.key === key); if(!p) return
  const Cx = vbW/2, Cy = vbH/2
  const k = clamp(targetK ?? zoomK.value, props.minZoom, props.maxZoom)
  zoomK.value = k
  panX.value = Cx - k * p.centroid[0]
  panY.value = Cy - k * p.centroid[1]
  nextTick().then(updateInfoBoxPosition)
}

/* Vergrösserungs-Logik */
const isExpanded = ref(false)
function openExpanded(){ if (isExpanded.value) return; isExpanded.value = true;  lockScroll(true);  nextTick(()=>{ updateUiScale(); updateInfoBoxPosition() }) }
function closeExpanded(){ if (!isExpanded.value) return; isExpanded.value = false; lockScroll(false); nextTick(()=>{ updateUiScale(); updateInfoBoxPosition() }) }
function lockScroll(on){
  const b = document.body; if (!b) return
  if (on){ b.dataset._gmOverflow = b.style.overflow || ''; b.style.overflow = 'hidden' }
  else   { b.style.overflow = b.dataset._gmOverflow || ''; delete b.dataset._gmOverflow }
}

/* Suche */
function onSearchInput(){
  const q = norm(searchQuery.value)
  if (!q){ suggestions.value=[]; suggestIndex.value=-1; return }
  const uniq=[], seen=new Set()
  for (const n of paths.value.map(p=>p.rawName).filter(Boolean)){
    const kn = norm(n); if (kn.includes(q) && !seen.has(kn)){ uniq.push(n); seen.add(kn) }
    if (uniq.length>=10) break
  }
  suggestions.value = uniq
  suggestIndex.value = uniq.length ? 0 : -1
}
function moveSuggest(dir){ if(!suggestions.value.length) return; suggestIndex.value=(suggestIndex.value+dir+suggestions.value.length)%suggestions.value.length }
function applySuggest(){ if(!suggestions.value.length) return; selectByName(suggestions.value[suggestIndex.value] || suggestions.value[0]) }
function selectByName(name){
  searchQuery.value = name; suggestions.value=[]; suggestIndex.value=-1
  const k = keyForRaw(name); if(!k) { clearSelection(); return }
  const p = paths.value.find(x=>x.key===k); if(!p) { clearSelection(); return }
  selectedKey.value = k; centerOnKey(k, 1.8); updateInfoBoxPosition()
  emit('gemeinde-selected', nameByKey.value.get(k) || k)
}
function keyForRaw(raw){ const k0=norm(raw); const k=nameAlias[k0]||k0; return featuresByKey.value.has(k)?k:null }
</script>

<template>
  <div
    class="gm-wrap"
    ref="wrapEl"
    :class="{ 'is-expanded': isExpanded }"
    :style="{
      '--fitBtnScale': fitBtnScale,
      '--closeBtnScale': closeBtnScale,
      '--legendOffset': legendOffset,
      '--searchOffset': searchOffset
    }"
  >
    <svg
      ref="svgEl"
      class="gm-svg"
      :class="{ panning: isPanning }"
      :viewBox="`0 0 ${vbW} ${vbH}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="`Gemeindekarte Schweiz (${year})`"
    >
      <rect :width="vbW" :height="vbH" :fill="svgBg" @click="onBackgroundClick" />

      <g class="zoom-layer" :transform="`translate(${panX} ${panY}) scale(${zoomK})`">
        <g v-if="ready && paths.length">
          <path
            v-for="p in paths"
            :key="p.key"
            :d="p.d"
            :fill="fillForKey(p.key)"
            :data-key="p.key"
            :class="{ 'is-hovered': hoveredKey === p.key && selectedKey !== p.key, 'is-selected': selectedKey === p.key }"
            stroke="#fff"
            stroke-width="0.4"
            vector-effect="non-scaling-stroke"
            @mouseenter="onEnter(p, $event)"
            @mousemove="onMove($event)"
            @mouseleave="onLeave"
            @click="onSelect(p)"
          />
        </g>
      </g>
    </svg>

    <!-- HUD -->
    <div class="hud" v-if="ready" :style="{ '--uiScale': uiScaleCss, '--zoomScale': zoomScaleCss }">
      <!-- Legende (Option A) -->
      <div class="hud-legend" :style="{ right: 'var(--legendOffset)', top: 'var(--legendOffset)' }">
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

      <!-- Suche -->
      <div class="hud-search">
        <input
          ref="searchInputEl"
          type="text"
          class="search-input"
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          @input="onSearchInput"
          @keydown.down.prevent="moveSuggest(1)"
          @keydown.up.prevent="moveSuggest(-1)"
          @keydown.enter.prevent="applySuggest()"
        />
        <ul v-show="suggestions.length" class="search-suggest">
          <li v-for="(name,idx) in suggestions" :key="name" :class="{ active: idx === suggestIndex }" @mousedown.prevent="selectByName(name)">
            {{ name }}
          </li>
        </ul>
      </div>

      <!-- Zoom-Buttons -->
      <div class="hud-zoom">
        <button class="zoom-btn" @click="zoomBy(1.1)">+</button>
        <button class="zoom-btn" @click="zoomBy(0.9)">−</button>
      </div>

      <!-- Vergrössern / Schliessen -->
      <div class="hud-fit" v-if="!isExpanded"><button class="zoom-btn" @click="openExpanded">⤢</button></div>
      <div class="hud-close" v-if="isExpanded"><button class="zoom-btn" @click="closeExpanded" title="Zurück">⤡</button></div>
    </div>

    <!-- Info-Box -->
    <div v-if="selectedKey && infoPos.show" class="gm-infobox" :style="{ left: infoPos.x + 'px', top: infoPos.y + 'px' }">
      <div class="info-name">{{ selectedRawName }}</div>
      <div class="info-line">Temperaturanstieg zwischen den 1960er-Jahren und 2009–2018:</div>
      <div class="info-value">{{ selectedVariationDisplay }}</div>
    </div>
  </div>
</template>

<style scoped>
.gm-wrap{ position: relative; width: 100%; height: 100%; }
.gm-svg{ width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
.gm-svg.panning{ cursor: grabbing; }

.gm-wrap.is-expanded{
  position: fixed; left: 50%; top: 50vh; transform: translate(-50%, -50%);
  width: min(98vw, 1200px); height: min(90vh, 500px);
  z-index: 1000; background: #fff; border-radius:5px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}

/* Hover/Select */
path.is-hovered{ stroke:#fff; stroke-width:1.2; filter:drop-shadow(0 0 2px rgba(0,0,0,.4)); }
path.is-selected{ stroke:#000; stroke-width:1.6; filter:drop-shadow(0 0 3px rgba(0,0,0,.55)); }

/* HUD */
.hud{ position:absolute; inset:0; pointer-events:none; }

/* Legende – ohne CSS-Scale-Variablen, Größe kommt aus JS */
.hud-legend{
  position:absolute;
  display:flex; flex-direction:column; align-items:center;
  gap:6px; pointer-events:none;
}
.legend-bar{ display:block; }
.legend-label{ line-height:1; color:#333; text-shadow:0 1px 1px rgba(255,255,255,.5); }

/* Suche */
.hud-search{
  position:absolute;
  left:var(--searchOffset, 18px);
  top:var(--searchOffset, 18px);
  width:min(calc(240px * var(--uiScale)), 36vw);
  pointer-events:auto;
}
.gm-wrap.is-expanded .hud-search{ width:min(calc(300px * var(--uiScale)), 44vw); }
.search-input{
  width:100%; padding:calc(6px * var(--uiScale)) calc(14px * var(--uiScale));
  border-radius:calc(6px * var(--uiScale)); border:1px solid rgba(0,0,0,.2);
  outline:none; font-size:calc(15px * var(--uiScale));
  background:rgba(237, 236, 236, 0.92); backdrop-filter:blur(4px);
}
.gm-wrap.is-expanded .search-input{
  font-size: clamp(12px, calc(16px * var(--uiScale)), 18px);
  padding: calc(8px * var(--uiScale)) calc(14px * var(--uiScale));
}
.search-suggest{
  position:absolute; left:0; right:0; margin:0; padding:8px 0; list-style:none;
  background:rgba(237, 236, 236, 0.92); border:2px solid rgba(0,0,0,.2); border-top:none;
  border-radius:0 0 calc(10px * var(--uiScale)) calc(10px * var(--uiScale));
  box-shadow:0 4px 16px rgba(0,0,0,.12); max-height:260px; overflow:auto;
  font-size:calc(15px * var(--uiScale));
}
.gm-wrap.is-expanded .search-suggest{ font-size:calc(16px * var(--uiScale)); }
.search-suggest li{ padding:8px 14px; cursor:pointer; }
.search-suggest li.active, .search-suggest li:hover{ background:#f1f2f3; }

/* Zoom */
.hud-zoom{
  position:absolute; right:var(--legendOffset, 18px); bottom:var(--legendOffset, 18px);
  display:grid; gap:calc(10px * var(--zoomScale, var(--uiScale))); pointer-events:auto;
}
.gm-wrap.is-expanded .hud-zoom{ gap:calc(16px * var(--zoomScale, var(--uiScale))); }
.zoom-btn{
  display:inline-flex; align-items:center; justify-content:center;
  width:calc(20px * var(--zoomScale, var(--uiScale)));
  height:calc(20px * var(--zoomScale, var(--uiScale)));
  aspect-ratio:1/1; padding:0; border:1px solid rgba(0,0,0,.2);
  background:rgba(237,236,236,.92); font-size:calc(12px * var(--zoomScale, var(--uiScale)));
  line-height:1; font-weight:600; cursor:pointer;
}
.zoom-btn:hover{ background:#fff; }
.gm-wrap.is-expanded .zoom-btn{
  width:calc(26px * var(--zoomScale, var(--uiScale)));
  height:calc(26px * var(--zoomScale, var(--uiScale)));
  font-size:calc(20px * var(--zoomScale, var(--uiScale)));
}

/* Fit/Close */
.hud-fit{ position:absolute; left:var(--legendOffset, 18px); bottom:var(--legendOffset, 18px); pointer-events:auto; }
.hud-fit .zoom-btn{ width: calc(24px * var(--fitBtnScale)); height: calc(24px * var(--fitBtnScale)); font-size: calc(18px * var(--fitBtnScale)); }
.gm-wrap.is-expanded .hud-fit .zoom-btn{ width: calc(26px * var(--fitBtnScale)); height: calc(26px * var(--fitBtnScale)); font-size: calc(20px * var(--fitBtnScale)); }

.hud-close{ position:absolute; left:var(--legendOffset, 18px); bottom:var(--legendOffset, 18px); pointer-events:auto; }
.hud-close .zoom-btn{ width: calc(24px * var(--closeBtnScale)); height: calc(24px * var(--closeBtnScale)); font-size: calc(14px * var(--closeBtnScale)); }
.gm-wrap.is-expanded .hud-close .zoom-btn{ width: calc(26px * var(--closeBtnScale)); height: calc(26px * var(--closeBtnScale)); font-size: calc(20px * var(--closeBtnScale)); }

/* Info-Box */
.gm-infobox{
  position:absolute; transform:translate(-50%,-100%);
  background:rgba(2, 25, 72, 0.8); color:#fff; padding:10px 14px;
  border-radius:10px; max-width:280px; box-shadow:0 6px 18px rgba(0,0,0,.25);
}
.info-name{ font-weight:700; margin-bottom:4px; }
.info-line{ font-size:13px; opacity:.95; }
.info-value{ font-size:22px; font-weight:700; text-align:center; margin-top:4px; }
</style>