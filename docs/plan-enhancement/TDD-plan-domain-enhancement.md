# TDD: 플랜 도메인 기술 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성일 | 2026-01-01 |
| 관련 PRD | PRD-notion-style-plan-management.md |
| 상태 | Draft |

---

## 1. 기술 개요

### 1.1 현재 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
├─────────────────────────────────────────────────────────────────┤
│  app/(student)/plan/     │  app/(admin)/admin/students/[id]/    │
│  - calendar/             │  - plans/                            │
│  - new-group/            │                                      │
│  - group/[id]/           │                                      │
├─────────────────────────────────────────────────────────────────┤
│                     lib/domains/plan/                            │
│  - actions/plan-groups/  (create, update, delete, status)       │
│  - services/             (adaptiveScheduler, progressCalculator) │
│  - types.ts, repository.ts, service.ts                          │
├─────────────────────────────────────────────────────────────────┤
│                     lib/domains/admin-plan/                      │
│  - actions/              (adHocPlan, planEvent, carryover)      │
│  - types.ts                                                      │
├─────────────────────────────────────────────────────────────────┤
│                     lib/domains/today/                           │
│  - actions/timer.ts      (startPlan, pausePlan, completePlan)   │
├─────────────────────────────────────────────────────────────────┤
│                        Supabase                                  │
│  - student_plan, plan_groups, ad_hoc_plans                      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                        │
├─────────────────────────────────────────────────────────────────┤
│  app/(student)/plan/                                             │
│  - calendar/             (기존)                                  │
│  - new-group/            (기존)                                  │
│  - views/                (신규: 다중 뷰)                         │
│    ├── matrix/                                                   │
│    ├── timeline/                                                 │
│    ├── table/                                                    │
│    └── list/                                                     │
├─────────────────────────────────────────────────────────────────┤
│                     lib/domains/plan/                            │
│  - actions/                                                      │
│    ├── plan-groups/      (기존)                                  │
│    ├── simpleComplete.ts (신규: 간단 완료)                       │
│    └── views.ts          (신규: 뷰 관리)                         │
│  - services/                                                     │
│    ├── adaptiveScheduler.ts (기존)                               │
│    ├── progressCalculator.ts (기존)                              │
│    └── completionManager.ts (신규: 완료 모드 관리)               │
├─────────────────────────────────────────────────────────────────┤
│                        Supabase                                  │
│  - student_plan (확장)                                           │
│  - plan_groups (확장)                                            │
│  - time_slots (신규)                                             │
│  - plan_views (신규)                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터베이스 설계

### 2.1 새 테이블: time_slots

```sql
-- 시간 슬롯 정의 테이블
CREATE TABLE time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_order integer NOT NULL,
  slot_type text NOT NULL CHECK (slot_type IN ('study', 'break', 'meal', 'free')),
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT time_slots_tenant_name_unique UNIQUE (tenant_id, name),
  CONSTRAINT time_slots_valid_time CHECK (start_time < end_time)
);

-- 인덱스
CREATE INDEX idx_time_slots_tenant ON time_slots(tenant_id);
CREATE INDEX idx_time_slots_order ON time_slots(tenant_id, slot_order);

-- RLS 정책
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_slots_tenant_read" ON time_slots
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "time_slots_admin_all" ON time_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'admin'
      AND tenant_id = time_slots.tenant_id
    )
  );
```

### 2.2 새 테이블: plan_views

```sql
-- 사용자 뷰 설정 테이블
CREATE TABLE plan_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name text NOT NULL,
  view_type text NOT NULL CHECK (view_type IN ('calendar', 'timeline', 'table', 'list', 'matrix')),
  settings jsonb DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT plan_views_student_name_unique UNIQUE (student_id, name)
);

-- 인덱스
CREATE INDEX idx_plan_views_student ON plan_views(student_id);
CREATE INDEX idx_plan_views_default ON plan_views(student_id) WHERE is_default = true;

-- RLS 정책
ALTER TABLE plan_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_views_owner_all" ON plan_views
  FOR ALL USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "plan_views_admin_read" ON plan_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN students s ON s.tenant_id = u.tenant_id
      WHERE u.id = auth.uid()
      AND u.role = 'admin'
      AND s.id = plan_views.student_id
    )
  );
```

### 2.3 기존 테이블 확장: student_plan

