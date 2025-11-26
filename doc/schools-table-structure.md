# 학교 관리 테이블 구조 및 위계 속성 문서

## 개요

이 문서는 학교 관리 시스템의 `regions`와 `schools` 테이블 구조, 위계 속성, 그리고 관련 관계를 정리한 문서입니다.

**작성 일자**: 2025-02-08  
**마이그레이션 버전**: 20250208000000 ~ 20250208000003

---

## 1. regions 테이블 구조

### 1.1 기본 구조

`regions` 테이블은 지역 정보를 관리하며, 위계 구조를 지원합니다.

```sql
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  parent_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  level integer NOT NULL DEFAULT 1,
  code text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
```

### 1.2 컬럼 설명

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | uuid | PRIMARY KEY | 지역 고유 식별자 |
| `name` | text | NOT NULL, UNIQUE | 지역명 (예: 서울특별시, 부산광역시) |
| `parent_id` | uuid | FK → regions(id) | 상위 지역 ID (위계 구조) |
| `level` | integer | NOT NULL, CHECK(1,2,3) | 지역 레벨: 1=시/도, 2=시/군/구, 3=읍/면/동 |
| `code` | text | NULL 허용 | 행정구역 코드 (선택사항) |
| `display_order` | integer | NOT NULL, DEFAULT 0 | 표시 순서 |
| `is_active` | boolean | NOT NULL, DEFAULT true | 활성화 여부 |
| `created_at` | timestamptz | NOT NULL | 생성 일시 |
| `updated_at` | timestamptz | NOT NULL | 수정 일시 |

### 1.3 위계 구조

지역은 3단계 위계 구조를 가집니다:

```
Level 1: 시/도 (광역시, 특별시, 도)
  └─ Level 2: 시/군/구 (기초자치단체)
      └─ Level 3: 읍/면/동 (행정동)
```

**예시**:
- 서울특별시 (level=1, parent_id=NULL)
  - 관악구 (level=2, parent_id=서울특별시.id)
    - 관악동 (level=3, parent_id=관악구.id)

### 1.4 제약조건

- **순환 참조 방지**: `CHECK (parent_id IS NULL OR parent_id != id)`
- **레벨 제한**: `CHECK (level IN (1, 2, 3))`
- **이름 중복 방지**: `UNIQUE (name)`

### 1.5 인덱스

- `idx_regions_parent_id`: `parent_id` 컬럼 (하위 지역 조회 최적화)
- `idx_regions_level`: `level` 컬럼 (레벨별 조회 최적화)
- `idx_regions_display_order`: `display_order` 컬럼 (정렬 최적화)

---

## 2. schools 테이블 구조

### 2.1 기본 구조

`schools` 테이블은 학교 정보를 전역적으로 관리합니다.

