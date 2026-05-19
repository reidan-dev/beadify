# Beadify

Turn any image into a bead art pattern. Pixelizes an image, maps each region to the nearest color in your bead palette, and gives you an interactive board to track progress bead-by-bead.

---

## Requirements

- [uv](https://docs.astral.sh/uv/getting-started/installation/) (Python package manager)
- Python 3.11+

---

## Setup

```bash
cd beadify
uv sync
```

Dependencies are pinned in `uv.lock` — no other setup needed.

---

## Running

```bash
uv run beadify
```

Open [http://localhost:8000](http://localhost:8000). Hot-reload is on, so edits to `main.py` restart the server automatically.

### Optional: AI background removal

Background removal uses `rembg`, which has heavy build dependencies (llvmlite/LLVM). Install it separately:

```bash
uv add rembg
```

The first removal request downloads the U2Net model (~170 MB) and caches it locally.

---

## Using the App

### 1. Upload an image

Click **Image file** and select any PNG, JPG, etc. A preview appears with a crop selector.

### 2. Crop (optional)

Drag a rectangle on the preview to focus on a specific area. Only that region will be processed. Click **Clear Crop** to reset.

### 3. Remove background (optional)

Check **Remove background (AI)** to strip the background before processing. Requires `rembg` (see above).

### 4. Set grid size

Two ways to control how many beads are generated:

| Control | Effect |
|---|---|
| **Pixels per bead** | Each N×N block of pixels → 1 bead. Default 20. |
| **Force grid size (cols × rows)** | Force an exact bead count, e.g. `50 × 40`. Overrides pixels-per-bead. |

Leave `Force grid size` blank to use pixels-per-bead. Set only one dimension (cols or rows) to auto-scale the other.

### 5. Process

Click **Process Image**. The backend will:
1. Apply crop / background removal if selected
2. Resize to the target grid dimensions
3. Map each cell's color to the nearest palette color using LAB color distance
4. Return the bead grid with the source image as a background overlay

### 6. Interactive bead board

- The source image is rendered behind the bead grid so you can see how it maps
- Each bead shows its palette label (e.g. `A10`) in the bead color
- **Click a bead** → turns black, label hidden (marked done). Click again to undo.
- Progress **auto-saves** on every click to `progress/<filename>.json`
- Use the **Display size** slider to zoom the grid in/out without re-processing

### 7. Save / Load progress

- **Save Progress** — manual save
- **Load Progress** — restore a saved session for the current image
- Re-processing the same image auto-restores previous progress

---

## Palette

Colors are defined in `color_palette.json` — a map of bead labels to hex values:

```json
{
  "A10": "#e3746e",
  "C5":  "#4c6b94"
}
```

Edit or extend this file to match your bead collection.

---

## Project Structure

```
beadify/
├── main.py               # FastAPI backend
├── pyproject.toml        # uv project config + script entrypoint
├── uv.lock               # pinned dependencies
├── color_palette.json    # bead color definitions
├── static/
│   ├── index.html        # single-page app
│   ├── app.js            # grid rendering, crop, click handling
│   └── style.css         # dark pegboard theme
├── progress/             # auto-saved progress JSON files
└── uploads/              # processed board images (served as overlay)
```

---

## Progress Files

Saved to `progress/<image_stem>.json` — e.g. uploading `my_cat.png` saves to `progress/my_cat.json`.

Stores the full bead grid with `done` states, persisting across sessions and server restarts.
