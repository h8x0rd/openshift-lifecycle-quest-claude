#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 https://github.com/YOUR_ORG/openshift-lifecycle-quest.git"
  exit 1
fi

REPO_URL="$1"

find argocd examples -type f \( -name '*.yaml' -o -name '*.yml' \) -print0 \
  | xargs -0 sed -i "s#REPLACE_ME_GIT_REPO_URL#${REPO_URL}#g"

echo "Updated Argo CD Applications and example PipelineRuns to use ${REPO_URL}"
