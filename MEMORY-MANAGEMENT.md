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

Rules of thumb for a 6 GB ceiling:
- kind node holds ALL pods (control plane + app + ArgoCD + monitoring). Budget inside it.
- Jenkins controller limit (1 GiB) does NOT cap sibling build/test containers. Cap them
  separately with --memory in the Jenkinsfile (already done).
- Do not run docker compose + kind stack at the same time. Pick one.

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

## 6. Guardrails and rollback

- All changes are additive defaults; base docker-compose.yml untouched.
- `!override` tags require Docker Compose v2.24.4+.
- Roll back any file with: `git checkout -- <file>` (new files: just delete them).
- If the backend ever OOMs at 256 MiB, bump only the Compose cap (k8s already 256Mi).
