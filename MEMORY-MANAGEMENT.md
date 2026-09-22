# =============================================================================
# PDE Memory Management Guide — 6 GB Docker Desktop
# (Ram provided to Docker: 6 GB. Verified with: docker info --format '{{.MemTotal}}')
# =============================================================================

## 1. Why (measured on this machine)

| Measurement | Value |
|---|---|
| Docker VM total RAM | 6213464064 bytes (5.79 GiB usable) |
| kind node idle-ish (apps + monitoring + ArgoCD + system pods) | 2.4–2.8 GiB |
| pde-backend (Compose, single uvicorn) | 123 MiB / 256 MiB limit |
| pde-postgres (shared_buffers=128MB, max_connections=30) | 38 MiB / 512 MiB limit |
| kind-registry | ~13 MiB |
| pde-sonar (SonarQube Community — Mode E only) | cap 3584 MiB |
| pde-sonar-db (postgres:16-alpine — Mode E only) | cap 256 MiB |
| sonar-scanner container (ephemeral, scan time only) | cap 512 MiB |

Rules of thumb for a 6 GB ceiling:
- kind node holds ALL pods (control plane + app + ArgoCD + monitoring). Budget inside it.
- Jenkins controller limit (1 GiB) does NOT cap sibling build/test containers. Cap them
  separately with --memory in the Jenkinsfile (already done).
- Do not run docker compose + kind stack at the same time. Pick one.
- SonarQube (Mode E) is its OWN session — never concurrent with kind:
  kind 2.6 + Jenkins 0.8 + SonarQube 3.5 + db 0.25 + scanner 0.5 = 7.65 GiB > 5.79 GiB.
  With kind stopped the same work fits in ~4.25 GiB.
- Do NOT shrink SonarQube's JVM heaps to save memory — both attempts failed on
  this machine (Elasticsearch aborts unless `-Xms` == `-Xmx`; the web JVM OOM'd
  at `-Xmx256m` during the startup DB migration). Tune the container cap, or
  stop kind, instead.

## 2. Modes (pick ONE per session)

### Mode A — Daily development (default, lightest)
```powershell
cd C:\Users\Home\Desktop\project\PDE
docker compose -f docker-compose.yml -f docker-compose.low-memory.yml up -d --build
# App:  http://localhost:5173  (frontend)  http://localhost:8000/api/health
```
Limits applied: db 512 MiB, backend 256 MiB, frontend 128 MiB. Vite dev server variant:
```powershell
docker compose -f docker-compose.yml -f docker-compose.low-memory.yml -f docker-compose.vite.yml up -d --build
# Frontend Vite container cap: 512 MiB
```

### Mode B — Kubernetes / GitOps practice (kind + ArgoCD)
```powershell
# Stop mode A first, then:
kind get clusters                          # pde-dev already exists?
.\local-k8s\scripts\restart-stack.ps1
```
Local app limits now enforced via helm values-local.yaml:
backend 256Mi limit / postgres 512Mi limit / frontend 128Mi (unchanged).
Postgres tuned: shared_buffers=128MB, work_mem=4MB, maintenance_work_mem=64MB,
max_connections=30, strategy: Recreate.

### Mode C — CI/CD practice (adds Jenkins)
Start jenkins only when needed: `docker start jenkins`
- Jenkins controller cap (applies on next re-create, not `docker start`):
  `docker rm -f jenkins; docker run -d --name jenkins --network kind --group-add 0 -p 8080:8080 -p 50000:50000 -v jenkins_home:/var/jenkins_home -v //var/run/docker.sock://var/run/docker.sock --memory=1g --memory-swap=1g --restart=unless-stopped jenkins-pde:latest`
- Java heap via JAVA_OPTS (recommended): `-e JAVA_OPTS="-Xms256m -Xmx512m"`
- Pipeline now enforces: disableConcurrentBuilds, 45-min timeout, 1 executor recommended,
  backend test container 512 MiB, frontend build container 1 GiB, BuildKit
  max-parallelism=1 via local-k8s/buildkitd-low-memory.toml.
  Apply it (one-time): `docker buildx create --name lowmem --driver docker-container --config local-k8s\buildkitd-low-memory.toml --bootstrap --use` then `docker buildx use lowmem`

### Mode D — Monitoring practice (without heavy CI)
Keep the kind stack; avoid running Jenkins builds at the same time.

### Mode E — Code-quality scan only (SonarQube, optional)

Self-hosted, fully local static analysis (no cloud service). It is **never** run
together with the kind cluster — on a 5.79 GiB Docker VM the numbers do not fit.
`start-sonar.ps1` enforces this by warning and offering to stop kind first.

