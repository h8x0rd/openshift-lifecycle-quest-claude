# OpenShift Lifecycle Quest

A small, fun demo application for showing **OpenShift Pipelines + OpenShift GitOps** working together across **development**, **test**, and **production**.

The important pattern is:

1. **OpenShift Pipelines builds and tests the app**.
2. The development pipeline builds a container image and pushes it to the **OpenShift internal image registry**.
3. The pipeline updates the GitOps overlay in Git with the immutable image tag.
4. **OpenShift GitOps / Argo CD reconciles the cluster** from Git.
5. Promotion to test and production is done by a separate promotion pipeline that copies the approved image tag from one overlay to the next.

This is deliberately GitOps-first: the pipeline does **not** deploy the app directly with `oc apply`.

---

## What the demo creates

| Area | Namespace | Purpose |
|---|---:|---|
| CI/CD | `gitops-demo-cicd` | Tekton pipelines, tasks, service account |
| Development | `gitops-demo-dev` | Dev deployment and internal registry ImageStream |
| Test | `gitops-demo-test` | Test deployment |
| Production | `gitops-demo-prod` | Production deployment |

The application is a Node.js web app called **Lifecycle Quest**. It includes:

- a stage banner showing dev/test/prod,
- a release “quest meter”,
- clickable confetti,
- a mini deployment checklist,
- `/healthz` and `/api/info` endpoints for probes and demos.

---

## Prerequisites

You need:

- OpenShift 4.x cluster access as a user who can create projects, Argo CD Applications, Routes, RBAC, and Pipeline resources.
- Red Hat OpenShift GitOps installed.
- Red Hat OpenShift Pipelines installed.
- A Git repository containing this directory.
- A Git token or Git credential with permission to push back to this repository.
- Access to pull the task images used by the demo.

The sample Buildah task uses a privileged build pod for demo simplicity. For production, replace it with a hardened non-root Buildah configuration, Tekton Chains signing, policy checks, and your organisation’s approved builder images.

---

## Repository layout

```text
.
├── app/                         # Node.js demo app and Containerfile
├── argocd/                      # Argo CD app-of-apps and child Applications
├── config/
│   ├── apps/                    # Kustomize base + dev/test/prod overlays
│   ├── operators/               # Optional Operator subscriptions for reference
│   └── platform/                # Namespaces, RBAC, pipelines and tasks
├── examples/pipelineruns/       # Manual PipelineRun examples, not auto-synced
└── scripts/                     # Helper scripts
```

---

## 1. Set your Git repository URL

Before pushing this repository, replace the placeholder URL used by Argo CD and the example PipelineRuns:

```bash
./scripts/set-repo-url.sh https://github.com/YOUR_ORG/openshift-lifecycle-quest.git

git add .
git commit -m "Configure repo URL for lifecycle demo"
git push
```

---

## 2. Bootstrap the Argo CD app-of-apps

This is the one bootstrap action. After this, Argo CD owns the platform, pipelines and app environments.

```bash
oc apply -f argocd/app-of-apps.yaml
```

Check sync status:

```bash
oc get applications.argoproj.io -n openshift-gitops
```

Expected applications:

- `lifecycle-quest-root`
- `lifecycle-quest-platform`
- `lifecycle-quest-dev`
- `lifecycle-quest-test`
- `lifecycle-quest-prod`

---

## 3. Create Git credentials for the pipeline

Do **not** commit real credentials to Git. Create this Secret manually, or replace it with Sealed Secrets, External Secrets, Vault, or your preferred secret manager.

```bash
oc -n gitops-demo-cicd create secret generic git-credentials \
  --from-literal=username='YOUR_GIT_USERNAME' \
  --from-literal=token='YOUR_GIT_TOKEN'
```

The pipeline uses this credential only to push the Kustomize image tag change back to the repo.

---

## 4. Run the development build pipeline

This pipeline clones the repo, runs the Node.js tests, builds the container image, pushes it to the OpenShift internal registry, and updates the `dev` overlay in Git.

```bash
IMAGE_TAG="$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"

oc create -f - <<EOF
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: lifecycle-quest-dev-build-
  namespace: gitops-demo-cicd
spec:
  pipelineRef:
    name: lifecycle-quest-dev-build
  serviceAccountName: pipeline
  params:
    - name: git-url
      value: https://github.com/YOUR_ORG/openshift-lifecycle-quest.git
    - name: git-revision
      value: main
    - name: image-repository
      value: image-registry.openshift-image-registry.svc:5000/gitops-demo-dev/lifecycle-quest
    - name: image-tag
      value: ${IMAGE_TAG}
  workspaces:
    - name: shared-workspace
      volumeClaimTemplate:
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 1Gi
EOF
```