```sql
-- student_plan 테이블 확장
ALTER TABLE student_plan
  ADD COLUMN IF NOT EXISTS simple_completion boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS simple_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cell_content jsonb,
  ADD COLUMN IF NOT EXISTS linked_urls jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS display_color text;

-- 간단 완료 시간 인덱스
CREATE INDEX idx_student_plan_simple_completed
  ON student_plan(student_id, simple_completed_at)
  WHERE simple_completion = true;

-- cell_content JSONB 스키마 예시
COMMENT ON COLUMN student_plan.cell_content IS '
{
  "markdown": "## 학습 메모\n- 포인트 1\n- 포인트 2",
  "plainText": "학습 메모...",
  "updatedAt": "2026-01-01T10:00:00Z"
}';

-- linked_urls JSONB 스키마 예시
COMMENT ON COLUMN student_plan.linked_urls IS '
[
  {"url": "https://...", "title": "참고 자료", "type": "reference"},
  {"url": "https://...", "title": "과제 제출", "type": "submission"}
]';
```

### 2.4 기존 테이블 확장: plan_groups

```sql
-- plan_groups 테이블 확장
ALTER TABLE plan_groups
  ADD COLUMN IF NOT EXISTS student_permissions jsonb DEFAULT '{
    "canAddAdHoc": true,
    "canEditMemo": true,
    "canMovePlans": false,
    "canChangeColor": true
  }';

-- student_permissions JSONB 스키마
COMMENT ON COLUMN plan_groups.student_permissions IS '
{
  "canAddAdHoc": true,      // 단발성 플랜 추가 가능
  "canEditMemo": true,      // 메모 편집 가능
  "canMovePlans": false,    // 플랜 이동 가능
  "canChangeColor": true,   // 색상 변경 가능
  "canComplete": true       // 완료 처리 가능 (기본 true)
}';
```

---

## 3. 타입 정의

### 3.1 완료 모드 타입

```typescript
// lib/types/plan/completion.ts

export type CompletionMode = 'timer' | 'simple';

export interface SimpleCompletionData {
  completedAt: Date;
  note?: string;
  completedBy: 'student' | 'admin';
}

export interface TimerCompletionData {
  startedAt: Date;
  pausedAt?: Date;
  completedAt: Date;
  totalDuration: number; // seconds
  pauseDuration: number; // seconds
}

export type CompletionData =
  | { mode: 'simple'; data: SimpleCompletionData }
  | { mode: 'timer'; data: TimerCompletionData };
```

### 3.2 뷰 타입

```typescript
// lib/types/plan/views.ts

export type ViewType = 'calendar' | 'timeline' | 'table' | 'list' | 'matrix';

export interface PlanView {
  id: string;
  studentId: string;
  name: string;
  viewType: ViewType;
  settings: ViewSettings;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ViewSettings {
  // 공통 설정
  filters?: ViewFilter[];
  sortBy?: SortOption;

  // 매트릭스 뷰 전용
  matrixConfig?: {
    showWeekends: boolean;
    startHour: number;
    endHour: number;
    slotDuration: number; // minutes
  };

  // 타임라인 뷰 전용
  timelineConfig?: {
    scale: 'hour' | 'half-hour' | 'quarter-hour';
    showCurrentTime: boolean;
  };

  // 테이블 뷰 전용
  tableConfig?: {
    visibleColumns: string[];
    columnWidths: Record<string, number>;
  };
}

export interface ViewFilter {
  field: 'subject' | 'status' | 'date' | 'tag';
  operator: 'eq' | 'neq' | 'in' | 'between';
  value: unknown;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}
```

### 3.3 시간 슬롯 타입

```typescript
// lib/types/plan/timeSlots.ts

export type SlotType = 'study' | 'break' | 'meal' | 'free';

export interface TimeSlot {
  id: string;
  tenantId: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  slotOrder: number;
  slotType: SlotType;
  isDefault: boolean;
}

export interface TimeSlotInput {
  name: string;
  startTime: string;
  endTime: string;
  slotOrder: number;
  slotType: SlotType;
  isDefault?: boolean;
}
```

### 3.4 셀 콘텐츠 타입

