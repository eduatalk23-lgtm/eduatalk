# 콘텐츠 테이블 연결 상태 개선 및 코드 최적화

**작성일**: 2025-12-16  
**작업자**: AI Assistant  
**상태**: 완료 ✅

---

## 📋 개요

콘텐츠 마스터 테이블(`master_books`, `master_lectures`, `master_custom_contents`)의 검색 함수에서 중복된 코드를 제거하고, 공통 쿼리 빌더 패턴을 도입하여 코드 유지보수성과 성능을 개선했습니다.

---

## 🎯 목표

1. 중복 코드 제거: 세 개의 search 함수에서 반복되는 필터링/정렬/페이지네이션 로직 통합
2. 타입 안전성 개선: 통합 필터 타입 정의 및 타입 재사용
3. 성능 최적화: 데이터베이스 인덱스 추가 및 외래키 제약조건 강화
4. 코드 구조 개선: 관심사 분리 및 재사용 가능한 유틸리티 함수 생성

---

## 📦 구현 내용

### Phase 1: 타입 정의 및 공통 유틸리티 생성

#### 1.1 타입 정의 (`lib/types/contentFilters.ts`)

**생성된 타입**:
- `BaseContentFilters`: 모든 콘텐츠 타입에서 공통으로 사용하는 필터
- `MasterBookFilters`: 교재 검색 필터 (BaseContentFilters + publisher_id)
- `MasterLectureFilters`: 강의 검색 필터 (BaseContentFilters + platform_id)
- `MasterCustomContentFilters`: 커스텀 콘텐츠 검색 필터 (BaseContentFilters + content_type)
- `ContentSortOption`: 정렬 옵션 타입 (title, difficulty_level, created_at, updated_at)

**장점**:
- 타입 재사용성 향상
- 타입 안전성 보장
- 하위 호환성 유지 (기존 타입 재export)

#### 1.2 정렬 유틸리티 (`lib/utils/contentSort.ts`)

**함수**: `applyContentSort()`

**기능**:
- Supabase 쿼리에 정렬 옵션 적용
- 지원 정렬 옵션:
  - `title_asc`, `title_desc`
  - `difficulty_level_asc`, `difficulty_level_desc`
  - `created_at_asc`, `created_at_desc`
  - `updated_at_asc`, `updated_at_desc` (기본값)

**장점**:
- 정렬 로직 중앙화
- 일관된 정렬 동작 보장
- 새로운 정렬 옵션 추가 용이

#### 1.3 필터링 유틸리티 (`lib/utils/contentFilters.ts`)

**함수**: `applyContentFilters()`

**기능**:
- Supabase 쿼리에 필터 옵션 적용
- 필터 적용 순서 최적화:
  1. 인덱스가 있는 컬럼 우선 (curriculum_revision_id, subject_id, subject_group_id)
  2. 텍스트 검색 (search)
  3. 난이도 필터
  4. 테넌트 필터 (tenantId)
  5. 콘텐츠 타입별 필터 (publisher_id, platform_id, content_type)

**장점**:
- 필터링 로직 중앙화
- 쿼리 성능 최적화 (인덱스 우선 사용)
- 일관된 필터링 동작 보장

#### 1.4 공통 쿼리 빌더 (`lib/data/contentQueryBuilder.ts`)

**함수**: `buildContentQuery()`

**기능**:
- 마스터 콘텐츠 테이블에 대한 공통 쿼리 빌더 패턴 제공
- 필터링, 정렬, 페이지네이션을 자동으로 적용
- 에러 처리 및 로깅 통합

**장점**:
- 중복 코드 제거 (약 200줄 → 50줄)
- 일관된 쿼리 패턴 보장
- 유지보수성 향상

---

### Phase 2: 기존 함수 리팩토링

#### 2.1 `searchMasterBooks()` 리팩토링

**변경 전**: 110줄 (필터링, 정렬, 페이지네이션 로직 포함)  
**변경 후**: 25줄 (공통 쿼리 빌더 사용)

**변경 사항**:
- 공통 쿼리 빌더(`buildContentQuery`) 사용
- 기존 로그 형식 유지 (하위 호환성)

#### 2.2 `searchMasterLectures()` 리팩토링

**변경 전**: 112줄  
**변경 후**: 25줄

**변경 사항**:
- 공통 쿼리 빌더 사용
- 기존 로그 형식 유지

#### 2.3 `searchMasterCustomContents()` 리팩토링

**변경 전**: 78줄  
**변경 후**: 12줄

**변경 사항**:
- 공통 쿼리 빌더 사용
- 에러 처리 통합

**전체 코드 감소량**: 약 300줄 → 62줄 (약 80% 감소)

---

### Phase 3: 데이터베이스 최적화

#### 3.1 인덱스 추가 (`supabase/migrations/20251216220330_add_content_table_indexes.sql`)

**추가된 인덱스**:

1. **교육과정 필터링 복합 인덱스**:
   - `idx_master_books_curriculum_subject_composite`
   - `idx_master_lectures_curriculum_subject_composite`
   - `idx_master_custom_contents_curriculum_subject_composite`
   - 컬럼: `(curriculum_revision_id, subject_group_id, subject_id)`
   - 조건: 모든 컬럼이 NOT NULL인 경우만 인덱스 사용

2. **테넌트 및 활성 상태 복합 인덱스**:
   - `idx_master_books_tenant_active`
   - `idx_master_lectures_tenant_active` (is_active 컬럼 존재 시)
   - `idx_master_custom_contents_tenant_active` (is_active 컬럼 존재 시)
   - 컬럼: `(tenant_id, is_active)`
   - 조건: `is_active = true`인 경우만 인덱스 사용

