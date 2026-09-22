# PDE Local K8s Scripts — What, When & Why

A quick guide to the helper scripts in `local-k8s/scripts/`. Think of them as
**Stop → Start → Access** buttons for your local Kubernetes stack.

```
PC shutdown? ──►  stop-stack.ps1           (tuck everything in safely)
PC back on?  ──►  restart-stack.ps1        (wake everything up)
Ready to work?──► start-port-forwards.ps1  (open the doors to the UIs)
restart-all.ps1  (older spare — mostly covered by restart-stack.ps1)
setup-webhooks.ps1 (optional — instant GitOps sync, no ~3 min ArgoCD lag)
Code quality?  ──► start-sonar.ps1        (Mode E — STOP KIND FIRST)
                   stop-sonar.ps1         (keeps data; add -Purge to wipe it)
```

---

## 1. `stop-stack.ps1` — 🛑 Use when: about to shut down your PC

**What it does:** Stops 3 things *gracefully* (like putting a computer to sleep,
not ripping out the battery):

- Jenkins container
- The kind cluster node (gives it 60s to safely flush its internal database /
  etcd — prevents corruption)
- The local image registry

**Why:** You *could* just quit Docker Desktop, but a hard stop risks corrupting
the cluster's internal database (etcd). This script avoids that.
**Nothing is deleted** — all pods, data, and images survive.

**Usage:**
```powershell
powershell -File local-k8s\scripts\stop-stack.ps1
```

---

## 2. `restart-stack.ps1` — ▶️ Use when: PC restarted, or Docker Desktop restarted, and the stack looks dead/broken

This is your **main "wake up" script** and the smartest one. It:

1. Checks Docker is running (yells at you if not)
2. Starts the kind cluster containers (usually they auto-start; this is a
   safety net)
3. **Yells with instructions if the cluster was deleted** (the one
   unrecoverable case)
4. **Repairs kind node IP drift** — the node container's docker IP can change on
   every Docker Desktop restart, and `/etc/kubernetes/kubelet.conf` inside it is
   *never* rewritten by kind. If the address moved, this step re-points kubelet
   at the node's real address and restarts it (otherwise the node sits
   `NotReady` / `NodeStatusUnknown` forever)
5. Starts the registry and re-attaches it to the cluster's network
6. **Starts Jenkins** (Jenkins does NOT auto-start after reboot — only this
   script starts it)
7. Waits for the API server, then points kubectl at the cluster and waits for the
   node to be Ready (kubectl's `memcache.go ... EOF` lines during the first ~30s
   are harmless retry noise)
8. **Finds pods stuck in real error states** (`Error`, `CrashLoopBackOff`,
   `ImagePull*`) and rolling-restarts them. `Unknown` pods are *not* restarted —
   that state only means kubelet could not report while it was disconnected, and
   mass-restarting everything on a 6 GB VM just creates a second pod wave
9. Prints a status summary

**Why:** After a reboot, some things wake up on their own, some don't, and some
wake up broken. This handles all three cases in one command.

**Usage:**
```powershell
powershell -File local-k8s\scripts\restart-stack.ps1
```

---

## 3. `start-port-forwards.ps1` — 🚪 Use when: stack is running, but you can't reach the web UIs

**What it does:** Creates "tunnels" from your browser to services inside the
cluster, so you can open them at `localhost` addresses:

| Service    | URL                          |
|------------|------------------------------|
| ArgoCD     | https://localhost:8081       |
| Grafana    | http://localhost:3000        |
| Prometheus | http://localhost:9090        |

**Why:** Kubernetes services aren't directly reachable from your browser by
default. Port-forwards are the bridge. The app itself (`http://pde.local`)
doesn't need this — it goes through ingress.

**Note:** These tunnels die when the script's processes die (e.g., reboot).
Just rerun the script. It also kills old stale tunnels first so you don't get
"port already in use" errors.

**Usage:**
```powershell
powershell -File local-k8s\scripts\start-port-forwards.ps1
```

**Get the ArgoCD admin password** (printed by the script as a reminder):
```powershell
$b = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b))
```

---

## 4. `restart-all.ps1` — 🗄️ The spare tire (you probably won't need it)

**What it does:** Similar goal to `restart-stack.ps1`, but older/simpler. Its
unique ability: if pieces are **completely missing**, it *installs* them from
scratch (creates the cluster, installs ingress-nginx and ArgoCD).

**When you'd actually use it:** Only after a **fresh setup** (e.g., new PC,
wiped Docker) when the cluster / ArgoCD / ingress don't exist yet. But note —
`restart-stack.ps1` already covers the normal after-reboot case better (it
handles Jenkins and stuck pods; this one doesn't).

**Recommendation:** treat `restart-stack.ps1` as your daily driver.
`restart-all.ps1` is a leftover — you could even delete it later, or keep it
just for fresh installs.

**Usage:**
```powershell
powershell -File local-k8s\scripts\restart-all.ps1
```

---

## 5. `setup-webhooks.ps1` — ⚡ Optional: instant ArgoCD sync via webhook

**What it does:** By default ArgoCD *polls* the repo every ~3 minutes before it
notices Jenkins' tag-bump commit. This script cuts that lag to seconds:

1. Generates a random webhook secret
2. Patches the `argocd-secret` in the cluster with it (`webhook.github.secret`)
3. Prints a ready-to-run `gh api` command that registers the webhook on the
   GitHub repo, pointing at ArgoCD's `/api/webhook` endpoint

**When to use it:** Any time — it's idempotent (re-running just renews the
secret; if you do that, update the GitHub hook too). Not required for the
pipeline to work — the ~3-minute poll is the functional fallback. 