Watch the pipeline:

```bash
tkn pipelinerun list -n gitops-demo-cicd
tkn pipelinerun logs -n gitops-demo-cicd -L -f
```

After the pipeline pushes to Git, Argo CD should sync the dev app automatically.

```bash
oc get route lifecycle-quest -n gitops-demo-dev
```

### First-run image pull note

The initial dev overlay starts with `newTag: bootstrap`. The development
pipeline pushes both the immutable image tag and a temporary `bootstrap` alias,
then commits the immutable tag back to the dev overlay. If a pod is created
before the first build finishes, it may briefly show `ImagePullBackOff` until
the pipeline has pushed the first image and Argo CD has synced the updated tag.

Troubleshooting commands are in `bootstrap/troubleshoot-imagepullbackoff.md`.


---

## 5. Promote dev to test

Promotion copies the image tag from `config/apps/overlays/dev/kustomization.yaml` to `config/apps/overlays/test/kustomization.yaml` and pushes that change to Git.

```bash
oc create -f examples/pipelineruns/promote-dev-to-test.yaml
```

Then check the test Route:

```bash
oc get route lifecycle-quest -n gitops-demo-test
```

---

## 6. Promote test to production

```bash
oc create -f examples/pipelineruns/promote-test-to-prod.yaml
```

Then check the production Route:

```bash
oc get route lifecycle-quest -n gitops-demo-prod
```

---

## Demo talking points

Use these during the demo:

### GitOps ownership boundary

- Pipelines build, test, scan and update Git.
- Argo CD deploys what is declared in Git.
- Drift is corrected by Argo CD self-healing.

Try this:

```bash
oc scale deployment/lifecycle-quest -n gitops-demo-prod --replicas=0
```

Argo CD should restore the desired state.

### Promotion by immutable image tag

- Dev pipeline writes a unique image tag.
- Test and production receive exactly the same image tag through promotion.
- No rebuild happens during promotion.

### Environment differences through overlays

- Dev has one replica and a playful message.
- Test has two replicas.
- Production has three replicas and stricter resource settings.

### Internal registry and namespace isolation

- Images are built into `gitops-demo-dev`.
- Test and production service accounts receive `system:image-puller` permission from the dev namespace.

---

## Clean-up

```bash
oc delete application lifecycle-quest-root -n openshift-gitops
oc delete application lifecycle-quest-platform lifecycle-quest-dev lifecycle-quest-test lifecycle-quest-prod -n openshift-gitops --ignore-not-found
oc delete project gitops-demo-cicd gitops-demo-dev gitops-demo-test gitops-demo-prod
```

---

## Production hardening ideas

For a real implementation, add:

- Tekton Chains image signing and provenance.
- ACS image scanning and deployment checks.
- SBOM generation.
- SLSA-style build metadata.
- Pull-through or enterprise registry such as Quay.
- Sealed Secrets, External Secrets, or Vault.
- Argo CD Projects with tighter source/destination restrictions.
- Manual approval or change-management integration before production promotion.
- Progressive delivery using OpenShift Service Mesh, Argo Rollouts, or weighted Routes.

## Troubleshooting: Argo CD cannot create Services, Deployments, or Routes

If an application reports an error similar to:

```text
services is forbidden: User "system:serviceaccount:openshift-gitops:openshift-gitops-argocd-application-controller" cannot create resource "services"
```

then the default Argo CD instance does not yet have Kubernetes RBAC in the target namespace. Label the managed namespaces so the OpenShift GitOps Operator creates the required role bindings:

```bash
./bootstrap/label-managed-namespaces.sh
```

Equivalent manual commands:

```bash
oc label namespace gitops-demo-cicd argocd.argoproj.io/managed-by=openshift-gitops --overwrite
oc label namespace gitops-demo-dev  argocd.argoproj.io/managed-by=openshift-gitops --overwrite
oc label namespace gitops-demo-test argocd.argoproj.io/managed-by=openshift-gitops --overwrite
oc label namespace gitops-demo-prod argocd.argoproj.io/managed-by=openshift-gitops --overwrite
```

After the labels are set, refresh/sync the Argo CD applications. The namespace labels are also declared in `config/platform/base/namespaces.yaml` so Git remains the source of truth.
