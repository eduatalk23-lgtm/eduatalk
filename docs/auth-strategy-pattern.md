# Auth Strategy Pattern 가이드

> 작성일: 2026-01-04
> 위치: `lib/auth/strategies/`

## 개요

Strategy Pattern을 활용한 역할 기반 인증 처리 시스템입니다. 학생, 관리자, 학부모 등 다양한 역할에 따라 적절한 인증 컨텍스트를 자동으로 생성합니다.

## 핵심 개념

### 1. AuthContext (인증 컨텍스트)

모든 Server Action에서 사용할 수 있는 통합 인증 정보입니다.

```typescript
type AuthContext = StudentAuthContext | AdminAuthContext | ParentAuthContext;

// 모든 컨텍스트 공통 필드
interface CommonAuthFields {
  userId: string;     // 현재 로그인한 사용자 ID
  studentId: string;  // 대상 학생 ID
  tenantId: string;   // 테넌트 ID
}
```

### 2. 역할별 컨텍스트

| 모드 | 설명 | `actingOnBehalfOf` | 특수 필드 |
|------|------|-------------------|-----------|
| `student` | 학생 본인 접근 | `false` | - |
| `admin` | 관리자가 학생 대신 접근 | `true` | `adminRole` |
| `parent` | 학부모가 자녀 대신 접근 | `true` | `childIds` |

## 사용법

### 기본 사용 (resolveAuthContext)

```typescript
import { resolveAuthContext, isAdminContext } from '@/lib/auth/strategies';

async function createPlanGroup(data: FormData, options?: { studentId?: string }) {
  // 1. 인증 컨텍스트 해결 (역할에 따라 자동 분기)
  const auth = await resolveAuthContext({ studentId: options?.studentId });

  // 2. studentId는 모든 컨텍스트에서 사용 가능
  const studentId = auth.studentId;

  // 3. 역할별 로직 (필요시)
  if (isAdminContext(auth)) {
    // 관리자 전용 로직
    logAudit(`Admin ${auth.userId} creating plan for student ${auth.studentId}`);
  }

  // 4. 공통 로직 실행
  return createPlan({ studentId, ...data });
}
```

### 동작 원리

```
resolveAuthContext({ studentId?: string })
    │
    ├── studentId 있음 + admin/consultant 역할
    │   └── AdminAuthStrategy → AdminAuthContext
    │
    ├── studentId 있음 + parent 역할
    │   └── ParentAuthStrategy → ParentAuthContext
    │
    └── studentId 없음 + student 역할
        └── StudentAuthStrategy → StudentAuthContext
```

## Type Guards

타입 안전한 분기 처리를 위한 타입 가드 함수들:

```typescript
import {
  isStudentContext,
  isAdminContext,
  isParentContext,
  isActingOnBehalf
} from '@/lib/auth/strategies';

const auth = await resolveAuthContext(options);

// 학생 컨텍스트 확인
if (isStudentContext(auth)) {
  // auth.mode === 'student'
  // auth.actingOnBehalfOf === false
}

// 관리자 컨텍스트 확인
if (isAdminContext(auth)) {
  // auth.adminRole: 'admin' | 'consultant'
  console.log(`역할: ${auth.adminRole}`);
}

// 학부모 컨텍스트 확인
if (isParentContext(auth)) {
  // auth.childIds: string[]
  console.log(`연결된 자녀: ${auth.childIds.length}명`);
}

// 대리 작업 확인 (Admin 또는 Parent)
if (isActingOnBehalf(auth)) {
  // 다른 사용자를 대신해서 작업 중
  logAudit(`User ${auth.userId} acting on behalf of ${auth.studentId}`);
}
```

## 고급 사용법

### 특정 모드 강제 (resolveAuthContextForMode)

```typescript
import { resolveAuthContextForMode } from '@/lib/auth/strategies';

// 반드시 student 모드로 인증 (실패 시 에러)
const studentAuth = await resolveAuthContextForMode('student');

// 반드시 admin 모드로 인증
const adminAuth = await resolveAuthContextForMode('admin', { studentId: 'student-123' });
```

### 모드 사용 가능 여부 확인 (canUseAuthMode)

