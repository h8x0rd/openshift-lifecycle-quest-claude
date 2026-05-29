# One-time GitOps namespace bootstrap

OpenShift GitOps needs Kubernetes RBAC in each namespace that a namespace-scoped Argo CD instance manages.

For the default `openshift-gitops` Argo CD instance, label each managed namespace with:

```bash
oc label namespace <namespace> argocd.argoproj.io/managed-by=openshift-gitops --overwrite
```

The Red Hat OpenShift GitOps Operator watches this label and creates the required role bindings for the Argo CD controller/server components.

Run this once after namespace creation if Argo CD reports `services is forbidden`, `deployments.apps is forbidden`, or `routes.route.openshift.io is forbidden`.

```bash
./bootstrap/label-managed-namespaces.sh
```

The same labels are also kept in `config/platform/base/namespaces.yaml` so Git remains the source of truth after the initial bootstrap.
