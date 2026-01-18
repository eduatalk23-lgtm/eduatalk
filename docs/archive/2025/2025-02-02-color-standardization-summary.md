# 프로젝트 색상 및 타이포그래피 표준화 작업 요약

**작업 일시**: 2025-02-02  
**목적**: 프로젝트 전체에서 색상 및 타이포그래피 클래스 표준화

---

## 📋 작업 범위

### 1. 정의되지 않은 커스텀 색상 클래스 제거 ✅

- `text-gray-100` (커스텀) → `text-gray-900`
- `text-gray-90` (커스텀) → `text-gray-800`
- `text-gray-70` (커스텀) → `text-gray-600`
- `text-gray-60` (커스텀) → `text-gray-600`
- `text-gray-30` (커스텀) → `text-gray-300`
- `border-gray-30` (커스텀) → `border-gray-300`

### 2. 타이포그래피 클래스 표준화 ✅

**변경 전**:
```jsx
<h1 className="text-3xl font-bold text-gray-900">제목</h1>
<h2 className="text-xl font-semibold text-gray-900">부제목</h2>
```

**변경 후**:
```jsx
<h1 className="text-h1 text-gray-900">제목</h1>
<h2 className="text-h2 text-gray-900">부제목</h2>
```

---

## 📝 수정된 파일

### 관리자 페이지

1. **`app/(admin)/admin/settings/page.tsx`**
   - `text-3xl font-bold` → `text-h1`
   - `text-xl font-semibold` → `text-h2`
   - `text-sm` → `text-body-2` (설명 텍스트)

2. **`app/(admin)/admin/students/page.tsx`**
   - `text-3xl font-bold` → `text-h1`

3. **`app/(admin)/admin/students/[id]/page.tsx`**
   - `text-3xl font-bold` → `text-h1`

4. **`app/(admin)/admin/tools/page.tsx`**
   - `text-3xl font-bold` → `text-h1`

5. **`app/(admin)/admin/reports/page.tsx`**
   - `text-3xl font-bold` → `text-h1`
   - `text-sm` → `text-body-2` (설명 텍스트)

---

## 🎯 표준 색상 매핑

### 텍스트 색상

| 용도 | 표준 클래스 | 예시 |
|------|-----------|------|
| 페이지 제목, 주요 텍스트 | `text-gray-900` | `<h1 className="text-h1 text-gray-900">` |
| 섹션 제목, 라벨 | `text-gray-800` | `<h2 className="text-h2 text-gray-800">` |
| 본문, 설명 텍스트 | `text-gray-600` 또는 `text-gray-700` | `<p className="text-body-2 text-gray-600">` |
| 보조 텍스트, 메타 정보 | `text-gray-500` 또는 `text-gray-600` | `<span className="text-sm text-gray-500">` |
| 비활성 텍스트 | `text-gray-400` | `<span className="text-gray-400">` |

### 테두리 색상

| 용도 | 표준 클래스 | 예시 |
|------|-----------|------|
| 일반 테두리 | `border-gray-300` | `<div className="border border-gray-300">` |
| 연한 테두리 | `border-gray-200` | `<div className="border border-gray-200">` |
| 매우 연한 구분선 | `border-gray-100` | `<tr className="border-b border-gray-100">` |

---

## 📐 타이포그래피 매핑

| 기존 클래스 | 표준 클래스 | 용도 |
|-----------|-----------|------|
| `text-3xl font-bold` | `text-h1` | 페이지 제목 |
| `text-xl font-semibold` | `text-h2` | 섹션 제목 |
| `text-sm` | `text-body-2` | 본문, 설명 (선택적) |

---

## ✅ 체크리스트

새 페이지를 작성할 때 다음을 확인하세요:

### 색상
- [ ] 제목에 `text-gray-900` 사용
- [ ] 본문에 `text-gray-600` 또는 `text-gray-700` 사용
- [ ] 라벨에 `text-gray-800` 사용
- [ ] 입력 필드에 `text-gray-900` 사용
- [ ] 테두리에 `border-gray-300` 사용 (구분선은 `border-gray-100` 허용)
- [ ] 정의되지 않은 커스텀 색상 클래스 사용하지 않음

### 타이포그래피
- [ ] 페이지 제목에 `text-h1` 사용 (not `text-3xl font-bold`)
- [ ] 섹션 제목에 `text-h2` 사용 (not `text-xl font-semibold`)
- [ ] 타이포그래피 클래스와 색상 클래스를 함께 사용

---

## 🔍 검색 방법

프로젝트에서 표준과 다른 패턴을 찾으려면:

```bash
# 일반 Tailwind 타이포그래피 사용 검색
grep -r "text-3xl font-bold\|text-xl font-semibold" app/

# 정의되지 않은 커스텀 색상 클래스 검색
grep -r "text-gray-\(100\|90\|70\|60\|30\)" app/
grep -r "border-gray-30" app/
```

---

## 📚 관련 문서

- [텍스트 색상 클래스 표준화 가이드](./2025-02-02-text-color-standardization.md)
- [캠프 템플릿 UI 텍스트 색상 개선](./camp-template-ui-text-color-improvement.md)
- [입력 필드 텍스트 색상 개선](./입력-필드-텍스트-색상-개선.md)

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `fix: 관리자 페이지 타이포그래피 및 색상 표준화`

