0. 범위 요약

이번 요구서는 아래 축을 한 번에 다루는 통합 리팩토링 스펙이다.

플랜 구조 정리

plan_groups / “논리 플랜(콘텐츠 단위)” / student_plan(일일 플랜) 역할 분리

플랜그룹 화면에서 내부 콘텐츠(논리 플랜) CRUD 가능

일일 플랜(student_plan)은 “실행 데이터” 중심으로 제한적 수정만 허용

타임라인·시간 배치 로직 정리

block_index, start_time/end_time, daily_schedule, time_slots 관계 정리

calculateAvailableDates, assignPlanTimes 등 시간 배치 코드 구조화/최적화

더미 콘텐츠(비학습/자율학습) 도메인화

DUMMY_NON_LEARNING_CONTENT_ID, DUMMY_SELF_STUDY_CONTENT_ID 중앙 관리

“비학습/자율학습”을 정식 도메인 개념으로 모델링

today·캠프 화면 성능 및 UX 개선

/api/today/plans, getTodayPlans 성능 최적화

today 타이머·진행률·메모·범위조정 플로우 안정화

통계/리포트 정의 정합성 확보

student_plan 기반 모든 집계(오늘/주간/월간/과목별/그룹별)의 기준 통일

보안·운영 기초 정리

student_plan RLS, updated_at 트리거 등 기본 가드레일 적용 제안

1. 도메인·테이블 개요
1.1 핵심 엔티티

PlanGroup (plan_groups)

“학습 설계 단위(캠페인)”

예: “2월 수학 교재 완주”, “겨울방학 캠프 영어집중반”

기간, 대상 학생, 콘텐츠 리스트, 스케줄 옵션, 캠프/일반 모드 정보 포함

여기서 논리 플랜/콘텐츠 단위를 관리하는 방향으로 확장

Logical Plan Item (신규 개념, 필요 시 테이블 신설)

PlanGroup 안의 개별 콘텐츠 계획 단위

예: “수학 자이스토리 수1 1단원 1~20p, 4회차에 나눠서 2주간 배치”

(예상 스키마) plan_group_items 또는 유사 테이블

plan_group_id, content_type, content_id, target_range, repeat/회차 정보, review_flag 등

Daily Plan (student_plan)

실제 학생에게 오늘/특정 날짜에 떨어지는 실행 단위 플랜 조각

현재 DDL 기준 필드:

식별/관계: id, tenant_id, student_id, plan_group_id

날짜·순서: plan_date, block_index, sequence, plan_number

콘텐츠: content_type, content_id, chapter, denormalized content_title/subject/...

범위: planned_start_page_or_time, planned_end_page_or_time

진행/실행: completed_amount, progress, actual_start_time, actual_end_time,
total_duration_seconds, paused_duration_seconds, pause_count

메타: day_type, is_partial, is_continued, is_reschedulable, memo

실행 로그+일일 단위 편집이 목적

Dummy Contents

비학습 항목: 이동, 점심, 학원 고정 일정 등

DUMMY_NON_LEARNING_CONTENT_ID = "000...0000"

자율학습 항목: 지정휴일/자유시간에 잡는 generic self-study

DUMMY_SELF_STUDY_CONTENT_ID = "000...0001"

현재 여러 위치에서 로컬 상수로 중복 선언되어 있음
→ 중앙 상수 + 정식 custom content row로 관리 필요

2. 현재 주요 문제 요약

플랜 구조·CRUD 혼재

plan_groups는 “설계”와 “상태”가 섞여 있고,

student_plan은 “실행” 데이터인데, 일부 구조적 수정도 이 레벨에서 처리됨

동일 논리 플랜이 plan_number로 묶여있긴 하나, 설계·집계·분석에 일관된 기준이 약함

타임라인·시간 로직 복잡도

calculateAvailableDates + generateTimeSlots + assignPlanTimes 경로가 길고,

block_index, start_time/end_time, daily_schedule.time_slots가 모두 존재

타임라인이 “핵심 도메인”인지, “고도 UX 옵션”인지 경계가 모호

더미 콘텐츠 하드코딩

DUMMY_NON_LEARNING_CONTENT_ID, DUMMY_SELF_STUDY_CONTENT_ID가
여러 파일에서 반복 정의 + 예외 처리 코드가 분산

도메인 모델이 아니라 “예외 코드 집합”으로 취급됨

today/timer 로직과 통계 정의 불일치 가능성

완료 기준: actual_end_time, completed_amount > 0, progress >= 100 등
다양한 기준이 파일별로 다르게 쓰이고 있음

weekly/monthly/subject 통계가 student_plan 기반인 것은 좋지만,
기준이 통합 정리돼 있지 않음

student_plan에 보안·무결성 가드 부족

마이그레이션 상 RLS, 트리거 정의 없음(대화 기준)

멀티테넌트 + 학생별 데이터인데, 정책이 명확히 안 보임

3. 기능 요구사항 상세
3.1 플랜 구조·CRUD 재정의
3.1.1 개념 정리

