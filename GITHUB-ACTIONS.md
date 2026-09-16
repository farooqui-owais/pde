# GitHub Actions — CI/CD Standards (Local-First)

> **Policy: local development first, no EKS (yet).** Deploys run locally via the
> **Jenkins → ArgoCD → kind** stack. GitHub Actions is the *quality gate*, not the
> deployer. Cloud deploy workflows are manual-only until their target is configured.
>
> See also: [implementation plan.md](implementation%20plan.md) (Jenkins local fixes),
> [walkthrough.md](walkthrough.md) (rebuild/verify runbook), [CICD.md](CICD.md) (AWS EC2 design, for later).

---

## Why 80+ builds failed

Every push to `main` fired **4 deploy workflows at once**, each against a target
that wasn't configured:

| Workflow | Was triggered by | Why it failed |
|---|---|---|
| `deploy-eks.yml` | every push to main | AWS OIDC role / ECR / EKS cluster not set up |
| `deploy.yml` (EC2/SSM) | every push to main | AWS OIDC role / `pde-app` instance not set up |
| `deploy-onpremise.yml` | every push to main | `ONPREMISE_*` SSH secrets missing |
| `deploy-render-netlify.yml` | every push to main | `NETLIFY_*` / `RENDER_*` secrets missing |

Plus two latent bugs that broke workflow *parsing* itself:
- `if: ${{ secrets.X != '' }}` — **the `secrets` context is not valid in `if:`
  conditionals** (GitHub rejects the workflow file → "Invalid workflow file" on
  every run). Fixed by mapping the secret to a step `env:` var and testing
  `if: env.X != ''`.

**Deleting failed runs was fine** — run history isn't needed. The triggers were the problem.

---

## Workflow Inventory (current state)

| Workflow | Trigger now | Target | Status |
|---|---|---|---|
| `ci.yml` | PR + push to main (auto) | — (gates only) | ✅ Active |
| `security-scan.yml` | PR + push to main + weekly cron | — | ✅ Active |
| `deploy-eks.yml` | **manual only** (`workflow_dispatch`) | EKS | ⏸ Paused |
| `deploy.yml` (EC2/SSM) | **manual only** | AWS EC2 | ⏸ Paused |
| `deploy-onpremise.yml` | **manual only** | On-prem SSH | ⏸ Paused |
| `deploy-render-netlify.yml` | **manual only** | Netlify/Render | ⏸ Paused |
| `build-and-push.yml` | `workflow_call` (invoked by EKS wf) | ECR | ⏸ Idle until EKS re-enabled |
| `smoke-test.yml` | **manual only** | ALB (EKS) | ⏸ Paused |

"Paused" = push trigger commented out with a re-enable note at the top of the file.
Nothing was deleted; re-enabling is a one-line change.
---

## Branch & Environment Strategy (isolation per deploy target)

> **Core rule: humans write `main`; automation writes `deploy/*`.
> Each environment's deploy tool watches exactly ONE branch.**

### Branch map

| Branch | Written by | Watched by | Purpose |
|---|---|---|---|
| `main` | Humans (PRs, CI required) | — | Source of truth: code + shared infra + all env overlays |
| `feat/*`, `fix/*`, `chore/*` | Humans, short-lived | — | Work branches; merge to `main` via PR |
| `deploy/local` | **Jenkins only** (bump commits, force-updated) | ArgoCD app `pde` (local kind) | Local dev deployment |
| `deploy/eks-staging` | Future EKS pipeline only | Future staging ArgoCD app | EKS staging |
| `deploy/eks-production` | Future EKS pipeline only | Future production ArgoCD app | EKS production |
| *(no branch)* | — | Netlify/Render webhooks | They build from a `main` SHA — platforms that build their own artifacts don't need deploy branches |

### Rules

1. **Never develop on `deploy/*` branches.** They are disposable pointers:
   automation force-updates the tip to `(main HEAD + env bump commit)` each build.
   Rollback = repoint the branch (or `git revert` the bump).
2. **Never deploy from a feature branch.** Deploy pipelines run from `main` HEAD;
   the env-specific values file (e.g. `values-local.yaml`) is the ONLY difference
   between environments — not different code.
3. **One env overlay per environment.** Already in the repo:
   `values-local.yaml` (kind) / `values-staging.yaml` / `values-production.yaml`
   (ECR registry, resources, secrets provider). Each ArgoCD app pins its overlay
   via `valueFiles` + its own `deploy/*` branch via `targetRevision`.
4. **Hotfix flow**: `fix/*` → PR → CI green → merge to `main` → dispatch the
   deploy pipeline for the target env. Same code path for every environment.
5. **Bump commits never touch `main`** — the Jenkins push targets
   `HEAD:deploy/local` (`--force`), so GitHub Actions CI is not re-triggered by
   deploys and main's history stays clean.

