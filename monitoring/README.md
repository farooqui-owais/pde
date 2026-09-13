# PDE Monitoring Stack

This directory contains configurations for monitoring the PDE application on Amazon EKS using the `kube-prometheus-stack` Helm chart.

## Prerequisites
- EKS Cluster running
- `kubectl` configured with cluster access
- Helm 3 installed

## Installation

1. Add Prometheus Helm repository:
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

2. Install the monitoring stack:
```bash
helm install monitoring prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace \
  -f monitoring/prometheus-values.yaml
```

3. Apply custom alerting rules:
```bash
kubectl apply -f monitoring/alerting-rules.yaml
```

## Grafana Dashboards

Dashboards are stored as JSON files in `grafana-dashboards/`. To import them:
1. Log in to Grafana.
2. Click "+" > "Import".
3. Upload the `.json` files.

## Accessing Grafana

Use port-forwarding to access Grafana locally:
```bash
kubectl port-forward svc/monitoring-grafana 8080:80 -n monitoring
```
Access at `http://localhost:8080` (Default user: `admin`, Password: `pde-grafana-admin`).

## Alerting Configuration

Alerts are sent to `Alertmanager`. Ensure you update the email credentials in `prometheus-values.yaml` under `alertmanager.config.receivers`.

## Verifying Metrics Scraping

To verify Prometheus is successfully scraping metrics:
1. Access Prometheus: `kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090 -n monitoring`
2. Go to `Status` > `Targets` and verify `pde-backend` is `UP`.

## Cleanup

To remove the monitoring stack:
```bash
helm uninstall monitoring -n monitoring
kubectl delete namespace monitoring
```