```typescript
// lib/types/plan/cellContent.ts

export interface CellContent {
  markdown?: string;
  plainText?: string;
  updatedAt: Date;
}

export interface LinkedUrl {
  url: string;
  title: string;
  type: 'reference' | 'submission' | 'video' | 'document' | 'other';
  addedAt: Date;
}

export interface StudentPlanExtended {
  // 기존 필드들...
  simpleCompletion: boolean;
  simpleCompletedAt: Date | null;
  cellContent: CellContent | null;
  linkedUrls: LinkedUrl[];
  displayColor: string | null;
}
```

### 3.5 권한 타입

```typescript
// lib/types/plan/permissions.ts

export interface StudentPlanPermissions {
  canAddAdHoc: boolean;
  canEditMemo: boolean;
  canMovePlans: boolean;
  canChangeColor: boolean;
  canComplete: boolean;
}

export const DEFAULT_STUDENT_PERMISSIONS: StudentPlanPermissions = {
  canAddAdHoc: true,
  canEditMemo: true,
  canMovePlans: false,
  canChangeColor: true,
  canComplete: true,
};

export interface PlanGroupExtended {
  // 기존 필드들...
  studentPermissions: StudentPlanPermissions;
}
```

---

## 4. 서버 액션 설계

### 4.1 간단 완료 액션

```typescript
// lib/domains/plan/actions/simpleComplete.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { revalidatePath } from 'next/cache';

export interface SimpleCompleteResult {
  success: boolean;
  completedAt?: string;
  error?: string;
}

export async function simpleCompletePlan(
  planId: string,
  note?: string
): Promise<SimpleCompleteResult> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // 권한 검사
  const { data: plan, error: planError } = await supabase
    .from('student_plan')
    .select(`
      id,
      student_id,
      plan_group_id,
      status,
      plan_groups!inner(student_permissions)
    `)
    .eq('id', planId)
    .single();

  if (planError || !plan) {
    return { success: false, error: 'Plan not found' };
  }

  // 이미 완료된 경우
  if (plan.status === 'completed') {
    return { success: false, error: 'Plan already completed' };
  }

  // 학생 권한 검사
  const permissions = plan.plan_groups?.student_permissions as StudentPlanPermissions;
  if (user.role === 'student' && !permissions?.canComplete) {
    return { success: false, error: 'Permission denied' };
  }

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from('student_plan')
    .update({
      status: 'completed',
      simple_completion: true,
      simple_completed_at: now,
      cell_content: note ? {
        markdown: note,
        plainText: note,
        updatedAt: now,
      } : undefined,
    })
    .eq('id', planId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  revalidatePath('/today');
  revalidatePath('/plan');

  return { success: true, completedAt: now };
}

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
    .eq('id', planId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/today');
  revalidatePath('/plan');

  return { success: true };
}
```

### 4.2 뷰 관리 액션

```typescript
// lib/domains/plan/actions/views.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { PlanView, ViewSettings, ViewType } from '@/lib/types/plan/views';

export async function getStudentViews(
  studentId: string
): Promise<PlanView[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('plan_views')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data.map(transformView);
}

export async function createView(
  studentId: string,
  input: {
    name: string;
    viewType: ViewType;
    settings?: ViewSettings;
    isDefault?: boolean;
  }
): Promise<PlanView> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user) throw new Error('Unauthorized');

  // 기본 뷰로 설정 시 기존 기본 뷰 해제
  if (input.isDefault) {
    await supabase
      .from('plan_views')
      .update({ is_default: false })
      .eq('student_id', studentId)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('plan_views')
    .insert({
      student_id: studentId,
      name: input.name,
      view_type: input.viewType,
      settings: input.settings || {},
      is_default: input.isDefault || false,
    })
    .select()
    .single();

  if (error) throw error;

  return transformView(data);
}

export async function updateViewSettings(
  viewId: string,
  settings: Partial<ViewSettings>
): Promise<PlanView> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from('plan_views')
    .select('settings')
    .eq('id', viewId)
    .single();

  const mergedSettings = {
    ...existing?.settings,
    ...settings,
  };

  const { data, error } = await supabase
    .from('plan_views')
    .update({
      settings: mergedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', viewId)
    .select()
    .single();

  if (error) throw error;

  return transformView(data);
}

export async function setDefaultView(
  studentId: string,
  viewId: string
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // 기존 기본 뷰 해제
  await supabase
    .from('plan_views')
    .update({ is_default: false })
    .eq('student_id', studentId);

  // 새 기본 뷰 설정
  await supabase
    .from('plan_views')
    .update({ is_default: true })
    .eq('id', viewId);
}

export async function deleteView(viewId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('plan_views')
    .delete()
    .eq('id', viewId);

  if (error) throw error;
}

function transformView(row: any): PlanView {
  return {
    id: row.id,
    studentId: row.student_id,
    name: row.name,
    viewType: row.view_type,
    settings: row.settings,
    isDefault: row.is_default,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
```

