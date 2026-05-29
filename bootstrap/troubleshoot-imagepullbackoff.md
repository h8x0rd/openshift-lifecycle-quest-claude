# Troubleshooting ImagePullBackOff for the bootstrap image

The first Argo CD sync may create the dev Deployment before the development
pipeline has pushed an image. If the pod tries to pull `:bootstrap` and the
registry says `manifest unknown`, the tag does not exist yet.

Check which tags exist:

```bash
oc get imagestream lifecycle-quest -n gitops-demo-dev \
  -o jsonpath='{range .status.tags[*]}{.tag}{"\n"}{end}'
```

If the pipeline pushed an immutable tag but Argo CD is still deploying
`bootstrap`, force a Git refresh/sync:

```bash
oc -n openshift-gitops annotate application lifecycle-quest-dev \
  argocd.argoproj.io/refresh=hard --overwrite
```

If you need an immediate bootstrap alias, replace `<tag>` with one of the
existing image tags:

```bash
oc tag gitops-demo-dev/lifecycle-quest:<tag> \
  gitops-demo-dev/lifecycle-quest:bootstrap
```

Then restart the failed pod:

```bash
oc delete pod -n gitops-demo-dev -l app.kubernetes.io/name=lifecycle-quest
```
