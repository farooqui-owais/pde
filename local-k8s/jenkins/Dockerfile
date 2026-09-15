# Custom Jenkins image for the local-k8s pipeline (see local-k8s/README.md).
#
# Why this exists: the stock jenkins/jenkins:lts image ships Python without
# python3-venv (so `python3 -m venv` fails in the Backend Quality Gate) and
# without the docker CLI (so the Build & Push Images stage would fail next).
# This adds both, plus the plugins the pipeline needs, on top of the LTS image.
#
# Build it from the repo root:
#   docker build -t jenkins-pde:latest -f local-k8s/jenkins/Dockerfile .
#
# Then run it exactly as before, just with this image. NOTE the --group-add 0:
# on Docker Desktop the socket is root:root, so the jenkins user needs to be
# added to group 0 or `docker` inside the container fails with permission
# denied on /var/run/docker.sock.
#   docker run -d --name jenkins --network kind --group-add 0 \
#     -p 8080:8080 -p 50000:50000 \
#     -v jenkins_home:/var/jenkins_home \
#     -v /var/run/docker.sock:/var/run/docker.sock \
#     jenkins-pde:latest

FROM jenkins/jenkins:lts

USER root

# python3-venv: backend quality gate creates a venv
# nodejs, npm:  frontend quality gate (npm ci, npm run build)
# docker.io:    build/push stages talk to the host daemon via the mounted socket
# git:          already present, listed for clarity of what this image provides
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-venv \
        nodejs \
        npm \
        docker.io \
        docker-cli \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && which python3 node npm docker \
    && python3 --version \
    && node --version \
    && npm --version

# Let the jenkins user (uid 1000) use the host's docker socket. The socket's
# group id varies (often 999 on Docker Desktop); we create the group at runtime.
# If you still get "permission denied" on /var/run/docker.sock, run the container
# with:  --group-add $(getent group docker | cut -d: -f3)   (Git Bash: use //)
ARG DOCKER_GID=999
RUN groupadd -g ${DOCKER_GID} docker || true \
    && usermod -aG docker jenkins

USER jenkins

# Pre-install the plugins the pipeline/job setup uses (git is required for
# "Pipeline script from SCM"; the rest are pulled in transitively anyway but
# pinning them makes first-boot faster and reproducible).
COPY local-k8s/jenkins/plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli -f /usr/share/jenkins/ref/plugins.txt