PlanGroup = 설계 단위(캠페인)

기간 / 학생 / 목표 / 시간대 옵션 / 캠프 여부 / 템플릿 연결 등

여기서 논리 플랜(콘텐츠 계획) CRUD를 처리

Logical Plan Item = PlanGroup 내부 콘텐츠 계획 단위

예: “수학 교재 A 1단원 1~40p, 주 3회, 4회차로 쪼개서 2주간”

필수 요소:

content_type, content_id

목표 범위(페이지/시간), 회차 수 또는 단위

우선순위(필수/선택), 복습 플래그 등

플랜그룹 화면에서 직접 생성/수정/삭제 가능

Daily Plan (student_plan) = 실행 조각

논리 플랜 아이템이 기간+타임라인 로직을 통해 잘게 쪼개져 나온 결과

여기서는:

날짜 변경(미루기)

범위 미세 조정

타이머(시작/일시정지/재개/완료)

메모

특정 날짜 한 번만 쓰는 ad-hoc 플랜 추가

구조적 변경(콘텐츠 교체/회차 재분배 등)은 직접 못 하게 정책화

3.1.2 스키마/필드 추가 제안

student_plan에 논리 플랜 참조 필드 추가

예: origin_plan_item_id uuid NULL REFERENCES plan_group_items(id)

의미:

어떤 논리 플랜 아이템으로부터 파생됐는지 추적

나중에 플랜그룹 설계 vs 실행 데이터 비교/분석 가능

(선택) plan_group_items 테이블 신설

최소 필드 예시:

id, plan_group_id, content_type, content_id

target_start_page_or_time, target_end_page_or_time 또는 총량

repeat_count 또는 split_strategy(몇 회차로 나누는지)

is_review, priority, order 등

3.1.3 기능 요구사항

[FR-1] 플랜그룹 상세 화면에서 **콘텐츠 아이템(논리 플랜)**을 CRUD 가능하게 한다.

추가/삭제/수정 시, 영향 받는 날짜 범위를 선택하여 student_plan 재생성

이미 완료된 student_plan은 보호(또는 별도 정책 정의)하고, 미완료 구간은 재배치

[FR-2] student_plan 수준에서는 다음만 허용:

날짜 변경 (postponePlan 등)

범위 조정 (adjustPlanRanges)

타이머 관련 (startPlan, pausePlan, resumePlan, completePlan, resetPlanTimer)

메모 (savePlanMemo)

단발성 ad-hoc 플랜 생성/삭제 (insert, delete) – 단, origin_plan_item_id는 NULL

[FR-3] plan_groups 삭제/캠프 템플릿 삭제 시,

연결된 student_plan 삭제 정책을 명확히 정리하고,

Repository 레이어(plan repository)에서 일관된 API로 묶는다.

3.2 타임라인·시간 배치 로직 정리
3.2.1 목표

“블록 기반” vs “실제 시각 기반” 역할을 분리하고,

타임라인이 어디까지 “필수 도메인”인지 명확히 한다.

3.2.2 기능 요구사항

[FR-4] 타임라인 설계 옵션 정의

기본 모드: block_index 중심 배치 (시간대는 UI 보조용)

고급 모드(캠프/특정 학원 연동): start_time/end_time 기반 타임라인 사용

옵션은 scheduler_options 혹은 테넌트/플랜그룹 수준에 정의

[FR-5] calculateAvailableDates / generateTimeSlots / assignPlanTimes 역할 분리

날짜·용량 계산: “하루에 몇 분/몇 블록 가능한지”

블록/시간 슬롯 생성: “어떤 블록에서 얼마만큼 할당 가능한지”

플랜 분할/배치: “콘텐츠 조각을 어느 날짜/블록/시간에 꽂을지”

각 함수의 입력·출력 타입을 명확히 재정의 (타입 레벨에서 드러나게)

[FR-6] student_plan.start_time/end_time 필드 사용 전략 정리

최소:

타이머 UX에서 “예정 시간대 표시”에 사용

타임라인 캘린더(day-view)에서 위치 렌더링에 사용

실제 필수 도메인이 아니라면:

“계산 실패/불필요한 경우 NULL 허용”을 명시하고, 프론트에서 방어 처리

[FR-7] daily_schedule 및 time_slots의 책임 명확화

플랜 생성에 실제 사용되는지 vs UI 표시용 캐시인지 구분

사용 안 되는 필드는 정리, 사용하는 부분은 타입/명칭으로 명확히 표현

3.3 더미 콘텐츠 도메인화
3.3.1 상수·도메인 정리

[DR-1] 상수 중앙 관리

lib/constants/plan.ts (예시)에 아래 상수 정의:

DUMMY_NON_LEARNING_CONTENT_ID

DUMMY_SELF_STUDY_CONTENT_ID

모든 파일에서 하드코딩된 문자열 제거 후 import 사용

[DR-2] student_custom_contents에 정식 더미 row 보장

비학습:

