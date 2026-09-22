# =============================================================================
# Restart the full PDE local stack after a Windows reboot or Docker restart.
#
# WHAT SURVIVES A REBOOT AUTOMATICALLY:
#   [ok] kind cluster "pde-dev"  (container auto-starts - restart policy on node)
#   [ok] kind-registry           (created with --restart=always)
#   [ok] All k8s objects         (pde / argocd / monitoring namespaces, PVCs)
#
# WHAT DOES NOT AUTO-START:
#   [no] jenkins                 (no --restart policy at creation time)
#   [no] kubectl port-forwards   (always manual; run start-port-forwards.ps1)
#
# USAGE:
#   cd C:\Users\Home\Desktop\project\PDE
#   powershell -File local-k8s\scripts\restart-stack.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# 1. Verify Docker is running
# ---------------------------------------------------------------------------
docker info *>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker is not running. Start Docker Desktop first, then re-run." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
# 2. Ensure kind cluster node containers are running
#    (They normally auto-start with Docker Desktop, but this handles the edge
#    case where Docker was restarted with auto-start disabled.)
# ---------------------------------------------------------------------------
$nodes = docker ps -a --filter "label=io.x-k8s.kind.cluster=pde-dev" --format "{{.Names}}"
foreach ($n in $nodes) {
    $state = docker inspect -f "{{.State.Running}}" $n
    if ($state -ne "true") {
        Write-Host "Starting kind node $n ..." -ForegroundColor Yellow
        docker start $n | Out-Null
    }
}
if (-not $nodes) {
    Write-Host "ERROR: No pde-dev cluster containers found! The cluster was deleted." -ForegroundColor Red
    Write-Host "Recreate it with:" -ForegroundColor Yellow
    Write-Host "  kind create cluster --name pde-dev --config local-k8s/kind-config.yaml"
    Write-Host "  bash local-k8s/scripts/setup-local-registry.sh"
    Write-Host "  (then re-run steps 4-10 of local-k8s/README.md)"
    exit 1
}

# ---------------------------------------------------------------------------
# 2b. Low-memory guard: warn when the Docker VM is under memory pressure.
#     6 GB Docker budget: if less than ~3 GiB is available inside the node,
#     Jenkins builds and monitoring installs are likely to destabilize pods.
#     Warning only — never blocks startup.
# ---------------------------------------------------------------------------
$kindNode = docker ps --filter "label=io.x-k8s.kind.cluster=pde-dev" --format "{{.Names}}" | Select-Object -First 1
if ($kindNode) {
    $memLine = docker exec $kindNode sh -c "grep MemAvailable /proc/meminfo" 2>$null
    if ($memLine -match 'MemAvailable:\s+(\d+) kB') {
        $availGiB = [math]::Round([double]$Matches[1] / 1MB, 2)
        if ($availGiB -lt 3) {
            Write-Host "WARNING: only ${availGiB} GiB available inside the kind node (< 3 GiB)." -ForegroundColor Yellow
            Write-Host "Consider NOT starting Jenkins / running builds right now (see MEMORY-MANAGEMENT.md)."
        } else {
            Write-Host "Node memory headroom: ${availGiB} GiB available" -ForegroundColor Green
        }
    }
}
# ---------------------------------------------------------------------------
# 2c. Repair kind node IP drift — the #1 cause of "NotReady / NodeStatusUnknown"
#     plus a hung `kubectl wait` after a Docker Desktop restart.
#
#     WHY: Docker Desktop's own Kubernetes cluster runs a kind node container
#     ("desktop-control-plane", label io.x-k8s.kind.cluster=desktop) on the SAME
#     docker bridge network named "kind". Whichever node starts first wins
#     172.18.0.2. When Docker Desktop wins that race, the pde-dev node comes up
#     on another address (172.18.0.3, ...) and kind's node entrypoint rewrites
#     only these files (see fixup list in /usr/local/bin/entrypoint):
#         manifests/*.yaml, controller-manager.conf, scheduler.conf,
#         /kind/kubeadm.conf, /var/lib/kubelet/kubeadm-flags.env
#     It NEVER rewrites /etc/kubernetes/kubelet.conf, so kubelet keeps dialling
#     the OLD address — which now belongs to the OTHER cluster's API server:
#         x509: certificate signed by unknown authority (crypto/rsa:
#         verification error while trying to verify candidate authority
#         certificate "kubernetes")
#     The node then never registers and stays NotReady.
#
#     This step is idempotent: it compares the address in kubelet.conf with the
#     address the node really has and patches only when they differ.
#     (Best permanent cure on a 6 GB machine: disable Docker Desktop's built-in
#     Kubernetes — it frees ~1.5 GB and removes the IP race altogether.)
# ---------------------------------------------------------------------------
if ($kindNode) {
    $netInfo = docker inspect -f "{{json .NetworkSettings.Networks}}" $kindNode 2>$null | ConvertFrom-Json
    $nodeIP = $netInfo.kind.IPAddress
    $confLine = docker exec $kindNode sh -c "grep -m1 'server:' /etc/kubernetes/kubelet.conf" 2>$null
    if ($nodeIP -and $confLine -match 'https://([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):6443') {
        $confIP = $Matches[1]
        if ($confIP -ne $nodeIP) {
            Write-Host "Node IP drift: kubelet.conf points at $confIP but the node is now $nodeIP" -ForegroundColor Yellow
            $netMap = docker network inspect kind --format "{{range .Containers}}{{.Name}}={{.IPv4Address}} {{end}}" 2>$null
            if ($netMap -match "([A-Za-z0-9_.-]+)=$confIP/") {
                Write-Host "  ($confIP now belongs to container '$($Matches[1])' — a different cluster's API server)"
            }
            Write-Host "  Patching /etc/kubernetes/kubelet.conf and restarting kubelet ..." -ForegroundColor Yellow
            docker exec $kindNode sed -i "s#https://${confIP}:6443#https://${nodeIP}:6443#" /etc/kubernetes/kubelet.conf | Out-Null
            docker exec $kindNode systemctl restart kubelet | Out-Null
            Write-Host "  kubelet.conf now points at $nodeIP" -ForegroundColor Green
        } else {
            Write-Host "Node IP check: kubelet.conf matches the node address ($nodeIP)" -ForegroundColor Green
        }
        # kubelet also needs a serving cert that covers the new address.
        $san = docker exec $kindNode sh -c "openssl x509 -in /etc/kubernetes/pki/apiserver.crt -noout -text 2>/dev/null | grep -c '$nodeIP'" 2>$null
        if ($san -and $san.Trim() -eq "0") {
            Write-Host "WARNING: the apiserver certificate does not cover $nodeIP." -ForegroundColor Yellow
            Write-Host "Repair it inside the node, then restart it:"
            Write-Host "  docker exec $kindNode rm -f /etc/kubernetes/pki/apiserver.crt /etc/kubernetes/pki/apiserver.key"
            Write-Host "  docker exec $kindNode kubeadm init phase certs apiserver --config /kind/kubeadm.conf"
            Write-Host "  docker restart $kindNode"
        }
    }
}

