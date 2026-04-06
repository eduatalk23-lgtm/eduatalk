# 캘린더 반복 ↔ 일반 이벤트 전환 개선 계획

## 배경

2026-04-06 갭 분석으로 Critical/High 데이터 정합성 이슈(Gap 1~4)는 수정 완료.
남은 2개 개선 항목은 UX 안전성과 복구 가능성에 관한 것이다.

### 완료된 수정 (calendarEventActions.ts)
- `updateCalendarEventFull()`: rrule 전환 시 exdates/exception 필드 정리 + orphan soft-delete
- `updateRecurringEvent()` scope 'all': rrule 변경 시 exdates 초기화

---

## 개선 A: 반복 제거 시 확인 다이얼로그

### 문제

사용자가 반복 이벤트 편집에서 RecurrenceSelector를 "반복 안함"으로 변경하면:

```
isRecurring = !!(form.rrule || originalData?.recurring_event_id)
            = !!(null || null)  // master 이벤트의 경우
            = false
```

→ scope 선택 없이 `updateCalendarEventFull()`이 호출되어 **exception이 무통보 삭제**됨.

### 수정 범위

| 파일 | 변경 |
|------|------|
| `useEventEditForm.ts` | `isRecurring` 판단에 `originalData?.rrule` 추가 + 전환 감지 |
| `useEventEditForm.ts` | `handleSave`에서 반복 제거 확인 분기 |
| `RecurringRemoveConfirmModal.tsx` (신규) | 확인 다이얼로그 컴포넌트 |
| `EventEditPage.tsx` | 확인 모달 렌더링 |

### 구현 상세

#### Step 1: `isRecurring` 판단 보강 — `useEventEditForm.ts`

```typescript
// Before
const isRecurring = !!(form.rrule || originalData?.recurring_event_id);

// After: 원본이 반복이었으면 여전히 recurring 컨텍스트로 취급
const wasRecurring = !!(originalData?.rrule);
const isRecurring = !!(form.rrule || originalData?.recurring_event_id || wasRecurring);

// 반복 제거 전환 감지 (master 이벤트에서 rrule → null)
const isRemovingRecurrence = wasRecurring && !form.rrule;
```

#### Step 2: `handleSave` 분기 — `useEventEditForm.ts`

```typescript
// handleSave 내부, 현재 scope 선택 분기 앞에 삽입
if (opts.mode === 'edit' && isRemovingRecurrence) {
  // 반복 제거 확인 다이얼로그 트리거
  setNeedsRecurrenceRemoveConfirm(true);
  return;
}
```

#### Step 3: 확인 다이얼로그 — `RecurringRemoveConfirmModal.tsx` (신규)

```
UI 텍스트:
  제목: "반복 해제"
  본문: "이 일정의 반복 설정을 제거합니다.
        개별 수정된 일정 {exceptionCount}건이 함께 삭제됩니다.
        첫 번째 일정만 남게 됩니다."
  버튼: [취소] [반복 해제]
```

- exception 개수는 `originalData`에서 사전 조회 또는 백엔드에서 count 반환
- 확인 시 `updateCalendarEventFull()` 호출 (기존 로직 그대로)
- 취소 시 rrule을 원래 값으로 복원

#### Step 4: exception 개수 사전 조회

`getCalendarEventForEdit()` 응답에 `exceptionCount` 필드 추가:

```typescript
// calendarEventActions.ts — getCalendarEventForEdit 내부
const { count: exceptionCount } = await supabase
  .from('calendar_events')
  .select('id', { count: 'exact', head: true })
  .eq('recurring_event_id', eventId)
  .eq('is_exception', true)
  .is('deleted_at', null);
```

---

## 개선 B: 반복 전환 Undo 지원

### 문제

현재 Undo 시스템은 5가지 액션을 지원:
- `delete-plan`, `move-to-date`, `resize`, `status-change`, `recurring-delete`

**반복 전환(rrule 변경)은 undo 불가.** 사용자가 반복을 실수로 해제하면 exception들이 soft-delete되고 복구할 수 없다.

### 수정 범위

