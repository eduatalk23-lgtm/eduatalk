# 마스터 콘텐츠 CRUD 최적화 및 상세정보 저장 수정

**작업 일자**: 2025-02-15  
**작업 범위**: 마스터 콘텐츠 CRUD 코드 최적화 및 상세정보 저장 문제 해결

## 작업 개요

콘텐츠 등록 시 상세정보(단원명, 회차, 페이지, 강의시간)가 저장되지 않는 문제를 해결하고, 중복 코드를 제거하여 CRUD 코드를 최적화했습니다.

## 해결한 문제점

### 1. 상세정보 저장 실패 문제

#### 1.1 강의 Episode 저장 실패
- **문제**: `createLectureEpisode` 함수에서 `title` 필드를 사용하지만 DB는 `episode_title` 필드를 사용
- **해결**: `lib/data/contentMasters.ts`의 `createLectureEpisode` 및 `updateLectureEpisode` 함수에서 `episode_title` 필드 사용하도록 수정

#### 1.2 플랫폼 필드 불일치
- **문제**: `addMasterLecture`에서 `platform_name`을 사용하지만 `createMasterLecture`는 `platform` 필드를 사용
- **해결**: `app/(student)/actions/masterContentActions.ts`에서 `platform` 필드로 통일

#### 1.3 에러 처리 부재
- **문제**: try-catch로 에러를 조용히 무시하여 사용자에게 알림 없음
- **해결**: 에러 발생 시 사용자에게 명확한 에러 메시지를 throw하도록 수정

### 2. 중복 코드 제거 및 최적화

#### 2.1 FormData 파싱 유틸리티 함수 생성
- **파일**: `lib/utils/formDataHelpers.ts` (신규 생성)
- **기능**: FormData에서 문자열/숫자/UUID 값을 안전하게 추출하는 헬퍼 함수들 제공

#### 2.2 마스터 커스텀 콘텐츠 FormData 파싱 헬퍼 생성
- **파일**: `lib/utils/masterContentFormHelpers.ts` (신규 생성)
- **기능**: 마스터 커스텀 콘텐츠 생성/수정용 FormData 파싱 로직 통합

#### 2.3 권한 체크 헬퍼 함수 생성
- **파일**: `lib/auth/requireAdminOrConsultant.ts` (신규 생성)
- **기능**: 관리자/컨설턴트 권한 체크 로직 통합

#### 2.4 마스터 커스텀 콘텐츠 액션 개선
- **파일**: `app/(admin)/actions/masterCustomContentActions.ts`
- **개선 사항**:
  - `withErrorHandling` 적용
  - `requireAdminOrConsultant` 사용
  - FormData 파싱 헬퍼 사용
  - `AppError` 사용

#### 2.5 데이터 레이어 에러 처리 개선
- **파일**: `lib/data/contentMasters.ts`
- **개선 사항**: `normalizeError` 사용하여 에러 처리 통일

## 수정된 파일 목록

### 필수 수정 파일

1. **`lib/data/contentMasters.ts`**
   - `createLectureEpisode`: `title` → `episode_title` 수정
   - `updateLectureEpisode`: `title` → `episode_title` 수정
   - `createMasterCustomContent`, `updateMasterCustomContent`, `deleteMasterCustomContent`: `normalizeError` 적용

2. **`app/(student)/actions/masterContentActions.ts`**
   - Episode 데이터 구조: `title` → `episode_title` 수정
   - 플랫폼 필드: `platform_name` → `platform` 수정
   - 에러 처리: 조용한 실패 → 사용자 알림으로 변경

3. **`app/(student)/contents/_components/LectureEpisodesManager.tsx`**
   - Hidden input의 JSON 구조에서 `episode_title` 필드 사용 (이미 올바르게 구현되어 있음)

### 최적화 파일

