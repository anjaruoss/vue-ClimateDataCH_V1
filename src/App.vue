<script setup>
import { ref, computed, watch, nextTick } from "vue"
import * as d3 from 'd3'
import ScrollProgress from "./components/ScrollProgress.vue"
import ChMapSvg from "./components/ChMapSvg.vue"
import ZermattSvg from "./components/ZermattSvg.vue"
import BiereSvg from "./components/BiereSvg.vue"
import GmMapSvg from "./components/GmMapSvg.vue"
import GmLinieSvg from "./components/GmLinieSvg.vue"

// zentrales Scrubber-Composable
import { useScrubber } from "./composables/Scrubber"

/* Gemeinsame Zeitspanne */
const startYear = 1971
const endYear   = 2018

/* ChMapSvg */
const dataDir = "/data"
const year    = ref(startYear)

/*  Liniendiagramme Zermatt/Biere */
const zermattYear = ref(startYear)
const biereYear   = ref(startYear)

/* GmMapSvg */
const yearGm    = ref(2018)

/*  GmLinieSvg  */
const gmSelectedName = ref(null)   // Name der aktuell gewählten Gemeinde (aus GmMapSvg)
const gmHasData = ref(false)
const gmLinieYear    = ref(startYear)  // eigener Scrubber-State fürs Gemeindediagramm
const gmLinieEl      = ref(null)       // Frame-Container des GmLinieSvg (für Scrubber)

/* Frame-Referenzen (Container-Elemente) */
const mapEl     = ref(null)   // ChMapSvg Frame
const zermattEl = ref(null)   // Zermatt Diagramm Frame
const biereEl   = ref(null)   // Bière Diagramm Frame

// Schlankes, einheitliches Scrubber-State-Handling
const visualizations = [
  { key: 'map',     ref: mapEl,     year },            // nutzt gemeinsame Grenzen
  { key: 'zermatt', ref: zermattEl, year: zermattYear },
  { key: 'biere',   ref: biereEl,   year: biereYear   },
  // dynamischees Linien-Diagramm für die ausgewählte Gemeinde
  { key: 'gmline',  ref: gmLinieEl, year: gmLinieYear },
]

// Aktiviert Scroll-/Touch-/Keyboard-Routing auf den zentriertesten Frame
useScrubber(visualizations, {
  min: startYear,
  max: endYear,
  wheelPxPerYear: 50,   // Geschwindigkeiten (dein bisheriger Standard)
  touchPxPerYear: 50,
  tolMinPx: 32,         // Center-Detection Toleranz
  tolRatioVp: 0.25,
  wheelIdleMs: 120
})

// Prüfe, ob es für die gewählte Gemeinde Daten gibt
async function checkGmData(name) {
  if (!name) {
    gmHasData.value = false
    return
  }
  const csv = await d3.csv(`${dataDir}/lau_lvl_data_temperatures_ch.csv`, d3.autoType)
  const found = csv.some(d => d.CNTR_CODE === 'CH' && d.LAU_LABEL === name && +d.year >= 1971 && d.avg_year != null)
  gmHasData.value = found
}


function focusGmLinieEl(retries = 10) {
  if (!gmLinieEl.value) return
  const el = gmLinieEl.value
  const rect = el.getBoundingClientRect()
  const inViewport = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0
  if (inViewport) {
    el.focus()
    return
  }
  // Scrolliere das Element ins Zentrum, falls nicht sichtbar
  el.scrollIntoView({ block: 'center', behavior: 'auto' })
  if (retries > 0) {
    setTimeout(() => focusGmLinieEl(retries - 1), 50)
  }
}

