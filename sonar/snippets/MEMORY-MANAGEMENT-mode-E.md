### Mode E — Code-quality scan only (SonarQube, optional)

SonarQube is self-hosted and local (no cloud). It is **never** run together
with the kind cluster: on a 5.79 GiB Docker VM the numbers do not fit.

| Component | Cap |
|---|---|
| `pde-sonar` (sonarqube:community, web + CE + search JVMs) | 3584 MiB |
| `pde-sonar-db` (postgres:16-alpine, shared_buffers=128MB) | 256 MiB |
| scanner container (ephemeral, during a scan only) | 512 MiB |
| **Total while scanning** | **~4.3 GiB** |

Because kind is stopped in this mode, the budget is comfortable — but only in
this mode:

```
kind (2.6) + Jenkins (0.8) + SonarQube (3.5) + db (0.25) + scanner (0.5) = 7.65 GiB  [X] OOM
kind STOPPED           + SonarQube (3.5) + db (0.25) + scanner (0.5) = 4.25 GiB  [OK]
```

```powershell
# 1. Stop the kind stack (2.4-2.8 GiB) - start-sonar.ps1 offers to do this
powershell -File local-k8s\scripts\stop-stack.ps1

# 2. Start SonarQube. This ALSO raises vm.max_map_count to 524288 inside the
#    Docker Desktop WSL2 VM - a HARD requirement for SonarQube's embedded
#    Elasticsearch. The default is 262144 and the value does NOT persist
#    across a Docker Desktop restart, so it is re-applied on every run.
powershell -File local-k8s\scripts\start-sonar.ps1
# UI: http://localhost:9000     (admin / admin on first login)

# 3. Scan (run from the repo root). Jenkins can also do this: build with
#    SONAR_ENABLED=true.
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli

# 4. Tear down (data preserved), then bring the normal stack back
powershell -File local-k8s\scripts\stop-sonar.ps1
powershell -File local-k8s\scripts\restart-stack.ps1
```

**Caveats to remember**

- `vm.max_map_count` is **not persistent**. Every `wsl --shutdown`, Docker
  Desktop restart, or reboot resets it to 262144. If SonarQube fails to start
  after a reboot, that is almost always the cause — re-run `start-sonar.ps1`.
- Never run two SonarQube instances against the same `sonar_pgdata` volume;
  official docs warn this corrupts data with no safeguard.
- SonarSource sizes a small Community Build at **4 GB RAM**. We grant a 3.5 GiB
  cap (~2.4 GiB measured in use) because this repo is small. Expect a slow first
  boot (DB migration + Elasticsearch index build) on the very first run. That is
  an accepted tradeoff, not a misconfiguration.
- After a scan, `docker stats --no-stream` should show `pde-sonar` under
  3.5 GiB. If `docker inspect pde-sonar --format '{{.State.OOMKilled}}'`
  returns `true`, kind is running or `mem_limit` needs revisiting.
- Do **not** shrink the JVM heaps to save memory — both reductions were tried on
  this machine and both failed. The image's 512m defaults are the floor.
