# 학생 검색 기능 개선 작업

## 작업 일자
2024-12-15

## 개요
학생 검색 기능의 페이지네이션 문제를 해결하고, UI를 개선하여 사용자 경험을 향상시켰습니다.

## 발견된 문제점

### 1. 검색 폼 UI 불일치
- **문제**: "이름 검색"으로만 표시되어 실제 기능(이름 + 연락처 검색)과 불일치
- **파일**: `app/(admin)/admin/students/_components/StudentSearchFilter.tsx`

### 2. 검색 로직의 페이지네이션 문제
- **문제**: 이름 검색과 연락처 검색을 각각 페이지네이션 후 병합하는 방식
  - 이름 검색에서 limit만큼 결과 조회
  - 연락처 검색에서도 limit만큼 결과 조회
  - 두 결과를 병합하면 실제로 limit보다 많은 결과 반환 가능
  - total 카운트가 부정확함
- **파일**: `lib/data/studentSearch.ts`

### 3. 코드 중복
- baseQuery 빌딩 로직이 반복됨
- 매칭된 필드 확인 로직의 중복

## 해결 방안

### Phase 1: 검색 로직 최적화

#### 변경 전 로직
1. 이름 검색 → 페이지네이션 → 결과 저장
2. 연락처 검색 → 페이지네이션 → 결과 저장
3. 두 결과 병합
4. total 카운트는 더 큰 값 사용

**문제점**:
- limit보다 많은 결과 반환 가능
- total 카운트 부정확

#### 변경 후 로직
1. **ID 수집 단계**: 이름 검색과 연락처 검색에서 매칭된 학생 ID를 먼저 수집 (Set 사용하여 중복 제거)
2. **페이지네이션 단계**: 수집된 ID로 단일 쿼리 실행하여 페이지네이션 적용
3. **데이터 조회 단계**: 페이지네이션된 ID로 실제 데이터 조회

**장점**:
- 정확한 total 카운트 보장
- 페이지네이션 적용 후 정확히 limit만큼만 반환
- 중복 제거 보장

### Phase 2: 공통 함수 추출

다음 함수들을 추출하여 코드 중복을 제거했습니다:

1. **`buildBaseQuery()`**: baseQuery 빌더
   - 필터 조건을 적용한 기본 쿼리 생성
   - tenant_id, grade, class, division, is_active 필터 지원
   - excludeStudentIds 필터 지원

2. **`collectPhoneMatchedIds()`**: 연락처 검색으로 매칭된 ID 수집
   - student_profiles에서 연락처 검색
   - parent_student_links를 통한 학부모 연락처 매칭
   - auth.users에서 학부모 phone 조회

3. **`determineMatchedField()`**: matched_field 결정 로직
   - 이름 매칭 확인
   - 연락처 매칭 확인 (phone, mother_phone, father_phone)

### Phase 3: 검색 폼 UI 개선

**변경 내용**:
- 라벨: "이름 검색" → "검색 (이름 또는 연락처)"
- 플레이스홀더: "이름으로 검색..." → "이름 또는 연락처 4자리 이상으로 검색..."
- 도움말 텍스트 추가: "이름으로 검색하거나 연락처 4자리 이상을 입력하세요"

## 수정된 파일

### 1. `lib/data/studentSearch.ts`

**주요 변경사항**:
- `searchStudentsUnified()` 함수 리팩토링
  - ID 수집 → 페이지네이션 → 데이터 조회 순서로 변경
  - 정확한 total 카운트 계산
- 공통 함수 추출
  - `buildBaseQuery()`: baseQuery 빌더
  - `collectPhoneMatchedIds()`: 연락처 검색 ID 수집
  - `determineMatchedField()`: matched_field 결정
- 타입 안전성 강화
  - `SupabaseClientForStudentQuery` 타입 사용

**코드 변경량**: 약 200줄 수정

### 2. `app/(admin)/admin/students/_components/StudentSearchFilter.tsx`

**주요 변경사항**:
- 라벨 텍스트 수정
- 플레이스홀더 텍스트 수정
- 도움말 텍스트 추가

**코드 변경량**: 약 5줄 수정

## 개선 효과

1. **정확성 향상**: 페이지네이션 결과와 total 카운트가 정확히 일치
2. **사용자 경험 개선**: 검색 가능 범위를 명확히 전달
3. **코드 품질 향상**: 중복 제거 및 가독성 개선
4. **유지보수성 향상**: 공통 로직 추출로 변경 용이

## 테스트 항목

다음 항목들을 테스트해야 합니다:

1. 이름 검색 테스트 ("현우" 검색)
2. 연락처 4자리 검색 테스트
3. 이름 + 연락처 복합 검색 테스트
4. 페이지네이션 테스트 (2페이지 이상)
5. total 카운트 정확성 검증

## 참고 자료

- Supabase 모범 사례: 페이지네이션, 카운트 쿼리 최적화
- 프로젝트 가이드라인: SOLID 원칙, 타입 안전성

