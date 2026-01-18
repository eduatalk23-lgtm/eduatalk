# 사이드바 레이아웃 개선

**작성 일자**: 2025-12-21  
**목적**: 사이드바의 사용자 정보 및 테넌트 정보 레이아웃 개선 및 역할 정보 표시 개선

---

## 개요

사이드바의 사용자 정보 섹션에서 중복된 roleLabel 표시를 제거하고, 테넌트 정보와 사용자 정보를 세로로 배치하며, 각 div 내부 요소는 가로 배치로 개선했습니다. 또한 역할 정보 표시를 구분자(·)를 사용하여 더 명확하게 표시하도록 개선했습니다.

---

## 주요 변경 사항

### 1. LogoSection 컴포넌트 개선

**파일**: `components/navigation/global/LogoSection.tsx`

**변경 사항**:
- `roleLabel` prop 제거 (중복 제거)
- 로고 영역에서 역할 라벨 표시 제거
- 역할 정보는 `SidebarUserSection`에서만 표시

**이유**:
- LogoSection과 SidebarUserSection에서 roleLabel이 중복 표시됨
- 역할 정보는 사용자 정보 섹션에만 표시하는 것이 더 적절

**변경 전**:
```tsx
<span>TimeLevelUp</span>
<span className="text-body-2 text-muted">{roleLabel}</span>
```

**변경 후**:
```tsx
<span>TimeLevelUp</span>
```

### 2. SidebarUserSection 컴포넌트 개선

**파일**: `components/navigation/global/SidebarUserSection.tsx`

**변경 사항**:

#### 2.1 테넌트 정보와 사용자 정보 세로 배치

- 테넌트 정보와 사용자 정보를 세로로 배치 (사용자 요구사항 반영)
- 각 정보 카드 내부 요소는 가로 배치로 유지
- `gap-2`로 적절한 간격 유지

**변경 전**:
```tsx
<div className="flex gap-2">
  {/* 테넌트 정보 */}
  <div className="flex-1 min-w-0">...</div>
  {/* 사용자 정보 */}
  <div className="flex-1 min-w-0">...</div>
</div>
```

**변경 후**:
```tsx
<div className="flex flex-col gap-2">
  {/* 테넌트 정보 */}
  <div>...</div>
  {/* 사용자 정보 */}
  <div>...</div>
</div>
```

#### 2.2 각 div 내부 요소 가로 배치

**테넌트 정보**:
- 아이콘 + 이름 + 타입을 가로로 배치
- `flex items-center gap-2`로 요소 간 간격 유지

**사용자 정보**:
- 아이콘 + 이름 + 역할을 가로로 배치
- 이름과 역할이 세로가 아닌 가로로 배치되어 공간 효율성 향상

**변경 전**:
```tsx
<div className="flex-1 min-w-0">
  <p>{userName}</p>
  <p>{roleLabel}</p>
</div>
```

**변경 후**:
```tsx
<div className="flex-1 min-w-0 flex items-center gap-2">
  <p>{userName}</p>
  <span>· {roleLabel}</span>
</div>
```

#### 2.3 역할 정보 표시 개선

- 역할 정보 앞에 구분자(·) 추가
- 이름과 역할을 더 명확하게 구분
- `p` 태그 대신 `span` 태그 사용 (인라인 요소로 적절)

**변경 전**:
```tsx
<p>{userName}</p>
<p>{roleLabel}</p>
```

**변경 후**:
```tsx
<p>{userName}</p>
<span>· {roleLabel}</span>
```

---

## UI 개선 효과

### 공간 효율성
- 각 정보 내부 요소를 가로 배치로 공간 효율성 향상
- 테넌트 정보와 사용자 정보는 세로 배치로 명확한 구분

### 가독성
- 중복된 roleLabel 제거로 정보 중복 감소
- 역할 정보에 구분자(·) 추가로 이름과 역할을 명확하게 구분
- 각 정보 카드 내부 요소는 가로 배치로 한눈에 파악 가능

### 일관성
- 각 정보 카드 내부 요소는 가로 배치로 일관된 레이아웃 유지
- 디자인 시스템의 spacing 규칙 준수 (`gap-2`)

---

## 반응형 처리

### 데스크톱
- 테넌트 정보와 사용자 정보를 세로로 배치
- 각 정보 카드 내부 요소는 가로 배치 (아이콘 + 텍스트들)
- 역할 정보에 구분자(·) 추가

### 모바일
- 사용자 정보 내부 요소는 가로 배치 (이름 + 역할)
- 테넌트 정보와 사용자 정보는 세로 배치 유지
- 역할 정보에 구분자(·) 추가

---

## 추가 개선 사항

### 1. 텍스트 truncate 처리
- 긴 텍스트에 대해 `truncate` 클래스 적용
- `min-w-0`으로 flex 아이템의 최소 너비 제한 해제

### 2. 접근성
- 기존 `aria-label` 및 접근성 속성 유지
- 시각적 레이아웃 변경만 수행

### 3. 다크 모드 지원
- 기존 다크 모드 스타일 유지
- 레이아웃 변경으로 인한 다크 모드 영향 없음

---

## 파일 목록

### 수정된 파일
- `components/navigation/global/LogoSection.tsx`
- `components/navigation/global/SidebarUserSection.tsx`

### 영향받는 파일
- `components/layout/RoleBasedLayout.tsx` (LogoSection 사용)
- 모든 layout 파일들 (RoleBasedLayout 사용)

---

## 테스트 체크리스트

- [x] 데스크톱에서 테넌트 정보와 사용자 정보가 세로로 배치되는지 확인
- [x] 각 정보 카드 내부 요소가 가로로 배치되는지 확인
- [x] 역할 정보에 구분자(·)가 표시되는지 확인
- [x] LogoSection에서 roleLabel이 제거되었는지 확인
- [x] 모바일에서도 레이아웃이 정상적으로 표시되는지 확인
- [x] 긴 텍스트에 대해 truncate가 정상 작동하는지 확인
- [x] 다크 모드에서도 정상적으로 표시되는지 확인

---

## 향후 개선 가능 사항

1. **사이드바 접기 상태 처리**
   - 사이드바가 접혔을 때 가로 배치 레이아웃을 어떻게 처리할지 고려 필요
   - 현재는 접기 상태에서도 동일한 레이아웃 유지

2. **애니메이션 추가**
   - 레이아웃 변경 시 부드러운 전환 효과 고려
   - 현재는 즉시 변경

3. **반응형 브레이크포인트 조정**
   - 작은 화면에서 가로 배치가 적절한지 검토
   - 필요시 추가 브레이크포인트 설정

---

**작성자**: AI Assistant  
**검토 상태**: 완료