| Component | Cap |
|---|---|
| `pde-sonar` (sonarqube:community — web + CE + search JVMs) | 3584 MiB |
| `pde-sonar-db` (postgres:16-alpine, shared_buffers=128MB) | 256 MiB |
| scanner container (ephemeral, only while a scan runs) | 512 MiB |
| **Total while scanning** | **~4.3 GiB** |

Because kind is stopped in this mode the budget is comfortable — but only here:

```
kind (2.6) + Jenkins (0.8) + SonarQube (3.5) + db (0.25) + scanner (0.5) = 7.65 GiB  [X] OOM
kind STOPPED           + SonarQube (3.5) + db (0.25) + scanner (0.5) = 4.25 GiB  [OK]
```

```powershell
# 1. Stop the kind stack (2.4-2.8 GiB). start-sonar.ps1 offers to do this for you,
#    but doing it explicitly keeps the order obvious.
powershell -File local-k8s\scripts\stop-stack.ps1

# 2. Start SonarQube. This ALSO raises vm.max_map_count to 524288 inside the
#    Docker Desktop WSL2 VM - a HARD requirement for SonarQube's embedded
#    Elasticsearch. The default is 262144 and the value does NOT persist across a
#    Docker Desktop restart, so it is re-applied on every run.
powershell -File local-k8s\scripts\start-sonar.ps1
# UI: http://localhost:9000     (admin / admin on first login)

# 3. Scan (run from the repo root)
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli

# 4. Tear down (data preserved), then bring the normal stack back
powershell -File local-k8s\scripts\stop-sonar.ps1
powershell -File local-k8s\scripts\restart-stack.ps1
```

**Caveats to remember**

- `vm.max_map_count` is **not persistent**. Every `wsl --shutdown`, Docker
  Desktop restart, or reboot resets it to 262144. If SonarQube fails to start
  after a reboot, that is almost always the cause — just re-run
  `start-sonar.ps1`.
- Never run two SonarQube instances against the same `sonar_pgdata` volume;
  official docs warn this corrupts data with no safeguard.
- SonarSource sizes a small Community Build at **4 GB RAM**. We grant a 3.5 GiB
  cap (measured ~2.4 GiB actually in use) because this repo is small. Expect a
  slow first boot (DB migration + Elasticsearch index build) and a UI that
  pauses during analysis. That is an accepted tradeoff, not a misconfiguration.
- `pde-sonar` is attached to the `kind` Docker **network** (so a Jenkins scanner
  can reach `http://sonarqube:9000`) when that network exists. The network object
  outlives a stopped cluster, so this works with kind down. The manual CLI scan
  above does not even need it (`host.docker.internal`).
- After a scan, `docker stats --no-stream` should show `pde-sonar` under
  3.5 GiB (measured ~2.4 GiB). If
  `docker inspect pde-sonar --format '{{.State.OOMKilled}}'` returns
  `true`, kind was probably still running or `mem_limit` needs revisiting.
- Full runbook, quality-gate setup and troubleshooting: `sonar/SONARQUBE.md`.

## 3. Kubernetes mode rollouts

ArgoCD self-heals from git — apply value changes through the chart, not kubectl:
```powershell
helm upgrade --install pde .\helm\pde -n pde -f .\helm\pde\values-local.yaml
```

## 4. Verification

```powershell
docker stats --no-stream
docker inspect pde-api pde-db --format '{{.Name}} mem={{.HostConfig.Memory}} oom={{.State.OOMKilled}}'
helm template pde .\helm\pde -f .\helm\pde\values-local.yaml   # render-check before applying
```

## 5. Baseline results (this 6 GB machine, 2026-09-17)

| Metric | Result |
|---|---|
| Compose backend health | healthy, 200 on /api/health, 0 restarts, OOMKilled=false |
| Compose postgres health | healthy under 512 MiB cap |
| Compose db+backend combined | ~161 MiB steady |
| kind node with full local stack | 2.4–2.8 GiB |
| Exits-137 evidence | OOMKilled=false on both; treated as inconclusive |
| **SonarQube (Mode E, 2026-09-18)** | **UP and operational** — server `26.9.0.129388`; `pde-sonar` **2.371 GiB / 3.5 GiB** (67.7%), `pde-sonar-db` **125.2 MiB / 256 MiB**; OOMKilled=false on both |
| SonarQube boot time (warm volumes) | `unreachable` → `STARTING` after ~45 s → `UP` ~1 min after `up -d` |

## 6. Guardrails and rollback

- All changes are additive defaults; base docker-compose.yml untouched.
- `!override` tags require Docker Compose v2.24.4+.
- Roll back any file with: `git checkout -- <file>` (new files: just delete them).
- If the backend ever OOMs at 256 MiB, bump only the Compose cap (k8s already 256Mi).
