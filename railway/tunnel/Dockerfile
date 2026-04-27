# Cloudflared sidecar for the npr-dashboard-prototype Railway project.
#
# Runs as a separate Railway service alongside the Next.js web service.
# Reads TUNNEL_TOKEN from Railway env vars (cloudflared's native env var name)
# and opens an outbound tunnel to Cloudflare. Cloudflare then routes
# https://portal.utstitle.com traffic through this tunnel to the web service
# over Railway's private network, per the Public Hostname setting in the CF
# Zero Trust dashboard.
#
# No ports exposed. No public ingress. The sidecar only initiates outbound
# connections to Cloudflare.
#
# Image notes:
# - `cloudflare/cloudflared:latest` is a distroless image. No shell available.
# - Its ENTRYPOINT is `["cloudflared", "--no-autoupdate"]` by default.
# - We only need to set CMD to the subcommand; do NOT override ENTRYPOINT.
# - `cloudflared tunnel run` reads TUNNEL_TOKEN from env automatically.

FROM cloudflare/cloudflared:latest

CMD ["tunnel", "run"]