### 4.3 시간 슬롯 액션

```typescript
// lib/domains/plan/actions/timeSlots.ts
'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { TimeSlot, TimeSlotInput } from '@/lib/types/plan/timeSlots';

export async function getTenantTimeSlots(
  tenantId: string
): Promise<TimeSlot[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('time_slots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('slot_order', { ascending: true });

  if (error) throw error;

  return data.map(transformTimeSlot);
}

export async function createTimeSlot(
  tenantId: string,
  input: TimeSlotInput
): Promise<TimeSlot> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    throw new Error('Admin only');
  }

  const { data, error } = await supabase
    .from('time_slots')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      start_time: input.startTime,
      end_time: input.endTime,
      slot_order: input.slotOrder,
      slot_type: input.slotType,
      is_default: input.isDefault || false,
    })
    .select()
    .single();

  if (error) throw error;

  return transformTimeSlot(data);
}

export async function updateTimeSlot(
  slotId: string,
  input: Partial<TimeSlotInput>
): Promise<TimeSlot> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    throw new Error('Admin only');
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.startTime !== undefined) updateData.start_time = input.startTime;
  if (input.endTime !== undefined) updateData.end_time = input.endTime;
  if (input.slotOrder !== undefined) updateData.slot_order = input.slotOrder;
  if (input.slotType !== undefined) updateData.slot_type = input.slotType;
  if (input.isDefault !== undefined) updateData.is_default = input.isDefault;

  const { data, error } = await supabase
    .from('time_slots')
    .update(updateData)
    .eq('id', slotId)
    .select()
    .single();

  if (error) throw error;

  return transformTimeSlot(data);
}

export async function deleteTimeSlot(slotId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    throw new Error('Admin only');
  }

  const { error } = await supabase
    .from('time_slots')
    .delete()
    .eq('id', slotId);

  if (error) throw error;
}

export async function reorderTimeSlots(
  tenantId: string,
  orderedIds: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser();

  if (!user || user.role !== 'admin') {
    throw new Error('Admin only');
  }

  const updates = orderedIds.map((id, index) => ({
    id,
    slot_order: index,
  }));

  for (const update of updates) {
    await supabase
      .from('time_slots')
      .update({ slot_order: update.slot_order })
      .eq('id', update.id);
  }
}

function transformTimeSlot(row: any): TimeSlot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    startTime: row.start_time,
    endTime: row.end_time,
    slotOrder: row.slot_order,
    slotType: row.slot_type,
    isDefault: row.is_default,
  };
}
```

---

## 5. 컴포넌트 설계

### 5.1 뷰 전환 시스템

```typescript
// app/(student)/plan/views/_components/ViewSwitcher.tsx

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { ViewType } from '@/lib/types/plan/views';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange?: (view: ViewType) => void;
}

const VIEW_OPTIONS: { type: ViewType; label: string; icon: string }[] = [
  { type: 'matrix', label: '매트릭스', icon: 'grid' },
  { type: 'timeline', label: '타임라인', icon: 'clock' },
  { type: 'table', label: '테이블', icon: 'table' },
  { type: 'list', label: '리스트', icon: 'list' },
  { type: 'calendar', label: '캘린더', icon: 'calendar' },
];

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleViewChange = (view: ViewType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`?${params.toString()}`);
    onViewChange?.(view);
  };

  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {VIEW_OPTIONS.map(({ type, label, icon }) => (
        <button
          key={type}
          onClick={() => handleViewChange(type)}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
            currentView === type
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <span className="sr-only">{label}</span>
          {/* Icon component */}
          {label}
        </button>
      ))}
    </div>
  );
}
```

### 5.2 매트릭스 뷰

