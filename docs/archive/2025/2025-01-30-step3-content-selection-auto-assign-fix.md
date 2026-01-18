# Step3ContentSelection 자동 배정 기능 구현

**작업 일시**: 2025-01-30  
**문제**: 리팩토링 이후 실제로 사용되는 컴포넌트가 `Step3ContentSelection`인데, 자동 배정 로직이 TODO로 남아있었음

## 문제 발견

### 실제 사용되는 컴포넌트 확인

`PlanGroupWizard.tsx`를 확인한 결과:
- `currentStep === 4`일 때 `Step3ContentSelection` 컴포넌트를 사용
- 리팩토링된 `Step4RecommendedContents` 컴포넌트는 사용되지 않음
- `Step3ContentSelection`에서 자동 배정 로직이 TODO로 남아있음

```typescript
// 자동 배정
if (
  recommendationSettings.autoAssignContents &&
  filteredRecommendations.length > 0
) {
  // TODO: 자동 배정 로직 구현 (전체 범위)
  // 현재는 수동 선택만 지원
}
```

## 수정 내용

### 1. 자동 배정 로직 구현

`Step4RecommendedContents`의 `autoAssignContents` 함수 로직을 참고하여 `Step3ContentSelection`에 구현:

1. **상세 정보 조회**
   - 각 추천 콘텐츠의 상세 정보 조회 (페이지/회차 정보)
   - `/api/master-content-details` API 사용

2. **총량 조회**
   - 상세 정보가 없을 경우 총 페이지수/회차 조회
   - `/api/master-content-info` API 사용

3. **함수형 업데이트 사용**
   - `onUpdate`에 함수형 업데이트 전달
   - 최신 상태 보장

4. **최대 개수 제한 처리**
   - 현재 콘텐츠 + 추가할 콘텐츠가 9개를 초과하는 경우
   - 최대 9개까지만 추가하고 나머지는 제외

5. **자동 배정 후 목록 업데이트**
   - 자동 배정된 콘텐츠를 추천 목록에서 제거
   - `setRecommendedContents`로 즉시 반영

### 2. 디버깅 로그 추가

- 추천 받기 요청 시작 시점 로그
- 자동 배정 체크 로그
- 자동 배정 시작 로그
- 함수형 업데이트 내부 로그
- 자동 배정 성공/실패 로그
- 목록 업데이트 로그

## 수정된 파일

- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
  - 자동 배정 로직 구현 (약 200줄 추가)
  - 디버깅 로그 추가

## 테스트 시나리오

1. **자동 배정 옵션 선택**
   - 추천 콘텐츠 탭에서 "콘텐츠 자동 배정" 체크박스 선택
   - 교과 선택 및 개수 설정
   - "추천받기" 버튼 클릭

2. **자동 배정 확인**
   - 콘솔에서 자동 배정 과정 확인
   - 추천 콘텐츠가 자동으로 `recommended_contents`에 추가되는지 확인
   - "이미 추가된 추천 콘텐츠 목록"에 표시되는지 확인
   - 추천 목록에서 자동으로 제거되는지 확인

3. **최대 개수 제한 확인**
   - 현재 콘텐츠 + 추천 개수가 9개를 초과하는 경우
   - 최대 9개까지만 추가되고 나머지는 제외되는지 확인
   - 적절한 알림 메시지 표시 확인

## 디버깅 가이드

### 콘솔 로그 확인 포인트

1. **추천 받기 요청 시작**
   ```
   [Step3ContentSelection] 추천 받기 요청 시작:
   ```

2. **자동 배정 체크**
   ```
   [Step3ContentSelection] 자동 배정 체크:
   ```

3. **자동 배정 시작**
   ```
   [Step3ContentSelection] 자동 배정 시작:
   ```

4. **함수형 업데이트 내부**
   ```
   [Step3ContentSelection] 자동 배정 실행 (함수형 업데이트 내부):
   ```

5. **자동 배정 완료**
   ```
   [Step3ContentSelection] 자동 배정 성공:
   [Step3ContentSelection] onUpdate 호출 완료
   [Step3ContentSelection] 자동 배정 후 목록 업데이트:
   ```

## 예상 효과

- ✅ 자동 배정 옵션 선택 시 추천 콘텐츠가 정상적으로 추가됨
- ✅ 상태 업데이트가 즉시 반영됨
- ✅ 중복 제거 로직이 올바르게 동작함
- ✅ 디버깅 로그를 통한 문제 추적 용이

## 관련 파일

- `app/(student)/plan/new-group/_components/Step3ContentSelection.tsx`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts` (참고)

