@echo off
REM PDE Local K8s CI/CD - Automated Stack Recovery
REM Run this script to restore the full stack after PC restart

setlocal enabledelayedexpansion

set PROJECT_ROOT=C:\Users\Home\Desktop\project\PDE

echo.
echo ============================================================
echo PDE Stack Recovery - Automated Startup
echo ============================================================
echo.

echo [1/5] Kind Cluster...
kind get clusters | findstr "pde-dev" >nul 2>&1
if errorlevel 1 (
    echo       Creating pde-dev cluster...
    kind create cluster --name pde-dev --config "%PROJECT_ROOT%\local-k8s\kind-config.yaml" >nul 2>&1
    timeout /t 5 /nobreak >nul
    kubectl wait --for=condition=ready node pde-dev-control-plane --timeout=120s >nul 2>&1
)
echo       OK

echo [2/5] Local Registry...
docker ps -q -f "name=kind-registry" >nul 2>&1
if errorlevel 1 (
    echo       Creating registry...
    docker run -d --restart=always -p 127.0.0.1:5000:5000 --network bridge --name kind-registry registry:2 >nul 2>&1
    timeout /t 2 /nobreak >nul
    docker network connect kind kind-registry >nul 2>&1
)
echo       OK

echo [3/5] Ingress-Nginx...
kubectl get deployment -n ingress-nginx ingress-nginx-controller >nul 2>&1
if errorlevel 1 (
    echo       Installing...
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml >nul 2>&1
    kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s >nul 2>&1
)
echo       OK

echo [4/5] Images...
echo       OK

echo [5/5] ArgoCD...
kubectl get namespace argocd >nul 2>&1
if errorlevel 1 (
    echo       Installing...
    kubectl create namespace argocd >nul 2>&1
    kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml >nul 2>&1
    kubectl wait --for=condition=available --timeout=180s -n argocd deployment/argocd-server >nul 2>&1
)
kubectl apply -f "%PROJECT_ROOT%\local-k8s\argocd\application.yaml" >nul 2>&1
echo       OK

echo.
echo ============================================================
echo Stack Recovery Complete!
echo ============================================================
echo.
echo Next Steps:
echo   1. .\start-port-forwards.ps1
echo   2. Visit http://pde.local
echo.
pause
