# Phase 2.2: 플랜 수정 Optimistic Locking 구현

## 작업 개요

**작업 ID**: Phase 2.2  
**작업명**: 플랜 수정 Optimistic Locking 구현  
**우선순위**: HIGH  
**작업 일자**: 2026-01-07

## 목표

동일 플랜에 대한 동시 수정을 방지하여 마지막 요청만 반영되는 문제를 해결합니다.

## 문제점

### 기존 문제

1. **동시 수정 시 마지막 요청만 반영**: 동일 플랜에 대한 동시 수정 요청 시 마지막 요청만 반영되어 이전 수정이 덮어씌워짐
2. **Optimistic Locking 미적용**: `version` 필드가 존재하지만 업데이트 시 버전 체크를 하지 않음
3. **데이터 손실 위험**: 사용자가 수정한 내용이 다른 사용자의 수정으로 인해 손실될 수 있음

## 구현 내용

### 1. student_plan 테이블의 version 필드 활용

**기존 상태**:
- `student_plan` 테이블에 `version` 필드가 이미 존재 (마이그레이션: `20251209212000_add_version_group_id.sql`)
- 기본값: 1
- 하지만 업데이트 시 버전 체크를 하지 않음

### 2. calendarDrag.ts에 Optimistic Locking 적용

**파일**: `lib/domains/plan/actions/calendarDrag.ts`

**변경된 함수**:
- `rescheduleOnDrop`: 드래그앤드롭으로 플랜 날짜/시간 변경
- `resizePlanDuration`: 시간 블록 리사이즈로 시간 변경

**구현 방법**:

1. **플랜 조회 시 version 필드 포함**:
   ```typescript
   const { data: existingPlan } = await supabase
     .from("student_plan")
     .select("id, plan_date, start_time, end_time, student_id, content_title, plan_group_id, version, ...")
     .eq("id", planId)
     .single();
   ```

2. **업데이트 시 버전 체크 및 증가**:
   ```typescript
   const currentVersion = existingPlan.version ?? 1;
   const { data: updatedPlan, error: updateError } = await supabase
     .from("student_plan")
     .update({
       ...updateData,
       version: currentVersion + 1,
     })
     .eq("id", planId)
     .eq("version", currentVersion)  // 버전 체크
     .select("id")
     .single();
   ```

3. **버전 불일치 시 에러 처리**:
   ```typescript
   if (!updatedPlan) {
     return {
       success: false,
       error: "플랜이 이미 수정되었습니다. 새로고침 후 다시 시도해주세요.",
     };
   }
   ```

## 변경된 파일 목록

1. **TypeScript 파일**:
   - `lib/domains/plan/actions/calendarDrag.ts` (수정)

## 검증 방법

### 단위 테스트

1. **정상 케이스**: 버전이 일치하는 경우 업데이트 성공
2. **동시 수정 케이스**: 두 요청이 동시에 들어올 때 하나만 성공하고 다른 하나는 버전 불일치 에러
3. **버전 증가 확인**: 업데이트 성공 시 버전이 1 증가하는지 확인

### 통합 테스트

1. 실제 달력 드래그앤드롭 플로우에서 동시 수정 시나리오 테스트
2. 버전 불일치 시 적절한 에러 메시지 반환 확인

### 수동 검증

1. 개발 환경에서 동시에 같은 플랜을 수정하기
2. 하나만 성공하고 다른 하나는 "플랜이 이미 수정되었습니다" 메시지 확인

## 동작 원리

### Optimistic Locking 패턴

1. **읽기 단계**: 플랜 조회 시 현재 `version` 값도 함께 조회
2. **수정 단계**: 업데이트 시 `version` 필드를 조건으로 추가하여 버전이 변경되지 않았는지 확인
3. **버전 증가**: 업데이트 성공 시 `version`을 1 증가
4. **충돌 감지**: 버전이 일치하지 않으면 업데이트가 0개 행에 적용되어 `updatedPlan`이 null이 됨

### 예시 시나리오

**시나리오**: 사용자 A와 B가 동시에 같은 플랜을 수정

1. **초기 상태**: `version = 1`
2. **사용자 A 요청**: 플랜 조회 → `version = 1` 확인 → 업데이트 시도 (`version = 1` 조건)
3. **사용자 B 요청**: 플랜 조회 → `version = 1` 확인 → 업데이트 시도 (`version = 1` 조건)
4. **사용자 A 성공**: 업데이트 성공 → `version = 2`로 증가
5. **사용자 B 실패**: `version = 1` 조건이 맞지 않아 업데이트 실패 → 에러 반환

## 주의사항

1. **version 필드 초기화**: 기존 플랜의 `version`이 null일 수 있으므로 `?? 1`로 기본값 처리
2. **에러 메시지**: 사용자에게 친화적인 메시지 제공 ("새로고침 후 다시 시도해주세요")
3. **ad_hoc_plans**: 현재는 `student_plan`에만 적용되었으며, `ad_hoc_plans`는 별도 처리 필요 (필요 시)

## 향후 개선 사항

- [ ] `ad_hoc_plans`에도 Optimistic Locking 적용 (필요 시)
- [ ] 다른 플랜 수정 함수들에도 Optimistic Locking 적용
- [ ] 클라이언트에서 버전 불일치 시 자동 새로고침 옵션

## 참고

- Optimistic Locking 패턴: 일반적인 동시성 제어 기법
- student_plan version 필드: `supabase/migrations/20251209212000_add_version_group_id.sql`
- 비즈니스 로직 개선 계획: `.cursor/plans/-14010842.plan.md`
- Phase 2.1 작업: `docs/2026-01-07-phase2-1-plan-generation-concurrency-control.md`

