# Supabase 타입 정규화

## 📋 작업 개요

Supabase 스키마를 기준으로 모든 도메인의 타입을 정규화했습니다. 이제 모든 쿼리/액션 타입은 `database.types.ts`에서 파생됩니다.

## 🎯 목표

1. **단일 소스**: 모든 타입이 `database.types.ts`에서 파생
2. **타입 안전성**: Supabase 스키마와 타입 일치 보장
3. **하위 호환성**: 기존 코드와의 호환성 유지
4. **유지보수성**: 스키마 변경 시 한 곳만 수정

## 📁 생성된 파일

### Database Types

```
lib/supabase/database.types.ts
```

주요 테이블 타입:
- `regions` - 지역
- `schools` - 학교
- `tenants` - 테넌트
- `students` - 학생
- `subject_groups` - 교과 그룹
- `subjects` - 과목
- `subject_types` - 과목 구분
- `student_school_scores` - 내신 성적
- `student_mock_scores` - 모의고사 성적
- `plan_groups` - 플랜 그룹
- `student_plan` - 학생 플랜
- `plan_contents` - 플랜 콘텐츠
- `plan_exclusions` - 플랜 제외일
- `camp_templates` - 캠프 템플릿
- `camp_invitations` - 캠프 초대
- `block_sets` - 블록 세트
- `blocks` - 블록
- `academies` - 학원
- `academy_schedules` - 학원 일정

### 도메인별 Types

| 도메인 | 파일 | 주요 타입 |
|--------|------|-----------|
| school | `lib/domains/school/types.ts` | `School`, `Region`, `SchoolType` |
| score | `lib/domains/score/types.ts` | `SchoolScore`, `MockScore` |
| plan | `lib/domains/plan/types.ts` | `PlanGroup`, `StudentPlan`, `PlanContent` |
| camp | `lib/domains/camp/types.ts` | `CampTemplate`, `CampInvitation` |
| student | `lib/domains/student/types.ts` | `Student` |
| subject | `lib/domains/subject/types.ts` | `SubjectGroup`, `Subject`, `SubjectType` |
| tenant | `lib/domains/tenant/types.ts` | `Tenant` |

## 🔧 타입 사용 방법

### 1. Database 헬퍼 타입

```typescript
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/lib/supabase/database.types";

// Row 타입 (조회 결과)
type School = Tables<"schools">;

// Insert 타입 (생성 입력)
type SchoolInsert = TablesInsert<"schools">;

// Update 타입 (수정 입력)
type SchoolUpdate = TablesUpdate<"schools">;

// Enum 타입
type SchoolType = Enums<"school_type">; // "중학교" | "고등학교" | "대학교"
```

### 2. 도메인별 타입

```typescript
// school 도메인
import type { School, Region, SchoolType, CreateSchoolInput } from "@/lib/domains/school";

// score 도메인
import type { SchoolScore, MockScore, CreateSchoolScoreInput } from "@/lib/domains/score";

// plan 도메인
import type { PlanGroup, StudentPlan, PlanContent } from "@/lib/domains/plan";

// camp 도메인
import type { CampTemplate, CampInvitation, CampProgramType } from "@/lib/domains/camp";
```

### 3. 전체 도메인 import

```typescript
import { school, score, plan, camp, student, subject, tenant } from "@/lib/domains";

// 타입 사용
const s: school.School = { ... };
const sc: score.SchoolScore = { ... };
```

## 📊 타입 구조

### Row, Insert, Update 차이

```typescript
// Row: 조회 결과 (모든 필드가 필수이거나 명시적 null)
type SchoolRow = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교" | null;
  region_id: string | null;
  created_at: string;
  // ...
};

// Insert: 생성 시 입력 (id, timestamps 등 선택적)
type SchoolInsert = {
  id?: string;
  name: string;
  type?: "중학교" | "고등학교" | "대학교" | null;
  region_id?: string | null;
  created_at?: string;
  // ...
};

// Update: 수정 시 입력 (모든 필드 선택적)
type SchoolUpdate = {
  id?: string;
  name?: string;
  type?: "중학교" | "고등학교" | "대학교" | null;
  region_id?: string | null;
  // ...
};
```

### Enum 타입

```typescript
// database.types.ts에 정의된 Enum
type Enums = {
  school_type: "중학교" | "고등학교" | "대학교";
  school_category: "일반고" | "특목고" | "자사고" | "특성화고";
  university_type: "4년제" | "2년제";
  university_ownership: "국립" | "사립";
  content_type: "book" | "lecture" | "custom";
  plan_type: "individual" | "integrated" | "camp";
  camp_program_type: "윈터캠프" | "썸머캠프" | "파이널캠프" | "기타";
  camp_template_status: "draft" | "active" | "archived";
  camp_invitation_status: "pending" | "accepted" | "declined";
};
```

## 🔄 마이그레이션 가이드

### 기존 코드에서 새로운 타입으로

```typescript
// Before (기존)
type School = {
  id: string;
  name: string;
  type: "중학교" | "고등학교" | "대학교";
  // ...
};

// After (새로운 방식)
import type { School } from "@/lib/domains/school";
// 또는
import type { Tables } from "@/lib/supabase/database.types";
type School = Tables<"schools">;
```

### Repository에서 사용

```typescript
// repository.ts
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";

export async function insertSchool(
  input: TablesInsert<"schools">
): Promise<Tables<"schools">> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("schools")
    .insert(input)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

## ✅ 완료된 작업

- [x] `database.types.ts` 생성 (마이그레이션 기반)
- [x] school 도메인 타입 정규화
- [x] score 도메인 타입 정규화
- [x] plan 도메인 타입 정규화
- [x] camp 도메인 타입 정규화
- [x] student 도메인 타입 정규화
- [x] subject 도메인 타입 정규화
- [x] tenant 도메인 타입 정규화
- [x] domains/index.ts 업데이트

## 🔜 향후 작업

### 자동 타입 생성 설정

```bash
# package.json에 스크립트 추가 권장
{
  "scripts": {
    "gen:types": "npx supabase gen types typescript --project-id <PROJECT_ID> > lib/supabase/database.types.ts"
  }
}
```

### 남은 도메인 정규화

- content 도메인
- goal 도메인
- auth 도메인
- block 도메인

## 📝 주의사항

1. **스키마 변경 시**: `database.types.ts`를 다시 생성해야 합니다.
2. **JSONB 필드**: 별도 타입으로 정의해야 합니다 (예: `DailyScheduleInfo`).
3. **deprecated 필드**: 주석으로 표시되어 있습니다.
4. **하위 호환성**: 기존 타입 별칭이 유지됩니다.

