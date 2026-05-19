import json
import math
import os
from io import BytesIO
from pathlib import Path
from typing import Optional

import numpy as np
import yaml
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from scipy.spatial import KDTree

BASE_DIR = Path(__file__).parent
PALETTE_PATH = BASE_DIR / "color_palette.yaml"
PROGRESS_DIR = BASE_DIR / "progress"
UPLOADS_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"

PROGRESS_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Beadify")

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------

def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = [x / 255.0 for x in rgb]

    def linearize(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = linearize(r), linearize(g), linearize(b)
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    X /= 0.95047
    Z /= 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fX, fY, fZ = f(X), f(Y), f(Z)
    return (116 * fY - 16, 500 * (fX - fY), 200 * (fY - fZ))


def ciede2000(lab1: tuple[float, float, float], lab2: tuple[float, float, float]) -> float:
    """CIEDE2000 color difference between two CIE L*a*b* colors."""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2

    # Compute C* in original Lab
    C1 = math.sqrt(a1 * a1 + b1 * b1)
    C2 = math.sqrt(a2 * a2 + b2 * b2)
    C_avg = (C1 + C2) / 2.0
    C_avg7 = C_avg ** 7

    # G factor adjusts a* for chroma
    G = 0.5 * (1.0 - math.sqrt(C_avg7 / (C_avg7 + 6103515625.0)))  # 25^7
    a1p = a1 * (1.0 + G)
    a2p = a2 * (1.0 + G)

    C1p = math.sqrt(a1p * a1p + b1 * b1)
    C2p = math.sqrt(a2p * a2p + b2 * b2)

    h1p = math.degrees(math.atan2(b1, a1p)) % 360.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360.0

    dLp = L2 - L1
    dCp = C2p - C1p

    if C1p * C2p == 0.0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180.0:
        dhp = h2p - h1p
    elif h2p - h1p > 180.0:
        dhp = h2p - h1p - 360.0
    else:
        dhp = h2p - h1p + 360.0

    dHp = 2.0 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2.0))

    Lp_avg = (L1 + L2) / 2.0
    Cp_avg = (C1p + C2p) / 2.0

    if C1p * C2p == 0.0:
        Hp_avg = h1p + h2p
    elif abs(h1p - h2p) <= 180.0:
        Hp_avg = (h1p + h2p) / 2.0
    elif h1p + h2p < 360.0:
        Hp_avg = (h1p + h2p + 360.0) / 2.0
    else:
        Hp_avg = (h1p + h2p - 360.0) / 2.0

    T = (1.0
         - 0.17 * math.cos(math.radians(Hp_avg - 30.0))
         + 0.24 * math.cos(math.radians(2.0 * Hp_avg))
         + 0.32 * math.cos(math.radians(3.0 * Hp_avg + 6.0))
         - 0.20 * math.cos(math.radians(4.0 * Hp_avg - 63.0)))

    SL = 1.0 + 0.015 * (Lp_avg - 50.0) ** 2 / math.sqrt(20.0 + (Lp_avg - 50.0) ** 2)
    SC = 1.0 + 0.045 * Cp_avg
    SH = 1.0 + 0.015 * Cp_avg * T

    Cp_avg7 = Cp_avg ** 7
    RC = 2.0 * math.sqrt(Cp_avg7 / (Cp_avg7 + 6103515625.0))
    d_theta = 30.0 * math.exp(-((Hp_avg - 275.0) / 25.0) ** 2)
    RT = -math.sin(math.radians(2.0 * d_theta)) * RC

    return math.sqrt(
        (dLp / SL) ** 2 +
        (dCp / SC) ** 2 +
        (dHp / SH) ** 2 +
        RT * (dCp / SC) * (dHp / SH)
    )


# ---------------------------------------------------------------------------
# Palette — loaded once, KDTree built over LAB coords
# ---------------------------------------------------------------------------

