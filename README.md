# 🌱 Garden Tracker — Blended Edition
### Bella Vista, AR · Zone 6b · CastIronDB125

A merged best-of-both tracker combining Claude's dark theme and per-plant intelligence with GPT's daily grow logging, structured plant IDs, and config-driven settings.

---

## What's in this tracker

### Architecture
| File | Purpose |
|------|---------|
| `index.html` | App shell |
| `css/style.css` | Dark theme (DM Mono + Lora fonts) |
| `js/app.js` | All app logic |
| `data/config.json` | Location, frost dates, lights, nutrients — **edit this without touching JS** |
| `data/plants.json` | Full plant inventory — **add plants here** |

### Features
- **Full weather briefing** — current temp, humidity, wind, UV index, feels-like, today hi/lo, rain chance, sunrise/sunset, hours of daylight, moon phase, all always expanded at the top
- **7-day forecast strip** — frost/watch/ok badges, UV, rain probability per day
- **Garden metrics strip** — live countdown to last frost, safe planting date, warm/cool/pepper harden start dates, sow window
- **Per-plant sidebar** with structured IDs, badges, day counters, and harden-day tracking
- **Per-plant tabs:** Overview · DWC (pH/EC logging + full session form) · Grow Log · Feed · Light · Harden Off
- **Grow log form** — date, height, leaf count, watered, feed used, outside minutes, condition, zone, notes (GPT's best feature)
- **DWC session log** — pH, EC, PPM, water temp, air temp, top-off, water change, root notes, plant notes
- **Hardening off planner** — 10-day protocol with live forecast overlay, per-plant cold tolerance, start clock
- **config.json** — change your location, frost dates, or light schedule without editing JavaScript
- **Export/Import JSON** backup
- **localStorage** — all data persists in your browser automatically

---

## Complete Plant Inventory

### DWC — Permanent Indoor
| ID | Plant | Variety | Bucket |
|----|-------|---------|--------|
| PEP-bell-dwc | California Wonder Bell | *Capsicum annuum* | Left |
| PEP-hab-dwc | Habanero (hydro clone) | *Capsicum chinense* | Right |

### Peppers — Soil, Outdoor Transplant
| ID | Plant | Variety | SHU |
|----|-------|---------|-----|
| PEP-grand-bell | Grand Bell Mix | *C. annuum* | 0 |
| PEP-jalapeno | Jalapeño Early | *C. annuum* | 2,500–8,000 |
| PEP-poblano | Poblano | *C. annuum* | 1,000–2,000 |
| PEP-serrano | Serrano | *C. annuum* | 10,000–23,000 |
| PEP-sweet-banana | Sweet Banana Pepper | *C. annuum* | 0–500 |
| PEP-choc-reaper | Chocolate Reaper (non-isolated) | *C. chinense* | 1.5M–2.2M+ |

### Tomatoes — Soil, Outdoor Transplant
| ID | Plant | Variety |
|----|-------|---------|
| TOM-culinary | Culinary Blend | *Solanum lycopersicum* |
| TOM-cherry | Cherry | *S. lycopersicum var. cerasiforme* |

### Lettuce — Soil, Outdoor Transplant
| ID | Plant | Variety | Sown |
|----|-------|---------|------|
| LET-bibb | Bibb | *Lactuca sativa* (Bibb) | Feb 16, 2026 |
| LET-iceberg | Iceberg | *Lactuca sativa* (Iceberg) | Feb 16, 2026 |

### Herbs — Permanent Indoor
| ID | Plant | Variety | Sown |
|----|-------|---------|------|
| HER-basil | Basil | *Ocimum basilicum* | Feb 16, 2026 |
| HER-thyme | Thyme | *Thymus vulgaris* | Feb 16, 2026 |
| HER-oregano | Oregano | *Origanum vulgare* | Feb 16, 2026 |
| HER-rosemary | Rosemary (fresh seeds) | *Salvia rosmarinus* | Feb 16, 2026 |

### Bonsai — Long-term Training
| ID | Nickname | Species | Common Name | Sown |
|----|----------|---------|-------------|------|
| BON-siberian-elm | Freddy | *Ulmus pumila* | Siberian Elm | Feb 16, 2026 |
| BON-blue-spruce | Ochitsuki | *Picea pungens* | Colorado Blue Spruce | Feb 16, 2026 |
| BON-black-pine | Shizuku | *Pinus thunbergii* | Japanese Black Pine | Feb 16, 2026 |

### Uncertain / Low-Viability Seeds
| ID | Plant | Variety | Viability |
|----|-------|---------|-----------|
| SED-choc-ghost | Chocolate Ghost | *Capsicum chinense* | Low ~20–40% (old seeds) |
| SED-primo-reaper | Chocolate Primo Reaper | *Capsicum chinense* | Low ~20–40% (old seeds) |
| SED-tas-hab | Tasmanian Habanero | *Capsicum chinense* | Low ~20–40% (old seeds) |

---

## Deploying to GitHub Pages

### Step 1 — Create the repo on GitHub.com
1. Go to **[github.com/new](https://github.com/new)**
2. Name: `garden-tracker-blended`
3. Visibility: **Public**
4. Leave all checkboxes unchecked
5. Click **Create repository**

### Step 2 — Clone in GitHub Desktop
1. Open GitHub Desktop
2. **File → Clone repository → URL tab**
3. Paste: `https://github.com/CastIronDB125/garden-tracker-blended`
4. Choose a local path → **Clone**

### Step 3 — Copy files in
1. Unzip this folder
2. Select everything **inside** `garden-blended/`:
   - `index.html`
   - `README.md`
   - `css/` folder
   - `js/` folder
   - `data/` folder
3. Paste into your cloned `garden-tracker-blended` folder

### Step 4 — Commit and push
1. GitHub Desktop shows all files as new changes
2. Summary box: `Initial blended garden tracker`
3. Click **Commit to main**
4. Click **Push origin**

### Step 5 — Enable GitHub Pages
1. Go to your repo on GitHub.com
2. **Settings → Pages**
3. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
4. Click **Save**

### Step 6 — Your live URL
After ~60 seconds:
```
https://CastIronDB125.github.io/garden-tracker-blended/
```

---

## Editing config.json
To change frost dates, light schedule, or location — edit `data/config.json`. No JavaScript needed.

Key fields:
- `frost.conservativeLastFrostDay` — day of April for last frost (currently 20)
- `frost.safePlantDay` — day of April for safe outdoor planting (currently 27)
- `lights.on` / `lights.off` — your timer schedule (used to calculate photoperiod)
- `sowWindow.start` / `sowWindow.end` — your sow window dates

## Adding plants
Add an object to `data/plants.json`. Follow the existing format. Key fields:
- `id` — use format `CAT-descriptive-name` (e.g. `PEP-new-variety`)
- `hardeningRequired` — `true` shows the Harden Off tab
- `system` — `"DWC"`, `"Soil"`, or `"Bonsai"`
- `viability` — set to a string for low-viability seeds, `null` otherwise
- `nickname` — bonsai name or personal name, `null` otherwise

---

## Data & Privacy
- All log data stored in **browser localStorage only** — nothing sent to any server
- Weather: [Open-Meteo](https://open-meteo.com/) (free, no API key)
- Export regularly using the Export button — especially before clearing browser data

<!-- cache bust 2026-03-15 -->
