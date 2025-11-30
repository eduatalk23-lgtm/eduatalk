# Step1BasicInfo blockSets undefined 에러 수정

## 문제 상황

`PlanGroupDetailView`에서 `Step1BasicInfo`를 사용할 때 `blockSets is not defined` 에러가 발생했습니다.

### 에러 위치
- 파일: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- 라인: 1979
- 에러: `Cannot read properties of undefined (reading 'find')`

### 원인
- `PlanGroupDetailView`에서 `Step1BasicInfo`를 호출할 때 `blockSets` prop을 전달하지 않았음
- `Step1BasicInfo`는 `blockSets` prop이 필수인데, 읽기 전용 모드에서도 필요함

## 수정 내용

### 1. PlanGroupDetailPage에서 blockSets 조회 추가
- `fetchBlockSetsWithBlocks`를 사용하여 학생의 블록 세트 목록 조회
- 조회한 블록 세트를 `PlanGroupDetailView`에 전달

```typescript
// 블록 세트 목록 조회 (시간 블록 정보 포함)
const { fetchBlockSetsWithBlocks } = await import("@/lib/data/blockSets");
const blockSets = await fetchBlockSetsWithBlocks(user.id);
```

### 2. PlanGroupDetailView props에 blockSets 추가
- `PlanGroupDetailViewProps` 타입에 `blockSets` prop 추가 (옵셔널)
- 기본값을 빈 배열(`[]`)로 설정

```typescript
type PlanGroupDetailViewProps = {
  // ... 기존 props
  blockSets?: Array<{
    id: string;
    name: string;
    blocks?: Array<{
      id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
    }>;
  }>;
};
```

### 3. Step1BasicInfo에 blockSets 전달
- `PlanGroupDetailView`에서 `Step1BasicInfo`를 호출할 때 `blockSets` prop 전달
- 두 곳에서 호출 (case 1, default)

### 4. Step1BasicInfo에서 blockSets 안전 처리
- `blockSets.find()` 호출 전에 `blockSets`가 존재하는지 확인
- 옵셔널 체이닝(`?.`) 사용하여 안전하게 처리

수정된 위치:
- `useEffect` 내부: `blockSets && blockSets.length > 0` 체크
- `handleStartEdit`: `blockSets` 존재 여부 확인
- 블록 세트 이름 비교: `blockSets?.find()`
- 블록 목록 표시: `blockSets?.find()`
- 선택된 블록 세트 정보 표시: `blockSets && blockSets.find()`

## 수정된 파일

- `app/(student)/plan/group/[id]/page.tsx`
- `app/(student)/plan/group/[id]/_components/PlanGroupDetailView.tsx`
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

## 테스트

- [x] 린터 에러 확인 완료
- [x] blockSets prop 전달 확인
- [x] blockSets undefined 안전 처리 확인

## 참고

- `blockSets`는 읽기 전용 모드에서도 블록 세트 정보를 표시하기 위해 필요
- 옵셔널 prop으로 설정하여 기존 코드와의 호환성 유지
- 기본값을 빈 배열로 설정하여 안전하게 처리

