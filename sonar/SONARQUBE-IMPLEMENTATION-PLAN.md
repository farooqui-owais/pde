# SonarQube Self-Hosted — Implementation Plan (deferred)

**Status:** documented and staged in `sonar/`, **not implemented**. Execute when
the roadmap work is complete and you deliberately want a code-quality phase.

**Verdict:** ✅ implementable on this machine — but only as a dedicated
scanning session (**Mode E**) and only after the kernel prerequisite is
handled on every startup.

**Explicitly out of scope:** SonarCloud / any SaaS. Fully self-hosted only.

---

## 1. Evidence (measured, not assumed)

| Fact | Value | Source |
|---|---|---|
| Host RAM | 8,362,713,088 B ≈ 7.79 GiB | `Win32_ComputerSystem` |
| Docker VM RAM | `memory=6GB swap=1GB` | `%USERPROFILE%\.wslconfig` |
| Docker VM RAM (live) | `MemTotal: 6067840 kB` = **5.79 GiB** | `wsl -d docker-desktop cat /proc/meminfo` |
| **`vm.max_map_count` (live)** | **262144** ❌ (need ≥ 524288) | `wsl -d docker-desktop sysctl vm.max_map_count` |
| `fs.file-max` (live) | 9223372036854775807 ✅ | same |
| kind full stack (measured) | 2.4–2.8 GiB | `MEMORY-MANAGEMENT.md` §1 |
| Jenkins controller cap | 1 GiB (idle ≈ 0.6–0.8) | `MEMORY-MANAGEMENT.md` §2 Mode C |
| SonarQube official sizing | 4 GB for a small Community Build (≤1M LOC) | SonarQube host requirements |
| Official image tag | `sonarqube:community` | Docker Official Images docs |
| Official volumes | `data`, `logs`, `extensions` (+ `temp` in their example compose) | Docker Official Images docs + docker-sonarqube example compose |

Details and re-measurement commands: `sonar/evidence/environment-baseline.md`.

---

## 2. The three real constraints

| # | Constraint | Severity | Mitigation |
|---|---|---|---|
| 1 | `vm.max_map_count` = 262144 < 524288 → embedded Elasticsearch may refuse to bootstrap | 🔴 Hard blocker | `start-sonar.ps1` sets it to 524288 **before** `up`, then re-reads it to verify. Not persistent → re-applied every run. |
| 2 | SonarQube cannot coexist with the kind stack (2.6 + 1.0 + 2.5 + 0.25 + 0.5 ≈ 6.85 GiB > 5.79 GiB) | 🔴 Hard constraint | **Mode E**: kind stopped for scan sessions, documented in `MEMORY-MANAGEMENT.md`. |
| 3 | 3.5 GiB cap vs SonarSource's 4 GB recommendation | 🟡 Acceptable at this repo size | All three JVMs left at the image's **512 m default**. Trimming them was attempted and **failed twice** — see §9. On-demand scanning, single branch. |

### Concurrent-memory scenarios (5.79 GiB usable)

| Scenario | kind | Jenkins | Sonar | sonar-db | Scanner | Total | Verdict |
|---|---|---|---|---|---|---|---|
| Mode B (kind only) | 2.6 | – | – | – | – | **2.6** | ✅ |
| Mode C (kind + Jenkins + workers) | 2.6 | 1.0 | – | – | 1.0 | **4.6** | ✅ (measured OK) |
| Full stack + Sonar (naive) | 2.6 | 0.8 | 3.5 | 0.25 | 0.5 | **7.65** | ❌ OOM |
| **Mode E (recommended)** | stopped | 0 idle | 3.5 cap | 0.25 | 0.5 | **4.25** | ✅ ~1.5 GiB headroom (measured 2.4 used) |
| Mode E + Jenkins running the scan | stopped | 0.8 | 3.5 cap | 0.25 | 0.5 | **5.05** | ⚠️ tight — see §9 note |

---

## 3. Architecture (scanner-as-sibling-container)

```
                    Docker Desktop WSL2 VM (6 GB)
 +----------------------------------------------------------------------+
 |  network: kind (survives a stopped cluster; removed by `kind delete`) |
 |                                                                      |
 |  +------------+  HTTP :9000   +------------------------------+        |
 |  |  Jenkins   |-------------->| pde-sonar (sonarqube:        |        |
 |  |  :8080     |               |  community)  mem_limit 3584m |        |
 |  +-----+------+               +-----------+------------------+        |
 |        | docker.sock                      | JDBC                     |
 |        |                                  v                          |
 |        | docker create/cp/start   +------------------------+          |
 |        +-> sonar-scanner-cli 512m | pde-sonar-db postgres  | 256m     |
 |            (ephemeral; copies     +------------------------+          |
 |             app/ tests/ src/ + coverage.xml)                          |
 +----------------------------------------------------------------------+
   host.docker.internal:9000 (manual CLI scan)  |  http://sonarqube:9000 (Jenkins)
```

