# Glocal Climate Change — Temperaturentwicklung in der Schweiz

**Datenjournalistisches Visualisierungsprojekt**  
Visualisierung der Temperaturentwicklung in allen Schweizer Gemeinden seit den 1960er-Jahren

---

## Projektbeschreibung

Dieses Projekt zeigt, wie sich die durchschnittlichen Jahrestemperaturen in der Schweiz seit den 1960er-Jahren auf Gemeindeebene verändert haben.  
Eine interaktive Karte visualisiert den Temperaturverlauf von 1971 bis 2018. Ergänzende Liniendiagramme machen den Verlauf einzelner Gemeinden sichtbar. Eine zweite Karte zeigt den langfristigen Unterschied zwischen den 1960er-Jahren (1961–1970) und der Periode 2009–2018.

Die Nutzer:innen können mit einem Zeit-Scrubber durch die Jahrzehnte navigieren, eigene Gemeinden auswählen und im Scrollytelling-Modus besonders betroffene Regionen erkunden.

---

## Ziel

Das Projekt macht komplexe Klimadaten für ein breites Publikum verständlich und veranschaulicht die regional unterschiedlichen Auswirkungen der globalen Erwärmung.  
Es demonstriert zentrale Techniken im Bereich Creative Coding und Data Visualization:

- Verarbeitung und Visualisierung realer Klimadaten
- Kombination von geographischen und zeitlichen Datendimensionen
- Umsetzung interaktiver Datenvisualisierungen im Web
- Integration von Karten, Liniendiagrammen und Scrollytelling in einer kohärenten Anwendung

---

## Datengrundlage

**Quelle:**  
- [UERRA Regional Reanalysis (Copernicus / ECMWF)](https://cds.climate.copernicus.eu/datasets/reanalysis-uerra-europe-single-levels?tab=overview)
- Aufbereitet von [OBC Transeuropa](https://www.balcanicaucaso.org) für das [European Data Journalism Network (EDJNet)](https://www.europeandatajournalism.eu)
- File: `lau_lvl_data_temperatures_ch.csv`

**Zeitraum:**  
- Jahresverlauf: Temperaturdaten 1971–2018 auf Gemeindeebene
- Dekadenvergleich: Temperaturdaten 1961–1970 vs. 2009-2018 auf Gemeindeebene

**Datenstruktur:**  
- Aggregierte jährliche Durchschnittstemperaturen pro Gemeinde  
- Gemittelte Temperaturen für die Perioden 1961–1970 und 2009–2018 (Dekadenvergleich)

**Geographische Daten**
- File: `schweiz_gemeinden.geojson`
- Nutzen: Zeichnet die Gemeinde- und Ladesgrenzen der Schweiz und gibt die Gemeinden als Multipolygone aus

---

## Funktionsweise

Die Visualisierung besteht aus mehreren Komponenten:

- `ChMapSvg.vue` — Karte mit Jahresverlauf (1971–2018)
- `GmMapSvg.vue` — Interaktive Karte mit Dekadenvergleich (1961–1970 vs. 2009–2018)
- `ZermattSvg.vue`, `BiereSvg.vue`, `GmLinieSvg.vue` — Liniendiagramme für Einzelgemeinden
- `ScrollProgress.vue` — Anzeige der Position im Scrollytelling
- `Scrubber.ts` — Zeit-Scrubber zur Scrollytelling-Navigation durch die Jahre

**Techniken:**
- **p5.js** für Canvas-Rendering und Interaktion der Karten
- **D3.js** für Datenverarbeitung, Geo-Projektion und Skalen der Karten
- **Vue.js** als Framework für Komponentenstruktur und Interface
- **TypeScript** für Logik (Scrubber)

---

## Live Demo

Das Projekt kann mit Netlify unter diesem Link angezeigt werden: https://68c5336d58aae224e1f1c351--whimsical-dieffenbachia-2e6d64.netlify.app

---

## Setup & Installation

### Voraussetzungen
- Node.js installiert
- Empfohlen: VS Code mit Vetur- oder Volar-Erweiterung für Vue

### Lokale Installation
1. Repository klonen
2. Im Terminal des Projektordners ausführen:

```bash
npm install
npm i d3
npm run dev

---

## Projektstatus
- Status: Fertiggestellt (Abgabeprojekt)
- Letzte Aktualisierung: September 2025
- Version: 1.0