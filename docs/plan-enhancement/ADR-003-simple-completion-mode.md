# ADR-003: 간단 완료 모드 도입

## 상태

**승인됨** (Approved)

## 맥락

TimeLevelUp의 현재 플랜 완료 방식은 타이머 기반입니다. 학생이 플랜을 시작하면 타이머가 작동하고, 일시정지/재개를 거쳐 완료 처리합니다. 하지만 모든 학습 활동에 타이머가 필요하지는 않습니다.

### 현재 시스템의 한계

1. **모든 플랜에 타이머 강제**: 간단한 읽기 과제, 메모 작성 등에도 타이머 필수
2. **완료 과정 복잡**: 시작 → (일시정지) → 완료의 여러 단계
3. **관리자 플랜의 어색함**: 관리자가 생성한 과제를 학생이 타이머로 수행하는 것이 부자연스러움
4. **오프라인 학습 기록 어려움**: 학원 외 학습(학교 수업, 자습)은 타이머로 추적 불가

### 요구사항

1. 체크박스만으로 간단히 완료 처리
2. 기존 타이머 방식과 공존
3. 완료 시 간단한 메모 입력 가능
4. 관리자가 완료 모드를 지정할 수 있어야 함

## 고려한 옵션

### 옵션 1: 타이머 제거 및 체크박스 전면 도입

**장점:**
- 사용자 경험 단순화
- 개발 복잡도 감소

**단점:**
- 학습 시간 추적 기능 상실
- 기존 사용자 혼란
- 게이미피케이션 기능 약화

### 옵션 2: 완료 모드 이원화 (선택)

**장점:**
- 기존 기능 유지
- 용도에 맞는 선택 가능
- 점진적 도입 가능

**단점:**
- 두 가지 모드 유지 관리 필요
- UI/UX 복잡도 증가

### 옵션 3: 타이머 자동 완료 (시간 도달 시)

**장점:**
- 기존 타이머 유지
- 자동화로 편의성 개선

**단점:**
- 실제 학습 여부 확인 불가
- 본질적인 문제 미해결

## 결정

**옵션 2: 완료 모드 이원화를 도입합니다.**

- `timer`: 기존 타이머 기반 완료 (기본값)
- `simple`: 체크박스 기반 간단 완료

### 이유

1. **하위 호환성**: 기존 타이머 기능과 데이터 유지
2. **유연성**: 플랜 유형에 맞는 완료 방식 선택
3. **관리자 권한**: 플랜 그룹별로 완료 모드 지정 가능
4. **데이터 무결성**: 두 모드의 완료 시간을 별도 필드로 관리

## 구현 상세

### 데이터베이스 스키마

```sql
-- student_plan 테이블 확장
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS simple_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS simple_completed_at timestamptz;

-- 인덱스 추가
CREATE INDEX idx_student_plan_simple_completed
  ON student_plan(student_id, simple_completed_at)
  WHERE simple_completion = true;

-- 체크 제약 조건: 두 모드가 동시에 완료될 수 없음
ALTER TABLE student_plan
  ADD CONSTRAINT check_completion_mode
  CHECK (
    (simple_completion = true AND completed_at IS NULL) OR
    (simple_completion = false OR simple_completion IS NULL)
  );
```

### 타입 정의

```typescript
// lib/types/plan/completion.ts

/**
 * 플랜 완료 모드
 * - timer: 타이머를 사용한 완료 (학습 시간 추적)
 * - simple: 체크박스만으로 완료 (시간 추적 없음)
 */
export type CompletionMode = 'timer' | 'simple';

/**
 * 완료 모드별 데이터
 */
export interface SimpleCompletionData {
  completedAt: Date;
  note?: string;
  completedBy: 'student' | 'admin';
}

export interface TimerCompletionData {
  startedAt: Date;
  pausedAt?: Date;
  completedAt: Date;
  totalDuration: number;    // 총 학습 시간 (초)
  pauseDuration: number;    // 일시정지 시간 (초)
  effectiveDuration: number; // 실제 학습 시간 (초)
}

/**
 * 통합 완료 정보
 */
export type CompletionInfo =
  | { mode: 'simple'; data: SimpleCompletionData }
  | { mode: 'timer'; data: TimerCompletionData }
  | { mode: 'none'; data: null };

/**
 * 플랜 완료 상태 판단 유틸리티
 */
export function getCompletionInfo(plan: StudentPlan): CompletionInfo {
  if (plan.simpleCompletion && plan.simpleCompletedAt) {
    return {
      mode: 'simple',
      data: {
        completedAt: new Date(plan.simpleCompletedAt),
        note: plan.cellContent?.plainText,
        completedBy: 'student', // TODO: 실제 완료자 추적
      },
    };
  }

  if (plan.completedAt) {
    return {
      mode: 'timer',
      data: {
        startedAt: new Date(plan.startedAt!),
        pausedAt: plan.pausedAt ? new Date(plan.pausedAt) : undefined,
        completedAt: new Date(plan.completedAt),
        totalDuration: plan.totalDuration || 0,
        pauseDuration: plan.pauseDuration || 0,
        effectiveDuration: (plan.totalDuration || 0) - (plan.pauseDuration || 0),
      },
    };
  }

  return { mode: 'none', data: null };
}

export function isCompleted(plan: StudentPlan): boolean {
  return plan.simpleCompletion === true || plan.status === 'completed';
}

export function getCompletedAt(plan: StudentPlan): Date | null {
  if (plan.simpleCompletedAt) return new Date(plan.simpleCompletedAt);
  if (plan.completedAt) return new Date(plan.completedAt);
  return null;
}
```