watch(gmSelectedName, (name) => {
  if (name) {
    gmLinieYear.value = startYear
    checkGmData(name)
    nextTick(() => focusGmLinieEl())
  } else {
    checkGmData(name)
  }
}, { immediate: true })

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
              <div class="svg-frame" ref="mapEl" tabindex="0" style="outline:none; position:relative;">
                <ChMapSvg :year="year" :data-dir="dataDir" />
              </div>
              <div class="bildlegende">
                Die Karte zeigt die Entwicklung der mittleren Jahrestemperaturen in der Schweiz von 1971 bis 2018.
                <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" target="_blank" rel="noopener" style="font-style: italic;">Quelle: UERRA-Regionalreanalyse</a>
              </div>

              <p> Laut einer europaweiten Analyse des <a href="https://www.europeandatajournalism.eu/" target="_blank" rel="noopener">European Data Journalism Network (EDJNet)</a> liegt die Zunahme in allen Landesteilen über einem Grad, in vielen Regionen deutlich darüber.</p>
              <p> Warum steigt die Temperatur in manchen Gemeinden schneller als in anderen? Mehrere Faktoren spielen zusammen: Hohe Bevölkerungsdichte und intensive Bodennutzung führen oft zu einem Wärmeinseleffekt. Gleichzeitig sind Bergregionen stark betroffen, wo steigende Temperaturen zu weniger Schneefall und auftauendem Permafrost führen.</p>

              <h3>Zwei Gemeinden, zwei Geschichten</h3>
              <p> Ein Beispiel dafür ist Zermatt. Im beliebten Walliser Tourismusort am Fusse des Matterhorns ist die durchschnittliche Jahrestemperatur von <strong> −3.9 °C (1971) auf −2.5 °C (2018) </strong> gestiegen — um <strong> rund 1.4 °C</strong>.</p>

              <!-- Liniendiagramm Zermatt mit Scroll -->
              <div class="linien-frame" ref="zermattEl" tabindex="0" style="outline:none;">
                <ZermattSvg :year="zermattYear" />
              </div>

              <p> Im Gegensatz dazu steht die Gemeinde Bière im Kanton Waadt, wo sich die mittlere Jahrestemperatur im selben Zeitraum von <strong> 9.2 °C auf 10.1 °C </strong> erhöhte — ein Anstieg um <strong>rund 1.0 °C </strong>.</p>

              <!-- Liniendiagramm Bière mit Scroll -->
              <div class="linien-frame" ref="biereEl" tabindex="0" style="outline:none;">
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
                <GmMapSvg
                  :data-dir="dataDir"
                  :year="yearGm"
                  @gemeinde-selected="gmSelectedName = $event"
                  @close-gemeinde-info="gmSelectedName = null"
                />
              </div>
              <div class="bildlegende">
                Die Karte zeigt, um wie viele Grad Celsius sich die mittlere Jahrestemperatur in den Schweizer Gemeinden zwischen den 1960er-Jahren (1961–1970) und der Periode 2009–2018 verändert hat.
                <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" target="_blank" rel="noopener" style="font-style: italic;">Quelle: UERRA-Regionalreanalyse</a>
              </div>

              <!--  Linien-SVG unterhalb: nur wenn eine Gemeinde ausgewählt ist und Daten vorhanden sind -->
              <div v-if="gmSelectedName && gmHasData" class="linien-frame" ref="gmLinieEl" tabindex="0" style="outline:none;">
                <GmLinieSvg
                  :name="gmSelectedName"
                  :year="gmLinieYear"
                  :data-dir="dataDir"
                />
              <div class="bildlegende" v-if="gmSelectedName">
                Das Liniendiagramm zeigt die durchschnittlichen Jahrestemperaturen der Gemeinde {{ gmSelectedName }} seit 1971.
                <a href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview" 
                  target="_blank" 
                  rel="noopener" 
                >
                Quelle: UERRA-Regionalreanalyse
                </a>
              </div>
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
  --measure: 62ch;
  --measure-sub: 68ch;
  --measure-h1: 28ch;  /* Haupttitel */
  --measure-h3: 30ch;  /* Zwischentitel */
  --s-1: 16px;
  --s-2: 24px;
  --s-3: 32px;
}

html, body, #app{
  font-family: var(--text-font);
  color: var(--text-color);
  font-weight: 400;
  line-height: 1.75;
  font-optical-sizing: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.title{
  font-family: var(--headline-font);
  font-weight: 700;
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
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.2px;
  color: #000;
  margin: 0 0 0.4em 0;
  margin-bottom: var(--s-2);
  margin-top: var(--s-2);
}
h3{ margin-top: 50px;}

/* feinere Skala, an NZZ angelehnt */
h2{ font-size: clamp(18px, 2.6vw, 26px); font-weight: 700; }
h3{ font-size: clamp(16px, 2.1vw, 22px); font-weight: 700; }

.subtitle{
  font-family: var(--text-font);
  font-weight: 400;
  line-height: 1.6;
  font-size: clamp(14px, 2.2vw, 20px);
  color: #000;
  text-align:center;
  margin-bottom: var(--s-2);
}

/* Autor */
.author{
  max-width: var(--measure-sub);
  margin: 6px auto 18px;   /* statt 6px 0 18px 0 */
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 12px;
  letter-spacing: .2px;
  color: #555;
}


/* Breite Untertitel */
.text-block .subtitle{
  max-width: var(--measure-sub);
  margin-left: auto;
  margin-right: auto;
}

/*Breite Text-Elemente im Artikel */
.text-block h2,
.text-block p {
  max-width: var(--measure);
  margin-left: auto;
  margin-right: auto;
}

/* Haupttitel enger und zentriert */
.text-block h1,
.text-block .title{
  max-width: var(--measure-h1);
  margin-left: auto;
  margin-right: auto;
  text-wrap: balance;   /* hübschere Zeilenumbrüche */
  hyphens: none;
}
/* Zwischentitel enger und zentriert */
.text-block h3{
  max-width: var(--measure-h3);
  margin-left: auto;
  margin-right: auto;
  text-wrap: balance;
  hyphens: none;
}

/* ausdrücklich NICHT einschränken: Grafik-/Karten-Frames & Bildlegenden */
.text-block .svg-frame,
.text-block .linien-frame,
.text-block .map-frame,
.text-block .bildlegende {
  max-width: none;   /* überschreibt die measure, falls geerbt */
  width: 100%;
}

/* Diagramm-Frames (responsive, Chrome-friendly) */
.linien-frame {
  width: 100%;
  aspect-ratio: 1160 / 470;  /* passend zu vbW/vbH der Diagramme */
  display: block;
  margin-bottom: var(--s-3);
  margin-top: var(--s-3);
  /* WICHTIG für Chrome: Touch/Wheel an die Komponente durchreichen */
  touch-action: none;
  overscroll-behavior: contain;
}

/* Rahmen rund um weisse Content-Karte */
.frame-bg{
  --frame-intensity: 30%;
  background-color: rgba(231, 231, 231, 0.88);
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
  border-radius:3px;
  margin-top: clamp(16px, 3vw, 40px);
}

.content-intro{ margin: 0 0 16px 0; transition: opacity .18s linear, transform .18s ease-out; }

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

/* ChMap-Frame (separat, weil ohne overflow hidden) */
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

  /* Wichtig für Chrome: Touch/Wheel an die Komponente durchreichen */
  touch-action: none;
  overscroll-behavior: contain;
}
</style>