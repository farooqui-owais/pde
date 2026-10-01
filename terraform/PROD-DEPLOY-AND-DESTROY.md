# PDE Prod — Deployment Validation & Teardown Guide

> Reference copy of the pre-flight validation run and the destroy procedure for
> the `prod` branch / `terraform/environments/prod` stack.
> Validation state captured: `prod` @ `bdadbfb`, region `ap-south-1`.

---

## Part 1 — Validation results

| # | Check | Result |
|---|---|---|
| 1 | `prod` branch pushed to GitHub | ✅ `origin/prod` = `bdadbfb` (matches local) |
| 2 | `terraform fmt -check` | ✅ no formatting issues |
| 3 | `terraform validate` | ✅ *"Success! The configuration is valid."* |
| 4 | `repo_branch` in tfvars | ✅ fixed → `"prod"` (was `"main"`) |
| 5 | `ssh_ingress_cidr` in tfvars | ✅ fixed → `58.84.61.17/32` (deployer IP; was `0.0.0.0/0` = open to the world) |
| 6 | AWS credentials | ❌ **BLOCKED** — see below |
| 7 | EC2 key pair `pde-key` exists | ⚠️ can't verify until #6 is fixed |
| 8 | Full `terraform plan` | ⚠️ aborted because of #6 |

> The `tfvars` edit is intentionally **left uncommitted** — it contains a home
> IP and the repo is public. Terraform reads the file from disk, so deploys
> work either way. Commit only if making the IP public is acceptable.

## ❌ The blocker: AWS credentials invalid

A real `terraform plan` (read-only — creates nothing) failed with:

```text
Error: Retrieving AWS account details: ... StatusCode: 403,
api error InvalidClientTokenId: The security token included in the request is invalid.
```