**성능 개선 효과**:
- 교육과정 기반 필터링 쿼리 성능 향상 (예상: 50-70% 개선)
- 테넌트 및 활성 상태 필터링 쿼리 성능 향상 (예상: 30-50% 개선)

#### 3.2 외래키 제약조건 강화 (`supabase/migrations/20251216220331_ensure_content_table_fk_constraints.sql`)

**적용된 정책**:

1. **ON DELETE SET NULL**:
   - `curriculum_revision_id`, `subject_id`, `subject_group_id`
   - `publisher_id` (master_books)
   - `platform_id` (master_lectures)
   - `linked_book_id` (master_lectures)
   - 참조되는 레코드 삭제 시 해당 필드를 NULL로 설정 (콘텐츠는 유지)

2. **ON DELETE RESTRICT**:
   - `tenant_id` (모든 마스터 콘텐츠 테이블)
   - 테넌트 삭제 시 오류 발생 (데이터 보존)

**데이터 무결성 보장**:
- 모든 외래키에 명시적인 ON DELETE 정책 설정
- 데이터 일관성 유지
- 예기치 않은 데이터 손실 방지

---

## 📊 성능 개선 효과

### 코드 품질

- **코드 라인 수**: 약 300줄 → 62줄 (80% 감소)
- **중복 코드**: 제거 완료
- **타입 안전성**: 개선 (통합 타입 정의)
- **유지보수성**: 향상 (공통 로직 중앙화)

### 데이터베이스 성능

- **인덱스 추가**: 6개 복합 인덱스 추가
- **쿼리 성능**: 예상 30-70% 개선 (필터링 패턴에 따라 다름)
- **데이터 무결성**: 외래키 제약조건 강화

---

## 🔄 하위 호환성

### 타입 재export

기존 코드에서 사용하던 타입들을 재export하여 하위 호환성을 유지했습니다:

```typescript
// lib/data/contentMasters.ts
export type {
  MasterBookFilters,
  MasterLectureFilters,
  MasterCustomContentFilters,
} from "@/lib/types/contentFilters";
```

### 함수 시그니처 유지

모든 search 함수의 시그니처와 반환 타입을 그대로 유지하여 기존 코드와의 호환성을 보장했습니다.

---

## 📝 사용 예시

### 공통 쿼리 빌더 사용

```typescript
import { buildContentQuery } from "@/lib/data/contentQueryBuilder";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const supabase = await createSupabaseServerClient();

// 교재 검색
const books = await buildContentQuery<MasterBook>(
  supabase,
  "master_books",
  {
    curriculum_revision_id: "xxx",
    subject_id: "yyy",
    search: "수학",
    sort: "title_asc",
    limit: 20,
    offset: 0,
  }
);

// 강의 검색
const lectures = await buildContentQuery<MasterLecture>(
  supabase,
  "master_lectures",
  {
    platform_id: "zzz",
    difficulty: "high",
    sort: "updated_at_desc",
  }
);
```

### 필터 및 정렬 유틸리티 직접 사용

```typescript
import { applyContentFilters } from "@/lib/utils/contentFilters";
import { applyContentSort } from "@/lib/utils/contentSort";

let query = supabase.from("master_books").select("*");

// 필터 적용
query = applyContentFilters(query, filters, "master_books");

// 정렬 적용
query = applyContentSort(query, "title_asc");
```

---

## 🚀 향후 개선 사항

### 1. 쿼리 성능 모니터링

- 실제 쿼리 실행 시간 측정
- 인덱스 사용 여부 확인 (EXPLAIN ANALYZE)
- 성능 병목 지점 식별

### 2. 추가 최적화

- 불필요한 `*` select 대신 필요한 컬럼만 선택
- JOIN 최적화 (이미 `getMasterBookById`에서 적용됨)
- 캐싱 전략 도입 (React Query 활용)

### 3. 테스트 추가

- 단위 테스트: 필터/정렬 유틸리티 함수
- 통합 테스트: 공통 쿼리 빌더
- 성능 테스트: 인덱스 효과 검증

---

## ✅ 체크리스트

- [x] 타입 정의 파일 생성
- [x] 정렬 유틸리티 생성
- [x] 필터링 유틸리티 생성
- [x] 공통 쿼리 빌더 생성
- [x] `searchMasterBooks()` 리팩토링
- [x] `searchMasterLectures()` 리팩토링
- [x] `searchMasterCustomContents()` 리팩토링
- [x] 인덱스 추가 마이그레이션 생성
- [x] 외래키 제약조건 강화 마이그레이션 생성
- [x] 문서화 완료

---

## 📚 관련 파일

### 생성된 파일

- `lib/types/contentFilters.ts` - 필터 타입 정의
- `lib/utils/contentSort.ts` - 정렬 유틸리티
- `lib/utils/contentFilters.ts` - 필터링 유틸리티
- `lib/data/contentQueryBuilder.ts` - 공통 쿼리 빌더
- `supabase/migrations/20251216220330_add_content_table_indexes.sql` - 인덱스 추가
- `supabase/migrations/20251216220331_ensure_content_table_fk_constraints.sql` - 외래키 제약조건 강화

### 수정된 파일

- `lib/data/contentMasters.ts` - 세 개의 search 함수 리팩토링

---

**작업 완료일**: 2025-12-16

