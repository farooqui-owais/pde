#!/usr/bin/env bash
# =============================================================================
# check-backend-code.sh - "Which code is the running backend pod serving?"
#
# Bash twin of check-backend-code.ps1 (Git Bash / Linux / CI), adapted to the
# FastAPI backend (source lives in /app/app inside the container):
#   1. What image/digest is the pod ACTUALLY running (status.imageID)?
#   2. What does the registry currently serve for the deployment's image tag
#      (and for :latest)?
#   3. Does the image predate the pod (stale pod) - plus an optional per-file
#      source diff of /app/app inside the pod vs the local pde-backend tree.
#
# Works with both deployment styles in this repo:
#   - Helm chart (helm/pde): deployment "pde-backend", image .../pde/backend:<tag>
#   - plain manifests (k8s/04-backend.yaml): deployment "backend", image pde/backend:latest
#
# Usage (from repo root):
#   bash local-k8s/scripts/check-backend-code.sh
#   bash local-k8s/scripts/check-backend-code.sh -d backend -n pde
#   REGISTRY=http://localhost:5000 bash local-k8s/scripts/check-backend-code.sh
#   bash local-k8s/scripts/check-backend-code.sh --local-src pde-backend
# =============================================================================
set -u

NAMESPACE="pde"
DEPLOYMENT="pde-backend"
REGISTRY="${REGISTRY:-http://localhost:5000}"
LOCAL_SRC=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n) NAMESPACE="$2"; shift 2 ;;
        -d) DEPLOYMENT="$2"; shift 2 ;;
        -r) REGISTRY="$2"; shift 2 ;;
        --local-src) LOCAL_SRC="$2"; shift 2 ;;
        *) echo "Unknown arg: $1"; exit 64 ;;
    esac
done

section() { printf '\n=== %s ===\n' "$1"; }

have() { command -v "$1" >/dev/null 2>&1; }
for tool in kubectl curl md5sum awk; do
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
    echo "Try: -d backend   (plain k8s/04-backend.yaml style)"
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
# contains a dot / colon / is "localhost" ("pde/backend:latest" has no host).
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
# 5. Optional: per-file source diff inside the pod vs the local backend tree
# ---------------------------------------------------------------------------
if [[ -n "$LOCAL_SRC" && -f "$LOCAL_SRC/requirements.txt" ]]; then
    section "5) In-pod source fingerprint vs local tree (--local-src)"

    p="${PODS[0]}"

    # Dependency drift first (requirements.txt)
    POD_REQ=$(kubectl exec "$p" -n "$NAMESPACE" -- sh -c "md5sum /app/requirements.txt 2>/dev/null" | awk '{print $1}')
    LOCAL_REQ=$(md5sum "$LOCAL_SRC/requirements.txt" | awk '{print $1}')
    echo "pod   requirements.txt md5 : $POD_REQ"
    echo "local requirements.txt md5 : $LOCAL_REQ"
    if [[ -n "$POD_REQ" && "$POD_REQ" != "$LOCAL_REQ" ]]; then
        echo "[DIFF] installed dependencies may not match the local requirements.txt."
    fi

    # Per-file md5 of every .py under /app/app in the pod
    declare -A POD_MAP=()
    while read -r h rest; do
        [[ -n "$h" ]] || continue
        POD_MAP["/${rest#./}"]="$h"
    done < <(kubectl exec "$p" -n "$NAMESPACE" -- sh -c \
        "cd /app/app && find . -name '*.py' -type f -exec md5sum {} +" 2>/dev/null)

    # Same for the local tree (normalize to an absolute path first)
    LOCAL_SRC="$(cd "$LOCAL_SRC" && pwd)"
    app_root="$LOCAL_SRC/app"
    declare -A LOCAL_MAP=()
    if [[ -d "$app_root" ]]; then
        while IFS= read -r -d '' f; do
            LOCAL_MAP["/${f#"$app_root"/}"]="$(md5sum "$f" | awk '{print $1}')"
        done < <(find "$app_root" -name '*.py' -type f -print0 | sort -z)
    fi

    same=0; DIFFS=(); ONLY_LOCAL=(); ONLY_POD=()
    for k in "${!LOCAL_MAP[@]}"; do
        if [[ -n "${POD_MAP[$k]:-}" ]]; then
            if [[ "${POD_MAP[$k]}" == "${LOCAL_MAP[$k]}" ]]; then same=$((same+1)); else DIFFS+=("$k"); fi
        else
            ONLY_LOCAL+=("$k")
        fi
    done
    for k in "${!POD_MAP[@]}"; do
        [[ -n "${LOCAL_MAP[$k]:-}" ]] || ONLY_POD+=("$k")
    done

    echo "python files - pod: ${#POD_MAP[@]} | local: ${#LOCAL_MAP[@]} | identical: $same"
    if [[ ${#DIFFS[@]} -gt 0 ]]; then
        echo "files that DIFFER (local tree newer/older than the pod):"
        printf '   M %s\n' "${DIFFS[@]}" | head -10
    fi
    if [[ ${#ONLY_LOCAL[@]} -gt 0 ]]; then
        echo "files only in the LOCAL tree (written after the image was built):"
        printf '   + %s\n' "${ONLY_LOCAL[@]}" | head -10
    fi
    if [[ ${#ONLY_POD[@]} -gt 0 ]]; then
        echo "files only in the POD (deleted locally after the image was built):"
        printf '   - %s\n' "${ONLY_POD[@]}" | head -10
    fi
    if [[ ${#DIFFS[@]} -eq 0 && ${#ONLY_LOCAL[@]} -eq 0 && ${#ONLY_POD[@]} -eq 0 && ${#LOCAL_MAP[@]} -gt 0 ]]; then
        echo "[OK] Every .py file in the pod is byte-identical to the local tree."
    fi
    echo "Note: identical source gives identical hashes; line-ending (CRLF) differences will show as DIFF."
fi

echo
echo "Done. Digest equality = pod runs the registry's current code for that tag."

