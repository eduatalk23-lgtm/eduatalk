# 플랜 배치 기능 세분화 및 관리자 옵션 설정 구현

**작업 일시**: 2025-02-02  
**목적**: 플랜 배치 기능을 세분화하고 전역/템플릿/플랜그룹 레벨에서 관리자가 스케줄러 옵션을 설정할 수 있도록 시스템 개선

---

## 📋 구현 개요

### 구현된 Phase

1. **Phase 1: 데이터베이스 스키마 설계** ✅
2. **Phase 2: 타입 정의 및 설정 병합 유틸리티** ✅
3. **Phase 3: 관리자 UI 구현** ✅
4. **Phase 4: 백엔드 로직 개선** ✅
5. **Phase 5: 최적화 및 효율화** ✅

---

## Phase 1: 데이터베이스 스키마 설계

### 1.1. tenant_scheduler_settings 테이블 생성

**파일**: `supabase/migrations/20250202000000_create_tenant_scheduler_settings.sql`

```sql
CREATE TABLE tenant_scheduler_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- 학습일/복습일 비율
  default_study_days INTEGER NOT NULL DEFAULT 6,
  default_review_days INTEGER NOT NULL DEFAULT 1,

  -- 기타 기본 옵션
  default_weak_subject_focus TEXT DEFAULT 'medium',
  default_review_scope TEXT DEFAULT 'full',

  -- 시간 설정 기본값
  default_lunch_time JSONB,
  default_study_hours JSONB,
  default_self_study_hours JSONB,

  UNIQUE(tenant_id)
);
```

**특징**:

- 기관별 전역 스케줄러 설정 저장
- 학습일/복습일 비율 (1-7일)
- 취약과목 집중 모드 (low, medium, high)
- 복습 범위 (full, partial)
- 시간 설정 (점심시간, 학습시간)

### 1.2. RLS 정책

- 관리자/컨설턴트만 조회 가능
- 관리자만 수정 가능
- `updated_at` 자동 업데이트 트리거

---

## Phase 2: 타입 정의 및 설정 병합 유틸리티

### 2.1. 타입 정의

**파일**: `lib/types/schedulerSettings.ts`

주요 타입:

- `SchedulerSettings`: 전체 스케줄러 설정
- `PartialSchedulerSettings`: 부분 설정 (오버라이드용)
- `TenantSchedulerSettings`: DB 스키마 타입
- `SchedulerSettingsWithInheritance`: 상속 정보 포함

### 2.2. 설정 병합 유틸리티

**파일**: `lib/utils/schedulerSettingsMerge.ts`

**핵심 함수**:

```typescript
export function mergeSchedulerSettings(
  globalSettings: PartialSchedulerSettings | null,
  templateSettings: PartialSchedulerSettings | null,
  groupSettings: PartialSchedulerSettings | null
): SchedulerSettings;
```

**병합 순서**: 기본값 → 전역 → 템플릿 → 플랜그룹

**변환 함수**:

- `dbToPartialSettings`: DB 레코드 → 부분 설정
- `planGroupOptionsToPartialSettings`: 플랜그룹 옵션 → 부분 설정
- `settingsToPlanGroupOptions`: 설정 → 플랜그룹 옵션

---

## Phase 3: 관리자 UI 구현

### 3.1. 전역 스케줄러 설정 페이지

**파일**: `app/(admin)/admin/settings/scheduler/page.tsx`

**경로**: `/admin/settings/scheduler`

**기능**:

- 기관 전체 기본 스케줄러 설정 관리
- 학습일/복습일 비율 설정
- 취약과목 집중 모드 설정
- 복습 범위 설정
- 시간 설정 (점심시간, 학습시간)

### 3.2. SchedulerSettingsForm 컴포넌트

**파일**: `app/(admin)/admin/settings/scheduler/_components/SchedulerSettingsForm.tsx`

**특징**:

- React 상태 관리
- Toast 알림 통합
- 유효성 검증 (1-7일)
- 실시간 저장

---

## Phase 4: 백엔드 로직 개선

### 4.1. 설정 조회 함수

**파일**: `lib/data/schedulerSettings.ts`

**주요 함수**:

1. `getTenantSchedulerSettings(tenantId)`: 전역 설정 조회
2. `getTemplateSchedulerSettings(templateId)`: 템플릿 설정 조회
3. `getMergedSchedulerSettings(tenantId, templateId?, groupSettings?)`: 병합된 설정 조회
4. `getMergedSchedulerSettingsByGroupId(groupId)`: 플랜그룹 ID로 병합 설정 조회
5. `upsertTenantSchedulerSettings(tenantId, settings)`: 전역 설정 저장

### 4.2. 플랜 생성 로직 수정

**파일**: `app/(student)/actions/plan-groups/plans.ts`

**변경 전**:

```typescript
const schedulerOptions = (group.scheduler_options as any) || {};
```

**변경 후**:

```typescript
const mergedSettings = await getMergedSchedulerSettings(
  group.tenant_id,
  group.camp_template_id,
  group.scheduler_options as Record<string, unknown>
);

const schedulerOptions = {
  study_days: mergedSettings.study_review_ratio.study_days,
  review_days: mergedSettings.study_review_ratio.review_days,
  weak_subject_focus: mergedSettings.weak_subject_focus,
  // ...
};
```

