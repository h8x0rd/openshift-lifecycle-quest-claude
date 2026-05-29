#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 https://github.com/YOUR_ORG/openshift-lifecycle-quest.git SOURCE_ENV TARGET_ENV [branch]"
  echo "Example: $0 https://github.com/acme/openshift-lifecycle-quest.git dev test main"
  exit 1
fi

GIT_URL="$1"
SOURCE_ENV="$2"
TARGET_ENV="$3"
GIT_REVISION="${4:-main}"

cat <<EOF | oc create -f -
apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: lifecycle-quest-promote-${SOURCE_ENV}-${TARGET_ENV}-
  namespace: gitops-demo-cicd
spec:
  pipelineRef:
    name: lifecycle-quest-promote
  serviceAccountName: pipeline
  params:
    - name: git-url
      value: ${GIT_URL}
    - name: git-revision
      value: ${GIT_REVISION}
    - name: source-environment
      value: ${SOURCE_ENV}
    - name: target-environment
      value: ${TARGET_ENV}
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

echo "Started promotion ${SOURCE_ENV} -> ${TARGET_ENV}"