### Why not long-lived `develop` / `staging` / `prod` branches?

They cause drift ("prod branch is 3 weeks behind staging"), cherry-pick hell, and
merge conflicts between environments. The `deploy/*` pattern gives the same
isolation with zero drift: every environment is the *same* immutable `main` SHA
(encoded in the image tag) plus one config overlay. Environments can't interfere
because they never share a mutable branch — only a common ancestor.

### One-time setup for this repo

```bash
# Nothing to create manually — Jenkins creates deploy/local on its first push.
# (Optionally pre-create it so branch protection can reference it:)
git push origin main:refs/heads/deploy/local
```

Then in GitHub → Settings → Branches:
- `main`: require PR + require the `CI` checks (Backend/Frontend).
- `deploy/local` (and future `deploy/eks-*`): **restrict pushes to "Jenkins CI"**
  (the bot account holding `git-creds`) — humans cannot edit environment branches.

| `deploy.yml` (EC2/SSM) | **manual only** | AWS EC2 | ⏸ Paused |
| `deploy-onpremise.yml` | **manual only** | On-prem SSH | ⏸ Paused |
| `deploy-render-netlify.yml` | **manual only** | Netlify/Render | ⏸ Paused |
| `build-and-push.yml` | `workflow_call` (invoked by EKS wf) | ECR | ⏸ Idle until EKS re-enabled |
| `smoke-test.yml` | **manual only** | ALB (EKS) | ⏸ Paused |

"Paused" = push trigger commented out with a re-enable note at the top of the file.
Nothing was deleted; re-enabling is a one-line change.

---

## The Standard (follow this going forward)

### 1. One auto-triggered CI entry point
- `ci.yml` is the **only** workflow that auto-runs on push/PR: lint → format →
  compile → tests (with coverage) → frontend build.
- Do **not** add another workflow that runs tests on push. If a deploy workflow
  needs gates, gate it with `workflow_dispatch` and run tests *inside* it on demand.

### 2. Deploys never auto-run until the target is proven
- A deploy workflow earns its `push:` trigger only when:
  1. All required secrets exist in the repo, **and**
  2. A manual `workflow_dispatch` run has **passed end-to-end at least once**.
- Until then: `workflow_dispatch` only, trigger commented out, note at top of file.

### 3. Fail fast with actionable errors
- Every deploy job starts with a **secret guard** step that names the exact
  missing secrets and where to add them (`::error::Missing repo secrets: ...`)
  instead of a cryptic tool failure 3 minutes in.
- Pattern: map secrets to `env:` in the guard step, test the env vars — never
  use `secrets` in `if:`.

### 4. Noise control
- `concurrency: { group: <wf>-${{ github.ref }}, cancel-in-progress: true }` on
  workflows that race (CI already has it) — superseded runs cancel instead of
  piling up red Xs.
- `paths-ignore: ['**.md', 'local-k8s/**']` on push-triggered CI — docs and
  local-stack changes don't burn Actions minutes.

### 5. Secrets & auth
- Cloud auth uses **OIDC short-lived tokens** (`aws-actions/configure-aws-credentials`),
  never long-lived access keys (see CICD.md §6).
- Platform tokens (Netlify, Render hook) go in repo **secrets**, never in YAML.
- The GitHub PAT used by the *local* Jenkins push lives in Jenkins credentials
  (`git-creds`), not in Actions.

### 6. Division of labor (local-first)
```
GitHub Actions   →  VERIFY:   lint, test, build, security scan (cloud-side quality gate)
Jenkins (local)  →  BUILD:    docker build + push to local registry, tag bump
ArgoCD (local)   →  DEPLOY:   syncs kind cluster from the tag-bump commit (GitOps)
```
When you later move to a managed cluster (EKS/ECS/whatever), the split becomes:
Actions keeps verifying; the deploy workflow (already written, just paused)
takes over the GitOps trigger. Nothing needs rewriting.

### 7. Repo hygiene (do once in GitHub Settings)
- **Branch protection on `main`**: require a pull request + require the
  `Backend (lint + test)` and `Frontend (lint + build)` checks to pass.
- **Actions permissions**: keep default GITHUB_TOKEN `read` for contents.
- Old runs: GitHub auto-expires artifacts/logs per retention (default 90 days);
  no need to delete runs manually.

---

## How to re-enable a paused deploy target

1. Configure the secrets (names are listed in each workflow's guard step).
2. Run the workflow manually (`Actions → <name> → Run workflow`) and confirm it
   passes end-to-end.
3. Uncomment the `push:` trigger at the top of the file and commit.

## How to run a "deploy" today (local)

```powershell
cd C:\Users\Home\Desktop\project\PDE
# Build/rebuild Jenkins image, then trigger the `pde-local` job in Jenkins UI
# (http://localhost:8080) — full runbook in walkthrough.md.
```
