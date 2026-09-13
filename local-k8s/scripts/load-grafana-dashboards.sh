#!/usr/bin/env bash
# =============================================================================
# Loads monitoring/grafana-dashboards/*.json as a ConfigMap labeled
# grafana_dashboard=1 in the monitoring namespace. The kube-prometheus-stack
# Grafana sidecar (enabled in prometheus-values-local.yaml under
# grafana.sidecar.dashboards) watches for exactly that label + namespace and
# auto-imports any JSON it finds — no manual "Import" click needed in the UI.
#
# Run after `helm install monitoring ...` has created the monitoring namespace.
# Re-run any time you edit a dashboard JSON; the sidecar picks up the update.
# =============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD_DIR="${ROOT_DIR}/monitoring/grafana-dashboards"

kubectl create configmap pde-grafana-dashboards \
  -n monitoring \
  --from-file="${DASHBOARD_DIR}" \
  --dry-run=client -o yaml \
  | kubectl label -f - --local -o yaml grafana_dashboard=1 \
  | kubectl apply -f -

echo "Loaded dashboards from ${DASHBOARD_DIR} into monitoring/pde-grafana-dashboards"
echo "Grafana's sidecar polls periodically — give it ~30-60s, then check the 'PDE' folder."
