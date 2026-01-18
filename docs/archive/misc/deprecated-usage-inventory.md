# Deprecated 함수 사용처 목록 및 마이그레이션 계획

## 📋 개요

이 문서는 `lib/utils` 디렉토리에서 발견된 Deprecated 함수들의 사용처를 정리하고, 마이그레이션 계획을 수립한 문서입니다.

**작성일**: 2025-02-04  
**분석 기준**: Phase 1.1 작업 결과

---

## 1. ~~전화번호 유틸리티 (`phoneMasking.ts`)~~ ✅ 완료

> **완료일**: 2025-01-15
> **관련 문서**: `docs/fix-server-action-build-error-2025-01-15.md`

### 완료된 작업
- ✅ `SMSLogsTable.tsx`에서 import 경로를 `@/lib/utils/phone`으로 변경
- ✅ `phoneMasking.ts` 파일 삭제
- ✅ 빌드 검증 완료

---

## 2. 전화번호 유틸리티 재export (`studentFormUtils.ts`)

### Deprecated 부분
- **파일**: `lib/utils/studentFormUtils.ts` (line 53-71)
- **내용**: 전화번호 함수들의 재export
- **대체**: `lib/utils/phone.ts`에서 직접 import

### 사용처 분석

현재 `studentFormUtils.ts`는 단순히 `phone.ts`에서 함수들을 re-export하고 있습니다. 실제 사용처를 확인한 결과:

- 대부분의 코드는 이미 `lib/utils/phone.ts`에서 직접 import하거나
- `studentFormUtils.ts`를 통해 import하지만, 이는 단순 re-export이므로 `phone.ts`로 직접 변경 가능

### 실제 사용 패턴

#### 직접 import 사용 (권장 패턴)
- `app/(admin)/actions/studentManagementActions.ts`: `validatePhoneNumber` 사용
- `app/(student)/settings/_hooks/usePhoneValidation.ts`: `formatPhoneNumber`, `validatePhoneNumber` 사용
- `lib/validation/phoneSchema.ts`: `validatePhoneNumber`, `normalizePhoneNumber` 사용

#### studentFormUtils를 통한 import (마이그레이션 필요)
- 없음 (확인 결과, 직접 import 또는 phone.ts 사용 중)

### 마이그레이션 계획

**작업 내용**:
1. `studentFormUtils.ts`에서 전화번호 함수 재export 제거 (line 53-71)
2. 혹시 남아있는 `studentFormUtils`의 전화번호 함수 import를 `phone.ts`로 변경

**예상 작업 시간**: 0.5일

---

## 3. Supabase Client Selector (`supabaseClientSelector.ts`)

### Deprecated 파일
- **파일**: `lib/utils/supabaseClientSelector.ts`
- **상태**: 전체 파일 deprecated
- **대체**: `lib/supabase/clientSelector.ts`에서 직접 import

### 사용처 분석

**실제 사용처**: 없음

현재 `supabaseClientSelector.ts`는 단순히 `lib/supabase/clientSelector.ts`에서 함수들을 re-export하고 있으며, 모든 실제 사용처는 이미 `lib/supabase/clientSelector.ts`에서 직접 import하고 있습니다.

#### 실제 import 패턴 (올바른 사용)
- `lib/domains/attendance/repository.ts`: `getSupabaseClientForRLSBypass` 직접 import
- `lib/data/studentSearch.ts`: `getSupabaseClientForRLSBypass` 직접 import
- `lib/utils/studentPhoneUtils.ts`: `getSupabaseClientForRLSBypass` 직접 import
- `lib/data/contentMasters.ts`: `getClientForRLSBypass` 직접 import
- `lib/services/smsService.ts`: `getSupabaseClientForRLSBypass` 직접 import

**총 실제 사용처**: 0곳 (모두 올바른 경로 사용 중)

### 마이그레이션 계획

**작업 내용**:
1. `supabaseClientSelector.ts` 파일 삭제

**예상 작업 시간**: 0.1일 (검증 포함)

---

## 4. Plan Group Transform (`transformPlanGroupToWizardData`)

### Deprecated 함수
- **파일**: `lib/utils/planGroupTransform.ts`
- **함수**: `transformPlanGroupToWizardData` (line 335-409)
- **대체**: `transformPlanGroupToWizardDataPure` 사용

### 사용처 분석

**실제 사용처**: 없음

현재 프로젝트 전체에서 `transformPlanGroupToWizardData` 함수의 사용처를 찾을 수 없습니다. 모든 코드가 이미 `transformPlanGroupToWizardDataPure`를 사용하거나 다른 방식으로 마이그레이션된 것으로 보입니다.

