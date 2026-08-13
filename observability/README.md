# POW Observability Stack

Self-hosted Prometheus + Grafana + Loki + Promtail + node_exporter + Alertmanager.
Exposed externally through the Cloudflare Tunnel connector that already runs on
the prod VPS (no separate `cloudflared` container here, and no inbound port
opens on the box for this stack). Runs alongside POW's PM2-managed processes
on the **production VPS** — this directory is version-controlled here in the
monorepo, but the stack itself must run co-located with `pow-dashboard-prod`
etc. (Prometheus scrapes them over `127.0.0.1`), not on a dev/workspace box.

## Setup (one-time, on the prod VPS)

**Deploy this to a stable path OUTSIDE the blue-green release tree — never
run it from inside `current-{env}/observability` or any `releases/<ts>/`
directory.** `deploy.sh`'s symlink swap on every deploy will silently orphan
whatever's bind-mounted from in there (this bit us once already: containers
kept running against a directory the `current-prod` symlink no longer
pointed to, `.env` and any un-committed local edits vanished from view when
the next deploy landed). Copy this directory to something like
`/root/pow-observability/` (a sibling of the app's deploy root, not inside
it) and always operate from there:

```bash
rsync -a --exclude .env /path/to/repo/observability/ /root/pow-observability/
cd /root/pow-observability
sudo ./setup.sh
```

Re-run that `rsync` + `docker compose up -d` (or `restart` for services whose
compose *definition* didn't change, since `up -d` is a no-op when only a
bind-mounted file's contents changed) whenever config changes land in the
repo — this directory does not update itself on deploy, by design.

`setup.sh` generates `.env` (a random Grafana admin password — printed once,
save it) if one doesn't already exist, makes the config tree readable
regardless of which non-root UID each image runs as, brings the stack up,
and prints health checks + a resource usage snapshot.

Then, in the Cloudflare Zero Trust dashboard, on this box's existing tunnel,
add a **Public Hostname**: e.g. `grafana.atriasafety.org` → service
`http://127.0.0.1:3300`. Add a Cloudflare Access policy on that hostname
(email allow-list / SSO) if you want a second gate in front of Grafana's own
login. Prometheus (`:9090`) and Alertmanager (`:9093`) can get their own
Public Hostnames the same way if you ever want them reachable without an SSH
tunnel — entirely a dashboard change, nothing here to edit.

If PM2 runs under a different user/path than `/root/.pm2/logs` on this box,
set `PM2_LOG_DIR=/actual/path/.pm2/logs` in `.env` before running `setup.sh`.

## Start / stop / logs

```bash
cd observability
docker compose up -d          # apply config changes (or use ./setup.sh)
docker compose down           # stop, keep volumes/data
docker compose ps             # status
docker compose logs -f grafana
docker stats                  # confirm combined RSS stays under budget
```

## Port map (all bound to 127.0.0.1 — never expose these directly)

| Service | Port | Notes |
|---|---|---|
| Prometheus | 9090 | `ssh -L 9090:127.0.0.1:9090 <user>@<prod-host>` to browse locally |
| Alertmanager | 9093 | |
| Loki | 3100 | queried through Grafana, not directly |
| Promtail (admin) | 19080 | rebound off the default 9080 |
| node_exporter | 9100 | |
| Grafana | 3300 | the only one meant to be reached externally, via the tunnel |

## Memory budget

Combined `mem_limit` ceiling ≈ 714MB, expected steady-state ≈ 350MB (measured
~189MB combined during a dry run). `setup.sh` prints `docker stats` at the end
of every run so this is easy to re-check — if the prod VPS is also
resource-constrained, trim Prometheus/Loki retention (`prometheus.yml`'s
`--storage.tsdb.retention.*` flags, `loki-config.yml`'s `retention_period`)
before raising any limits.

## What NOT to do

- Don't add `ports:` publish mappings to any service — everything here relies
  on `network_mode: host` + explicit `127.0.0.1` binds for "not exposed."
- Don't add cAdvisor — POW isn't containerized, so it would only surface every
  *other* tenant's containers on a shared box, not POW signal.
- Don't scrape/tail logs system-wide — Promtail is scoped to the PM2 `pow-*`
  log files only.
- Don't run this stack on a box that doesn't also run POW's PM2 processes —
  the whole design assumes `127.0.0.1` reachability to `pow-dashboard-*` /
  `pow-bot-*` / `pow-sync-*`.
