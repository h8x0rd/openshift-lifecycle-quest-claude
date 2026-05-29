# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A demo of **OpenShift Pipelines (Tekton) + OpenShift GitOps (Argo CD)** working together. The pipeline builds, tests, and pushes a container image, then updates a Kustomize overlay in Git. Argo CD reconciles the cluster from Git. Promotion between environments is done by a separate pipeline that copies the image tag from one overlay to the next — no rebuild happens.

The app itself (`app/`) is a minimal Node.js HTTP server with no npm dependencies.

## App commands

Run from `app/`:

```bash
npm test          # node --test tests/*.test.js  (Node.js built-in test runner)
npm start         # node server.js  (listens on PORT, default 8080)
```

Environment variables read by the server: `PORT` (default `8080`), `APP_ENV`, `APP_VERSION`, `MESSAGE`.

## First-time cluster setup

1. Replace the placeholder repo URL in all Argo CD and example YAML files:
   ```bash
   ./scripts/set-repo-url.sh https://github.com/YOUR_ORG/openshift-lifecycle-quest.git
   ```
2. Bootstrap Argo CD's app-of-apps (one-time manual apply):
   ```bash
   oc apply -f argocd/app-of-apps.yaml
   ```
3. Create the Git credentials Secret for the pipeline to push back to the repo:
   ```bash
   oc -n gitops-demo-cicd create secret generic git-credentials \
     --from-literal=username='...' --from-literal=token='...'
   ```
4. If Argo CD reports RBAC errors, label the namespaces:
   ```bash
   ./bootstrap/label-managed-namespaces.sh
   ```

## Running pipelines

```bash
# Trigger a dev build
./scripts/run-dev-pipeline.sh https://github.com/YOUR_ORG/openshift-lifecycle-quest.git

# Promote dev → test
./scripts/promote.sh https://github.com/YOUR_ORG/openshift-lifecycle-quest.git dev test

# Promote test → prod
./scripts/promote.sh https://github.com/YOUR_ORG/openshift-lifecycle-quest.git test prod

# Watch pipeline progress
tkn pipelinerun list -n gitops-demo-cicd
tkn pipelinerun logs -n gitops-demo-cicd -L -f
```

## Architecture

### GitOps split: pipelines write Git, Argo CD deploys

Pipelines never run `oc apply` directly. They update `images[].newTag` in the appropriate Kustomize overlay and push to Git. Argo CD detects the commit and reconciles the cluster. This boundary is intentional.

### Namespace layout

| Namespace | Purpose |
|---|---|
| `gitops-demo-cicd` | Tekton pipelines, tasks, service account, git-credentials Secret |
| `gitops-demo-dev` | Dev deployment; also hosts the internal ImageStream |
| `gitops-demo-test` | Test deployment |
| `gitops-demo-prod` | Production deployment |

Images are always pulled from `gitops-demo-dev`'s internal registry. The test and prod service accounts receive `system:image-puller` on that namespace via `config/platform/base/image-puller-rbac.yaml`.

### Kustomize overlay structure

```
config/apps/
  base/               # Deployment, Service, Route
  overlays/
    dev/              # 1 replica, dev env vars, newTag written by pipeline
    test/             # 2 replicas, test env vars
    prod/             # 3 replicas, prod env vars, stricter resources
```

Each overlay's `kustomization.yaml` contains an `images` block. The `newTag` field in that block is the only thing the pipeline modifies during a build or promotion.

The `bootstrap` tag is the initial placeholder. Dev overlay starts as `newTag: bootstrap`; the first pipeline run replaces it with an immutable tag of the form `<git-short-sha>-<timestamp>`.

### Argo CD app-of-apps

`argocd/app-of-apps.yaml` creates `lifecycle-quest-root`, which manages `argocd/applications/`. That directory contains child Applications:
- `lifecycle-quest-platform` — deploys `config/platform/` (namespaces, RBAC, ImageStream, pipelines, tasks)
- `lifecycle-quest-dev/test/prod` — deploy `config/apps/overlays/<env>/`

All applications use `automated.selfHeal: true`, so manual cluster changes are reverted.

### Tekton pipeline flow

**Dev build** (`lifecycle-quest-dev-build`):
`git-clone-simple` → `npm-test` → `buildah-build-push` → `update-gitops-image`

**Promotion** (`lifecycle-quest-promote`):
`git-clone-simple` → `promote-gitops-image`

All pipeline tasks are defined under `config/platform/base/pipelines/tasks/` and deployed by Argo CD (not applied manually).

### Container image

Built from `app/Containerfile` using `ubi9/nodejs-20`. Runs as UID 1001. No dependencies (`npm install` is a no-op).
