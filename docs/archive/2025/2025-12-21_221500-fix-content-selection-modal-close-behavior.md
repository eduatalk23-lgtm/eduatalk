# 콘텐츠 선택 모달 닫기 동작 수정

## 문제 상황

ContentSelector에서 콘텐츠를 선택하면 범위 설정 모달이 열리는데, 모달을 저장하지 않고 닫으면 임시로 추가된 콘텐츠가 selectedContents에 남아있어 문제가 발생했습니다.

사용자 시나리오:
1. ContentSelector에서 콘텐츠 선택
2. 범위 설정 모달이 열림
3. 모달을 저장하지 않고 닫음
4. 임시 콘텐츠가 selectedContents에 남아있음

## 원인 분석

`handleContentSelect` 함수에서:
1. 콘텐츠를 선택하면 `tempContent`를 생성하고 즉시 `onUpdate`로 추가 (Optimistic UI)
2. 범위 설정 모달을 염
3. 모달을 저장하면 `handleRangeSave`가 호출되어 최종 콘텐츠로 업데이트
4. **하지만 모달을 닫을 때 임시 콘텐츠를 제거하는 로직이 없었음**

## 수정 내용

### 모달 닫기 핸들러 수정

모달을 닫을 때 임시로 추가한 콘텐츠를 제거하도록 수정:

```typescript
onClose={() => {
  // 모달을 닫을 때 임시로 추가한 콘텐츠 제거
  // (저장하지 않고 닫은 경우)
  if (rangeModalContent) {
    // 임시 콘텐츠만 제거 (isLoadingMetadata가 true인 경우)
    const hasTempContent = selectedContents.some(
      (c) => c.content_id === rangeModalContent.id && c.isLoadingMetadata
    );
    if (hasTempContent) {
      const updated = selectedContents.filter(
        (c) => c.content_id !== rangeModalContent.id
      );
      onUpdate(updated);
    }
  }
  setRangeModalOpen(false);
  setRangeModalContent(null);
}}
```

### 동작 흐름

1. **콘텐츠 선택**
   - `handleContentSelect` 호출
   - `tempContent` 생성 (isLoadingMetadata: true)
   - `onUpdate`로 즉시 추가 (Optimistic UI)
   - 범위 설정 모달 열기

2. **모달에서 저장**
   - `handleRangeSave` 호출
   - 최종 콘텐츠로 업데이트 (isLoadingMetadata: false)
   - 모달 닫기

3. **모달에서 닫기 (저장하지 않음)**
   - `onClose` 호출
   - 임시 콘텐츠 확인 (isLoadingMetadata: true)
   - 임시 콘텐츠 제거
   - 모달 닫기

## 수정된 파일

- `app/(student)/plan/new-group/_components/_features/content-selection/components/StudentContentsPanel.tsx`

## 테스트 방법

1. ContentSelector에서 콘텐츠 선택
2. 범위 설정 모달이 열리는지 확인
3. 모달을 저장하지 않고 닫기
4. 임시 콘텐츠가 selectedContents에서 제거되었는지 확인
5. 모달에서 저장을 눌렀을 때 콘텐츠가 정상적으로 추가되는지 확인

## 관련 이슈

- Optimistic UI 패턴 사용으로 인한 임시 상태 관리 필요
- 모달 취소 시 임시 상태 정리 중요

