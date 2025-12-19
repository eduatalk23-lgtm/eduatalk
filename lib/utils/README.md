# lib/utils 디렉토리 가이드

## 📋 개요

이 디렉토리는 프로젝트 전체에서 사용하는 공통 유틸리티 함수들을 포함합니다. 약 65개의 파일과 358개의 export를 제공합니다.

---

## 📁 카테고리별 구조

### Form & Data

FormData 파싱, 데이터 포맷팅, 변환 관련 유틸리티

- **`formDataHelpers.ts`**: FormData 파싱 함수
  - `getFormString`, `getFormInt`, `getFormFloat`, `getFormUuid` 등
- **`formatNumber.ts`**: 숫자 포맷팅
- **`formatValue.ts`**: 값 포맷팅
- **`excel.ts`**: Excel 파일 처리 (관리자 기능)

**사용 예시**:
```typescript
import { getFormString, getFormInt } from "@/lib/utils";

const name = getFormString(formData, "name", { required: true });
const age = getFormInt(formData, "age");
```

---

### Date & Time

날짜 및 시간 처리 유틸리티

- **`date.ts`**: 기본 날짜 처리 (UI 컴포넌트용)
  - 타임존 고려하지 않음
  - YYYY-MM-DD 문자열 중심
- **`dateUtils.ts`**: 타임존 고려 날짜 처리 (데이터베이스 쿼리용)
  - Asia/Seoul (KST, UTC+9) 기준
  - date-fns/tz 사용
- **`time.ts`**: 시간 처리
- **`duration.ts`**: 시간 차이 계산
- **`schoolYear.ts`**: 학년도 계산

**사용 예시**:
```typescript
// UI 표시용 (타임존 고려 불필요)
import { formatDateString, getDaysDifference } from "@/lib/utils";
const dateStr = formatDateString(2025, 2, 4); // "2025-02-04"

// 데이터베이스 쿼리용 (타임존 고려 필요)
import { getStartOfDayUTC } from "@/lib/utils/dateUtils";
const startOfDay = getStartOfDayUTC("2025-02-04", "Asia/Seoul");
```

**참고**: `date.ts`와 `dateUtils.ts`의 역할 차이는 [날짜 유틸리티 역할 명확화 문서](../../docs/date-utils-role-clarification.md)를 참고하세요.

---

### Plan (학습 계획)

학습 계획 관련 유틸리티

- **`planUtils.ts`**: 더미 콘텐츠 판별, 완료 판별, 완료율 계산
- **`planStatusUtils.ts`**: 플랜 상태 판별 (재조정 기능용)
- **`planFormatting.ts`**: 플랜 포맷팅 (시간, 날짜, 학습 분량)
- **`planGroupTransform.ts`**: 플랜 그룹 데이터 변환
- **`planGroupAdapters.ts`**: 플랜 그룹 어댑터
- **`planGroupDataSync.ts`**: 플랜 그룹 데이터 동기화
- **`planVersionUtils.ts`**: 플랜 버전 관리
- **`planContentEnrichment.ts`**: 플랜 콘텐츠 보강
- **`planDataMerger.ts`**: 플랜 데이터 병합

**사용 예시**:
```typescript
import { isDummyContent, calculateCompletionRate } from "@/lib/utils/planUtils";
import { isReschedulable } from "@/lib/utils/planStatusUtils";
import { formatPlanTime } from "@/lib/utils/planFormatting";

// 더미 콘텐츠 확인
if (isDummyContent(plan.content_id)) {
  // 더미 콘텐츠 처리
}

// 완료율 계산
const rate = calculateCompletionRate(allPlans);

// 재조정 가능 여부
if (isReschedulable(plan)) {
  // 재조정 UI 표시
}
```

**참고**: 플랜 유틸리티의 역할 차이는 [플랜 유틸리티 역할 명확화 문서](../../docs/plan-utils-role-clarification.md)를 참고하세요.

---

### Student (학생)

학생 관련 유틸리티

- **`studentFormUtils.ts`**: 학생 폼 관련 (학교 타입, 학년, 전화번호)
- **`studentFilterUtils.ts`**: 학생 필터링
- **`studentPhoneUtils.ts`**: 학생 전화번호 처리
- **`studentProfile.ts`**: 학생 프로필 처리
- **`studentSearchMapper.ts`**: 학생 검색 매핑

**사용 예시**:
```typescript
import { detectSchoolType, parseGradeNumber } from "@/lib/utils/studentFormUtils";

const schoolType = detectSchoolType(school); // "중학교" | "고등학교" | ""
const grade = parseGradeNumber("중3"); // "3"
```

---

### Content (콘텐츠)

콘텐츠 관련 유틸리티

- **`contentDetailsUtils.ts`**: 콘텐츠 상세 정보 (타입 확인, API 엔드포인트, 데이터 변환)
- **`contentFilters.ts`**: 콘텐츠 필터링
- **`contentMaster.ts`**: 마스터 콘텐츠 처리
- **`contentSort.ts`**: 콘텐츠 정렬

**사용 예시**:
```typescript
import {
  getContentType,
  isBookType,
  getStudentContentDetailsEndpoint,
} from "@/lib/utils/contentDetailsUtils";

const contentType = getContentType(contentId, bookIdSet, lectureIdSet);
if (isBookType(contentType)) {
  // 교재 처리
}
```

---

### Supabase (데이터베이스)

Supabase 관련 유틸리티

