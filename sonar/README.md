# `sonar/` — SonarQube Self-Hosted Documentation

**IMPLEMENTED (Mode E).** The operational files in this folder have been promoted
into the project. The canonical copies are now:

| Staged (this folder) | **Canonical location** |
|---|---|
| `docker-compose.sonar.yml` | **`docker-compose.sonar.yml`** (repo root) |
| `sonar-project.properties` | **`sonar-project.properties`** (repo root) |
| `scripts/start-sonar.ps1` | **`local-k8s/scripts/start-sonar.ps1`** |
| `scripts/stop-sonar.ps1` | **`local-k8s/scripts/stop-sonar.ps1`** |
| `snippets/gitignore-append.txt` | applied to **`.gitignore`** |
| `snippets/MEMORY-MANAGEMENT-mode-E.md` | applied to **`MEMORY-MANAGEMENT.md`** |
| `snippets/Jenkinsfile.sonar-stage.groovy` | ⏳ **NOT applied** — see below |

> **Edit the canonical copies, not the ones here.** The files in this folder are
> kept as the original staged record; the promoted copies carry small path
> corrections (they print `local-k8s\scripts\...` hints). If you tune the compose
> file or the scripts, do it in the canonical location and delete the duplicate
> here afterwards to avoid drift.

SonarCloud is **out of scope by decision** — this is fully self-hosted, offline
and local-only, consistent with the repo's local-first policy
(`.github/workflows/ci.yml` has no cloud code-quality job and will not get one).

---

## What was implemented (Mode E)

Kind and SonarQube are **never concurrent**. Verified: there is no dependency in
either direction — the Jenkins pipeline never calls `kubectl`/`helm`
(`Jenkinsfile.k8s` states this explicitly), `build-low-memory.sh` only does
`docker build`/`docker push` to `localhost:5000`, and ArgoCD reconciles against
**git**, so a bump commit pushed while the cluster is down is simply synced when
the cluster next starts.

```
kind (2.6) + Jenkins (0.8) + SonarQube (3.5) + db (0.25) + scanner (0.5) = 7.65 GiB  [X] OOM
kind STOPPED           + SonarQube (3.5) + db (0.25) + scanner (0.5) = 4.25 GiB  [OK]
```

```powershell
.\local-k8s\scripts\stop-stack.ps1     # 1. free the memory
.\local-k8s\scripts\start-sonar.ps1    # 2. SonarQube up (also fixes vm.max_map_count)
# 3. scan (see below)
.\local-k8s\scripts\stop-sonar.ps1     # 4. keep data
.\local-k8s\scripts\restart-stack.ps1  # 5. Kubernetes back
```

Files in this folder:

| Path | Purpose |
|---|---|
| `SONARQUBE.md` | Operator runbook: install, first login, token, scan, quality gate, troubleshooting |
| `SONARQUBE-IMPLEMENTATION-PLAN.md` | The phased plan (S0–S6), decisions, verification, rollback, effort |
| `evidence/environment-baseline.md` | Measured machine facts + the exact commands used to measure them |
| `docker-compose.sonar.yml`, `sonar-project.properties`, `scripts/` | original staged copies (canonical versions promoted — table above) |
| `snippets/` | paste-in fragments; only the Jenkinsfile one is still unapplied |

---

## ⏳ Not applied: the Jenkins in-pipeline stage

`snippets/Jenkinsfile.sonar-stage.groovy` was **deliberately not wired into**
`local-k8s/Jenkinsfile.k8s`. Reasons:

1. Jenkins was **stopped** at implementation time, so a pipeline edit could not
   be validated by running a build.
2. Coupling analysis concluded a **separate scan-only Jenkins job** is the better
   design than an in-pipeline stage: with the in-pipeline stage, `Build & Push`
   and the ArgoCD tag bump happen while the cluster is **down**, so
   "build green" ≠ "deployed green" until a later session.

The snippet is kept ready. To adopt it, follow its header instructions (add a
`parameters` block, paste the stage before `Build & Push Images`, create the
Jenkins `sonar-token` credential). The recommended alternative is a time-sliced
pair of jobs — Jenkins persisting across both sessions:

```
Session 1  (Mode C, ~4.6 GB):  kind UP   + Jenkins + pde-local       -> build, push, bump; ArgoCD deploys
Session 2  (Mode E, ~3.3 GB):  kind DOWN + Jenkins + pde-sonar-scan  -> analysis only
```

---

## Scanning manually (works today)

```powershell
# 1. stack up (kind must be stopped — the script enforces it)
.\local-k8s\scripts\start-sonar.ps1

# 2. one-time in the UI at http://localhost:9000 (admin/admin):
#    change password -> Create Project -> Manually -> key: pde
#    -> My Account -> Security -> Generate Token

# 3. scan from the repo root
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli

# 4. review:  http://localhost:9000/dashboard?id=pde
```

Backend coverage appears only once `pde-backend/coverage.xml` exists — run
`pytest tests/ --cov=app --cov-report=xml` in `pde-backend/`, or add
`--cov-report=xml` to the Backend Quality Gate stage (Phase S3 of the plan).

---

## Why Mode E exists

Docker Desktop on this machine has **5.79 GiB usable RAM** (`.wslconfig` →
`memory=6GB`). Measured budgets:

| Component | Budget |
|---|---|
| kind cluster `pde-dev` (full local stack) | 2.4–2.8 GiB |
| Jenkins controller | 1.0 GiB |
| SonarQube server | 3.5 GiB cap (~2.4 GiB measured in use) |
| SonarQube Postgres | 256 MiB |
| sonar-scanner (ephemeral) | 512 MiB |

Two hard constraints shape the whole design:

1. **Memory** — SonarQube never runs alongside kind (see the sum above).
2. **Kernel** — SonarQube's embedded Elasticsearch requires
   `vm.max_map_count >= 524288`, and Docker Desktop's WSL2 VM reports
   **262144**. That value does **not** survive a Docker Desktop restart, so
   `start-sonar.ps1` re-applies it on **every** run, before `up`.

Nothing in this folder is inert-by-accident: the compose file uses the isolated
compose project `pde-sonar`, so it can never collide with the app's `pde_*`
containers or the `pde_pgdata` volume.


<!--SONAR-README-2-->