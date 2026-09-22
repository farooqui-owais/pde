# SonarQube — Local Self-Hosted Runbook

Static analysis (bugs, code smells, security issues/hotspots, duplication,
coverage) for the PDE monorepo, running entirely on this machine.
**No cloud service is involved** — this is deliberate and permanent.

> **Not active yet.** See `SONARQUBE-IMPLEMENTATION-PLAN.md` and the activation
> steps in `README.md` in this folder. Commands below use the promoted paths
> (`local-k8s/scripts/...`); while staged, substitute `sonar/scripts/...`.

---

## 1. What it analyzes

| Side | Path | Languages |
|---|---|---|
| Backend | `pde-backend/app`, `pde-backend/tests` | Python 3.11 |
| Frontend | `pde-frontend/src` | JavaScript / JSX / CSS |
| Coverage | `pde-backend/coverage.xml` | from `pytest --cov-report=xml` |
| Frontend coverage | *(none yet)* | no test runner exists — metric absent, not an error |

Both sides are one SonarQube project with key **`pde`**.

---

## 2. Daily workflow

```powershell
cd C:\Users\Home\Desktop\project\PDE

# 1. Free the memory (SonarQube does not fit with kind on a 6 GB VM)
powershell -File local-k8s\scripts\stop-stack.ps1

# 2. Start SonarQube (also fixes vm.max_map_count)
powershell -File local-k8s\scripts\start-sonar.ps1

# 3. Scan
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli

# 4. Review
#    http://localhost:9000/dashboard?id=pde

# 5. Stop, then restore the normal stack
powershell -File local-k8s\scripts\stop-sonar.ps1
powershell -File local-k8s\scripts\restart-stack.ps1
```

### Via Jenkins instead (opt-in)

Build the `pde-local` job with the **`SONAR_ENABLED`** parameter = true.
The scanner runs in a 512 MiB sibling container on the `kind` network and
blocks on `-Dsonar.qualitygate.wait=true`, so the build result reflects the
quality gate. With the default `false`, the pipeline is byte-for-byte the
behaviour you have today.

---

## 3. First-time setup (once)

1. **Login** — `http://localhost:9000`, `admin` / `admin`. SonarQube forces a
   password change before anything else works.
2. **Create the project** — *Projects → Create Project → Manually*.
   Project key must be exactly **`pde`** (it must match
   `sonar.projectKey` in `sonar-project.properties`; a mismatch is the #1 cause
   of "Project not found").
3. **Generate a token** — *My Account → Security → Generate Tokens*.
   Name it `local-jenkins`, type *User Token*. **Copy it now** — it is shown
   only once.
4. **Store the token in Jenkins** — *Manage Jenkins → Credentials → System →
   Add Credentials → Secret text*, ID **`sonar-token`**. The Jenkinsfile reads
   it via `withCredentials`, so it never appears in the file or the logs.
5. **Quality gate** — the built-in *Sonar way* gate is fine to start. Its
   "Coverage on New Code" condition will fail while frontend coverage is
   absent; either set the project's *New Code* definition to
   *Previous version* / *Number of days*, or relax the coverage condition on
   the project's gate until Phase S6 adds a frontend test runner.

---

## 4. Commands reference

```powershell
# status (host side)
Invoke-RestMethod http://localhost:9000/api/system/status

# logs
docker logs --tail 200 pde-sonar
docker logs --tail 100 pde-sonar-db

# memory / OOM
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
docker inspect pde-sonar --format '{{.State.OOMKilled}}'

# kernel prerequisite (must be >= 524288 before startup)
wsl -d docker-desktop sysctl -n vm.max_map_count
wsl -d docker-desktop sysctl -w vm.max_map_count=524288

# JVM flags actually in effect
docker exec pde-sonar sh -c "ps -ef | grep -o '\-Xmx[0-9a-zA-Z]*'"

# list projects via API
Invoke-RestMethod -Uri "http://localhost:9000/api/projects/search" -Headers @{ Authorization = "Bearer <token>" }

# wipe everything (irreversible: projects, tokens, history)
powershell -File local-k8s\scripts\stop-sonar.ps1 -Purge
```

---

