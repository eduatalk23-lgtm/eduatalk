# MockTrendChart JSX 주석 파싱 에러 수정

## 작업 일시
2024년 12월

## 문제 상황
빌드 시 JSX 파싱 에러 발생:
```
./app/(student)/scores/analysis/_components/MockTrendChart.tsx:64:43
Parsing ecmascript source code failed
Expected '</', got '}'
```

## 원인
JSX 속성 뒤에 주석을 잘못 배치하여 파서가 코드를 올바르게 파싱하지 못함.

### 문제가 있던 코드
```tsx
stroke="#6b7280" {/* gray-500 */}
backgroundColor: "#fff", {/* white */}
border: "1px solid #e5e7eb", {/* gray-200 */}
```

JSX에서는 속성 값 뒤에 주석을 직접 배치할 수 없습니다.

## 해결 방법
속성 뒤의 인라인 주석을 모두 제거했습니다.

### 수정된 코드
```tsx
stroke="#6b7280"
backgroundColor: "#fff",
border: "1px solid #e5e7eb",
```

## 수정된 파일
- `app/(student)/scores/analysis/_components/MockTrendChart.tsx`

## 변경 사항
- XAxis의 `stroke` 속성 뒤 주석 제거
- YAxis의 `stroke` 속성 뒤 주석 제거
- Tooltip의 `contentStyle` 객체 내부 주석 제거
- Line의 `stroke` 속성 뒤 주석 제거
- Line의 `dot` 속성 뒤 주석 제거
- CartesianGrid의 닫힌 태그 뒤 주석은 유지 (문제 없음)

## 결과
- 빌드 에러 해결
- 린터 에러 없음
- 기능 동작 유지

