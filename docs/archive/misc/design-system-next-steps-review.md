# 디자인 시스템 UI 개선 - 다음 작업 검토

## 📋 검토 일자
2025년 12월 17일

## ✅ 완료된 작업 요약

### Phase 1-4 완료 통계
- **Phase 1 (즉시 개선)**: 3개 파일
- **Phase 2 (단기 개선)**: 3개 파일  
- **Phase 3 (중기 개선)**: 16개 파일
- **Phase 4 (장기 개선)**: 2개 파일
- **총 24개 파일 개선 완료**

## 🔍 남은 작업 검토 결과

### 1. 하드코딩된 색상이 남아있는 파일들

#### 우선순위 높음 (에러/폼 관련 - 5개 파일)

1. **`components/ui/ErrorState.tsx`**
   - 하드코딩: `red-*` 색상 (border, bg, text)
   - 개선 방안: `error-*` 시맨틱 색상으로 교체
   - 영향도: 높음 (에러 상태 표시)

2. **`components/errors/ErrorBoundary.tsx`**
   - 하드코딩: `red-*` 색상 (border, bg, text, button)
   - 개선 방안: `error-*` 시맨틱 색상으로 교체
   - 영향도: 높음 (에러 바운더리)

3. **`components/ui/FormInput.tsx`**
   - 하드코딩: `red-500`, `red-600`, `red-400` (border, text)
   - 개선 방안: `error-*` 시맨틱 색상으로 교체
   - 영향도: 중간 (폼 입력 컴포넌트)

4. **`components/ui/FormMessage.tsx`**
   - 하드코딩: `red-*`, `green-*`, `blue-*` 색상
   - 개선 방안: `error-*`, `success-*`, `info-*` 시맨틱 색상으로 교체
   - 영향도: 중간 (폼 메시지)

5. **`components/molecules/StatCard.tsx`**
   - 하드코딩: 다양한 색상 (blue, purple, emerald, green, red, amber, indigo, teal, cyan, pink, violet)
   - 개선 방안: 디자인 시스템 색상으로 매핑 또는 유지 (의도적인 다채로운 색상)
   - 영향도: 낮음 (통계 카드 - 다양한 색상이 의도적일 수 있음)

#### 우선순위 낮음 (이미 개선했지만 일부 남아있을 수 있는 파일들)

- `components/ui/InstallPrompt.tsx` - 일부 색상 확인 필요
- `components/ui/SchoolSelect.tsx` - 일부 색상 확인 필요
- `components/forms/BaseBookSelector.tsx` - 일부 색상 확인 필요
- `components/ui/SchoolMultiSelect.tsx` - 일부 색상 확인 필요
- `components/ui/Dialog.tsx` - 일부 색상 확인 필요
- `components/ui/LoadingSkeleton.tsx` - 일부 색상 확인 필요
- `components/filters/UnifiedContentFilter.tsx` - 일부 색상 확인 필요
- `components/atoms/ProgressBar.tsx` - 일부 색상 확인 필요

### 2. 타이포그래피 시스템 활용도

#### 현재 상태
- 타이포그래피 시스템이 이미 정의되어 있음 (`app/globals.css`)
- 정의된 클래스:
  - Display: `text-display-1`, `text-display-2`
  - Heading: `text-h1`, `text-h2`
  - Body: `text-body-0`, `text-body-1`, `text-body-2`, `text-body-2-bold`

#### 사용 현황
- 하드코딩된 텍스트 크기: **189개 매치** (38개 파일)
  - `text-sm`, `text-xs`, `text-lg`, `text-xl`, `text-2xl` 등
- 하드코딩된 폰트 굵기: **102개 매치** (32개 파일)
  - `font-medium`, `font-semibold`, `font-bold` 등

#### 개선 방안
- 우선순위: 낮음 (기능적 문제 없음)
- 점진적 마이그레이션 권장
- 예시:
  - `text-sm` → `text-body-2`
  - `text-lg` → `text-body-1`
  - `text-xl` → `text-h2`
  - `text-2xl` → `text-h1`

## 📊 우선순위별 작업 계획

### Phase 5: 남은 하드코딩 색상 개선 (권장)

#### 즉시 개선 (에러/폼 관련 - 5개 파일)
1. `ErrorState.tsx` - 에러 상태 컴포넌트
2. `ErrorBoundary.tsx` - 에러 바운더리
3. `FormInput.tsx` - 폼 입력
4. `FormMessage.tsx` - 폼 메시지
5. `StatCard.tsx` - 통계 카드 (선택적)

**예상 작업량**: 약 30-50개 색상 교체

#### 검증 작업 (이미 개선한 파일들 재확인)
- Phase 1-3에서 개선한 파일들 중 일부 색상이 남아있을 수 있음
- grep 검색으로 확인 후 필요시 추가 개선

### Phase 6: 타이포그래피 시스템 활용 강화 (선택적)

#### 개선 방안
- 하드코딩된 텍스트 스타일을 타이포그래피 시스템으로 교체
- 점진적 마이그레이션 (우선순위 낮음)

**예상 작업량**: 189개 텍스트 크기 + 102개 폰트 굵기

## 🎯 권장 다음 작업

### 즉시 진행 권장
**Phase 5: 남은 하드코딩 색상 개선**
- 에러/폼 관련 컴포넌트 5개 파일 개선
- 시맨틱 색상 적용 (error, success, info)
- 예상 소요 시간: 1-2시간

### 향후 개선 (선택적)
**Phase 6: 타이포그래피 시스템 활용 강화**
- 하드코딩된 텍스트 스타일을 타이포그래피 시스템으로 교체
- 점진적 마이그레이션
- 예상 소요 시간: 3-4시간

## 📝 체크리스트

### Phase 5 준비
- [ ] ErrorState.tsx 색상 개선
- [ ] ErrorBoundary.tsx 색상 개선
- [ ] FormInput.tsx 색상 개선
- [ ] FormMessage.tsx 색상 개선
- [ ] StatCard.tsx 색상 개선 (선택적)
- [ ] 이미 개선한 파일들 재확인

### Phase 6 준비 (선택적)
- [ ] 타이포그래피 시스템 활용 가이드 작성
- [ ] 주요 컴포넌트부터 점진적 마이그레이션
- [ ] ESLint 규칙 추가 검토

## 💡 참고사항

1. **StatCard.tsx의 다채로운 색상**
   - 다양한 색상(blue, purple, emerald 등)이 의도적일 수 있음
   - 디자인 시스템 색상으로 매핑하거나 유지 결정 필요

2. **타이포그래피 마이그레이션**
   - 기능적 문제는 없으므로 우선순위 낮음
   - 점진적 마이그레이션 권장

3. **ESLint 규칙**
   - 이미 하드코딩된 색상 사용 금지 규칙 추가됨
   - 새로운 코드는 자동으로 검증됨

