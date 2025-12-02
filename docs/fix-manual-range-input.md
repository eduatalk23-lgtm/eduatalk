# 상세 정보 없을 때 직접 범위 입력 기능 추가

## 문제 상황

플랜 생성 시 선택한 콘텐츠의 상세 정보(목차)가 없는 경우, 사용자가 범위를 입력할 수 없어 콘텐츠를 등록할 수 없는 문제가 발생했습니다.

### 요구사항
- 상세 정보(목차)가 없는 콘텐츠도 선택 콘텐츠로 등록 가능
- 교재(book): 페이지 수 직접 입력
- 강의(lecture): 회차 직접 입력

## 수정 내용

### 1. ContentRangeInputProps 타입 확장

직접 입력 관련 props 추가:

```typescript
export type ContentRangeInputProps = {
  // ... 기존 props
  
  // 직접 입력 값 (상세 정보가 없을 때)
  startRange?: string | null;
  endRange?: string | null;
  
  // 총 페이지수/회차 (직접 입력 시 최대값 제한용)
  totalPages?: number | null;
  totalEpisodes?: number | null;
  
  // 직접 입력 변경 핸들러
  onStartRangeChange?: (range: string) => void;
  onEndRangeChange?: (range: string) => void;
};
```

### 2. ContentRangeInput 컴포넌트 수정

상세 정보가 없을 때 직접 입력 UI 추가:

- 안내 메시지 표시
- 시작/끝 범위 숫자 입력 필드
- 총 페이지수/회차 정보 표시 (있는 경우)
- 범위 요약 및 검증
- 시작이 종료보다 큰 경우 에러 표시

### 3. RangeSettingModal 수정

직접 입력 모드 지원:

- 직접 입력 상태 관리 (`startRange`, `endRange`)
- 총 페이지수/회차 조회 (`totalPages`, `totalEpisodes`)
- 상세 정보가 없을 때 `/api/master-content-info` 또는 `/api/student-content-info` 호출
- 저장 시 직접 입력 값 처리
- 범위 검증 (시작 ≤ 종료, 최대값 제한)

### 4. 저장 로직 개선

상세 정보가 있을 때와 없을 때를 구분하여 처리:

```typescript
if (hasDetails) {
  // 상세 정보가 있을 때: detail_id 사용
  onSave({
    start: `p.${pageNumber}`,
    end: `p.${pageNumber}`,
    start_detail_id: startDetailId,
    end_detail_id: endDetailId,
  });
} else {
  // 상세 정보가 없을 때: 직접 입력 값 사용
  onSave({
    start: `p.${startRange}`,
    end: `p.${endRange}`,
    start_detail_id: null,
    end_detail_id: null,
  });
}
```

## 테스트 방법

1. 상세 정보가 없는 교재 선택
   - 범위 설정 모달 열기
   - 직접 입력 UI 표시 확인
   - 시작/끝 페이지 입력
   - 저장 후 콘텐츠 등록 확인

2. 상세 정보가 없는 강의 선택
   - 범위 설정 모달 열기
   - 직접 입력 UI 표시 확인
   - 시작/끝 회차 입력
   - 저장 후 콘텐츠 등록 확인

3. 검증 테스트
   - 시작 > 종료: 에러 메시지 표시
   - 최대값 초과: 에러 메시지 표시
   - 빈 값: 에러 메시지 표시

## 예상 결과

- 상세 정보가 없는 콘텐츠도 선택 콘텐츠로 등록 가능
- 사용자가 직접 범위를 입력할 수 있음
- 적절한 검증 및 에러 메시지 제공
- 총 페이지수/회차 정보가 있으면 최대값 제한 적용

## 관련 파일

- `lib/types/content-selection.ts` - 타입 정의
- `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx` - 직접 입력 UI
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx` - 직접 입력 처리
- `app/api/master-content-info/route.ts` - 총량 조회 API
- `app/api/student-content-info/route.ts` - 총량 조회 API