### 서버 액션

```typescript
// lib/domains/plan/actions/simpleComplete.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { revalidatePath } from 'next/cache';

export interface SimpleCompleteInput {
  planId: string;
  note?: string;
}

export interface SimpleCompleteResult {
  success: boolean;
  completedAt?: string;
  error?: string;
}

/**
 * 일반 플랜 간단 완료
 */
export async function simpleCompletePlan(
  input: SimpleCompleteInput
): Promise<SimpleCompleteResult> {
  const { planId, note } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // 플랜 조회 및 권한 검사
  const { data: plan, error: planError } = await supabase
    .from('student_plan')
    .select(`
      id,
      student_id,
      plan_group_id,
      status,
      simple_completion,
      plan_groups!inner(student_permissions)
    `)
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    return { success: false, error: 'Plan not found' };
  }

  // 이미 완료된 경우
  if (plan.status === 'completed' || plan.simple_completion) {
    return { success: false, error: 'Plan already completed' };
  }

  // 학생의 경우 권한 검사
  if (user.role === 'student') {
    // 본인 플랜인지 확인
    const { data: student } = await supabase
      .from('students')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!student || plan.student_id !== student.id) {
      return { success: false, error: 'Permission denied' };
    }

    // 완료 권한 확인
    const permissions = plan.plan_groups?.student_permissions;
    if (permissions && permissions.canComplete === false) {
      return { success: false, error: 'Completion not allowed' };
    }
  }

  const now = new Date().toISOString();

  // 간단 완료 처리
  const { error: updateError } = await supabase
    .from('student_plan')
    .update({
      status: 'completed',
      simple_completion: true,
      simple_completed_at: now,
      cell_content: note
        ? {
            plainText: note,
            markdown: note,
            updatedAt: now,
          }
        : undefined,
    })
    .eq('id', planId);

  if (updateError) {
    console.error('Simple complete error:', updateError);
    return { success: false, error: 'Failed to complete' };
  }

  // 캐시 무효화
  revalidatePath('/today');
  revalidatePath('/plan');
  revalidatePath(`/plan/group/${plan.plan_group_id}`);

  return { success: true, completedAt: now };
}

/**
 * 간단 완료 취소 (관리자 전용)
 */
export async function undoSimpleComplete(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    return { success: false, error: 'Admin only' };
  }

  const { error } = await supabase
    .from('student_plan')
    .update({
      status: 'pending',
      simple_completion: false,
      simple_completed_at: null,
    })
    .eq('id', planId)
    .eq('simple_completion', true); // 간단 완료만 취소 가능

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/today');
  revalidatePath('/plan');

  return { success: true };
}

/**
 * Ad-hoc 플랜 간단 완료
 */
export async function simpleCompleteAdHocPlan(
  input: SimpleCompleteInput
): Promise<SimpleCompleteResult> {
  const { planId, note } = input;
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from('ad_hoc_plans')
    .update({
      status: 'completed',
      simple_completion: true,
      simple_completed_at: now,
      memo: note,
    })
    .eq('id', planId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/today');

  return { success: true, completedAt: now };
}
```

### UI 컴포넌트

