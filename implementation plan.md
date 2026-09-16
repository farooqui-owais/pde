# CI/CD Pipeline Fix — Implementation Plan

## Status: ✅ COMPLETE — all fixes applied and verified in code

Scope: **PDE local CI/CD stack** — Jenkins → ArgoCD → kind (Kubernetes) + Prometheus/Grafana.
Primary failure surface: the Jenkins build pipeline (Jenkins image + Jenkinsfile logic).
Secondary: scripts, docs, and security hygiene.

> Companion doc: [walkthrough.md](walkthrough.md) — rebuild/run instructions and verification checklist.

---

## Issue → Root Cause → Fix → Status

### 🔴 CRITICAL — Jenkins Build Failures

| # | Issue | Root Cause | Fix Applied | Status |
|---|-------|-----------|-------------|--------|
| 1 | Jenkins Dockerfile conflicting Docker packages | `docker.io` AND `docker-cli` both listed — on Debian both provide the Docker CLI and conflict | Keep only `docker.io` (Debian package); add `curl`; document why in a comment | ✅ `local-k8s/jenkins/Dockerfile` |
| 2 | Backend Quality Gate missing env vars | `_init_db()` runs at import time in `pde-backend/app/main.py:148`; without `DATABASE_URL` set before import, pytest waits up to 15s retrying a Postgres connection, then fails | Pass `-e DATABASE_URL="sqlite:///:memory:"`, `-e DEBUG="True"`, `-e SECRET_KEY=...` as `docker run` flags so they exist before `app.main` imports | ✅ `local-k8s/Jenkinsfile.k8s` (Stage 2) |
| 3 | `sed` tag replacement too broad | `s/^\(\s*tag:\).*/.../` matches *any* `tag:` line in `values-local.yaml` | Two-pass context-anchored sed: match the line immediately *after* `repository: .*/pde/backend` (and `/frontend`) so only the correct image tag is replaced | ✅ `local-k8s/Jenkinsfile.k8s` (Stage 5) |
| 4 | `git push` fails (403 / credential prompt) | `withCredentials` exposed `GIT_USER`/`GIT_TOKEN` but the push URL never used them — non-interactive shells can't prompt | Build an authenticated URL at runtime: `https://${GIT_USER}:${GIT_TOKEN}@github.com/...` inside `withCredentials`; Jenkins masks the token in logs | ✅ `local-k8s/Jenkinsfile.k8s` (Stage 5) |
| 5 | `cleanWs()` destroys failure evidence | `post { always { cleanWs() } }` wipes the workspace even on failed builds | `cleanWs()` moved to `post { success }`; `failure` block echoes a diagnostic banner and preserves the workspace | ✅ `local-k8s/Jenkinsfile.k8s` (post block) |

### 🟡 MAJOR — Image / Scripts / Plugins

| # | Issue | Root Cause | Fix Applied | Status |
|---|-------|-----------|-------------|--------|
| 6 | Docs use stock `jenkins/jenkins:lts` + "install Docker manually" | Half the docs referenced the custom image, half the stock image — contradictions caused broken setups | All docs standardized on the custom **`jenkins-pde:latest`** image (Docker, Python 3.11, Node/npm preinstalled) | ✅ README.md §9, PHASE8, RECOVERY-CHECKPOINT |
| 7 | Docker socket mount inconsistency on Windows | Single-slash form breaks under Git Bash MSYS path translation | Standardized: `//var/run/docker.sock://var/run/docker.sock` (Windows) + `--group-add 0` (Docker Desktop socket is root:root) | ✅ Dockerfile comments + all docs |
| 8 | `restart-stack.ps1` hardcodes IP `172.18.0.2` | Docker Desktop assigns kind-node IPs dynamically; hardcoded disconnect/reconnect logic could break the cluster | IP check/reconnect logic removed entirely; stale kubeconfig → `kind export kubeconfig --name pde-dev` | ✅ `local-k8s/scripts/restart-stack.ps1` |
| 9 | Missing Jenkins plugins | Only 5 plugins; missing stage-view UI, docker-commons, etc. | 9 plugins: + `pipeline-stage-view`, `plain-credentials`, `docker-commons`, `github` | ✅ `local-k8s/jenkins/plugins.txt` |

