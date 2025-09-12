<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue"
import ScrollProgress from "./components/ScrollProgress.vue"
import ChMapSvg from "./components/ChMapSvg.vue"
import GmMapSvg from "./components/GmMapSvg.vue"
import ZermattSvg from "./components/ZermattSvg.vue"
import BiereSvg from "./components/BiereSvg.vue"

/* Gemeinsame Zeitspanne */
const startYear = 1971
const endYear   = 2018

/* ChMapSvg */
const dataDir = "/data"
const year    = ref(startYear)

/* GmMapSvg */
const dataDirGm = "/data"
const yearGm    = ref(2018)

/*  Liniendiagramme (scrubbable)  */
const zermattYear = ref(startYear)
const biereYear  = ref(startYear)

/* Frame-Referenzen */
const mapEl    = ref(null)   // ChMapSvg Frame
const zermattEl = ref(null)   // Zermatt Diagramm Frame
const biereEl  = ref(null)   // Bière Diagramm Frame

const frameH = ref(520)
let resizeObs = null
function updateFrameH(){
  const el = mapEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  frameH.value = Math.max(0, Math.round(r.height))
}

/* Center-Detection & Target-Routing */
function elementCentered(el){
  if (!el) return { centered:false, dist:Infinity }
  const r = el.getBoundingClientRect()
  const vpH = window.innerHeight
  const centerY = vpH / 2
  const elCenterY = r.top + r.height / 2
  const tol = Math.max(32, Math.round(vpH * 0.25))
  const intersects = r.bottom > 0 && r.top < vpH
  const dist = Math.abs(elCenterY - centerY)
  return { centered: intersects && dist <= tol, dist }
}

/* Wähle den zentriertesten Frame (innerhalb Toleranz) */
function getActiveTarget(){
  const cMap    = elementCentered(mapEl.value)
  const cZermatt = elementCentered(zermattEl.value)
  const cBiere  = elementCentered(biereEl.value)

  const candidates = [
    { key:"map",    ...cMap },
    { key:"zermatt", ...cZermatt},
    { key:"biere",  ...cBiere }
  ].filter(c => c.centered)

  if (candidates.length === 0) return null
  candidates.sort((a,b) => a.dist - b.dist)
  return candidates[0].key 
}

/* Für jedes Target: Zugriff auf Wert + Setter + Grenzen */
function getScrubberFor(target){
  if (target === "map"){
    return {
      get: () => year.value,
      set: (v) => { year.value = clampYear(v) },
      min: startYear, max: endYear
    }
  }
  if (target === "zermatt"){
    return {
      get: () => zermattYear.value,
      set: (v) => { zermattYear.value = clampYear(v) },
      min: startYear, max: endYear
    }
  }
  if (target === "biere"){
    return {
      get: () => biereYear.value,
      set: (v) => { biereYear.value = clampYear(v) },
      min: startYear, max: endYear
    }
  }
  return null
}

/* Scroll-/Touch-/Keyboard-Handling */
let scrollCapture = false
let lastTouchY = null

function clampYear(val){ return Math.max(startYear, Math.min(endYear, val)) }

/* Geschwindigkeiten */
const WHEEL_PX_PER_YEAR = 50
const TOUCH_PX_PER_YEAR = 50
let wheelAccum = 0
let touchAccum = 0
let wheelIdleTimer = null

function resetWheelAccum(){
  wheelAccum = 0
  if (wheelIdleTimer){ clearTimeout(wheelIdleTimer); wheelIdleTimer = null }
}
function scheduleWheelReset(){
  clearTimeout(wheelIdleTimer)
  wheelIdleTimer = setTimeout(resetWheelAccum, 120)
}

/* Scrolling-Wheel-Delta normalisieren (deltaMode: 0 px, 1 Zeilen, 2 Seiten) */
function normalizeWheel(e){
  let scale = 1
  if (e.deltaMode === 1) scale = 16
  else if (e.deltaMode === 2) scale = window.innerHeight
  return e.deltaY * scale // >0 = nach unten
}

