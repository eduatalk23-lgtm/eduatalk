# 타입 안전성 강화 가이드

## Supabase 자동 생성 타입 활용

### 1. 타입 생성

Supabase CLI를 사용하여 데이터베이스 스키마에서 TypeScript 타입을 자동 생성합니다.

```bash
# Supabase CLI 설치 (미설치 시)
npm install -g supabase

# Supabase 프로젝트 연결
supabase link --project-ref <your-project-ref>

# 타입 생성
supabase gen types typescript --linked > lib/types/database.types.ts
```

### 2. 타입 통합

자동 생성된 타입과 수동 타입 정의를 통합합니다.

```typescript
// lib/types/database.types.ts (자동 생성)
import { Database } from './database.types';

// lib/types/plan.ts (수동 정의)
import { Database } from './database.types';

// 자동 생성 타입 활용
type PlanGroupRow = Database['public']['Tables']['plan_groups']['Row'];
type PlanGroupInsert = Database['public']['Tables']['plan_groups']['Insert'];
type PlanGroupUpdate = Database['public']['Tables']['plan_groups']['Update'];

// 수동 타입과 통합
export type PlanGroup = PlanGroupRow & {
  // 추가 필드나 변환된 필드
  scheduler_options?: SchedulerOptions;
};
```

### 3. 타입 가드 함수

타입 안전성을 보장하기 위한 타입 가드 함수를 생성합니다.

```typescript
// lib/types/guards.ts
import type { Database } from './database.types';

export function isPlanGroup(
  data: unknown
): data is Database['public']['Tables']['plan_groups']['Row'] {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'student_id' in data &&
    'status' in data
  );
}

export function isStudent(
  data: unknown
): data is Database['public']['Tables']['students']['Row'] {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'tenant_id' in data
  );
}
```

### 4. 타입 일관성 검증

공통 타입 정의를 통합하여 일관성을 확보합니다.

```typescript
// lib/types/common.ts
import type { Database } from './database.types';

// 공통 엔티티 타입
export type BaseEntity = {
  id: string;
  created_at: string;
  updated_at: string;
};

// 테이블별 타입 정의
export type StudentEntity = Database['public']['Tables']['students']['Row'];
export type PlanGroupEntity = Database['public']['Tables']['plan_groups']['Row'];
export type PlanEntity = Database['public']['Tables']['student_plan']['Row'];

// 도메인 타입 (비즈니스 로직용)
export type Student = StudentEntity & {
  // 추가 필드
};

export type PlanGroup = PlanGroupEntity & {
  scheduler_options?: SchedulerOptions;
};
```

### 5. Supabase 클라이언트 타입 지정

Supabase 클라이언트에 타입을 지정하여 타입 안전성을 확보합니다.

```typescript
// lib/supabase/server.ts
import type { Database } from '@/lib/types/database.types';
import { createClient } from '@supabase/supabase-js';

export async function createSupabaseServerClient() {
  // ... 기존 코드 ...
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // ... 옵션 ...
    }
  );
}
```

### 6. 쿼리 결과 타입 지정

쿼리 결과에 타입을 지정하여 타입 안전성을 확보합니다.

```typescript
// lib/data/students.ts
import type { Database } from '@/lib/types/database.types';

type StudentRow = Database['public']['Tables']['students']['Row'];

export async function getStudentById(
  studentId: string
): Promise<StudentRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
```

## 현재 상태

### 수동 타입 정의

- `lib/types/plan.ts`: 플랜 관련 타입 정의
- `lib/types/wizard.ts`: 위저드 관련 타입 정의
- `lib/data/*.ts`: 각 데이터 레이어에서 타입 정의

### 개선 방향

1. **Supabase 자동 생성 타입 도입**
   - `supabase gen types` 명령어로 타입 생성
   - `lib/types/database.types.ts` 파일 생성

2. **타입 통합**
   - 자동 생성 타입과 수동 타입 정의 통합
   - 공통 타입 정의 통합

3. **타입 가드 함수 추가**
   - 런타임 타입 검증
   - 타입 안전성 보장

4. **타입 일관성 검증**
   - 공통 타입 정의 사용
   - 타입 불일치 방지

## 구현 단계

### Phase 1: 타입 생성 및 기본 통합
1. Supabase 타입 생성
2. 기본 타입 통합
3. Supabase 클라이언트 타입 지정

### Phase 2: 타입 가드 및 검증
1. 타입 가드 함수 생성
2. 런타임 타입 검증 추가
3. 타입 일관성 검증

### Phase 3: 점진적 마이그레이션
1. 기존 수동 타입을 자동 생성 타입으로 점진적 마이그레이션
2. 타입 불일치 해결
3. 문서화

## 참고

- [Supabase TypeScript 타입 생성 가이드](https://supabase.com/docs/reference/javascript/typescript-support)
- [TypeScript 타입 가드](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates)

