# Beadify — Deployment Guide

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| uv | latest | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Vercel CLI | latest | `npm i -g vercel` |
| Git | any | [git-scm.com](https://git-scm.com) |

---

## 1. Local Development

```bash
# Clone and install
git clone <your-repo-url>
cd beadify

# Python deps
uv sync

# JS deps
cd frontend
npm install
cd ..

# Run both servers (two terminals)
# Terminal 1 — FastAPI backend on :8000
uv run beadify

# Terminal 2 — Vite dev server on :5173 (hot reload, proxies API to :8000)
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

> The Vite proxy in `frontend/vite.config.js` forwards all `/process`, `/palette`, `/progress`, etc. calls to FastAPI on port 8000 automatically — no manual CORS config needed in development.

---

## 2. Production Build

Build the React frontend before deploying:

```bash
cd frontend
npm run build      # outputs to frontend/dist/
cd ..
```

FastAPI serves `frontend/dist/` as static files automatically when it exists.  
To test the production build locally:

```bash
uv run beadify     # visit http://localhost:8000
```

---

## 3. Deploy to Vercel (standalone)

This gives you a URL like `beadify-it.vercel.app`.

### Step 1 — Push to GitHub

```bash
git add .
git commit -m "ready for deploy"
git push origin main
```

### Step 2 — Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. **Framework Preset**: leave as *Other*
4. **Build Command**: `cd frontend && npm run build`
5. **Output Directory**: `frontend/dist`
6. Click **Deploy**

> Vercel reads `vercel.json` at the root. All traffic is routed through `main.py` (FastAPI as a serverless function) which serves both the API and the built frontend.

### Step 3 — Environment variables

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|---|---|---|
| `BEADIFY_READONLY` | `1` | Redirects file writes to `/tmp` (Vercel is read-only) |

> Because Vercel serverless functions are ephemeral, **progress files do not persist between deployments or cold starts.** For persistent storage, see [alternatives](#persistent-storage) below.

### Alternative: deploy via CLI

```bash
cd beadify
vercel          # follow prompts — production deploy
vercel --prod   # subsequent deploys
```

---

## 4. Connecting to danpablo.dev

You have two options depending on what URL structure you want.

---

### Option A — Subdomain: `beadify.danpablo.dev` ✅ Recommended

Zero code changes. Works perfectly with the standard build.

**Steps:**

1. In your **Beadify** Vercel project → **Settings → Domains**
2. Click **Add Domain**
3. Enter `beadify.danpablo.dev`
4. Vercel will show you a DNS record to add — it will be one of:
   - `CNAME beadify → cname.vercel-dns.com` (if danpablo.dev uses Vercel nameservers)
   - `A beadify → 76.76.21.21` (if you manage DNS elsewhere, e.g. Namecheap, Cloudflare)
5. Add that record in your DNS provider's dashboard
6. Wait for propagation (usually < 5 minutes on Vercel DNS, up to 24h elsewhere)
7. Vercel auto-provisions a TLS certificate

That's it — `https://beadify.danpablo.dev` is live.

---

### Option B — Subpath: `danpablo.dev/beadify-it`

Requires two projects: the main **danpablo.dev** site and the **Beadify** app. Vercel's rewrite feature proxies the subpath to the Beadify deployment.

#### Step 1 — Build Beadify with the correct base path

```bash
cd frontend
VITE_BASE=/beadify-it/ npm run build
cd ..
```

> `VITE_BASE` tells Vite to prefix all asset URLs with `/beadify-it/` so they resolve correctly when proxied through danpablo.dev.

#### Step 2 — Deploy Beadify to Vercel (standalone)

Follow [Section 3](#3-deploy-to-vercel-standalone) above. Your Beadify app will have its own Vercel URL — note it down (e.g. `beadify-production-abc123.vercel.app`).

In Vercel → Beadify project → **Settings → Environment Variables**, also add:

| Variable | Value |
|---|---|
| `VITE_BASE` | `/beadify-it/` |

Then trigger a redeploy so Vercel rebuilds with the correct base.

#### Step 3 — Add rewrites to your danpablo.dev Vercel project

In the **danpablo.dev** repository, open (or create) `vercel.json` and add a `rewrites` block:

```json
{
  "rewrites": [
    {
      "source": "/beadify-it/:path*",
      "destination": "https://beadify-production-abc123.vercel.app/:path*"
    }
  ]
}
```

Replace `beadify-production-abc123.vercel.app` with your actual Beadify deployment URL.

> **If your danpablo.dev `vercel.json` already has a catch-all rewrite** (e.g. for a Next.js or SPA), put the Beadify rule **before** it so it matches first.

```json
{
  "rewrites": [
    {
      "source": "/beadify-it/:path*",
      "destination": "https://beadify-production-abc123.vercel.app/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

#### Step 4 — Redeploy danpablo.dev

```bash
cd danpablo.dev   # your main site repo
git add vercel.json
git commit -m "add beadify-it rewrite"
git push
```

Vercel deploys automatically on push. Your app is now live at `https://danpablo.dev/beadify-it/`.

#### How the routing works

```
Browser: danpablo.dev/beadify-it/
  → Vercel rewrite → beadify.vercel.app/

Browser fetches: danpablo.dev/beadify-it/assets/index.js
  → Vercel rewrite → beadify.vercel.app/assets/index.js  ✓

React app calls: fetch('/beadify-it/process', ...)
  → Vercel rewrite → beadify.vercel.app/process  ✓
```

---

## Persistent Storage

Vercel serverless functions have a read-only filesystem — progress files saved during a session live in `/tmp` and are lost when the function instance is recycled.

For persistent progress, deploy on a platform with a writable disk instead:

| Platform | Notes |
|---|---|
| **Railway** | `railway up` — persistent disk, always-on server |
| **Fly.io** | `fly launch` — persistent volumes, Docker-based |
| **Render** | `render.yaml` — persistent disk add-on |
| **Self-hosted VPS** | Run `uv run beadify` behind nginx/caddy |

On these platforms, **remove** the `BEADIFY_READONLY=1` env var — the app will write to `progress/` and `uploads/` on disk as normal.

---

## Re-deploying after changes

```bash
# Rebuild frontend
cd frontend && npm run build && cd ..

# Commit everything including the built dist/
git add frontend/dist
git commit -m "rebuild frontend"
git push
```

Vercel triggers a new deployment automatically on push.

> Alternatively, add `cd frontend && npm run build` as the Vercel **Build Command** in project settings and Vercel will run it on every push — no need to commit `dist/`.
