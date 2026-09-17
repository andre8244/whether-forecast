# Whether Forecast

**[andre8244.github.io/whether-forecast](https://andre8244.github.io/whether-forecast/)**

Most forecasts tell you *what* the weather will be. This one tells you **whether** — a real
probability, counted from 119 ensemble members across three models, instead of a storm icon that
means whatever you want it to.

A static, installable weather app in Italian, metric throughout. Perceived ("feels-like")
temperature is a first-class value, not a footnote.

No API key, no backend, no account. It builds to static files and runs anywhere.

## Why the thunderstorm number is different

Open-Meteo accepts an `hourly=thunderstorm_probability` parameter, but it returns `null` for most
models and locations, so it is not usable as a primary metric.

Instead, the app calls the **Ensemble API** with three models in one request and counts members
within each model, then averages the models with equal weight:

```
P_model(hour) = members forecasting WMO code >= 95 / members with data
P(hour)       = mean over the models that reported
```

WMO codes 95, 96 and 99 are thunderstorm, thunderstorm with slight hail, and thunderstorm with heavy
hail. Each ensemble member is a full model run from slightly perturbed initial conditions, so the
share of members producing a storm *is* the forecast probability.

| Model | Members | Coverage |
|---|---|---|
| ECMWF IFS 0.25° | 50 + control | global |
| DWD ICON global | 39 + control | global |
| NOAA GEFS 0.25° | 30 + control | global |

That is 122 series over 168 hours in a single ~60 kB request.

Each model carries **equal weight**. Counting members across the pooled membership would let ECMWF
decide 41% of the answer purely because its centre runs 50 members against GFS's 30 — a fact about
compute budgets, not about the weather. A model with no usable data for an hour drops out of that
hour's mean rather than counting as zero.

**Model disagreement is shown rather than averaged away**: the panel carries a per-model breakdown,
and warns explicitly when the spread between the highest and lowest model exceeds 30 percentage
points.

### Rain probability and rain depth are different numbers

`precipitation_probability` comes from the ensemble — the share of scenarios with more than 0.1 mm
in that hour. `precipitation` comes from the single deterministic run. They answer different
questions from different sources, so an hour can legitimately read 85% with no accumulation: most
scenarios produce rain, the main forecast does not.

This is real Open-Meteo output, not a bug. Checked against live data: of Turin's hours above 50%
probability, 8 of 9 had zero deterministic precipitation; London, 4 of 5. In a wet regime the two
agree much more often — Bergen, 41 of 62.

The UI stops presenting that as a contradiction. The hourly strip shows a depth only when there is
one, and the chart tooltip says *nessun accumulo nella previsione principale* for a high-probability
hour with none.

Depths below 0.05 mm are reported as `< 0.1 mm` rather than rounded to `0.0 mm`, which would read
as a dry hour when the model forecast a trace.

### Convective indices

CAPE, lifted index and convective inhibition from the deterministic run appear in the expandable
detail, each reported **on its own published scale** — the conventional convective-energy table for
CAPE, the NWS stability bands for the lifted index, and the usual 25 / 50 / 200 J/kg split for CIN.

They are deliberately *not* combined into a single score. An earlier version did exactly that, by
adding and subtracting steps across the three; the individual thresholds were conventional but the
composition rule had no source, and it was displayed with the same authority as the measured data.

CIN is shown in neutral colour rather than on the risk ramp: strong inhibition means *fewer* storms,
so a red badge there would read backwards next to the other two.

These indices describe how much energy the atmosphere holds and whether it can be released, not how
likely it is that it will be. They are context for the probability, never a replacement for it.

## Data sources

All from [Open-Meteo](https://open-meteo.com/), CC BY 4.0, no key required:

| Purpose | Endpoint |
|---|---|
| Forecast | `api.open-meteo.com/v1/forecast` |
| Ensemble members | `ensemble-api.open-meteo.com/v1/ensemble` |
| Air quality | `air-quality-api.open-meteo.com/v1/air-quality` |
| City search | `geocoding-api.open-meteo.com/v1/search` |

Nothing else is contacted. Open-Meteo's geocoding API is forward-only, so a position from the
browser is labelled *Posizione attuale* rather than sent to a third-party reverse geocoder to be
named. The keyless providers that offer that are free because a consented GPS fix is worth
something to them, and a place name is not worth handing the user's coordinates to one more
company.

## What it shows

- Current conditions with temperature **and** perceived temperature, wind, gusts, humidity,
  pressure, cloud cover, UV index, sunrise and sunset
- Thunderstorm risk: the peak probability with the day and hour it falls on, per-hour bars over 48
  hours with a hover readout giving that hour's combined and per-model figures, and CAPE / LI / CIN
  on expand
- 48 hourly steps: an interactive chart of the temperature and perceived-temperature curves over
  precipitation-probability bars, with a labelled time axis, a hover tooltip reading out every
  value for that hour, and arrow-key navigation; below it a scrollable strip with precipitation in
  millimetres, wind and per-hour storm probability
- 7 daily rows: temperature range, perceived range, precipitation, gusts, storm peak, sun times
- Air quality: European AQI band with PM2.5, PM10, ozone and NO₂

Locations come from city search, browser geolocation, or saved favourites. Everything persists in
`localStorage`.

A location's identity is its rounded coordinates, so relabelling one never costs extra forecast
requests.

## Development

Requires Node 20+ and pnpm.

```bash
pnpm install
pnpm dev        # dev server
pnpm test       # unit tests
pnpm typecheck  # vue-tsc
pnpm build      # production build into dist/
pnpm preview    # serve the production build
```

The app is served from a subdirectory on GitHub Pages, so Vite's `base` is set to
`/whether-forecast/` — in development as well as in the build. Running dev at `/` while production
runs under a prefix is how base-path bugs reach a deploy unnoticed, so `pnpm dev` also serves at
`http://localhost:5173/whether-forecast/`.

## Colour scheme

Dark only. One token set in `src/styles/theme.css`, applied on `:root`, with no switcher and no
system-preference branch.

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: typecheck, tests, build, then publish to
GitHub Pages. A failing typecheck or test stops the deploy.

## Structure

```
src/
  api/          typed wrappers for the four endpoints
  lib/          pure logic: storm risk, WMO codes, chart geometry, formatting, AQI, merge
  stores/       Pinia: selected location with favourites
  composables/  forecast orchestration, chart hover, auto-refresh
  components/   UI, including hand-rolled SVG charts (no charting dependency)
```

The pure logic in `src/lib` has no Vue dependency and carries most of the test suite.
`src/lib/stormRisk.ts` is the piece worth reading first.

App-wide state (which place is selected, and the favourites) lives in Pinia. It was previously held
in module-level refs inside composables, which made it a global in disguise and leaked between
tests.

## Notes and limits

- **Resolution.** Open-Meteo serves the *open-data* ECMWF IFS at 0.25° (~25 km), not the 9 km
  operational grid available to paid licensees. In complex terrain such as the Alps this
  under-resolves valley-scale convection: treat the numbers as regional, not point forecasts.
- **Cross-model code comparability.** The count assumes ICON's WMO code 95 means the same as
  ECMWF's. Ensemble weather codes are post-processed by each centre, and this assumption has not
  been validated.
- **No nowcast.** Below about two hours, radar nowcasting beats any global model. The app has no
  radar layer, so the next 90 minutes — when people actually check — are covered only by model
  output.
- **Daily storm figure is a peak**, the highest hourly value in the day, not an average. A day with
  one hour at 40% and twenty-three at 0% reads 40%.
- **Licence and rate limits.** The free tier is for non-commercial use, limited to roughly 600 calls
  per minute and 10 000 per day per IP. Calls are made from the browser, so each user spends their
  own quota. A commercial deployment needs Open-Meteo's paid tier. Attribution is required under
  CC BY 4.0 and appears in the app footer.
- **No SLA.** Open-Meteo is provided as is. The service is open source and self-hostable if that
  matters for your deployment.
- **Staleness.** Offline, the service worker replays cached API responses, which would otherwise
  look like a successful refresh. The app therefore judges freshness on the forecast's own `current`
  timestamp and shows a banner when it is more than two hours old.