class PaletteIndex:
    """K-D Tree over palette LAB coords; final ranking by CIEDE2000."""

    # Number of Euclidean-LAB candidates to re-rank with CIEDE2000.
    # With a palette of ~50 colors this covers everything; with larger
    # palettes it keeps search fast while preserving CIEDE2000 accuracy.
    K_CANDIDATES = 20

    def __init__(self, palette_path: Path) -> None:
        with open(palette_path) as f:
            raw = yaml.safe_load(f)

        # Support both flat {label: hex} and grouped {group_N: {label: hex}} YAML
        flat: dict[str, str] = {}
        for key, val in raw.items():
            if isinstance(val, dict):
                flat.update(val)
            else:
                flat[key] = val

        self.labels: list[str] = []
        self.hexes:  list[str] = []
        self.labs:   list[tuple[float, float, float]] = []

        for label, hex_color in flat.items():
            self.labels.append(label)
            self.hexes.append(hex_color)
            self.labs.append(rgb_to_lab(hex_to_rgb(hex_color)))

        self._tree = KDTree(np.array(self.labs, dtype=np.float64))
        self._k = min(self.K_CANDIDATES, len(self.labels))

    def nearest(self, rgb: tuple[int, int, int]) -> tuple[str, str]:
        """Return (label, hex) for the palette color nearest to rgb by CIEDE2000."""
        lab = rgb_to_lab(rgb)
        _, idxs = self._tree.query(lab, k=self._k)
        idxs = [idxs] if np.ndim(idxs) == 0 else list(idxs)
        best_idx = min(idxs, key=lambda i: ciede2000(lab, self.labs[i]))
        return self.labels[best_idx], self.hexes[best_idx]

    def assign(self, unique_pixels: list[tuple[int, int, int]]) -> dict[tuple[int, int, int], tuple[str, str]]:
        """Standard nearest-match assignment (many pixels may share a palette color)."""
        return {px: self.nearest(px) for px in unique_pixels}

    def assign_one_to_one(
        self,
        unique_pixels: list[tuple[int, int, int]],
        de_threshold: float = 10.0,
    ) -> dict[tuple[int, int, int], tuple[str, str]]:
        """1:1 assignment: each palette color used at most once.

        Displacement rule: if a pixel is pushed off its first-choice slot AND the
        CIEDE2000 distance to its assigned slot exceeds *de_threshold*, it falls back
        to the plain nearest-match (allowing color reuse) rather than using a
        perceptually distant substitute.

        Uses KDTree Euclidean-LAB distances for the global sort (fast proxy).
        """
        n_palette = len(self.labels)

        # Per-pixel LAB coords and first-choice slot index.
        pixel_labs:         list[tuple[float, float, float]] = []
        pixel_first_choice: list[int]                        = []

        # Build all (pixel, slot) pairs using Euclidean LAB distance from the KDTree.
        pairs: list[tuple[float, int, int]] = []
        for pid, px in enumerate(unique_pixels):
            lab = rgb_to_lab(px)
            pixel_labs.append(lab)
            dists, idxs = self._tree.query(lab, k=n_palette)
            dists = [float(dists)] if np.ndim(dists) == 0 else dists.tolist()
            idxs  = [int(idxs)]   if np.ndim(idxs)  == 0 else [int(i) for i in idxs]
            pixel_first_choice.append(idxs[0])
            for d, idx in zip(dists, idxs):
                pairs.append((d, pid, idx))

        # Sort globally: nearest pixel–slot pair first.
        pairs.sort()

        assigned_pids: set[int]        = set()
        slot_taken:    set[int]        = set()
        assigned_slot: dict[int, int]  = {}   # pid → winning slot index

        for _dist, pid, idx in pairs:
            if pid in assigned_pids:
                continue
            if idx not in slot_taken:
                slot_taken.add(idx)
                assigned_pids.add(pid)
                assigned_slot[pid] = idx

        # Build result, applying displacement threshold.
        result: dict[tuple, tuple[str, str]] = {}
        for pid, px in enumerate(unique_pixels):
            if pid in assigned_slot:
                idx = assigned_slot[pid]
                if idx == pixel_first_choice[pid]:
                    # Got first choice — always accept.
                    result[px] = (self.labels[idx], self.hexes[idx])
                else:
                    # Displaced: only keep 1:1 slot if perceptually close enough.
                    de = ciede2000(pixel_labs[pid], self.labs[idx])
                    if de <= de_threshold:
                        result[px] = (self.labels[idx], self.hexes[idx])
                    else:
                        # Too far — fall back to nearest match (reuse allowed).
                        result[px] = self.nearest(px)
            else:
                # Palette exhausted — fall back to nearest match.
                result[px] = self.nearest(px)

        return result


