# =============================================================================
# check-backend-code.ps1 - "Which code is the running backend pod executing?"
#
# Same idea as check-frontend-code.ps1, adapted to the FastAPI backend:
#   1. What image/digest is the pod ACTUALLY running (status.imageID)?
#   2. What does the registry currently serve for the deployment's image tag?
#   3. Does the image predate the pod (stale pod) - plus an optional per-file
#      source diff of /app/app inside the pod vs the local pde-backend tree.
#
# Works with both deployment styles in this repo:
#   - Helm chart (helm/pde): deployment "pde-backend", image .../pde/backend:<tag>
#   - plain manifests (k8s/04-backend.yaml): deployment "backend", image pde/backend:latest
#
# Usage (from repo root, cluster reachable via kubectl context):
#   powershell -NoProfile -ExecutionPolicy Bypass -File local-k8s\scripts\check-backend-code.ps1
#   powershell ... -Deployment backend -Namespace pde
#   powershell ... -Registry http://localhost:5000          # default (kind local registry)
#   powershell ... -LocalSrc .\pde-backend                  # also diff in-pod .py vs local source
# =============================================================================
param(
    [string]$Namespace = "pde",
    [string]$Deployment = "pde-backend",
    [string]$Registry = "http://localhost:5000",
    # Backend source root (contains requirements.txt + app\) to diff against the pod
    [string]$LocalSrc = ""
)

$ErrorActionPreference = "Continue"

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Get-PodDigest([string]$ImageId) {
    # status.imageID looks like:
    #   "docker-pullable://localhost:5000/pde/backend@sha256:abc..." (docker/containerd)
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
    Write-Host "Try: -Deployment backend   (plain k8s/04-backend.yaml style)"
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
# contains a dot / colon / is "localhost" ("pde/backend:latest" has no host).
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
    $tmp = Join-Path $env:TEMP ("be-manifest-" + [guid]::NewGuid().ToString('N') + ".json")
    $null = & curl.exe -s -o $tmp -H "Accept: $accept" "$Registry/v2/$Repo/manifests/$tagDigest"
    if (Test-Path $tmp) {
        $m = Get-Content $tmp -Raw | ConvertFrom-Json
        Remove-Item $tmp -ErrorAction SilentlyContinue
        if ($m -and $m.config) {
            $cfg = & curl.exe -s "$Registry/v2/$repo/blobs/$($m.config.digest)" | ConvertFrom-Json
            $tagInfo = [pscustomobject]@{
                created  = $cfg.created
                revision = $cfg.config.Labels.'org.opencontainers.image.revision'
            }
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
# 5. Optional: per-file source diff inside the pod vs the local backend tree
# -----------------------------------------------------------------------------
if ($LocalSrc -and (Test-Path (Join-Path $LocalSrc 'requirements.txt'))) {
    Write-Section "5) In-pod source fingerprint vs local tree (-LocalSrc)"

    $p = $podNames | Select-Object -First 1

    # Dependency drift first (requirements.txt)
    $podReq   = kubectl exec $p -n $Namespace -- sh -c "md5sum /app/requirements.txt 2>/dev/null"
    $localReq = (Get-FileHash (Join-Path $LocalSrc 'requirements.txt') -Algorithm MD5).Hash.ToLower()
    $podReqHash = if ($podReq) { ($podReq -split '\s+')[0] } else { $null }
    Write-Host ("pod   requirements.txt md5 : {0}" -f $podReqHash)
    Write-Host ("local requirements.txt md5 : {0}" -f $localReq)
    if ($podReqHash -and $podReqHash -ne $localReq) {
        Write-Host "[DIFF] installed dependencies may not match the local requirements.txt." -ForegroundColor Yellow
    }

    # Per-file md5 of every .py under /app/app in the pod. NOTE: single quotes
    # inside the remote command - PowerShell 5.1 mangles embedded double quotes
    # when passing args to `sh -c`.
    $cmd = "cd /app/app && find . -name '*.py' -type f -exec md5sum {} + | sort -k2"
    $podFiles = kubectl exec $p -n $Namespace -- sh -c $cmd 2>$null
    $podMap = @{}
    foreach ($line in @($podFiles)) {
        if ($line -match '^([a-f0-9]{32})\s+(.+\.py)$') {
            $podMap[$Matches[2].TrimStart('.')] = $Matches[1]
        }
    }

    # Same for the local tree (resolve to absolute paths first so the
    # relative-path math below works regardless of how -LocalSrc was passed)
    if ($LocalSrc -notmatch '^[A-Za-z]:') { $LocalSrc = (Resolve-Path $LocalSrc).Path }
    $appRoot = Join-Path $LocalSrc 'app'
    $localMap = @{}
    if (Test-Path $appRoot) {
        Get-ChildItem $appRoot -Recurse -Filter *.py -File | ForEach-Object {
            $rel = $_.FullName.Substring($appRoot.Length) -replace '\\', '/'
            $localMap[$rel] = (Get-FileHash $_.FullName -Algorithm MD5).Hash.ToLower()
        }
    }

    $same = 0; $diffList = @(); $onlyLocalList = @(); $onlyPodList = @()
    foreach ($k in $localMap.Keys) {
        if ($podMap.ContainsKey($k)) {
            if ($podMap[$k] -eq $localMap[$k]) { $same++ } else { $diffList += $k }
        } else { $onlyLocalList += $k }
    }
    foreach ($k in $podMap.Keys) { if (-not $localMap.ContainsKey($k)) { $onlyPodList += $k } }

    Write-Host ("python files - pod: {0} | local: {1} | identical: {2}" -f $podMap.Count, $localMap.Count, $same)
    if ($diffList.Count -gt 0) {
        Write-Host "files that DIFFER (local tree newer/older than the pod):" -ForegroundColor Yellow
        $diffList | Select-Object -First 10 | ForEach-Object { Write-Host ("   M {0}" -f $_) }
    }
    if ($onlyLocalList.Count -gt 0) {
        Write-Host "files only in the LOCAL tree (written after the image was built):" -ForegroundColor Yellow
        $onlyLocalList | Select-Object -First 10 | ForEach-Object { Write-Host ("   + {0}" -f $_) }
    }
    if ($onlyPodList.Count -gt 0) {
        Write-Host "files only in the POD (deleted locally after the image was built):" -ForegroundColor Yellow
        $onlyPodList | Select-Object -First 10 | ForEach-Object { Write-Host ("   - {0}" -f $_) }
    }
    if ($diffList.Count -eq 0 -and $onlyLocalList.Count -eq 0 -and $onlyPodList.Count -eq 0 -and $localMap.Count -gt 0) {
        Write-Host "[OK] Every .py file in the pod is byte-identical to the local tree." -ForegroundColor Green
    }
    Write-Host "Note: identical source gives identical hashes; line-ending (CRLF) differences will show as DIFF."
}

Write-Host ""
Write-Host "Done. Digest equality = pod runs the registry's current code for that tag." -ForegroundColor Cyan