## 5. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `pde-sonar` starts then dies; logs mention `max virtual memory areas vm.max_map_count [262144] is too low` | `vm.max_map_count` reset to 262144 after a Docker Desktop restart / reboot | `wsl -d docker-desktop sysctl -w vm.max_map_count=524288`, then re-run `start-sonar.ps1`. Persistent fix: re-run it after every `wsl --shutdown`. |
| `pde-sonar` starts then exits within seconds; log shows `bootstrap check failure [1] of [1]: initial heap size [...] not equal to maximum heap size [...]` then `Elasticsearch died while starting up, exit code: 78`. Container state is `Exited (0)` — **not** OOMKilled | `SONAR_SEARCH_JAVAOPTS` has `-Xms` ≠ `-Xmx`. Elasticsearch **requires them to be equal**; this is an Elasticsearch bootstrap check, unrelated to `vm.max_map_count` | Set `SONAR_SEARCH_JAVAOPTS: "-Xms512m -Xmx512m"` in `docker-compose.sonar.yml`, then recreate: `docker compose -p pde-sonar -f docker-compose.sonar.yml up -d`. Do not lower `-Xmx` below 512m (SonarQube's default). Verified failure and fix on this machine |
| `pde-sonar` reaches `STARTING` in the status API, then dies ~1 min later; log shows `java.lang.OutOfMemoryError: Java heap space` during the startup DB migration followed by `Process[Web Server] is stopped`. `docker inspect` reports `Exited (0)` and `OOMKilled=false` | `SONAR_WEB_JAVAOPTS` (or `SONAR_CE_JAVAOPTS`) was trimmed below the 512m default — the DB migration needs the full default heap. Because the container exits `0` with no cgroup OOM this looks like a silent death, and it is easy to misread as a memory-limit problem | Restore `-Xmx512m` on `SONAR_WEB_JAVAOPTS` and `SONAR_CE_JAVAOPTS` and raise `mem_limit` to `3584m`, then recreate: `docker compose -p pde-sonar -f docker-compose.sonar.yml up -d`. Verified failure and fix on this machine |
| `docker inspect pde-sonar --format '{{.State.OOMKilled}}'` → `true`, or the whole machine thrashes | kind cluster still running (~2.6 GiB) alongside SonarQube (~3.5 GiB) | Stop kind (`stop-stack.ps1`). This is Mode E — they never coexist. |
| `Unauthorized` / `401` from the scanner | Token wrong, revoked, or passed as the wrong type | Regenerate in *My Account → Security*; re-store as Secret text `sonar-token`; verify with the `api/projects/search` call above. |
| `Project not found` / analysis lands on an unexpected project | `sonar.projectKey` ≠ the key in the UI | Key must be `pde`. Fix in `sonar-project.properties` or in the UI. |
| `You're not authorized to run analysis` / `Insufficient privileges` | Token belongs to a user without *Execute Analysis* on the project | Use a User Token from an admin account, or grant *Execute Analysis* to the project's group. |
| Backend coverage shows `-` or `0%` | `pde-backend/coverage.xml` absent, or the path does not resolve from the scanner base dir | Run `pytest tests/ --cov=app --cov-report=xml` in `pde-backend/` (Phase S3 adds this to the Jenkinsfile). Confirm `sonar.python.coverage.reportPaths=pde-backend/coverage.xml` and that you scanned from the repo root. |
| `Not enough memory` / analysis hangs in the compute engine | Heap too tight for the file count — or heaps were trimmed below the defaults | Keep all three JVMs at the 512m default (`-Xmx512m`) and raise `mem_limit` instead. Never trim `SONAR_SEARCH_JAVAOPTS` (`-Xms` must equal `-Xmx`). |
| `Node with id ... is unhealthy` / ES yellow-red | Not enough memory for the search process on this VM | Ensure nothing else heavy runs; check `docker stats`; raise `mem_limit` only if the host has headroom. |
| Container exits `137` | cgroup OOM kill | Same as the OOM row — kind must be stopped; verify caps. |
| Scan reports `0 files indexed` | Source paths wrong, or exclusions too broad | Verify `sonar.sources=pde-backend/app,pde-frontend/src`. Remember `**.env.*`, `.kilo/**`, `pde-antigravity-documentation/**` and `sonar/**` are excluded by design. |
| Duplication % looks artificially huge | Locale/i18n JSON counted | Already mitigated via `sonar.cpd.exclusions` — extend that list rather than switching duplication off. |
| Stop hangs or tasks are lost on shutdown | Docker's 10 s default stop timeout truncates the compute engine | `stop_grace_period: 120s` is already set; raise it if you stop mid-analysis. |
| `sonarqube` stops resolving by hostname after you changed the config | A bare `docker compose -p pde-sonar ... up -d` **recreated** `pde-sonar` and dropped its `kind` network attachment (the attach is done by the script, not declared in the compose file) | Re-run `local-k8s\scripts\start-sonar.ps1` (it re-attaches every run), or manually: `docker network connect kind pde-sonar` |

---

## 6. Optional upgrades (documented, not implemented)

| Upgrade | What it adds | Cost |
|---|---|---|
| Native Jenkins SonarQube plugin | Sonar panel in the build UI, `waitForQualityGate()` | +1 plugin in `local-k8s/jenkins/plugins.txt`, a webhook to `http://jenkins:8080/sonarqube-webhook/`, more memory in the 1 GiB Jenkins container. The `-Dsonar.qualitygate.wait=true` approach already gives the same gate verdict without any of this. |
| Pinned date tag for the server image | Fully repeatable server version | Pin after verifying the `community` tag you tested works. |
| Frontend test runner (vitest + `@vitest/coverage-v8`) | Frontend coverage metric; also fixes the currently ineffective `npm run lint \|\| true` in the Jenkinsfile (eslint is not even in `devDependencies` despite `eslint.config.js` existing) | A separate task — tracked as Phase S6. |
| PR / branch analysis | Per-branch analysis + PR decoration | ❌ Not available — Community Build is single-branch. Requires commercial editions, so **out of scope** here. |

---

## 7. Scope boundaries (accept these up front)

1. **Single-branch analysis only.** Community Build has no PR analysis or
   PR decoration. Local scans analyze one branch at a time.
2. **A 3.5 GiB cap against an official 4 GB recommendation.** ~2.4 GiB is what it
   actually uses; slow first boot is expected.
3. **`vm.max_map_count` is not persistent** on WSL2 — the helper script exists
   for that reason.
4. **kind and SonarQube never run together** on this 6 GB machine.
5. **No Sonar step in GitHub Actions CI** — by design; scanning is local
   (Jenkins with `SONAR_ENABLED=true`, or the CLI).