**Why scanner-as-sibling-container instead of the Jenkins plugin:** it matches
the repo's existing "disposable capped sibling container + `docker cp`" pattern
(Stages 2/3 of `Jenkinsfile.k8s`), needs **no new plugin, no webhook, no global
tool config**, and `-Dsonar.qualitygate.wait=true` produces the same gate result.
The plugin route stays documented as an optional upgrade (`SONARQUBE.md` §6).

---

## 4. Phases

### Phase S0 — Prerequisites & spike (~30 min)
1. Start Docker Desktop; `wsl -d docker-desktop sysctl -w vm.max_map_count=524288`
   then re-read it to confirm.
2. With **kind stopped**, `docker run --rm -p 9000:9000 sonarqube:community`.
3. Watch `docker stats --no-stream` until `/api/system/status` is `UP`; note peak RSS.
4. Confirm the JVM env vars took effect:
   `docker exec <container> sh -c "ps -ef | grep -o '\-Xmx[0-9a-zA-Z]*'"`.
5. Decide the image tag to pin (`community` vs a verified date tag).
6. **Decision gate:** peak RSS ≤ ~2.8 GiB → proceed. Otherwise tighten further
   or accept and document slower operation.

### Phase S1 — Promote the staged files (nothing existing modified)
Copy from `sonar/` into place per `sonar/README.md` → *How to activate*.
No changes to `docker-compose.yml`, `docker-compose.low-memory.yml`,
`docker-compose.vite.yml`, the Helm chart, or any GitHub workflow.

### Phase S2 — `.gitignore`
Append `sonar/snippets/gitignore-append.txt` (`.scannerwork/`). Without it every
scan leaves an untracked scratch folder at the repo root.

### Phase S3 — Backend coverage plumbing (prerequisite for the coverage metric)
`Jenkinsfile.k8s` Backend Quality Gate currently runs
`pytest tests/ --cov=app --cov-report=term-missing` — no XML, so
`pde-backend/coverage.xml` is never produced locally even though
`.github/workflows/ci.yml` already generates it with
`pytest tests/ --cov=app --cov-report=xml --cov-report=...` and uploads it as
the `backend-coverage` artifact. Add `--cov-report=xml` to the local stage.

### Phase S4 — Jenkins stage (opt-in)
Paste `sonar/snippets/Jenkinsfile.sonar-stage.groovy` and add the `parameters`
block it documents. `SONAR_ENABLED` defaults to `false`, so existing builds are
unaffected and can never fail because SonarQube is down. Create the Jenkins
credential `sonar-token` (Secret text) once.

### Phase S5 — Docs & memory governance
- Paste `sonar/snippets/MEMORY-MANAGEMENT-mode-E.md` into `MEMORY-MANAGEMENT.md`
  (new Mode E + the non-persistent `vm.max_map_count` caveat + planned caps).
- `local-k8s/README.md`: add "Step 11 — SonarQube (optional)".
- `CHEAT-SHEET.md`: add `http://localhost:9000` and the start/stop scripts.

### Phase S6 — Frontend coverage (optional, separate task)
`pde-frontend/package.json` has only `dev`/`build`/`preview` — no test runner,
no `lint` script, and `eslint` is not in `devDependencies` despite
`eslint.config.js` existing. Add `vitest` + `@vitest/coverage-v8`, then
uncomment `sonar.javascript.lcov.reportPaths`. Until then the JS/TS analyzer
still reports bugs, smells, security and duplication — only coverage is absent.

---

## 5. Verification checklist

- [ ] `wsl -d docker-desktop sysctl -n vm.max_map_count` → `524288` before `up`
- [ ] `docker compose -p pde-sonar -f docker-compose.sonar.yml up -d` succeeds
- [ ] `Invoke-RestMethod http://localhost:9000/api/system/status` → `status: UP`
- [ ] `docker logs pde-sonar` shows the server operational; no ES bootstrap errors
- [ ] `docker stats --no-stream` → `pde-sonar` < 3.5 GiB (measured **2.371 GiB**, 67.7%)
- [ ] `docker inspect pde-sonar --format '{{.State.OOMKilled}}'` → `false`
- [ ] Login works; password changed; project `pde` exists; token issued
- [ ] Manual CLI scan indexes both Python and JS/TS files; backend coverage % appears
- [ ] Jenkins build with `SONAR_ENABLED=false` is identical to today
- [ ] Jenkins build with `SONAR_ENABLED=true` reports the gate and fails/passes accordingly
- [ ] `stop-sonar.ps1` then `restart-stack.ps1` restores the kind stack cleanly
- [ ] `git status` clean — no stray `.scannerwork/`

