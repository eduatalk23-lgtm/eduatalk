# 난이도 표시 불일치 수정

**작업일**: 2025-02-02  
**관련 이슈**: 콘텐츠 목록 및 상세보기에서 난이도가 수정 폼과 다르게 표시되는 문제

## 문제 분석

현재 시스템에서 난이도 정보는 두 가지 방식으로 관리됩니다:

- `difficulty_level` (varchar, deprecated): 레거시 문자열 필드
- `difficulty_level_id` (uuid, FK): difficulty_levels 테이블 참조

**문제점:**

1. 수정 폼에서는 `difficulty_level_id`를 사용하여 `difficulty_levels` 테이블의 ID를 저장
2. 목록/상세보기에서는 `difficulty_level` (문자열)을 직접 표시
3. `difficulty_level_id` 업데이트 시 `difficulty_level`은 자동으로 업데이트되지 않음
4. 결과적으로 수정 폼에서 변경한 난이도가 목록/상세보기에서 반영되지 않음

## 해결 방안

**권장 방법: 조회 시 JOIN**

- `getMasterBookById`, `getMasterLectureById`, `getMasterCustomContentById`에서 `difficulty_level_id`를 JOIN하여 `difficulty_levels.name`을 가져와 표시
- 데이터 정규화 유지, 단일 소스 원칙 준수
- `difficulty_levels` 테이블의 `name` 변경 시 자동 반영

## 수정 내용

### 1. 헬퍼 함수 생성

**파일**: `lib/utils/supabaseHelpers.ts` (신규)

```typescript
/**
 * Supabase JOIN 결과에서 첫 번째 항목 추출
 * 배열 또는 단일 객체 모두 처리
 */
export function extractJoinedData<T>(
  raw: T | T[] | null | undefined
): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}
```

### 2. `getMasterBookById` 수정

**파일**: `lib/data/contentMasters.ts`

**변경 사항:**
- SELECT 쿼리에 `difficulty_levels:difficulty_level_id (id, name)` JOIN 추가
- JOIN 결과 처리 로직 추가 (기존 `publishers`, `subjects` 패턴과 동일)
- `difficulty_level` 필드를 JOIN된 `name`으로 덮어쓰기 (fallback: 기존 값)
- `extractJoinedData` 헬퍼 함수 사용으로 코드 중복 제거

**코드 예시:**
```typescript
// SELECT 쿼리에 JOIN 추가
.select(`
  ...기존 필드들...,
  difficulty_levels:difficulty_level_id (
    id,
    name
  )
`)

// JOIN 결과 처리
const difficultyLevel = extractJoinedData(
  (bookData as any).difficulty_levels
);

// difficulty_level 덮어쓰기
difficulty_level: difficultyLevel?.name || bookData.difficulty_level || null,
```

### 3. `getMasterLectureById` 수정

**파일**: `lib/data/contentMasters.ts`

**변경 사항:**
- SELECT 쿼리에 `difficulty_levels:difficulty_level_id (id, name)` JOIN 추가
- JOIN 결과 처리 로직 추가
- `difficulty_level` 필드를 JOIN된 `name`으로 덮어쓰기

### 4. `getMasterCustomContentById` 수정

**파일**: `lib/data/contentMasters.ts`

**변경 사항:**
- SELECT 쿼리에 `difficulty_levels:difficulty_level_id (id, name)` JOIN 추가
- JOIN 결과 처리 로직 추가
- `difficulty_level` 필드를 JOIN된 `name`으로 덮어쓰기

### 5. 목록 조회 함수 수정 (난이도 정보 후처리)

**파일**: `lib/data/contentMasters.ts`

**변경 사항:**
- `enrichDifficultyLevels` 헬퍼 함수 추가: 배치로 `difficulty_levels` 조회하여 매핑
- `searchMasterBooks`: 결과 후처리 추가
- `searchMasterLectures`: 결과 후처리 추가
- `searchMasterCustomContents`: 결과 후처리 추가