```typescript
// app/(student)/plan/views/matrix/_components/MatrixGrid.tsx

'use client';

import { useMemo } from 'react';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { MatrixCell } from './MatrixCell';
import type { TimeSlot } from '@/lib/types/plan/timeSlots';
import type { StudentPlan } from '@/lib/types/plan/domain';

interface MatrixGridProps {
  timeSlots: TimeSlot[];
  plans: StudentPlan[];
  weekStart: Date;
  onPlanMove?: (planId: string, newSlotId: string, newDate: Date) => void;
  onCellClick?: (slotId: string, date: Date) => void;
  readOnly?: boolean;
}

const DAYS_OF_WEEK = ['월', '화', '수', '목', '금', '토', '일'];

export function MatrixGrid({
  timeSlots,
  plans,
  weekStart,
  onPlanMove,
  onCellClick,
  readOnly = false,
}: MatrixGridProps) {
  const weekDates = useMemo(() => {
    return DAYS_OF_WEEK.map((_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const plansByCell = useMemo(() => {
    const map = new Map<string, StudentPlan[]>();

    plans.forEach((plan) => {
      const planDate = new Date(plan.plannedAt);
      const dayIndex = (planDate.getDay() + 6) % 7; // 월=0, 일=6
      const slot = timeSlots.find((s) => {
        const planTime = planDate.toTimeString().slice(0, 5);
        return planTime >= s.startTime && planTime < s.endTime;
      });

      if (slot) {
        const key = `${slot.id}-${dayIndex}`;
        const existing = map.get(key) || [];
        map.set(key, [...existing, plan]);
      }
    });

    return map;
  }, [plans, timeSlots]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly || !onPlanMove) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const [slotId, dayIndex] = (over.id as string).split('-');
    const newDate = weekDates[parseInt(dayIndex)];

    onPlanMove(active.id as string, slotId, newDate);
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-24 border bg-gray-50 p-2">시간</th>
              {DAYS_OF_WEEK.map((day, index) => (
                <th key={day} className="border bg-gray-50 p-2">
                  <div className="text-sm font-medium">{day}</div>
                  <div className="text-xs text-gray-500">
                    {weekDates[index].getMonth() + 1}/{weekDates[index].getDate()}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((slot) => (
              <tr key={slot.id}>
                <td className="border bg-gray-50 p-2 text-center">
                  <div className="text-sm font-medium">{slot.name}</div>
                  <div className="text-xs text-gray-500">
                    {slot.startTime} - {slot.endTime}
                  </div>
                </td>
                {DAYS_OF_WEEK.map((_, dayIndex) => {
                  const cellKey = `${slot.id}-${dayIndex}`;
                  const cellPlans = plansByCell.get(cellKey) || [];

                  return (
                    <MatrixCell
                      key={cellKey}
                      id={cellKey}
                      plans={cellPlans}
                      slotType={slot.slotType}
                      onClick={() => onCellClick?.(slot.id, weekDates[dayIndex])}
                      readOnly={readOnly}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DndContext>
  );
}
```

### 5.3 간단 완료 체크박스

```typescript
// components/plan/SimpleCompleteCheckbox.tsx

'use client';

import { useState, useTransition } from 'react';
import { simpleCompletePlan } from '@/lib/domains/plan/actions/simpleComplete';
import { cn } from '@/lib/cn';

interface SimpleCompleteCheckboxProps {
  planId: string;
  isCompleted: boolean;
  disabled?: boolean;
  onComplete?: (completedAt: string) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function SimpleCompleteCheckbox({
  planId,
  isCompleted,
  disabled = false,
  onComplete,
  size = 'md',
}: SimpleCompleteCheckboxProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticCompleted, setOptimisticCompleted] = useState(isCompleted);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const handleChange = () => {
    if (disabled || isPending || optimisticCompleted) return;

    setOptimisticCompleted(true);

    startTransition(async () => {
      const result = await simpleCompletePlan(planId);

      if (result.success && result.completedAt) {
        onComplete?.(result.completedAt);
      } else {
        setOptimisticCompleted(false);
      }
    });
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticCompleted}
      disabled={disabled || isPending}
      onClick={handleChange}
      className={cn(
        'rounded border-2 transition-all',
        sizeClasses[size],
        optimisticCompleted
          ? 'border-green-500 bg-green-500 text-white'
          : 'border-gray-300 hover:border-gray-400',
        (disabled || isPending) && 'cursor-not-allowed opacity-50'
      )}
    >
      {optimisticCompleted && (
        <svg
          className="h-full w-full"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      )}
    </button>
  );
}
```