PALETTE = PaletteIndex(PALETTE_PATH)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/process")
async def process_image(
    file: UploadFile = File(...),
    bead_size: int = Form(20),
    # Force exact grid dimensions (overrides bead_size if set)
    force_cols: int = Form(0),
    force_rows: int = Form(0),
    # Crop region as fractions 0-1 of the image. -1 = no crop.
    crop_x: float = Form(-1.0),
    crop_y: float = Form(-1.0),
    crop_w: float = Form(-1.0),
    crop_h: float = Form(-1.0),
    # Background removal
    remove_bg: bool = Form(False),
    # 1:1 color matching
    one_to_one: bool = Form(False),
    # CIEDE2000 ΔE threshold: displaced colors farther than this fall back to nearest match
    de_threshold: float = Form(10.0),
):
    if bead_size < 1:
        raise HTTPException(status_code=400, detail="bead_size must be >= 1")

    image_data = await file.read()
    src = Image.open(BytesIO(image_data))
    has_alpha_source = src.mode in ('RGBA', 'LA', 'PA')
    img = src.convert("RGBA")

    # --- Background removal ---
    if remove_bg:
        try:
            from rembg import remove as rembg_remove
            img = rembg_remove(img)  # returns RGBA
        except ImportError:
            raise HTTPException(status_code=500, detail="rembg not installed. Run: uv add rembg")

    # Keep RGBA when source had alpha or bg was removed so we can mark transparent beads
    has_transparency = remove_bg or has_alpha_source
    if not has_transparency:
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg.convert("RGB")

    # --- Auto-trim transparent borders ---
    if has_transparency:
        alpha_ch = img.split()[3]
        bbox = alpha_ch.point(lambda x: 255 if x >= 128 else 0).getbbox()
        if bbox:
            img = img.crop(bbox)

    # --- Crop ---
    if all(v >= 0 for v in [crop_x, crop_y, crop_w, crop_h]):
        iw, ih = img.size
        x0 = int(crop_x * iw)
        y0 = int(crop_y * ih)
        x1 = int((crop_x + crop_w) * iw)
        y1 = int((crop_y + crop_h) * ih)
        x0, x1 = max(0, x0), min(iw, x1)
        y0, y1 = max(0, y0), min(ih, y1)
        if x1 > x0 and y1 > y0:
            img = img.crop((x0, y0, x1, y1))

    # --- Determine grid dimensions ---
    iw, ih = img.size
    if force_cols > 0 and force_rows > 0:
        cols, rows = force_cols, force_rows
    elif force_cols > 0:
        cols = force_cols
        rows = max(1, round(ih * cols / iw))
    elif force_rows > 0:
        rows = force_rows
        cols = max(1, round(iw * rows / ih))
    else:
        cols = max(1, iw // bead_size)
        rows = max(1, ih // bead_size)

    if cols == 0 or rows == 0:
        raise HTTPException(status_code=400, detail="Image too small for the given bead_size.")

    # Resize image to exactly (cols, rows) — one pixel per bead cell
    img_small = img.resize((cols, rows), Image.NEAREST)
    img_array = np.array(img_small)

    # --- Collect unique opaque pixel colors ---
    pixel_grid: list[list[tuple | None]] = []
    unique_pixels: set[tuple[int, int, int]] = set()
    for r in range(rows):
        row: list[tuple | None] = []
        for c in range(cols):
            if has_transparency and int(img_array[r, c, 3]) < 128:
                row.append(None)
            else:
                px = tuple(int(v) for v in img_array[r, c, :3])
                unique_pixels.add(px)
                row.append(px)
        pixel_grid.append(row)

    # Map each unique pixel color to nearest palette entry via KDTree + CIEDE2000
    pixel_to_palette = (
        PALETTE.assign_one_to_one(list(unique_pixels), de_threshold=max(0.0, de_threshold))
        if one_to_one else
        PALETTE.assign(list(unique_pixels))
    )

    # --- Build bead list ---
    beads: list[dict] = []
    for r in range(rows):
        for c in range(cols):
            px = pixel_grid[r][c]
            if px is None:
                beads.append({"row": r, "col": c, "label": "", "color": "#000000",
                               "done": False, "transparent": True})
            else:
                label, hex_color = pixel_to_palette[px]
                beads.append({"row": r, "col": c, "label": label, "color": hex_color,
                               "done": False, "transparent": False})

    # --- Save board background image (with alpha if bg was removed) ---
    stem = Path(file.filename).stem if file.filename else "image"
    safe_stem = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in stem)

    board_image_path = UPLOADS_DIR / f"{safe_stem}_board.png"
    img_small.save(board_image_path, "PNG")  # PIL preserves RGBA if present

    return JSONResponse({
        "name": safe_stem,
        "width": cols,
        "height": rows,
        "image_url": f"/uploads/{safe_stem}_board.png",
        "beads": beads,
    })


@app.get("/palette")
def get_palette():
    with open(PALETTE_PATH) as f:
        raw = yaml.safe_load(f)
    # Return grouped structure: { group_1: { label: hex }, ... }
    # If YAML is flat, wrap everything in a single group.
    if all(isinstance(v, dict) for v in raw.values()):
        return JSONResponse(raw)
    return JSONResponse({"group_1": raw})


@app.get("/progress/{name}")
def get_progress(name: str):
    path = PROGRESS_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No saved progress found.")
    with open(path) as f:
        data = json.load(f)
    return JSONResponse(data)


@app.post("/progress/{name}")
async def save_progress(name: str, request: Request):
    data = await request.json()
    path = PROGRESS_DIR / f"{name}.json"
    with open(path, "w") as f:
        json.dump(data, f)
    return {"saved": True}


# ---------------------------------------------------------------------------
# Static + uploads
# ---------------------------------------------------------------------------

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ---------------------------------------------------------------------------
# Dev entry point
# ---------------------------------------------------------------------------

def run():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
