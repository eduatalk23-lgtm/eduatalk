# 관리자 콘텐츠 등록 총 강의시간 검토 및 최적화

**작업 일자**: 2025-01-XX  
**작업자**: AI Assistant  
**관련 이슈**: 관리자 콘텐츠 등록 시 총 강의시간 필드 검증 오류 및 회차 합계 기능 부재

## 문제 분석

### 1. 검증 오류 문제
- `total_duration` 필드가 스키마에서 `optional().nullable()`로 정의되어 있으나, 빈 문자열(`""`)이 스키마 검증을 통과하지 못함
- `formDataToObject` 함수가 빈 문자열을 그대로 유지하여 `z.number().optional().nullable()` 검증 실패
- 데이터베이스 스키마 확인: `master_lectures.total_duration`은 `integer nullable`로 정의됨

### 2. 기능 부재
- 회차별 시간 입력 시 총 강의시간 자동 계산 기능 없음
- 사용자가 수동으로 계산하여 입력해야 하는 불편함

### 3. 코드 중복
- `formDataToObject` 함수가 두 곳에 존재:
  - `lib/validation/schemas.ts` (191-218줄) - 실제 사용 중
  - `lib/utils/formDataHelpers.ts` (270-276줄) - deprecated 표시

## 해결 방안

### Phase 1: formDataToObject 함수 개선

**파일**: `lib/validation/schemas.ts`

**변경 사항**:
1. 숫자 필드의 빈 문자열을 `null`로 변환
2. 숫자 필드 목록을 상수로 정의하여 확장 가능하게 구성

**구현 내용**:
```typescript
const NUMERIC_FIELDS = [
  'total_duration',
  'total_episodes',
  'total_pages',
  'total_page_or_time',
  'grade_min',
  'grade_max',
] as const;

export function formDataToObject(formData: FormData): Record<string, unknown> {
  // 빈 문자열 처리 - 숫자 필드는 null로 변환
  if (stringValue === "") {
    if (NUMERIC_FIELDS.includes(key as typeof NUMERIC_FIELDS[number])) {
      obj[key] = null;
    } else {
      obj[key] = "";
    }
    continue;
  }
  // ... 기존 로직
}
```

### Phase 2: 회차별 시간 합계 자동 계산 기능

**파일**: 
- `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx`
- `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx`

**변경 사항**:
1. `LectureEpisodesManager`의 `onChange` prop을 활용하여 회차별 시간 추적
2. 회차별 시간 합계를 실시간 계산 (`useMemo` 사용)
3. "회차 합계 적용" 버튼 추가 (회차 정보가 있을 때만 표시)
4. 힌트 텍스트로 합계 표시

**구현 내용**:
- `useState`로 회차 정보 상태 관리
- `useMemo`로 합계 계산 최적화
- `useRef`로 input 필드 참조하여 값 적용
- `FormField`의 `hint` prop 활용

### Phase 3: 코드 중복 제거 및 통합

**파일**: 
- `lib/utils/formDataHelpers.ts`
- `lib/utils/index.ts`

**변경 사항**:
1. `formDataHelpers.ts`의 `formDataToObject` 함수 제거 (deprecated 주석으로 대체)
2. `lib/utils/index.ts`에서 export 제거

### Phase 4: 스키마 검증 확인

**파일**: `lib/validation/schemas.ts`

**확인 결과**:
- `masterLectureSchema`의 `total_duration`은 이미 `z.number().int().min(0).optional().nullable()`로 정의됨
- `formDataToObject`에서 빈 문자열을 `null`로 변환하므로 추가 수정 불필요

## 파일 변경 목록

### 수정 파일
1. `lib/validation/schemas.ts` - formDataToObject 함수 개선
2. `app/(admin)/admin/master-lectures/new/MasterLectureForm.tsx` - 회차 합계 기능 추가
3. `app/(admin)/admin/master-lectures/[id]/edit/MasterLectureEditForm.tsx` - 회차 합계 기능 추가
4. `lib/utils/formDataHelpers.ts` - 중복 함수 제거
5. `lib/utils/index.ts` - export 제거

## 테스트 결과

### 검증 테스트
- ✅ 빈 `total_duration` 필드로 저장 시도 → 성공
- ✅ `null` 값으로 저장 시도 → 성공
- ✅ 숫자 값으로 저장 시도 → 성공

### 회차 합계 기능 테스트
- ✅ 회차 추가 시 합계 계산 확인
- ✅ 회차 시간 변경 시 합계 업데이트 확인
- ✅ 회차 삭제 시 합계 업데이트 확인
- ✅ "회차 합계 적용" 버튼 클릭 시 필드에 값 입력 확인

## 사용자 경험 개선

1. **자동 계산**: 회차별 시간을 입력하면 총 강의시간이 자동으로 계산되어 표시됨
2. **원클릭 적용**: "회차 합계 적용" 버튼으로 계산된 값을 한 번에 입력 가능
3. **실시간 피드백**: 힌트 텍스트로 현재 회차 합계를 실시간으로 확인 가능
4. **검증 오류 해결**: 빈 필드 입력 시에도 검증 오류 없이 저장 가능

## 참고 자료

- React Hook Form: `setValueAs` 패턴을 통한 값 변환
- Zod: `z.preprocess`를 통한 전처리
- Supabase: `master_lectures.total_duration`은 `integer nullable`

