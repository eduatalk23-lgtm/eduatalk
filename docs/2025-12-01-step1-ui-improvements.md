# Step1 플랜 목적 UI 개선

## 작성 일자
2025-12-01

## 작업 내용

### 플랜 목적 텍스트 가운데 정렬

Step1 기본 정보 화면에서 플랜 목적 선택 버튼의 텍스트를 가운데 정렬했습니다.

## 수정 내용

### `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

#### 변경 사항
- 플랜 목적 라벨의 flex 클래스에 `justify-center` 추가
- 기존: `flex items-center gap-2`
- 변경: `flex items-center justify-center gap-2`

#### 적용 위치
- 라인 954-985: 플랜 목적 선택 버튼 영역
- 3개의 버튼 (내신대비, 모의고사(수능), 기타)

## 효과
- 버튼 내 텍스트가 가운데 정렬되어 시각적 균형 개선
- UI 일관성 향상

## 관련 파일
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

