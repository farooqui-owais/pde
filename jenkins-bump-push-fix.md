# Fix: "Bump & Push" Stage vs Branch Protection on `main`

## Root cause chain (for reference)

1. Jenkins pushed directly to `main` → GitHub returned `403`.
2. Branch protection on `main` now requires PR review + passing status checks (`Backend (lint + test)`, `Frontend (lint + build)`) + linear history.
3. `enforce_admins=false` and `restrictions=null` mean there is **no bypass path** for a bot token pushing straight to `main` — it must go through a PR.
4. Conclusion: the "Bump & Push" stage's *design* (direct push) is now structurally incompatible with the repo's rules. The token being correctly scoped will not fix this — the workflow itself has to change to PR-based.

This doc replaces the direct-push logic with a PR-based flow that satisfies all four protection rules, including linear history (via squash merge) and required status checks (by waiting for them before merging).

---

## Prerequisites — verify these before deploying the fix

I'm not certain these match your exact setup, so confirm each:

- [ ] `gh` CLI is installed on the Jenkins agent image (`gh --version`). If not, this needs to be added to the build image or installed in a `sh` step.
- [ ] The Jenkins credential (`git-creds`, per your earlier pipeline output) is a **PAT belonging to an account that has at least Write access** to `farooqui-owais/pde` — confirmed via the earlier `curl https://api.github.com/user` check.
- [ ] That same token has the `repo` scope (classic PAT) or `Contents: Read & Write` + `Pull requests: Read & Write` (fine-grained PAT) — a PR-based flow additionally needs pull-request permissions, which a pure-push flow didn't.
- [ ] Auto-merge is enabled at the **repository level** (Settings → General → "Allow auto-merge"). `gh pr merge --auto` silently fails if this is off.
- [ ] Your required status check names (`Backend (lint + test)`, `Frontend (lint + build)`) exactly match the job/context names Jenkins reports to GitHub — mismatched names mean the PR will wait forever for a check that never reports under that exact string.

---

## Replacement Jenkinsfile stage

```groovy
stage('Bump & Push') {
    steps {
        withCredentials([usernamePassword(credentialsId: 'git-creds', usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
            sh '''
                set -e

                # --- Config ---
                REPO="farooqui-owais/pde"
                BASE_BRANCH="main"
                BUMP_BRANCH="ci/version-bump-${BUILD_NUMBER}"

                # --- Auth for both git and gh ---
                git config --global user.email "ci-bot@yourdomain.com"
                git config --global user.name "CI Bot"
                echo "${GIT_TOKEN}" | gh auth login --with-token

                # --- Create a dedicated branch instead of committing to main ---
                git checkout -b "${BUMP_BRANCH}"

                # --- YOUR EXISTING VERSION BUMP LOGIC GOES HERE ---
                # e.g.:
                #   npm version patch --no-git-tag-version
                #   python bump_version.py
                # Replace the line below with whatever your current stage does.
                echo "TODO: run actual bump command here"

                # --- Commit only if there are changes ---
                if git diff --quiet && git diff --cached --quiet; then
                    echo "No version changes to commit — skipping push/PR."
                    exit 0
                fi

                git commit -am "chore: bump version [ci skip build-loop]"

                # --- Push the branch (NOT main) ---
                git push "https://${GIT_USER}:${GIT_TOKEN}@github.com/${REPO}.git" "${BUMP_BRANCH}"

                # --- Open PR ---
                PR_URL=$(gh pr create \\
                    --repo "${REPO}" \\
                    --base "${BASE_BRANCH}" \\
                    --head "${BUMP_BRANCH}" \\
                    --title "chore: automated version bump (build ${BUILD_NUMBER})" \\
                    --body "Automated version bump from Jenkins build ${BUILD_NUMBER}. Will auto-merge once required checks pass." \\
                    --label "automated")

                echo "Opened PR: ${PR_URL}"

                # --- Enable auto-merge (squash, to satisfy required_linear_history) ---
                gh pr merge "${PR_URL}" --squash --auto --repo "${REPO}"

                echo "Auto-merge enabled. PR will merge automatically once Backend and Frontend checks pass."
            '''
        }
    }
}
```

### Why each piece is there

| Line/block | Reason |
|---|---|
| `git checkout -b "${BUMP_BRANCH}"` | Replaces direct commits to `main`, which the protection rules now block for non-admin tokens. |
| Unique branch name per `BUILD_NUMBER` | Avoids collisions if multiple builds run concurrently or a previous bump PR is still open. |
| Exit early if no diff | Prevents opening empty PRs on builds where nothing actually changed version-wise. |
| `gh pr create` | Satisfies rule #1 (PR required before merging). |
| `--squash` on merge | Satisfies rule #3 (linear history) — squash produces a single commit on `main`, no merge commit. |
| `gh pr merge --auto` | Satisfies rule #2 without a human clicking merge — GitHub holds the merge until required checks (`Backend (lint + test)`, `Frontend (lint + build)`) report success, then merges automatically. |
| No `--admin` flag on merge | Deliberately *not* bypassing review — if you actually want CI to skip human review entirely, that's a policy decision, not a technical fix, and I'd flag that as risky to automate blindly. |

---

## Important gap I can't resolve for you

Your protection rules require **1 approving review from a Code Owner**. `gh pr merge --auto` will **not** bypass that — the PR will sit unmerged until a human (or a bot with review permissions acting as a second identity) approves it. This is very likely intentional given the rules you configured, but it means:

- **Fully unattended version-bump-and-release pipelines are not possible** under these exact rules, unless you either:
  1. Add a second bot identity that reviews/approves the first bot's PRs (common pattern: "release-bot" opens, "release-bot-reviewer" approves), or
  2. Carve out an exception (e.g. a `bump-version` label that a branch protection ruleset exempts from review — GitHub's newer "Rulesets" feature supports bypass lists per actor, unlike the classic protection API you used), or
  3. Accept that a human clicks "Approve" on these PRs.

I'm not fully certain which of these fits your intended workflow — do you want the version bump to be fully automatic (no human in the loop), or is a human approval step actually acceptable/desired here? That decides which of the three options above to implement next.
