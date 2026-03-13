#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/apk-out"
OLA_MAPS_API_KEY="${EXPO_PUBLIC_OLA_MAPS_API_KEY:-}"
OLA_MAPS_CLIENT_ID="${EXPO_PUBLIC_OLA_MAPS_CLIENT_ID:-}"
OLA_MAPS_CLIENT_SECRET="${EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET:-}"
SOCKET_URL="${EXPO_PUBLIC_SOCKET_URL:-https://superheroorealtime.onrender.com}"
API_BASE="${EXPO_PUBLIC_API_BASE_URL:-https://api.mysuperhero.xyz}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"

if [[ -z "${OLA_MAPS_API_KEY}" && ( -z "${OLA_MAPS_CLIENT_ID}" || -z "${OLA_MAPS_CLIENT_SECRET}" ) ]]; then
  echo "ERROR: set EXPO_PUBLIC_OLA_MAPS_API_KEY or both EXPO_PUBLIC_OLA_MAPS_CLIENT_ID + EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET"
  exit 1
fi

mkdir -p "${OUT_DIR}"
cd "${ROOT_DIR}"

build_one() {
  local app_variant="$1"
  local image_tag="$2"
  local apk_name="$3"

  echo "==> Building ${app_variant} app"
  if [[ -n "${DOCKER_PLATFORM}" ]]; then
    docker build --platform="${DOCKER_PLATFORM}" \
      -f Dockerfile.apk \
      -t "${image_tag}" \
      --build-arg APK_VARIANT=release \
      --build-arg EXPO_PUBLIC_API_BASE_URL="${API_BASE}" \
      --build-arg EXPO_PUBLIC_SOCKET_URL="${SOCKET_URL}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_API_KEY="${OLA_MAPS_API_KEY}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_CLIENT_ID="${OLA_MAPS_CLIENT_ID}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET="${OLA_MAPS_CLIENT_SECRET}" \
      --build-arg EXPO_PUBLIC_DEV_SHOW_OTP=true \
      --build-arg EXPO_PUBLIC_APP_VARIANT="${app_variant}" \
      .
  else
    docker build \
      -f Dockerfile.apk \
      -t "${image_tag}" \
      --build-arg APK_VARIANT=release \
      --build-arg EXPO_PUBLIC_API_BASE_URL="${API_BASE}" \
      --build-arg EXPO_PUBLIC_SOCKET_URL="${SOCKET_URL}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_API_KEY="${OLA_MAPS_API_KEY}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_CLIENT_ID="${OLA_MAPS_CLIENT_ID}" \
      --build-arg EXPO_PUBLIC_OLA_MAPS_CLIENT_SECRET="${OLA_MAPS_CLIENT_SECRET}" \
      --build-arg EXPO_PUBLIC_DEV_SHOW_OTP=true \
      --build-arg EXPO_PUBLIC_APP_VARIANT="${app_variant}" \
      .
  fi

  local container_name="${image_tag}-export"
  docker create --name "${container_name}" "${image_tag}" /bin/true >/dev/null
  docker cp "${container_name}:/out/${apk_name}" "${OUT_DIR}/${apk_name}"
  docker rm "${container_name}" >/dev/null
}

build_one buyer superheroo-citizen-apk-release Superheroo-Citizen-release.apk
build_one helper superheroo-partner-apk-release Superheroo-Partner-release.apk

echo "==> Done"
echo "Citizen APK: ${OUT_DIR}/Superheroo-Citizen-release.apk"
echo "Partner APK: ${OUT_DIR}/Superheroo-Partner-release.apk"
