# Whether Forecast

**[andre8244.github.io/whether-forecast](https://andre8244.github.io/whether-forecast/)**

Most forecasts tell you *what* the weather will be. This one tells you **whether**: a probability
counted from 119 ensemble members across three models, instead of an icon that means whatever you
want it to.

A static, installable weather app in Italian, metric throughout, with perceived temperature as a
first-class value. No API key, no backend, no account.

## Ensembles

One request to Open-Meteo's Ensemble API fetches three models, about 18 kB gzipped:

| Model | Members |
|---|---|
| ECMWF IFS 0.25° | 50 + control |
| DWD ICON global | 39 + control |
| NOAA GEFS 0.25° | 30 + control |

Every figure below is a share of members, computed per model and then averaged with **equal
weight**. Pooling the members would let ECMWF decide 41% of the answer only because it runs more
of them. A model with no usable data for an hour drops out of that hour instead of voting zero.

### Thunderstorms

```
convective    = precipitation >= 0.2 mm AND CAPE >= 500 J/kg, or WMO code >= 95
P_model(hour) = convective members / members with both values
```

Open-Meteo's `thunderstorm_probability` returns `null` for most models, and counting WMO
thunderstorm codes does not work either: global ensembles almost never emit them (0 of 6720
member-hours for ICON, 0 of 5208 for GFS, 14 of 8568 for ECMWF, and zero over the Amazon and
Singapore). Requiring rain *and* the energy behind it separates the cases. Measured live: a Pesaro
thunderstorm afternoon reads 74%, Singapore 66%, frontal rain over Bergen with every member wet 0%.

ICON global EPS serves no CAPE, so the storm figure runs over ECMWF and GFS. Per-model figures are
shown, with a warning when they spread by more than 30 points.

### Rain and snow

The headline condition comes from one deterministic run, Open-Meteo's `best_match` (ICON-D2 over
Italy). It has read "Coperto" through rain more than once, so where that run is dry the ensemble
can overrule it:

| Members with >= 0.1 mm in the hour | Shown |
|---|---|
| 30% or more | 🌦️ *Possibile pioggia* |
| 60% or more | 🌧️ *Pioggia probabile* |

The bands follow NWS ("chance of rain" from 30%, rain from 60%) and Yr (rain once most members
have it). Days use the share of members with at least 1 mm over the day, the WMO rain-day
threshold, counting only the hours left for today. Where the model already has precipitation, its
own code stands, since it carries type and intensity.

The same rule drives the current card, the hourly strip, the chart and the daily list. The 💧
percentage next to each icon is that same share, so the two cannot disagree. Open-Meteo's own
`precipitation_probability` comes from a single 30-member ensemble and is used only when the
ensemble call fails. The *next rain* line names hours that only the ensemble expects as *probabile*
rather than *prevista*.

Without a precipitation code there is no type, so it comes from the 2 m temperature: snow up to
1 °C, *pioggia o neve* up to 3 °C, rain above. For a day, this uses the mean temperature over the
same hours as its rain share. These thresholds are a rule of thumb, not a calibration.

Depths stay deterministic and appear only when non-zero. The ensemble's 25 km members often
disagree with the 2 km run about *when* rain falls, so an icon raised by the ensemble can sit next
to an hour with no depth.

## Convective indices

CAPE, lifted index and CIN from the deterministic run appear in the expandable storm detail, each
on its own published scale. They are never combined into a score, because no source backs a
composition rule. CIN is shown in a neutral colour: strong inhibition means *fewer* storms.

## Data sources

All from [Open-Meteo](https://open-meteo.com/), CC BY 4.0, keyless: `forecast` (deterministic and
three-model comparison), `ensemble`, `air-quality` and `geocoding`. Nothing else is contacted, so a
browser position is labelled *Posizione attuale* rather than sent to a reverse geocoder.

## What it shows

- Current conditions, perceived temperature, wind, gusts, humidity, pressure, cloud cover, UV, sun
  times
- Thunderstorm risk: 48-hour bars with per-model readout, CAPE / LI / CIN on expand
- 48 hours: temperature and perceived curves over rain-probability bars, plus a scrollable strip
- 7 days: temperature and perceived range, rain probability, gusts, storm peak, sun times
- Air quality: European AQI with PM2.5, PM10, ozone and NO₂

Locations come from search, geolocation or favourites, persisted in `localStorage`.

## Development

Node 20+ and pnpm.

```bash
pnpm install
pnpm dev        # http://localhost:5173/whether-forecast/
pnpm test
pnpm typecheck
pnpm build
```

Vite's `base` is `/whether-forecast/` in development too, so base-path bugs show up before deploy.
Pushing to `main` runs typecheck, tests and build, then publishes to GitHub Pages.

```
src/
  api/          typed wrappers for the endpoints
  lib/          pure logic: storm risk, rain outlook, WMO codes, charts, formatting, merge
  stores/       Pinia: selected location and favourites
  composables/  forecast orchestration, chart hover, auto-refresh
  components/   UI, with hand-rolled SVG charts
```

`src/lib` has no Vue dependency and carries most of the tests. Start with `stormRisk.ts` and
`rainOutlook.ts`.

## Limits

- **Regional, not point forecasts.** Open-Meteo serves open-data IFS at 0.25° (~25 km), which
  under-resolves valley-scale convection.
- **Models, not observations.** There is no radar or station data, so "now" is a forecast too. Over
  the next two hours, radar nowcasting beats any of this.
- **Uncalibrated thresholds.** Storm, rain and snow thresholds were checked against live members,
  not against observed lightning, rain or snow.
- **Daily storm figure is a peak**, not an average.
- **Free tier.** Non-commercial use, about 10 000 calls a day per IP, spent from each user's
  browser. Attribution appears in the footer.
- **Staleness.** Offline, the service worker replays cached responses, so freshness is judged on
  the forecast's own timestamp, with a banner after two hours.
