<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue"
import ChMapSvg from "./components/ChMapSvg.vue"
import GmMapSvg from "./components/GmMapSvg.vue"
import BrioneSvg from "./components/ZermattSvg.vue"
import BiereSvg from "./components/BiereSvg.vue"

/* ===== Zeitsteuerung Karte 1 ===== */
const startYear = 1971
const endYear   = 2018
const dataDir   = "/data"
const year      = ref(startYear)

/* ===== Karte 2 ===== */
const dataDirGm = "/data"
const yearGm    = ref(2018)

</script>

<template>
  <div id="app">
    <main class="app-body">
      <!-- ===== Content-Abschnitt & 2. Karte ===== -->
      <section class="frame-bg" :style="{ marginTop: contentPullUp }">
        <div class="frame-inner">
          <div class="content-card">
            <div class="content-intro" :style="{ opacity: contentTitleA, transform: `translateY(${contentTitleDy}px)` }"></div>
            <article class="text-block">
              <h1 class="title">So hat sich das Klima in Ihrer Gemeinde verändert</h1>
                <h2 class="subtitel" style="margin-top: 8px; font-weight: normal; font-size: clamp(14px, 2.5vw, 20px);">
                Die globale Erwärmung findet vor der eigenen Haustüre statt. 
                Datenanalysen zeigen im Detail, wie sich die Temperaturen in den einzelnen Gemeinden seit den 1960er-Jahren verändert haben.
                </h2>
              <p> Klimawandel ist kein fernes Phänomen, sondern ein lokales. 
                  Er findet vor der eigenen Haustüre statt — ob in den Städten, wo Hitzeperioden spürbar zunehmen, oder in den Bergen, wo Lawinen, Murgänge und Steinschläge drohen: Die Auswirkungen sind vielfältig und direkt.
            </p>
             <p> Seit Beginn der Industrialisierung hat sich die Erde im Schnitt um rund 1,3 Grad erwärmt. In der Schweiz liegt dieser Wert sogar bei 2,9 Grad. Damit gehört das Land zu den Hotspots des Klimawandels. Gründe dafür sind unter anderem die geografische Lage im Herzen Europas und die Sensibilität der Alpenregion
            </p>
              <p> Laut einer europaweiten Analyse des <a href="https://www.europeandatajournalism.eu/" target="_blank" rel="noopener"> European Data Journalism Network (EDJNet)</a>, die auf Temperaturdaten von Copernicus und dem Europäischen Zentrum für mittelfristige Wettervorhersage (ECMWF), liegt die Zunahme in allen Landesteilen über einem Grad, in vielen Regionen sogar deutlich darüber.
            </p>
            <p> Warum aber steigt die Temperatur in manchen Gemeinden schneller als in anderen? Mehrere Faktoren spielen zusammen: Hohe Bevölkerungsdichte und intensive Bodennutzung führen oft zu einem sogenannten Wärmeinseleffekt. Gleichzeitig sind auch Bergregionen stark betroffen, wo steigende Temperaturen zu weniger Schneefall und auftauendem Permafrost führen.
            </p>
              <h3>Zwei Gemeinden, zwei Geschichten</h3>
              <p> Ein Beispiel dafür ist Zermatt. Im beliebten Walliser Tourismusort am Fusse des Matterhorns, hat sich die mittlere Jahrestemperatur seit 1971 um und 7.1 °C erwärmt — das ist der höchste Anstieg aller Gemeinden in der Schweiz.
            </p>
                <!-- Liniendiagramm Brione -->
            <div class="brione-frame">
                <BrioneSvg />
              </div>
             <p> Im Gegensatz dazu steht die Gemeinde Bière im Kanton Waadt, welche mit einem Temperaturanstieg von 2.85 °C die kleinste Veränderung unter allen Gemeinden aufweist.
            </p>
            <!-- Liniendiagramm Biere -->
            <div class="biere-frame">
                <BiereSvg />
              </div>
            <div class="bildlegende-outer">
              Die Liniendiagramme zeigen die durchschnittliche Jahrestemperatur für jedes Jahr seit 1971. 
              Einzeljahre schwanken stark, aber in Zermatt ist der langfristige Aufwärtstrend deutlich sichtbar — während Bière relativ stabil bleibt.
            </div>
            <h3>Was bedeutet das für Ihre Gemeinde?</h3>

            <!-- Erste Karte im Content Block -->
            <div class="map-frame">
              
              <GmMapSvg :data-dir="dataDirGm" :year="yearGm" />
            </div>
            <div class="bildlegende-outer">
              Die Karte zeigt, um wie viele Grad Celsius sich die mittlere Jahrestemperatur in den Schweizer Gemeinden zwischen den 1960er-Jahren (1961–1970) und der Periode 2009–2018 verändert hat. 
              Grundlage sind Schätzungen aus dem Copernicus-Programm und vom Europäischen Zentrum für mittelfristige Wettervorhersage (ECMWF).
              <a
                href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview"
                target="_blank" rel="noopener" style="font-style: italic;"
              >Quelle: UERRA-Regionalreanalyse</a>
            </div>
            <p> Seit den 1960er-Jahren war jedes Jahrzehnt wärmer als das vorherige. Die Jahre 2022, 2023 und 2024 waren mit Abstand die heissesten seit Messbeginn. Auch die Extremwetterlagen haben zugenommen: mehr Hitzetage, intensivere Starkniederschläge, trockenere Sommer und schneearme Winter.
            </p>
              <p><h3>Globaler Trend – lokal sichtbar</h3>
               Das Projekt «Glocal Climate Change» hat Temperaturdaten von mehr als 100'000 europäischen Gemeinden ausgewertet. Für jede Gemeinde wurde die Durchschnittstemperatur der 1960er-Jahre mit jener des Zeitraums 2009 bis 2018 verglichen. In der Schweiz zeigt sich: Seit den 1960er-Jahren ist die mittlere Jahrestemperatur um mindestens ein Grad gestiegen.
            </p>
            </article>
        
            <!-- Zweite Karte im Content Block -->
            <div
              class="svg-frame"
              ref="svgFrameEl"
            >
              <ChMapSvg :year="year" :data-dir="dataDir" />
              <div class="bildlegende-outer">
                Die Karte zeigt die Entwicklung der mittleren Jahrestemperaturen in der Schweiz von 1971 bis 2018. 
                Grundlage sind modellbasierte Schätzungen aus dem europäischen Klimadatenprojekt Copernicus in Zusammenarbeit mit dem Europäischen Zentrum für mittelfristige Wettervorhersage (ECMWF). 
                <a
                  href="https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview"
                  target="_blank" rel="noopener" style="font-style: italic;"
                >Quelle: UERRA-Regionalreanalyse</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