**Plain English:** the access key in `C:\Users\Home\.aws\credentials` under
`[default]` is wrong, revoked or expired — AWS rejects it before Terraform can
even see the account. (The AWS CLI is also not installed, so `aws ...`
commands don't work yet — installing it fixes both at once.)

### Fix — pick one

**Option A — recommended: install AWS CLI + fresh credentials**

1. Install: `winget install Amazon.AWSCLI`
2. Open a **new** terminal, then: `aws configure`
3. Paste a valid **access key ID** + **secret access key** (region `ap-south-1`, output `json`).
   - Create one: AWS Console → **IAM → Users → you → Security credentials → Create access key**
     (root account → My security credentials also works).
   - Using **IAM Identity Center (SSO)** instead? Run `aws sso login` rather than `aws configure`.

**Option B — no CLI:** edit `C:\Users\Home\.aws\credentials` manually and
replace the bad `aws_access_key_id` / `aws_secret_access_key` lines under
`[default]` with a valid pair.

## Green-light sequence (run in this exact order)

```powershell
# 0. Fix credentials first (Option A/B above), then verify identity:
aws sts get-caller-identity
#    → must print your Account / UserId / Arn  ✅

# 1. Confirm the key pair exists (create it if step 1 errors):
aws ec2 describe-key-pairs --key-names pde-key --region ap-south-1
#    missing? create it:
#    aws ec2 create-key-pair --key-name pde-key --region ap-south-1 --query KeyMaterial --output text > pde-key.pem

# 2. THE dry run — creates nothing, must end with zero errors:
cd c:\Users\Home\Desktop\project\PDE\terraform\environments\prod
terraform plan
#    ✅ Green light = last lines say:
#       Plan: NNN to add, 0 to change, 0 to destroy
#    ❌ Red light = any "Error:" line → stop and investigate

# 3. Real deployment:
terraform apply
#    type: yes

# 4. Wait 10-15 minutes, then:
terraform output app_http_url        # open in browser
terraform output api_health_check    # should return {"status": ...}
```

For a **public** repo no `-var repo_url=...` is needed — the variable default
`https://github.com/farooqui-owais/pde.git` applies automatically. Never put a
token in `tfvars`; pass a token URL on the command line only if the repo ever
goes private.

---


## Part 2 — Test checklist (after apply)

1. `http://<ip>/api/health` → JSON response (timeout = still bootstrapping, wait more)
2. `http://<ip>` → login page loads with styles
3. Register → login → dashboard opens
4. App problems? `ssh -i pde-key.pem ec2-user@<ip>` → `cat /var/log/user-data.log`

---

## Part 3 — Delete EVERYTHING after testing (success *or* failure)

Terraform knows what it created because of one file:
**`terraform/environments/prod/terraform.tfstate`** (local — `backend.tf` is
commented out).

> ### ⚠️ Golden rule
> **Never delete `terraform.tfstate` or the `prod` folder before running
> destroy.** Destroy reads that file to know what to delete. Delete it first
> and Terraform forgets everything — you end up removing resources by hand in
> the AWS console. Same if you ever apply from CI: run destroy from wherever
> the state lives.

Two gotchas in this config would make a naive `terraform destroy` fail, so the
easy path is 3 steps:

```powershell
cd c:\Users\Home\Desktop\project\PDE\terraform\environments\prod

# STEP 1 — turn off RDS deletion protection first.
# (prod tfvars sets deletion_protection=true; AWS refuses to delete a
#  protected database, so a plain destroy would die halfway.)
terraform apply -var deletion_protection=false
#    → type yes. Only flips a flag on the DB (~1 min), no rebuild.

# STEP 2 — preview the blast radius (optional but satisfying):
terraform plan -destroy
#    → lists every resource that will be removed

# STEP 3 — delete it all:
terraform destroy
#    → type yes
#    ✅ Done looks like: "Destroy complete! Resources: NN destroyed."
```

Works the same whether the test **succeeded** or **failed halfway** — a failed
`apply` still records whatever it created in the state file, and `destroy`
cleans up exactly that. If the first apply died before creating anything,
steps 1 and 3 report "no changes" — nothing to clean.

### Possible destroy errors and the 10-second fix

| Error | Fix |
|---|---|
| `Cannot delete protected DB Instance` | Step 1 didn't finish — re-run `terraform apply -var deletion_protection=false`, then destroy again |
| `Error deleting S3 bucket ... bucket is not empty` | *By design* (`force_destroy = false` — test data is deliberately kept). Empty it in **S3 console → bucket → Empty**, then re-run `terraform destroy` |

> With deletion protection off the DB is deleted **without** a final snapshot —
> fine for a test run. To keep prod data, take a manual snapshot first
> (RDS → Actions → Take snapshot).

### What destroy intentionally leaves behind (and how to remove it)

| Leftover | Cost | Remove how |
|---|---|---|
| S3 artifacts bucket (if it had files) | ~0 if emptied | S3 console → Empty → Delete |
| EC2 key pair `pde-key` (created manually, Terraform never owned it) | Free | EC2 → Key pairs → Delete (keep it for the next deploy) |
| RDS manual snapshots, if created | Small storage fee | RDS → Snapshots → Delete |
| Local `terraform.tfstate` (records 0 resources) | — | Keep it, or delete `.terraform/` + `terraform.tfstate` **only after** destroy succeeded |

### Prove nothing is left in AWS

```powershell
terraform state list
# ✅ empty output = Terraform manages zero resources anymore
```

Then eyeball the AWS console (**region ap-south-1**):

- **EC2 → Instances**: no instances (app server gone)
- **RDS → Databases**: no `pde-prod-postgres`
- **VPC**: `10.20.0.0/16` VPC gone (only Default VPC remains)
- **CloudWatch → Log groups / Alarms**: `/pde/...` entries gone
- **SSM → Parameter Store**: `/pde/pde-prod/...` parameters gone
- **IAM → Roles**: `pde-prod-*` roles gone
- **Billing → Cost Explorer**: nothing accruing (EIP releases with the instance; a stopped EC2 or idle RDS would still bill — that's what destroy prevents)

---

## Day-2 cheat sheet

| Task | Command |
|---|---|
| Redeploy app code | push to `prod`, then on the instance: `sudo /opt/pde/deploy-cd.sh` |
| Infra change | edit tfvars → `terraform apply` |
| Preview changes | `terraform plan` |
| Full teardown | `terraform apply -var deletion_protection=false` → `terraform destroy` |