**Important caveat:** GitHub's servers must be able to *reach* the webhook URL.
A localhost kind cluster can't be reached from the internet, so for the hook
to actually fire you need a tunnel (ngrok / smee.io / cloudflared) and should
pass its public URL:

```powershell
ngrok http 8081                                # terminal 1 (keep open)
powershell -File local-k8s\scripts\setup-webhooks.ps1 -ArgocdUrl "https://<your-ngrok-host>"
```

The secret patch itself is harmless and works without any tunnel — only the
GitHub-side hook needs the public URL. ArgoCD will log `invalid payload`
(GitHub gets 401s) if the secret in the cluster doesn't match the one in the
hook config.

**Usage (localhost default — fine for the patch, needs a tunnel for the hook):**
```powershell
powershell -File local-k8s\scripts\setup-webhooks.ps1
```

**Verify it works:** push anything to the `deploy/local` branch; the ArgoCD UI
app history should show "Webhook refreshed pde" within seconds instead of
waiting for the next ~3-minute poll.

---

## 6. `start-sonar.ps1` — 🔍 Use when: you want a code-quality scan (optional)

**What it does:** Brings up the self-hosted SonarQube stack (`pde-sonar` +
`pde-sonar-db`) in its own compose project, and enforces the two prerequisites
that are easy to forget:

1. **Checks whether the kind cluster is running** and offers to stop it — the
   cluster (2.4–2.8 GiB) plus SonarQube (~2.4 GiB, cap 3.5 GiB) do not fit in the 6 GB Docker
   VM. Refuses to continue if you say no.
2. **Raises `vm.max_map_count` to 524288** inside the Docker Desktop WSL2 VM.
   SonarQube's embedded Elasticsearch refuses to bootstrap at the default
   262144 — and Docker Desktop **resets it on every restart**, so this has to
   happen on every run, not once.
3. Starts the stack, attaches `pde-sonar` to the `kind` Docker **network** if
   that network exists (the network outlives a stopped cluster).
4. Polls `http://localhost:9000/api/system/status` until it reports `UP`
   (first boot runs a DB migration + builds the Elasticsearch index: expect
   2–5 minutes on this machine).
5. Prints memory usage, an OOMKilled check, and the first-login steps.

**Why:** SonarQube is **Mode E** — a deliberately separate session, never
concurrent with kind. Doing it by hand means remembering the kernel sysctl,
which is exactly the kind of thing that gets forgotten after a reboot.

**Usage:**
```powershell
powershell -File local-k8s\scripts\start-sonar.ps1
```

Then open http://localhost:9000 (`admin` / `admin`, forces a password change)
and scan from the repo root:
```powershell
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 `
  -e SONAR_TOKEN=<token> -v "${PWD}:/usr/src" sonarsource/sonar-scanner-cli
```

**Not needed for normal development** — skip it unless you actually want the
analysis. Full runbook: `sonar/SONARQUBE.md`.

---

## 7. `stop-sonar.ps1` — 🧹 Use when: finished scanning, want Kubernetes back

**What it does:** Detaches `pde-sonar` from the `kind` network, then brings the
SonarQube compose project down **without `-v`** — so `sonar_pgdata`, the
Elasticsearch data, plugins, logs and your analysis history all survive. Next
`start-sonar.ps1` resumes where you left off (no re-creating the project or
the token).

**`-Purge` = irreversible.** Deletes the volumes too: every project, token,
quality gate and scan history is gone. It asks you to type `delete` to confirm.

**Why:** You almost always want to *pause* SonarQube, not reset it — the
analysis database is the valuable part and rebuilding it costs a slow first
boot every time.

**Usage:**
```powershell
powershell -File local-k8s\scripts\stop-sonar.ps1            # keep data
powershell -File local-k8s\scripts\stop-sonar.ps1 -Purge     # wipe everything
```

Follow it with `restart-stack.ps1` to get the kind cluster back.

---

## Cheat Sheet

| Situation | Run this |
|---|---|
| Shutting down the PC | `stop-stack.ps1` *(optional but safer)* |
| PC back on / stack seems dead | `restart-stack.ps1` |
| "I can't open localhost:8081/3000/9090" | `start-port-forwards.ps1` |
| Fresh machine, nothing installed | `restart-all.ps1` *(or follow local-k8s/README.md)* |
| ArgoCD sync feels slow (~3 min poll) | `setup-webhooks.ps1` *(optional, needs a tunnel)* |
| Want a code-quality scan | `start-sonar.ps1` *(Mode E — **stop kind first**)* |
| Finished scanning, want Kubernetes back | `stop-sonar.ps1` then `restart-stack.ps1` |
| Docker isn't running at all | None — start Docker Desktop first, all scripts fail |

## ⚠️ Three things to remember

1. **Order matters:** Docker Desktop → `restart-stack.ps1` → `start-port-forwards.ps1`
2. **Jenkins is special:** it never auto-starts after a reboot. If Jenkins is
   down, it's because you skipped `restart-stack.ps1`.
3. **`start-sonar.ps1` is the exception to the "kind first" rule:** SonarQube
   needs kind *stopped*. It also re-raises `vm.max_map_count` every run because
   Docker Desktop resets it on restart.
