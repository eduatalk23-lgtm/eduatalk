# 학생 검색 기능 통합 개선 - Phase 1-2-3 구현 완료

## 작업 일자
2025-12-19

## 작업 개요
학생 검색 기능을 통합하여 이름 검색과 연락처 교차 검색(4자리 부분 매칭)을 서버 사이드로 구현하고, 중복 코드를 제거하여 유지보수성을 향상시킵니다.

## 구현 완료 항목

### Phase 1-2: 통합 검색 함수 및 API 생성 ✅

#### 1. `lib/data/studentSearch.ts` (신규)
- **기능**: 통합 학생 검색 함수
- **주요 함수**:
  - `detectSearchType()`: 검색 타입 자동 감지 (이름/연락처/전체)
  - `searchStudentsUnified()`: 통합 검색 함수
- **검색 로직**:
  - 이름 검색: `ILIKE` 사용
  - 연락처 검색: 4자리 이상 숫자 부분 매칭
    - `student_profiles` 테이블 조인
    - `parent_student_links` + `auth.users` 조인 (최우선)
  - 검색 타입 자동 감지
  - 학년, 반, 구분 필터 지원
  - 페이지네이션 지원
- **타입 정의**:
  - `StudentSearchParams`: 검색 파라미터 타입
  - `StudentSearchResult`: 검색 결과 타입
  - `StudentSearchResponse`: API 응답 타입

#### 2. `app/api/students/search/route.ts` (신규)
- **엔드포인트**: `GET /api/students/search`
- **기능**:
  - 이름 검색 및 연락처 교차 검색
  - 역할별 권한 검증 (admin, parent, consultant)
  - Tenant Context 기반 필터링
  - 페이지네이션 지원
- **Query Parameters**:
  - `q`: 검색어 (필수)
  - `type`: 검색 타입 ("name" | "phone" | "all", 선택)
  - `grade`: 학년 필터
  - `class`: 반 필터
  - `division`: 구분 필터
  - `isActive`: 활성 상태 필터
  - `limit`: 결과 제한 (기본값: 50, 최대: 100)
  - `offset`: 페이지 오프셋 (기본값: 0)
  - `excludeIds`: 제외할 학생 ID (쉼표로 구분)

### Phase 3: 데이터베이스 인덱스 추가 ✅

#### `supabase/migrations/20251219192242_add_student_phone_search_indexes.sql` (신규)
- **기능**: 학생 연락처 검색 성능 향상을 위한 인덱스 추가
- **인덱스**:
  - `idx_student_profiles_phone_search`: 학생 본인 연락처 검색용
  - `idx_student_profiles_mother_phone_search`: 어머니 연락처 검색용
  - `idx_student_profiles_father_phone_search`: 아버지 연락처 검색용
- **인덱스 타입**: `gin_trgm_ops` (부분 매칭 검색 최적화)
- **확장**: `pg_trgm` 확장 활성화

## 검색 로직 상세

### 검색 타입 자동 감지
```typescript
// 숫자만 4자리 이상 → 연락처 검색
const isPhoneSearch = /^\d{4,}$/.test(normalizedQuery);

// 한글 포함 → 이름 검색
const isNameSearch = /[가-힣]/.test(query);
```

### 연락처 검색 우선순위
1. **최우선**: `parent_student_links` + `auth.users.phone` (학부모 계정 연결 시)
2. **우선**: `student_profiles.phone`, `mother_phone`, `father_phone`

### 매칭 필드 표시
검색 결과에 `matched_field` 필드를 포함하여 어떤 필드로 매칭되었는지 표시:
- `"name"`: 이름으로 매칭
- `"phone"`: 학생 본인 연락처로 매칭
- `"mother_phone"`: 어머니 연락처로 매칭
- `"father_phone"`: 아버지 연락처로 매칭

## 성능 최적화

### 데이터베이스 인덱스
- `gin_trgm_ops` 인덱스 사용으로 부분 매칭 검색 성능 향상
- 조건부 인덱스 (`WHERE phone IS NOT NULL`)로 인덱스 크기 최적화

### 쿼리 최적화
- 배치 조회: `getStudentPhonesBatch` 사용
- 페이지네이션: `limit` 및 `offset` 지원
- 불필요한 데이터 조회 제거

## 다음 단계 (Phase 4)

### 리팩토링 대상 페이지
1. `app/(admin)/admin/students/page.tsx` - 학생 관리 페이지
2. `app/(admin)/admin/sms/_components/SingleRecipientSearch.tsx` - SMS 단일 발송
3. `app/(admin)/admin/sms/_components/SMSRecipientSelector.tsx` - SMS 일괄 발송
4. `app/api/admin/sms/students/route.ts` - SMS 학생 조회 API
5. `app/(parent)/actions/parentStudentLinkRequestActions.ts` - 학부모 학생 연결 요청
6. `app/(admin)/admin/camp-templates/[id]/StudentInvitationForm.tsx` - 캠프 템플릿 학생 초대
7. `app/(admin)/admin/attendance/page.tsx` - 출석 관리 페이지
8. `app/(admin)/admin/consulting/page.tsx` - 상담 노트 페이지

### 리팩토링 전략
- 기존 클라이언트 사이드 필터링을 서버 사이드 검색으로 전환
- 통합 검색 API 또는 `searchStudentsUnified` 함수 사용
- 중복 코드 제거

## 참고 파일
- `.cursor/plans/-ce9b83f8.plan.md` - 전체 계획서
- `lib/utils/studentFilterUtils.ts` - 현재 클라이언트 필터링 로직 (제거 예정)
- `lib/utils/studentPhoneUtils.ts` - 연락처 조회 유틸리티

