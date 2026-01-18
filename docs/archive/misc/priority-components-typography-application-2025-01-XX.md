# 우선순위 높은 컴포넌트 타이포그래피 시스템 적용

**작업 일시**: 2025-01-XX  
**목적**: 자주 사용되는 주요 컴포넌트에 타이포그래피 시스템 적용

---

## 📋 작업 개요

우선순위가 높은 6개 컴포넌트에 타이포그래피 시스템을 적용하여 일관된 텍스트 스타일을 확보했습니다.

---

## ✅ 개선된 컴포넌트

### 1. InstallPrompt 컴포넌트

#### 변경 사항

**Before**:
```tsx
<h3 className="text-sm font-semibold text-[var(--text-primary)]">
  앱 설치하기
</h3>
<p className="text-xs text-[var(--text-secondary)]">
  홈 화면에 추가하여...
</p>
<p className="font-medium">설치 방법:</p>
```

**After**:
```tsx
<h3 className="text-body-2-bold text-text-primary">
  앱 설치하기
</h3>
<p className="text-body-2 text-text-secondary">
  홈 화면에 추가하여...
</p>
<p className="text-body-2-bold">설치 방법:</p>
```

**변경 내용**:
- 제목: `text-sm font-semibold` → `text-body-2-bold` (17px, font-700)
- 설명: `text-xs` → `text-body-2` (17px)
- 설치 방법 제목: `font-medium` → `text-body-2-bold`
- 버튼 텍스트: `text-sm` → `text-body-2`

---

### 2. StatCard 컴포넌트

#### 변경 사항

**Before**:
```tsx
<div className={cn("text-sm", colors.label)}>{label}</div>
<div className={cn("text-2xl font-bold", colors.value)}>{value}</div>
```

**After**:
```tsx
<div className={cn("text-body-2", colors.label)}>{label}</div>
<div className={cn("text-h1", colors.value)}>{value}</div>
```

**변경 내용**:
- 라벨: `text-sm` → `text-body-2` (17px)
- 값: `text-2xl font-bold` → `text-h1` (40px, font-700)

**이유**:
- 통계 값은 시각적으로 강조되어야 하므로 큰 크기인 `text-h1` 사용
- 타이포그래피 시스템에 이미 font-weight가 포함되어 `font-bold` 제거

---

### 3. TimeRangeInput 컴포넌트

#### 변경 사항

**Before**:
```tsx
<label className="text-xs font-medium text-[var(--text-primary)]">
  {label}
</label>
<p className="text-xs text-[var(--text-secondary)]">{description}</p>
<input className="... text-sm ..." />
<div className="text-xs text-[var(--text-primary)]">기본값: ...</div>
<button className="text-xs ...">기본값으로 되돌리기</button>
```

**After**:
```tsx
<label className="text-body-2 text-text-primary">
  {label}
</label>
<p className="text-body-2 text-text-secondary">{description}</p>
<input className="... text-body-2 ..." />
<div className="text-body-2 text-text-primary">기본값: ...</div>
<button className="text-body-2 ...">기본값으로 되돌리기</button>
```

**변경 내용**:
- 라벨: `text-xs font-medium` → `text-body-2`
- 설명: `text-xs` → `text-body-2`
- 입력 필드: `text-sm` → `text-body-2`
- 기본값 텍스트: `text-xs` → `text-body-2`
- 버튼 텍스트: `text-xs` → `text-body-2`

---

### 4. StickySaveButton 컴포넌트

#### 변경 사항

**Before**:
```tsx
<p className="text-sm text-[var(--text-tertiary)]">
  변경사항이 있습니다...
</p>
<button className="... text-sm font-medium ...">
  {cancelLabel}
</button>
<button className="... text-sm font-medium ...">
  {isSaving ? "저장 중..." : submitLabel}
</button>
```

**After**:
```tsx
<p className="text-body-2 text-text-tertiary">
  변경사항이 있습니다...
</p>
<button className="... text-body-2 font-medium ...">
  {cancelLabel}
</button>
<button className="... text-body-2 font-medium ...">
  {isSaving ? "저장 중..." : submitLabel}
</button>
```

**변경 내용**:
- 메시지: `text-sm` → `text-body-2` (17px)
- 버튼 텍스트: `text-sm` → `text-body-2` (17px)

---

### 5. SchoolSelect 컴포넌트

#### 변경 사항

**Before**:
```tsx
<input className="... text-sm ..." />
<span className="text-sm text-gray-500">검색 중...</span>
<div className="font-medium text-[var(--text-primary)]">{school.name}</div>
<div className="text-xs text-[var(--text-tertiary)]">{school.region}</div>
<span className="text-xs font-medium text-indigo-600">{school.type}</span>
<div className="text-sm text-[var(--text-tertiary)]">검색 결과가 없습니다.</div>
```