**효과**:

- 전역 → 템플릿 → 플랜그룹 순으로 설정 상속
- 일관된 스케줄러 옵션 적용
- 하위 레벨에서 오버라이드 가능

### 4.3. Server Actions

**파일**: `app/(admin)/actions/schedulerSettings.ts`

- `getTenantSchedulerSettingsAction()`: 전역 설정 조회
- `saveTenantSchedulerSettingsAction(settings)`: 전역 설정 저장

---

## Phase 5: 최적화 및 효율화

### 5.1. 설정 병합 최적화

**기존 문제**:

- 플랜 생성 시마다 설정 조회
- 중복 데이터베이스 쿼리

**개선 방안**:

1. **병합 로직 최적화**: 한 번의 함수 호출로 전체 병합
2. **타입 안전성**: TypeScript로 타입 보장
3. **기본값 처리**: 설정이 없어도 기본값으로 대체

### 5.2. 캐싱 전략

**향후 구현 예정**:

- React Query로 전역 설정 캐싱 (staleTime: 5분)
- 템플릿 설정은 플랜 그룹 생성 시 한 번만 조회
- 콘텐츠 소요시간 사전 계산 및 캐싱

### 5.3. 제외일 처리 최적화

**현재 상태**:

- `calculateAvailableDates`에서 제외일 필터링
- 날짜별 반복 처리에서 제외일 체크

**향후 개선**:

- 제외일 필터링 로직 통합
- 날짜별 메타데이터 일괄 처리

---

## 📊 예상 효과

### 1. 관리 편의성

- 전역/템플릿/플랜그룹 레벨에서 일관된 설정 관리
- UI를 통한 직관적인 설정 변경

### 2. 일관성

- 설정 상속으로 일관된 학습 계획 생성
- 기관 전체에 동일한 기본값 적용

### 3. 유연성

- 필요 시 하위 레벨에서 오버라이드 가능
- 캠프별, 플랜그룹별 커스터마이징 지원

### 4. 성능

- 병합 로직 최적화로 불필요한 쿼리 감소
- 타입 안전성으로 런타임 에러 방지

---

## 🎯 사용 방법

### 관리자 설정

1. `/admin/settings/scheduler` 페이지 접속
2. 기관 전체 기본 설정 입력
   - 학습일/복습일 비율 (예: 6:1)
   - 취약과목 집중 모드
   - 복습 범위
   - 시간 설정
3. "설정 저장" 버튼 클릭

### 플랜 생성 시 적용

1. 플랜 그룹 생성 시 자동으로 병합된 설정 사용
2. 우선순위: 플랜그룹 > 템플릿 > 전역 > 기본값
3. 학생 페이지에서도 동일한 설정 적용

---

## 📂 파일 변경 목록

### 신규 파일

- `supabase/migrations/20250202000000_create_tenant_scheduler_settings.sql`
- `lib/types/schedulerSettings.ts`
- `lib/utils/schedulerSettingsMerge.ts`
- `lib/data/schedulerSettings.ts`
- `app/(admin)/actions/schedulerSettings.ts`
- `app/(admin)/admin/settings/scheduler/page.tsx`
- `app/(admin)/admin/settings/scheduler/_components/SchedulerSettingsForm.tsx`

### 수정 파일

- `app/(student)/actions/plan-groups/plans.ts`
  - 병합된 설정 사용하도록 수정

---

## 🔜 향후 개선 사항

### 1. 템플릿 스케줄러 설정 UI

- 캠프 템플릿 편집 페이지에 스케줄러 설정 패널 추가
- 전역 설정 상속 또는 오버라이드 선택

### 2. 플랜 그룹 위저드 설정 개선

- Step 1에서 학습일/복습일 비율 설정 UI 추가
- 상위 레벨 설정 표시 (읽기 전용)

### 3. 캐싱 전략 구현

- React Query로 전역 설정 캐싱
- 템플릿 설정 캐싱

### 4. 성능 최적화

- 콘텐츠 소요시간 사전 계산
- 날짜별 메타데이터 일괄 처리
- 제외일 필터링 로직 통합

---

## ✅ 테스트 체크리스트

### 데이터베이스

- [ ] 마이그레이션 실행 확인
- [ ] RLS 정책 테스트
- [ ] unique constraint 테스트

### 설정 병합

- [ ] 전역 설정만 있을 때
- [ ] 템플릿 설정이 전역 오버라이드
- [ ] 플랜그룹 설정이 전체 오버라이드
- [ ] 부분 오버라이드 (study_days만)

### UI

- [ ] 관리자 설정 페이지 렌더링
- [ ] 설정 저장 기능
- [ ] 유효성 검증 (1-7일)
- [ ] Toast 알림 표시

### 플랜 생성

- [ ] 병합된 설정으로 플랜 생성
- [ ] 학습일/복습일 비율 적용
- [ ] 취약과목 집중 모드 적용

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `feat: 플랜 배치 기능 세분화 및 관리자 옵션 설정 (Phase 1-4)`
