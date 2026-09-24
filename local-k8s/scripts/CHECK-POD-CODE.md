# How to check whether a running pod has NEW or OLD code (frontend & backend)

Applies to both deployments on any of the repo's Kubernetes setups: local kind
(`localhost:5000`), EKS (`.../pde/backend`, `.../pde/frontend`), or plain
manifests (`k8s/04-backend.yaml`, `k8s/05-frontend.yaml`).

| Component | Deployment (Helm / plain) | In-container layout | Health |
|---|---|---|---|
| frontend | `pde-frontend` / `frontend` | nginx static: `/usr/share/nginx/html` | `GET /nginx-health` (no app info) |
| backend  | `pde-backend` / `backend`   | python source: `/app/app` + `/app/requirements.txt` | `GET /api/health` -> `{"status":"ok","service":"dakhalnama-api"}` (no version info) |

## TL;DR

```bash
# 1. Digest the pod ACTUALLY runs (imageID is the source of truth, not .spec image)
kubectl get pod <pod> -n pde -o jsonpath='{.status.containerStatuses[0].imageID}'

# 2. Digest the registry currently serves for the tag
curl -sI -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
  http://localhost:5000/v2/pde/frontend/manifests/dev | grep Docker-Content-Digest

# 3. Same digests -> pod runs the current code. Different -> pod runs OLD code:
kubectl rollout restart deploy/pde-frontend -n pde
```

## Automated checks (in this repo)

| Script | Use |
|---|---|
| `local-k8s/scripts/check-frontend-code.ps1` | frontend - Windows / PowerShell |
| `local-k8s/scripts/check-frontend-code.sh` | frontend - Git Bash / Linux / CI |
| `local-k8s/scripts/check-backend-code.ps1` | backend - Windows / PowerShell |
| `local-k8s/scripts/check-backend-code.sh` | backend - Git Bash / Linux / CI |

Both print: the deployment image + rollout revision, each pod's started time and
running digest, what the registry serves for the tag and for `latest`, the image
build timestamp (and git revision when present), and a verdict:

- `[OK]`     pod digest == registry digest (pod runs the current code)
- `[STALE]`  pod digest differs (pod runs an OLD image) + the rollout command
- `[NOTE]`   image was built after the pod started (pod predates newest build)

Examples:

```powershell
# from repo root (kind cluster, default namespace pde)
powershell -NoProfile -ExecutionPolicy Bypass -File local-k8s\scripts\check-frontend-code.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File local-k8s\scripts\check-backend-code.ps1

# plain-manifest deployments + content diff against the local tree
powershell ... check-frontend-code.ps1 -Deployment frontend -LocalDist .\pde-frontend\dist
powershell ... check-backend-code.ps1 -Deployment backend -LocalSrc .\pde-backend
```

```bash
# Git Bash / Linux (or inside the kind node with -r http://kind-registry:5000)
bash local-k8s/scripts/check-frontend-code.sh
bash local-k8s/scripts/check-backend-code.sh
bash local-k8s/scripts/check-frontend-code.sh -d frontend --local-dist pde-frontend/dist
bash local-k8s/scripts/check-backend-code.sh -d backend --local-src pde-backend
```

## Manual checks

```bash
POD=$(kubectl get pods -n pde -o name | grep pde-frontend | cut -d/ -f2)

# What image is the pod actually running (digest = exact build identity)
kubectl get pod $POD -n pde -o jsonpath='{.status.containerStatuses[0].imageID}'

# Image creation timestamp (helps spot "built before my change" images)
kubectl get pod $POD -n pde -o jsonpath='{.status.containerStatuses[0].image}{" "}{.status.containerStatuses[0].imageID}'

# What the files inside the pod look like
#   frontend: nginx serves /usr/share/nginx/html
kubectl exec $POD -n pde -- ls -la /usr/share/nginx/html/assets
kubectl exec $POD -n pde -- md5sum /usr/share/nginx/html/index.html
#   backend: python source lives in /app/app
kubectl exec $POD -n pde -- sh -c "cd /app/app && find . -name '*.py' -exec md5sum {} +"

# A marker from your newest source (any recently-added string/endpoint)
kubectl exec $POD -n pde -- grep -rl "YourNewFeature" /usr/share/nginx/html/assets | head
kubectl exec $POD -n pde -- grep -rn "YourNewEndpoint" /app/app/routers | head

# Deployment rollout revision (increments on every image/template change)
kubectl get deploy pde-frontend -n pde -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}'
```

Caveat: `index.html`/asset hashes can differ between builds even with identical
source (timestamps, module ids) - use them to spot a difference, not to prove
equivalence. Digest equality is the reliable check.

## If the pod is running OLD code

```bash
# The tag (e.g. dev/latest) still resolves to the OLD image if the registry
# was updated but the pod was never restarted - or the image was never pushed.
kubectl rollout restart deploy/pde-frontend -n pde
kubectl rollout restart deploy/pde-backend -n pde
kubectl rollout status deploy/pde-backend -n pde

# kind/local: rebuild + push first (tag defaults to the git short sha)
bash local-k8s/scripts/build-and-push-local.sh
# then point helm/pde/values-local.yaml image tags at the new tag (ArgoCD syncs)
# or: helm upgrade --install pde ./helm/pde -n pde -f helm/pde/values-local.yaml \
#       --set frontend.image.tag=<new-tag> --set backend.image.tag=<new-tag>
```

## Local quick reference (this cluster)

```bash
# registry tags available
curl -s http://localhost:5000/v2/pde/frontend/tags/list
curl -s http://localhost:5000/v2/pde/backend/tags/list

# tags currently in the registry with digests
for r in frontend backend; do
  for t in dev latest; do
    echo -n "pde/$r:$t -> "
    curl -sI -H 'Accept: application/vnd.docker.distribution.manifest.v2+json' \
      http://localhost:5000/v2/pde/$r/manifests/$t | grep -i docker-content-digest
  done
done
```

Last verified on the local kind cluster (`kind-pde-dev` context):
- frontend pod `pde-frontend-6cbf74c477-4r99z` runs digest `sha256:dc75b99a...`,
  identical to registry tags `dev` and `latest` (built `2026-09-16T04:20:09Z`).
- backend pod `pde-backend-6b4f4cf7fd-fvwns` runs digest `sha256:cdce2d3b...`
  (tag `dev`, built `2026-09-15T01:57:44Z`); registry tags `8-8b523f7` (built
  `2026-09-22T10:16:33Z` from HEAD) and the local tree are NEWER - 4 files
  differ (`main.py`, `models.py`, `schemas.py`, `routers/entry_details.py`),
  so to ship HEAD's backend code: `build-and-push-local.sh <tag>` + Helm
  upgrade with that tag.

