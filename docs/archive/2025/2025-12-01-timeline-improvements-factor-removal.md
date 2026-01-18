# 타임라인 가시성 개선 및 보정 계수 제거

## 작성 일자
2025-12-01

## 작업 내용

### 1. 블록 세트 타임라인 가시성 개선

#### 시간 그리드 세분화

**개선 사항**:
- 1시간 간격 그리드 라인 추가 (0-24시, 총 25개 구분선)
- 시간 축 라벨을 3시간 간격으로 표시 (0, 3, 6, 9, 12, 15, 18, 21, 24시)
- 12시(정오)는 굵은 선으로 강조
- 3시간 간격은 실선, 나머지는 점선으로 구분

**구현 내용**:
```typescript
// 1시간 간격 그리드 라인
{Array.from({ length: 25 }, (_, i) => (
  <div
    key={`grid-${i}`}
    className={`pointer-events-none absolute left-0 right-0 ${
      i === 12
        ? 'border-t-2 border-gray-400'      // 12시: 굵은 선
        : i % 3 === 0
        ? 'border-t border-gray-300'        // 3시간 간격: 실선
        : 'border-t border-dashed border-gray-200'  // 1시간 간격: 점선
    }`}
    style={{ top: `${(i / 24) * 100}%` }}
  />
))}
```

**높이 증가**:
- 기존: `h-48` (192px)
- 변경: `h-64` (256px)
- 더 넓은 타임라인으로 학습 블록 가시성 향상

**시간 축 개선**:
- 기존: 5개 라벨 (0, 6, 12, 18, 24시)
- 변경: 9개 라벨 (3시간 간격)
- 12시는 볼드 처리로 강조

#### 블록 세트 타임라인 항상 표시

**변경 사항**:
- 블록 세트를 선택하지 않았을 때도 타임라인 영역 표시
- 빈 상태(empty state) UI 개선

**빈 상태 UI**:
```typescript
if (blocks.length === 0) {
  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-3" />
      <p className="text-sm font-medium text-gray-700">
        블록 세트를 선택해주세요
      </p>
      <p className="text-xs text-gray-500 mt-1">
        선택하면 요일별 학습 시간을 확인할 수 있습니다
      </p>
    </div>
  );
}
```

**Step1에서 항상 표시**:
- 기존: `{data.block_set_id && <BlockSetTimeline />}` (조건부 렌더링)
- 변경: `<BlockSetTimeline />` (항상 렌더링)
- 선택 전: 빈 상태 UI 표시
- 선택 후: 타임라인 표시

---

### 2. 추가 기간 보정 계수 UI 제거

#### 제거된 UI 요소

**보정 계수 슬라이더 제거**:
- `<input type="range">` 슬라이더 제거
- 보정 계수 라벨 제거
- onChange 핸들러 제거

**제거된 코드**:
```typescript
// 기존 UI (제거됨)
<label>복습의 복습 보정 계수: {review_of_review_factor}</label>
<input type="range" min="0.1" max="0.5" step="0.05" ... />
<p>원본 학습 소요시간 대비 추가 복습 소요시간 비율입니다.</p>
```

#### 기본값 적용

**자동 설정**:
- `review_of_review_factor` 값은 항상 `0.25`로 설정
- UI에서 조절 불가, 백엔드 로직에서 자동 사용

**안내 문구 추가**:
```typescript
<p className="mt-1 text-xs text-blue-600">
  복습 소요시간은 원본 학습 소요시간의 25%로 자동 계산됩니다.
</p>
```

---

## 수정 파일

### 1. `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`

#### 변경 내용
1. **시간 그리드 추가** (라인 105-120)
   - 1시간 간격 25개 구분선
   - 조건부 스타일링 (12시 강조, 3시간 간격 실선, 나머지 점선)

2. **타임라인 높이 증가** (라인 105)
   - `h-48` → `h-64`

