#!/usr/bin/env bash

set -euo pipefail

REGISTRY="http://192.168.66.12:5000"
REGISTRY_HOST="192.168.66.12:5000"
DEFAULT_IMAGE_PREFIX="rag"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/push-local-registry.sh <tag>
  ./scripts/push-local-registry.sh --tag <tag>

Optional environment variables:
  REGISTRY_HOST=192.168.66.12:5000
  IMAGE_PREFIX=rag

Examples:
  ./scripts/push-local-registry.sh v1.0.0
  IMAGE_PREFIX=myteam ./scripts/push-local-registry.sh --tag 2026-05-11

This script builds the local application image once, tags it for both runtime roles,
and pushes these images to the local registry:
  <registry>/<prefix>-ingestor-app:<tag>
  <registry>/<prefix>-ingestor-worker:<tag>
EOF
}

TAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      if [[ $# -lt 2 ]]; then
        echo "error: --tag requires a value" >&2
        usage
        exit 1
      fi
      TAG="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$TAG" ]]; then
        TAG="$1"
        shift
      else
        echo "error: unexpected argument '$1'" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$TAG" ]]; then
  echo "error: missing tag" >&2
  usage
  exit 1
fi

REGISTRY_HOST="${REGISTRY_HOST:-$REGISTRY_HOST}"
IMAGE_PREFIX="${IMAGE_PREFIX:-$DEFAULT_IMAGE_PREFIX}"

APP_IMAGE="${REGISTRY_HOST}/${IMAGE_PREFIX}-ingestor-app:${TAG}"
WORKER_IMAGE="${REGISTRY_HOST}/${IMAGE_PREFIX}-ingestor-worker:${TAG}"
LOCAL_BUILD_IMAGE="${IMAGE_PREFIX}-ingestor-build:${TAG}"

echo "Registry: ${REGISTRY}"
echo "Target app image: ${APP_IMAGE}"
echo "Target worker image: ${WORKER_IMAGE}"

docker build -t "${LOCAL_BUILD_IMAGE}" .
docker tag "${LOCAL_BUILD_IMAGE}" "${APP_IMAGE}"
docker tag "${LOCAL_BUILD_IMAGE}" "${WORKER_IMAGE}"

docker push "${APP_IMAGE}"
docker push "${WORKER_IMAGE}"

echo "Push complete."
echo "App image: ${APP_IMAGE}"
echo "Worker image: ${WORKER_IMAGE}"