- **`supabaseHelpers.ts`**: Supabase 헬퍼 함수
- **`supabaseErrorHandler.ts`**: Supabase 에러 처리
- **`supabaseQueryBuilder.ts`**: 쿼리 빌더
- **`databaseFallback.ts`**: 데이터베이스 에러 fallback 처리

**사용 예시**:
```typescript
import { handleSupabaseQuery } from "@/lib/utils/supabaseErrorHandler";
import { withErrorFallback, ErrorCodeCheckers } from "@/lib/utils/databaseFallback";

// 에러 처리
const data = await handleSupabaseQuery(
  () => supabase.from("students").select("*"),
  []
);

// Fallback 처리
const result = await withErrorFallback(
  () => query(),
  () => fallbackQuery(),
  ErrorCodeCheckers.isColumnNotFound
);
```

---

### UI

UI 관련 유틸리티

- **`darkMode.ts`**: 다크모드 관련
- **`cssVariables.ts`**: CSS 변수
- **`spacing.ts`**: Spacing 유틸리티
- **`scroll.ts`**: 스크롤 처리

---

### Validation (유효성 검사)

유효성 검사 관련 유틸리티

- **`rangeValidation.ts`**: 범위 유효성 검사
- **`tenantValidation.ts`**: 테넌트 유효성 검사
- **`phone.ts`**: 전화번호 유효성 검사

**사용 예시**:
```typescript
import { validatePhoneNumber } from "@/lib/utils/phone";

const validation = validatePhoneNumber("010-1234-5678");
if (!validation.valid) {
  console.error(validation.error);
}
```

---

### Cache & Performance

캐싱 및 성능 최적화

- **`cache.ts`**: 클라이언트 사이드 캐싱
- **`performance.ts`**: 성능 측정
- **`scheduleCache.ts`**: 스케줄 캐싱

---

### URL & Routing

URL 처리 및 라우팅

- **`getBaseUrl.ts`**: BASE_URL 처리
- **`getEmailRedirectUrl.ts`**: 이메일 리다이렉트 URL
- **`shallowRouting.ts`**: Shallow routing
- **`urlHelpers.ts`**: URL 헬퍼

---

## 📚 주요 사용 가이드

### index.ts 사용

대부분의 주요 유틸리티는 `lib/utils/index.ts`에서 export됩니다:

```typescript
import { getFormString, formatDateString } from "@/lib/utils";
```

### 직접 import

특정 유틸리티는 해당 파일에서 직접 import합니다:

```typescript
import { getStartOfDayUTC } from "@/lib/utils/dateUtils";
import { isDummyContent } from "@/lib/utils/planUtils";
```

---

## 🔍 Deprecated 함수

Phase 1에서 Deprecated 함수들이 마이그레이션되었습니다:

- ✅ `phoneMasking.ts` → `phone.ts`로 통합 완료
- ✅ `supabaseClientSelector.ts` → `lib/supabase/clientSelector.ts`로 이동 완료
- ✅ `transformPlanGroupToWizardData` → `transformPlanGroupToWizardDataPure` 사용 완료
- ✅ `difficulty_level` 필드 → `difficulty_level_id` 사용 완료

자세한 내용은 [Deprecated 함수 사용처 목록](../../docs/deprecated-usage-inventory.md)을 참고하세요.

---

## 🎯 타입 안전성

### ContentType 타입 가드

`contentDetailsUtils.ts`에서 ContentType 타입 가드를 제공합니다:

```typescript
import {
  isBookType,
  isLectureType,
  isCustomType,
  assertExhaustiveContentType,
} from "@/lib/utils/contentDetailsUtils";

if (isBookType(contentType)) {
  // 타입이 "book"으로 좁혀짐
}
```

### Exhaustive Checking

switch 문에서 모든 케이스를 처리하도록 보장:

```typescript
switch (contentType) {
  case "book":
    // ...
    break;
  case "lecture":
    // ...
    break;
  case "custom":
    // ...
    break;
  default:
    assertExhaustiveContentType(contentType, contentType);
}
```

---

## 📝 에러 처리 패턴

프로젝트에서는 여러 에러 처리 패턴을 사용합니다:

1. **null 반환**: 에러 정보가 불필요한 경우
2. **throw**: 예외적 상황 (프로그래밍 오류 등)
3. **객체 반환**: `{ valid: boolean; error?: string }` (폼 유효성 검사 등)
4. **Result 타입**: 복잡한 에러 처리가 필요한 경우 (선택적 사용)

자세한 내용은 [Result 타입 도입 검토 문서](../../docs/result-type-adoption-review.md)를 참고하세요.

---

## 🔗 관련 문서

- [lib/utils 개선 계획](../../.cursor/plans/lib-utils-5381c25a.plan.md)
- [날짜 유틸리티 역할 명확화](../../docs/date-utils-role-clarification.md)
- [플랜 유틸리티 역할 명확화](../../docs/plan-utils-role-clarification.md)
- [Deprecated 함수 사용처 목록](../../docs/deprecated-usage-inventory.md)
- [Result 타입 도입 검토](../../docs/result-type-adoption-review.md)
- [Phase 1 완료 보고서](../../docs/lib-utils-improvement-phase1-complete.md)
- [Phase 2 완료 보고서](../../docs/lib-utils-improvement-phase2-complete.md)
- [Phase 3 완료 보고서](../../docs/lib-utils-improvement-phase3-complete.md)

---

**최종 업데이트**: 2025-02-04