---

## 6. 마이그레이션 전략

### 6.1 데이터베이스 마이그레이션 순서

1. **Phase 1**: 새 테이블 생성 (time_slots, plan_views)
2. **Phase 2**: 기존 테이블 확장 (student_plan, plan_groups)
3. **Phase 3**: RLS 정책 적용
4. **Phase 4**: 기본 데이터 시드 (기본 시간 슬롯)

```sql
-- supabase/migrations/YYYYMMDD_add_notion_style_tables.sql

-- Phase 1: 새 테이블 생성
CREATE TABLE time_slots (...);
CREATE TABLE plan_views (...);

-- Phase 2: 기존 테이블 확장
ALTER TABLE student_plan ADD COLUMN ...;
ALTER TABLE plan_groups ADD COLUMN ...;

-- Phase 3: RLS 정책
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ...;

-- Phase 4: 기본 시간 슬롯 시드 (테넌트별로 실행)
INSERT INTO time_slots (tenant_id, name, start_time, end_time, slot_order, slot_type, is_default)
SELECT
  id as tenant_id,
  unnest(ARRAY['1교시', '2교시', '점심', '3교시', '4교시', '저녁', '자습']) as name,
  unnest(ARRAY['09:00', '10:00', '12:00', '13:00', '14:00', '18:00', '19:00']::time[]) as start_time,
  unnest(ARRAY['10:00', '11:00', '13:00', '14:00', '15:00', '19:00', '21:00']::time[]) as end_time,
  unnest(ARRAY[1, 2, 3, 4, 5, 6, 7]) as slot_order,
  unnest(ARRAY['study', 'study', 'meal', 'study', 'study', 'meal', 'study']::text[]) as slot_type,
  true as is_default
FROM tenants;
```

### 6.2 하위 호환성

기존 타이머 기반 완료 로직은 그대로 유지합니다:

```typescript
// lib/domains/plan/services/completionManager.ts

export function getCompletionMode(plan: StudentPlan): CompletionMode {
  if (plan.simpleCompletion) {
    return 'simple';
  }
  if (plan.startedAt || plan.completedAt) {
    return 'timer';
  }
  return 'pending';
}

export function isCompleted(plan: StudentPlan): boolean {
  return plan.status === 'completed' ||
         plan.simpleCompletion === true;
}

export function getCompletedAt(plan: StudentPlan): Date | null {
  if (plan.simpleCompletedAt) {
    return new Date(plan.simpleCompletedAt);
  }
  if (plan.completedAt) {
    return new Date(plan.completedAt);
  }
  return null;
}
```

---

## 7. 테스트 전략

### 7.1 단위 테스트

```typescript
// __tests__/domains/plan/simpleComplete.test.ts

import { describe, it, expect, vi } from 'vitest';
import { simpleCompletePlan } from '@/lib/domains/plan/actions/simpleComplete';

describe('simpleCompletePlan', () => {
  it('should complete plan with simple mode', async () => {
    // Mock Supabase client
    vi.mock('@/lib/supabase/server', () => ({
      createSupabaseServerClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => ({ data: mockPlan, error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({ error: null }),
          }),
        }),
      }),
    }));

    const result = await simpleCompletePlan('plan-123');

    expect(result.success).toBe(true);
    expect(result.completedAt).toBeDefined();
  });

  it('should reject already completed plans', async () => {
    // ...
  });

  it('should check student permissions', async () => {
    // ...
  });
});
```

### 7.2 통합 테스트

```typescript
// __tests__/integration/matrix-view.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { MatrixGrid } from '@/app/(student)/plan/views/matrix/_components/MatrixGrid';

describe('MatrixGrid', () => {
  it('renders time slots and days correctly', () => {
    render(
      <MatrixGrid
        timeSlots={mockTimeSlots}
        plans={mockPlans}
        weekStart={new Date('2026-01-05')}
      />
    );

    expect(screen.getByText('1교시')).toBeInTheDocument();
    expect(screen.getByText('월')).toBeInTheDocument();
  });

  it('handles drag and drop', async () => {
    const onPlanMove = vi.fn();

    render(
      <MatrixGrid
        timeSlots={mockTimeSlots}
        plans={mockPlans}
        weekStart={new Date('2026-01-05')}
        onPlanMove={onPlanMove}
      />
    );

    // Simulate drag and drop
    // ...

    expect(onPlanMove).toHaveBeenCalledWith(
      'plan-1',
      'slot-2',
      expect.any(Date)
    );
  });
});
```