/* Scrolling-Wheel */
function handleWheel(e){
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return
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

/* ---- Touch ---- */
function handleTouchStart(e){ if (e.touches.length === 1) lastTouchY = e.touches[0].clientY }
function handleTouchMove(e){
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

/* ---- Keyboard: nur fürs zentrierteste Target ---- */
function handleKeydown(e){
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

/* ---- Window-Scroll ---- */
function handleWindowScroll(){ if (window.scrollY === 0) scrollCapture = false }

/* ---- Mount/Unmount ---- */
onMounted(() => {
  nextTick(updateFrameH)
  if (window.ResizeObserver){
    resizeObs = new ResizeObserver(updateFrameH)
    if (mapEl.value) resizeObs.observe(mapEl.value)
  }
  window.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('touchstart', handleTouchStart, { passive: false })
  window.addEventListener('touchmove', handleTouchMove, { passive: false })
  window.addEventListener('touchend', handleTouchEnd, { passive: false })
  window.addEventListener('keydown', handleKeydown, true)
  window.addEventListener('scroll', handleWindowScroll)
})
onBeforeUnmount(() => {
  if (resizeObs && mapEl.value) resizeObs.unobserve(mapEl.value)
  window.removeEventListener('wheel', handleWheel)
  window.removeEventListener('touchstart', handleTouchStart)
  window.removeEventListener('touchmove', handleTouchMove)
  window.removeEventListener('touchend', handleTouchEnd)
  window.removeEventListener('keydown', handleKeydown, true)
  window.removeEventListener('scroll', handleWindowScroll)
})

/* ===== Neutrale Bindings für vorhandene Styles ===== */
const contentPullUp  = computed(() => "0px")
const contentTitleA  = computed(() => 1)
const contentTitleDy = computed(() => 0)
</script>

<template>
  <div id="app">
    <main class="app-body">
      <section class="frame-bg" :style="{ marginTop: contentPullUp }">
        <div class="frame-inner">
          <div class="content-card">
            <div class="content-intro" :style="{ opacity: contentTitleA, transform: `translateY(${contentTitleDy}px)` }"></div>
            <article class="text-block">
              <h1 class="title">So stark hat sich das Klima in Ihrer Gemeinde verändert</h1>
              <h2 id="article-subtitle" class="subtitle">
                Die Schweiz gehört zu den Hotspots des Klimawandels. 
                Eine Datenanalyse zeigt, wie sich die Temperaturen seit den 1960er-Jahren verändert haben — auch vor Ihrer Haustüre.
              </h2>

            <!-- Scroll-Progress-Bar -->
              <ScrollProgress
                anchor="#article-subtitle"
                height="2.5px"
                color="#111"
                track="rgba(2,25,72,.15)"
                top="0"
              />

              <div class="author"> Anja Ruoss</div>

              <p>Klimawandel ist kein fernes Phänomen — ob in den Städten, wo Hitzeperioden spürbar zunehmen, oder in den Bergen, wo Lawinen, Murgänge und Steinschläge drohen: Die Auswirkungen sind vielfältig und direkt.</p>
              <p>Seit Beginn der Industrialisierung hat sich die Erde im Schnitt um rund 1,3 Grad erwärmt. In der Schweiz liegt dieser Wert sogar <strong> bei 2,9 Grad </strong>. Damit gehört das Land zu den Hotspots des Klimawandels. Gründe dafür sind unter anderem die geografische Lage im Herzen Europas und die Sensibilität der Alpenregion.</p>
              <p>Die folgende Karte zeigt, wie sich die durchschnittlichen Jahrestemperaturen von 1971 bis 2018 in allen Schweizer Gemeinden entwickelt haben.</p>

              <!-- ChMapSvg mit Scroll -->
              <div class="svg-frame" ref="mapEl" tabindex="0" aria-label="Karten-Zeitnavigation" style="outline:none; position:relative;">
                <ChMapSvg :year="year" :data-dir="dataDir" />
              </div>
                <div class="bildlegende">
                  Die Karte zeigt die Entwicklung der mittleren Jahrestemperaturen in der Schweiz von 1971 bis 2018. Grundlage sind modellbasierte Schätzungen aus dem europäischen Klimadatenprojekt Copernicus in Zusammenarbeit mit dem Europäischen Zentrum für mittelfristige Wettervorhersage (ECMWF).
                  <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" target="_blank" rel="noopener" style="font-style: italic;">Quelle: UERRA-Regionalreanalyse</a>
              </div>

              <p> Laut einer europaweiten Analyse des <a href="https://www.europeandatajournalism.eu/" target="_blank" rel="noopener">European Data Journalism Network (EDJNet)</a> liegt die Zunahme in allen Landesteilen über einem Grad, in vielen Regionen deutlich darüber.</p>
              <p> Warum steigt die Temperatur in manchen Gemeinden schneller als in anderen? Mehrere Faktoren spielen zusammen: Hohe Bevölkerungsdichte und intensive Bodennutzung führen oft zu einem Wärmeinseleffekt. Gleichzeitig sind Bergregionen stark betroffen, wo steigende Temperaturen zu weniger Schneefall und auftauendem Permafrost führen.</p>

              <h3>Zwei Gemeinden, zwei Geschichten</h3>
              <p> Ein Beispiel dafür ist Zermatt. Im beliebten Walliser Tourismusort am Fusse des Matterhorns ist die durchschnittliche Jahrestemperatur von <strong> −3.9 °C (1971) auf −2.5 °C (2018) </strong> gestiegen — um <strong> rund 1.4 °C</strong>.</p>

              <!-- Liniendiagramm Zermatt mit Scroll -->
              <div class="linien-frame" ref="zermattEl" tabindex="0" aria-label="Zeitnavigation Diagramm Zermatt" style="outline:none;">
                <ZermattSvg :year="zermattYear" />
              </div>

              <p> Im Gegensatz dazu steht die Gemeinde Bière im Kanton Waadt, wo sich die mittlere Jahrestemperatur im selben Zeitraum von <strong> 9.2 °C auf 10.1 °C </strong> erhöhte — ein Anstieg um <strong>rund 1.0 °C </strong>.</p>

              <!-- Liniendiagramm Bière mit Scroll -->
              <div class="linien-frame" ref="biereEl" tabindex="0" aria-label="Zeitnavigation Diagramm Bière" style="outline:none;">
                <BiereSvg :year="biereYear" />
              </div>

              <div class="bildlegende">
                Die Liniendiagramme zeigen die durchschnittlichen Jahrestemperaturen der beiden Gemeinden Zermatt und Bière seit 1971.
                <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" target="_blank" rel="noopener" style="font-style: italic;">Quelle: UERRA-Regionalreanalyse</a>
              </div>

              <p> Die Diagramme machen sichtbar, wie sich viele einzelne Jahre zu einem klaren langfristigen Trend summieren.</p>

              <h3>Was bedeutet das für Ihre Gemeinde?</h3>
              <p> Das Projekt «Glocal Climate Change» hat Temperaturdaten von mehr als 100'000 europäischen Gemeinden ausgewertet. 
                  Für jede Gemeinde wurde <strong> Durchschnittstemperatur der 1960er-Jahre mit jener des Zeitraums 2009–2018 </strong> verglichen. So lässt sich erkennen, wo der Klimawandel besonders stark spürbar ist – und wie Ihre eigene Gemeinde im landesweiten Vergleich abschneidet.</p>

              <!-- GmMapSvg -->
              <div class="map-frame">
                <GmMapSvg :data-dir="dataDirGm" :year="yearGm" />
              </div>
              <div class="bildlegende">
                Die Karte zeigt, um wie viele Grad Celsius sich die mittlere Jahrestemperatur in den Schweizer Gemeinden zwischen den 1960er-Jahren (1961–1970) und der Periode 2009–2018 verändert hat. Grundlage sind Schätzungen aus dem Copernicus-Programm und vom Europäischen Zentrum für mittelfristige Wettervorhersage (ECMWF).
                <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" target="_blank" rel="noopener" style="font-style: italic;">Quelle: UERRA-Regionalreanalyse</a>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
/* === Google Fonts laden (direkt hier via @import) === */
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap');

/* === Typo-Setup: NZZ-ähnliche Hierarchie === */
:root{
  --headline-font: "Merriweather", "Source Serif 4", ui-serif, Georgia, "Times New Roman", Times, serif;
  --text-font: "Source Serif 4", ui-serif, Georgia, "Times New Roman", Times, serif;
  --text-color: #111;
  --s-1: 16px;
  --s-2: 24px;
  --s-3: 32px;
}

html, body, #app{
  font-family: var(--text-font);
  color: var(--text-color);
  font-weight: 400;                 /* Source Serif 4 Regular */
  line-height: 1.75;                /* ruhige Zeitungssatzbreite */
  font-optical-sizing: auto;        /* nutzt optische Größen der Variable Font */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}


.title{
  font-family: var(--headline-font);
  font-weight: 700;                 /* Merriweather Bold */
  line-height: 1.25;
  letter-spacing: 0.2px;
  color: #000;
  margin: 0 0 0.4em 0;
  text-align:center;
  margin-bottom: var(--s-1);
  margin-top: var(--s-3);
}

h1, h2, h3{
  font-family: var(--headline-font);
  font-weight: 600;                 /* Merriweather Bold */
  line-height: 1.25;
  letter-spacing: 0.2px;
  color: #000;
  margin: 0 0 0.4em 0;
  margin-bottom: var(--s-2);
  margin-top: var(--s-2);
}

/* feinere Skala, an NZZ angelehnt */
h1, .title{ font-size: clamp(28px, 4.2vw, 46px); }
h2{ font-size: clamp(18px, 2.6vw, 26px); font-weight: 700; }
h3{ font-size: clamp(16px, 2.1vw, 22px); font-weight: 700; }

.subtitle{
  font-family: var(--text-font);    /* Unterzeile als Fliesstext */
  font-weight: 400;
  line-height: 1.6;
  font-size: clamp(14px, 2.2vw, 20px);
  color: #000;
  text-align:center;
  margin-bottom: var(--s-2);
}

.text-block p{
  margin: 0 0 1.05em 0;
  hyphens: auto; /*  für Blocksatz-Fluss */
}

/* Autor */
.author {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  margin: 6px 0 18px 0;
  font-size: 12px;
  letter-spacing: .2px;
  color: #555;
}

.linien-frame {
  width: 100%;
  aspect-ratio: 1160 / 470;  /* passend zu vbW/vbH */
  display: block;
  margin-bottom: var(--s-3);
  margin-top: var(--s-3);
}

/* Rahmen rund um weisse Content-Karte */
.frame-bg{
  --frame-intensity: 40%;
  background-color: rgba(2, 25, 72, 0.88);
  --frame-side: clamp(16px, 3vw, 40px);
  --frame-bottom: clamp(16px, 3vw, 40px);
  padding: 0 var(--frame-side) var(--frame-bottom);
  display: flow-root;
  margin-top: -1px;
}

.frame-inner{
  width: min(94vw, 1200px);
  margin: 0 auto;
  padding-inline: clamp(12px, 2vw, 28px);
}

.content-card{
  background: #fff;
  padding: clamp(18px, 3vw, 36px);
  border-radius:5px;
  margin-top: clamp(16px, 3vw, 40px);
}

.content-intro{ margin: 0 0 16px 0; transition: opacity .18s linear, transform .18s ease-out; }

.text-block{
  width: 100%;
  margin: 16px auto 0;
  color: #213547; /* kannst du auf #111 ziehen, wenn du es noch „druckiger“ willst */
}

/* Bildlegende */
.bildlegende{
  margin-top: 8px;
  font-size: 11px;
  color:#444;
  text-align:center;
  margin-bottom: var(--s-3);
}

/* Karten-Frames */
.map-frame{
  width: 100%;
  aspect-ratio: 1200 / 740;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  margin-bottom: var(--s-3);
  margin-top: var(--s-3);
}

.svg-frame{
  width: 100%;
  aspect-ratio: 1200 / 740;
  background: #fff;
  position: relative;
  z-index: 1;
  overflow: visible;
  margin: 0 !important;
  padding: 0 !important;
  border-radius: 6px;
}
</style>