id = DUMMY_NON_LEARNING_CONTENT_ID

title = '비학습 항목', total_page_or_time = 0, content_type = 'custom'

자율학습:

id = DUMMY_SELF_STUDY_CONTENT_ID

title = '자율학습', total_page_or_time = 0, content_type = 'custom'

생성 로직은 공통 유틸로 분리 (중복 삽입 방지)

3.3.2 로직 정리

[FR-8] 더미 콘텐츠 관련 예외 처리 단일화

chapter 조회, contentDurationMap 계산, 회차 계산 등에서
“더미 콘텐츠는 스킵” 로직을 한 곳(or 공통 헬퍼)로 모으기

isDummyContent(content_id) 같은 유틸 도입

[FR-9] 비학습/자율학습 플랜 정책 정의

완료 여부 판단 (집계에서 포함/제외)

통계/리포트에서 어떻게 집계할지 (예: 전체 플랜 수에 포함, 실행률에는 포함 X 등)

3.4 today·캠프 화면 성능·UX
3.4.1 성능 요구사항

[FR-10] /api/today/plans, getTodayPlans 최적화

이미 있는 인덱스 활용:

(tenant_id, student_id, plan_date, plan_group_id)

(student_id, plan_date, block_index) INCLUDE(...)

쿼리 패턴 정리:

오늘 기준 조회: (student_id, plan_date=오늘, plan_group_id IN ...)

캠프 모드 필터링: plan_type='camp' 또는 그룹 기반 필터

필요시 today_plans_cache 사용 기준을 명시

[FR-11] today 타이머 액션 간의 경합/불일치 방지

startPlan, pausePlan, resumePlan, preparePlanCompletion, completePlan, resetPlanTimer
들의 상태 전이(State machine)를 문서 수준에서 정의

같은 plan_number에 대한 일괄 업데이트 부분을 명확하게 레이어링

3.4.2 UX/도메인 요구사항

[FR-12] 학생 입장 기능 가이드

today 화면에서 할 수 있는 것:

플랜 시작/일시정지/재개/완료

메모 작성

범위 미세 조정

플랜 미루기(내일로)

구조 변경(콘텐츠 교체/회차 변경)은 플랜그룹 화면으로 안내

[FR-13] 캠프 모드 today

템플릿 블록/타임라인 + 더미 비학습/자율학습 플랜이 섞인 구조
→ 위의 도메인/더미 콘텐츠 정리를 반영해서 일관된 구조로 리팩토링

3.5 통계/리포트 정의 통합
3.5.1 완료 기준 통합

[FR-14] “완료 플랜” 정의를 통일

후보:

completed_amount > 0 OR

progress >= 100 OR

actual_end_time IS NOT NULL

하나를 “공식 기준”으로 정하고,

오늘 진행률, 주간/월간 리포트, 과목별 분석, 플랜그룹 통계 등에서 같은 기준 사용

3.5.2 집계 모듈 구조화

[FR-15] student_plan 기반 집계 모듈 분리

오늘: calculateTodayProgress

주간: getWeeklyPlanSummary, getPlanCompletion

월간: getMonthlyPlanSummary

학생별/과목별: getStudentsWeeklyPlanCompletion, subject recommendation 등

이들을 하나의 metrics/ or reports/ 네임스페이스로 모으고,

공통 인터페이스(CompletionCriteria, Period, Filter) 설계

[FR-16] 비학습/자율학습 플랜의 집계 정책 반영

예:

전체 플랜 수에는 포함

“학습 완료율”에는 제외

또는 별도 카테고리로 구분

3.6 보안·운영 기초

[FR-17] student_plan RLS 정책 설계

최소:

학생은 자신의 레코드만 접근 가능 (student_id = auth.uid)

관리자/테넌트 오너는 해당 tenant_id 범위 내에서 조회 가능

정책은 Supabase RLS로 정의, 코드 레벨에서도 과도한 신뢰 방지

[FR-18] updated_at 자동 업데이트 트리거 도입

현재 여러 .update() 호출에서 매번 updated_at을 세팅하고 있음

BEFORE UPDATE 트리거로 통합해 개발자 실수를 예방

4. 단계별 구현 계획(제안)
Phase 1 – 도메인 정리·안전망 구축

student_plan RLS + updated_at 트리거

더미 콘텐츠 상수/row 중앙 관리

완료 기준 정의 통일 + metrics 모듈 인터페이스 설계

Phase 2 – 플랜 구조·CRUD 리팩토링

plan_group_items (또는 유사 구조) 도입

student_plan.origin_plan_item_id 추가

플랜그룹 화면에서 논리 플랜 CRUD + student_plan 재생성 플로우 구현

student_plan 레벨 구조 변경 기능 정리/차단

Phase 3 – 타임라인·today/캠프 최적화

타임라인 로직(calculateAvailableDates, assignPlanTimes) 분리·정리

today 화면 쿼리/캐시 최적화

캠프 모드 today·캘린더 동작 점검 및 리팩토링