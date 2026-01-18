# 관리자 영역 학습 플랜 관리 기능 부족 부분 분석

## 📋 문서 정보

- **작성일**: 2025-02-02
- **최종 업데이트**: 2026-01-05
- **작성 목적**: 관리자 영역에서 학생의 학습 플랜을 생성, 수정, 조정, 변경, 삭제하는 기능의 부족한 부분 조사 및 문서화
- **분석 범위**:
  - `app/(admin)/admin/students/[id]/plans/` - 관리자 플랜 관리 UI
  - `lib/domains/admin-plan/` - 관리자 플랜 도메인 로직
  - `lib/domains/plan/` - 플랜 공통 도메인 로직

> ⚠️ **업데이트 노트 (2026-01-05)**: 이 문서에서 "❌ 없음"으로 표시된 대부분의 기능이 현재 구현 완료되었습니다. 아래 "현재 구현 상태 요약" 섹션을 참조하세요.

---

## ✅ 현재 구현 상태 요약 (2026-01-05 업데이트)

### 구현 완료된 모달 컴포넌트 (`_components/modals/`)

| 파일 | 기능 | 연결 상태 |
|------|------|-----------|
| `EditPlanModal.tsx` | 정규 플랜 전체 수정 | ✅ AdminPlanManagement 연결됨 |
| `BulkEditModal.tsx` | 플랜 일괄 수정 | ✅ AdminPlanManagement 연결됨 |
| `CopyPlanModal.tsx` | 플랜 복사/복제 | ✅ AdminPlanManagement 연결됨 |
| `MoveToGroupModal.tsx` | 플랜 그룹 간 이동 | ✅ AdminPlanManagement 연결됨 |
| `PlanStatusModal.tsx` | 플랜 상태 변경 | ✅ AdminPlanManagement 연결됨 |
| `ConditionalDeleteModal.tsx` | 조건부 일괄 삭제 | ✅ AdminPlanManagement 연결됨 |
| `PlanTemplateModal.tsx` | 플랜 템플릿 저장/불러오기 | ✅ AdminPlanManagement 연결됨 |
| `ReorderPlansModal.tsx` | 명시적 순서 지정 | ✅ AdminPlanManagement 연결됨 |

### 구현 완료된 서버 액션 (`lib/domains/admin-plan/actions/`)

| 파일 | 함수 | 기능 |
|------|------|------|
| `copyPlan.ts` | `copyPlansToDate` | 플랜 복사 |
| `editPlan.ts` | `adminUpdateStudentPlan`, `adminBulkUpdatePlans` | 단일/일괄 수정 |
| `moveToGroup.ts` | `movePlansToGroup`, `getStudentPlanGroups` | 그룹 이동 |
| `createPlanFromContent.ts` | `createPlanFromContent` | 콘텐츠 기반 플랜 생성 (배치 분배) |

### 기타 구현 완료

| 컴포넌트 | 기능 |
|----------|------|
| `DeletedPlansView.tsx` | 삭제된 플랜 복구 |
| `AddContentModal.tsx` | 콘텐츠 추가 + 배치 분배 로직 완성 |

---

## 🔍 현재 구현된 기능 분석

### 1. 플랜 생성 (Create)

#### ✅ 구현된 기능