/* Eigener Rahmen für BrioneSvg */
.brione-frame svg {
  width: 600px;
  height: auto;
  max-width: none;
}
/* ===== Rahmen rund um weisse Content-Karte ===== */
.frame-bg{
  --frame-intensity: 40%;
  background-color: rgba(115, 148, 159, 0.5); /* halbtransparent */

  /* Seiten-/Unterkante sichtbar, oben bündig */
  --frame-side: clamp(16px, 3vw, 40px);
  --frame-bottom: clamp(16px, 3vw, 40px);
  padding: 0 var(--frame-side) var(--frame-bottom);
  display: flow-root;
  margin-top: -1px;
}

/* Maximalbreite & Seiteneinzug des Gesamtinhalts */
.frame-inner{
  width: min(94vw, 1200px);
  margin: 0 auto;
  padding-inline: clamp(12px, 2vw, 28px);
}

/* Content & 2. Karte */
.content-card{
  background: #fff;
  padding: clamp(18px, 3vw, 36px);
  border-radius:5px;
  margin-top: clamp(16px, 3vw, 40px); /* Rahmen oben wie unten */
}

/* Text im Content-Block */
.content-intro{ margin: 0 0 16px 0; transition: opacity .18s linear, transform .18s ease-out; }
.intro-title{ margin: 0; font-size: clamp(18px, 3.2vw, 32px); line-height: 1.2; color: #111; }

.text-block{
  width: 100%;
  margin: 16px auto 0;
  line-height: 1.8;
  color: #213547;
}
.text-block h2{ margin: 0 0 8px; font-size: 15px; }

/* Der Frame steuert die SVG-Größe; GmMapSvg füllt 100% */
.map-frame{
  width: 100%;
  aspect-ratio: 1200 / 740;   /* unverzerrt */
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.bildlegende-outer{
  margin-top: 8px;
  font-size: 10px;
  color:#333;
  text-align:center;
}



</style>