---

## 8. 성능 고려사항

### 8.1 데이터 페칭 최적화

```typescript
// lib/data/matrixPlans.ts

export async function getMatrixPlansForWeek(
  studentId: string,
  weekStart: Date
): Promise<MatrixPlansData> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const supabase = await createSupabaseServerClient();

  // 병렬 쿼리 실행
  const [plansResult, slotsResult] = await Promise.all([
    supabase
      .from('student_plan')
      .select(`
        id,
        planned_at,
        status,
        simple_completion,
        simple_completed_at,
        display_color,
        content:student_content_masters(name, subject_id),
        subject:subjects(name, color)
      `)
      .eq('student_id', studentId)
      .gte('planned_at', weekStart.toISOString())
      .lt('planned_at', weekEnd.toISOString())
      .order('planned_at'),

    supabase
      .from('time_slots')
      .select('*')
      .eq('tenant_id', /* get from context */)
      .order('slot_order'),
  ]);

  return {
    plans: plansResult.data || [],
    timeSlots: slotsResult.data || [],
  };
}
```

### 8.2 캐싱 전략

```typescript
// lib/hooks/useMatrixData.ts

import { useQuery } from '@tanstack/react-query';

export function useMatrixData(studentId: string, weekStart: Date) {
  return useQuery({
    queryKey: ['matrix-plans', studentId, weekStart.toISOString()],
    queryFn: () => getMatrixPlansForWeek(studentId, weekStart),
    staleTime: 1000 * 60 * 5, // 5분
    gcTime: 1000 * 60 * 30,   // 30분
  });
}
```

---

## 9. 파일 구조

```
lib/
├── domains/plan/
│   ├── actions/
│   │   ├── plan-groups/          # 기존
│   │   ├── simpleComplete.ts     # 신규
│   │   ├── views.ts              # 신규
│   │   └── timeSlots.ts          # 신규
│   ├── services/
│   │   ├── adaptiveScheduler.ts  # 기존
│   │   ├── progressCalculator.ts # 기존
│   │   └── completionManager.ts  # 신규
│   └── types.ts
├── types/plan/
│   ├── domain.ts                 # 기존 확장
│   ├── completion.ts             # 신규
│   ├── views.ts                  # 신규
│   ├── timeSlots.ts              # 신규
│   ├── cellContent.ts            # 신규
│   └── permissions.ts            # 신규
└── data/
    └── matrixPlans.ts            # 신규

app/(student)/plan/
├── views/                        # 신규 디렉토리
│   ├── _components/
│   │   ├── ViewSwitcher.tsx
│   │   └── ViewFiltersBar.tsx
│   ├── matrix/
│   │   ├── page.tsx
│   │   └── _components/
│   │       ├── MatrixGrid.tsx
│   │       └── MatrixCell.tsx
│   ├── timeline/
│   │   ├── page.tsx
│   │   └── _components/
│   ├── table/
│   │   ├── page.tsx
│   │   └── _components/
│   └── list/
│       ├── page.tsx
│       └── _components/
├── calendar/                     # 기존
└── new-group/                    # 기존

components/plan/
├── SimpleCompleteCheckbox.tsx    # 신규
├── PlanCell.tsx                  # 신규
└── CellEditor.tsx                # 신규

supabase/migrations/
└── YYYYMMDD_add_notion_style_tables.sql
```

---

## 10. 의존성

### 10.1 새 패키지

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  }
}
```

### 10.2 기존 패키지 활용

- `@tanstack/react-query`: 데이터 캐싱
- `date-fns`: 날짜 처리
- `tailwindcss`: 스타일링

---

## 11. 참고 문서

- [PRD 문서](./PRD-notion-style-plan-management.md)
- [ADR-003: 간단 완료 모드](./ADR-003-simple-completion-mode.md)
- [기존 플랜 타입](lib/types/plan/domain.ts)
- [기존 타이머 액션](lib/domains/today/actions/timer.ts)
