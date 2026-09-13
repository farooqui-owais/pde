#!/usr/bin/env bash
# =============================================================================
# Creates a local (no-cloud) Docker registry container and wires it into the
# kind network so cluster nodes can pull from it as "localhost:5000".
#
# Based on the pattern documented at kind.sigs.k8s.io/docs/user/local-registry
# — I'd recommend a quick diff against that page if `kind create cluster`
# or Docker networking behaves differently on your machine/OS than expected,
# since exact flag names have shifted across kind releases in the past.
#
# Run this AFTER `kind create cluster --config kind-config.yaml`.
# =============================================================================
set -euo pipefail

REGISTRY_NAME="kind-registry"
REGISTRY_PORT="5000"
CLUSTER_NAME="pde-dev"

# 1. Create the registry container if it doesn't already exist.
if [ "$(docker inspect -f '{{.State.Running}}' "${REGISTRY_NAME}" 2>/dev/null || true)" != 'true' ]; then
  docker run -d --restart=always -p "127.0.0.1:${REGISTRY_PORT}:5000" \
    --network bridge --name "${REGISTRY_NAME}" \
    registry:2
  echo "Created ${REGISTRY_NAME} on localhost:${REGISTRY_PORT}"
else
  echo "${REGISTRY_NAME} already running — skipping create"
fi

# 2. Connect the registry container to the kind network so nodes can resolve
#    it by name ("kind-registry"), matching kind-config.yaml's containerd
#    mirror endpoint (http://kind-registry:5000).
if ! docker network inspect kind >/dev/null 2>&1; then
  echo "ERROR: docker network 'kind' not found — create the kind cluster first:"
  echo "  kind create cluster --name ${CLUSTER_NAME} --config kind-config.yaml"
  exit 1
fi

if [ "$(docker inspect -f "{{json .NetworkSettings.Networks.kind}}" "${REGISTRY_NAME}")" = 'null' ]; then
  docker network connect kind "${REGISTRY_NAME}"
  echo "Connected ${REGISTRY_NAME} to the kind network"
else
  echo "${REGISTRY_NAME} already on the kind network"
fi

# 3. Document the registry in the cluster (informational ConfigMap — kind's
#    own docs use this so other tooling/humans can discover it via kubectl).
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${REGISTRY_PORT}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF

echo "Local registry ready. Push images to localhost:${REGISTRY_PORT}/pde/<service>:<tag>"
