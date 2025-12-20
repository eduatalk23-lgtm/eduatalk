#!/bin/bash

# Repomix Phase별 분석 스크립트
# 프로젝트 규모가 크기 때문에 세분화된 단계로 나누어 분석합니다.
# Phase 3와 Phase 4는 규모가 커서 더 작은 단위로 분할했습니다.

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

# Phase 3 분할: 학생 도메인 핵심
run_phase3_1() {
    log_info "Phase 3-1: 학생 플랜 관리 분석 시작..."
    npx repomix "app/(student)/plan" lib/plan -o repomix-phase3-1-plan.xml
    log_success "Phase 3-1 완료: repomix-phase3-1-plan.xml"
}

run_phase3_2() {
    log_info "Phase 3-2: 학생 성적 관리 분석 시작..."
    npx repomix "app/(student)/scores" lib/scores -o repomix-phase3-2-scores.xml
    log_success "Phase 3-2 완료: repomix-phase3-2-scores.xml"
}

run_phase3_3() {
    log_info "Phase 3-3: 학습 지표 및 목표 분석 시작..."
    npx repomix lib/metrics lib/goals -o repomix-phase3-3-metrics-goals.xml
    log_success "Phase 3-3 완료: repomix-phase3-3-metrics-goals.xml"
}

# Phase 4 분할: 관리자 및 컨설턴트 모듈
run_phase4_1() {
    log_info "Phase 4-1: 관리자 핵심 기능 분석 시작..."
    npx repomix "app/(admin)/admin/dashboard" "app/(admin)/admin/students" "app/(admin)/admin/schools" "app/(admin)/actions" -o repomix-phase4-1-admin-core.xml
    log_success "Phase 4-1 완료: repomix-phase4-1-admin-core.xml"
}

run_phase4_2() {
    log_info "Phase 4-2: 관리자 콘텐츠 관리 분석 시작..."
    npx repomix "app/(admin)/admin/master-books" "app/(admin)/admin/master-lectures" "app/(admin)/admin/master-custom-contents" "app/(admin)/admin/content-metadata" "app/(admin)/actions/masterBooks" "app/(admin)/actions/masterLectures" -o repomix-phase4-2-admin-content.xml
    log_success "Phase 4-2 완료: repomix-phase4-2-admin-content.xml"
}

# Phase 4-3 분할: 관리자 캠프 및 기타 기능 (규모가 커서 3개로 분할)
run_phase4_3_1() {
    log_info "Phase 4-3-1: 관리자 캠프 템플릿 분석 시작..."
    npx repomix "app/(admin)/admin/camp-templates" "app/(admin)/actions/camp-templates" -o repomix-phase4-3-1-camp-templates.xml
    log_success "Phase 4-3-1 완료: repomix-phase4-3-1-camp-templates.xml"
}

run_phase4_3_2() {
    log_info "Phase 4-3-2: 관리자 출석 및 SMS 분석 시작..."
    npx repomix "app/(admin)/admin/attendance" "app/(admin)/admin/sms" -o repomix-phase4-3-2-attendance-sms.xml
    log_success "Phase 4-3-2 완료: repomix-phase4-3-2-attendance-sms.xml"
}

run_phase4_3_3() {
    log_info "Phase 4-3-3: 관리자 교과목, 시간관리 및 기타 분석 시작..."
    npx repomix "app/(admin)/admin/subjects" "app/(admin)/admin/time-management" "app/(admin)/admin/consulting" "lib/data/admin" -o repomix-phase4-3-3-subjects-others.xml
    log_success "Phase 4-3-3 완료: repomix-phase4-3-3-subjects-others.xml"
}

# 하위 호환성을 위한 기존 함수 (deprecated)
run_phase4_3() {
    log_warning "Phase 4-3은 더 이상 사용되지 않습니다. 4-3-1, 4-3-2, 4-3-3을 사용하세요."
    log_info "Phase 4-3 전체 실행을 시작합니다..."
    echo ""
    run_phase4_3_1
    echo ""
    run_phase4_3_2
    echo ""
    run_phase4_3_3
    echo ""
    log_success "Phase 4-3 전체 분석이 완료되었습니다!"
}

