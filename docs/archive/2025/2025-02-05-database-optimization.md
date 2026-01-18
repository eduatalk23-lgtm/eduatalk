# 데이터베이스 최적화 작업 보고서

**작업 일시**: 2025-02-05  
**작업자**: AI Assistant  
**목적**: Supabase 데이터베이스 접근 함수 최적화 - JOIN 활용 및 N+1 문제 해결

---

## 📋 작업 개요

데이터베이스 접근 함수들을 최적화하여 불필요한 라운드트립을 제거하고 Supabase의 네이티브 JOIN 기능을 활용하도록 개선했습니다.

---

## 🔧 주요 변경 사항

### 1. `buildContentQuery` - JOIN 추가

**파일**: `lib/data/contentQueryBuilder.ts`

**변경 내용**:
- `select("*")` 대신 `difficulty_levels` JOIN을 포함한 select 문자열 사용
- 한 번의 쿼리로 난이도 정보까지 함께 조회

**Before**:
```typescript
let query = supabase.from(tableName).select("*", { count: "exact" });
```

**After**:
```typescript
const selectString = `*, difficulty_levels:difficulty_level_id(id, name)`;
let query = supabase.from(tableName).select(selectString, { count: "exact" });
```

**효과**:
- 각 검색 함수에서 별도의 난이도 조회 쿼리 제거
- 데이터베이스 라운드트립 1회 감소

---

### 2. 검색 함수 최적화 - `enrichDifficultyLevels` 제거

**파일**: `lib/data/contentMasters.ts`

**변경된 함수**:
- `searchMasterBooks`
- `searchMasterLectures`
- `searchMasterCustomContents`

**변경 내용**:
- `enrichDifficultyLevels` 함수 제거 (더 이상 사용되지 않음)
- JOIN된 `difficulty_levels` 데이터를 직접 매핑하여 `difficulty_level` 필드에 할당

**Before**:
```typescript
const result = await buildContentQuery<MasterBook>(queryClient, "master_books", filters);
const enrichedData = await enrichDifficultyLevels(queryClient, result.data);
```

**After**:
```typescript
const result = await buildContentQuery<MasterBook & { difficulty_levels?: Array<{ id: string; name: string }> | null }>(
  queryClient,
  "master_books",
  filters
);

const enrichedData = result.data.map((item) => {
  const difficultyLevel = extractJoinedData<{ id: string; name: string }>(item.difficulty_levels);
  return {
    ...item,
    difficulty_level: difficultyLevel?.name || item.difficulty_level || null,
  } as MasterBook;
});
```

**효과**:
- 추가 쿼리 제거로 성능 향상
- 코드 간소화 및 유지보수성 개선

---

### 3. `fetchContentMetadataBatch` 최적화 - N+1 문제 해결

**파일**: `lib/data/contentMetadata.ts`

**변경 내용**:
- `Promise.all`을 사용한 개별 쿼리 방식 제거
- 타입별 배치 쿼리 사용 (`.in('id', ids)`)

**Before**:
```typescript
const promises = contents.map(async (content) => {
  const metadata = await fetchContentMetadata(content.content_id, content.content_type, studentId);
  return { contentId: content.content_id, metadata };
});
const resolved = await Promise.all(promises);
```

**After**:
```typescript
// 콘텐츠를 타입별로 그룹화
const bookIds: string[] = [];
const lectureIds: string[] = [];

contents.forEach((content) => {
  if (content.content_type === "book") {
    bookIds.push(content.content_id);
  } else {
    lectureIds.push(content.content_id);
  }
});

// 배치 쿼리 실행
if (bookIds.length > 0) {
  const { data: studentBooks } = await supabase
    .from("books")
    .select("...")
    .in("id", bookIds);
  // ...
}
```

**효과**:
- N개의 개별 쿼리 → 최대 4개의 배치 쿼리로 감소
- 대량의 콘텐츠 조회 시 성능 대폭 향상
- 데이터베이스 연결 수 감소로 리소스 효율성 개선

