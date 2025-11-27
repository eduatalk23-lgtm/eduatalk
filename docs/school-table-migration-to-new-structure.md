# 학교 테이블 구조 마이그레이션 문서

## 개요

기존 `schools` 테이블을 제거하고, 새로운 정규화된 테이블 구조(`school_info`, `universities`, `university_campuses`)로 전환하는 리팩토링 작업입니다.

**작업일**: 2025-11-28

---

## 변경 사항 요약

### 1. 제거된 객체

| 객체 유형 | 이름 | 설명 |
|----------|------|------|
| 테이블 | `schools` | 기존 통합 학교 테이블 |
| 인덱스 | `idx_schools_region_id` | 지역 인덱스 |
| 인덱스 | `idx_schools_type` | 타입 인덱스 |
| 인덱스 | `idx_schools_display_order` | 순서 인덱스 |
| FK | `students_school_id_fkey` | 학생-학교 FK (재생성) |

### 2. 새로 생성된 객체

#### 테이블 (이미 존재, 읽기 전용)

| 테이블명 | 레코드 수 | 설명 |
|---------|---------|------|
| `school_info` | 5,909개 | 중·고등학교 (나이스 데이터) |
| `universities` | 2,056개 | 대학교 기본 정보 |
| `university_campuses` | 2,056개 | 대학교 캠퍼스 정보 |

#### VIEW

| VIEW명 | 설명 |
|--------|------|
| `all_schools_view` | 모든 학교(중/고/대) 통합 조회 VIEW |

#### 인덱스

| 테이블 | 인덱스명 | 컬럼 |
|--------|---------|------|
| school_info | `idx_school_info_school_code` | school_code |
| school_info | `idx_school_info_school_name` | school_name |
| school_info | `idx_school_info_school_level` | school_level |
| school_info | `idx_school_info_region` | region |
| school_info | `idx_school_info_closed_flag` | closed_flag |
| universities | `idx_universities_university_code` | university_code |
| universities | `idx_universities_name_kor` | name_kor |
| universities | `idx_universities_establishment_type` | establishment_type |
| university_campuses | `idx_university_campuses_university_id` | university_id |
| university_campuses | `idx_university_campuses_campus_name` | campus_name |
| university_campuses | `idx_university_campuses_region` | region |
| university_campuses | `idx_university_campuses_campus_status` | campus_status |
| students | `idx_students_school_type` | school_type |

#### RLS 정책

| 테이블 | 정책명 | 권한 |
|--------|--------|------|
| school_info | `school_info_select_all` | SELECT (모든 사용자) |
| universities | `universities_select_all` | SELECT (모든 사용자) |
| university_campuses | `university_campuses_select_all` | SELECT (모든 사용자) |

---

## 새 테이블 구조

### school_info (중·고등학교)

```sql
id                  INTEGER PRIMARY KEY
district_id         INTEGER
region              TEXT           -- 지역 (예: "서울특별시 강남구")
school_code         TEXT NOT NULL  -- 학교코드 (나이스)
school_name         TEXT NOT NULL  -- 학교명
school_level        TEXT NOT NULL  -- "중" | "고"
establishment_type  TEXT           -- "국립" | "공립" | "사립"
postal_code         TEXT
addr_road           TEXT           -- 도로명 주소
address_full        TEXT           -- 전체 주소
latitude            NUMERIC
longitude           NUMERIC
phone_number        TEXT
homepage_url        TEXT
closed_flag         TEXT           -- "N" (운영중), "Y" (폐교)
created_at          TIMESTAMPTZ
```

### universities (대학교)

```sql
id                  INTEGER PRIMARY KEY
university_code     TEXT NOT NULL  -- 대학코드
name_kor            TEXT NOT NULL  -- 대학명 (한글)
name_eng            TEXT           -- 대학명 (영문)
establishment_type  TEXT           -- "국립" | "사립"
university_type     TEXT           -- "대학", "전문대학", "대학원" 등
homepage_url        TEXT
created_at          TIMESTAMPTZ
```

### university_campuses (대학교 캠퍼스)

```sql
id                  INTEGER PRIMARY KEY
university_id       INTEGER FK     -- universities.id 참조
campus_type         TEXT           -- "본교", "제2캠퍼스" 등
campus_name         TEXT NOT NULL  -- 캠퍼스명
region              TEXT           -- 지역
address_kor         TEXT           -- 주소
postal_code         TEXT
phone_number        TEXT
campus_status       TEXT           -- "기존" (운영중)
created_at          TIMESTAMPTZ
```

### all_schools_view (통합 VIEW)

```sql
id                  TEXT           -- "SCHOOL_123" 또는 "UNIV_456"
school_type         TEXT           -- "MIDDLE" | "HIGH" | "UNIVERSITY"
name                TEXT           -- 학교명
code                TEXT           -- 학교코드/대학코드
region              TEXT           -- 지역
address             TEXT           -- 주소
postal_code         TEXT
phone               TEXT
website             TEXT
establishment_type  TEXT
campus_name         TEXT           -- 대학교만
university_type     TEXT           -- 대학교만
source_table        TEXT           -- "school_info" | "university_campuses"
source_id           INTEGER        -- 원본 테이블 ID
latitude            NUMERIC
longitude           NUMERIC
created_at          TIMESTAMPTZ
```

