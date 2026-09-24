# =============================================================================
# check-frontend-code.ps1 - "Which code is the running frontend pod serving?"
#
# Answers three questions for the pde-frontend nginx pod(s):
#   1. What image/digest is the pod ACTUALLY running (status.imageID)?
#   2. What does the registry currently serve for the deployment's image tag
#      (and for :latest)?
#   3. Does the image predate the pod (stale pod) - plus an optional content
#      fingerprint of /usr/share/nginx/html inside the pod.
#
# Works with both deployment styles in this repo:
#   - Helm chart (helm/pde): deployment "pde-frontend", image .../pde/frontend:<tag>
#   - plain manifests (k8s/05-frontend.yaml): deployment "frontend", image pde/frontend:latest
#
# Usage (from repo root, cluster reachable via kubectl context):
#   powershell -NoProfile -ExecutionPolicy Bypass -File local-k8s\scripts\check-frontend-code.ps1
#   powershell ... -Deployment frontend -Namespace pde
#   powershell ... -Registry http://localhost:5000        # default (kind local registry)
#   powershell ... -LocalDist .\pde-frontend\dist         # also diff in-pod files vs local build
# =============================================================================
param(
    [string]$Namespace = "pde",
    [string]$Deployment = "pde-frontend",
    [string]$Registry = "http://localhost:5000",
    # Path to a freshly built local bundle to diff against the pod's files (optional)
    [string]$LocalDist = ""
)

$ErrorActionPreference = "Continue"

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Get-PodDigest([string]$ImageId) {
    # status.imageID looks like:
    #   "docker-pullable://localhost:5000/pde/frontend@sha256:abc..." (docker/containerd)
    #   "sha256:abc..." or "registry:5000/...@sha256:abc..."
    return ($ImageId -replace '^.*@', '')
}

# -----------------------------------------------------------------------------
# 1. Locate the deployment and its pods
# -----------------------------------------------------------------------------
Write-Section "1) Deployment & pods (namespace: $Namespace)"

$deployJson = kubectl get deploy $Deployment -n $Namespace -o json --request-timeout=20s 2>$null | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Host "kubectl failed to read deployment '$Deployment' (API server unreachable or RBAC?)." -ForegroundColor Red
    Write-Host "Check: kubectl config current-context / kubectl get ns"
    exit 2
}
if (-not $deployJson) {
    Write-Host "Deployment '$Deployment' not found in namespace '$Namespace'." -ForegroundColor Red
    Write-Host "Try: -Deployment frontend   (plain k8s/05-frontend.yaml style)"
    exit 1
}

$image = $deployJson.spec.template.spec.containers[0].image
$revision = $deployJson.metadata.annotations.'deployment.kubernetes.io/revision'
Write-Host ("Deployment image : {0}" -f $image)
Write-Host ("Rollout revision : {0}" -f $revision)

# Pods of this deployment share the name prefix "<deployment-name>-"
$podNames = (kubectl get pods -n $Namespace -o name) -replace '^pod/', '' |
    Where-Object { $_ -like "$Deployment-*" }
if (-not $podNames) {
    Write-Host "No running pods found for deployment '$Deployment'." -ForegroundColor Red
    exit 1
}
Write-Host ("Pods             : {0}" -f ($podNames -join ', '))

# -----------------------------------------------------------------------------
# 2. Digest the pods are actually running
# -----------------------------------------------------------------------------
Write-Section "2) Running image digest (from pod status)"

$podDigests = @{}
foreach ($p in $podNames) {
    $imageId = kubectl get pod $p -n $Namespace -o jsonpath='{.status.containerStatuses[0].imageID}'
    $started = kubectl get pod $p -n $Namespace -o jsonpath='{.status.startTime}'
    $digest = Get-PodDigest $imageId
    $podDigests[$p] = $digest
    Write-Host ("{0}" -f $p)
    Write-Host ("   started   : {0}" -f $started)
    Write-Host ("   imageID   : {0}" -f $digest)
}

# -----------------------------------------------------------------------------
# 3. What the registry currently serves for this tag (and :latest)
# -----------------------------------------------------------------------------
Write-Section "3) Registry content ($Registry)"

# Split image -> repo + tag. A leading segment is a registry HOST only when it
# contains a dot / colon / is "localhost" ("pde/frontend:latest" has no host).
$imageNoDigest = ($image -split '@')[0]
$parts = $imageNoDigest -split '/'
$repoTag = $imageNoDigest
if ($parts.Count -ge 2 -and ($parts[0] -match '[.:]' -or $parts[0] -eq 'localhost')) {
    $repoTag = ($parts[1..($parts.Count - 1)] -join '/')
}
if ($repoTag -match '^(.+):([^:/]+)$') { $repo = $Matches[1]; $tag = $Matches[2] }
else { $repo = $repoTag; $tag = "latest" }
$accept = "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"

function Get-RegistryDigest([string]$Repo, [string]$Tag) {
    $h = & curl.exe -s -I -H "Accept: $accept" "$Registry/v2/$Repo/manifests/$Tag"
    if ($LASTEXITCODE -ne 0) { return $null }
    $line = ($h | Select-String -Pattern 'Docker-Content-Digest').Line
    if (-not $line) { return $null }
    # "Docker-Content-Digest: sha256:abc..." -> "sha256:abc..."
    return (($line -split ':', 2)[-1].Trim())
}

$tagDigest    = Get-RegistryDigest $repo $tag
$latestDigest = Get-RegistryDigest $repo "latest"

