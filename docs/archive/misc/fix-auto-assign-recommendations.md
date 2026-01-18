# 추천 콘텐츠 자동 배정 수정

## 문제 상황

"추천 콘텐츠 자동 배정(전체 범위)" 옵션을 선택하고 추천을 받아도 자동으로 추가되지 않는 문제가 발생했습니다.

### 증상
- 자동 배정 옵션을 체크하고 추천 요청
- 추천 콘텐츠는 받아지지만 `recommended_contents`에 자동으로 추가되지 않음

## 원인 분석

1. **상세 정보가 없을 때 총량 미조회**
   - 상세 정보가 없을 때 기본값(1~100)만 사용
   - 실제 총 페이지수/회차를 조회하지 않아 전체 범위로 설정되지 않음

2. **디버깅 정보 부족**
   - 자동 배정이 실행되는지 확인하기 어려움
   - 어느 단계에서 실패하는지 파악하기 어려움

## 수정 내용

### 1. 상세 정보가 없을 때 총량 조회 추가

상세 정보가 없을 때 `/api/master-content-info`를 호출하여 총량을 조회하고 전체 범위로 설정:

```typescript
// 상세 정보가 없을 때 총량 조회 (전체 범위 설정)
if (startRange === 1 && endRange === 100) {
  try {
    const infoResponse = await fetch(
      `/api/master-content-info?content_type=${r.contentType}&content_id=${r.id}`
    );

    if (infoResponse.ok) {
      const infoResult = await infoResponse.json();
      if (infoResult.success && infoResult.data) {
        if (r.contentType === "book" && infoResult.data.total_pages) {
          endRange = infoResult.data.total_pages;
        } else if (r.contentType === "lecture" && infoResult.data.total_episodes) {
          endRange = infoResult.data.total_episodes;
        }
      }
    }
  } catch (infoError) {
    // 총량 조회 실패는 무시 (기본값 100 사용)
  }
}
```

### 2. 디버깅 로그 추가

자동 배정 실행 과정을 추적할 수 있도록 상세한 로그 추가:

- 자동 배정 체크 로그
- 자동 배정 시작 로그
- 자동 배정 실행 로그 (추가할 콘텐츠 정보)
- 자동 배정 성공/실패 로그

## 테스트 방법

1. Step4RecommendedContents에서 "콘텐츠 자동 배정" 옵션 체크
2. 교과 선택 및 개수 설정
3. 추천 요청
4. 콘솔에서 자동 배정 로그 확인
5. 추천 콘텐츠가 자동으로 `recommended_contents`에 추가되는지 확인
6. "이미 추가된 추천 콘텐츠 목록"에 표시되는지 확인

## 예상 결과

- 자동 배정 옵션을 선택하면 추천 받은 콘텐츠가 자동으로 추가됨
- 상세 정보가 있을 때: 첫 페이지/회차 ~ 마지막 페이지/회차
- 상세 정보가 없을 때: 1 ~ 총 페이지수/회차 (총량 조회 성공 시)
- 최대 9개 제한 확인 및 처리
- 디버깅을 위한 상세한 로그 제공

## 관련 파일

- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

