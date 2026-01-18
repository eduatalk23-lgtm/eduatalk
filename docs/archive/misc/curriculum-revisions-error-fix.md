# 개정교육과정 조회 에러 수정

## 📋 문제 상황

### 에러 메시지
```
[contentMetadata] 개정교육과정 조회 실패 {}
```

### 발생 위치
- `lib/data/contentMetadata.ts:347:13` - `getCurriculumRevisions()` 함수
- `app/(student)/contents/page.tsx:130:70` - `StudentContentFilterWrapper` 컴포넌트

### 문제점
1. 에러 객체가 빈 객체 `{}`로 표시되어 디버깅이 어려움
2. `getCurriculumRevisions()` 실패 시 전체 페이지가 실패함
3. 에러 객체의 구조가 예상과 다를 수 있음 (Supabase 에러 객체)

---

## 🔧 수정 내용

### 1. 에러 로깅 개선 (`lib/data/contentMetadata.ts`)

**변경 전:**
```typescript
if (error) {
  console.error("[contentMetadata] 개정교육과정 조회 실패", error);
  throw new Error(`개정교육과정 조회 실패: ${error.message}`);
}
```

**변경 후:**
```typescript
if (error) {
  // 에러 객체의 모든 속성을 상세히 로깅
  console.error("[contentMetadata] 개정교육과정 조회 실패", {
    error,
    errorMessage: error.message,
    errorCode: error.code,
    errorDetails: error.details,
    errorHint: error.hint,
    errorStringified: JSON.stringify(error, null, 2),
  });
  
  // 에러 메시지가 없을 경우를 대비한 처리
  const errorMessage = error.message || error.details || error.hint || "알 수 없는 오류";
  throw new Error(`개정교육과정 조회 실패: ${errorMessage}`);
}
```

**개선 사항:**
- 에러 객체의 모든 속성 로깅 (`message`, `code`, `details`, `hint`)
- JSON 직렬화를 통한 전체 에러 객체 출력
- 에러 메시지가 없을 경우 대체 메시지 제공
- try-catch 블록으로 예상치 못한 에러 처리

### 2. 페이지 레벨 에러 처리 개선 (`app/(student)/contents/page.tsx`)

**변경 전:**
```typescript
const [curriculumRevisions, publishers, platforms, difficulties] = await Promise.all([
  getCurriculumRevisions(),
  // ...
]);
```

**변경 후:**
```typescript
const [curriculumRevisions, publishers, platforms, difficulties] = await Promise.allSettled([
  getCurriculumRevisions(),
  // ...
]).then((results) =>
  results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      console.error("[StudentContentFilterWrapper] 필터 옵션 조회 실패", result.reason);
      return [];
    }
  })
);
```

**개선 사항:**
- `Promise.all` → `Promise.allSettled`로 변경하여 일부 실패해도 계속 진행
- 에러 발생 시 빈 배열 반환으로 페이지 정상 동작 보장
- 타입 안전성을 위한 배열 체크 추가

### 3. 타입 안전성 개선

```typescript
const filterOptions = {
  curriculumRevisions: Array.isArray(curriculumRevisions)
    ? curriculumRevisions.map((rev) => ({
        id: rev.id,
        name: rev.name,
      }))
    : [],
  publishers: activeTab === "books" && Array.isArray(publishers) ? publishers : undefined,
  platforms: activeTab === "lectures" && Array.isArray(platforms) ? platforms : undefined,
  difficulties: Array.isArray(difficulties) ? difficulties : [],
};
```

**개선 사항:**
- `Array.isArray()` 체크로 타입 안전성 보장
- 각 필터 옵션에 대한 안전한 접근

---

## 🎯 기대 효과

1. **디버깅 개선**: 상세한 에러 로깅으로 문제 원인 파악 용이
2. **사용자 경험 개선**: 필터 옵션 조회 실패 시에도 페이지 정상 동작
3. **타입 안전성**: 런타임 타입 체크로 예상치 못한 에러 방지
4. **견고성 향상**: 일부 API 실패해도 전체 기능이 중단되지 않음

---

## 🔍 추가 확인 사항

### 가능한 원인
1. **테이블 미존재**: `curriculum_revisions` 테이블이 마이그레이션되지 않았을 수 있음
2. **RLS 정책**: Row Level Security 정책으로 인한 접근 제한
3. **Admin 클라이언트**: Service Role Key가 설정되지 않았을 수 있음
4. **권한 문제**: 현재 사용자가 테이블에 접근할 권한이 없을 수 있음

### 확인 방법
1. Supabase 대시보드에서 `curriculum_revisions` 테이블 존재 여부 확인
2. 마이그레이션 파일 확인 (`supabase/migrations/`)
3. 환경 변수 `SUPABASE_SERVICE_ROLE_KEY` 설정 확인
4. 브라우저 콘솔에서 상세 에러 로그 확인

---

## 📝 관련 파일

- `lib/data/contentMetadata.ts` - `getCurriculumRevisions()` 함수
- `app/(student)/contents/page.tsx` - 콘텐츠 페이지 필터 컴포넌트
- `lib/supabase/admin.ts` - Admin 클라이언트 생성

---

**작업 일시**: 2025-01-XX  
**작업자**: AI Assistant

