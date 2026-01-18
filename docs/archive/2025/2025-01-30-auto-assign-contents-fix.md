# 추천 콘텐츠 자동 등록 기능 개선

## 작업 일시
2025-01-30

## 문제점

**자동 등록 체크를 했지만 선택 콘텐츠로 이동하지 않음**

- 자동 배정 옵션을 체크하고 추천을 받았지만 콘텐츠가 자동으로 추가되지 않음
- 자동 배정된 콘텐츠가 추천 목록에 여전히 남아있음

## 원인 분석

1. **자동 배정 후 목록 업데이트 누락**
   - `autoAssignContents` 함수가 실행된 후 `setRecommendedContents`가 호출되지 않음
   - 자동 배정된 콘텐츠가 추천 목록에서 제거되지 않음
   - `useEffect`가 실행되기 전까지 목록에 남아있음

2. **실행 순서 문제**
   - `setRecommendedContents(filteredRecommendations)`가 자동 배정 전에 호출됨
   - 자동 배정 후 목록이 업데이트되지 않음

3. **디버깅 정보 부족**
   - 자동 배정 과정을 추적할 수 있는 로그가 부족함
   - `onUpdate` 호출 여부를 확인하기 어려움

## 해결 방법

### 1. 자동 배정 후 목록 즉시 업데이트

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
if (autoAssign && filteredRecommendations.length > 0) {
  console.log("[useRecommendations] 자동 배정 시작:", {
    recommendationsCount: filteredRecommendations.length,
    recommendations: filteredRecommendations.map((r) => ({
      id: r.id,
      title: r.title,
      contentType: r.contentType,
    })),
  });
  
  // 자동 배정 실행
  await autoAssignContents(filteredRecommendations);
  
  // 자동 배정 후 추천 목록에서 제거 (자동 배정된 콘텐츠는 목록에 표시하지 않음)
  const autoAssignedIds = new Set(
    filteredRecommendations.map((r) => r.id)
  );
  const remainingRecommendations = filteredRecommendations.filter(
    (r) => !autoAssignedIds.has(r.id)
  );
  
  console.log("[useRecommendations] 자동 배정 후 목록 업데이트:", {
    before: filteredRecommendations.length,
    after: remainingRecommendations.length,
    autoAssigned: autoAssignedIds.size,
  });
  
  setRecommendedContents(remainingRecommendations);
} else {
  // 자동 배정하지 않으면 추천 목록 표시
  setRecommendedContents(filteredRecommendations);
}
```

**효과**:
- 자동 배정 후 즉시 추천 목록에서 제거
- 자동 배정된 콘텐츠가 목록에 표시되지 않음
- `useEffect`가 실행되기 전에도 목록이 정확하게 업데이트됨

### 2. 로깅 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
console.log("[useRecommendations] onUpdate 호출 전:", {
  currentRecommendedContents: data.recommended_contents.length,
  toAdd: trimmed.length,
  newRecommendedContents: newRecommendedContents.length,
});

onUpdate({
  recommended_contents: newRecommendedContents,
});

console.log("[useRecommendations] onUpdate 호출 완료");
```

**효과**:
- `onUpdate` 호출 전후 상태를 로그로 확인 가능
- 자동 배정 과정을 추적할 수 있음
- 디버깅이 용이해짐

### 3. 실행 순서 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

```typescript
// 중복 제거
const filteredRecommendations = filterDuplicateContents(
  recommendations,
  studentMasterIds
);

setHasRequestedRecommendations(true);

// 자동 배정 체크 및 실행
if (autoAssign && filteredRecommendations.length > 0) {
  // 자동 배정 실행 후 목록 업데이트
  await autoAssignContents(filteredRecommendations);
  // ... 목록 업데이트 로직
} else {
  // 자동 배정하지 않으면 추천 목록 표시
  setRecommendedContents(filteredRecommendations);
}
```

**효과**:
- 자동 배정 전에 목록을 설정하지 않음
- 자동 배정 후에만 목록을 업데이트
- 실행 순서가 명확해짐

## 변경된 파일

1. `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`
   - 자동 배정 후 목록 즉시 업데이트
   - 실행 순서 개선
   - 로깅 개선

## 테스트 시나리오

1. **자동 배정 테스트**
   - 자동 배정 옵션 체크
   - 추천 요청
   - 콘텐츠가 자동으로 추가되는지 확인
   - 추가된 콘텐츠가 추천 목록에서 제거되는지 확인

2. **자동 배정 안 함 테스트**
   - 자동 배정 옵션 체크 해제
   - 추천 요청
   - 추천 목록이 표시되는지 확인
   - 수동으로 선택하여 추가 가능한지 확인

3. **콘솔 로그 확인**
   - 자동 배정 과정이 로그로 출력되는지 확인
   - `onUpdate` 호출 전후 상태 확인
   - 목록 업데이트 과정 확인

## 참고사항

- 자동 배정 후 `useEffect`가 실행되어 이중으로 안전하게 처리됨
- 자동 배정된 콘텐츠는 즉시 목록에서 제거되어 사용자 혼란 방지
- 로그를 통해 자동 배정 과정을 추적할 수 있음

