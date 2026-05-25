# Beadify

Turn any image into a bead art pattern. Pixelizes an image, maps each pixel region to the nearest color in your bead palette using perceptually accurate CIEDE2000 color matching, and gives you an interactive board to track progress bead-by-bead.

---

## Features

- **Smart color matching** — CIEDE2000 + K-D Tree for fast, perceptually accurate palette lookup
- **LANCZOS downscaling** — averages source pixels per bead cell for better color representation (optional: NEAREST for pixel art)
- **Floyd-Steinberg dithering** — distributes quantization error for smoother color gradients
- **Multi-image tiling** — combine multiple images into one board (horizontal, vertical, or grid)
- **1:1 color assignment** — each palette color used at most once (good for small palettes)
- **Crop, flip, rotate** — client-side transforms before processing
- **Interactive board** — click beads to mark done; progress auto-saves per project
- **Fill tool** — flood-fill connected same-color beads
- **Region select** — drag to mark/unmark a rectangle of beads
- **Guide grid** — overlay a repeating grid with draggable origin; focus on one sub-section at a time
- **Legend** — grouped color list with visibility toggles, mark-all, and color swap
- **Round bead mode** — toggle circular bead rendering
- **Export PNG** — download the board as a flat image
- **Export CSV** — download bead counts as a shopping list
- **Rulers + keyboard nav** — row/col numbers; arrow keys to navigate, Space to toggle
- **Undo/redo** — Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z)
- **Drag-and-drop** upload support
- **Dark theme** — pegboard-inspired design

---

## Requirements

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- Python 3.11+
- Node.js 18+ (for the React frontend)

---

## Setup

```bash
cd beadify
uv sync            # Python dependencies
cd frontend
npm install        # React/Vite dependencies
npm run build      # Build the frontend (outputs to frontend/dist/)
```

---

## Running

**Production (built frontend):**

```bash
uv run beadify
```

Open [http://localhost:8000](http://localhost:8000).

**Development (Vite HMR + FastAPI):**

```bash
# Terminal 1 — backend
uv run beadify

# Terminal 2 — frontend dev server with hot reload
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — API calls are proxied to port 8000 automatically.

---

## Using the App

### 1. Upload an image

Click **Image file** or **drop an image** directly onto the upload area. A live preview appears immediately.

### 2. Crop (optional)

Click **✂ Crop** to open the crop modal. Drag to select a region; drag inside to move it; drag handles to resize. Click **Apply** to confirm.

### 3. Image transforms (optional)

Use **↔ ↕ ↺ ↻** to flip or rotate before processing. Transforms are applied client-side, so the backend always receives the correct orientation.

### 4. Set grid size

| Control | Effect |
|---|---|
| **px per bead** | Each N×N block of pixels → 1 bead. |
| **Force cols × rows** | Force an exact bead count, e.g. `50 × 40`. Overrides px per bead. |

Leave `Force grid size` blank to use px-per-bead. Set only one dimension to auto-scale the other.

### 5. Options

| Option | Default | Effect |
|---|---|---|
| Smooth resize | **on** | LANCZOS downscaling — better color per bead for photos |
| Dithering | off | Floyd-Steinberg error diffusion for smoother gradients |
| 1:1 color match | off | Each palette color used at most once |
| ΔE fallback | 10 | How far a displaced color can be before reusing nearest match |

> Dithering and 1:1 color match are mutually exclusive (they use different color assignment strategies).

### 6. Process

Click **▶ Process**. The backend will:
1. Apply background removal if selected
2. Resize to the target grid (LANCZOS or NEAREST)
3. Map each cell to the nearest palette color (CIEDE2000)
4. Apply dithering if enabled
5. Return the bead grid with the source image as a background overlay

### 7. Interactive bead board

- The source image renders behind the grid as a visual reference
- Each bead shows its palette label in the bead color
- **Click a bead** → marks done (darkens). Click again to undo.
- **Round** button → toggle circular bead rendering
- Progress **auto-saves** on every click to `progress/<filename>.json`

### 8. Export

- **↓ PNG** — renders the full board at 20 px/bead and downloads as PNG
- **↓ CSV** — downloads label, color, total, done, remaining counts as a shopping list

### 9. Board tools

| Tool | Shortcut | Effect |
|---|---|---|
| Fill | click button | Flood-fill connected beads of same color |
| Select | drag | Mark/unmark a rectangular region |
| Mark Row | click button | Click any bead to highlight its row |
| Mark Col | click button | Click any bead to highlight its column |
| Guide Grid | type N + Grid | Overlay a repeating N-bead grid |
| Focus | after guide | Zoom into one sub-grid section at a time |
| Undo | Ctrl+Z | Undo last change |
| Redo | Ctrl+Y | Redo |
| Keyboard nav | Arrow keys | Move focus; Space/Enter to toggle bead |

---

## Deploying to Vercel

A `vercel.json` is included. Basic steps:

```bash
npm i -g vercel
vercel login
vercel --prod
```

**Limitations on Vercel (serverless):**
- The `/tmp` directory is writable but **ephemeral** — progress resets between serverless invocations
- `rembg` (AI background removal) will exceed the 15 MB lambda size limit; keep it disabled
- For persistent progress, add a database (PlanetScale, Neon, Supabase) and update the `/progress` endpoints

For full functionality including persistent progress, deploy on a persistent host instead:
- **Railway** — `railway up` (supports long-running processes, persistent disk)
- **Fly.io** — `fly launch` then `fly deploy` (persistent volumes available)
- **Render** — connect repo, set build command `pip install -r requirements.txt`, start command `uvicorn main:app`

---

## Project Structure

```
beadify/
├── main.py                    # FastAPI backend
├── pyproject.toml             # uv project config + script entrypoint
├── uv.lock                    # pinned dependencies
├── vercel.json                # Vercel serverless deployment config
├── color_palette.yaml         # bead color definitions (grouped)
├── FEATURES.md                # suggested future features
├── static/
│   ├── index.html             # single-page app
│   ├── app.js                 # grid rendering, tools, interactions
│   └── style.css              # dark pegboard theme
├── progress/                  # auto-saved progress JSON files
└── uploads/                   # processed board images (served as overlay)
```

---

## Color Palette

Colors are defined in `color_palette.yaml`. Supports flat or grouped format:

**Flat:**
```yaml
A10: "#e3746e"
C5:  "#4c6b94"
```

**Grouped (used in production):**
```yaml
group_1:
  A10: "#e3746e"
  A11: "#d4574f"
group_2:
  C5:  "#4c6b94"
  C6:  "#3a5580"
```

Groups appear as collapsible sections in the legend. Edit or extend the file to match your bead collection.

---

## Progress Files

Saved to `progress/<image_stem>.json` — e.g. uploading `my_cat.png` saves to `progress/my_cat.json`.

Stores the full bead grid with `done` states. Restores automatically when you process the same image again.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| Arrow keys | Move keyboard focus to adjacent bead |
| Space / Enter | Toggle focused bead done/undone |
| Escape | Clear keyboard focus |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Serve the app |
| `POST` | `/process` | Process an uploaded image → bead grid |
| `GET` | `/palette` | Return the color palette (grouped JSON) |
| `GET` | `/progress/{name}` | Load saved progress |
| `POST` | `/progress/{name}` | Save progress |
| `GET` | `/export/counts/{name}` | Download bead counts as CSV |
