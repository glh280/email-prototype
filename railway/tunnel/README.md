# tunnel — Cloudflared sidecar

This directory contains the Dockerfile for the **`tunnel`** Railway service.

## What it does

Runs [`cloudflared`](https://github.com/cloudflare/cloudflared) as a separate Railway service in the `npr-dashboard-prototype` project. Holds an outbound tunnel connection to Cloudflare's edge. Cloudflare Access → Cloudflare edge → this tunnel → Next.js web service (via Railway private networking) is the full request path.

## Why a sidecar and not inside the Next.js container?

- Independent restarts: if the tunnel flaps, Next.js stays up
- Clearer separation of concerns in logs + metrics
- Matches the single-responsibility pattern the P0.5 plan called for

## Required env var (set in Railway on THIS service only)

- `CLOUDFLARED_TOKEN` — long string starting with `eyJ...` from Cloudflare Zero Trust dashboard → Networks → Tunnels → `npr-dashboard` → Connector install screen. The token embeds the tunnel ID and credentials.

## How to deploy (first time)

1. Railway dashboard → `npr-dashboard-prototype` project → **+ New** → **Empty Service**
2. Name the service **`tunnel`**
3. Settings → Source → Connect to GitHub repo `glh280/npr-dashboard-prototype`
4. Settings → Source → Root Directory: `railway/tunnel`
5. Settings → Deploy → Watch Paths: `railway/tunnel/**`
6. Variables → add `CLOUDFLARED_TOKEN` with the token from CF dashboard
7. Deploy. Service should show `Registered tunnel connection` in logs within 30 seconds
8. Verify in Cloudflare dashboard → Networks → Tunnels → `npr-dashboard` shows **Healthy**

## Healthcheck

Railway doesn't need a healthcheck for this service — it has no inbound ports. Container health is determined by Cloudflare's tunnel status (visible in the CF dashboard).
