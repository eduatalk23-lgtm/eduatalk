# Master Book Edit 페이지 텍스트 색상 개선

**작업일**: 2025-02-02  
**작업자**: AI Assistant  
**목적**: 교재 수정 페이지의 회색 텍스트 색상을 검정색으로 변경하여 가독성 개선

---

## 개선 내용

### 문제점
- `/admin/master-books/[id]/edit` 페이지에서 회색 폰트 색상(`text-gray-700`, `text-gray-500`)으로 인해 가독성이 떨어짐
- 입력 필드(input, select, textarea)의 텍스트 색상이 명시되지 않아 브라우저 기본 스타일 적용
- 체크박스 라벨 텍스트에 색상이 지정되지 않음
- placeholder 텍스트 색상이 명시되지 않음
- disabled 상태의 텍스트 색상이 명시되지 않음
- 텍스트 가이드라인에 따라 검정색 계열로 변경 필요

### 변경 사항

#### 1. 페이지 헤더 (`page.tsx`)

**변경 전**:
- 서비스 마스터 텍스트: `text-gray-700`
- 취소 버튼 텍스트: `text-gray-700`

**변경 후**:
- 서비스 마스터 텍스트: `text-gray-900`
- 취소 버튼 텍스트: `text-gray-900`

#### 2. 폼 라벨 및 도움말 텍스트 (`MasterBookEditForm.tsx`)

**변경된 요소들**:
- 모든 폼 라벨 (`text-gray-700` → `text-gray-900`)
  - 교재명, 개정교육과정, 학년/학기, 교과 그룹, 과목, 출판사, 저자
  - 학교 유형, 최소 학년, 최대 학년, 총 페이지, 난이도
  - 대상 시험 유형, 태그, 표지 이미지 URL, 메모

- 도움말 텍스트 (`text-gray-500`, `text-gray-700` → `text-gray-900`)
  - "개정교육과정을 먼저 선택하세요"
  - "개정교육과정과 교과 그룹을 먼저 선택하세요"
  - "해당하는 시험 유형을 모두 선택하세요"
  - "쉼표(,)로 구분하여 여러 태그를 입력할 수 있습니다"
  - "교재 표지 이미지의 URL을 입력하세요"
  - "현재 이미지 미리보기:"

- 취소 버튼 텍스트 (`text-gray-700` → `text-gray-900`)

#### 3. 입력 필드 및 폼 요소 (`MasterBookEditForm.tsx`)

**추가된 스타일**:

1. **모든 input 필드에 텍스트 색상 추가**
   - `text-gray-900`: 입력된 텍스트 색상
   - `placeholder:text-gray-500`: placeholder 텍스트 색상
   - 적용 대상:
     - 교재명
     - 학년/학기
     - 저자
     - 총 페이지
     - 태그
     - 표지 이미지 URL

2. **모든 select 필드에 텍스트 색상 추가**
   - `text-gray-900`: 선택된 옵션 텍스트 색상
   - `disabled:text-gray-600`: disabled 상태 텍스트 색상
   - 적용 대상:
     - 개정교육과정
     - 교과 그룹
     - 과목
     - 출판사
     - 학교 유형
     - 최소 학년
     - 최대 학년
     - 난이도

3. **textarea에 텍스트 색상 추가**
   - `text-gray-900`: 입력된 텍스트 색상
   - `placeholder:text-gray-500`: placeholder 텍스트 색상
   - 적용 대상: 메모

4. **체크박스 라벨에 텍스트 색상 추가**
   - `text-gray-900`: 체크박스 옆 라벨 텍스트 색상
   - 적용 대상:
     - 수능
     - 내신
     - 모의고사
     - 특목고입시

---

## 원인 분석

### 왜 여전히 회색 필드로 보였는가?

1. **브라우저 기본 스타일**
   - HTML input, select, textarea 요소는 브라우저마다 다른 기본 스타일을 가짐
   - 명시적으로 텍스트 색상을 지정하지 않으면 브라우저 기본 색상이 적용됨
   - 일부 브라우저는 입력 필드 텍스트를 회색 계열로 표시할 수 있음