### 마이그레이션 계획

**작업 내용**:
1. `transformPlanGroupToWizardData` 함수 제거
2. 테스트 실행 및 검증

**예상 작업 시간**: 0.5일 (검증 포함)

---

## 5. Difficulty Level 필드 (`difficulty_level`)

### Deprecated 필드
- **파일**: `lib/utils/masterContentFormHelpers.ts`
- **필드**: `difficulty_level` (6곳에서 사용)
- **대체**: `difficulty_level_id` 사용 권장

### 사용처 목록

| 함수명 | 라인 | 사용 방식 | 난이도 |
|--------|------|----------|--------|
| `parseMasterCustomContentFormData` | 32 | `difficulty_level: getFormString(formData, "difficulty_level")` | 중간 |
| `parseMasterCustomContentUpdateFormData` | 79 | `difficulty_level: getFormValue("difficulty_level")` | 중간 |
| `parseMasterBookFormData` | 149 | `difficulty_level: getFormString(formData, "difficulty_level")` | 중간 |
| `parseMasterBookUpdateFormData` | 251 | `difficulty_level: getFormValue("difficulty_level")` | 중간 |
| `parseMasterLectureFormData` | 293 | `difficulty_level: getFormString(formData, "difficulty_level")` | 중간 |
| `parseMasterLectureUpdateFormData` | 355 | `difficulty_level: getFormValue("difficulty_level")` | 중간 |

**총 사용처**: 6곳 (모두 같은 파일 내)

### 데이터베이스 스키마 확인

Supabase 스키마 확인 결과:
- `master_books` 테이블: `difficulty_level` (varchar)과 `difficulty_level_id` (uuid FK) 공존
- `master_lectures` 테이블: `difficulty_level` (varchar)과 `difficulty_level_id` (uuid FK) 공존
- `master_custom_contents` 테이블: `difficulty_level` (varchar)과 `difficulty_level_id` (uuid FK) 공존

**참고**: 
- `difficulty_level`은 문자열 필드 (예: "기본", "심화", "개념")
- `difficulty_level_id`는 FK 필드로 `difficulty_levels` 테이블과 연결

### 마이그레이션 계획

**주의사항**:
- 데이터베이스 스키마에 두 필드가 모두 존재하므로, 폼에서 두 필드를 모두 처리해야 할 수 있음
- 하지만 새로운 코드에서는 `difficulty_level_id`만 사용하도록 권장
- 기존 데이터 마이그레이션이 필요할 수 있음

**작업 내용**:
1. 폼 데이터에서 `difficulty_level` 필드 제거
2. `difficulty_level_id`만 사용하도록 수정
3. 폼 컴포넌트에서 `difficulty_level_id`만 전송하도록 확인
4. 기존 데이터 마이그레이션 필요 여부 확인

**예상 작업 시간**: 1일 (폼 컴포넌트 확인 및 수정 포함)

---

## 마이그레이션 우선순위

| 우선순위 | 작업 | 난이도 | 예상 시간 | 리스크 | 상태 |
|---------|------|--------|----------|--------|------|
| 1 | Supabase Client Selector 삭제 | 낮음 | 0.1일 | 낮음 (사용처 없음) | 대기 |
| 2 | Plan Group Transform 함수 제거 | 낮음 | 0.5일 | 낮음 (사용처 없음) | 대기 |
| ~~3~~ | ~~전화번호 유틸리티 통합~~ | ~~낮음~~ | ~~1일~~ | ~~낮음 (1곳만 사용)~~ | ✅ 완료 |
| 4 | Difficulty Level 필드 마이그레이션 | 중간 | 1일 | 중간 (폼 수정 필요) | 대기 |

**총 예상 작업 시간**: 약 1.6일 (전화번호 유틸리티 완료로 1일 단축)

---

## 다음 단계

1. **Phase 1.2**: 전화번호 유틸리티 통합 작업 시작
2. **Phase 1.3**: Supabase Client Selector 파일 삭제
3. **Phase 1.4**: Plan Group Transform 함수 제거
4. **Phase 1.5**: Difficulty Level 필드 마이그레이션 (폼 컴포넌트 확인 필요)

---

## 참고 자료

- 분석 보고서: `docs/2025-02-04-repomix-phase2-utils-analysis.md`
- 개선 계획: `.cursor/plans/lib-utils-5381c25a.plan.md`
- Supabase 스키마: MCP를 통해 확인 완료
