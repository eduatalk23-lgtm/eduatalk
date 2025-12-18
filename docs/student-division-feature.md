# 학생 구분 필드 기능 문서

## 개요

학생 테이블에 `division` 필드를 추가하여 학생을 "고등부", "중등부", "기타"로 구분할 수 있는 기능을 구현했습니다.

**구현 일자**: 2025-01-19  
**마이그레이션 파일**: `supabase/migrations/20250119220000_add_student_division.sql`

---

## 데이터베이스 스키마

### 필드 정보

- **필드명**: `division`
- **타입**: `text`
- **Nullable**: `YES` (기존 데이터 호환성)
- **CHECK 제약조건**: `division IN ('고등부', '중등부', '기타')`
- **인덱스**: `idx_students_division` (필터링 성능 향상)

### 마이그레이션 내용

1. `division` 필드 추가
2. CHECK 제약조건 설정
3. 인덱스 생성
4. 기존 데이터 자동 마이그레이션 (`school_type` 기반)

---

## 타입 정의

### TypeScript 타입

```typescript
// lib/constants/students.ts
export type StudentDivision = "고등부" | "중등부" | "기타";

export const STUDENT_DIVISIONS: Array<{
  value: StudentDivision;
  label: string;
}> = [
  { value: "고등부", label: "고등부" },
  { value: "중등부", label: "중등부" },
  { value: "기타", label: "기타" },
];

// lib/data/students.ts
export type Student = {
  // ... 기타 필드
  division?: StudentDivision | null;
};
```

---

## API 함수

### 데이터 레이어 (`lib/data/students.ts`)

#### `updateStudentDivision()`

학생 구분을 업데이트합니다.

```typescript
await updateStudentDivision(
  studentId: string,
  division: StudentDivision | null
): Promise<{ success: boolean; error?: string }>
```

#### `getStudentsByDivision()`

구분별 학생 목록을 조회합니다.

```typescript
await getStudentsByDivision(
  division: StudentDivision | null
): Promise<Student[]>
```

#### `getStudentDivisionStats()`

구분별 학생 통계를 조회합니다.

```typescript
await getStudentDivisionStats(): Promise<Array<{
  division: StudentDivision | null;
  count: number;
}>>
```

### Server Actions (`app/actions/students.ts`)

#### `updateStudentDivisionAction()`

관리자 권한 확인 후 학생 구분을 업데이트합니다.

```typescript
await updateStudentDivisionAction(
  studentId: string,
  division: StudentDivision | null
): Promise<{ success: boolean; error?: string }>
```

#### `getStudentsByDivisionAction()`

관리자 권한 확인 후 구분별 학생 목록을 조회합니다.

```typescript
await getStudentsByDivisionAction(
  division: StudentDivision | null
): Promise<{ success: boolean; data?: Student[]; error?: string }>
```

#### `getStudentDivisionStatsAction()`

관리자 권한 확인 후 구분별 통계를 조회합니다.

```typescript
await getStudentDivisionStatsAction(): Promise<{
  success: boolean;
  data?: Array<{ division: StudentDivision | null; count: number }>;
  error?: string;
}>
```

---

## UI 컴포넌트

### 관리자 페이지

#### 학생 목록 페이지 (`app/(admin)/admin/students/page.tsx`)

- `division` 필터 추가
- URL 파라미터: `?division=고등부`
- 학생 목록에 구분 표시

#### 검색 필터 (`app/(admin)/admin/students/_components/StudentSearchFilter.tsx`)

- 구분 선택 드롭다운 추가
- "전체", "고등부", "중등부", "기타" 옵션

#### 학생 테이블 (`app/(admin)/admin/students/_components/StudentTable.tsx`)

- 구분 컬럼 추가
- 구분별 배지 스타일링:
  - 고등부: 파란색 배지
  - 중등부: 초록색 배지
  - 기타: 회색 배지

---

## 코드 최적화

### 중복 코드 제거

1. **동적 필드 선택**: `buildStudentQuery()` 함수로 통일
2. **타입 안전한 쿼리**: `createTypedConditionalQuery` 활용
3. **병렬 처리**: 선택적 필드 확인을 병렬로 처리하여 성능 향상

### 타입 안전성

- `any` 타입 제거 → `Record<string, unknown>` 사용
- 명시적 타입 정의
- Null 체크 로직 통일

### 에러 핸들링

- 공통 에러 처리 패턴 적용
- 컬럼 없음 에러(42703) 자동 처리
- Fallback 쿼리 패턴 적용

---

## 사용 예시

### 학생 구분 업데이트

```typescript
import { updateStudentDivisionAction } from "@/app/actions/students";

const result = await updateStudentDivisionAction(
  studentId,
  "고등부"
);

if (result.success) {
  console.log("구분 업데이트 성공");
} else {
  console.error("에러:", result.error);
}
```

### 구분별 학생 목록 조회

```typescript
import { getStudentsByDivision } from "@/lib/data/students";

const highSchoolStudents = await getStudentsByDivision("고등부");
const middleSchoolStudents = await getStudentsByDivision("중등부");
const otherStudents = await getStudentsByDivision("기타");
```

### 구분별 통계 조회

```typescript
import { getStudentDivisionStats } from "@/lib/data/students";

const stats = await getStudentDivisionStats();
// [
//   { division: "고등부", count: 10 },
//   { division: "중등부", count: 5 },
//   { division: "기타", count: 2 },
//   { division: null, count: 3 }
// ]
```

---

## 주의사항

1. **하위 호환성**: `division` 필드는 nullable이므로 기존 코드에 영향 없음
2. **자동 마이그레이션**: `school_type` 기반으로 자동 설정되지만, 수동 확인 권장
3. **권한**: 구분 업데이트는 관리자만 가능
4. **성능**: 인덱스가 추가되어 필터링 성능이 향상됨

---

## 마이그레이션 실행

마이그레이션은 이미 적용되었습니다. 로컬 환경에서 다시 실행하려면:

```bash
# Supabase CLI 사용
supabase migration up

# 또는 직접 SQL 실행
psql -f supabase/migrations/20250119220000_add_student_division.sql
```

---

## 향후 개선 사항

1. 학생 상세 페이지에 구분 수정 기능 추가
2. 구분별 대시보드 통계 추가
3. 구분별 리포트 생성 기능
4. 구분별 알림 설정 기능

---

**마지막 업데이트**: 2025-01-19

