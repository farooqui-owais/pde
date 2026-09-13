# Branch Protection Rules for `main`

The following branch protection rules must be configured for the `main` branch to ensure code quality and stability.

## Requirements

1. **Require pull request reviews before merging**
   - Minimum number of approvals: 1
   - Dismiss stale pull request approvals when new commits are pushed
   - Require review from Code Owners

2. **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Status checks that are required:
     - `Backend (lint + test)`
     - `Frontend (lint + build)`

3. **Require linear history**
   - Prevent merge commits from being pushed to matching branches

4. **Block force pushes**
   - Prevent force pushes to matching branches

## Configuration via GitHub CLI

To apply these settings programmatically using the GitHub CLI (`gh`), run:

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github.v3+json" \
  /repos/farooqui-owais/pde/branches/main/protection \
  -F "required_status_checks[strict]=true" \
  -F "required_status_checks[contexts][]=Backend (lint + test)" \
  -F "required_status_checks[contexts][]=Frontend (lint + build)" \
  -F "enforce_admins=false" \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=true" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "restrictions=null" \
  -F "required_linear_history=true" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"
```