4. **`lib/utils/formDataHelpers.ts`** (신규 생성)
   - `getFormString`: 문자열 값 추출
   - `getFormInt`: 숫자 값 추출
   - `getFormUuid`: UUID 값 추출
   - `getFormArray`: 배열 값 추출
   - `getFormTags`: 태그 문자열 파싱

5. **`lib/utils/masterContentFormHelpers.ts`** (신규 생성)
   - `parseMasterCustomContentFormData`: 생성용 데이터 추출
   - `parseMasterCustomContentUpdateFormData`: 수정용 데이터 추출

6. **`lib/auth/requireAdminOrConsultant.ts`** (신규 생성)
   - `requireAdminOrConsultant`: 권한 체크 통합 함수

7. **`app/(admin)/actions/masterCustomContentActions.ts`**
   - `withErrorHandling` 적용
   - `requireAdminOrConsultant` 사용
   - FormData 파싱 헬퍼 사용
   - `AppError` 사용

## 주요 변경 사항

### 1. Episode 저장 로직 수정

**이전 코드**:
```typescript
// lib/data/contentMasters.ts
.insert({
  title: data.title || null,  // ❌ DB에는 episode_title 필드가 있음
  // ...
})
```

**수정 후**:
```typescript
// lib/data/contentMasters.ts
.insert({
  episode_title: data.episode_title || null,  // ✅ DB 스키마와 일치
  // ...
})
```

### 2. 에러 처리 개선

**이전 코드**:
```typescript
try {
  await createLectureEpisode({...});
} catch (error) {
  console.error("episode 정보 추가 실패:", error);
  // ❌ 조용히 실패, 사용자에게 알림 없음
}
```

**수정 후**:
```typescript
try {
  await createLectureEpisode({...});
} catch (error) {
  console.error("episode 정보 추가 실패:", error);
  // ✅ 사용자에게 명확한 에러 메시지 제공
  throw new Error(
    `강의는 생성되었지만 회차 정보 저장에 실패했습니다: ${
      error instanceof Error ? error.message : "알 수 없는 오류"
    }`
  );
}
```

### 3. FormData 파싱 유틸리티 도입

**이전 코드**:
```typescript
const subjectIdRaw = formData.get("subject_id")?.toString();
const subjectId = subjectIdRaw && subjectIdRaw.trim() !== "" ? subjectIdRaw.trim() : null;
```

**수정 후**:
```typescript
import { getFormUuid } from "@/lib/utils/formDataHelpers";

const subjectId = getFormUuid(formData, "subject_id");
```

### 4. 권한 체크 통합

**이전 코드**:
```typescript
const { role } = await getCurrentUserRole();
if (role !== "admin" && role !== "consultant") {
  throw new Error("권한이 없습니다.");
}
```

**수정 후**:
```typescript
import { requireAdminOrConsultant } from "@/lib/auth/requireAdminOrConsultant";

await requireAdminOrConsultant();
```

## 검증 방법

1. **강의 등록 테스트**: Episode 정보가 정상적으로 저장되는지 확인
2. **교재 등록 테스트**: 상세정보(단원명, 페이지)가 정상적으로 저장되는지 확인
3. **에러 처리 테스트**: 저장 실패 시 사용자에게 적절한 에러 메시지 표시 확인
4. **코드 중복 검사**: 권한 체크, FormData 파싱 로직 중복 제거 확인

## 참고 사항

- 데이터베이스 스키마 확인 완료: `lecture_episodes.episode_title` 필드 존재
- `master_lectures` 테이블에는 `platform` 필드만 존재 (`platform_name` 없음)
- Next.js 15 모범 사례: Zod 검증, `useActionState` 에러 처리 패턴 적용 고려

## 향후 개선 사항

1. **Zod 스키마 검증 도입**: FormData 검증을 Zod 스키마로 통합
2. **타입 안전성 강화**: `MasterLecture` 타입의 `platform_name` 필드 제거 검토
3. **에러 처리 표준화**: 모든 CRUD 함수에 `normalizeError` 적용 확대