```typescript
import { canUseAuthMode } from '@/lib/auth/strategies';

// 현재 사용자가 admin 모드를 사용할 수 있는지 확인
const canUseAdmin = await canUseAuthMode('admin', { studentId: 'student-123' });

if (canUseAdmin) {
  // UI에서 관리자 기능 표시
}
```

### 전략 동적 등록 (테스트/플러그인용)

```typescript
import {
  registerAuthStrategy,
  unregisterAuthStrategy,
  getRegisteredStrategies
} from '@/lib/auth/strategies';

// 테스트에서 커스텀 전략 등록
registerAuthStrategy(mockStrategy, 0); // 0 = 최고 우선순위

// 전략 제거
unregisterAuthStrategy('admin');

// 등록된 전략 확인
const strategies = getRegisteredStrategies();
// ['admin', 'parent', 'student']
```

## 기존 코드에서 마이그레이션

### Before (기존 방식)

```typescript
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { requireStudentAuth } from '@/lib/auth/requireStudentAuth';

async function createPlan(data, options) {
  let studentId: string;

  if (options?.studentId) {
    // Admin 모드
    await requireAdminOrConsultant();
    studentId = options.studentId;
  } else {
    // Student 모드
    const auth = await requireStudentAuth();
    studentId = auth.userId;
  }

  // ... 나머지 로직
}
```

### After (Strategy 패턴)

```typescript
import { resolveAuthContext } from '@/lib/auth/strategies';

async function createPlan(data, options) {
  // 단일 호출로 모든 역할 처리
  const auth = await resolveAuthContext({ studentId: options?.studentId });
  const studentId = auth.studentId;

  // ... 나머지 로직
}
```

## 새로운 전략 추가하기

1. **타입 정의** (`types.ts`):

```typescript
export interface TeacherAuthContext {
  mode: 'teacher';
  userId: string;
  studentId: string;
  tenantId: string;
  actingOnBehalfOf: true;
  classIds: string[];
}

// AuthContext에 추가
export type AuthContext =
  | StudentAuthContext
  | AdminAuthContext
  | ParentAuthContext
  | TeacherAuthContext;
```

2. **전략 구현** (`teacherAuthStrategy.ts`):

```typescript
export class TeacherAuthStrategy implements AuthStrategy<TeacherAuthContext> {
  readonly mode = 'teacher' as const;

  canHandle(role: UserRole | null, options?: AuthOptions): boolean {
    return role === 'teacher' && !!options?.studentId;
  }

  async authenticate(options?: AuthOptions): Promise<TeacherAuthContext> {
    // 구현
  }
}

export const teacherAuthStrategy = new TeacherAuthStrategy();
```

3. **레지스트리 등록** (`authStrategyFactory.ts`):

```typescript
const strategyRegistry: AuthStrategy[] = [
  adminAuthStrategy,
  teacherAuthStrategy,  // 추가
  parentAuthStrategy,
  studentAuthStrategy,
];
```

## 파일 구조

```
lib/auth/strategies/
├── index.ts                 # Public API (re-exports)
├── types.ts                 # 타입 정의
├── authStrategyFactory.ts   # Factory 및 Registry
├── studentAuthStrategy.ts   # 학생 전략
├── adminAuthStrategy.ts     # 관리자 전략
└── parentAuthStrategy.ts    # 학부모 전략
```

## 테스트

각 전략은 독립적으로 테스트됩니다:

```
__tests__/lib/auth/strategies/
├── authStrategyFactory.test.ts   # Factory 테스트 (37 tests)
├── adminAuthStrategy.test.ts     # Admin 전략 테스트
├── parentAuthStrategy.test.ts    # Parent 전략 테스트 (16 tests)
└── studentAuthStrategy.test.ts   # Student 전략 테스트
```

테스트 실행:
```bash
pnpm vitest run __tests__/lib/auth/strategies/
```

## 주의사항

1. **순서 중요**: `strategyRegistry`의 순서가 중요합니다. 더 구체적인 조건(Admin, Parent)이 먼저 체크됩니다.

2. **studentId 의미**:
   - Student 모드: `studentId === userId` (본인)
   - Admin/Parent 모드: `studentId !== userId` (대상 학생)

3. **에러 처리**: 모든 전략은 실패 시 `AppError`를 throw합니다.

4. **tenantId**: Multi-tenant 환경에서 필수입니다. 없으면 빈 문자열로 설정됩니다.