**최적화 전략**:
1. 학생 콘텐츠와 마스터 콘텐츠를 분리하여 배치 조회
2. 학생 콘텐츠가 있는 경우 마스터 콘텐츠 ID를 수집하여 추가 배치 조회
3. 학생 콘텐츠에서 찾지 못한 항목만 마스터 콘텐츠에서 조회

---

### 4. `getSubjectHierarchyOptimized` 검증

**파일**: `lib/data/subjects.ts`

**검증 결과**:
- ✅ 이미 최적화되어 있음
- ✅ `subject_groups` → `subjects` → `subject_types` 깊은 JOIN 사용
- ✅ 단일 쿼리로 계층 구조 조회
- ✅ 추가 최적화 불필요

**현재 구조**:
```typescript
const { data: groupsData } = await supabase
  .from("subject_groups")
  .select(`
    *,
    subjects:subjects (
      *,
      subject_types:subject_type_id (
        id,
        name,
        is_active
      )
    )
  `)
  .eq("curriculum_revision_id", curriculumRevisionId);
```

---

## 📊 성능 개선 효과

### 검색 함수 (`searchMasterBooks`, `searchMasterLectures`, `searchMasterCustomContents`)
- **Before**: 메인 쿼리 1회 + 난이도 조회 쿼리 1회 = **총 2회 라운드트립**
- **After**: JOIN 포함 쿼리 1회 = **총 1회 라운드트립**
- **개선율**: **50% 감소**

### 배치 메타데이터 조회 (`fetchContentMetadataBatch`)
- **Before**: N개의 개별 쿼리 (N = 콘텐츠 개수)
- **After**: 최대 4개의 배치 쿼리 (학생 교재, 학생 강의, 마스터 교재, 마스터 강의)
- **개선율**: **N → 4 (N이 클수록 효과 큼)**

**예시**:
- 100개 콘텐츠 조회 시: 100회 → 4회 쿼리
- **96% 감소**

---

## 🔍 코드 품질 개선

1. **불필요한 함수 제거**: `enrichDifficultyLevels` 함수 제거
2. **타입 안전성 향상**: JOIN 결과에 대한 명시적 타입 정의
3. **코드 간소화**: 후처리 로직을 매핑 함수로 통합
4. **에러 처리 개선**: 배치 쿼리 실패 시 빈 Map 반환 (기존 동작 유지)

---

## ✅ 테스트 권장 사항

1. **검색 함수 테스트**:
   - `searchMasterBooks`, `searchMasterLectures`, `searchMasterCustomContents`의 결과에 `difficulty_level` 필드가 올바르게 매핑되는지 확인
   - JOIN이 없는 경우 (difficulty_level_id가 null) fallback 동작 확인

2. **배치 메타데이터 조회 테스트**:
   - 학생 콘텐츠와 마스터 콘텐츠가 혼합된 경우 정확한 결과 반환 확인
   - 대량의 콘텐츠 조회 시 성능 측정
   - 에러 발생 시 빈 Map 반환 확인

3. **성능 테스트**:
   - 검색 함수의 응답 시간 측정
   - 배치 메타데이터 조회의 쿼리 수 확인 (Supabase 로그 활용)

---

## 📝 참고 사항

1. **하위 호환성**: 모든 변경사항은 기존 API 인터페이스를 유지하여 하위 호환성 보장
2. **에러 처리**: 기존 에러 처리 로직 유지
3. **로깅**: 기존 로그 형식 유지

---

## 🚀 향후 개선 가능 사항

1. **캐싱 전략**: 자주 조회되는 난이도 정보에 대한 캐싱 고려
2. **인덱스 최적화**: `difficulty_level_id`에 대한 인덱스 확인
3. **쿼리 모니터링**: Supabase 대시보드를 통한 쿼리 성능 모니터링

---

**작업 완료**: ✅ 모든 최적화 작업 완료 및 린터 오류 없음

