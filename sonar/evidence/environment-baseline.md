# Environment Baseline — measured before designing the SonarQube plan

All values below were read from this machine, not assumed. Re-run the commands
to re-validate before implementing.

## This machine (measured)

| Measurement | Value | Command used |
|---|---|---|
| Host physical RAM | 8,362,713,088 B ≈ 7.79 GiB | `Get-CimInstance Win32_ComputerSystem \| Select-Object TotalPhysicalMemory` |
| Docker Desktop memory setting | `memory=6GB swap=1GB` | `Get-Content $env:USERPROFILE\.wslconfig` |
| Docker Desktop CPUs | 8 | `%APPDATA%\Docker\settings-store.json` |
| Docker VM total RAM (live) | `MemTotal: 6067840 kB` = **5.79 GiB** | `wsl -d docker-desktop cat /proc/meminfo` |
| Docker disk image | 64 GiB | `%APPDATA%\Docker\settings-store.json` (`DiskSizeMiB: 65536`) |
| **`vm.max_map_count` (live)** | **262144** [FAIL] | `wsl -d docker-desktop sysctl vm.max_map_count` |
| `fs.file-max` (live) | 9223372036854775807 [OK] | `wsl -d docker-desktop sysctl fs.file-max` |
| WSL distros | `Ubuntu` (Stopped), `docker-desktop` (Running) | `wsl -l -v` |
| kind full stack (measured earlier) | 2.4–2.8 GiB | `docker stats --no-stream` (see MEMORY-MANAGEMENT.md §1) |
| Jenkins controller cap | 1 GiB (idle ≈ 0.6–0.8) | `docker inspect jenkins --format '{{.HostConfig.Memory}}'` |

## SonarQube's own documented requirements (external, quoted)

| Requirement | Official value | Source |
|---|---|---|
| RAM, small-scale Community Build (≤1M LOC) | **4 GB** | SonarQube Server host requirements |
| `vm.max_map_count` | **≥ 524288** | Linux pre-installation requirements |
| `fs.file-max` | ≥ 131072 | same |
| `ulimit -n` (nofile) | 131072 | same |
| `ulimit -u` (nproc) | 8192 | same |

## Official Docker image facts (verified against Docker Official Images docs)

| Fact | Value |
|---|---|
| Community tag | `sonarqube:community` (used verbatim in SonarSource's own Dockerfile example: `FROM sonarqube:community`) |
| Recommended volumes | `/opt/sonarqube/data`, `/opt/sonarqube/logs`, `/opt/sonarqube/extensions` |
| 4th writable path | `/opt/sonarqube/temp` (mounted in SonarSource's own example compose, which also uses `read_only: true` + `tmpfs /tmp`) |
| `/tmp` requirement | "Beginning with SonarQube Server 2026.1, the use of the Java Attach API for ElasticSearch 8.x initialization creates socket files in the hardcoded and unchangeable path `/tmp/.java_pid<PID>`. It is essential to ensure that SonarQube Server processes have both read and write access to the `/tmp/` folder to function correctly." |
| Graceful stop | Official guidance is to raise the stop timeout (`--stop-timeout 3600` in their example) because Docker's default kill-after-10s truncates in-flight tasks |
| Single-writer rule | Only **one** SonarQube instance may connect to one database schema — never run two `pde-sonar` copies against the same `sonar_pgdata` volume |

## Consequences baked into the plan

1. **Mode E only** — kind must be stopped (2.6 + 2.5 + 0.5 > 5.79 GiB).
2. **`vm.max_map_count` must be raised on every start** — hence
   `scripts/start-sonar.ps1` rather than a one-off command.
3. **JVM heaps trimmed below defaults** — web/CE at 256 m instead of 512 m.
   The *search* process is pinned at 512 m for **both** `-Xms` and `-Xmx`:
   Elasticsearch's bootstrap check aborts startup unless initial heap equals
   maximum heap. Observed live on this machine — `-Xms256m -Xmx512m` produced
   `bootstrap check failure ... Elasticsearch died while starting up, exit
   code: 78`, and the container exited `(0)` with no OOM.
4. **`read_only: true` + tmpfs `/tmp`** is mandatory, not optional, because of
   the Java Attach socket path above.
5. A 3.5 GiB cap (measured **2.371 GiB** actually in use) against an official
   4 GB recommendation is acceptable for a repo of this size. Expect a slow
   first boot on the very first run. Documented, not hidden.

## Verified results (2026-09-18, after implementation)

| Metric | Value |
|---|---|
| SonarQube version | `26.9.0.129388` (Community Build) |
| `/api/system/status` | `status: UP`, `SonarQube is operational` in the log |
| `pde-sonar` memory | **2.371 GiB / 3.5 GiB** (67.7%) |
| `pde-sonar-db` memory | 125.2 MiB / 256 MiB |
| OOMKilled | `false` on both containers |
| `vm.max_map_count` **inside** the container | **524288** ✅ (host WSL2 raised by the script) |
| First `UP` (image already local) | ~1 min: `unreachable` → `STARTING` at ~45 s → `UP` |
| One-time image pull | 200.9 s |
| `sonarqube` DNS from a peer on the `kind` net | `fc00:f853:ccd:e793::3` ✅ |

### Two heap reductions tried and REJECTED

Both are recorded here so they are never re-attempted. Neither surfaced as a
cgroup OOM — the container exited `0` with `OOMKilled=false`, which is exactly
why they are easy to misdiagnose:

| Attempt | Failure |
|---|---|
| `SONAR_SEARCH_JAVAOPTS="-Xms256m -Xmx512m"` | `bootstrap check failure [1] of [1]: initial heap size [268435456] not equal to maximum heap size [536870912]` → `Elasticsearch died while starting up, exit code: 78`. **`-Xms` must equal `-Xmx`.** |
| `SONAR_WEB_JAVAOPTS="-Xms128m -Xmx256m"` | `java.lang.OutOfMemoryError: Java heap space` in `org.apache.ibatis...` during the startup DB migration → `Process[Web Server] is stopped` → `SonarQube is stopped`. **512 m is the floor for web/CE.** |

Final settings: all three JVMs at the image default `-Xmx512m`, `mem_limit: 3584m`.