# ---------------------------------------------------------------------------
# 3. Ensure kind-registry is up and on the kind network
# ---------------------------------------------------------------------------
$reg = docker inspect -f "{{.State.Running}}" kind-registry 2>$null
if ($reg -ne "true") {
    if (docker inspect kind-registry 2>$null) {
        Write-Host "Starting kind-registry ..." -ForegroundColor Yellow
        docker start kind-registry | Out-Null
    } else {
        Write-Host "kind-registry container missing - recreating (re-push images afterwards):" -ForegroundColor Yellow
        docker run -d --restart=always -p 127.0.0.1:5000:5000 --name kind-registry registry:2
    }
}
$onKindNet = docker inspect -f "{{json .NetworkSettings.Networks.kind}}" kind-registry
if ($onKindNet -eq "null" -or -not $onKindNet) {
    docker network connect kind kind-registry
    Write-Host "Re-attached kind-registry to the kind network" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 4. Start Jenkins (does not auto-start after reboot)
# ---------------------------------------------------------------------------
$jen = docker inspect -f "{{.State.Running}}" jenkins 2>$null
if ($jen -ne "true") {
    if (docker inspect jenkins 2>$null) {
        Write-Host "Starting jenkins ..." -ForegroundColor Yellow
        docker start jenkins | Out-Null
    } else {
        Write-Host "jenkins container not found." -ForegroundColor Yellow
        Write-Host "Start it with the custom jenkins-pde image (see local-k8s/README.md §9):"
        Write-Host '  docker run -d --name jenkins --network kind --group-add 0 `'
        Write-Host '    -p 8080:8080 -p 50000:50000 `'
        Write-Host '    -v jenkins_home:/var/jenkins_home `'
        Write-Host '    -v //var/run/docker.sock://var/run/docker.sock `'
        Write-Host '    jenkins-pde:latest'
    }
}

# ---------------------------------------------------------------------------
# 5. Point kubectl at the cluster and wait for the node to be Ready
#
#    NOTE: the API server address in ~/.kube/config is a 127.0.0.1:<random port>
#    exposed by the node container, so it does not change with the node's docker
#    IP. The in-node repair happens in step 2c above.
#
#    kubectl prints "memcache.go:265 Unhandled Error ... EOF" while the API
#    server is still booting - that is retry noise, not the failure itself.
#    BUT a native command writing to stderr becomes a terminating error while
#    $ErrorActionPreference is "Stop", which is why this section (and the rest of
#    the script) relaxes it and checks $LASTEXITCODE explicitly instead.
# ---------------------------------------------------------------------------
$ErrorActionPreference = "Continue"

kubectl config use-context kind-pde-dev

# Give the API server up to ~90s to answer before the blocking wait.
$apiReady = $false
for ($i = 1; $i -le 18; $i++) {
    kubectl get --raw /readyz --request-timeout=5s *> $null
    if ($LASTEXITCODE -eq 0) { $apiReady = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $apiReady) {
    Write-Host "ERROR: the kind API server is not answering." -ForegroundColor Red
    Write-Host "  Check the node container:  docker ps -a | Select-String pde-dev-control-plane"
    Write-Host "  Node IP drift is the usual cause - re-read step 2c output above, then:"
    Write-Host "    local-k8s/scripts/RECOVERY-CHECKPOINT.md  (Phase 2)"
    exit 1
}

kubectl wait --for=condition=ready node --all --timeout=300s
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: the node did not become Ready within 300s." -ForegroundColor Yellow
    Write-Host "Diagnose with:"
    Write-Host "  docker exec $kindNode grep server: /etc/kubernetes/kubelet.conf"
    Write-Host "  docker exec $kindNode journalctl -u kubelet -n 40 --no-pager"
    Write-Host "  kubectl describe node $kindNode"
    Write-Host "Guide: local-k8s/scripts/RECOVERY-CHECKPOINT.md (Phase 2)"
} else {
    kubectl get nodes
# ---------------------------------------------------------------------------
# 5b. Control-plane health gate.
#
#     On this 6 GB single-node VM the WSL2 disk is the bottleneck. When the
#     whole stack cold-starts at once, /proc/pressure/io spikes to ~85% and
#     etcd reads slow to >60s. That makes kube-controller-manager lose its
#     leader-election lease and CrashLoopBackOff (56+ restarts observed).
#     It recovers by itself once the I/O storm passes - but only if nothing
#     else piles on. So: wait for the controller-manager, and if it keeps
#     crash-looping, tell the operator how to shed load instead of rolling
#     restarts (which make it worse).
# ---------------------------------------------------------------------------
$cmReady = $false
for ($i = 1; $i -le 24; $i++) {   # up to ~2 minutes
    kubectl -n kube-system wait --for=condition=ready pod `
        -l tier=control-plane --timeout=5s *> $null
    if ($LASTEXITCODE -eq 0) { $cmReady = $true; break }
    Start-Sleep -Seconds 5
}
if (-not $cmReady) {
    $ioLine = docker exec $kindNode sh -c "head -1 /proc/pressure/io 2>/dev/null" 2>$null
    Write-Host "WARNING: kube-controller-manager is not Ready yet." -ForegroundColor Yellow
    if ($ioLine) { Write-Host "  Disk I/O pressure: $ioLine" }
    Write-Host "  This is usually the WSL2 disk saturating during cold-start, NOT a broken cluster."
    Write-Host "  It self-heals once the storm passes. To speed it up, shed load temporarily:"
    Write-Host "    kubectl scale deploy -n monitoring --all --replicas=0"
    Write-Host "    kubectl scale deploy -n argocd     --all --replicas=0"
    Write-Host "  ...wait ~2 min for load to drop, then scale back to 1."
} else {
    Write-Host "Control plane (controller-manager + scheduler) is Ready." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 6. Recover pods stuck in a REAL failure state (Error / CrashLoopBackOff /
}

# ---------------------------------------------------------------------------
# 6. Recover pods stuck in a REAL failure state (Error / CrashLoopBackOff /
#    ImagePullBackOff).
#
#    "Unknown" is deliberately NOT restarted any more. It only means kubelet
#    could not report status while the node was unreachable - kubelet re-reports
#    those pods by itself once it is registered. Rolling every deployment in
#    pde + argocd on top of that starts a second wave of pods and overloads a
#    6 GB single-node VM (measured: load 17, container creates timing out,
#    kube-apiserver liveness restarts).
# ---------------------------------------------------------------------------
$stuckOutput = kubectl get pods -A --no-headers 2>$null |
    Where-Object { $_ -match '\s(Error|CrashLoopBackOff|ImagePullBackOff|ErrImagePull|RunContainerError)\s' }
if ($stuckOutput) {
    $stuckCount = ($stuckOutput | Measure-Object).Count
    Write-Host "Found $stuckCount pod(s) in a real error state - rolling restart in pde + argocd ..." -ForegroundColor Yellow
    kubectl -n pde    rollout restart deploy 2>$null | Out-Null
    kubectl -n argocd rollout restart deploy 2>$null | Out-Null
    kubectl -n argocd rollout restart statefulset 2>$null | Out-Null
    Start-Sleep -Seconds 5
}

# ---------------------------------------------------------------------------
# 7. Summary
# ---------------------------------------------------------------------------
kubectl get pods -n pde
Write-Host ""
kubectl get pods -A | Select-String -Pattern "pde|argocd|monitoring|ingress"
Write-Host ""
Write-Host "Stack restarted. Next steps:" -ForegroundColor Green
Write-Host "  1. Run: powershell -File local-k8s\scripts\start-port-forwards.ps1"
Write-Host "  2. Verify http://pde.local (app)"
Write-Host "  3. Verify https://localhost:8081 (ArgoCD)"
Write-Host "  4. Verify http://localhost:3000  (Grafana)"
