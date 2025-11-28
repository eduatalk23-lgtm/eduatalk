# student_career_goals 테이블 desired_university_ids 타입 변경

**작성일**: 2025-11-29  
**작업자**: AI Assistant  
**관련 이슈**: `invalid input syntax for type uuid: "UNIV_14"` 에러 수정

---

## 문제 상황

### 에러 메시지

```
invalid input syntax for type uuid: "UNIV_14"
```

### 원인 분석

1. **데이터베이스 컬럼 타입**: `student_career_goals.desired_university_ids`가 `uuid[]`로 정의됨
2. **애플리케이션 사용 형식**: 통합 ID 형식 (`"UNIV_14"`, `"SCHOOL_123"` 등) 사용
3. **타입 불일치**: UUID 배열 컬럼에 문자열 형식의 통합 ID를 저장하려 해서 에러 발생

### 통합 ID 시스템

프로젝트에서는 학교 정보를 통합 관리하기 위해 "통합 ID" 형식을 사용합니다:

- **형식**: `"SCHOOL_123"` (중·고등학교) 또는 `"UNIV_456"` (대학교 캠퍼스)
- **구성**:
  - `SCHOOL_`: `school_info` 테이블의 레코드
  - `UNIV_`: `university_campuses` 테이블의 레코드
  - 숫자 부분: 각 테이블의 `id` (integer)

---

## 해결 방법

### 1. 데이터베이스 마이그레이션

**마이그레이션 파일**: `supabase/migrations/20251129000000_change_desired_university_ids_to_text_array.sql`

```sql
-- 기존 uuid[] 데이터를 text[]로 변환
ALTER TABLE student_career_goals
ALTER COLUMN desired_university_ids TYPE text[] USING desired_university_ids::text[];

-- 코멘트 업데이트
COMMENT ON COLUMN student_career_goals.desired_university_ids IS '희망 대학교 통합 ID 배열 (최대 3개, 형식: UNIV_14, SCHOOL_123 등)';

-- 최대 3개 제한 트리거 생성
CREATE OR REPLACE FUNCTION check_desired_university_ids_length()
RETURNS TRIGGER AS $func$
BEGIN
  IF array_length(NEW.desired_university_ids, 1) > 3 THEN
    RAISE EXCEPTION 'desired_university_ids 배열은 최대 3개까지만 선택할 수 있습니다.';
  END IF;
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

CREATE TRIGGER check_desired_university_ids_length
BEFORE INSERT OR UPDATE ON student_career_goals
FOR EACH ROW
EXECUTE FUNCTION check_desired_university_ids_length();
```

### 2. 애플리케이션 코드 수정

**파일**: `lib/data/studentCareerGoals.ts`

#### 변경 사항

1. **타입 정의 업데이트**

   ```typescript
   desired_university_ids?: string[] | null; // 희망 대학교 통합 ID 배열 (최대 3개, 형식: UNIV_14, SCHOOL_123 등)
   ```

2. **유효성 검증 로직 추가**

   ```typescript
   // 통합 ID 형식인지 확인 (UNIV_14, SCHOOL_123 등)
   const unifiedIdRegex = /^(UNIV_|SCHOOL_)\d+$/;
   const isAllUnifiedIds = universityIds.every((id) => unifiedIdRegex.test(id));

   if (isAllUnifiedIds) {
     // 이미 통합 ID 형식이면 그대로 사용
     resolvedUniversityIds = universityIds;
   } else {
     // UUID 또는 알 수 없는 형식인 경우 에러 처리
     console.error(
       "[data/studentCareerGoals] 알 수 없는 desired_university_ids 형식:",
       universityIds
     );
     return {
       success: false,
       error:
         "학교 ID 형식이 올바르지 않습니다. 통합 ID 형식 (UNIV_*, SCHOOL_*)을 사용해주세요.",
     };
   }
   ```

---

## 변경 전후 비교

### Before

```typescript
// 데이터베이스
desired_university_ids uuid[] DEFAULT '{}'

// 저장 시도
desired_university_ids: ["UNIV_14", "UNIV_23"]
// ❌ ERROR: invalid input syntax for type uuid: "UNIV_14"
```

### After

```typescript
// 데이터베이스
desired_university_ids text[] DEFAULT '{}'

// 저장 시도
desired_university_ids: ["UNIV_14", "UNIV_23"]
// ✅ SUCCESS: 통합 ID 형식 지원
```

---

## 영향 범위

### 수정된 파일

1. `lib/data/studentCareerGoals.ts` - 데이터 레이어 로직
2. `supabase/migrations/20251129000000_change_desired_university_ids_to_text_array.sql` - 마이그레이션

### 영향받는 기능

- ✅ 학생 설정 페이지 (`app/(student)/settings/page.tsx`)
- ✅ 학생 프로필 업데이트 (`app/(student)/actions/studentActions.ts`)
- ✅ 진로 목표 조회 및 수정

### 호환성

- **SchoolMultiSelect 컴포넌트**: 이미 통합 ID 형식(`UNIV_*`, `SCHOOL_*`)을 반환하므로 수정 불필요
- **기존 데이터**: 마이그레이션 시 자동으로 `text[]`로 변환됨

---

## 테스트 체크리스트

- [x] 마이그레이션 정상 실행 확인
- [ ] 학생 설정 페이지에서 희망 대학교 선택 테스트
- [ ] 최대 3개 제한 동작 확인
- [ ] 기존 데이터 정상 조회 확인
- [ ] 진로 목표 업데이트 정상 동작 확인

---

## 향후 개선 사항

### 1. 통합 ID 검증 강화

현재는 정규식 패턴만 검증하고 있음. 향후 실제 학교 존재 여부도 확인하는 로직 추가 고려.

```typescript
// 예시: 통합 ID가 실제 학교를 가리키는지 검증
const schoolExists = await verifyUnifiedSchoolId(unifiedId);
if (!schoolExists) {
  return { success: false, error: "존재하지 않는 학교입니다." };
}
```

### 2. 타입 안전성 개선

통합 ID 타입을 명시적으로 정의하여 타입 안전성 향상.

```typescript
// lib/types/school.ts
export type UnifiedSchoolId = `SCHOOL_${number}` | `UNIV_${number}`;

export type StudentCareerGoal = {
  // ...
  desired_university_ids?: UnifiedSchoolId[] | null;
};
```

---

## 참고 자료

- [통합 ID 시스템 문서](./school-migration-execution-guide.md)
- [학교 데이터 구조](./schools-table-structure.md)
- [학생 진로 목표 테이블](./students-parents-table-segmentation.md#student_career_goals)

---

## 결론

`student_career_goals.desired_university_ids` 컬럼을 `uuid[]`에서 `text[]`로 변경하여, 프로젝트의 통합 ID 시스템과 일관성을 맞췄습니다. 이를 통해 `"UNIV_14"` 형식의 ID를 정상적으로 저장할 수 있게 되었으며, 기존 애플리케이션 코드와의 호환성을 유지했습니다.
