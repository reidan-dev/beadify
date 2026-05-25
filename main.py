import json
import math
import os
from io import BytesIO
from pathlib import Path
from typing import Optional

import numpy as np
import yaml
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from scipy.spatial import KDTree

BASE_DIR = Path(__file__).parent
PALETTE_PATH = BASE_DIR / "color_palette.yaml"

IS_READONLY_HOST = bool(os.environ.get("VERCEL") or os.environ.get("BEADIFY_READONLY"))
_WRITE_BASE = Path("/tmp") if IS_READONLY_HOST else BASE_DIR
PROGRESS_DIR = _WRITE_BASE / "progress"
UPLOADS_DIR  = _WRITE_BASE / "uploads"

# Serve built React app from frontend/dist in production
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
STATIC_LEGACY = BASE_DIR / "static"

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
    X /= 0.95047; Z /= 1.08883

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fX, fY, fZ = f(X), f(Y), f(Z)
    return (116 * fY - 16, 500 * (fX - fY), 200 * (fY - fZ))


def ciede2000(lab1: tuple, lab2: tuple) -> float:
    L1, a1, b1 = lab1; L2, a2, b2 = lab2
    C1 = math.sqrt(a1*a1 + b1*b1); C2 = math.sqrt(a2*a2 + b2*b2)
    C_avg = (C1+C2)/2; C_avg7 = C_avg**7
    G = 0.5*(1 - math.sqrt(C_avg7/(C_avg7+6103515625)))
    a1p = a1*(1+G); a2p = a2*(1+G)
    C1p = math.sqrt(a1p*a1p + b1*b1); C2p = math.sqrt(a2p*a2p + b2*b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360
    h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp = L2-L1; dCp = C2p-C1p
    if C1p*C2p == 0: dhp = 0
    elif abs(h2p-h1p) <= 180: dhp = h2p-h1p
    elif h2p-h1p > 180: dhp = h2p-h1p-360
    else: dhp = h2p-h1p+360
    dHp = 2*math.sqrt(C1p*C2p)*math.sin(math.radians(dhp/2))
    Lp_avg = (L1+L2)/2; Cp_avg = (C1p+C2p)/2
    if C1p*C2p == 0: Hp_avg = h1p+h2p
    elif abs(h1p-h2p) <= 180: Hp_avg = (h1p+h2p)/2
    elif h1p+h2p < 360: Hp_avg = (h1p+h2p+360)/2
    else: Hp_avg = (h1p+h2p-360)/2
    T = (1 - 0.17*math.cos(math.radians(Hp_avg-30)) + 0.24*math.cos(math.radians(2*Hp_avg))
         + 0.32*math.cos(math.radians(3*Hp_avg+6)) - 0.20*math.cos(math.radians(4*Hp_avg-63)))
    SL = 1 + 0.015*(Lp_avg-50)**2/math.sqrt(20+(Lp_avg-50)**2)
    SC = 1 + 0.045*Cp_avg; SH = 1 + 0.015*Cp_avg*T
    Cp_avg7 = Cp_avg**7
    RC = 2*math.sqrt(Cp_avg7/(Cp_avg7+6103515625))
    d_theta = 30*math.exp(-((Hp_avg-275)/25)**2)
    RT = -math.sin(math.radians(2*d_theta))*RC
    return math.sqrt((dLp/SL)**2+(dCp/SC)**2+(dHp/SH)**2+RT*(dCp/SC)*(dHp/SH))


# ---------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------

class PaletteIndex:
    K_CANDIDATES = 20

    def __init__(self, palette_path: Path) -> None:
        with open(palette_path) as f:
            raw = yaml.safe_load(f)
        flat: dict[str, str] = {}
        for key, val in raw.items():
            if isinstance(val, dict): flat.update(val)
            else: flat[key] = val
        self.labels: list[str] = []; self.hexes: list[str] = []; self.labs = []
        for label, hex_color in flat.items():
            self.labels.append(label); self.hexes.append(hex_color)
            self.labs.append(rgb_to_lab(hex_to_rgb(hex_color)))
        self._tree = KDTree(np.array(self.labs, dtype=np.float64))
        self._k = min(self.K_CANDIDATES, len(self.labels))

    def nearest(self, rgb: tuple[int, int, int]) -> tuple[str, str]:
        lab = rgb_to_lab(rgb)
        _, idxs = self._tree.query(lab, k=self._k)
        idxs = [idxs] if np.ndim(idxs) == 0 else list(idxs)
        best = min(idxs, key=lambda i: ciede2000(lab, self.labs[i]))
        return self.labels[best], self.hexes[best]

    def assign(self, unique_pixels):
        return {px: self.nearest(px) for px in unique_pixels}

    def assign_one_to_one(self, unique_pixels, de_threshold=10.0):
        n = len(self.labels)
        pixel_labs = []; pixel_first = []; pairs = []
        for pid, px in enumerate(unique_pixels):
            lab = rgb_to_lab(px); pixel_labs.append(lab)
            dists, idxs = self._tree.query(lab, k=n)
            dists = [float(dists)] if np.ndim(dists)==0 else dists.tolist()
            idxs  = [int(idxs)]   if np.ndim(idxs)==0  else [int(i) for i in idxs]
            pixel_first.append(idxs[0])
            for d, idx in zip(dists, idxs): pairs.append((d, pid, idx))
        pairs.sort()
        assigned_pids = set(); slot_taken = set(); assigned_slot = {}
        for _, pid, idx in pairs:
            if pid in assigned_pids: continue
            if idx not in slot_taken:
                slot_taken.add(idx); assigned_pids.add(pid); assigned_slot[pid] = idx
        result = {}
        for pid, px in enumerate(unique_pixels):
            if pid in assigned_slot:
                idx = assigned_slot[pid]
                if idx == pixel_first[pid]:
                    result[px] = (self.labels[idx], self.hexes[idx])
                else:
                    de = ciede2000(pixel_labs[pid], self.labs[idx])
                    result[px] = (self.labels[idx], self.hexes[idx]) if de <= de_threshold else self.nearest(px)
            else:
                result[px] = self.nearest(px)
        return result


PALETTE = PaletteIndex(PALETTE_PATH)


# ---------------------------------------------------------------------------
# Image processing helpers
# ---------------------------------------------------------------------------

def _floyd_steinberg(img_array, rows, cols, has_transparency, palette):
    arr = img_array[:, :, :3].astype(np.float64)
    beads = []
    for r in range(rows):
        for c in range(cols):
            if has_transparency and int(img_array[r, c, 3]) < 128:
                beads.append({"row": r, "col": c, "label": "", "color": "#000000",
                               "done": False, "transparent": True})
                continue
            old_px = tuple(int(np.clip(arr[r, c, i], 0, 255)) for i in range(3))
            label, hex_color = palette.nearest(old_px)
            beads.append({"row": r, "col": c, "label": label, "color": hex_color,
                           "done": False, "transparent": False})
            new_rgb = np.array(hex_to_rgb(hex_color), dtype=np.float64)
            err = arr[r, c] - new_rgb
            if c+1 < cols: arr[r, c+1] = np.clip(arr[r, c+1] + err*7/16, 0, 255)
            if r+1 < rows:
                if c > 0: arr[r+1, c-1] = np.clip(arr[r+1, c-1] + err*3/16, 0, 255)
                arr[r+1, c] = np.clip(arr[r+1, c] + err*5/16, 0, 255)
                if c+1 < cols: arr[r+1, c+1] = np.clip(arr[r+1, c+1] + err*1/16, 0, 255)
    return beads


def _process_one(
    img: Image.Image,
    bead_size: int,
    force_cols: int,
    force_rows: int,
    dither: bool,
    use_lanczos: bool,
    one_to_one: bool,
    de_threshold: float,
    col_offset: int = 0,
    row_offset: int = 0,
) -> dict:
    """Process a single PIL image and return {"cols", "rows", "beads", "img_small"}."""
    has_alpha = img.mode in ('RGBA', 'LA', 'PA')
    img = img.convert("RGBA")

    if has_alpha:
        alpha = img.split()[3]
        bbox = alpha.point(lambda x: 255 if x >= 128 else 0).getbbox()
        if bbox: img = img.crop(bbox)

    iw, ih = img.size
    if force_cols > 0 and force_rows > 0: cols, rows = force_cols, force_rows
    elif force_cols > 0: cols = force_cols; rows = max(1, round(ih*cols/iw))
    elif force_rows > 0: rows = force_rows; cols = max(1, round(iw*rows/ih))
    else: cols = max(1, iw//bead_size); rows = max(1, ih//bead_size)

    if cols == 0 or rows == 0:
        raise ValueError("Image too small for bead_size.")

    filt = Image.LANCZOS if use_lanczos else Image.NEAREST
    img_small = img.resize((cols, rows), filt)
    img_array = np.array(img_small)

    if dither and not one_to_one:
        beads = _floyd_steinberg(img_array, rows, cols, has_alpha, PALETTE)
    else:
        pixel_grid = []; unique = set()
        for r in range(rows):
            row = []
            for c in range(cols):
                if has_alpha and int(img_array[r, c, 3]) < 128:
                    row.append(None)
                else:
                    px = tuple(int(v) for v in img_array[r, c, :3])
                    unique.add(px); row.append(px)
            pixel_grid.append(row)
        p2p = PALETTE.assign_one_to_one(list(unique), de_threshold) if one_to_one else PALETTE.assign(list(unique))
        beads = []
        for r in range(rows):
            for c in range(cols):
                px = pixel_grid[r][c]
                if px is None:
                    beads.append({"row": r+row_offset, "col": c+col_offset,
                                   "label": "", "color": "#000000", "done": False, "transparent": True})
                else:
                    label, hex_color = p2p[px]
                    beads.append({"row": r+row_offset, "col": c+col_offset,
                                   "label": label, "color": hex_color, "done": False, "transparent": False})

    # Apply offsets (dither path produces 0-based; apply offset here)
    if dither and not one_to_one:
        for b in beads:
            b["row"] += row_offset; b["col"] += col_offset

    return {"cols": cols, "rows": rows, "beads": beads, "img_small": img_small}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    if FRONTEND_DIST.exists():
        return FileResponse(FRONTEND_DIST / "index.html")
    return FileResponse(STATIC_LEGACY / "index.html")


@app.post("/process")
async def process_image(
    file: UploadFile = File(...),
    bead_size: int = Form(20),
    force_cols: int = Form(0),
    force_rows: int = Form(0),
    crop_x: float = Form(-1.0),
    crop_y: float = Form(-1.0),
    crop_w: float = Form(-1.0),
    crop_h: float = Form(-1.0),
    one_to_one: bool = Form(False),
    de_threshold: float = Form(10.0),
    dither: bool = Form(False),
    use_lanczos: bool = Form(True),
):
    if bead_size < 1:
        raise HTTPException(status_code=400, detail="bead_size must be >= 1")

    data = await file.read()
    img = Image.open(BytesIO(data))

    if all(v >= 0 for v in [crop_x, crop_y, crop_w, crop_h]):
        iw, ih = img.size
        x0, y0 = int(crop_x*iw), int(crop_y*ih)
        x1, y1 = int((crop_x+crop_w)*iw), int((crop_y+crop_h)*ih)
        x0, x1 = max(0,x0), min(iw,x1); y0, y1 = max(0,y0), min(ih,y1)
        if x1>x0 and y1>y0: img = img.crop((x0, y0, x1, y1))

    result = _process_one(img, bead_size, force_cols, force_rows,
                          dither, use_lanczos, one_to_one, de_threshold)

    stem = Path(file.filename).stem if file.filename else "image"
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in stem)
    board_path = UPLOADS_DIR / f"{safe}_board.png"
    result["img_small"].save(board_path, "PNG")

    return JSONResponse({
        "name": safe, "width": result["cols"], "height": result["rows"],
        "image_url": f"/uploads/{safe}_board.png", "beads": result["beads"],
    })


@app.post("/process-multi")
async def process_multi(
    files: list[UploadFile] = File(...),
    # JSON array: [{bead_size, force_cols, force_rows, dither, use_lanczos, one_to_one, de_threshold}]
    configs: str = Form(...),
    arrangement: str = Form("horizontal"),  # "horizontal" | "vertical" | "grid"
    grid_cols: int = Form(2),
):
    """Process multiple images and combine them into one board."""
    cfg_list = json.loads(configs)
    if len(cfg_list) != len(files):
        raise HTTPException(status_code=400, detail="configs length must match files count")

    processed = []
    for file, cfg in zip(files, cfg_list):
        data = await file.read()
        img = Image.open(BytesIO(data))
        try:
            result = _process_one(
                img,
                bead_size=cfg.get("bead_size", 20),
                force_cols=cfg.get("force_cols", 0),
                force_rows=cfg.get("force_rows", 0),
                dither=cfg.get("dither", False),
                use_lanczos=cfg.get("use_lanczos", True),
                one_to_one=cfg.get("one_to_one", False),
                de_threshold=cfg.get("de_threshold", 10.0),
            )
            stem = Path(file.filename).stem if file.filename else f"tile_{len(processed)}"
            safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in stem)
            board_path = UPLOADS_DIR / f"{safe}_board.png"
            result["img_small"].save(board_path, "PNG")
            processed.append({
                "name": safe, "cols": result["cols"], "rows": result["rows"],
                "beads": result["beads"], "image_url": f"/uploads/{safe}_board.png",
            })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error processing {file.filename}: {e}")

    # Combine into one board
    all_beads = []; col_offset = 0; row_offset = 0
    total_cols = 0; total_rows = 0

    if arrangement == "horizontal":
        total_rows = max(t["rows"] for t in processed)
        for tile in processed:
            for b in tile["beads"]:
                all_beads.append({**b, "col": b["col"] + col_offset})
            col_offset += tile["cols"]
        total_cols = col_offset

    elif arrangement == "vertical":
        total_cols = max(t["cols"] for t in processed)
        for tile in processed:
            for b in tile["beads"]:
                all_beads.append({**b, "row": b["row"] + row_offset})
            row_offset += tile["rows"]
        total_rows = row_offset

    else:  # grid
        n_cols = max(1, grid_cols)
        col_cursor = [0]; row_cursor = [0]; max_row_height = [0]
        tiles_per_row = {}
        for i, tile in enumerate(processed):
            gc = i % n_cols; gr = i // n_cols
            if gc == 0 and i > 0:
                row_cursor[0] += max_row_height[0]; max_row_height[0] = 0; col_cursor[0] = 0
            co = col_cursor[0]; ro = row_cursor[0]
            for b in tile["beads"]:
                all_beads.append({**b, "col": b["col"]+co, "row": b["row"]+ro})
            col_cursor[0] += tile["cols"]
            max_row_height[0] = max(max_row_height[0], tile["rows"])
        # Compute total dimensions
        max_col = max((b["col"] for b in all_beads), default=0) + 1
        max_row = max((b["row"] for b in all_beads), default=0) + 1
        total_cols, total_rows = max_col, max_row

    return JSONResponse({
        "name": "tiled", "width": total_cols, "height": total_rows,
        "beads": all_beads,
        "tiles": [{"name": t["name"], "cols": t["cols"], "rows": t["rows"],
                   "image_url": t["image_url"]} for t in processed],
    })