3. **시간 축 라벨 개선** (라인 77-87)
   - 5개 → 9개 (3시간 간격)
   - 12시 볼드 처리

4. **빈 상태 UI 개선** (라인 16-28)
   - Calendar 아이콘 추가
   - 안내 메시지 표시

5. **lucide-react import 추가** (라인 3)
   - `Calendar` 아이콘 사용

### 2. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

#### 변경 내용
1. **타임라인 항상 표시** (라인 2025-2039)
   - 조건부 렌더링 제거
   - 선택 여부와 무관하게 항상 표시

2. **보정 계수 슬라이더 제거** (라인 2802-2844)
   - 슬라이더 UI 완전 제거
   - 설명 문구를 간단한 안내로 대체

---

## UI/UX 개선 효과

### 타임라인 가시성 향상
1. **세밀한 시간 구분**: 1시간 간격 그리드로 정확한 시간대 파악
2. **학습 블록 명확화**: 더 큰 타임라인으로 블록 길이 비교 용이
3. **시각적 계층**: 12시 강조, 3시간 실선, 1시간 점선으로 계층 구분
4. **항상 표시**: 블록 세트 선택 전에도 영역 확인 가능

### UI 단순화
1. **불필요한 조절 제거**: 보정 계수 슬라이더 제거로 혼란 방지
2. **명확한 안내**: 자동 계산 방식을 명시적으로 안내
3. **일관된 경험**: 기본값 사용으로 모든 사용자에게 동일한 계산 적용

---

## 기술적 세부사항

### 시간 그리드 렌더링
```typescript
// 25개 그리드 라인 (0-24시)
Array.from({ length: 25 }, (_, i) => {
  const isNoon = i === 12;              // 정오
  const isThreeHour = i % 3 === 0;      // 3시간 간격
  
  return (
    <div
      className={`absolute left-0 right-0 ${
        isNoon ? 'border-t-2 border-gray-400' :
        isThreeHour ? 'border-t border-gray-300' :
        'border-t border-dashed border-gray-200'
      }`}
      style={{ top: `${(i / 24) * 100}%` }}
    />
  );
})
```

### 보정 계수 기본값
- 추가 기간 활성화 시 자동으로 0.25 설정
- `review_of_review_factor: 0.25` (25%)
- 복습 소요시간 = 원본 학습 소요시간 × 0.25

---

## 검증 사항

### ✅ 완료된 검증
- [x] 타임라인에 1시간 간격 그리드 표시
- [x] 12시 기준선이 굵게 강조됨
- [x] 3시간 간격 라벨 정상 표시
- [x] 타임라인 높이 증가로 가시성 향상
- [x] 블록 세트 선택 전에도 타임라인 영역 표시
- [x] 빈 상태 UI 정상 표시
- [x] 보정 계수 슬라이더 완전 제거
- [x] 자동 계산 안내 문구 표시
- [x] Linting 오류 없음

---

## 비교

### 타임라인 개선 전/후

**개선 전**:
- 5개 시간 라벨 (0, 6, 12, 18, 24시)
- 12시 기준선 1개
- 높이 192px
- 블록 세트 선택 시에만 표시

**개선 후**:
- 9개 시간 라벨 (3시간 간격)
- 25개 그리드 라인 (1시간 간격)
- 높이 256px
- 항상 표시 (빈 상태 포함)

### 보정 계수 개선 전/후

**개선 전**:
- 슬라이더로 0.1-0.5 범위 조절 가능
- 사용자마다 다른 값 설정 가능
- UI 복잡도 증가

**개선 후**:
- 고정값 0.25 사용
- 자동 계산 안내
- UI 단순화

---

## 관련 파일
- `app/(student)/plan/new-group/_components/_shared/BlockSetTimeline.tsx`
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

---

## 향후 개선 사항
- 모바일 반응형 최적화 (타임라인 너비 조정)
- 학습 시간 합계 표시 (요일별)
- 타임라인 확대/축소 기능

