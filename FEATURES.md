# Suggested Features

Ideas you can pick from for future development. Grouped by effort level.

---

## Low effort

### Palette editor UI
Edit your bead palette directly in the browser — add colors, rename labels, change hex values — without touching `color_palette.yaml`. Changes persist via a `/palette` PATCH endpoint.

### Bead done count in tooltip
On hover, show the label, hex, and how many of that color are left undone. (Currently only shows row/col.)

### Keyboard shortcut help overlay
Press `?` to pop up a reference card of all keyboard shortcuts (arrow keys, space, Ctrl+Z, etc.).

### "Print pattern" view
A stripped-down, high-contrast print-optimized view: white background, each bead shows its label, a legend with counts. Can be triggered by `Ctrl+P` or a dedicated button.

### Progress export to JSON
Download your current `progress/<name>.json` directly from the UI — useful for backups or sharing.

### Brightness / contrast adjustment
Simple sliders before processing to brighten or darken the image. Helps when palette colors are far from the source image's tone.

### Hue rotation
Rotate all palette colors by N degrees (or shift the source image's hue) to explore color variants of a design.

---

## Medium effort

### Palette groups editor
Reorganize colors into groups (e.g. "Reds", "Blues") in the UI rather than editing YAML. Drag and drop colors between groups.

### Multi-image project / tiling
Process multiple images and arrange them side-by-side on a single large board — useful for building a collage or a large piece that spans multiple perler pegboards.

### "Buy list" view
From the bead counts, automatically calculate how many bags/packs to buy given a per-pack quantity you supply. E.g. "You need 342 of A10; at 500/bag that's 1 bag."

### Undo/redo history panel
Show a sidebar list of recent actions so you can jump back more than one step. Currently undo/redo is per-click only.

### Palette import from image
Extract a palette automatically from an uploaded reference image (e.g. a photo of your bead collection). Uses k-means clustering to pick N representative colors.

### Color distance heatmap overlay
Overlay a heatmap on the board showing how closely each bead's palette color matches the original pixel. Bright = close match, dim = poor match.

### Export to PDF
Generate a printable PDF of the board with labels, optionally split across multiple pages for large patterns.

### Undo for "Mark all" actions
Currently "Mark all beads of this color" is pushed as one undo entry, but the undo/redo history panel above would make this much more useful.

---

## High effort / Architecture changes

### React rewrite
Convert the vanilla JS frontend to React + a state management solution (Zustand or Redux). Benefits: component reuse, easier testing, hot module replacement. Cons: adds build tooling (Vite), larger bundle, more dependencies. Good choice if the codebase keeps growing.

The natural split:
- `<SetupPanel>` — file input, grid settings, options
- `<PreviewPanel>` — live canvas preview
- `<BoardPanel>` — bead grid + toolbar + legend
- `<PaletteModal>`, `<CropModal>`, `<FocusPickerModal>` — modals

### Real-time collaboration
Multiple people marking beads simultaneously via WebSockets. The server broadcasts `bead:toggle` events; each client applies them to its local state.

### Cloud storage backend
Replace local file storage for progress and uploads with S3/R2 (or similar). Required for a truly stateless/scalable Vercel or serverless deployment. Progress keys become user-scoped (login or anonymous session token).

### User accounts
Sign in with Google/GitHub. Each user gets their own set of projects. Progress is stored per-user in a database (SQLite → PostgreSQL path).

### AI palette matching
Given an image, automatically suggest which commercial bead brand/line to buy. Trained or zero-shot comparison against known brand palettes (Hama, Perler, Artkal, etc.).

### Animated assembly guide
Step-by-step overlay: highlight the next row/column to place, showing only the beads you need to add next. Advances automatically when you mark them done.

### Mobile companion app
A native iOS/Android app that syncs progress with the server in real time. Designed for handheld use while physically placing beads — large tap targets, offline support.