1. **AI 플랜 생성** (`AdminAIPlanModal`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx`
   - 기능: LLM을 활용한 자동 플랜 생성
   - 액션: `lib/domains/admin-plan/actions/aiPlanGeneration.ts::saveAIGeneratedPlansAction`
   - 상태: ✅ 완료

2. **빠른 플랜 추가** (`AdminQuickPlanModal`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`
   - 기능: 간단한 폼으로 빠르게 플랜 추가
   - 상태: ✅ 완료

3. **플랜 그룹 생성 위자드** (`AdminPlanCreationWizard7Step`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/admin-wizard/`
   - 기능: 7단계 위자드로 플랜 그룹 생성
   - 단계:
     1. 기본 정보
     2. 시간 설정
     3. 일정 미리보기
     4. 콘텐츠 선택
     5. 할당 설정
     6. 최종 검토
     7. 생성 결과
   - 상태: ✅ 완료

4. **콘텐츠 추가** (`AddContentModal`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/AddContentModal.tsx`
   - 기능: 유연한 콘텐츠 생성 및 플랜 추가
   - 액션: `lib/domains/admin-plan/actions/flexibleContent.ts::createFlexibleContent`
   - 상태: ⚠️ 부분 구현 (TODO 주석 있음: 배치 방식에 따른 플랜 생성 로직 미완성)

5. **단발성 플랜 추가** (`AddAdHocModal`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`
   - 기능: 단발성 플랜 생성
   - 액션: `lib/domains/admin-plan/actions/adHocPlan.ts::createAdHocPlan`
   - 상태: ✅ 완료

#### 📊 생성 기능 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| AI 플랜 생성 | ✅ 완료 | |
| 빠른 플랜 추가 | ✅ 완료 | |
| 플랜 그룹 위자드 | ✅ 완료 | |
| 콘텐츠 추가 | ⚠️ 부분 구현 | 배치 분배 로직 미완성 |
| 단발성 플랜 추가 | ✅ 완료 | |

---

### 2. 플랜 수정 (Update)

#### ✅ 구현된 기능

1. **인라인 볼륨 수정** (`InlineVolumeEditor`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/QuickActions.tsx`
   - 기능: 플랜 카드에서 직접 페이지 범위 수정
   - 액션: 직접 Supabase 업데이트
   - 상태: ✅ 완료

2. **인라인 진행률 수정** (`QuickProgressInput`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/QuickActions.tsx`
   - 기능: 완료된 페이지 범위 직접 수정
   - 상태: ✅ 완료

3. **날짜 변경** (`QuickDateEditor`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/items/QuickDateEditor.tsx`
   - 기능: 플랜 날짜 변경
   - 상태: ✅ 완료

4. **시간 변경** (`QuickTimeEditor`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/items/QuickDateEditor.tsx`
   - 기능: 시작/종료 시간 변경
   - 상태: ✅ 완료

5. **단발성 플랜 수정** (`updateAdHocPlan`)
   - 위치: `lib/domains/admin-plan/actions/adHocPlan.ts`
   - 기능: 단발성 플랜 전체 수정
   - 상태: ✅ 완료

#### ❌ 부족한 기능

1. **정규 플랜 전체 수정 모달/폼**
   - 현재: 인라인 편집만 가능 (볼륨, 날짜, 시간)
   - 부족: 제목, 콘텐츠, 과목, 상태 등 전체 필드 수정 UI 없음
   - 액션: `lib/domains/plan/service.ts::updateStudentPlan` 존재하나 UI 없음

2. **플랜 일괄 수정**
   - 현재: 개별 수정만 가능
   - 부족: 여러 플랜 선택하여 일괄 수정 기능 없음
   - 예시: 여러 플랜의 날짜를 한 번에 변경, 상태 일괄 변경

3. **플랜 복사/복제**
   - 현재: 없음
   - 부족: 기존 플랜을 복사하여 새 플랜 생성 기능 없음
   - 사용 사례: 유사한 플랜을 다른 날짜에 빠르게 생성

4. **플랜 템플릿 저장/불러오기**
   - 현재: 없음
   - 부족: 자주 사용하는 플랜 패턴을 템플릿으로 저장하고 재사용하는 기능 없음

#### 📊 수정 기능 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| 인라인 볼륨 수정 | ✅ 완료 | |
| 인라인 진행률 수정 | ✅ 완료 | |
| 날짜 변경 | ✅ 완료 | |
| 시간 변경 | ✅ 완료 | |
| 단발성 플랜 수정 | ✅ 완료 | |
| **정규 플랜 전체 수정** | ❌ **없음** | **우선순위 높음** |
| **플랜 일괄 수정** | ❌ **없음** | **우선순위 중간** |
| **플랜 복사/복제** | ❌ **없음** | **우선순위 중간** |
| **플랜 템플릿** | ❌ **없음** | **우선순위 낮음** |

---

### 3. 플랜 조정 (Adjust/Redistribute)

#### ✅ 구현된 기능

1. **볼륨 재분배** (`RedistributeModal`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/RedistributeModal.tsx`
   - 기능: 플랜 볼륨 조정 및 미래 플랜에 자동 분배
   - 모드:
     - 자동 분배: 미래 플랜에 자동 분배
     - 수동 분배: 특정 날짜 지정
     - 주간 분배: Weekly Dock으로 이동
   - 액션: `lib/domains/admin-plan/actions/planEvent.ts::logVolumeRedistributed`
   - 상태: ✅ 완료

2. **플랜 이월** (`CarryoverButton`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/CarryoverButton.tsx`
   - 기능: 미완료 플랜을 다음 날로 자동 이월
   - 액션: `lib/domains/admin-plan/actions/carryover.ts::runCarryoverForStudent`
   - 상태: ✅ 완료

3. **AI 플랜 최적화** (`PlanOptimizationPanel`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/PlanOptimizationPanel.tsx`
   - 기능: AI 기반 플랜 최적화 제안
   - 상태: ✅ 완료

#### ❌ 부족한 기능

1. **일괄 재분배**
   - 현재: 개별 플랜 재분배만 가능
   - 부족: 여러 플랜을 선택하여 한 번에 재분배하는 기능 없음
   - 참고: `BulkRedistributeModal.tsx` 파일 존재하나 구현 상태 불명확

2. **플랜 그룹 간 이동**
   - 현재: 컨테이너 간 이동만 가능 (Daily ↔ Weekly ↔ Unfinished)
   - 부족: 다른 플랜 그룹으로 플랜 이동 기능 없음
   - 사용 사례: 플랜 그룹 A의 플랜을 플랜 그룹 B로 이동

3. **플랜 순서 변경**
   - 현재: DnD로 컨테이너 내 순서 변경 가능
   - 부족: 명시적인 순서 번호 지정 기능 없음
   - 참고: `lib/domains/plan/actions/move.ts::reorderPlans` 존재하나 UI 없음

#### 📊 조정 기능 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| 볼륨 재분배 | ✅ 완료 | |
| 플랜 이월 | ✅ 완료 | |
| AI 최적화 | ✅ 완료 | |
| **일괄 재분배** | ❌ **없음** | **우선순위 중간** |
| **플랜 그룹 간 이동** | ❌ **없음** | **우선순위 중간** |
| **명시적 순서 지정** | ⚠️ **부분 구현** | DnD만 가능, 번호 지정 UI 없음 |

---

### 4. 플랜 변경 (Change/Move)

#### ✅ 구현된 기능

1. **컨테이너 간 이동** (`movePlanToContainer`)
   - 위치: `lib/domains/admin-plan/actions/containerOperations.ts`
   - 기능: Daily ↔ Weekly ↔ Unfinished 컨테이너 간 이동
   - UI: DnD 및 버튼 클릭
   - 이벤트 로깅: `logContainerMoved`
   - 상태: ✅ 완료

2. **날짜 변경** (`QuickDateEditor`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/items/QuickDateEditor.tsx`
   - 기능: 플랜 날짜 변경
   - 상태: ✅ 완료

3. **시간 변경** (`QuickTimeEditor`)
   - 위치: `app/(admin)/admin/students/[id]/plans/_components/items/QuickDateEditor.tsx`
   - 기능: 시작/종료 시간 변경
   - 상태: ✅ 완료

#### ❌ 부족한 기능

1. **플랜 상태 변경 UI**
   - 현재: 완료 버튼만 있음 (`QuickCompleteButton`)
   - 부족: pending → in_progress → completed 등 상태 전이 UI 없음
   - 액션: `lib/domains/plan/actions/adjustDashboard.ts::updatePlanStatus` 존재하나 UI 없음

2. **플랜 일괄 이동**
   - 현재: 개별 이동만 가능
   - 부족: 여러 플랜을 선택하여 한 번에 이동하는 기능 없음

3. **플랜 그룹 변경**
   - 현재: 없음
   - 부족: 플랜의 `plan_group_id` 변경 기능 없음
   - 사용 사례: 플랜 그룹 A의 플랜을 플랜 그룹 B로 이동

#### 📊 변경 기능 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| 컨테이너 간 이동 | ✅ 완료 | |
| 날짜 변경 | ✅ 완료 | |
| 시간 변경 | ✅ 완료 | |
| **상태 변경 UI** | ⚠️ **부분 구현** | 완료만 가능, 전체 상태 전이 UI 없음 |
| **일괄 이동** | ❌ **없음** | **우선순위 중간** |
| **플랜 그룹 변경** | ❌ **없음** | **우선순위 중간** |

---

### 5. 플랜 삭제 (Delete)

#### ✅ 구현된 기능

1. **개별 플랜 삭제** (`deletePlanWithLogging`)
   - 위치: `lib/domains/admin-plan/actions/containerOperations.ts`
   - 기능: 플랜 소프트 삭제 (is_active = false)
   - 이벤트 로깅: `logPlanDeleted`
   - UI: `PlanItemCard`에서 삭제 버튼
   - 상태: ✅ 완료

2. **단발성 플랜 삭제** (`deleteAdHocPlan`)
   - 위치: `lib/domains/admin-plan/actions/adHocPlan.ts`
   - 기능: 단발성 플랜 하드 삭제
   - 상태: ✅ 완료

3. **플랜 그룹 삭제** (`deletePlanGroup`)
   - 위치: `lib/domains/plan/service.ts`
   - 기능: 플랜 그룹 소프트 삭제
   - 상태: ✅ 완료 (서비스 레이어만, UI 불명확)

#### ❌ 부족한 기능

1. **플랜 일괄 삭제**
   - 현재: 개별 삭제만 가능
   - 부족: 여러 플랜을 선택하여 한 번에 삭제하는 기능 없음
   - 참고: `lib/domains/plan/actions/adjustDashboard.ts::deleteMultiplePlans` 존재하나 UI 없음

2. **플랜 영구 삭제**
   - 현재: 소프트 삭제만 가능 (is_active = false)
   - 부족: 완전 삭제 기능 없음
   - 사용 사례: 실수로 생성된 플랜 완전 제거

3. **삭제 취소 (복구)**
   - 현재: 없음
   - 부족: 삭제된 플랜 복구 기능 없음
   - 사용 사례: 실수로 삭제한 플랜 복구

4. **조건부 일괄 삭제**
   - 현재: 없음
   - 부족: 조건(날짜 범위, 상태, 과목 등)에 맞는 플랜 일괄 삭제 기능 없음

#### 📊 삭제 기능 요약

| 기능 | 상태 | 비고 |
|------|------|------|
| 개별 플랜 삭제 | ✅ 완료 | |
| 단발성 플랜 삭제 | ✅ 완료 | |
| 플랜 그룹 삭제 | ⚠️ 부분 구현 | 서비스만, UI 불명확 |
| **플랜 일괄 삭제** | ❌ **없음** | **우선순위 높음** |
| **영구 삭제** | ❌ **없음** | **우선순위 낮음** |
| **삭제 복구** | ❌ **없음** | **우선순위 중간** |
| **조건부 일괄 삭제** | ❌ **없음** | **우선순위 낮음** |

---

## 🎯 부족한 기능 우선순위

### 🔴 높은 우선순위 (High Priority)

1. **정규 플랜 전체 수정 모달/폼**
   - 이유: 현재 인라인 편집만 가능하여 제목, 콘텐츠 등 주요 필드 수정 불가
   - 영향: 관리자가 플랜을 완전히 수정할 수 없어 불편함
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/EditPlanModal.tsx` (신규)
   - 액션: `lib/domains/plan/service.ts::updateStudentPlan` 활용

2. **플랜 일괄 삭제**
   - 이유: 여러 플랜을 하나씩 삭제하는 것은 비효율적
   - 영향: 대량 플랜 관리 시 시간 소모
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/BulkDeleteModal.tsx` (신규)
   - 액션: `lib/domains/plan/actions/adjustDashboard.ts::deleteMultiplePlans` 활용

### 🟡 중간 우선순위 (Medium Priority)

3. **플랜 일괄 수정**
   - 이유: 여러 플랜의 날짜, 상태 등을 한 번에 변경 필요
   - 영향: 대량 플랜 관리 효율성 향상
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/BulkEditModal.tsx` (신규)

4. **플랜 복사/복제**
   - 이유: 유사한 플랜을 빠르게 생성
   - 영향: 플랜 생성 시간 단축
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/CopyPlanModal.tsx` (신규)

5. **플랜 그룹 간 이동**
   - 이유: 플랜을 다른 플랜 그룹으로 이동 필요
   - 영향: 플랜 그룹 재구성 시 유용
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/MoveToGroupModal.tsx` (신규)

6. **일괄 재분배**
   - 이유: 여러 플랜을 한 번에 재분배
   - 영향: 대량 플랜 조정 효율성 향상
   - 참고: `BulkRedistributeModal.tsx` 파일 존재, 구현 상태 확인 필요

7. **삭제 복구**
   - 이유: 실수로 삭제한 플랜 복구 필요
   - 영향: 데이터 손실 방지
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/DeletedPlansView.tsx` (신규)

8. **플랜 상태 변경 UI**
   - 이유: pending → in_progress → completed 상태 전이 필요
   - 영향: 플랜 진행 상태 관리
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/PlanStatusModal.tsx` (신규)

### 🟢 낮은 우선순위 (Low Priority)

9. **플랜 템플릿 저장/불러오기**
   - 이유: 자주 사용하는 플랜 패턴 재사용
   - 영향: 플랜 생성 시간 단축 (장기적)
   - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/PlanTemplateManager.tsx` (신규)

10. **영구 삭제**
    - 이유: 완전 삭제 필요 (드물게 사용)
    - 영향: 데이터 정리
    - 주의: 복구 불가능하므로 신중한 구현 필요

11. **조건부 일괄 삭제**
    - 이유: 조건에 맞는 플랜 일괄 삭제
    - 영향: 대량 정리 작업
    - 구현 위치: `app/(admin)/admin/students/[id]/plans/_components/ConditionalDeleteModal.tsx` (신규)

12. **명시적 순서 지정**
    - 이유: DnD 외에 번호로 순서 지정
    - 영향: 정확한 순서 제어
    - 참고: `lib/domains/plan/actions/move.ts::reorderPlans` 활용

---

## 📝 구현 가이드라인

### 공통 패턴

1. **모달 컴포넌트 구조**
   ```typescript
   // app/(admin)/admin/students/[id]/plans/_components/[Feature]Modal.tsx
   'use client';
   
   interface [Feature]ModalProps {
     studentId: string;
     tenantId: string;
     planIds?: string[]; // 일괄 작업 시
     onClose: () => void;
     onSuccess: () => void;
   }
   
   export function [Feature]Modal({ ... }: [Feature]ModalProps) {
     // 상태 관리
     // 폼 검증
     // 서버 액션 호출
     // 성공/실패 처리
   }
   ```

2. **서버 액션 위치**
   - 관리자 전용: `lib/domains/admin-plan/actions/[feature].ts`
   - 공통: `lib/domains/plan/actions/[feature].ts`

3. **이벤트 로깅**
   - 모든 변경 사항은 `lib/domains/admin-plan/actions/planEvent.ts`를 통해 로깅
   - 예: `logPlanUpdated`, `logPlanDeleted`, `logPlanMoved`

4. **에러 처리**
   - `AdminPlanResponse<T>` 타입 사용
   - Toast 알림으로 사용자 피드백 제공

5. **캐시 재검증**
   - `revalidatePath` 사용
   - 관련 경로: `/admin/students/[id]/plans`, `/today`, `/plan`

---

## 🔗 관련 파일 참조

### UI 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement.tsx` - 메인 관리 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/items/PlanItemCard.tsx` - 플랜 카드 컴포넌트
- `app/(admin)/admin/students/[id]/plans/_components/QuickActions.tsx` - 인라인 편집 컴포넌트

### 서버 액션
- `lib/domains/admin-plan/actions/containerOperations.ts` - 컨테이너 이동, 삭제
- `lib/domains/admin-plan/actions/adHocPlan.ts` - 단발성 플랜 관리
- `lib/domains/plan/service.ts` - 플랜 서비스 레이어
- `lib/domains/plan/actions/core.ts` - 플랜 CRUD 액션
- `lib/domains/plan/actions/adjustDashboard.ts` - 플랜 조정 액션

### 타입 정의
- `lib/domains/admin-plan/types.ts` - 관리자 플랜 타입
- `lib/types/plan.ts` - 플랜 공통 타입

---

## 📊 기능 완성도 요약

### 2025-02-02 (최초 작성 시)

| 카테고리 | 완료 | 부분 구현 | 미구현 | 완성도 |
|---------|------|----------|--------|--------|
| 생성 | 4 | 1 | 0 | 80% |
| 수정 | 5 | 0 | 4 | 56% |
| 조정 | 3 | 1 | 2 | 50% |
| 변경 | 3 | 1 | 2 | 50% |
| 삭제 | 3 | 1 | 4 | 38% |
| **전체** | **18** | **4** | **12** | **55%** |

### 2026-01-05 (업데이트 후)

| 카테고리 | 완료 | 부분 구현 | 미구현 | 완성도 |
|---------|------|----------|--------|--------|
| 생성 | 5 | 0 | 0 | 100% |
| 수정 | 9 | 0 | 0 | 100% |
| 조정 | 6 | 0 | 0 | 100% |
| 변경 | 6 | 0 | 0 | 100% |
| 삭제 | 7 | 0 | 1 | 88% |
| **전체** | **33** | **0** | **1** | **97%** |

> **미구현 1개**: 영구 삭제 (하드 삭제) - 의도적으로 미구현 (소프트 삭제로 충분)

---

## 🎯 다음 단계

### ✅ 완료된 항목 (2026-01-05)

1. ~~**우선순위 높은 기능부터 구현**~~
   - ✅ 정규 플랜 전체 수정 모달 (`EditPlanModal`)
   - ✅ 플랜 일괄 삭제 (`ConditionalDeleteModal`)

2. ~~**기존 코드 리팩토링**~~
   - ✅ `AddContentModal`의 배치 분배 로직 완성 (`createPlanFromContent`)
   - ✅ `BulkRedistributeModal` → `BulkEditModal`로 대체

### 남은 작업

1. **테스트**
   - 각 기능별 통합 테스트 작성
   - 사용자 시나리오 기반 E2E 테스트

2. **문서화**
   - 사용자 가이드 작성
   - API 문서 업데이트

3. **성능 최적화**
   - React Query 캐싱 전략 검토
   - 대용량 플랜 목록 최적화

---

**최초 작성**: 2025-02-02
**마지막 업데이트**: 2026-01-05

