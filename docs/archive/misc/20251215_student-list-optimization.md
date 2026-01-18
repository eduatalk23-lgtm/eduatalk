# 학생 목록 페이지 필드 구성 변경 및 최적화

**작업 일자**: 2025-12-15  
**작업 내용**: 학생 목록 페이지 필드 구성 변경, 중복 코드 제거, 데이터 페칭 최적화

## 변경 사항 요약

### 1. 필드 구성 변경

**이전 필드 구성**:
- 이름, 학년, 반, 이번주 학습시간, 이번주 플랜 실행률, 최근 학습일, 성적 입력, 상태, 작업

**변경된 필드 구성**:
- 이름 (클릭 시 상세 페이지 이동)
- 학교
- 학년
- 학생 연락처
- 모 연락처
- 부 연락처
- 상태

### 2. 기능 섹션 개선

- 활성/비활성/삭제 버튼을 목록 위 영역으로 이동
- 선택된 항목이 없을 때도 기능 섹션 표시 (버튼은 disabled 상태)
- 선택된 항목이 있을 때는 "N개 선택됨" 표시

### 3. 상세보기 개선

- 이름 클릭 시 상세 페이지로 이동하도록 변경
- 테이블의 "작업" 컬럼 제거

## 구현 세부 사항

### Phase 1: 유틸리티 함수 생성

#### `lib/data/studentSchools.ts` (신규)

학교 정보 배치 조회 함수를 생성하여 N+1 문제를 해결했습니다.

**주요 기능**:
- 여러 학생의 학교 정보를 한 번에 조회
- `SCHOOL_` 접두사 → `school_info` 테이블 조회
- `UNIV_` 접두사 → `university_campuses` + `universities` 조인 조회
- `Promise.all`을 활용한 병렬 처리
- 결과를 `Map<studentId, schoolName>` 형태로 반환

**함수 시그니처**:
```typescript
export async function getStudentSchoolsBatch(
  supabase: SupabaseServerClient,
  students: Array<{
    id: string;
    school_id: string | null;
    school_type: "MIDDLE" | "HIGH" | "UNIVERSITY" | null;
  }>
): Promise<Map<string, string>>
```

### Phase 2: 페이지 데이터 페칭 최적화

#### `app/(admin)/admin/students/page.tsx`

**변경 사항**:
1. `selectFields`에 `school_id`, `school_type` 추가
2. `StudentRow` 타입 확장 (school_id, school_type 추가)
3. 통계 데이터 조회 제거 (`getStudentsStatsBatch`, `getWeekRange` 제거)
4. 배치 쿼리로 학교 정보 및 연락처 정보 일괄 조회
5. `Promise.all`을 활용한 병렬 데이터 페칭

**최적화 전**:
- 통계 데이터 조회 (불필요)
- 순차적 데이터 페칭
- 학교 정보 개별 조회 (N+1 문제 가능성)

**최적화 후**:
- 통계 데이터 조회 제거
- 병렬 데이터 페칭 (`Promise.all`)
- 배치 쿼리로 학교 정보 일괄 조회

### Phase 3: 컴포넌트 구조 개선

#### `app/(admin)/admin/students/_components/StudentBulkActions.tsx`

**변경 사항**:
- 선택된 항목이 없을 때도 표시 (기능 섹션으로 변경)
- 레이블을 "기능"으로 변경 (선택된 항목이 없을 때)
- 버튼 disabled 상태 개선 (`disabled:opacity-50 disabled:cursor-not-allowed`)
- "선택 해제" 버튼은 선택된 항목이 있을 때만 표시

#### `app/(admin)/admin/students/_components/StudentTable.tsx`

**변경 사항**:
1. 테이블 헤더 변경:
   - 제거: 이번주 학습시간, 이번주 플랜 실행률, 최근 학습일, 성적 입력, 작업
   - 추가: 학교, 학생 연락처, 모 연락처, 부 연락처
2. 이름 컬럼을 `Link`로 변경 (상세 페이지 이동)
3. `StudentActions` 컴포넌트 제거
4. `ProgressBar` import 제거
5. 타입 변경: `StudentWithStats` → `StudentListRow`

#### `app/(admin)/admin/students/_components/StudentListClient.tsx`

**변경 사항**:
- 타입 변경: `StudentWithStats` → `StudentListRow`
- `StudentBulkActions`를 목록 위에 배치 (이미 구현되어 있음)

### Phase 4: 타입 정의 개선

#### `app/(admin)/admin/students/_components/types.ts` (신규)

타입 정의를 중앙화하여 일관성을 유지했습니다.

**타입 정의**:
```typescript
export type StudentListRow = {
  id: string;
  name: string | null;
  grade: string | null;
  class: string | null;
  schoolName: string;
  phone: string | null;
  mother_phone: string | null;
  father_phone: string | null;
  is_active: boolean | null;
};
```

## 최적화 효과

### 1. 성능 개선
- **N+1 문제 해결**: 학교 정보를 배치 쿼리로 일괄 조회
- **병렬 처리**: `Promise.all`을 활용하여 학교 정보와 연락처 정보를 동시에 조회
- **불필요한 데이터 제거**: 통계 데이터 조회 제거로 쿼리 수 감소

### 2. 코드 품질 개선
- **중복 코드 제거**: `StudentActionSection` 삭제, `StudentBulkActions`로 통합
- **타입 안전성**: 타입 정의 중앙화로 일관성 유지
- **재사용성**: 학교 정보 조회 로직을 유틸리티 함수로 분리

### 3. 사용자 경험 개선
- **명확한 필드 구성**: 요구사항에 맞는 필드 구성
- **직관적인 네비게이션**: 이름 클릭 시 상세 페이지 이동
- **일관된 UI**: 기능 섹션을 목록 위에 배치하여 일관성 유지

## 파일 변경 목록

### 신규 파일
1. `lib/data/studentSchools.ts` - 학교 정보 배치 조회 함수
2. `app/(admin)/admin/students/_components/types.ts` - 타입 정의 중앙화

### 수정 파일
1. `app/(admin)/admin/students/page.tsx` - 데이터 페칭 로직 최적화
2. `app/(admin)/admin/students/_components/StudentTable.tsx` - 필드 구성 변경
3. `app/(admin)/admin/students/_components/StudentListClient.tsx` - 타입 수정
4. `app/(admin)/admin/students/_components/StudentBulkActions.tsx` - 기능 섹션으로 변경

### 삭제 파일
1. `app/(admin)/admin/students/_components/StudentActionSection.tsx` - 중복 제거 (이미 삭제됨)

## 검증 사항

- ✅ 필드 구성이 요구사항과 일치
- ✅ 이름 클릭 시 상세 페이지로 이동
- ✅ 기능 섹션 버튼이 정상 작동
- ✅ 배치 쿼리가 N+1 문제를 해결
- ✅ 타입 안전성이 보장됨
- ✅ 기존 필터링 및 페이지네이션이 정상 작동
- ✅ ESLint 에러 없음

## 참고 사항

- Next.js 15 Server Components 모범 사례 준수
- 기존 `getStudentsStatsBatch` 패턴 참고
- Supabase 배치 쿼리 최적화 (`.in()` 활용)
- 타입 안전성 유지 (null 체크 포함)