---

## 6. Rollback

```powershell
git checkout -- local-k8s/Jenkinsfile.k8s MEMORY-MANAGEMENT.md .gitignore
git checkout -- local-k8s/README.md CHEAT-SHEET.md
del docker-compose.sonar.yml sonar-project.properties
del local-k8s\scripts\start-sonar.ps1 local-k8s\scripts\stop-sonar.ps1
docker compose -p pde-sonar -f docker-compose.sonar.yml down -v
```

The base `docker-compose.yml`, `docker-compose.low-memory.yml`,
`docker-compose.vite.yml`, `helm/pde/**`, and all `.github/workflows/**`
are never touched, so nothing there needs reverting.

---

## 7. Effort

| Phase | Estimate |
|---|---|
| S0 spike | 0.5 h |
| S1 promote files | 0.25 h |
| S2 gitignore + S3 coverage flag | 0.5 h |
| S4 Jenkins stage + credential setup | 1–1.5 h |
| S5 docs | 1 h |
| Verification | 0.5–1 h |
| **Total** | **~4–5 h** |
| S6 frontend runner (optional) | +1–2 h |

---

## 8. Accepted limitations

1. Community Build is **single-branch** — no PR/branch analysis, no PR decoration.
2. A 3.5 GiB cap against a 4 GB recommendation (measured 2.371 GiB in use); slow first boot.
3. **`vm.max_map_count` is not persistent** across Docker Desktop restarts on WSL2.
4. Frontend reports **no coverage** until Phase S6.
5. kind and SonarQube are mutually exclusive on this 6 GB machine.

---

## 9. Empirical results (executed 2026-09-18 on this machine)

Mode E was implemented and **brought up successfully**. SonarQube
`26.9.0.129388` reported `status: UP` with `SonarQube is operational` in its log.

### Measured, not estimated

| Metric | Value |
|---|---|
| `pde-sonar` memory | **2.371 GiB / 3.5 GiB** (67.7%) |
| `pde-sonar-db` memory | 125.2 MiB / 256 MiB |
| OOMKilled | `false` on both |
| `vm.max_map_count` **inside** the container | **524288** ✅ |
| First `UP` (image already local) | ~1 min — `unreachable` → `STARTING` at ~45 s → `UP` |
| One-time image pull | 200.9 s |
| DNS from a peer container on `kind` | `sonarqube` → `fc00:f853:ccd:e793::3` ✅ |

### Two "obvious" memory optimisations that both FAILED

Both were tried deliberately and both broke the stack. Neither is a memory-limit
problem — which is what makes them easy to misdiagnose: in both cases the
container exited **0** with **`OOMKilled=false`**.

**Failure 1 — `SONAR_SEARCH_JAVAOPTS: "-Xms256m -Xmx512m"`** (search heap
mismatch). Elasticsearch's startup bootstrap check refused to run:

```
bootstrap check failure [1] of [1]: initial heap size [268435456] not equal to
maximum heap size [536870912]
Elasticsearch died while starting up, exit code: 78
```

**Rule: for the search process `-Xms` must equal `-Xmx`.**

**Failure 2 — `SONAR_WEB_JAVAOPTS: "-Xms128m -Xmx256m"`** (web heap halved).
The web JVM OOM'd during the startup DB migration:

```
Caused by: java.lang.OutOfMemoryError: Java heap space
    at org.apache.ibatis...DefaultResultSetHandler...
INFO  web[][o.s.p.ProcessEntryPoint] Hard stopping process
INFO  app[][o.s.a.SchedulerImpl] Process[Web Server] is stopped
INFO  app[][o.s.a.SchedulerImpl] SonarQube is stopped
```

**Rule: the image's 512 m defaults are the floor.** On a 6 GB VM, tune
`mem_limit`, or stop kind — never shrink the heaps.

### Resolution

`mem_limit` raised from 2560m to **3584m** to hold three 512 m-heap JVMs plus
metaspace, native memory, Lucene off-heap and the wrapper process. At 2.371 GiB
measured, that leaves ~1.1 GiB of headroom inside the cap.

### Bonus finding

Recreating the container (`docker compose up -d` after a config change) **drops
the `kind` network attachment**, because that attach is performed by
`start-sonar.ps1` rather than declared in the compose file. `start-sonar.ps1`
re-attaches on every run — so **prefer the script over a bare
`docker compose up -d`**.
