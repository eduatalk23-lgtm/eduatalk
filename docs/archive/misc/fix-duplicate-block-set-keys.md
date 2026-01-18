# 블록 세트 중복 키 에러 수정

## 문제 상황

React에서 중복된 키 에러가 발생했습니다:
```
Encountered two children with the same key, `5550d0a8-9bca-4487-a509-a31a75bb260a`
```

에러 위치: `app/(student)/plan/new-group/_components/Step1BasicInfo/BlockSetSection.tsx:187`

## 원인 분석

1. `blockSets` 배열에 동일한 ID를 가진 항목이 여러 개 포함되어 있었습니다.
2. `map` 함수에서 `set.id`만을 키로 사용하여 중복 키가 발생했습니다.

## 해결 방법

### 1. 중복 제거 로직 추가

`useMemo`를 사용하여 ID 기준으로 중복된 블록 세트를 제거:

```typescript
// 중복된 ID를 가진 블록 세트 제거 (첫 번째 항목만 유지)
const uniqueBlockSets = useMemo(() => {
  const seen = new Set<string>();
  return blockSets.filter((set) => {
    if (seen.has(set.id)) {
      return false;
    }
    seen.add(set.id);
    return true;
  });
}, [blockSets]);
```

### 2. 고유 키 생성

인덱스와 ID를 조합하여 고유한 키 생성:

```typescript
// 변경 전
key={set.id}

// 변경 후
key={`${set.id}-${startIndex + index}`}
```

### 3. 모든 참조 업데이트

`blockSets` 대신 `uniqueBlockSets`를 사용하도록 모든 참조를 변경:
- 선택된 블록 세트 찾기
- 페이징 처리
- 블록 세트 수정 시 이름 확인

## 수정된 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo/BlockSetSection.tsx`

## 변경 사항

1. `useMemo` import 추가
2. `uniqueBlockSets` 메모이제이션 추가
3. 모든 `blockSets` 참조를 `uniqueBlockSets`로 변경
4. 키 생성 로직에 인덱스 추가

## 테스트

- [ ] 블록 세트 목록이 정상적으로 표시되는지 확인
- [ ] 중복 키 에러가 발생하지 않는지 확인
- [ ] 페이징이 정상적으로 작동하는지 확인
- [ ] 블록 세트 선택/수정 기능이 정상적으로 작동하는지 확인

## 참고

이 수정은 데이터 소스에서 중복이 발생하는 경우를 방어적으로 처리하는 방법입니다. 근본 원인(데이터베이스에 중복 레코드가 있는지)을 확인하는 것도 권장됩니다.