```typescript
// components/plan/SimpleCompleteCheckbox.tsx
'use client';

import { useState, useTransition } from 'react';
import { simpleCompletePlan } from '@/lib/domains/plan/actions/simpleComplete';
import { cn } from '@/lib/cn';
import { Check } from 'lucide-react';

interface SimpleCompleteCheckboxProps {
  planId: string;
  isCompleted: boolean;
  disabled?: boolean;
  showNoteInput?: boolean;
  onComplete?: (completedAt: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function SimpleCompleteCheckbox({
  planId,
  isCompleted,
  disabled = false,
  showNoteInput = false,
  onComplete,
  size = 'md',
  className,
}: SimpleCompleteCheckboxProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const handleComplete = (noteText?: string) => {
    if (disabled || isPending || optimisticCompleted) return;

    // Optimistic update
    setOptimisticCompleted(true);
    setShowNote(false);

    startTransition(async () => {
      const result = await simpleCompletePlan({
        planId,
        note: noteText,
      });

      if (result.success && result.completedAt) {
        onComplete?.(result.completedAt);
      } else {
        // Rollback on error
        setOptimisticCompleted(false);
        console.error('Complete failed:', result.error);
      }
    });
  };

  const handleClick = () => {
    if (optimisticCompleted) return;

    if (showNoteInput) {
      setShowNote(true);
    } else {
      handleComplete();
    }
  };

  if (showNote) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (선택)"
          className="rounded border px-2 py-1 text-sm"
          autoFocus
        />
        <button
          onClick={() => handleComplete(note)}
          className="rounded bg-green-500 px-2 py-1 text-sm text-white"
        >
          완료
        </button>
        <button
          onClick={() => setShowNote(false)}
          className="text-sm text-gray-500"
        >
          취소
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticCompleted}
      aria-label={optimisticCompleted ? '완료됨' : '완료하기'}
      disabled={disabled || isPending}
      onClick={handleClick}
      className={cn(
        'flex items-center justify-center rounded border-2 transition-all',
        SIZE_CLASSES[size],
        optimisticCompleted
          ? 'border-green-500 bg-green-500 text-white'
          : 'border-gray-300 bg-white hover:border-green-400',
        (disabled || isPending) && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {optimisticCompleted && (
        <Check className="h-3/4 w-3/4" strokeWidth={3} />
      )}
      {isPending && !optimisticCompleted && (
        <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
      )}
    </button>
  );
}
```

### 리스트 아이템 통합

```typescript
// components/plan/PlanListItem.tsx
'use client';

import { SimpleCompleteCheckbox } from './SimpleCompleteCheckbox';
import { TimerButton } from './TimerButton';
import { getCompletionInfo } from '@/lib/types/plan/completion';
import type { StudentPlan } from '@/lib/types/plan/domain';

interface PlanListItemProps {
  plan: StudentPlan;
  completionMode: 'timer' | 'simple' | 'both';
}

export function PlanListItem({ plan, completionMode }: PlanListItemProps) {
  const completionInfo = getCompletionInfo(plan);
  const isCompleted = completionInfo.mode !== 'none';

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      {/* 완료 UI: 모드에 따라 다르게 표시 */}
      {completionMode === 'simple' && (
        <SimpleCompleteCheckbox
          planId={plan.id}
          isCompleted={isCompleted}
        />
      )}

      {completionMode === 'timer' && (
        <TimerButton
          planId={plan.id}
          status={plan.status}
        />
      )}

      {completionMode === 'both' && (
        <div className="flex gap-2">
          <SimpleCompleteCheckbox
            planId={plan.id}
            isCompleted={isCompleted}
            size="sm"
          />
          <TimerButton
            planId={plan.id}
            status={plan.status}
            size="sm"
          />
        </div>
      )}

      {/* 플랜 정보 */}
      <div className="flex-1">
        <h3 className={cn(
          'font-medium',
          isCompleted && 'text-gray-500 line-through'
        )}>
          {plan.content?.name || '제목 없음'}
        </h3>
        <p className="text-sm text-gray-500">
          {plan.plannedAt && formatTime(plan.plannedAt)}
        </p>
      </div>

      {/* 완료 정보 */}
      {isCompleted && (
        <div className="text-xs text-gray-400">
          {completionInfo.mode === 'simple' ? (
            <span>완료됨</span>
          ) : (
            <span>{formatDuration(completionInfo.data.effectiveDuration)}</span>
          )}
        </div>
      )}
    </div>
  );
}
```

## 마이그레이션

### 기존 데이터 처리

기존 완료된 플랜은 타이머 모드로 유지됩니다:

```sql
-- 기존 완료 플랜은 타이머 모드로 간주
-- simple_completion은 false(기본값)로 유지
-- 마이그레이션 불필요
```

### 점진적 활성화

1. **Phase 1**: 관리자 생성 플랜에만 간단 완료 허용
2. **Phase 2**: 플랜 그룹 설정에서 완료 모드 선택
3. **Phase 3**: 학생별 기본 완료 모드 설정

## 결과

### 기대 효과

| 지표 | 현재 | 목표 |
|------|------|------|
| 플랜 완료율 | 65% | 80% |
| 완료 소요 시간 | 30초+ | 1초 |
| 사용자 불만 | 높음 | 낮음 |

### 측정 방법

```typescript
// 완료 모드별 통계 쿼리
const completionStats = await supabase
  .from('student_plan')
  .select('simple_completion, count(*)')
  .eq('status', 'completed')
  .group('simple_completion');
```

## 관련 문서

- [PRD: Notion 스타일 플랜 관리](./PRD-notion-style-plan-management.md)
- [TDD: 플랜 도메인 기술 설계](./TDD-plan-domain-enhancement.md)
- [기존 타이머 액션](lib/domains/today/actions/timer.ts)