**구현 방식:**
- 목록 조회는 성능을 위해 JOIN 대신 배치 조회 방식 사용
- `difficulty_level_id`가 있는 항목들을 수집하여 한 번에 조회
- ID → name 매핑을 생성하여 각 항목의 `difficulty_level` 필드 업데이트

### 5. 타입 정의 업데이트

**파일**: `lib/types/plan/domain.ts`

**변경 사항:**
- `CommonContentFields.difficulty_level`에 주석 추가: 레거시 필드임을 명시하고 JOIN으로 자동 덮어쓰기됨을 문서화
- `MasterContentFields.difficulty_level_id`에 주석 추가: JOIN하여 `difficulty_level`에 자동 반영됨을 명시

## 수정된 파일 목록

1. `lib/utils/supabaseHelpers.ts` (신규)
   - `extractJoinedData` 헬퍼 함수

2. `lib/data/contentMasters.ts`
   - `enrichDifficultyLevels` 헬퍼 함수 추가 (목록 조회용)
   - `getMasterBookById` 함수 수정 (상세 조회)
   - `getMasterLectureById` 함수 수정 (상세 조회)
   - `getMasterCustomContentById` 함수 수정 (상세 조회)
   - `searchMasterBooks` 함수 수정 (목록 조회)
   - `searchMasterLectures` 함수 수정 (목록 조회)
   - `searchMasterCustomContents` 함수 수정 (목록 조회)
   - `extractJoinedData` import 추가
   - `SupabaseClient` 타입 import 추가

3. `lib/types/plan/domain.ts`
   - `CommonContentFields.difficulty_level` 주석 추가
   - `MasterContentFields.difficulty_level_id` 주석 추가

## 동작 방식

### 데이터 흐름

```
1. 수정 폼에서 difficulty_level_id 저장
   ↓
2. getMasterBookById/getMasterLectureById 호출
   ↓
3. difficulty_levels 테이블과 JOIN
   ↓
4. difficulty_levels.name을 difficulty_level에 자동 반영
   ↓
5. 목록/상세보기에서 최신 난이도 표시
```

### Fallback 로직

- `difficulty_level_id`가 있고 JOIN 성공 → `difficulty_levels.name` 사용
- `difficulty_level_id`가 null이거나 JOIN 실패 → 기존 `difficulty_level` 문자열 값 사용
- 둘 다 null → null 반환

## 검증 항목

1. ✅ 수정 폼에서 난이도 변경 후 상세보기에서 올바르게 표시되는지 확인
2. ✅ 목록에서도 올바른 난이도가 표시되는지 확인
3. ✅ `difficulty_level_id`가 null인 경우 fallback 동작 확인
4. ✅ `difficulty_levels` 테이블의 `name` 변경 시 자동 반영 확인

## 예상 효과

1. **데이터 일관성**: 수정 폼과 목록/상세보기의 난이도 표시 일치
2. **유지보수성**: 단일 소스 원칙 준수로 난이도 변경 시 자동 반영
3. **확장성**: 향후 난이도 관련 기능 추가 시 일관된 패턴 사용 가능
4. **코드 품질**: 중복 코드 제거 및 재사용 가능한 헬퍼 함수 제공

## 참고 사항

### Supabase JOIN 문법

```typescript
.select(`
  *,
  difficulty_levels:difficulty_level_id (
    id,
    name
  )
`)
```

### 기존 패턴 참고

- `getMasterBookById`의 `publishers:publisher_id (id, name)` 패턴 활용
- 배열 처리 로직을 `extractJoinedData` 헬퍼로 통합

### 성능 고려사항

- **상세 조회**: 단일 레코드이므로 JOIN 성능 영향 미미
- **목록 조회**: 배치 조회 방식 사용
  - JOIN 대신 `difficulty_level_id` 수집 후 한 번에 조회
  - N+1 문제 방지 및 성능 최적화
  - 조회된 난이도 정보를 메모리에서 매핑하여 처리

