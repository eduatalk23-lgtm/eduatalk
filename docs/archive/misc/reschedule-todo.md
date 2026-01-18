# 재조정 기능 구현 TODO

**작성일**: 2025-12-10  
**기반 문서**: [재조정 기능 시나리오](./re.md)  
**목적**: 재조정 기능 구현을 위한 단계별 상세 체크리스트

---

## 📋 목차

1. [Phase 1: 데이터 모델 및 타입 정의](#phase-1-데이터-모델-및-타입-정의)
2. [Phase 2: Step 1 - 콘텐츠 선택 UI 구현](#phase-2-step-1---콘텐츠-선택-ui-구현)
3. [Phase 3: Step 2 - 상세 조정 UI 구현](#phase-3-step-2---상세-조정-ui-구현)
4. [Phase 4: Step 3 - 미리보기 & 확인 UI 구현](#phase-4-step-3---미리보기--확인-ui-구현)
5. [Phase 5: 재조정 핵심 로직 구현](#phase-5-재조정-핵심-로직-구현)
6. [Phase 6: 서버 액션 구현](#phase-6-서버-액션-구현)
7. [Phase 7: 에지 케이스 처리](#phase-7-에지-케이스-처리)
8. [Phase 8: 테스트 및 검증](#phase-8-테스트-및-검증)

---

## Phase 1: 데이터 모델 및 타입 정의

### 1.1 타입 정의 (`types/reschedule.ts`)

- [ ] **RescheduleMode 타입 정의**
  - `"full"`: 전체 재조정
  - `"range"`: 날짜 범위 재조정

- [ ] **ContentStatus 타입 정의**
  - `"available"`: 모든 플랜이 재조정 가능
  - `"partial"`: 일부 플랜만 재조정 가능
  - `"unavailable"`: 재조정 불가 (완료됨 또는 플랜 없음)

- [ ] **DateRange 타입 정의**
  ```typescript
  interface DateRange {
    from: string;  // YYYY-MM-DD
    to: string;    // YYYY-MM-DD
  }
  ```

- [ ] **AdjustmentInput 타입 정의**
  ```typescript
  interface AdjustmentInput {
    plan_content_id: string;
    change_type: "range" | "replace" | "full";
    before: ContentInfo;
    after: ContentInfo;
  }

  interface ContentInfo {
    content_id: string;
    content_type: string;
    range: { start: number; end: number };
  }
  ```

- [ ] **ReschedulePreviewResult 타입 정의**
  ```typescript
  interface ReschedulePreviewResult {
    plans_before_count: number;
    plans_after_count: number;
    affected_dates: string[];
    estimated_hours: number;
    adjustments_summary: {
      range_changes: number;
      replacements: number;
      full_regenerations: number;
    };
    plans_before: Plan[];
    plans_after: Plan[];
  }
  ```

- [ ] **Step별 상태 타입 정의**
  ```typescript
  interface Step1State {
    selectedContentIds: Set<string>;
    dateRange: DateRange | null;
    mode: RescheduleMode;
  }

  interface Step2State {
    adjustments: AdjustmentInput[];
  }

  interface Step3State {
    preview: ReschedulePreviewResult | null;
    isLoading: boolean;
    error: string | null;
  }
  ```

### 1.2 데이터베이스 스키마 확인/수정

- [ ] **student_plan 테이블 필드 확인**
  - `completed_amount` 필드 존재 확인
  - `is_active` 필드 존재 확인
  - `status` 필드 값 ('pending', 'in_progress', 'completed') 확인

- [ ] **plan_history 테이블 생성 (백업용)**
  ```sql
  CREATE TABLE IF NOT EXISTS plan_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_plan_id UUID REFERENCES student_plan(id),
    plan_data JSONB,
    reschedule_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **reschedule_log 테이블 생성**
  ```sql
  CREATE TABLE IF NOT EXISTS reschedule_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_group_id UUID REFERENCES plan_group(id),
    student_id UUID,
    adjustments JSONB,
    affected_content_ids TEXT[],
    date_range JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

---

## Phase 2: Step 1 - 콘텐츠 선택 UI 구현

### 2.1 컴포넌트 구조 설계

- [ ] **RescheduleWizard 컴포넌트**
  - Step 간 상태 관리
  - Step 네비게이션 (이전/다음)
  - 전역 상태 Context 또는 Zustand 사용

- [ ] **Step1ContentSelection 컴포넌트**
  - 콘텐츠 목록 표시
  - 체크박스 선택 기능
  - 모드 선택 (전체/날짜 범위)

### 2.2 전체 재조정 모드 UI (시나리오 1-1)

- [ ] **재조정 가능 콘텐츠 목록 조회**
  - 완료되지 않은 플랜이 있는 콘텐츠만 표시
  - 콘텐츠별 상태 표시 (available/partial/unavailable)

- [ ] **콘텐츠 카드 컴포넌트**
  - 콘텐츠 이름, 타입 표시
  - 현재 범위 (start_range ~ end_range) 표시
  - 진행률 표시
  - 상태 뱃지 표시

- [ ] **체크박스 선택 로직**
  - 다중 선택 가능
  - unavailable 상태는 비활성화
  - 전체 선택/해제 기능

### 2.3 날짜 범위 재조정 모드 UI (시나리오 1-2)

- [ ] **날짜 범위 선택 UI**
  - DatePicker 컴포넌트 사용
  - 시작일/종료일 선택
  - 달력 UI에 플랜 존재 여부 표시

- [ ] **스마트 제안 기능**
  - 미진행 플랜이 많은 날짜 범위 분석
  - 추천 범위 제안 버튼
  - 특정 콘텐츠 기준 영향 범위 제안

- [ ] **날짜 범위 검증**
  - 시작일 ≤ 종료일 검증
  - 오늘 이후 날짜 포함 여부 검증
  - 플랜 그룹 기간 내 범위 검증

### 2.4 검증 및 에러 처리 (시나리오 1-3)

- [ ] **콘텐츠 미선택 검증**
  - "최소 1개 이상의 콘텐츠를 선택해주세요." 알림

- [ ] **날짜 범위 미선택 검증** (Range 모드)
  - "날짜 범위를 선택해주세요." 알림

- [ ] **재조정 불가 콘텐츠 표시**
  - 체크박스 비활성화
  - "모든 플랜이 완료되어 재조정할 수 없습니다" 안내

- [ ] **"다음" 버튼 활성화 조건**
  - 최소 1개 콘텐츠 선택
  - Range 모드인 경우 날짜 범위 선택 필수

---

## Phase 3: Step 2 - 상세 조정 UI 구현

### 3.1 컴포넌트 구조

- [ ] **Step2DetailAdjustment 컴포넌트**
  - 선택된 콘텐츠 목록 표시
  - 조정 옵션 제공
  - AdjustmentInput 배열 생성

### 3.2 범위 조정 UI (시나리오 2-1)

- [ ] **콘텐츠별 범위 편집 카드**
  - 시작 범위 입력 필드
  - 끝 범위 입력 필드
  - 현재 범위 표시

- [ ] **실시간 범위 검증**
  - 시작 범위 ≤ 끝 범위 검증
  - 범위 벗어남 경고 (선택 사항)
  - 유효하지 않은 입력 에러 표시

- [ ] **AdjustmentInput 생성 로직**
  - change_type: "range"
  - before: 원본 범위 정보
  - after: 수정된 범위 정보

### 3.3 콘텐츠 교체 UI (시나리오 2-2)

- [ ] **"교체" 버튼**
  - 콘텐츠 카드에 교체 버튼 추가

- [ ] **콘텐츠 검색 모달**
  - 검색 입력 필드
  - 교체 가능한 콘텐츠 목록 (같은 content_type)
  - 콘텐츠 선택 후 범위 입력

- [ ] **교체 후 상태 표시**
  - 원본 콘텐츠 → 새 콘텐츠 표시
  - 교체 취소 기능

- [ ] **AdjustmentInput 생성 로직**
  - change_type: "replace"
  - before: 원본 콘텐츠 정보
  - after: 교체 콘텐츠 정보

### 3.4 전체 재생성 UI (시나리오 2-3)

- [ ] **"전체 재생성" 버튼**
  - 콘텐츠 카드에 재생성 버튼 추가

- [ ] **재생성 설정 모달**
  - 새로운 콘텐츠 선택
  - 새 범위 설정
  - 기존 플랜과의 연결 해제 안내

- [ ] **AdjustmentInput 생성 로직**
  - change_type: "full"
  - before: 원본 콘텐츠 정보
  - after: 새 콘텐츠 정보

### 3.5 일괄 조정 UI (시나리오 2-4)

- [ ] **일괄 조정 모드 토글**
  - 2개 이상 콘텐츠 선택 시 활성화

- [ ] **일괄 조정 패널**
  - 모든 콘텐츠에 +N 페이지 추가 옵션
  - 모든 콘텐츠 범위 N% 증가 옵션
  - 시작/끝 범위 일괄 조정 옵션

- [ ] **일괄 적용 로직**
  - 선택된 모든 콘텐츠에 동일 조정 적용
  - 각 콘텐츠별 AdjustmentInput 생성

### 3.6 조정 없이 진행 (시나리오 2-5)

- [ ] **기본 동작 처리**
  - adjustments 배열이 비어있어도 Step 3 진행 가능
  - "조정 없이 미진행 범위만 재분배" 안내 표시

---

## Phase 4: Step 3 - 미리보기 & 확인 UI 구현

### 4.1 컴포넌트 구조

- [ ] **Step3PreviewConfirm 컴포넌트**
  - 미리보기 결과 표시
  - 변경 전/후 비교
  - 실행 버튼

### 4.2 미리보기 자동 로드 (시나리오 3-1)

- [ ] **Step 3 진입 시 자동 로드**
  - `getReschedulePreview` 서버 액션 호출
  - 로딩 상태 표시

- [ ] **미리보기 결과 상태 관리**
  - 로딩 중 스피너
  - 에러 발생 시 에러 메시지
  - 성공 시 결과 표시

### 4.3 변경 사항 확인 UI (시나리오 3-2)

- [ ] **변경 요약 카드**
  - 기존 플랜 수 → 새 플랜 수
  - 영향받는 날짜 수
  - 예상 총 학습 시간

- [ ] **변경 전/후 비교 테이블**
  - 날짜별 플랜 비교
  - 차이점 하이라이트 표시
  - 스크롤 가능한 테이블

- [ ] **조정 내역 요약**
  - 범위 수정 개수
  - 교체 개수
  - 전체 재생성 개수

- [ ] **충돌 경고 표시**
  - 시간대 충돌 감지
  - 경고 아이콘 및 메시지

- [ ] **일일 학습량 변화 표시**
  - 원래 일일 배정 → 새 일일 배정
  - 비현실적으로 큰 경우 경고

### 4.4 재조정 실행 (시나리오 3-3)

- [ ] **"재조정 실행" 버튼**
  - 미리보기 완료 후 활성화

- [ ] **확인 다이얼로그**
  - 변경 사항 재확인
  - "정말 실행하시겠습니까?" 메시지
  - 취소/실행 버튼

- [ ] **실행 중 상태**
  - 로딩 인디케이터
  - 버튼 비활성화

- [ ] **실행 완료 처리**
  - 성공 메시지 표시
  - 플랜 그룹 상세 페이지로 리다이렉트

### 4.5 미리보기 실패 처리 (시나리오 3-4)

- [ ] **로딩 실패 UI**
  - 에러 메시지 표시
  - "다시 시도" 버튼

- [ ] **조건 불만족 처리**
  - "조정 사항이 없거나 날짜 범위가 선택되지 않았습니다." 안내
  - Step 2로 돌아가기 버튼

---

## Phase 5: 재조정 핵심 로직 구현

### 5.1 미진행 범위 계산 로직 (시나리오 4-1)

- [ ] **기존 플랜 조회 함수**
  ```typescript
  async function getUncompletedPlans(
    planGroupId: string,
    contentIds: string[],
    today: string
  ): Promise<Plan[]>
  ```
  - `plan_date < today` 조건 (오늘 이전만)
  - `status IN ('pending', 'in_progress')` 조건
  - `is_active = true` 조건
  - `completed_amount` 필드 포함

- [ ] **미진행 범위 계산 함수**
  ```typescript
  function calculateUncompletedRange(plans: Plan[]): Map<string, number>
  ```
  - 각 플랜별: `(planned_end - planned_start) - (completed_amount || 0)`
  - 콘텐츠별 합산
  - 음수 방지: `max(0, ...)`

- [ ] **재조정 기간 결정 함수**
  ```typescript
  function getAdjustedPeriod(
    dateRange: DateRange | null,
    today: string,
    groupEnd: string
  ): { start: string; end: string }
  ```
  - `adjustedPeriodStart = dateRange?.from || getNextStudyDate(today)`
  - `adjustedPeriodEnd = dateRange?.to || group.period_end`

### 5.2 콘텐츠 범위 조정 로직 (시나리오 4-4)

- [ ] **조정 적용 함수**
  ```typescript
  function applyAdjustments(
    contents: Content[],
    adjustments: AdjustmentInput[]
  ): Content[]
  ```
  - 범위 조정 적용
  - 교체 적용
  - 전체 재생성 적용

- [ ] **미진행 범위 추가 함수**
  ```typescript
  function addUncompletedRange(
    contents: Content[],
    uncompletedRanges: Map<string, number>
  ): Content[]
  ```
  - 각 콘텐츠의 end_range에 미진행 범위 추가

- [ ] **순서 보장**
  - 1. 조정(adjustments) 먼저 적용
  - 2. 미진행 범위 추가는 나중

### 5.3 부분 진행된 플랜 처리 (시나리오 4-2)

- [ ] **부분 완료 계산**
  ```typescript
  function calculatePartialUncompleted(plan: Plan): number {
    const totalRange = plan.planned_end - plan.planned_start;
    const completed = plan.completed_amount || 0;
    return Math.max(0, totalRange - completed);
  }
  ```
  - 음수 방지 (`max(0, ...)`)
  - 초과 완료 시 0 반환

### 5.4 날짜 범위 지정 재조정 로직 (시나리오 4-3)

- [ ] **날짜 범위 필터링**
  - 날짜 범위와 오늘 이전 조건 모두 적용
  - `plan_date >= dateRange.from`
  - `plan_date <= dateRange.to`
  - `plan_date < today`

- [ ] **재조정 기간 결정**
  - `adjustedPeriodStart = max(dateRange.from, today 이후 첫 학습일)`
  - `adjustedPeriodEnd = dateRange.to`

- [ ] **생성된 플랜 필터링**
  - 선택한 날짜 범위 내 플랜만 유지

### 5.5 새 플랜 생성 로직

- [ ] **스케줄 계산 함수 호출**
  ```typescript
  calculateAvailableDates(
    adjustedPeriodStart,
    adjustedPeriodEnd,
    studyDays,
    excludedDates
  )
  ```

- [ ] **플랜 생성 함수 호출**
  ```typescript
  generatePlansFromGroup(
    groupSettings,
    contentsWithUncompleted,  // 조정된 콘텐츠 사용
    availableDates
  )
  ```

- [ ] **일일 학습량 자동 증가 검증**
  - 총 학습량 ÷ 남은 기간 = 일일 배정량
  - 원래 배정량과 비교하여 변화 감지

---

## Phase 6: 서버 액션 구현

### 6.1 미리보기 서버 액션

- [ ] **`getReschedulePreview` 함수**
  ```typescript
  "use server"
  export async function getReschedulePreview(
    planGroupId: string,
    selectedContentIds: string[],
    adjustments: AdjustmentInput[],
    dateRange: DateRange | null
  ): Promise<ReschedulePreviewResult>
  ```

- [ ] **구현 단계**
  1. 오늘 날짜 구하기
  2. 기존 플랜 조회 (오늘 이전만)
  3. 미진행 범위 계산
  4. 조정 적용 (adjustments)
  5. 재조정 기간 결정
  6. 콘텐츠 범위 조정 (미진행 범위 추가)
  7. 스케줄 계산 (남은 기간만)
  8. 새 플랜 생성
  9. 미리보기 결과 반환

### 6.2 재조정 실행 서버 액션

- [ ] **`rescheduleContents` 함수**
  ```typescript
  "use server"
  export async function rescheduleContents(
    planGroupId: string,
    selectedContentIds: string[],
    adjustments: AdjustmentInput[],
    dateRange: DateRange | null
  ): Promise<{ success: boolean; error?: string }>
  ```

- [ ] **구현 단계 (트랜잭션 내)**
  1. 트랜잭션 시작
  2. 기존 플랜 히스토리 백업 (`plan_history` 테이블)
  3. 기존 플랜 비활성화 (`is_active = false`)
  4. 새 플랜 생성 및 저장
  5. 재조정 로그 저장 (`reschedule_log` 테이블)
  6. 트랜잭션 커밋

- [ ] **에러 처리**
  - 트랜잭션 롤백
  - 에러 메시지 반환

### 6.3 보조 서버 액션

- [ ] **`getAvailableContentsForReschedule` 함수**
  - 재조정 가능한 콘텐츠 목록 조회
  - 콘텐츠별 상태 계산

- [ ] **`getDateSuggestions` 함수**
  - 스마트 날짜 범위 제안
  - 미진행 플랜이 많은 구간 분석

- [ ] **`searchContentsForReplacement` 함수**
  - 콘텐츠 교체용 검색
  - 같은 content_type 필터링

---

## Phase 7: 에지 케이스 처리

### 7.1 오늘 날짜 플랜 처리 (시나리오 5-1)

- [ ] **기본 정책: 오늘 날짜 제외**
  - `plan_date < today` 조건 사용
  - 오늘 플랜은 유지

- [ ] **옵션: 오늘 날짜 포함 설정**
  - 설정 UI 추가 (선택 사항)
  - `plan_date <= today` 조건 변경

### 7.2 모든 플랜 완료 (시나리오 5-2)

- [ ] **재조정 불가 처리**
  - "재조정 가능한 콘텐츠가 없습니다." 메시지
  - 재조정 페이지 진입 방지 또는 안내

### 7.3 남은 기간 없음 (시나리오 5-3)

- [ ] **기간 검증**
  - 오늘 이후 학습일 계산
  - 0일인 경우 에러 처리

- [ ] **에러 메시지**
  - "재조정할 기간이 남아있지 않습니다."

### 7.4 날짜 범위가 오늘 이전 (시나리오 5-4)

- [ ] **범위 검증**
  - 선택한 범위에 오늘 이후 날짜 포함 여부 확인

- [ ] **처리 옵션**
  - 에러: "선택한 날짜 범위에 오늘 이후 기간이 포함되지 않았습니다."
  - 또는 자동 조정: 오늘 이후 첫 학습일로 시작일 변경

### 7.5 미진행 범위가 매우 큰 경우 (시나리오 5-5)

- [ ] **일일 학습량 임계값 설정**
  - 기준값 정의 (예: 일일 20페이지 이상)

- [ ] **경고 표시**
  - "일일 학습량이 매우 큽니다. 범위 조정을 권장합니다."
  - Step 3 미리보기에서 경고 표시

- [ ] **권장 조치 안내**
  - 범위 축소 권장
  - 기간 연장 권장 (플랜 그룹 설정 변경 안내)

### 7.6 동시 재조정 방지 (시나리오 5-6)

- [ ] **트랜잭션 락 구현**
  - 플랜 그룹 단위 락
  - 재조정 시작 시 락 획득
  - 재조정 완료/실패 시 락 해제

- [ ] **또는 낙관적 잠금**
  - 버전 필드 사용
  - 충돌 시 재시도 안내

### 7.7 변화 감지 문제 해결 (시나리오 5-7)

- [ ] **변화 감지 로직 구현**
  - 일일 학습량 비교
  - 플랜 개수 비교
  - 날짜 분포 비교

- [ ] **조정된 콘텐츠 사용 보장**
  - `contentsWithUncompleted` 사용
  - 원본 콘텐츠 범위 대신 조정된 범위 사용

---

## Phase 8: 테스트 및 검증

### 8.1 단위 테스트

- [ ] **미진행 범위 계산 테스트**
  - 정상 케이스: 미진행 플랜 계산
  - 부분 진행 케이스: completed_amount 고려
  - 초과 완료 케이스: 음수 방지

- [ ] **조정 적용 테스트**
  - 범위 조정 적용
  - 콘텐츠 교체 적용
  - 전체 재생성 적용

- [ ] **기간 결정 테스트**
  - 전체 재조정 기간
  - 날짜 범위 지정 기간
  - 오늘 이후 시작 보장

### 8.2 통합 테스트

- [ ] **전체 재조정 플로우 테스트**
  - Step 1 → Step 2 → Step 3 → 실행
  - 데이터 정합성 검증

- [ ] **날짜 범위 재조정 플로우 테스트**
  - 범위 선택
  - 해당 범위만 재조정 확인

- [ ] **조정 + 재분배 동시 적용 테스트**
  - 범위 확장 + 미진행 범위 추가

### 8.3 에지 케이스 테스트

- [ ] **오늘 날짜 경계 테스트**
- [ ] **모든 플랜 완료 테스트**
- [ ] **남은 기간 없음 테스트**
- [ ] **매우 큰 미진행 범위 테스트**

### 8.4 UI/UX 테스트

- [ ] **반응형 디자인 테스트**
- [ ] **로딩 상태 테스트**
- [ ] **에러 상태 테스트**
- [ ] **성공 플로우 테스트**

### 8.5 성능 테스트

- [ ] **대량 플랜 재조정 성능**
- [ ] **미리보기 응답 시간**
- [ ] **실행 응답 시간**

---

## 📊 진행 상황 추적

| Phase | 주요 내용 | 상태 | 담당자 | 완료일 |
|-------|----------|------|--------|--------|
| Phase 1 | 타입 정의 및 DB 스키마 | ⬜ 시작 전 | - | - |
| Phase 2 | Step 1 UI 구현 | ⬜ 시작 전 | - | - |
| Phase 3 | Step 2 UI 구현 | ⬜ 시작 전 | - | - |
| Phase 4 | Step 3 UI 구현 | ⬜ 시작 전 | - | - |
| Phase 5 | 핵심 로직 구현 | ⬜ 시작 전 | - | - |
| Phase 6 | 서버 액션 구현 | ⬜ 시작 전 | - | - |
| Phase 7 | 에지 케이스 처리 | ⬜ 시작 전 | - | - |
| Phase 8 | 테스트 및 검증 | ⬜ 시작 전 | - | - |

---

## 📌 참고 사항

### 의존성 순서
1. **Phase 1** → 다른 모든 Phase의 기반
2. **Phase 5** → Phase 6 구현에 필요
3. **Phase 2, 3, 4** → 순차적으로 구현 (Step 순서)
4. **Phase 6** → Phase 2, 3, 4와 연동
5. **Phase 7** → Phase 5, 6 완료 후
6. **Phase 8** → 모든 Phase 완료 후

### 주요 체크포인트
- [ ] Phase 1 완료 후 타입 검토
- [ ] Phase 4 완료 후 UI 리뷰
- [ ] Phase 6 완료 후 로직 검증
- [ ] Phase 8 완료 후 최종 QA

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-12-10