### 🟢 MINOR — Security Hygiene

| # | Issue | Root Cause | Fix Applied | Status |
|---|-------|-----------|-------------|--------|
| 10 | ArgoCD admin password hardcoded in a committed script | Plaintext secret in `start-port-forwards.ps1` | Removed; script now prints the dynamic `kubectl -n argocd get secret argocd-initial-admin-secret ...` retrieval command | ✅ `local-k8s/scripts/start-port-forwards.ps1` |

---

## Files Changed (complete)

| File | Type | Change |
|---|---|---|
| `local-k8s/jenkins/Dockerfile` | 🔴 Critical | `docker-cli` removed; `curl` added; group-0 socket access; self-documenting header |
| `local-k8s/jenkins/plugins.txt` | 🟡 Major | 5 → 9 plugins |
| `local-k8s/Jenkinsfile.k8s` | 🔴 Critical ×4 | env-var injection, context-aware sed, authenticated git push, cleanWs-on-success only |
| `local-k8s/scripts/restart-stack.ps1` | 🟡 Major | Hardcoded IP removed |
| `local-k8s/scripts/start-port-forwards.ps1` | 🟢 Minor | Hardcoded password removed |
| `local-k8s/README.md` | 📄 Doc | Rewritten — consistent `jenkins-pde` image, Windows notes |
| `PHASE8-JENKINS-MANUAL-SETUP.md` | 📄 Doc | Rewritten — Step 0 image verify, troubleshooting table |
| `local-k8s/scripts/RECOVERY-CHECKPOINT.md` | 📄 Doc | Rewritten — Phase 8 consistency, workarounds removed |

---

## Verification Plan

1. **Rebuild image**: `docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .` — succeeds and prints Python 3.11 / Node / Docker versions.
2. **Container start**: recreate `jenkins` (see walkthrough.md § How to Apply); UI at `http://localhost:8080`.
3. **Pipeline run**: trigger `pde-local` — all 5 stages pass (quality gates → build/push → tag bump → git push).
4. **ArgoCD sync**: tag bump commit triggers sync within ~3 min; `kubectl get pods -n pde` shows new image tags.
5. **Monitoring**: Prometheus target `pde-backend` UP; Grafana dashboards live.

Full checklist: [walkthrough.md](walkthrough.md) — Verification Checklist.

---

## Design Decisions (formerly "Open Questions" — resolved)

| Q | Decision |
|---|----------|
| Pipeline runs on the Jenkins controller (`agent any`) | **Accepted for local dev.** Docker-in-Docker uses the *mounted host socket* (not a nested daemon), which is standard local practice. Revisit for multi-agent production. |
| `npm run lint \|\| true` in Frontend Quality Gate | **Kept as a warning**, documented inline in the Jenkinsfile: remove `\|\| true` for a production pipeline. |
| Backend Quality Gate: `docker run python:3.11-slim` vs agent venv | **Kept `docker run python:3.11-slim`** — guarantees version parity with the prod base image; the host Python venv remains only as a fallback. |
| `pip-audit` in `requirements-dev.txt` but unused in pipeline | **Accepted as dead weight** — requires PyPI network access; add a dedicated security-scan stage later if wanted. |

---

## Known Follow-ups (not blocking the build)

- `[skip ci]` on the bump commit prevents webhook re-triggers — confirm ArgoCD's repo polling (~3 min) picks it up; a webhook is optional.
- Frontend lint is advisory; promote to gating when ready.
- Consider a `pip-audit` security-scan stage in the pipeline.
