# 강의 목록 조회 에러 수정

## 문제 상황

`[data/planContents] 강의 목록 조회 실패 {}` 에러가 발생했습니다.

### 에러 위치
- `lib/data/planContents.ts:104:13` - `fetchStudentLectures` 함수
- 호출 스택: `fetchAllStudentContents` → `NewPlanGroupPage`

### 원인 분석

1. **컬럼명 불일치**: `fetchStudentLectures` 함수에서 `master_lecture_id` 컬럼을 조회하려고 했지만, 실제 데이터베이스의 `lectures` 테이블에는 `master_content_id` 컬럼이 존재합니다.

2. **다른 파일과의 불일치**: 
   - `lib/data/contentMetadata.ts`에서는 `master_content_id`를 사용
   - `lib/data/planContents.ts`의 `classifyPlanContents` 함수에서도 `master_content_id`를 사용
   - `fetchStudentLectures`만 `master_lecture_id`를 사용하여 불일치 발생

3. **에러 로깅 부족**: 에러 객체가 빈 객체 `{}`로 출력되어 디버깅이 어려웠습니다.

## 수정 내용

### 1. 컬럼명 수정 (`lib/data/planContents.ts`)

```typescript
// 수정 전
.select("id, title, subject, master_lecture_id")
master_content_id: lecture.master_lecture_id || null,

// 수정 후
.select("id, title, subject, master_content_id")
master_content_id: lecture.master_content_id || null,
```

### 2. 에러 로깅 개선

모든 콘텐츠 조회 함수의 에러 로깅을 개선하여 더 자세한 정보를 출력하도록 수정:

- `fetchStudentBooks`
- `fetchStudentLectures`
- `fetchStudentCustomContents`

```typescript
// 수정 전
console.error("[data/planContents] 강의 목록 조회 실패", err);

// 수정 후
console.error("[data/planContents] 강의 목록 조회 실패", {
  error: err instanceof Error ? err.message : String(err),
  stack: err instanceof Error ? err.stack : undefined,
  studentId,
});
```

## 수정된 파일

- `lib/data/planContents.ts`

## 테스트 확인 사항

1. `/plan/new-group` 페이지에서 강의 목록이 정상적으로 조회되는지 확인
2. 콘솔에 에러가 발생하지 않는지 확인
3. 다른 콘텐츠 조회 함수들도 정상 작동하는지 확인

## 관련 이슈

- 데이터베이스 스키마와 코드 간의 불일치 문제
- 에러 로깅 개선을 통한 디버깅 용이성 향상

