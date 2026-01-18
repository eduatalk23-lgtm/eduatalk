# 상세 페이지 빈 값 표시 및 코드 최적화 작업

## 작업 일자
2025년 12월 15일

## 작업 목적
`ContentDetailTable` 컴포넌트가 값이 없을 때 `null`을 반환하여 항목을 완전히 숨기는 문제를 해결하고, 빈 값은 플레이스홀더(`"-"`)로 표시하도록 변경했습니다.

## 주요 변경 사항

### 1. 유틸리티 함수 생성

#### `lib/utils/formatValue.ts` (신규)
- `formatValue()`: 빈 값 체크 및 플레이스홀더 반환
- `isEmptyValue()`: 빈 값 여부 체크

#### `lib/utils/urlHelpers.ts` (신규)
- `isValidUrl()`: URL 형식 검증 함수

### 2. ContentDetailTable 컴포넌트 수정

**파일**: `app/(student)/contents/_components/ContentDetailTable.tsx`

#### 변경 전
- 빈 값일 때 `return null`로 항목을 완전히 숨김

#### 변경 후
- 빈 값은 `"-"` 플레이스홀더로 표시
- 빈 값 스타일: `text-gray-400` (일반 값: `text-gray-900`)
- URL 필드는 값이 있을 때만 링크로 표시
- 접근성 개선: `aria-label` 추가

## 구현 세부사항

### 빈 값 처리 로직
```typescript
const isEmpty = isEmptyValue(value);
const displayValue = formatValue(value);
```

### URL 처리 로직
```typescript
const isUrlValue = !isEmpty && (isUrl || isValidUrl(value as string));
```

### 접근성
- 빈 값: `aria-label="${label}: 정보 없음"`
- URL 링크: `aria-label="${label} 링크 열기"`

## 기존 패턴과의 일관성

다음 컴포넌트들에서도 `"-"`를 플레이스홀더로 사용하는 패턴이 확인되었습니다:
- `MockDetailAnalysis.tsx`: `"-"` 사용
- `MockScoreCard.tsx`: `"-"` 사용
- `EditableField.tsx`: `"—"` (em dash) 사용 (별도 유지)

## 테스트 체크리스트

- [x] 값이 있는 경우 정상 표시 확인
- [x] 값이 null인 경우 "-" 표시 확인
- [x] 값이 undefined인 경우 "-" 표시 확인
- [x] 값이 빈 문자열인 경우 "-" 표시 확인
- [x] URL 필드가 값이 있을 때 링크로 표시되는지 확인
- [x] URL 필드가 빈 값일 때 "-"로 표시되는지 확인
- [x] 스크린 리더 접근성 테스트
- [x] 모든 마스터 콘텐츠 상세 페이지에서 동작 확인

## 파일 변경 목록

1. `lib/utils/formatValue.ts` - 신규 생성
2. `lib/utils/urlHelpers.ts` - 신규 생성
3. `app/(student)/contents/_components/ContentDetailTable.tsx` - 빈 값 표시 로직 수정

## 참고사항

### 2025년 React 모범 사례
- 조건부 렌더링: `null` 반환은 완전히 숨기는 경우에만 사용
- 사용자 경험: 빈 값도 표시하여 정보 구조를 명확히 유지
- 접근성: `aria-label`로 스크린 리더 지원

### 향후 개선 가능성
- 다른 컴포넌트(`MockDetailAnalysis`, `MockScoreCard`)에서도 유틸리티 함수 활용 검토 (선택사항)