2. **CSS 클래스 누락**
   - 이 페이지에서는 네이티브 HTML 요소를 직접 사용 (공통 컴포넌트 미사용)
   - 공통 컴포넌트(`components/atoms/Input.tsx`, `components/atoms/Select.tsx`)는 텍스트 색상이 명시되어 있으나, 이 페이지에서는 사용하지 않음
   - 각 입력 필드에 개별적으로 텍스트 색상을 지정하지 않아 기본 스타일 적용

3. **상속되지 않는 스타일**
   - body나 부모 요소의 색상이 입력 필드에 자동으로 상속되지 않음
   - 입력 필드는 별도로 색상을 지정해야 함

4. **Disabled 상태 처리**
   - disabled 상태의 입력 필드는 기본적으로 회색으로 표시됨
   - 명시적으로 `disabled:text-gray-600`을 추가하여 가독성 향상

### 해결 방법

1. **명시적 색상 지정**
   - 모든 입력 필드에 `text-gray-900` 클래스 추가
   - placeholder에 `placeholder:text-gray-500` 추가
   - disabled 상태에 `disabled:text-gray-600` 추가

2. **일관성 유지**
   - 모든 입력 필드에 동일한 색상 규칙 적용
   - 체크박스 라벨에도 동일한 색상 적용

---

## 수정된 파일

1. `app/(admin)/admin/master-books/[id]/edit/page.tsx`
   - 페이지 헤더의 서비스 마스터 텍스트 색상 변경
   - 취소 버튼 텍스트 색상 변경

2. `app/(admin)/admin/master-books/[id]/edit/MasterBookEditForm.tsx`
   - 모든 폼 라벨 텍스트 색상 변경 (총 16개)
   - 모든 도움말 텍스트 색상 변경 (총 6개)
   - 모든 input 필드에 텍스트 색상 추가 (6개)
   - 모든 select 필드에 텍스트 색상 추가 (8개)
   - textarea에 텍스트 색상 추가 (1개)
   - 체크박스 라벨 텍스트 색상 추가 (4개)
   - disabled 상태 텍스트 색상 명시
   - 취소 버튼 텍스트 색상 변경

3. `app/(student)/contents/_components/BookDetailsManager.tsx`
   - 대단원명 input 필드에 placeholder 색상 추가
   - 중단원명 input 필드에 텍스트 색상 및 placeholder 색상 추가
   - 페이지 번호 input 필드에 텍스트 색상 및 placeholder 색상 추가
   - 빈 목차 메시지 텍스트 색상 개선 (text-gray-500 → text-gray-900)
   - 빈 중단원 메시지 텍스트 색상 개선 (text-gray-500 → text-gray-900)
   - 중단원 개수 표시 텍스트 색상 개선 (text-gray-500 → text-gray-900)
   - 페이지 번호 표시 텍스트 색상 개선 (text-gray-500 → text-gray-900)

---

## 색상 변경 상세

### 변경된 클래스

| 변경 전 | 변경 후 | 용도 |
|---------|---------|------|
| (색상 없음) | `text-gray-900` | 입력 필드 텍스트 |
| (색상 없음) | `placeholder:text-gray-500` | Placeholder 텍스트 |
| (색상 없음) | `disabled:text-gray-600` | Disabled 상태 텍스트 |
| `text-gray-700` | `text-gray-900` | 라벨, 주요 텍스트 |
| `text-gray-500` | `text-gray-900` | 도움말 텍스트 |
| (색상 없음) | `text-gray-900` | 체크박스 라벨 |
| `text-gray-900` | `text-gray-900` | 제목 (변경 없음) |

### 적용된 Tailwind 색상

- **`text-gray-900`**: 가장 진한 회색 (거의 검정에 가까운 색상)
  - 가독성이 우수하며, 텍스트 가이드라인에 부합
  - 모든 텍스트 요소에 일관되게 적용

---

## 결과

