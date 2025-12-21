# invalidRecommended 변수 에러 수정

## 작업 일시
2025-12-22 06:19:36

## 문제 상황

터미널 로그에서 다음과 같은 에러가 발생했습니다:

```
⨯ ReferenceError: invalidRecommended is not defined
    at classifyPlanContents (lib/data/planContents.ts:1206:32)
```

`lib/data/planContents.ts` 파일의 1206번째 줄에서 정의되지 않은 `invalidRecommended` 변수를 참조하고 있었습니다.

## 원인 분석

디버깅 로그에서 `invalidRecommended.length`를 사용하고 있었지만, 해당 변수가 함수 내 어디에서도 정의되지 않았습니다. 이는 이전 코드에서 사용되던 변수가 제거되었지만 디버깅 로그에만 남아있던 것으로 보입니다.

## 수정 내용

### 파일: `lib/data/planContents.ts`

**수정 전:**
```typescript
console.log("[classifyPlanContents] 최종 결과:", {
  studentContentsCount: studentContents.length,
  recommendedContentsCount: recommendedContents.length,
  missingContentsCount: missingContents.length,
  totalInputCount: contents.length,
  invalidRecommendedMoved: invalidRecommended.length, // ❌ 정의되지 않은 변수
});
```

**수정 후:**
```typescript
console.log("[classifyPlanContents] 최종 결과:", {
  studentContentsCount: studentContents.length,
  recommendedContentsCount: recommendedContents.length,
  missingContentsCount: missingContents.length,
  totalInputCount: contents.length,
  // invalidRecommendedMoved 제거
});
```

## 영향 범위

- `classifyPlanContents` 함수의 디버깅 로그에서만 사용되던 변수였으므로, 실제 기능에는 영향이 없습니다.
- 에러가 발생하던 다음 페이지들이 정상 작동하게 됩니다:
  - `/camp/[invitationId]/submitted` (학생 제출 상세 페이지)
  - `/admin/camp-templates/[id]/participants/[groupId]/continue` (관리자 캠프 계속하기 페이지)

## 테스트

- 린터 에러 확인: ✅ 통과
- 타입 체크: ✅ 통과

## 관련 파일

- `lib/data/planContents.ts` (1200-1208줄 수정)

