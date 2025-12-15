# 캠프 기능 코드 구조 개선 작업 문서

## 작업 일시
2025-01-27

## 작업 개요
캠프 기능의 복잡한 비즈니스 로직을 분리하고 컴포넌트 재사용성을 높이기 위한 코드 구조 개선 작업을 수행했습니다.

## 완료된 작업

### 1. Adapter 패턴 도입 (데이터 파싱 분리)

#### 1-1. 신규 파일 생성: `lib/camp/campAdapter.ts`
- **목적**: 캠프 관련 데이터 파싱 로직을 중앙화하여 중복 제거 및 유지보수성 향상
- **구현 내용**:
  - `parseTemplateData()`: template_data 안전 파싱 (string/object 처리)
  - `parseSchedulerOptions()`: scheduler_options 안전 파싱
  - `resolveCampBlockSetId()`: 블록 세트 ID 조회 로직 통합 (3단계 우선순위)
  - `fetchCampTemplateBlocks()`: 템플릿 블록 조회
  - `parseCampConfiguration()`: 전체 캠프 설정 파싱 (통합 함수)

#### 1-2. 타입 정의 확장: `lib/domains/camp/types.ts`
- `CampPlanConfig` 타입 추가
- Adapter에서 사용할 타입 정의

#### 1-3. 중복 파싱 로직 제거
다음 파일들에서 중복된 파싱 로직을 제거하고 Adapter를 사용하도록 수정:

- ✅ `app/(student)/camp/[invitationId]/submitted/page.tsx`
  - 약 200줄의 중복 파싱 로직 제거
  - `parseCampConfiguration()` 사용으로 단순화

- ✅ `app/(student)/plan/group/[id]/page.tsx`
  - 약 200줄의 중복 파싱 로직 제거
  - `parseCampConfiguration()` 사용으로 단순화

- ✅ `app/(admin)/admin/plan-groups/[id]/page.tsx`
  - 약 150줄의 중복 파싱 로직 제거
  - `parseCampConfiguration()` 사용으로 단순화

**예상 코드 감소**: 약 550줄 이상의 중복 파싱 로직 제거

### 2. 컴포넌트 분리 (Composition 패턴)

#### 2-1. PlanGroupCard에서 campMode prop 제거
- `PlanGroupCard` 컴포넌트에서 `campMode` prop 제거
- 내부에서 `group.plan_type === "camp"`로 자동 판단하도록 수정
- `buildPlanExecutionUrl()` 호출 시 내부에서 결정된 `campMode` 값 사용

#### 2-2. DailyPlanView 수정
- `DailyPlanView`에서 `campMode` prop 제거
- `PlanGroupCard`가 내부에서 자동 판단하므로 prop 전달 불필요

**변경 사항**:
- `PlanGroupCard`는 이제 `group.plan_type`을 기반으로 캠프 모드를 자동 판단
- 다른 컴포넌트들(`PlanItem`, `TimerControlButtons` 등)은 여전히 `campMode` prop을 받아서 사용 (하위 호환성 유지)

## 진행 중인 작업

### 3. 캠프 상태(Status) 관리 통합
- 다음 단계에서 구현 예정

## 예상 효과

### 코드 감소
- 중복 파싱 로직 제거: 약 550줄 이상
- 상태 표시 로직 단순화: 예상 약 100줄 (다음 단계)
- **총 예상 감소: 약 650줄 이상**

### 유지보수성 향상
- 단일 책임 원칙 준수
- 관심사 분리 명확화
- 타입 안전성 강화
- 중앙화된 파싱 로직으로 버그 수정 용이

### 테스트 용이성
- Adapter 함수 단위 테스트 가능
- 상태 관리 로직 독립 테스트 가능
- 컴포넌트 Composition 테스트 용이

## 다음 단계

1. **캠프 상태 관리 통합**
   - `lib/camp/campStatus.ts` 생성
   - `CampStatus` 타입 정의 및 상태 결정 로직 구현
   - `CampInvitationCard` 단순화

2. **타입 안전성 개선**
   - `any` 타입 제거
   - Null 안전성 강화

3. **테스트 및 검증**
   - 기존 기능 동작 확인
   - 레거시 데이터 호환성 검증

## 참고 사항

- 기존 기능 동작 보장 (하위 호환성 유지)
- 레거시 데이터 지원 (template_data.block_set_id 등)
- 점진적 마이그레이션 (한 번에 모든 파일 수정하지 않음)

