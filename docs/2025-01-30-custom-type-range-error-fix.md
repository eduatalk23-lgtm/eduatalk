# Custom 타입 콘텐츠 범위 설정 에러 수정

## 작업 일자
2025-01-30

## 문제 상황

마스터 교재/강의 추천 추가 후 범위 편집 시 `custom` 타입 콘텐츠가 API로 전달되어 에러가 발생했습니다.

### 에러 메시지
```
지원하지 않는 콘텐츠 타입입니다. book 또는 lecture를 사용하세요.

at RangeSettingModal.useEffect.fetchDetails (app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx:66:17)
```

### 원인 분석
1. `/api/master-content-details` API는 `book`과 `lecture` 타입만 지원
2. `custom` 타입 콘텐츠는 상세 정보(페이지/회차)가 없어 범위 설정이 불필요
3. UI에서 `custom` 타입 콘텐츠의 범위 편집 버튼 클릭 시 API 호출이 발생
4. 데이터베이스의 `plan_contents` 테이블에 `content_type`이 `custom`인 항목이 존재 가능

## 구현 내용

### Phase 1: 즉시 해결 (UI 레벨 가드)

#### 1.1. StudentContentsPanel 수정
**파일**: `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx`

`handleEditRange` 함수에 `custom` 타입 체크 추가:

```typescript
const handleEditRange = useCallback(
  (content: SelectedContent) => {
    if (!editable) return;

    // custom 타입은 범위 설정을 지원하지 않음
    if (content.content_type === "custom") {
      alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
      return;
    }

    // ... 기존 로직
  },
  [contents, editable]
);
```

**효과**:
- 학생 콘텐츠 패널에서 `custom` 타입 콘텐츠의 범위 편집 시도 시 즉시 차단
- 사용자에게 명확한 안내 메시지 제공

#### 1.2. RecommendedContentsPanel 수정
**파일**: `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`

동일하게 `handleEditRange` 함수에 가드 추가:

```typescript
const handleEditRange = useCallback(
  (content: SelectedContent) => {
    // custom 타입은 범위 설정을 지원하지 않음
    if (content.content_type === "custom") {
      alert("커스텀 콘텐츠는 범위 설정이 필요하지 않습니다.");
      return;
    }

    // ... 기존 로직
    setRangeModalContent({
      id: content.content_id,
      type: content.content_type as "book" | "lecture", // 타입 단언 추가
      // ... 나머지 코드
    });
  },
  [allRecommendedContents]
);
```

**효과**:
- 추천 콘텐츠 패널에서도 동일한 보호 장치 적용
- API 호출 전 타입 단언으로 타입 안전성 확보

### Phase 2: 근본 해결 (데이터 레벨 필터링)

**파일**: `lib/data/planContents.ts`

`classifyPlanContents` 함수에 최종 검증 로직 추가:

```typescript
// 최종 검증: custom 타입이 recommended에 포함되지 않았는지 확인
const invalidRecommended = recommendedContents.filter(
  (c) => c.content_type === "custom"
);

if (invalidRecommended.length > 0) {
  console.warn(
    "[classifyPlanContents] custom 타입 콘텐츠가 추천 콘텐츠로 분류됨:",
    invalidRecommended.map((c) => c.content_id)
  );
  // custom 타입을 studentContents로 이동
  recommendedContents = recommendedContents.filter(
    (c) => c.content_type !== "custom"
  );
  studentContents.push(...invalidRecommended);
}
```

**효과**:
- 데이터 분류 시점에서 `custom` 타입이 추천 콘텐츠로 잘못 분류되는 것을 방지
- 로직 오류로 인한 잘못된 분류 자동 수정
- 개발 환경에서 경고 로그 출력으로 문제 조기 발견

### Phase 3: 타입 안전성 강화

**파일**: `lib/types/content-selection.ts`

`RangeSettingModalProps` 타입 정의 강화:

```typescript
export type RangeSettingModalProps = {
  // ...
  content: {
    id: string;
    type: "book" | "lecture"; // custom 타입 제거
    title: string;
  };
  // ...
};
```

**효과**:
- 컴파일 타임에 `custom` 타입이 `RangeSettingModal`로 전달되는 것을 방지
- TypeScript 타입 체커가 잘못된 사용을 사전에 차단
- IDE에서 자동 완성 및 타입 힌트 개선

## 테스트 결과

### 1. 학생 콘텐츠 패널
- ✅ `custom` 타입 콘텐츠 범위 편집 버튼 클릭 시 알림 표시
- ✅ `book`, `lecture` 타입은 정상 동작

### 2. 추천 콘텐츠 패널
- ✅ 추천 콘텐츠 선택 및 범위 편집 정상 동작
- ✅ `custom` 타입이 추천 콘텐츠로 표시되지 않음

### 3. 편집 모드
- ✅ 기존 플랜 그룹 로드 시 `custom` 타입이 `student_contents`에만 존재
- ✅ 데이터 분류 로직 정상 동작

### 4. 타입 체크
- ✅ TypeScript 컴파일 에러 없음
- ✅ ESLint 검증 통과

## 영향 범위

### 수정된 파일
1. `app/(student)/plan/new-group/_components/_shared/StudentContentsPanel.tsx`
2. `app/(student)/plan/new-group/_components/_shared/RecommendedContentsPanel.tsx`
3. `lib/data/planContents.ts`
4. `lib/types/content-selection.ts`

### 변경 라인 수
- 총 약 35줄 추가/수정

### 호환성
- ✅ 기존 기능에 영향 없음
- ✅ 하위 호환성 유지
- ✅ 데이터 마이그레이션 불필요

## 예방 조치

### 1. UI 레벨
- 모든 범위 편집 진입점에 타입 가드 적용
- 사용자 친화적인 에러 메시지 제공

### 2. 데이터 레벨
- 데이터 분류 시 최종 검증 단계 추가
- 개발 환경에서 경고 로그 출력

### 3. 타입 레벨
- TypeScript 타입 정의 강화
- 컴파일 타임 에러 체크

## 향후 개선 사항

### 선택 사항
1. **범위 편집 버튼 조건부 렌더링**
   - `custom` 타입 콘텐츠는 범위 편집 버튼 자체를 표시하지 않음
   - UI/UX 개선

2. **Custom 콘텐츠 전용 UI**
   - 커스텀 콘텐츠를 위한 별도 편집 인터페이스
   - 범위 대신 메모나 태그 등의 메타데이터 관리

3. **API 레벨 검증**
   - API 엔드포인트에 타입 검증 로직 추가
   - 더 명확한 에러 메시지 반환

## 완료 확인

- [x] Phase 1: UI 레벨 가드 구현
- [x] Phase 2: 데이터 레벨 필터링 구현
- [x] Phase 3: 타입 안전성 강화
- [x] Linter 검증 통과
- [x] 테스트 시나리오 검증
- [x] 문서 작성

## 관련 이슈

- 초기 보고: "마스터 교재/강의 항목에서 추천 추가하고 선택하는데 custom타입 에러가 나온 이유"
- 에러 위치: `RangeSettingModal.tsx:66:17`
- API 엔드포인트: `/api/master-content-details`

## 결론

3단계 방어 전략을 통해 `custom` 타입 콘텐츠의 범위 설정 에러를 완전히 해결했습니다:

1. **UI 레벨**: 사용자 행동 차단 및 안내
2. **데이터 레벨**: 잘못된 분류 자동 수정
3. **타입 레벨**: 컴파일 타임 에러 방지

이제 `custom` 타입 콘텐츠는 범위 설정 API 호출 없이 안전하게 처리되며, 향후 유사한 문제를 사전에 방지할 수 있습니다.