---

## students 테이블 변경

### 변경된 컬럼

| 컬럼명 | 변경 전 | 변경 후 | 설명 |
|--------|--------|--------|------|
| school_id | UUID (FK → schools.id) | TEXT | 통합 ID ("SCHOOL_123", "UNIV_456") |
| school_type | (없음) | TEXT | "MIDDLE", "HIGH", "UNIVERSITY" |

---

## 코드 변경 사항

### 1. 타입 정의

**파일**: `lib/domains/school/types.ts`

- 새 타입 추가: `SchoolInfo`, `University`, `UniversityCampus`, `AllSchoolsView`, `SchoolSimple`
- 학교 유형 Enum: `SchoolType = "MIDDLE" | "HIGH" | "UNIVERSITY"`
- 하위 호환성 유지: `School` 타입 (deprecated)

### 2. 데이터 레이어

**파일**: `lib/data/schools.ts`

- 새 함수: `getAllSchools()`, `searchAllSchools()`, `getSchoolByUnifiedId()`
- 새 함수: `getSchoolInfoList()`, `getSchoolInfoById()`, `searchSchoolInfo()`
- 새 함수: `getUniversities()`, `getUniversityCampuses()`, `searchUniversityCampuses()`
- 하위 호환 함수: `getSchools()`, `getSchoolById()`, `getSchoolByName()` (deprecated)

### 3. 도메인 레이어

**파일**: `lib/domains/school/repository.ts`, `lib/domains/school/service.ts`

- 읽기 전용 Repository/Service 구조
- CRUD 함수 비활성화 (읽기 전용 데이터)

### 4. Server Actions

**파일**: `app/(student)/actions/schoolActions.ts`, `app/(admin)/actions/schoolActions.ts`

- 검색/조회 기능만 유지
- 생성/수정/삭제 함수 비활성화 (deprecated)

### 5. UI 컴포넌트

**파일**: `components/ui/SchoolSelect.tsx`

- 통합 ID 형식 지원 ("SCHOOL_123", "UNIV_456")
- 자동 등록 기능 제거 (읽기 전용)

### 6. Admin 페이지

**파일**: `app/(admin)/admin/schools/page.tsx`

- 읽기 전용 조회 페이지로 변경
- CRUD 버튼/모달 제거
- 통계 및 필터링 기능 유지

---

## 마이그레이션 SQL

**파일**: `supabase/migrations/20251128000000_remove_schools_add_unified_view.sql`

### 실행 순서

1. `students_school_id_fkey` FK 제거
2. `students.school_id` 타입 변경 (uuid → text)
3. `students.school_type` 컬럼 추가
4. 기존 `schools` 테이블 및 인덱스 삭제
5. `all_schools_view` 통합 VIEW 생성
6. 새 테이블들에 인덱스 생성
7. RLS 정책 설정

---

## 마이그레이션 실행 방법

```bash
# 1. 마이그레이션 파일 확인
cat supabase/migrations/20251128000000_remove_schools_add_unified_view.sql

# 2. Supabase CLI로 마이그레이션 실행
supabase db push

# 또는 Supabase Studio에서 SQL 직접 실행
```

---

## 주의 사항

### 읽기 전용 데이터

- `school_info`, `universities`, `university_campuses` 테이블은 **외부 데이터(나이스, 교육부)** 기반입니다.
- 학교 정보 추가/수정/삭제는 **지원하지 않습니다**.
- 학교 정보 변경이 필요하면 데이터 import 프로세스를 통해 진행해야 합니다.

### 하위 호환성

- 기존 `School` 타입과 `getSchools()` 등의 함수는 **deprecated**로 유지됩니다.
- 가능한 빨리 새 타입(`AllSchoolsView`, `SchoolSimple`)과 새 함수(`getAllSchools()`)로 마이그레이션하세요.

### FK 변경

- `students.school_id`가 UUID에서 TEXT로 변경되었습니다.
- 새 형식: `"SCHOOL_123"` (중·고등학교) 또는 `"UNIV_456"` (대학교 캠퍼스)

---

## 향후 작업

1. **deprecated 함수 제거**: 새 API로 완전 마이그레이션 후 deprecated 함수 삭제
2. **테스트 코드 추가**: 새 테이블 구조에 대한 테스트 작성
3. **성능 모니터링**: 통합 VIEW 쿼리 성능 확인
4. **데이터 동기화**: 나이스/교육부 데이터 정기 동기화 프로세스 구축

---

## 참고 문서

- [학교 테이블 위계 구성 제안](./schools-table-hierarchy-proposal.md)
- [Supabase 마이그레이션 가이드](./supabase-migration-reset-guide.md)

---

**작성자**: AI Assistant  
**최종 수정**: 2025-11-28

