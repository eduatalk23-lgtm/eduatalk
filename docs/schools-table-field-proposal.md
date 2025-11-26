# Schools 테이블 필드 구성 제안

## 개요

학교 관리 데이터베이스의 필드 구성을 제안합니다. 나이스(NEIS) API와 대학교 API에서 제공하는 정보를 기반으로 하며, 실제 사용 사례를 고려하여 설계되었습니다.

**작성일**: 2025-02-07  
**대상**: 중학교, 고등학교, 대학교

---

## 현재 필드 (기본)

### 필수 필드

| 필드명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| `id` | uuid | 학교 고유 ID (PK) | 자동 생성 |
| `name` | text | 학교명 | 필수, UNIQUE 제약 없음 (같은 이름의 학교가 다른 지역에 있을 수 있음) |
| `type` | text | 학교 타입 | CHECK: '중학교', '고등학교', '대학교' |
| `region_id` | uuid | 지역 ID (FK → regions) | nullable |
| `display_order` | integer | 표시 순서 | 기본값: 0 |
| `is_active` | boolean | 활성화 여부 | 기본값: true |
| `created_at` | timestamptz | 생성일시 | 자동 생성 |
| `updated_at` | timestamptz | 수정일시 | 자동 업데이트 |

### 기존 필드 (유지)

| 필드명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| `address` | text | 주소 | nullable |
| `phone` | text | 전화번호 | nullable |

---

## 제안 필드 (추가)

### 1. 기본 정보 (필수/권장)

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `code` | varchar(20) | 학교 코드 | 선택 | 나이스 | 나이스 API의 학교 코드 (예: B100000123) |
| `name_short` | varchar(50) | 학교 약칭 | 선택 | - | 예: "서울대", "연세대" |
| `name_english` | varchar(200) | 영문명 | 선택 | 대학교 API | 대학교의 경우 영문명 제공 |
| `establishment_type` | varchar(50) | 설립유형 | 선택 | 나이스 | '국립', '공립', '사립', '특별법법인' 등 |
| `gender_type` | varchar(20) | 성별 구분 | 선택 | 나이스 | '남자', '여자', '남녀공학' (중고등학교용) |

### 2. 연락처 정보

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `phone` | text | 전화번호 | 선택 | 나이스 | 기존 필드 유지 |
| `fax` | text | 팩스번호 | 선택 | 나이스 | - |
| `email` | text | 이메일 | 선택 | 대학교 API | 공식 이메일 주소 |
| `website` | text | 홈페이지 URL | 선택 | 나이스/대학교 | 공식 웹사이트 |

### 3. 위치 정보

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `address` | text | 주소 | 선택 | 나이스 | 기존 필드 유지 |
| `address_detail` | text | 상세주소 | 선택 | - | 건물명, 호수 등 |
| `postal_code` | varchar(10) | 우편번호 | 선택 | 나이스 | 5자리 또는 6자리 |
| `latitude` | decimal(10, 8) | 위도 | 선택 | - | 지도 표시용 |
| `longitude` | decimal(11, 8) | 경도 | 선택 | - | 지도 표시용 |

### 4. 교육청/관할 정보 (중고등학교용)

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `office_of_education` | varchar(100) | 관할 교육청 | 선택 | 나이스 | 예: "서울특별시교육청" |
| `office_of_education_code` | varchar(20) | 교육청 코드 | 선택 | 나이스 | - |
| `school_district` | varchar(100) | 학군 | 선택 | - | 중고등학교 학군 정보 |

### 5. 대학교 전용 필드

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `university_type` | varchar(50) | 대학 유형 | 선택 | 대학교 API | '일반대학', '전문대학', '대학원대학' 등 |
| `campus_name` | varchar(100) | 캠퍼스명 | 선택 | 대학교 API | 예: "서울캠퍼스", "안성캠퍼스" |
| `founded_year` | integer | 설립연도 | 선택 | 대학교 API | - |
| `president_name` | varchar(100) | 총장명 | 선택 | 대학교 API | - |
| `total_students` | integer | 재학생 수 | 선택 | 대학교 API | 통계 정보 |
| `total_faculty` | integer | 교원 수 | 선택 | 대학교 API | 통계 정보 |

### 6. 메타데이터

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `description` | text | 학교 설명 | 선택 | - | 학교 소개글 |
| `logo_url` | text | 로고 이미지 URL | 선택 | - | 학교 로고 |
| `image_url` | text | 대표 이미지 URL | 선택 | - | 학교 사진 |
| `tags` | text[] | 태그 | 선택 | - | 검색용 태그 (예: ['명문', '자율형']) |
| `notes` | text | 관리자 메모 | 선택 | - | 내부 관리용 메모 |

### 7. API 동기화 정보

| 필드명 | 타입 | 설명 | 필수 | API 출처 | 비고 |
|--------|------|------|------|----------|------|
| `api_source` | varchar(50) | API 출처 | 선택 | - | 'neis', 'university_api', 'manual' |
| `api_sync_at` | timestamptz | API 동기화 일시 | 선택 | - | 마지막 동기화 시간 |
| `api_data` | jsonb | API 원본 데이터 | 선택 | - | API 응답 원본 저장 (디버깅용) |

---

## 필드 우선순위

### Phase 1: 필수 필드 (현재 구현 완료)
- ✅ `id`, `name`, `type`, `region_id`, `display_order`, `is_active`
- ✅ `address`, `phone` (기존 필드)

### Phase 2: 기본 정보 (API 연동 시 추가)
- `code` (학교 코드)
- `establishment_type` (설립유형)
- `website` (홈페이지)
- `email` (이메일)

### Phase 3: 위치 정보 (지도 기능 추가 시)
- `postal_code` (우편번호)
- `latitude`, `longitude` (좌표)

