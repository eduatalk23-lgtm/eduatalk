#!/bin/bash
#
# 예약 메시지 로컬 발송 테스트 스크립트
#
# pg_cron은 프로덕션 Vercel URL만 호출하므로,
# 로컬 개발 시 이 스크립트로 수동 발송 트리거합니다.
#
# 사용법:
#   ./scripts/trigger-scheduled-messages.sh          # 1회 실행
#   ./scripts/trigger-scheduled-messages.sh --watch   # 매분 반복 실행
#

set -euo pipefail

PORT="${PORT:-3000}"
BASE_URL="http://localhost:${PORT}"
ENDPOINT="/api/cron/send-scheduled-messages"

# .env.local에서 CRON_SECRET 읽기
ENV_FILE="$(dirname "$0")/../.env.local"
if [ -f "$ENV_FILE" ]; then
  CRON_SECRET=$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d '=' -f 2-)
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "❌ CRON_SECRET이 설정되지 않았습니다. .env.local에 추가해주세요."
  exit 1
fi

trigger_once() {
  local timestamp
  timestamp=$(date '+%H:%M:%S')

  echo -n "[${timestamp}] 예약 메시지 발송 트리거... "

  response=$(curl -s -w "\n%{http_code}" \
    "${BASE_URL}${ENDPOINT}" \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    2>&1)

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "200" ]; then
    echo "✅ ${body}"
  else
    echo "❌ HTTP ${http_code}: ${body}"
  fi
}

if [ "${1:-}" = "--watch" ]; then
  echo "🔄 매분 반복 실행 모드 (Ctrl+C로 종료)"
  echo "   대상: ${BASE_URL}${ENDPOINT}"
  echo ""
  while true; do
    trigger_once
    sleep 60
  done
else
  echo "📨 예약 메시지 발송 트리거 (1회)"
  echo "   대상: ${BASE_URL}${ENDPOINT}"
  echo ""
  trigger_once
fi
