#!/usr/bin/env bash
set -euo pipefail

MANAGED_BY="openshift-gitops"
NAMESPACES=(
  gitops-demo-cicd
  gitops-demo-dev
  gitops-demo-test
  gitops-demo-prod
)

for ns in "${NAMESPACES[@]}"; do
  if ! oc get namespace "${ns}" >/dev/null 2>&1; then
    echo "Creating namespace ${ns}"
    oc create namespace "${ns}"
  fi

  echo "Labelling namespace ${ns} as managed by ${MANAGED_BY}"
  oc label namespace "${ns}" "argocd.argoproj.io/managed-by=${MANAGED_BY}" --overwrite
  oc label namespace "${ns}" app.kubernetes.io/part-of=openshift-lifecycle-demo --overwrite
done

echo
echo "Waiting for OpenShift GitOps Operator-created role bindings to appear..."
for ns in "${NAMESPACES[@]}"; do
  echo "--- ${ns}"
  oc get rolebinding -n "${ns}" | grep -E 'argocd|openshift-gitops' || true
done

echo
echo "Done. Refresh/sync the Argo CD applications after the role bindings are visible."
