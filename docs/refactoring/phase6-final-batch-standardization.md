# Phase 6: 잔여 파일 일괄 표준화

## 작업 일시
2024-12-21

## 목표
`app/actions/` 및 `app/api/` 디렉토리 내의 잔여 파일들을 표준화하여 `lib/data` 함수를 사용하고 `apiSuccess`/`handleApiError` 패턴을 적용합니다.

## 작업 내용

### 1. `app/api/goals/list/route.ts` 리팩토링

**변경 사항:**
- `supabase.from("student_goals")` 직접 호출 제거
- `lib/data/studentGoals.ts`의 `getGoalsForStudent` 함수 사용
- `getCurrentUser`를 사용하여 인증 처리 개선
- 타입 안전성 향상

**Before:**
```typescript
const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
const { data: goals, error } = await supabase
  .from("student_goals")
  .select("id,title,goal_type,subject")
  .eq("student_id", user.id);
```

**After:**
```typescript
const user = await getCurrentUser();
const goals = await getGoalsForStudent({
  studentId: user.userId,
  tenantId: user.tenantId,
});
```

### 2. `app/api/schools/search/route.ts` 리팩토링

**변경 사항:**
- `supabase.from("schools")` 직접 호출 제거
- `lib/data/schools.ts`의 `searchAllSchools`와 `getSchoolByUnifiedId` 함수 사용
- 학교 타입 매핑 로직 추가 (한글 ↔ 영문)
- 타입 안전성 향상

**Before:**
```typescript
const { data: schools, error } = await supabase
  .from("schools")
  .select("id, name, type, region")
  .ilike("name", `%${query.trim()}%`);
```

**After:**
```typescript
const results = await searchAllSchools({
  query: query.trim(),
  schoolType: type ? SCHOOL_TYPE_MAP[type] : undefined,
  limit: 50,
});
```

### 3. `app/api/student-content-details/route.ts` 리팩토링

**변경 사항:**
- `supabase.from("master_books")` 및 `supabase.from("master_lectures")` 직접 호출 제거
- `lib/data/contentMasters.ts`의 `getMasterBookById`와 `getMasterLectureById` 함수 사용
- `createTypedSingleQuery`를 사용하여 `books` 및 `lectures` 테이블 조회 표준화
- 에러 처리 개선

**Before:**
```typescript
const masterBookPromise = !totalPages && studentBook?.master_content_id
  ? supabase
      .from("master_books")
      .select("total_pages")
      .eq("id", studentBook.master_content_id)
      .maybeSingle()
  : Promise.resolve({ data: null });
```

**After:**
```typescript
if (!totalPages && studentBookData?.master_content_id) {
  const masterBookResult = await getMasterBookById(studentBookData.master_content_id);
  totalPages = masterBookResult.book?.total_pages || null;
}
```

### 4. `app/(admin)/actions/studentManagementActions.ts` 검토

**결과:**
- 이미 `lib/data/students.ts`, `lib/data/studentProfiles.ts`, `lib/data/studentCareerGoals.ts` 함수를 사용 중
- `student_connection_codes` 테이블 관련 코드는 특수 케이스로 인해 유지
- 삭제 작업은 관리자 전용 복잡한 로직이므로 현재 구조 유지

## 검증 결과

### 스캔 결과
- `app/api/` 디렉토리에서 `supabase.from()` 직접 호출하는 파일 없음 확인
- 대부분의 API 라우트가 이미 표준화되어 있음

### 표준화 완료 파일 목록
1. ✅ `app/api/goals/list/route.ts`
2. ✅ `app/api/schools/search/route.ts`
3. ✅ `app/api/student-content-details/route.ts`

## 개선 사항

### 타입 안전성
- 모든 API 라우트에서 명시적 타입 사용
- `lib/data` 함수의 반환 타입 활용

### 에러 처리
- `apiSuccess`/`handleApiError` 패턴 일관성 유지
- `createTypedSingleQuery`를 통한 표준화된 에러 처리

### 코드 재사용성
- `lib/data` 함수를 통한 중복 코드 제거
- 비즈니스 로직과 데이터 접근 계층 분리

## 다음 단계

1. **테스트**: 리팩토링된 API 엔드포인트 테스트
2. **모니터링**: 프로덕션 환경에서 에러 로그 모니터링
3. **문서화**: API 엔드포인트 사용 가이드 업데이트

## 참고 사항

- `student_connection_codes` 테이블은 특수 케이스로 인해 `lib/data` 함수 없이 직접 조회
- 관리자 전용 삭제 작업은 복잡한 로직이 포함되어 있어 현재 구조 유지
- 모든 변경 사항은 하위 호환성을 유지하며 기존 API 응답 형식 보존