**After**:
```tsx
<input className="... text-body-2 ..." />
<span className="text-body-2 text-text-tertiary">검색 중...</span>
<div className="text-body-2-bold text-text-primary">{school.name}</div>
<div className="text-body-2 text-text-tertiary">{school.region}</div>
<span className="text-body-2 font-medium text-indigo-600">{school.type}</span>
<div className="text-body-2 text-text-tertiary">검색 결과가 없습니다.</div>
```

**변경 내용**:
- 검색 입력: `text-sm` → `text-body-2`
- 검색 중 메시지: `text-sm` → `text-body-2`
- 학교명: `font-medium` → `text-body-2-bold`
- 지역: `text-xs` → `text-body-2`
- 타입: `text-xs` → `text-body-2`
- 빈 상태 메시지: `text-sm` → `text-body-2`

---

### 6. SchoolMultiSelect 컴포넌트

#### 변경 사항

**Before**:
```tsx
<div className="... text-sm ...">{school.name}</div>
<div className="text-xs font-bold">{rank}</div>
<input className="... text-sm ..." />
<span className="text-sm text-[var(--text-tertiary)]">검색 중...</span>
<div className="font-medium text-[var(--text-primary)]">{school.name}</div>
<span className="text-xs text-[var(--text-tertiary)]">{school.region}</span>
<span className="text-xs text-blue-600 font-medium">캠퍼스</span>
<span className="text-xs font-medium text-indigo-600">{school.type}</span>
```

**After**:
```tsx
<div className="... text-body-2 ...">{school.name}</div>
<div className="text-body-2 font-bold">{rank}</div>
<input className="... text-body-2 ..." />
<span className="text-body-2 text-text-tertiary">검색 중...</span>
<div className="text-body-2-bold text-text-primary">{school.name}</div>
<span className="text-body-2 text-text-tertiary">{school.region}</span>
<span className="text-body-2 font-medium text-blue-600">캠퍼스</span>
<span className="text-body-2 font-medium text-indigo-600">{school.type}</span>
```

**변경 내용**:
- 학교명: `text-sm` → `text-body-2`, `font-medium` → `text-body-2-bold`
- 순위 배지: `text-xs` → `text-body-2`
- 검색 입력: `text-sm` → `text-body-2`
- 검색 중 메시지: `text-sm` → `text-body-2`
- 지역: `text-xs` → `text-body-2`
- 캠퍼스: `text-xs` → `text-body-2`
- 타입: `text-xs` → `text-body-2`

---

## 📊 적용 결과

### Before
- ❌ 타이포그래피 시스템 미사용
- ❌ 일관성 없는 텍스트 크기 (`text-xs`, `text-sm`, `text-2xl` 혼용)
- ❌ 불필요한 `font-semibold`, `font-bold` 사용

### After
- ✅ 타이포그래피 시스템 적용
- ✅ 일관된 텍스트 크기 (`text-body-2`, `text-body-2-bold`, `text-h1`)
- ✅ 디자인 시스템 준수

---

## 🎯 타이포그래피 매핑 요약

| 컴포넌트 | 요소 | Before | After | 크기 |
|---------|------|--------|-------|------|
| InstallPrompt | 제목 | `text-sm` | `text-body-2-bold` | 17px |
| InstallPrompt | 설명 | `text-xs` | `text-body-2` | 17px |
| StatCard | 라벨 | `text-sm` | `text-body-2` | 17px |
| StatCard | 값 | `text-2xl` | `text-h1` | 40px |
| TimeRangeInput | 라벨/설명 | `text-xs` | `text-body-2` | 17px |
| TimeRangeInput | 입력 필드 | `text-sm` | `text-body-2` | 17px |
| StickySaveButton | 메시지/버튼 | `text-sm` | `text-body-2` | 17px |
| SchoolSelect | 모든 텍스트 | `text-xs/sm` | `text-body-2` | 17px |
| SchoolMultiSelect | 모든 텍스트 | `text-xs/sm` | `text-body-2` | 17px |

---

## 📝 참고 사항

### 타이포그래피 시스템 클래스
- `text-body-2`: 17px (기본 본문)
- `text-body-2-bold`: 17px, font-700 (강조 본문)
- `text-h1`: 40px, font-700 (큰 제목/통계 값)

### Font Weight
타이포그래피 시스템은 이미 적절한 font-weight를 포함하고 있으므로:
- `font-semibold` 제거 (타이포그래피 시스템에 포함)
- `font-bold` 제거 (타이포그래피 시스템에 포함)
- 단, 특수한 경우(순위 배지 등)는 `font-bold` 유지 가능

---

## ✅ 체크리스트

- [x] InstallPrompt 타이포그래피 적용
- [x] StatCard 타이포그래피 적용
- [x] TimeRangeInput 타이포그래피 적용
- [x] StickySaveButton 타이포그래피 적용
- [x] SchoolSelect 타이포그래피 적용
- [x] SchoolMultiSelect 타이포그래피 적용
- [x] 불필요한 font-weight 클래스 제거
- [x] Lint 에러 확인

---

**작업 완료 일시**: 2025-01-XX

