# Step1BasicInfo.tsx 오타 수정

## 작업 일시
2024년 11월 23일

## 문제 상황
- **에러 타입**: Runtime ReferenceError
- **에러 메시지**: `ㅑ is not defined`
- **에러 위치**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx:650:7`

## 원인
650번 줄에 불필요한 오타 `ㅑ;`가 남아있어 런타임 에러가 발생했습니다.

## 수정 내용
```diff
        } finally {
          setIsLoadingBlockSets(false);
        }
      })();
-     ㅑ;
    });
```

## 해결 방법
650번 줄의 오타 `ㅑ;`를 제거했습니다.

## 커밋 정보
- **커밋 해시**: feeef15
- **커밋 메시지**: `fix: Step1BasicInfo.tsx 650번 줄 오타 제거 (ㅑ 제거)`

## 참고 사항
- 기존 린터 에러 2개는 별도 이슈로 남아있습니다:
  - Line 1870:52: `review_scope` 프로퍼티 에러
  - Line 1877:27: `review_scope` 프로퍼티 에러

