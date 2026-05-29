#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 https://github.com/YOUR_ORG/openshift-lifecycle-quest.git [branch]"
  exit 1
fi

GIT_URL="$1"
GIT_REVISION="${2:-main}"
IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo manual)-$(date +%Y%m%d%H%M%S)"

cat <<EOF | oc create -f -
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
      value: ${GIT_URL}
    - name: git-revision
      value: ${GIT_REVISION}
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

echo "Started dev build with image tag ${IMAGE_TAG}"
