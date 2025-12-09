# 플랜 상태 정책 문서

## 📋 문서 정보

- **작성일**: 2025-12-09
- **버전**: 1.0
- **관련 문서**:
  - `docs/refactoring/reschedule_feature_todo.md`
  - `lib/utils/planStatusUtils.ts`

---

## 1. 플랜 상태 정의

### 1.1 상태 값

`student_plan` 테이블의 `status` 컬럼은 다음 4가지 값 중 하나를 가집니다:

| 상태 값      | 설명                                    | 한글 라벨 |
| ----------- | --------------------------------------- | --------- |
| `pending`   | 대기 중 (아직 시작하지 않음)            | 대기      |
| `in_progress` | 진행 중 (시작했지만 완료하지 않음)      | 진행중    |
| `completed` | 완료됨 (학습 완료)                      | 완료      |
| `canceled`  | 취소됨                                  | 취소      |

### 1.2 상태 결정 기준

#### 기본 규칙

1. **pending (대기)**
   - `actual_start_time`이 NULL
   - `actual_end_time`이 NULL
   - 새로 생성된 플랜의 기본 상태

2. **in_progress (진행중)**
   - `actual_start_time`이 NOT NULL
   - `actual_end_time`이 NULL
   - 학습을 시작했지만 아직 완료하지 않은 상태

3. **completed (완료)**
   - `actual_end_time`이 NOT NULL
   - 학습이 완료된 상태

4. **canceled (취소)**
   - 명시적으로 취소된 플랜
   - 재조정으로 인해 비활성화된 이전 플랜

---

## 2. 재조정 정책

### 2.1 재조정 대상

**재조정 가능한 플랜**:
- `status IN ('pending', 'in_progress')`
- `is_active = true`

**재조정 불가능한 플랜**:
- `status = 'completed'` (완료된 플랜은 보존)
- `status = 'canceled'` (취소된 플랜)
- `is_active = false` (이미 비활성화된 플랜)

### 2.2 재조정 시 상태 처리

1. **기존 플랜 비활성화**
   - 재조정 대상 플랜: `is_active = false`로 변경
   - 상태는 유지 (완료된 플랜의 경우 `completed` 유지)

2. **새 플랜 생성**
   - 새로 생성된 플랜: `status = 'pending'`, `is_active = true`

3. **완료 플랜 보존**
   - `status = 'completed'`인 플랜은 재조정 대상에서 제외
   - 기존 플랜 그대로 유지

---

## 3. 롤백 정책

### 3.1 롤백 가능 조건

**롤백 가능한 재조정**:
- 재조정 후 생성된 새 플랜 중 `status = 'pending'`인 것만
- 즉, 아직 시작하지 않은 새 플랜만 롤백 가능

**롤백 불가능한 경우**:
- 새 플랜 중 `status = 'in_progress'` 또는 `status = 'completed'`가 있는 경우
- 학생이 실제로 학습을 시작했거나 완료한 경우

### 3.2 롤백 시나리오

1. **롤백 가능한 경우**
   ```
   재조정 실행 → 새 플랜 생성 (status='pending')
   → 학생이 아직 시작하지 않음
   → 롤백 가능 ✅
   ```

2. **롤백 불가능한 경우**
   ```
   재조정 실행 → 새 플랜 생성 (status='pending')
   → 학생이 학습 시작 (status='in_progress')
   → 롤백 불가 ❌ (실제 학습 기록 보존)
   ```

### 3.3 롤백 시간 제한

- **기본 정책**: 재조정 후 24시간 이내에만 롤백 가능
- **추가 조건**: 위의 상태 조건도 만족해야 함

---

## 4. 상태 전이 다이어그램

```
[생성]
  ↓
pending (대기)
  ↓ [학습 시작]
in_progress (진행중)
  ↓ [학습 완료]
completed (완료)

pending (대기)
  ↓ [취소]
canceled (취소)

in_progress (진행중)
  ↓ [취소]
canceled (취소)
```

---

## 5. 구현 참고사항

### 5.1 헬퍼 함수 사용

상태 판단은 `lib/utils/planStatusUtils.ts`의 헬퍼 함수를 사용하세요:

```typescript
import { 
  isReschedulable, 
  isCompletedPlan, 
  isRollbackable 
} from '@/lib/utils/planStatusUtils';

// 재조정 대상 여부
if (isReschedulable(plan)) {
  // 재조정 가능
}

// 완료 플랜 여부
if (isCompletedPlan(plan)) {
  // 재조정 제외
}

// 롤백 가능 여부
if (isRollbackable(plan)) {
  // 롤백 가능
}
```

### 5.2 데이터베이스 쿼리

재조정 대상 플랜 조회:

```sql
SELECT * FROM student_plan
WHERE plan_group_id = $1
  AND status IN ('pending', 'in_progress')
  AND is_active = true;
```

완료 플랜 제외:

```sql
SELECT * FROM student_plan
WHERE plan_group_id = $1
  AND status != 'completed'
  AND is_active = true;
```

---

## 6. 변경 기록

| 날짜       | 버전 | 내용      |
| ---------- | ---- | --------- |
| 2025-12-09 | v1.0 | 초안 작성 |