### Phase 4: 고급 정보 (선택사항)
- 대학교 전용 필드
- 교육청 정보
- 메타데이터

---

## 제약조건 제안

### UNIQUE 제약조건

```sql
-- 학교명 + 타입 + 지역 조합으로 유니크 체크 (같은 이름의 학교가 다른 지역에 있을 수 있음)
CREATE UNIQUE INDEX schools_name_type_region_unique 
ON schools(name, type, region_id) 
WHERE is_active = true;
```

**고려사항**:
- 같은 이름의 학교가 다른 지역에 존재할 수 있음 (예: "서울중학교" vs "부산중학교")
- 같은 지역에 같은 이름의 학교는 중복 방지
- `region_id`가 NULL인 경우는 제외

### CHECK 제약조건

```sql
-- 학교 타입
CHECK (type IN ('중학교', '고등학교', '대학교'))

-- 설립유형 (추가 시)
CHECK (establishment_type IN ('국립', '공립', '사립', '특별법법인', '기타') OR establishment_type IS NULL)

-- 성별 구분 (중고등학교용)
CHECK (gender_type IN ('남자', '여자', '남녀공학') OR gender_type IS NULL)
```

---

## 인덱스 제안

```sql
-- 검색 성능 향상
CREATE INDEX idx_schools_name ON schools(name);
CREATE INDEX idx_schools_code ON schools(code) WHERE code IS NOT NULL;
CREATE INDEX idx_schools_type_region ON schools(type, region_id);
CREATE INDEX idx_schools_office_of_education ON schools(office_of_education) WHERE office_of_education IS NOT NULL;

-- 지도 검색용 (추가 시)
CREATE INDEX idx_schools_location ON schools USING GIST (point(longitude, latitude));
```

---

## 타입 정의 예시 (TypeScript)

```typescript
export type School = {
  // 기본 필드
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  region_id?: string | null;
  display_order: number;
  is_active: boolean;
  
  // 기본 정보
  code?: string | null;
  name_short?: string | null;
  name_english?: string | null;
  establishment_type?: "국립" | "공립" | "사립" | "특별법법인" | "기타" | null;
  gender_type?: "남자" | "여자" | "남녀공학" | null;
  
  // 연락처
  phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  
  // 위치
  address?: string | null;
  address_detail?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  
  // 교육청 정보 (중고등학교용)
  office_of_education?: string | null;
  office_of_education_code?: string | null;
  school_district?: string | null;
  
  // 대학교 전용
  university_type?: string | null;
  campus_name?: string | null;
  founded_year?: number | null;
  president_name?: string | null;
  total_students?: number | null;
  total_faculty?: number | null;
  
  // 메타데이터
  description?: string | null;
  logo_url?: string | null;
  image_url?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  
  // API 동기화
  api_source?: "neis" | "university_api" | "manual" | null;
  api_sync_at?: string | null;
  api_data?: Record<string, any> | null;
  
  // 타임스탬프
  created_at?: string | null;
  updated_at?: string | null;
  
  // JOIN 결과 (하위 호환성)
  region?: string | null;
};
```

---

## 마이그레이션 전략

### 단계별 추가

1. **Phase 2 필드 추가** (API 연동 준비)
   ```sql
   ALTER TABLE schools
   ADD COLUMN code varchar(20),
   ADD COLUMN establishment_type varchar(50),
   ADD COLUMN website text,
   ADD COLUMN email text;
   ```

2. **Phase 3 필드 추가** (지도 기능)
   ```sql
   ALTER TABLE schools
   ADD COLUMN postal_code varchar(10),
   ADD COLUMN latitude decimal(10, 8),
   ADD COLUMN longitude decimal(11, 8);
   ```

3. **Phase 4 필드 추가** (고급 기능)
   - 대학교 전용 필드
   - 교육청 정보
   - 메타데이터

### 데이터 마이그레이션

- 기존 데이터는 NULL로 유지
- API 동기화 시점에 값 채움
- 수동 입력도 가능하도록 nullable 유지

---

## 사용 사례별 필드 활용

### 1. 학교 검색
- `name`, `name_short`, `code` (검색어)
- `type`, `region_id` (필터)
- `tags` (태그 검색)

### 2. 학교 상세 정보
- 기본 정보: `name`, `type`, `establishment_type`
- 연락처: `phone`, `email`, `website`
- 위치: `address`, `latitude`, `longitude`

### 3. 지도 표시
- `latitude`, `longitude` (마커 위치)
- `name`, `type` (마커 라벨)

### 4. 통계 분석
- `type`, `region_id`, `establishment_type` (그룹화)
- `total_students`, `total_faculty` (대학교 통계)

### 5. API 동기화
- `api_source`, `api_sync_at` (동기화 추적)
- `api_data` (원본 데이터 보관)

---

## 권장사항

### 필수 필드 (즉시 추가 권장)
1. `code` - 학교 코드 (나이스 API 필수)
2. `establishment_type` - 설립유형 (중요한 분류 정보)
3. `website` - 홈페이지 (사용자 편의성)

### 선택 필드 (필요 시 추가)
- 위치 정보: 지도 기능이 필요한 경우
- 대학교 전용: 대학교 관리가 중요한 경우
- 메타데이터: 검색 및 필터링 기능 강화 시

### 주의사항
- 모든 추가 필드는 **nullable**로 설정 (기존 데이터 호환성)
- API 동기화 시점에 값 채움
- 수동 입력도 가능하도록 유지

---

## 참고

- **나이스 API**: 중고등학교 정보 제공
- **대학교 API**: 공공데이터포털 또는 대학알리미
- **확장성**: 필요에 따라 단계적으로 필드 추가 가능

---

**마지막 업데이트**: 2025-02-07









