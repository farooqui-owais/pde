#!/usr/bin/env bash
# =============================================================================
# check-frontend-code.sh - "Which code is the running frontend pod serving?"
#
# Bash twin of check-frontend-code.ps1 (same checks, for Git Bash / Linux / CI):
#   1. What image/digest is the pod ACTUALLY running (status.imageID)?
#   2. What does the registry currently serve for the deployment's image tag
#      (and for :latest)?
#   3. Does the image predate the pod (stale pod) - plus an optional content
#      fingerprint of /usr/share/nginx/html inside the pod.
#
# Usage (from repo root):
#   bash local-k8s/scripts/check-frontend-code.sh
#   bash local-k8s/scripts/check-frontend-code.sh -d frontend -n pde
#   REGISTRY=http://localhost:5000 bash local-k8s/scripts/check-frontend-code.sh
#   bash local-k8s/scripts/check-frontend-code.sh --local-dist pde-frontend/dist
# =============================================================================
set -u

NAMESPACE="pde"
DEPLOYMENT="pde-frontend"
REGISTRY="${REGISTRY:-http://localhost:5000}"
LOCAL_DIST=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n) NAMESPACE="$2"; shift 2 ;;
        -d) DEPLOYMENT="$2"; shift 2 ;;
        -r) REGISTRY="$2"; shift 2 ;;
        --local-dist) LOCAL_DIST="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 64 ;;
    esac
done

section() { printf '\n=== %s ===\n' "$1"; }

have() { command -v "$1" >/dev/null 2>&1; }
for tool in kubectl curl; do
    have "$tool" || { echo "ERROR: '$tool' not found in PATH"; exit 2; }
done

ACCEPT="application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"

registry_digest() { # repo tag -> digest on stdout (empty on failure)
    local d
    d=$(curl -s -I -H "Accept: $ACCEPT" "$REGISTRY/v2/$1/manifests/$2" | tr -d '\r' | awk 'tolower($1)=="docker-content-digest:" {print $2}')
    printf '%s' "$d"
}

# ---------------------------------------------------------------------------
# 1. Deployment and pods
# ---------------------------------------------------------------------------
section "1) Deployment & pods (namespace: $NAMESPACE)"

if ! kubectl get deploy "$DEPLOYMENT" -n "$NAMESPACE" --request-timeout=20s >/dev/null 2>&1; then
    echo "ERROR: cannot read deployment '$DEPLOYMENT' in namespace '$NAMESPACE'."
    echo "Try: -d frontend   (plain k8s/05-frontend.yaml style)"
    exit 2
fi

IMAGE=$(kubectl get deploy "$DEPLOYMENT" -n "$NAMESPACE" \
    -o jsonpath='{.spec.template.spec.containers[0].image}')