```sql
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('중학교', '고등학교', '대학교')),
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  address text,
  postal_code text,
  address_detail text,
  city text,
  district text,
  phone text,
  category text CHECK (category IN ('일반고', '특목고', '자사고', '특성화고')),
  university_type text CHECK (university_type IN ('4년제', '2년제')),
  university_ownership text CHECK (university_ownership IN ('국립', '사립')),
  campus_name text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2.2 컬럼 설명

#### 기본 정보

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `id` | uuid | PRIMARY KEY | 학교 고유 식별자 |
| `name` | text | NOT NULL | 학교명 |
| `type` | text | NOT NULL, CHECK | 학교 타입: 중학교, 고등학교, 대학교 |
| `region_id` | uuid | FK → regions(id) | 지역 ID |
| `display_order` | integer | NOT NULL, DEFAULT 0 | 표시 순서 |
| `is_active` | boolean | DEFAULT true | 활성화 여부 |
| `created_at` | timestamptz | DEFAULT now() | 생성 일시 |
| `updated_at` | timestamptz | DEFAULT now() | 수정 일시 |

#### 주소 정보

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `address` | text | 기본주소 (시/도 + 시/군/구) |
| `postal_code` | text | 우편번호 (5자리 또는 6자리) |
| `address_detail` | text | 상세주소 (건물명, 동/호수 등) |
| `city` | text | 시/군/구 |
| `district` | text | 읍/면/동 (선택사항) |
| `phone` | text | 전화번호 |

#### 고등학교 속성 (type='고등학교'인 경우)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `category` | text | CHECK | 고등학교 유형: 일반고, 특목고, 자사고, 특성화고 |

#### 대학교 속성 (type='대학교'인 경우)

| 컬럼명 | 타입 | 제약조건 | 설명 |
|--------|------|----------|------|
| `university_type` | text | CHECK | 대학교 유형: 4년제, 2년제 |
| `university_ownership` | text | CHECK | 설립 유형: 국립, 사립 |
| `campus_name` | text | NULL 허용 | 캠퍼스명 |

### 2.3 타입별 속성 사용 가이드

#### 중학교
- `category`: NULL
- `university_type`: NULL
- `university_ownership`: NULL
- `campus_name`: NULL

#### 고등학교
- `category`: 필수 (일반고, 특목고, 자사고, 특성화고 중 선택)
- `university_type`: NULL
- `university_ownership`: NULL
- `campus_name`: NULL

#### 대학교
- `category`: NULL
- `university_type`: 선택 (4년제, 2년제)
- `university_ownership`: 선택 (국립, 사립)
- `campus_name`: 선택 (캠퍼스명)

### 2.4 제약조건

- **학교 타입 제한**: `CHECK (type IN ('중학교', '고등학교', '대학교'))`
- **고등학교 유형 제한**: `CHECK (category IS NULL OR category IN ('일반고', '특목고', '자사고', '특성화고'))`
- **대학교 유형 제한**: `CHECK (university_type IS NULL OR university_type IN ('4년제', '2년제'))`
- **설립 유형 제한**: `CHECK (university_ownership IS NULL OR university_ownership IN ('국립', '사립'))`

### 2.5 인덱스

- `idx_schools_region_id`: `region_id` 컬럼 (지역별 조회 최적화)
- `idx_schools_type`: `type` 컬럼 (타입별 조회 최적화)
- `idx_schools_display_order`: `display_order` 컬럼 (정렬 최적화)
- `idx_schools_city`: `city` 컬럼 (시/군/구 검색 최적화)
- `idx_schools_postal_code`: `postal_code` 컬럼 (우편번호 검색 최적화)
- `idx_schools_category`: `category` 컬럼 (고등학교 유형별 조회)
- `idx_schools_university_type`: `university_type` 컬럼 (대학교 유형별 조회)
- `idx_schools_university_ownership`: `university_ownership` 컬럼 (설립 유형별 조회)

---

## 3. 관계도

### 3.1 테이블 관계

```
regions (지역)
  ├─ parent_id → regions.id (자기참조, 위계 구조)
  └─ ...

schools (학교)
  └─ region_id → regions.id (지역 연결)

students (학생)
  └─ school_id → schools.id (학교 연결)
```

### 3.2 위계 구조 다이어그램

```
regions (Level 1: 시/도)
  │
  ├─ regions (Level 2: 시/군/구)
  │   │
  │   └─ regions (Level 3: 읍/면/동)
  │
  └─ schools
      └─ students
