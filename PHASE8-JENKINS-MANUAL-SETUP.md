# Phase 8 — Jenkins Manual Setup Guide

Jenkins is now running at **http://localhost:8080**

Due to Jenkins security configuration complexity, the final setup steps require manual UI interaction. Follow this guide:

---

## Step 1: Access Jenkins UI

1. Open: **http://localhost:8080**
2. You should see the Jenkins dashboard (already initialized)

---

## Step 2: Add Git Credentials

1. Click **Manage Jenkins** (left sidebar)
2. Click **Credentials**
3. Click **System** (left sidebar)
4. Click **Global credentials (unrestricted)**
5. Click **Add Credentials** (left sidebar)
6. Fill in:
   - **Kind**: Username with password
   - **Username**: farooqui-owais
   - **Password**: (your GitHub Personal Access Token — DO NOT commit this!)
   - **ID**: git-creds (IMPORTANT: must match exactly)
   - **Description**: Git Credentials for PDE
7. Click **Create**

---

## Step 3: Create Pipeline Job

1. Click **New Item** (left sidebar)
2. Enter name: **pde-local**
3. Select: **Pipeline**
4. Click **OK**
5. Scroll down to **Pipeline** section
6. In the **Definition** dropdown, select: **Pipeline script from SCM**
7. Fill in:
   - **SCM**: Git
   - **Repository URL**: https://github.com/farooqui-owais/pde.git
   - **Credentials**: git-creds (should auto-populate)
   - **Branches to build**: */main
   - **Script Path**: local-k8s/Jenkinsfile.k8s
8. Click **Save**

---

## Step 4: Run the Pipeline

1. You should now be on the **pde-local** job page
2. Click **Build Now** (left sidebar)
3. Watch the build progress in the **Build History** section (bottom left)
4. Click the build number to see logs

The pipeline will:
- Run backend tests
- Build frontend
- Build & push both Docker images to localhost:5000
- Bump image tags in helm/pde/values-local.yaml
- Push the updated values file back to GitHub

---

## Expected Output

When the build completes successfully:
- You'll see `Finished: SUCCESS`
- Check ArgoCD UI (https://localhost:8081)
- Within 1-3 minutes, you should see a new sync
- New pods will be created with fresh image tags

---

## Verify Full CI/CD Loop

After the pipeline run:

1. **Check ArgoCD UI:**
   ```
   https://localhost:8081
   Login: admin / 1qDaoHvyKurDzxoR
   ```
   - The "pde" app should show a new Sync

2. **Check new pods:**
   ```powershell
   kubectl get pods -n pde -w
   ```
   - New pods with fresh `AGE` should appear

3. **Verify in app:**
   ```
   http://pde.local
   ```
   - Should still be accessible

---

## Troubleshooting

**Build fails with "git-creds" not found:**
- Re-check Step 2: ID must be exactly "git-creds"

**Build fails with "docker: command not found":**
- Docker CLI is already installed in the container
- Check: `docker ps` to see jenkins container

**Repository connection refused:**
- Ensure kind cluster has internet access to GitHub
- Test: `kubectl run -it debug --image=alpine --restart=Never -- wget https://github.com`

**Pipeline runs but images not pushed:**
- Verify local registry is running: `docker ps | grep kind-registry`
- Check images: `curl http://localhost:5000/v2/_catalog`

---

## Next Steps

Once the pipeline runs successfully:
- Proceed to **Phase 9: Prometheus & Grafana** for monitoring

---

## Jenkins Manual Actions Timeline

- Started: Jenkins container at http://localhost:8080
- Credentials added: farooqui-owais with GitHub PAT
- Next: Manually create pde-local job and trigger build