| 파일 | 변경 |
|------|------|
| `undoTypes.ts` | `recurrence-remove` 타입 추가 |
| `calendarEventActions.ts` | `updateCalendarEventFull` 반환값 확장 (삭제된 exception IDs + 이전 rrule/exdates) |
| `calendarEventActions.ts` | `restoreRecurrenceRemove()` 함수 추가 |
| `UndoSnackbar.tsx` | `recurrence-remove` case 처리 |
| `useEventEditForm.ts` | 저장 성공 후 undo 액션 push |

### 구현 상세

#### Step 1: 반환값 확장 — `updateCalendarEventFull()`

```typescript
// 반환 타입 변경
interface UpdateCalendarEventFullResult {
  success: boolean;
  error?: string;
  /** 반복→일반 전환 시 undo용 메타데이터 */
  recurrenceRemoveMeta?: {
    previousRrule: string;
    previousExdates: string[] | null;
    deletedExceptionIds: string[];
  };
}
```

orphan soft-delete 단계에서 삭제된 ID + 이전 상태를 수집하여 반환:

```typescript
// 기존 orphan 삭제 로직 확장
if (needsRrulePrefetch && previousRrule && !updates.rrule) {
  const { data: orphans } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('recurring_event_id', eventId)
    .eq('is_exception', true)
    .is('deleted_at', null);

  const deletedIds: string[] = [];
  if (orphans && orphans.length > 0) {
    deletedIds.push(...orphans.map(e => e.id));
    await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .in('id', deletedIds);
  }

  // undo 메타 첨부
  recurrenceRemoveMeta = {
    previousRrule,
    previousExdates: previousExdates ?? null,  // prefetch에서 함께 조회
    deletedExceptionIds: deletedIds,
  };
}
```

#### Step 2: 복원 함수 — `restoreRecurrenceRemove()`

```typescript
export async function restoreRecurrenceRemove(params: {
  eventId: string;
  previousRrule: string;
  previousExdates: string[] | null;
  deletedExceptionIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // 1. 부모 이벤트의 rrule + exdates 복원
  await supabase
    .from('calendar_events')
    .update({ rrule: params.previousRrule, exdates: params.previousExdates })
    .eq('id', params.eventId);

  // 2. soft-deleted exception들 복원
  for (const id of params.deletedExceptionIds) {
    await restoreEvent(id);
  }

  return { success: true };
}
```

#### Step 3: UndoableAction 타입 확장 — `undoTypes.ts`

```typescript
| {
    type: 'recurrence-remove';
    eventId: string;
    previousRrule: string;
    previousExdates: string[] | null;
    deletedExceptionIds: string[];
    description: string;
  }
```

#### Step 4: UndoSnackbar 처리 — `UndoSnackbar.tsx`

```typescript
case 'recurrence-remove':
  result = await restoreRecurrenceRemove({
    eventId: action.eventId,
    previousRrule: action.previousRrule,
    previousExdates: action.previousExdates,
    deletedExceptionIds: action.deletedExceptionIds,
  });
  break;
```

#### Step 5: 저장 후 undo push — `useEventEditForm.ts`

이벤트 편집 페이지에서는 저장 후 다른 페이지로 이동하므로, undo를 push할 수 없다.
대신 **confirm 단계에서 이미 경고**하므로 undo 우선순위는 낮다.

**대안**: 편집 페이지가 아닌 **인라인 수정**(EventDetailPopover, 드래그 등)에서
반복 전환이 발생하는 경우에 한해 undo push. 현재는 인라인에서 rrule 변경 경로가 없으므로
개선 B는 **개선 A가 충분히 작동하면 보류 가능**.

---

## 실행 결과

| 순번 | 항목 | 상태 |
|------|------|------|
| 1 | **개선 A: 확인 다이얼로그** | 완료 (2026-04-06) |
| 2 | **개선 B: Undo 지원 + UndoProvider 레이아웃 승격** | 완료 (2026-04-06) |

### 개선 A 의존성
- `getCalendarEventForEdit` 응답에 exceptionCount 추가 (DB 쿼리 1건)
- `RecurringRemoveConfirmModal` 신규 컴포넌트
- `useEventEditForm`의 `isRecurring` 로직 수정

### 개선 B 의존성
- 개선 A 완료 후 진행
- `updateCalendarEventFull` 반환 타입 breaking change → 호출처 전수 확인 필요