# GET the manifest, then its config blob, for created timestamp / git label
$tagInfo = $null
if ($tagDigest) {
    $tmp = Join-Path $env:TEMP ("fe-manifest-" + [guid]::NewGuid().ToString('N') + ".json")
    $null = & curl.exe -s -o $tmp -H "Accept: $accept" "$Registry/v2/$Repo/manifests/$tagDigest"
    if (-not (Test-Path $tmp)) { return $null }
    $m = Get-Content $tmp -Raw | ConvertFrom-Json
    Remove-Item $tmp -ErrorAction SilentlyContinue
    if ($m.config) {
        $cfg = & curl.exe -s "$Registry/v2/$repo/blobs/$($m.config.digest)" | ConvertFrom-Json
        $tagInfo = [pscustomobject]@{
            created  = $cfg.created
            revision = $cfg.config.Labels.'org.opencontainers.image.revision'
        }
    }
}

Write-Host ("Repo/tag           : {0}:{1}" -f $repo, $tag)
Write-Host ("Registry '{0}'   : {1}" -f $tag, $tagDigest)
if ($tagInfo) {
    Write-Host ("Image built (UTC)  : {0}" -f $tagInfo.created)
    if ($tagInfo.revision) { Write-Host ("Git revision       : {0}" -f $tagInfo.revision) }
}
Write-Host ("Registry 'latest'  : {0}" -f $latestDigest)

# -----------------------------------------------------------------------------
# 4. Verdict - new or old code?
# -----------------------------------------------------------------------------
Write-Section "4) Verdict"

foreach ($p in $podNames) {
    $d = $podDigests[$p]
    if (-not $tagDigest) {
        Write-Host ("[??] Could not reach tag '{0}' in registry - check the -Registry value." -f $tag) -ForegroundColor Yellow
        continue
    }
    if ($d -eq $tagDigest) {
        Write-Host ("[OK] {0} runs EXACTLY what registry tag '{1}' serves right now." -f $p, $tag) -ForegroundColor Green
        if ($latestDigest -and $tagDigest -ne $latestDigest) {
            Write-Host ("     NOTE: tag '{0}' != 'latest' - 'latest' points to a DIFFERENT build ({1})" -f $tag, $latestDigest) -ForegroundColor Yellow
        }
    }
    else {
        Write-Host ("[STALE] {0} differs from registry tag '{1}' ({2})." -f $p, $tag, $tagDigest) -ForegroundColor Red
        Write-Host "        The pod is running an OLD image. Roll it out with:" -ForegroundColor Red
        Write-Host ("        kubectl rollout restart deploy/{0} -n {1}" -f $Deployment, $Namespace)
        Write-Host "        (or bump the image tag via Helm/ArgoCD and sync)"
    }
}

# If the tag's image was built AFTER the pod started, the pod predates this build
if ($tagInfo -and $tagInfo.created) {
    foreach ($p in $podNames) {
        $startedText = kubectl get pod $p -n $Namespace -o jsonpath='{.status.startTime}'
        try {
            $startedUtc = [datetime]::Parse($startedText, [cultureinfo]::InvariantCulture, 'AssumeUniversal')
            $builtUtc   = [datetime]::Parse($tagInfo.created, [cultureinfo]::InvariantCulture, 'AssumeUniversal')
            if ($builtUtc -gt $startedUtc) {
                Write-Host ("[NOTE] {0}: image was built AFTER this pod started - running code predates the newest build." -f $p) -ForegroundColor Yellow
            }
        } catch { }
    }
}

# -----------------------------------------------------------------------------
# 5. Optional: content fingerprint inside the pod vs a local fresh build
# -----------------------------------------------------------------------------
if ($LocalDist -and (Test-Path (Join-Path $LocalDist 'index.html'))) {
    Write-Section "5) In-pod file fingerprint vs local dist (-LocalDist)"

    $p = $podNames | Select-Object -First 1
    $podIndex   = kubectl exec $p -n $Namespace -- sh -c "md5sum /usr/share/nginx/html/index.html 2>/dev/null" 2>$null
    $localIndex = (Get-FileHash (Join-Path $LocalDist 'index.html') -Algorithm MD5).Hash.ToLower()
    $podHash    = if ($podIndex) { ($podIndex -split '\s+')[0] } else { $null }

    Write-Host ("pod   index.html md5 : {0}" -f $podHash)
    Write-Host ("local index.html md5 : {0}" -f $localIndex)
    if ($podHash -and $podHash -eq $localIndex) {
        Write-Host "[OK] Pod serves the SAME index.html as the local dist build." -ForegroundColor Green
    }
    elseif ($podHash) {
        Write-Host "[DIFF] Pod serves a DIFFERENT index.html than the local dist build." -ForegroundColor Yellow
        Write-Host "       Either the local dist is newer, or the pod is running older code."
    }

    $podAssets   = kubectl exec $p -n $Namespace -- sh -c "ls /usr/share/nginx/html/assets 2>/dev/null" 2>$null
    $localAssets = if (Test-Path (Join-Path $LocalDist 'assets')) { @((Get-ChildItem (Join-Path $LocalDist 'assets')).Name) } else { @() }
    Write-Host ("asset files - pod: {0} | local dist: {1}" -f @($podAssets).Count, $localAssets.Count)
    $onlyLocal = @($localAssets | Where-Object { @($podAssets) -notcontains $_ })
    if ($onlyLocal.Count -gt 0) {
        Write-Host "assets present locally but NOT in the pod (newer bundle built but not deployed):" -ForegroundColor Yellow
        $onlyLocal | Select-Object -First 10 | ForEach-Object { Write-Host ("   {0}" -f $_) }
    }
}

Write-Host ""
Write-Host "Done. Digest equality = pod runs the registry's current code for that tag." -ForegroundColor Cyan