run_phase5() {
    log_info "Phase 5: 데이터 페칭 및 API 최적화 분석 시작..."
    npx repomix lib/api lib/data app/api lib/hooks -o repomix-phase5-data-fetching.xml
    log_success "Phase 5 완료: repomix-phase5-data-fetching.xml"
}

# Phase 6 분할: 나머지 영역 및 공통 분석 (규모가 커서 6개로 분할)
run_phase6_1() {
    log_info "Phase 6-1: 인증 및 공통 페이지 분석 시작..."
    npx repomix app/login app/signup -o repomix-phase6-1-auth-pages.xml
    log_success "Phase 6-1 완료: repomix-phase6-1-auth-pages.xml"
}

run_phase6_2() {
    log_info "Phase 6-2: 부모 모듈 분석 시작..."
    npx repomix "app/(parent)" -o repomix-phase6-2-parent.xml
    log_success "Phase 6-2 완료: repomix-phase6-2-parent.xml"
}

run_phase6_3() {
    log_info "Phase 6-3: 슈퍼 관리자 모듈 분석 시작..."
    npx repomix "app/(superadmin)" -o repomix-phase6-3-superadmin.xml
    log_success "Phase 6-3 완료: repomix-phase6-3-superadmin.xml"
}

run_phase6_4() {
    log_info "Phase 6-4: Server Actions 분석 시작..."
    npx repomix app/actions -o repomix-phase6-4-server-actions.xml
    log_success "Phase 6-4 완료: repomix-phase6-4-server-actions.xml"
}

run_phase6_5() {
    log_info "Phase 6-5: 공통 컴포넌트 분석 시작..."
    npx repomix components/navigation components/layout -o repomix-phase6-5-common-components.xml
    log_success "Phase 6-5 완료: repomix-phase6-5-common-components.xml"
}

run_phase6_6() {
    log_info "Phase 6-6: 비즈니스 로직 라이브러리 분석 시작..."
    npx repomix lib/domains lib/coaching lib/risk lib/reschedule -o repomix-phase6-6-business-logic.xml
    log_success "Phase 6-6 완료: repomix-phase6-6-business-logic.xml"
}