REVISION=$(kubectl get deploy "$DEPLOYMENT" -n "$NAMESPACE" \
    -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
echo "Deployment image : $IMAGE"
echo "Rollout revision : $REVISION"

mapfile -t PODS < <(kubectl get pods -n "$NAMESPACE" -o name | sed 's|^pod/||' | grep "^${DEPLOYMENT}-")
if [[ ${#PODS[@]} -eq 0 ]]; then
    echo "No pods found for deployment '$DEPLOYMENT'."
    exit 1
fi
echo "Pods             : ${PODS[*]}"

# ---------------------------------------------------------------------------
# 2. Digest the pods are actually running
# ---------------------------------------------------------------------------
section "2) Running image digest (from pod status)"

declare -A POD_DIGESTS=()
for p in "${PODS[@]}"; do
    image_id=$(kubectl get pod "$p" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].imageID}')
    started=$(kubectl get pod "$p" -n "$NAMESPACE" -o jsonpath='{.status.startTime}')
    digest="${image_id##*@}"   # "...@sha256:abc" -> "sha256:abc"
    POD_DIGESTS["$p"]="$digest"
    echo "$p"
    echo "   started   : $started"
    echo "   imageID   : $digest"
done

# ---------------------------------------------------------------------------
# 3. Registry content for this tag (and :latest)
# ---------------------------------------------------------------------------
section "3) Registry content ($REGISTRY)"

# Split image -> repo + tag. A leading segment is a registry HOST only when it
# contains a dot / colon / is "localhost" ("pde/frontend:latest" has no host).
FIRST="${IMAGE%%/*}"
REPO_TAG="${IMAGE%%@*}"
if [[ "$REPO_TAG" == */* && ( "$FIRST" == *.* || "$FIRST" == *:* || "$FIRST" == "localhost" ) ]]; then
    REPO_TAG="${REPO_TAG#*/}"
fi
if [[ "$REPO_TAG" == *:* ]]; then REPO="${REPO_TAG%:*}"; TAG="${REPO_TAG##*:}"; else REPO="$REPO_TAG"; TAG="latest"; fi

TAG_DIGEST=$(registry_digest "$REPO" "$TAG")
LATEST_DIGEST=$(registry_digest "$REPO" "latest")

CREATED=""; REVISION_LABEL=""
if [[ -n "$TAG_DIGEST" ]]; then
    MANIFEST=$(curl -s -H "Accept: $ACCEPT" "$REGISTRY/v2/$REPO/manifests/$TAG_DIGEST")
    CONFIG_DIGEST=$(printf '%s' "$MANIFEST" | grep -o '"config":[[:space:]]*{[^}]*"digest":[[:space:]]*"[^"]*"' | grep -o 'sha256:[a-f0-9]*')
    if [[ -n "$CONFIG_DIGEST" ]]; then
        CONFIG=$(curl -s "$REGISTRY/v2/$REPO/blobs/$CONFIG_DIGEST")
        CREATED=$(printf '%s' "$CONFIG" | grep -o '"created":"[^"]*"' | head -1 | cut -d'"' -f4)
        REVISION_LABEL=$(printf '%s' "$CONFIG" | grep -o '"org.opencontainers.image.revision":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
fi

echo "Repo/tag           : $REPO:$TAG"
echo "Registry '$TAG'   : $TAG_DIGEST"
[[ -n "$CREATED" ]] && echo "Image built (UTC)  : $CREATED"
[[ -n "$REVISION_LABEL" ]] && echo "Git revision       : $REVISION_LABEL"
echo "Registry 'latest'  : $LATEST_DIGEST"

# ---------------------------------------------------------------------------
# 4. Verdict - new or old code?
# ---------------------------------------------------------------------------
section "4) Verdict"

for p in "${PODS[@]}"; do
    d="${POD_DIGESTS[$p]}"
    if [[ -z "$TAG_DIGEST" ]]; then
        echo "[??] Could not reach tag '$TAG' in registry - check \$REGISTRY value."
        continue
    fi
    if [[ "$d" == "$TAG_DIGEST" ]]; then
        echo "[OK] $p runs EXACTLY what registry tag '$TAG' serves right now."
        if [[ -n "$LATEST_DIGEST" && "$TAG_DIGEST" != "$LATEST_DIGEST" ]]; then
            echo "     NOTE: tag '$TAG' != 'latest' - 'latest' points to a DIFFERENT build ($LATEST_DIGEST)"
        fi
    else
        echo "[STALE] $p differs from registry tag '$TAG' ($TAG_DIGEST)."
        echo "        The pod is running an OLD image. Roll it out with:"
        echo "        kubectl rollout restart deploy/$DEPLOYMENT -n $NAMESPACE"
        echo "        (or bump the image tag via Helm/ArgoCD and sync)"
    fi
done

# Pod started before the image was built -> pod predates the newest build
if [[ -n "$CREATED" ]]; then
    for p in "${PODS[@]}"; do
        started=$(kubectl get pod "$p" -n "$NAMESPACE" -o jsonpath='{.status.startTime}')
        if [[ $(date -u -d "$CREATED" +%s 2>/dev/null || echo 0) -gt $(date -u -d "$started" +%s 2>/dev/null || echo 1) ]]; then
            echo "[NOTE] $p: image was built AFTER this pod started - running code predates the newest build."
        fi
    done
fi

# ---------------------------------------------------------------------------
# 5. Optional: content fingerprint inside the pod vs a local fresh build
# ---------------------------------------------------------------------------
if [[ -n "$LOCAL_DIST" && -f "$LOCAL_DIST/index.html" ]]; then
    section "5) In-pod file fingerprint vs local dist (--local-dist)"

    p="${PODS[0]}"
    POD_MD5=$(kubectl exec "$p" -n "$NAMESPACE" -- sh -c "md5sum /usr/share/nginx/html/index.html 2>/dev/null" | awk '{print $1}')
    LOCAL_MD5=$(md5sum "$LOCAL_DIST/index.html" | awk '{print $1}')

    echo "pod   index.html md5 : $POD_MD5"
    echo "local index.html md5 : $LOCAL_MD5"
    if [[ -n "$POD_MD5" && "$POD_MD5" == "$LOCAL_MD5" ]]; then
        echo "[OK] Pod serves the SAME index.html as the local dist build."
    elif [[ -n "$POD_MD5" ]]; then
        echo "[DIFF] Pod serves a DIFFERENT index.html than the local dist build."
        echo "       Either the local dist is newer, or the pod is running older code."
    fi

    POD_ASSETS=$(kubectl exec "$p" -n "$NAMESPACE" -- sh -c "ls /usr/share/nginx/html/assets 2>/dev/null")
    LOCAL_ASSETS=$(ls "$LOCAL_DIST/assets" 2>/dev/null)
    echo "asset files - pod: $(printf '%s\n' "$POD_ASSETS" | grep -c .) | local dist: $(printf '%s\n' "$LOCAL_ASSETS" | grep -c .)"
    ONLY_LOCAL=$(comm -23 <(printf '%s\n' "$LOCAL_ASSETS" | sort) <(printf '%s\n' "$POD_ASSETS" | sort))
    if [[ -n "$ONLY_LOCAL" ]]; then
        echo "assets present locally but NOT in the pod (newer bundle built but not deployed):"
        printf '%s\n' "$ONLY_LOCAL" | head -10 | sed 's/^/   /'
    fi
fi

echo
echo "Done. Digest equality = pod runs the registry's current code for that tag."

