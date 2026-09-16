# =============================================================================
# Custom Jenkins image for the PDE local CI/CD stack.
#
# WHY THIS EXISTS
# ---------------
# The stock jenkins/jenkins:lts image ships without:
#   - docker CLI  → "Build & Push Images" stage would fail
#   - python3-venv → backend quality-gate `python3 -m venv` would fail
#   - nodejs/npm  → frontend quality-gate `npm ci` / `npm run build` would fail
#   - git          → already present in the LTS image, listed for clarity
# This image adds all of the above on top of the official LTS base.
#
# PYTHON VERSION NOTE
# -------------------
# Debian 12 (Bookworm) — which jenkins/jenkins:lts is based on — ships
# Python 3.11 as the default `python3`. The quality-gate stage runs tests
# inside a separate `python:3.11-slim` container (via docker-in-docker),
# so both paths use 3.11. If the LTS base ever moves to Debian 13 (Trixie)
# and ships Python 3.13, the host venv fallback would still be fine because
# the quality gate container is pinned to python:3.11-slim.
#
# DOCKER SOCKET (DinD)
# --------------------
# Jenkins talks to the HOST Docker daemon via the mounted socket:
#   -v /var/run/docker.sock:/var/run/docker.sock
# On Docker Desktop for Windows the socket owner is root:root (group 0),
# so we add the jenkins user to group 0 at image build time. If you still
# get "permission denied on /var/run/docker.sock", also pass:
#   --group-add $(stat -c '%g' /var/run/docker.sock)
# (Git Bash on Windows: use double-slashes for the socket path:
#   -v //var/run/docker.sock://var/run/docker.sock)
#
# BUILD
# -----
# Run from the REPO ROOT (not from local-k8s/jenkins/):
#   docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .
#
# RUN (PowerShell on Windows / Docker Desktop)
# -----
#   docker run -d --name jenkins --network kind --group-add 0 `
#     -p 8080:8080 -p 50000:50000 `
#     -v jenkins_home:/var/jenkins_home `
#     -v //var/run/docker.sock://var/run/docker.sock `
#     jenkins-pde:latest
#
# RUN (Linux / macOS / Git Bash)
# -----
#   docker run -d --name jenkins --network kind --group-add 0 \
#     -p 8080:8080 -p 50000:50000 \
#     -v jenkins_home:/var/jenkins_home \
#     -v /var/run/docker.sock:/var/run/docker.sock \
#     jenkins-pde:latest
# =============================================================================

FROM jenkins/jenkins:lts

USER root

# Install system dependencies:
#   python3 + python3-venv : host-agent fallback for any stages run outside docker
#   nodejs + npm           : frontend quality gate (npm ci, npm run build)
#   docker.io              : provides the docker CLI so build/push stages work via
#                            the mounted host socket. NOTE: do NOT also install
#                            docker-cli (upstream Docker repo pkg) — on Debian both
#                            packages conflict and one will silently win with an
#                            unknown version. docker.io is the correct Debian package.
#   curl                   : used by health probes and pip-audit network calls
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        python3-pip \
        nodejs \
        npm \
        docker.io \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && echo "=== Installed tool versions ===" \
    && python3 --version \
    && node --version \
    && npm --version \
    && docker --version

# Docker socket permissions:
#   On Docker Desktop the socket is owned root:root (group 0), so we add the
#   jenkins user (uid 1000) to group 0. On Linux Docker Engine the socket group
#   is typically 'docker' (often gid 999); pass --group-add <gid> at runtime
#   if you need a different gid. groupadd may fail if gid 999 already exists
#   (e.g. on some Docker Desktop images) — `|| true` suppresses that safely.
ARG DOCKER_GID=999
RUN groupadd -g ${DOCKER_GID} docker 2>/dev/null || true \
    && usermod -aG docker jenkins \
    && usermod -aG root jenkins

USER jenkins

# Pre-install pipeline plugins so first-boot doesn't need to pull them.
# Plugin versions are managed by jenkins-plugin-cli which resolves transitive
# dependencies automatically — pinning names only (no versions) picks the latest
# compatible set for the installed Jenkins LTS version.
COPY local-k8s/jenkins/plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli -f /usr/share/jenkins/ref/plugins.txt