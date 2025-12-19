#!/bin/bash

# Repomix Phase별 분석 스크립트
# 프로젝트 규모가 크기 때문에 6단계로 나누어 분석합니다.

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# repomix 설치 확인
check_repomix() {
    if ! command -v npx &> /dev/null; then
        log_error "npx가 설치되어 있지 않습니다."
        exit 1
    fi
    log_info "repomix는 npx를 통해 실행됩니다."
}

# Phase별 실행 함수
run_phase1() {
    log_info "Phase 1: 핵심 인프라 분석 시작..."
    npx repomix lib/supabase lib/auth -o repomix-phase1-infrastructure.xml
    log_success "Phase 1 완료: repomix-phase1-infrastructure.xml"
}

run_phase2() {
    log_info "Phase 2: 공통 유틸리티 및 UI 컴포넌트 분석 시작..."
    npx repomix lib/utils lib/types components/ui -o repomix-phase2-utils.xml
    log_success "Phase 2 완료: repomix-phase2-utils.xml"
}

run_phase3() {
    log_info "Phase 3: 학생 도메인 핵심 분석 시작... (가장 큰 파일, 시간이 걸릴 수 있습니다)"
    npx repomix "app/(student)/plan" "app/(student)/scores" lib/plan lib/scores lib/metrics lib/goals -o repomix-phase3-student-core.xml
    log_success "Phase 3 완료: repomix-phase3-student-core.xml"
}

run_phase4() {
    log_info "Phase 4: 학생 도메인 확장 분석 시작..."
    npx repomix "app/(student)/contents" "app/(student)/today" "app/(student)/dashboard" "app/(student)/analysis" "app/(student)/blocks" "app/(student)/camp" lib/data lib/recommendations -o repomix-phase4-student-extended.xml
    log_success "Phase 4 완료: repomix-phase4-student-extended.xml"
}

run_phase5() {
    log_info "Phase 5: 관리자 영역 분석 시작..."
    npx repomix "app/(admin)" lib/data/admin -o repomix-phase5-admin.xml
    log_success "Phase 5 완료: repomix-phase5-admin.xml"
}

run_phase6() {
    log_info "Phase 6: 나머지 영역 및 공통 분석 시작..."
    npx repomix "app/(parent)" "app/(superadmin)" app/login app/signup app/actions app/api components/navigation components/layout lib/domains lib/coaching lib/risk lib/reschedule -o repomix-phase6-others.xml
    log_success "Phase 6 완료: repomix-phase6-others.xml"
}

# 메인 함수
main() {
    echo "=========================================="
    echo "  Repomix Phase별 분석 스크립트"
    echo "=========================================="
    echo ""
    
    check_repomix
    
    # 인자 확인
    if [ $# -eq 0 ]; then
        log_warning "Phase 번호를 지정하지 않았습니다."
        echo ""
        echo "사용법:"
        echo "  ./scripts/repomix-phase-analysis.sh [phase_number|all]"
        echo ""
        echo "Phase 목록:"
        echo "  1 - 핵심 인프라 (lib/supabase, lib/auth)"
        echo "  2 - 공통 유틸리티 (lib/utils, lib/types, components/ui)"
        echo "  3 - 학생 핵심 (plan, scores, metrics, goals)"
        echo "  4 - 학생 확장 (contents, today, dashboard, analysis, blocks, camp)"
        echo "  5 - 관리자 (app/(admin), lib/data/admin)"
        echo "  6 - 나머지 (parent, superadmin, actions, api, 기타)"
        echo "  all - 모든 Phase 실행"
        echo ""
        exit 1
    fi
    
    PHASE=$1
    
    case $PHASE in
        1)
            run_phase1
            ;;
        2)
            run_phase2
            ;;
        3)
            run_phase3
            ;;
        4)
            run_phase4
            ;;
        5)
            run_phase5
            ;;
        6)
            run_phase6
            ;;
        all)
            log_info "모든 Phase 실행을 시작합니다..."
            echo ""
            run_phase1
            echo ""
            run_phase2
            echo ""
            run_phase3
            echo ""
            run_phase4
            echo ""
            run_phase5
            echo ""
            run_phase6
            echo ""
            log_success "모든 Phase 분석이 완료되었습니다!"
            ;;
        *)
            log_error "잘못된 Phase 번호입니다: $PHASE"
            echo "사용 가능한 값: 1, 2, 3, 4, 5, 6, all"
            exit 1
            ;;
    esac
    
    echo ""
    log_info "분석 파일은 프로젝트 루트에 생성되었습니다."
    log_info "파일 크기가 크므로 .gitignore에 추가되어 있습니다."
}

# 스크립트 실행
main "$@"

