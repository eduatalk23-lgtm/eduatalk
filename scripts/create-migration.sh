#!/bin/bash
# 마이그레이션 파일 생성 스크립트
# 정확한 타임스탬프를 사용하여 마이그레이션 파일을 생성합니다.

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Supabase 마이그레이션 파일 생성 ===${NC}"
echo ""

# 1. 마지막 마이그레이션 파일 확인
MIGRATIONS_DIR="supabase/migrations"
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo -e "${RED}✗ 마이그레이션 디렉토리가 없습니다: $MIGRATIONS_DIR${NC}"
    exit 1
fi

LAST_MIGRATION=$(ls -t "$MIGRATIONS_DIR"/*.sql 2>/dev/null | head -1)
if [ -z "$LAST_MIGRATION" ]; then
    echo -e "${YELLOW}⚠️  기존 마이그레이션 파일이 없습니다.${NC}"
    LAST_TIMESTAMP="00000000000000"
else
    LAST_MIGRATION_NAME=$(basename "$LAST_MIGRATION")
    LAST_TIMESTAMP=$(echo "$LAST_MIGRATION_NAME" | cut -d'_' -f1)
    echo -e "${GREEN}✓ 마지막 마이그레이션: $LAST_MIGRATION_NAME${NC}"
    echo -e "  타임스탬프: $LAST_TIMESTAMP"
fi

echo ""

# 2. 현재 시간 확인
CURRENT_TIMESTAMP=$(date +"%Y%m%d%H%M%S")
CURRENT_DATE=$(date +"%Y-%m-%d %H:%M:%S")
echo -e "${CYAN}현재 시간: $CURRENT_DATE${NC}"
echo -e "현재 타임스탬프: $CURRENT_TIMESTAMP"
echo ""

# 3. 새 타임스탬프 생성 (마지막보다 큰지 확인)
if [ "$CURRENT_TIMESTAMP" -le "$LAST_TIMESTAMP" ]; then
    echo -e "${YELLOW}⚠️  현재 타임스탬프가 마지막 마이그레이션보다 작거나 같습니다.${NC}"
    echo -e "${YELLOW}   마지막 타임스탬프 + 1초로 설정합니다.${NC}"
    
    # 마지막 타임스탬프에서 초 단위 추출 및 +1
    YEAR=${LAST_TIMESTAMP:0:4}
    MONTH=${LAST_TIMESTAMP:4:2}
    DAY=${LAST_TIMESTAMP:6:2}
    HOUR=${LAST_TIMESTAMP:8:2}
    MINUTE=${LAST_TIMESTAMP:10:2}
    SECOND=${LAST_TIMESTAMP:12:2}
    
    # 초에 1 더하기
    NEW_SECOND=$((10#$SECOND + 1))
    if [ $NEW_SECOND -ge 60 ]; then
        NEW_SECOND=0
        NEW_MINUTE=$((10#$MINUTE + 1))
        if [ $NEW_MINUTE -ge 60 ]; then
            NEW_MINUTE=0
            NEW_HOUR=$((10#$HOUR + 1))
            if [ $NEW_HOUR -ge 24 ]; then
                NEW_HOUR=0
                NEW_DAY=$((10#$DAY + 1))
                # 간단한 날짜 증가 (월/년 경계는 고려하지 않음)
            fi
        fi
    else
        NEW_MINUTE=$MINUTE
        NEW_HOUR=$HOUR
        NEW_DAY=$DAY
    fi
    
    NEW_TIMESTAMP=$(printf "%04d%02d%02d%02d%02d%02d" $YEAR $MONTH $NEW_DAY $NEW_HOUR $NEW_MINUTE $NEW_SECOND)
else
    NEW_TIMESTAMP=$CURRENT_TIMESTAMP
fi

echo -e "${GREEN}✓ 새 타임스탬프: $NEW_TIMESTAMP${NC}"
echo ""

# 4. 마이그레이션 이름 입력
if [ -z "$1" ]; then
    read -p "마이그레이션 이름을 입력하세요 (snake_case): " MIGRATION_NAME
else
    MIGRATION_NAME="$1"
fi

if [ -z "$MIGRATION_NAME" ]; then
    echo -e "${RED}✗ 마이그레이션 이름이 필요합니다.${NC}"
    exit 1
fi

# 5. 파일명 생성
FILENAME="${NEW_TIMESTAMP}_${MIGRATION_NAME}.sql"
FILEPATH="${MIGRATIONS_DIR}/${FILENAME}"

# 6. 파일 생성
cat > "$FILEPATH" << EOF
-- ============================================
-- Migration: $MIGRATION_NAME
-- Created: $(date +"%Y-%m-%d %H:%M:%S")
-- Timestamp: $NEW_TIMESTAMP
-- ============================================

EOF

echo -e "${GREEN}✓ 마이그레이션 파일 생성 완료:${NC}"
echo -e "  ${CYAN}$FILEPATH${NC}"
echo ""
echo -e "${CYAN}다음 단계:${NC}"
echo -e "  1. 파일을 열어서 SQL 작성"
echo -e "  2. 'npx supabase db push' 명령으로 적용"