- ✅ 페이지의 모든 텍스트가 검정 계열(`text-gray-900`)로 통일되어 가독성 향상
- ✅ 라벨, 도움말, 버튼 텍스트 모두 일관된 색상으로 개선
- ✅ **입력 필드, 선택 박스, 텍스트 영역의 텍스트 색상 명시적으로 지정**
- ✅ **체크박스 라벨 텍스트 색상 추가**
- ✅ **Placeholder 텍스트 색상 명시**
- ✅ **Disabled 상태 텍스트 색상 명시**
- ✅ **BookDetailsManager 컴포넌트의 모든 입력 필드 및 텍스트 색상 개선**
- ✅ 린터 에러 없음
- ✅ 텍스트 가이드라인 준수

## 전체 점검 결과

### 점검 범위
- 페이지 헤더 및 네비게이션
- 모든 폼 입력 필드 (input, select, textarea)
- 모든 폼 라벨 및 도움말 텍스트
- 체크박스 및 라벨
- 하위 컴포넌트 (BookDetailsManager)
- 버튼 텍스트

### 발견된 문제 및 해결
1. ✅ **입력 필드 텍스트 색상 미지정** → 모든 input, select, textarea에 `text-gray-900` 추가
2. ✅ **Placeholder 색상 미지정** → 모든 placeholder에 `placeholder:text-gray-500` 추가
3. ✅ **Disabled 상태 텍스트 색상 미지정** → `disabled:text-gray-600` 추가
4. ✅ **체크박스 라벨 텍스트 색상 미지정** → `text-gray-900` 추가
5. ✅ **BookDetailsManager 컴포넌트 입력 필드 색상 미지정** → 모든 입력 필드에 색상 추가
6. ✅ **안내 메시지 텍스트 색상 개선** → `text-gray-500` → `text-gray-900`으로 변경

## 추가 개선 사항

### 입력 필드별 변경 상세

1. **Input 필드 (6개)**
   - 교재명, 학년/학기, 저자, 총 페이지, 태그, 표지 이미지 URL
   - 모두 `text-gray-900 placeholder:text-gray-500` 추가

2. **Select 필드 (8개)**
   - 개정교육과정, 교과 그룹, 과목, 출판사, 학교 유형, 최소 학년, 최대 학년, 난이도
   - 모두 `text-gray-900` 추가
   - Disabled 상태인 교과 그룹, 과목에 `disabled:text-gray-600` 추가

3. **Textarea 필드 (1개)**
   - 메모
   - `text-gray-900 placeholder:text-gray-500` 추가

4. **체크박스 라벨 (4개)**
   - 수능, 내신, 모의고사, 특목고입시
   - 모두 `text-gray-900` 추가

### BookDetailsManager 컴포넌트 개선

1. **Input 필드 (3개)**
   - 대단원명: `placeholder:text-gray-500` 추가
   - 중단원명: `text-gray-900 placeholder:text-gray-500` 추가
   - 페이지 번호: `text-gray-900 placeholder:text-gray-500` 추가

2. **안내 메시지 (4개)**
   - 빈 목차 메시지: `text-gray-500` → `text-gray-900`
   - 빈 중단원 메시지: `text-gray-500` → `text-gray-900`
   - 중단원 개수 표시: `text-gray-500` → `text-gray-900`
   - 페이지 번호 표시: `text-gray-500` → `text-gray-900`

---

## 참고사항

- 이번 개선으로 교재 수정 페이지의 **모든 텍스트 요소**가 검정 계열로 통일되었습니다
- 입력 필드, 선택 박스, 체크박스 라벨 등 폼 요소의 텍스트 색상도 모두 명시적으로 지정되었습니다
- 향후 다른 페이지에서도 동일한 텍스트 색상 가이드라인을 적용할 수 있습니다
- 네이티브 HTML 요소를 사용할 때는 반드시 텍스트 색상을 명시적으로 지정해야 합니다
- 공통 컴포넌트(`components/atoms/Input.tsx`, `components/atoms/Select.tsx`)를 사용하면 자동으로 적절한 색상이 적용됩니다
- `text-gray-900`은 Tailwind CSS의 가장 진한 회색으로, 검정에 가까우면서도 약간의 회색 톤을 유지합니다