```

---

## 4. 데이터 조회 함수

### 4.1 Region 관련 함수

#### `getRegions()`
모든 활성 지역 목록 조회 (위계 구조 포함)

#### `getRegionsByParent(parentId: string)`
특정 상위 지역의 하위 지역 목록 조회

#### `getRegionsByLevel(level: 1 | 2 | 3)`
특정 레벨의 지역 목록 조회

#### `getRegionHierarchy(regionId?: string)`
지역 위계 구조 조회 (트리 구조)

### 4.2 School 관련 함수

#### `getSchools(options?)`
학교 목록 조회 (필터링 옵션 지원)

**옵션**:
- `regionId`: 지역별 필터
- `type`: 학교 타입별 필터
- `includeInactive`: 비활성 학교 포함 여부

#### `getSchoolById(schoolId: string)`
학교 ID로 상세 정보 조회

#### `getSchoolByName(name: string, type?)`
학교명으로 학교 조회

#### `checkSchoolDuplicate(name, type, regionId?, campusName?, excludeId?)`
학교 중복 확인 (등록/수정 시 사용)
- 중학교/고등학교: `name` + `type` + `region_id` 조합
- 대학교: `name` + `type` + `region_id` + `campus_name`(선택사항) 조합
- `excludeId`: 수정 시 자기 자신 제외용

#### `getSchoolsByRegion(regionId: string)`
지역별 학교 목록 조회

---

## 5. 유효성 검증 규칙

### 5.1 학교 중복 확인 로직

학교 등록 시 중복 확인은 다음 조합으로 수행됩니다:

#### 중학교/고등학교
- **조합**: `name` + `type` + `region_id`
- `region_id`가 NULL인 경우: `name` + `type` 조합으로 전역 확인
- `region_id`가 있는 경우: 해당 지역 내에서만 중복 확인

#### 대학교
- **캠퍼스명이 있는 경우**: `name` + `type` + `region_id` + `campus_name` 조합
- **캠퍼스명이 없는 경우**: `name` + `type` + `region_id` 조합
- `region_id`가 NULL인 경우:
  - 캠퍼스명이 있으면: `name` + `type` + `campus_name` 조합
  - 캠퍼스명이 없으면: `name` + `type` 조합

#### 중복 확인 규칙
- 지역이 선택된 경우: 같은 지역 내에서만 중복 확인 (동명 학교가 다른 지역에 있을 수 있음)
- 지역이 선택되지 않은 경우: 전역적으로 중복 확인
- 대학교의 경우 캠퍼스명이 다르면 같은 이름의 학교도 등록 가능

### 5.2 우편번호
- 형식: 5자리 또는 6자리 숫자
- 정규식: `/^\d{5,6}$/`
- 검증: 애플리케이션 레벨에서 형식 검증

### 5.3 학교 타입별 속성
- **고등학교**: `category` 필수 (일반고, 특목고, 자사고, 특성화고)
- **대학교**: `university_type`, `university_ownership`, `campus_name` 선택
- **중학교**: 타입별 속성 없음

---

## 6. 마이그레이션 히스토리

### 20250208000000: 지역 위계 구조 추가
- `regions` 테이블에 `parent_id`, `level`, `code` 컬럼 추가
- 순환 참조 방지 제약조건 추가
- 위계 구조 인덱스 추가

### 20250208000001: 학교 주소 속성 추가
- `schools` 테이블에 `postal_code`, `address_detail`, `city`, `district` 컬럼 추가
- 주소 관련 인덱스 추가

### 20250208000002: 학교 코드 추가
- `schools` 테이블에 `school_code` 컬럼 추가
- UNIQUE 인덱스 생성 (NULL 제외)

### 20250208000003: 학교 타입별 속성 추가
- 고등학교: `category` 컬럼 추가
- 대학교: `university_type`, `university_ownership`, `campus_name` 컬럼 추가
- 타입별 CHECK 제약조건 추가

### 20250208000004: 학교 코드 제거 및 중복 확인 로직 개선
- `schools` 테이블에서 `school_code` 컬럼 제거
- 관련 인덱스 제거 (`idx_schools_school_code`, `idx_schools_school_code_unique`)
- 중복 확인 로직 변경: `name` + `type` + `region_id` + `campus_name`(대학교 선택사항) 조합으로 중복 확인
- 고등학교: `category` 컬럼 추가
- 대학교: `university_type`, `university_ownership`, `campus_name` 컬럼 추가
- 타입별 CHECK 제약조건 추가

---

## 7. 사용 예시

### 7.1 지역 위계 구조 생성

```typescript
// 시/도 생성
const seoul = await createRegion({
  name: "서울특별시",
  level: 1,
  parent_id: null
});

// 시/군/구 생성
const gwanak = await createRegion({
  name: "관악구",
  level: 2,
  parent_id: seoul.id
});

// 읍/면/동 생성
const gwanakDong = await createRegion({
  name: "관악동",
  level: 3,
  parent_id: gwanak.id
});
```

### 7.2 학교 등록

```typescript
// 고등학교 등록
const highSchool = await createSchool({
  name: "서울대학교사범대학부설고등학교",
  type: "고등학교",
  region_id: gwanak.id,
  category: "특목고",
  address: "서울특별시 관악구 관악로 1",
  postal_code: "08826",
  city: "관악구",
  address_detail: "서울대학교 1동",
  district: "관악동"
});

// 대학교 등록
const university = await createSchool({
  name: "서울대학교",
  type: "대학교",
  region_id: gwanak.id,
  university_type: "4년제",
  university_ownership: "국립",
  campus_name: "서울캠퍼스",
  address: "서울특별시 관악구 관악로 1",
  postal_code: "08826",
  city: "관악구"
});
```

---

## 8. 주의사항

1. **위계 구조 순환 참조 방지**: `parent_id`는 자기 자신을 참조할 수 없습니다.
2. **타입별 속성**: 학교 타입에 맞지 않는 속성은 NULL로 설정해야 합니다.
3. **중복 확인**: 학교 등록 시 `name` + `type` + `region_id` + `campus_name`(대학교 선택사항) 조합으로 중복 확인이 수행됩니다.
4. **하위 호환성**: 모든 새 컬럼은 NULL 허용으로 기존 데이터와 호환됩니다.

---

## 9. 향후 개선 사항

1. **지역 위계 자동화**: 시/도 선택 시 시/군/구 목록 자동 로드
2. **주소 검색 API 연동**: 우편번호 검색 API 연동으로 주소 자동 입력
3. **대량 등록 기능**: CSV/Excel 파일을 통한 대량 학교 등록

---

**마지막 업데이트**: 2025-02-08 (학교 코드 제거 및 중복 확인 로직 개선)