# 하위 호환성을 위한 기존 함수 (deprecated)
run_phase6() {
    log_warning "Phase 6은 더 이상 사용되지 않습니다. 6-1, 6-2, 6-3, 6-4, 6-5, 6-6을 사용하세요."
    log_info "Phase 6 전체 실행을 시작합니다..."
    echo ""
    run_phase6_1
    echo ""
    run_phase6_2
    echo ""
    run_phase6_3
    echo ""
    run_phase6_4
    echo ""
    run_phase6_5
    echo ""
    run_phase6_6
    echo ""
    log_success "Phase 6 전체 분석이 완료되었습니다!"
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
        echo "  3-1 - 학생 플랜 관리 (app/(student)/plan, lib/plan)"
        echo "  3-2 - 학생 성적 관리 (app/(student)/scores, lib/scores)"
        echo "  3-3 - 학습 지표 및 목표 (lib/metrics, lib/goals)"
        echo "  4-1 - 관리자 핵심 기능 (dashboard, students, schools)"
        echo "  4-2 - 관리자 콘텐츠 관리 (master-*, content-metadata)"
        echo "  4-3-1 - 관리자 캠프 템플릿 (camp-templates, actions/camp-templates)"
        echo "  4-3-2 - 관리자 출석 및 SMS (attendance, sms)"
        echo "  4-3-3 - 관리자 교과목 및 기타 (subjects, time-management, consulting)"
        echo "  5 - 데이터 페칭 및 API (lib/api, lib/data, app/api, lib/hooks)"
        echo "  6-1 - 인증 및 공통 페이지 (login, signup)"
        echo "  6-2 - 부모 모듈 (app/(parent))"
        echo "  6-3 - 슈퍼 관리자 모듈 (app/(superadmin))"
        echo "  6-4 - Server Actions (app/actions)"
        echo "  6-5 - 공통 컴포넌트 (components/navigation, components/layout)"
        echo "  6-6 - 비즈니스 로직 라이브러리 (lib/domains, lib/coaching, lib/risk, lib/reschedule)"
        echo "  3 - Phase 3 전체 (3-1, 3-2, 3-3)"
        echo "  4 - Phase 4 전체 (4-1, 4-2, 4-3-1, 4-3-2, 4-3-3)"
        echo "  4-3 - Phase 4-3 전체 (4-3-1, 4-3-2, 4-3-3) - deprecated"
        echo "  6 - Phase 6 전체 (6-1, 6-2, 6-3, 6-4, 6-5, 6-6) - deprecated"
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
        3-1)
            run_phase3_1
            ;;
        3-2)
            run_phase3_2
            ;;
        3-3)
            run_phase3_3
            ;;
        3)
            log_info "Phase 3 전체 실행을 시작합니다..."
            echo ""
            run_phase3_1
            echo ""
            run_phase3_2
            echo ""
            run_phase3_3
            echo ""
            log_success "Phase 3 전체 분석이 완료되었습니다!"
            ;;
        4-1)
            run_phase4_1
            ;;
        4-2)
            run_phase4_2
            ;;
        4-3-1)
            run_phase4_3_1
            ;;
        4-3-2)
            run_phase4_3_2
            ;;
        4-3-3)
            run_phase4_3_3
            ;;
        4-3)
            run_phase4_3
            ;;
        4)
            log_info "Phase 4 전체 실행을 시작합니다..."
            echo ""
            run_phase4_1
            echo ""
            run_phase4_2
            echo ""
            log_info "Phase 4-3 분할 실행 시작..."
            run_phase4_3_1
            echo ""
            run_phase4_3_2
            echo ""
            run_phase4_3_3
            echo ""
            log_success "Phase 4 전체 분석이 완료되었습니다!"
            ;;
        5)
            run_phase5
            ;;
        6-1)
            run_phase6_1
            ;;
        6-2)
            run_phase6_2
            ;;
        6-3)
            run_phase6_3
            ;;
        6-4)
            run_phase6_4
            ;;
        6-5)
            run_phase6_5
            ;;
        6-6)
            run_phase6_6
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
            log_info "Phase 3 분할 실행 시작..."
            run_phase3_1
            echo ""
            run_phase3_2
            echo ""
            run_phase3_3
            echo ""
            log_info "Phase 4 분할 실행 시작..."
            run_phase4_1
            echo ""
            run_phase4_2
            echo ""
            log_info "Phase 4-3 분할 실행 시작..."
            run_phase4_3_1
            echo ""
            run_phase4_3_2
            echo ""
            run_phase4_3_3
            echo ""
            run_phase5
            echo ""
            log_info "Phase 6 분할 실행 시작..."
            run_phase6_1
            echo ""
            run_phase6_2
            echo ""
            run_phase6_3
            echo ""
            run_phase6_4
            echo ""
            run_phase6_5
            echo ""
            run_phase6_6
            echo ""
            log_success "모든 Phase 분석이 완료되었습니다!"
            ;;
        *)
            log_error "잘못된 Phase 번호입니다: $PHASE"
            echo "사용 가능한 값: 1, 2, 3-1, 3-2, 3-3, 3, 4-1, 4-2, 4-3-1, 4-3-2, 4-3-3, 4-3, 4, 5, 6-1, 6-2, 6-3, 6-4, 6-5, 6-6, 6, all"
            exit 1
            ;;
    esac
    
    echo ""
    log_info "분석 파일은 프로젝트 루트에 생성되었습니다."
    log_info "파일 크기가 크므로 .gitignore에 추가되어 있습니다."
}

# 스크립트 실행
main "$@"