@app.get("/palette")
def get_palette():
    with open(PALETTE_PATH) as f:
        raw = yaml.safe_load(f)
    if all(isinstance(v, dict) for v in raw.values()):
        return JSONResponse(raw)
    return JSONResponse({"group_1": raw})


@app.get("/progress/{name}")
def get_progress(name: str):
    path = PROGRESS_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No saved progress found.")
    with open(path) as f:
        return JSONResponse(json.load(f))


@app.post("/progress/{name}")
async def save_progress(name: str, request: Request):
    data = await request.json()
    with open(PROGRESS_DIR / f"{name}.json", "w") as f:
        json.dump(data, f)
    return {"saved": True}


@app.get("/export/counts/{name}")
def export_counts(name: str):
    path = PROGRESS_DIR / f"{name}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No saved progress.")
    with open(path) as f:
        data = json.load(f)
    counts: dict[str, dict] = {}
    for b in data.get("beads", []):
        if b.get("transparent"): continue
        lbl = b["label"]
        if lbl not in counts: counts[lbl] = {"color": b["color"], "total": 0, "done": 0}
        counts[lbl]["total"] += 1
        if b.get("done"): counts[lbl]["done"] += 1
    lines = ["Label,Color,Total,Done,Remaining"]
    for lbl in sorted(counts):
        c = counts[lbl]
        lines.append(f'{lbl},{c["color"]},{c["total"]},{c["done"]},{c["total"]-c["done"]}')
    tot = sum(c["total"] for c in counts.values())
    dn  = sum(c["done"]  for c in counts.values())
    lines.append(f'TOTAL,,{tot},{dn},{tot-dn}')
    return StreamingResponse(BytesIO("\n".join(lines).encode()), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}_bead_counts.csv"'})


# ---------------------------------------------------------------------------
# Static files — React build takes priority, legacy static as fallback
# ---------------------------------------------------------------------------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
app.mount("/static",  StaticFiles(directory=str(STATIC_LEGACY)), name="static_legacy")


def run():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    run()
