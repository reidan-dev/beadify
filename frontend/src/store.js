import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { saveProgress as apiSave, loadProgress as apiLoad,
         processImage as apiProcess, processMulti as apiProcessMulti } from './api.js';
import { getTransformedCanvas } from './utils.js';

export const useStore = create(
  persist(
    (set, get) => ({
      // ===================================================================
      // Project
      // ===================================================================
      project:  null,
      doneSet:  new Set(),
      beadMap:  new Map(),

      setProject(data) {
        const doneSet = new Set(
          data.beads.filter(b => b.done && !b.transparent).map(b => `${b.row}:${b.col}`)
        );
        const beadMap = new Map();
        for (const b of data.beads) {
          if (!b.transparent) beadMap.set(`${b.row}:${b.col}`, b);
        }
        set({
          project: data, doneSet, beadMap,
          activeTab: 'board',
          selectedLabel: null, hiddenLabels: new Set(),
          markedRows: new Set(), markedCols: new Set(),
          activeTool: null,
          guideOriginCol: null, guideOriginRow: null,
          undoStack: [], redoStack: [],
        });
      },

      // ===================================================================
      // Board generation (shared by Setup panel + Board "Regenerate")
      // ===================================================================
      generating: false,

      async generateBoard() {
        const s = get();
        set({ generating: true });
        try {
          if (s.tilesMode) {
            if (s.tiles.length < 2) {
              s.setStatus('Add at least 2 images for multi-image mode.', 'error');
              return;
            }
            const configs = s.tiles.map(tile => ({
              bead_size:    tile.beadSize,
              force_cols:   tile.forceCols || 0,
              force_rows:   tile.forceRows || 0,
              dither:       s.dither,
              use_lanczos:  s.useLanczos,
              one_to_one:   false,
              de_threshold: s.deThreshold,
            }));
            const fd = new FormData();
            fd.append('arrangement', s.tileArrangement);
            if (s.tileArrangement === 'grid') fd.append('grid_cols', String(s.tileGridCols));
            fd.append('configs', JSON.stringify(configs));
            for (const tile of s.tiles) {
              const transformed = getTransformedCanvas(tile.image, {
                cropSelection: tile.cropSelection ?? null,
                flipX: tile.flipX ?? false, flipY: tile.flipY ?? false, rotation: tile.rotation ?? 0,
              });
              const blob = await new Promise((res, rej) =>
                transformed.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
              fd.append('files', blob, tile.name);
            }
            const data = await apiProcessMulti(fd);
            get().setProject(data);
            get().setStatus(`Multi-image board: ${data.width}×${data.height} (${data.beads.filter(b => !b.transparent).length} beads)`, 'ok');
          } else {
            if (!s.loadedImage) { s.setStatus('Upload an image first.', 'error'); return; }
            const transformed = getTransformedCanvas(s.loadedImage, {
              cropSelection: s.cropSelection, flipX: s.imgFlipX, flipY: s.imgFlipY, rotation: s.imgRotation,
            });
            const blob = await new Promise((res, rej) =>
              transformed.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/png'));
            const fd = new FormData();
            fd.append('file',         blob, 'image.png');
            fd.append('bead_size',    String(s.beadSize));
            fd.append('force_cols',   String(s.forceCols));
            fd.append('force_rows',   String(s.forceRows));
            fd.append('dither',       String(s.dither));
            fd.append('use_lanczos',  String(s.useLanczos));
            fd.append('one_to_one',   String(s.oneToOne));
            fd.append('de_threshold', String(s.deThreshold));
            const data = await apiProcess(fd);
            get().setProject(data);
            get().setStatus(`Board ready: ${data.width}×${data.height} (${data.beads.filter(b => !b.transparent).length} beads)`, 'ok');
          }
          get().setActiveTab('board');
        } catch (err) {
          get().setStatus(`Error: ${err.message}`, 'error');
        } finally {
          set({ generating: false });
        }
      },

      // ===================================================================
      // Status
      // ===================================================================
      status: null,
      setStatus(msg, type = 'info') { set({ status: { msg, type } }); },
      clearStatus() { set({ status: null }); },

      // ===================================================================
      // Active tab
      // ===================================================================
      activeTab: 'setup',
      setActiveTab(tab) { set({ activeTab: tab }); },

      // ===================================================================
      // Theme
      // ===================================================================
      theme: 'dark',
      setTheme(t) { set({ theme: t }); },
      toggleTheme() { set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })); },

      // ===================================================================
      // Single-image setup
      // ===================================================================
      loadedImage:   null,
      cropSelection: null,
      imgFlipX:      false,
      imgFlipY:      false,
      imgRotation:   0,

      setLoadedImage(img) { set({ loadedImage: img, cropSelection: null, activeTab: 'preview' }); },
      setCropSelection(sel) { set({ cropSelection: sel }); },
      toggleFlipX()  { set(s => ({ imgFlipX: !s.imgFlipX })); },
      toggleFlipY()  { set(s => ({ imgFlipY: !s.imgFlipY })); },
      rotateCw()     { set(s => ({ imgRotation: (s.imgRotation + 90)  % 360 })); },
      rotateCcw()    { set(s => ({ imgRotation: (s.imgRotation + 270) % 360 })); },

      // ===================================================================
      // Grid settings
      // ===================================================================
      beadSize:  2,
      forceCols: 0,
      forceRows: 0,

      setBeadSize(n)  { set({ beadSize:  Math.max(1, n) }); },
      setForceCols(n) { set({ forceCols: Math.max(0, n) }); },
      setForceRows(n) { set({ forceRows: Math.max(0, n) }); },

      // ===================================================================
      // Processing options
      // ===================================================================
      useLanczos:   true,
      dither:       false,
      oneToOne:     false,
      deThreshold:  10,

      setUseLanczos(v)  { set({ useLanczos: v }); },
      setDither(v)      { set({ dither: v, ...(v ? { oneToOne: false } : {}) }); },
      setOneToOne(v)    { set({ oneToOne: v, ...(v ? { dither: false } : {}) }); },
      setDeThreshold(v) { set({ deThreshold: v }); },

      // ===================================================================
      // Multi-image tiles
      // ===================================================================
      tilesMode:       false,
      tiles:           [],
      tileArrangement: 'horizontal',
      tileGridCols:    2,

      setTilesMode(v)       { set({ tilesMode: v }); },
      setTileArrangement(v) { set({ tileArrangement: v }); },
      setTileGridCols(n)    { set({ tileGridCols: Math.max(1, n) }); },

      addTile(tile)        { set(s => ({ tiles: [...s.tiles, tile] })); },
      removeTile(id)       { set(s => ({ tiles: s.tiles.filter(t => t.id !== id) })); },
      updateTile(id, upd)  { set(s => ({ tiles: s.tiles.map(t => t.id === id ? { ...t, ...upd } : t) })); },
      clearTiles()         { set({ tiles: [] }); },

      // ===================================================================
      // Display
      // ===================================================================
      cellPx:      12,
      gapPx:       1,
      roundBeads:  false,
      showAllMode: false,
      boardBg:     '#000000',

      setCellPx(n)       { set({ cellPx: Math.max(1, Math.min(60, n)) }); },
      setGapPx(n)        { set({ gapPx:  Math.max(0, n) }); },
      toggleRoundBeads() { set(s => ({ roundBeads: !s.roundBeads })); },
      toggleShowAll()    { set(s => ({ showAllMode: !s.showAllMode })); },
      setBoardBg(c)      { set({ boardBg: c }); },

      // ===================================================================
      // Legend / visibility
      // ===================================================================
      selectedLabel: null,
      hiddenLabels:  new Set(),
      legendSort:    'name',  // 'name' | 'count' | 'color'

      selectLabel(label) {
        set(s => ({ selectedLabel: s.selectedLabel === label ? null : label }));
      },
      clearSelection() { set({ selectedLabel: null }); },
      setLegendSort(s) { set({ legendSort: s }); },

      toggleHiddenLabel(label) {
        const hl = new Set(get().hiddenLabels);
        hl.has(label) ? hl.delete(label) : hl.add(label);
        set({ hiddenLabels: hl });
      },
      toggleAllLabels() {
        const { project, hiddenLabels } = get();
        if (!project) return;
        const allLabels = [...new Set(project.beads.filter(b => !b.transparent).map(b => b.label))];
        const anyVisible = allLabels.some(l => !hiddenLabels.has(l));
        set({ hiddenLabels: new Set(anyVisible ? allLabels : []) });
      },

      // ===================================================================
      // Tool
      // ===================================================================
      activeTool: null,
      setActiveTool(tool) {
        set(s => ({ activeTool: s.activeTool === tool ? null : tool }));
      },

      // ===================================================================
      // Line marks
      // ===================================================================
      markedRows: new Set(),
      markedCols: new Set(),

      toggleMarkedRow(row) {
        const rows = new Set(get().markedRows);
        rows.has(row) ? rows.delete(row) : rows.add(row);
        set({ markedRows: rows });
      },
      toggleMarkedCol(col) {
        const cols = new Set(get().markedCols);
        cols.has(col) ? cols.delete(col) : cols.add(col);
        set({ markedCols: cols });
      },
      clearMarks() { set({ markedRows: new Set(), markedCols: new Set() }); },

      // ===================================================================
      // Guide grid
      // ===================================================================
      guideN:         5,
      guideOriginCol: null,
      guideOriginRow: null,
      guideLocked:    true,
      guideColor:     '#5ba4f5',
      guideVisible:   true,

      setGuideN(n)         { set({ guideN: Math.max(0, n) }); },
      setGuideOrigin(c, r) { set({ guideOriginCol: c, guideOriginRow: r }); },
      toggleGuideLock()    { set(s => ({ guideLocked: !s.guideLocked })); },
      toggleGuideVisible() { set(s => ({ guideVisible: !s.guideVisible })); },
      setGuideColor(c)     { set({ guideColor: c }); },
      clearGuide()         {
        set({ guideN: 0, guideOriginCol: null, guideOriginRow: null,
              guideLocked: true, guideVisible: false });
      },

      // ===================================================================
      // Rulers
      // ===================================================================
      showRulers:     false,
      rulerRowOffset: 0,
      rulerColOffset: 0,

      toggleRulers()       { set(s => ({ showRulers: !s.showRulers })); },
      setRulerRowOffset(n) { set({ rulerRowOffset: n }); },
      setRulerColOffset(n) { set({ rulerColOffset: n }); },

      // ===================================================================
      // View rotation
      // ===================================================================
      viewRotation: 0,

      rotateViewCw()  { set(s => ({ viewRotation: (s.viewRotation + 45)  % 360 })); },
      rotateViewCcw() { set(s => ({ viewRotation: (s.viewRotation - 45 + 360) % 360 })); },

      // ===================================================================
      // Undo / redo
      // ===================================================================
      undoStack: [],
      redoStack: [],

      pushUndo(changes) {
        const stack = [...get().undoStack, changes].slice(-100);
        set({ undoStack: stack, redoStack: [] });
      },

      _applyChanges(changes, reverse) {
        const doneSet = new Set(get().doneSet);
        const beadMap = get().beadMap;
        for (const { row, col, prev, next } of changes) {
          const done = reverse ? prev : next;
          const key = `${row}:${col}`;
          done ? doneSet.add(key) : doneSet.delete(key);
          const bead = beadMap.get(key);
          if (bead) bead.done = done;
        }
        set({ doneSet });
        get().saveProgress();
      },

      undo() {
        const { undoStack, redoStack } = get();
        if (!undoStack.length) return;
        const changes = undoStack[undoStack.length - 1];
        set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, changes] });
        get()._applyChanges(changes, true);
      },

      redo() {
        const { undoStack, redoStack } = get();
        if (!redoStack.length) return;
        const changes = redoStack[redoStack.length - 1];
        set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, changes] });
        get()._applyChanges(changes, false);
      },

      // ===================================================================
      // Bead interactions
      // ===================================================================
      toggleBead(row, col) {
        const { doneSet, beadMap } = get();
        const key = `${row}:${col}`;
        if (!beadMap.has(key)) return;
        const prev = doneSet.has(key);
        const next = !prev;
        const newDoneSet = new Set(doneSet);
        next ? newDoneSet.add(key) : newDoneSet.delete(key);
        const bead = beadMap.get(key);
        if (bead) bead.done = next;
        set({ doneSet: newDoneSet });
        get().pushUndo([{ row, col, prev, next }]);
        get().saveProgress();
      },

      floodFill(startRow, startCol) {
        const { beadMap, doneSet } = get();
        const startBead = beadMap.get(`${startRow}:${startCol}`);
        if (!startBead) return;
        const targetLabel = startBead.label;
        const changes = [];
        const visited = new Set();
        const queue = [[startRow, startCol]];
        const newDoneSet = new Set(doneSet);
        visited.add(`${startRow}:${startCol}`);

        while (queue.length) {
          const [r, c] = queue.shift();
          const b = beadMap.get(`${r}:${c}`);
          if (!b || b.label !== targetLabel) continue;
          const key = `${r}:${c}`;
          if (!newDoneSet.has(key)) {
            changes.push({ row: r, col: c, prev: false, next: true });
            newDoneSet.add(key);
            b.done = true;
          }
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const k = `${r + dr}:${c + dc}`;
              if (!visited.has(k) && beadMap.has(k)) { visited.add(k); queue.push([r + dr, c + dc]); }
            }
          }
        }
        if (changes.length) {
          set({ doneSet: newDoneSet });
          get().pushUndo(changes);
          get().saveProgress();
        }
      },

      markSelection(r1, c1, r2, c2) {
        const { beadMap, doneSet } = get();
        const inRect = [];
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++)
            if (beadMap.has(`${r}:${c}`)) inRect.push([r, c]);
        if (!inRect.length) return;

        const newDoneSet = new Set(doneSet);
        const allDone = inRect.every(([r, c]) => newDoneSet.has(`${r}:${c}`));
        const next = !allDone;
        const changes = [];
        for (const [r, c] of inRect) {
          const key = `${r}:${c}`;
          const prev = newDoneSet.has(key);
          if (prev === next) continue;
          changes.push({ row: r, col: c, prev, next });
          next ? newDoneSet.add(key) : newDoneSet.delete(key);
          const bead = beadMap.get(key);
          if (bead) bead.done = next;
        }
        if (changes.length) {
          set({ doneSet: newDoneSet });
          get().pushUndo(changes);
          get().saveProgress();
        }
      },

      markAllByLabel(label, done) {
        const { project, beadMap, doneSet } = get();
        if (!project) return;
        const newDoneSet = new Set(doneSet);
        const changes = [];
        for (const b of project.beads) {
          if (b.label !== label || b.transparent) continue;
          const key = `${b.row}:${b.col}`;
          const prev = newDoneSet.has(key);
          if (prev === done) continue;
          changes.push({ row: b.row, col: b.col, prev, next: done });
          done ? newDoneSet.add(key) : newDoneSet.delete(key);
          const bead = beadMap.get(key);
          if (bead) bead.done = done;
        }
        if (changes.length) {
          set({ doneSet: newDoneSet });
          get().pushUndo(changes);
          get().saveProgress();
        }
      },

      clearAll() {
        const { project, beadMap } = get();
        if (!project) return;
        const changes = [];
        const oldDoneSet = get().doneSet;
        for (const b of project.beads) {
          if (b.transparent) continue;
          const key = `${b.row}:${b.col}`;
          if (oldDoneSet.has(key)) {
            changes.push({ row: b.row, col: b.col, prev: true, next: false });
            const bead = beadMap.get(key);
            if (bead) bead.done = false;
          }
        }
        if (changes.length) {
          set({ doneSet: new Set() });
          get().pushUndo(changes);
          get().saveProgress();
        }
      },

      swapColor(oldLabel, newLabel, newHex) {
        const { project, beadMap } = get();
        if (!project) return;
        const updatedBeads = project.beads.map(b =>
          b.label === oldLabel ? { ...b, label: newLabel, color: newHex } : b
        );
        const newBeadMap = new Map();
        for (const [k, b] of beadMap) {
          newBeadMap.set(k, b.label === oldLabel ? { ...b, label: newLabel, color: newHex } : b);
        }
        set({ project: { ...project, beads: updatedBeads }, beadMap: newBeadMap });
        get().saveProgress();
      },

      // ===================================================================
      // Reset
      // ===================================================================
      resetAll() {
        set({
          project: null, doneSet: new Set(), beadMap: new Map(),
          loadedImage: null, cropSelection: null,
          tiles: [], tilesMode: false,
          activeTab: 'setup',
          undoStack: [], redoStack: [],
          status: null,
          selectedLabel: null, hiddenLabels: new Set(),
          markedRows: new Set(), markedCols: new Set(),
          activeTool: null,
          imgFlipX: false, imgFlipY: false, imgRotation: 0,
          guideOriginCol: null, guideOriginRow: null,
        });
      },

      // ===================================================================
      // Save / Load
      // ===================================================================
      async saveProgress() {
        const { project } = get();
        if (!project) return;
        try { await apiSave(project.name, project); } catch { /* silent */ }
      },

      async manualSave() {
        const { project } = get();
        if (!project) return;
        try {
          await apiSave(project.name, project);
          get().setStatus('Progress saved.', 'ok');
        } catch (err) {
          get().setStatus(`Save failed: ${err.message}`, 'error');
        }
      },

      async loadProgressForProject(name, verbose = false) {
        try {
          const saved = await apiLoad(name);
          if (!saved) { if (verbose) get().setStatus('No saved progress.', 'info'); return false; }
          const { project, beadMap } = get();
          const doneSet = new Set(saved.beads.filter(b => b.done).map(b => `${b.row}:${b.col}`));
          for (const b of (project?.beads ?? [])) b.done = doneSet.has(`${b.row}:${b.col}`);
          for (const [k, b] of beadMap) b.done = doneSet.has(k);
          set({ doneSet });
          if (verbose) get().setStatus('Progress loaded.', 'ok');
          return true;
        } catch (err) {
          if (verbose) get().setStatus(`Load failed: ${err.message}`, 'error');
          return false;
        }
      },
    }),
    {
      name: 'beadify-settings',
      // Only persist plain-value settings — no HTMLImageElement, Set, Map, or project data
      partialize: (state) => ({
        theme:          state.theme,
        cellPx:         state.cellPx,
        gapPx:          state.gapPx,
        roundBeads:     state.roundBeads,
        boardBg:        state.boardBg,
        beadSize:       state.beadSize,
        useLanczos:     state.useLanczos,
        dither:         state.dither,
        oneToOne:       state.oneToOne,
        deThreshold:    state.deThreshold,
        guideN:         state.guideN,
        guideColor:     state.guideColor,
        guideVisible:   state.guideVisible,
        showRulers:     state.showRulers,
        rulerRowOffset: state.rulerRowOffset,
        rulerColOffset: state.rulerColOffset,
        legendSort:     state.legendSort,
        tileArrangement:state.tileArrangement,
        tileGridCols:   state.tileGridCols,
      }),
    }
  )
);
