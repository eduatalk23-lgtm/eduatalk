# 텍스트 색상 클래스 표준화

**작업 일시**: 2025-02-02  
**목적**: 정의되지 않은 커스텀 색상 클래스를 표준 Tailwind 클래스로 통일

---

## 📋 문제점

프로젝트에서 정의되지 않은 커스텀 색상 클래스가 사용되고 있었습니다:

- `text-gray-100` (커스텀) - Tailwind에는 `gray-100`이 있지만 텍스트용으로는 너무 밝음
- `text-gray-90` (커스텀) - Tailwind 표준 클래스 아님
- `text-gray-70` (커스텀) - Tailwind 표준 클래스 아님
- `text-gray-60` (커스텀) - Tailwind 표준 클래스 아님
- `text-gray-30` (커스텀) - Tailwind 표준 클래스 아님
- `border-gray-30` (커스텀) - Tailwind 표준 클래스 아님

이로 인해:
- 스타일이 적용되지 않거나 예상과 다른 색상이 표시됨
- 일관성 없는 색상 사용
- 유지보수 어려움

---

## ✅ 해결 방법

표준 Tailwind 색상 클래스로 통일했습니다.

### 색상 매핑 규칙

| 커스텀 클래스 | 표준 Tailwind 클래스 | 용도 |
|------------|-------------------|------|
| `text-gray-100` | `text-gray-900` | 제목, 주요 텍스트 (가장 진한 색) |
| `text-gray-90` | `text-gray-800` | 부제목, 중요 텍스트 |
| `text-gray-70` | `text-gray-600` 또는 `text-gray-700` | 본문, 설명 텍스트 |
| `text-gray-60` | `text-gray-500` 또는 `text-gray-600` | 보조 텍스트, 메타 정보 |
| `border-gray-30` | `border-gray-300` | 테두리 |

### 표준 Tailwind Gray 색상 스케일

Tailwind의 표준 gray 색상은 다음과 같습니다:

- `gray-50` - 가장 밝음 (배경용)
- `gray-100` - 배경용
- `gray-200` - 배경, 테두리용
- `gray-300` - 테두리용
- `gray-400` - 비활성 텍스트
- `gray-500` - 보조 텍스트
- `gray-600` - 본문 텍스트
- `gray-700` - 본문 텍스트 (더 진함)
- `gray-800` - 제목, 중요 텍스트
- `gray-900` - 가장 진함 (제목, 주요 텍스트)

---

## 📝 수정된 파일

### 1. 스케줄러 설정 페이지

**파일**: 
- `app/(admin)/admin/settings/scheduler/page.tsx`
- `app/(admin)/admin/settings/scheduler/_components/SchedulerSettingsForm.tsx`

**변경 사항**:
- `text-gray-100` → `text-gray-900` (제목, 입력 필드 텍스트)
- `text-gray-70` → `text-gray-600` (설명 텍스트)
- `text-gray-90` → `text-gray-800` (라벨)
- `text-gray-60` → `text-gray-600` (보조 텍스트)
- `border-gray-30` → `border-gray-300` (테두리)

### 2. 기관별 사용자 관리 페이지

**파일**:
- `app/(admin)/admin/tenant/users/page.tsx`
- `app/(admin)/admin/tenant/users/_components/TenantUsersManagement.tsx`

**변경 사항**:
- `text-gray-100` → `text-gray-900` (제목, 통계 숫자, 테이블 텍스트)
- `text-gray-70` → `text-gray-600` (통계 라벨, 설명)
- `text-gray-90` → `text-gray-800` (테이블 헤더)
- `text-gray-60` → `text-gray-600` (보조 텍스트)
- `border-gray-30` → `border-gray-300` (테두리)

---

## 🎯 새 페이지 작성 가이드라인

### 텍스트 색상 사용 규칙

#### 1. 제목 및 주요 텍스트
```jsx
// ✅ 좋은 예
<h1 className="text-h1 text-gray-900">페이지 제목</h1>
<h2 className="text-h2 text-gray-900">섹션 제목</h2>
<div className="text-body-2 text-gray-900">주요 내용</div>

// ❌ 나쁜 예
<h1 className="text-h1 text-gray-100">페이지 제목</h1> // 정의되지 않은 클래스
```

#### 2. 본문 및 설명 텍스트
```jsx
// ✅ 좋은 예
<p className="text-body-2 text-gray-600">설명 텍스트</p>
<p className="text-sm text-gray-600">보조 설명</p>

// ❌ 나쁜 예
<p className="text-body-2 text-gray-70">설명 텍스트</p> // 정의되지 않은 클래스
```

#### 3. 라벨 및 부제목
```jsx
// ✅ 좋은 예
<label className="text-body-2-bold text-gray-800">라벨</label>
<div className="text-body-2 text-gray-800">부제목</div>

// ❌ 나쁜 예
<label className="text-body-2-bold text-gray-90">라벨</label> // 정의되지 않은 클래스
```

#### 4. 보조 텍스트 및 메타 정보
```jsx
// ✅ 좋은 예
<span className="text-sm text-gray-500">날짜</span>
<span className="text-xs text-gray-500">메타 정보</span>

// ❌ 나쁜 예
<span className="text-sm text-gray-60">날짜</span> // 정의되지 않은 클래스
```

#### 5. 테두리
```jsx
// ✅ 좋은 예
<div className="border border-gray-300">내용</div>
<input className="border border-gray-300" />
// 테이블 행 구분선 (매우 연한 구분선)
<tr className="border-b border-gray-100">...</tr>

// ❌ 나쁜 예
<div className="border border-gray-30">내용</div> // 정의되지 않은 클래스
```

**테두리 색상 가이드**:
- `border-gray-300`: 일반 테두리 (기본)
- `border-gray-200`: 연한 테두리
- `border-gray-100`: 매우 연한 구분선 (테이블 행 구분 등)

### 타이포그래피 클래스

프로젝트에서 사용하는 커스텀 타이포그래피 클래스는 `globals.css`에 정의되어 있습니다:

```css
.text-h1        // 40px, font-700
.text-h2        // 32px, font-700
.text-body-0    // 24px
.text-body-1    // 19px
.text-body-2    // 17px
.text-body-2-bold // 17px, font-700
```

이 클래스들은 색상을 포함하지 않으므로, 별도로 색상 클래스를 추가해야 합니다:

```jsx
// ✅ 좋은 예
<h1 className="text-h1 text-gray-900">제목</h1>
<h2 className="text-h2 text-gray-900">부제목</h2>
<p className="text-body-2 text-gray-600">본문</p>

// ❌ 나쁜 예
<h1 className="text-h1">제목</h1> // 색상이 없으면 기본 색상 사용
<h1 className="text-3xl font-bold text-gray-900">제목</h1> // 커스텀 클래스 대신 일반 Tailwind 사용
```

**타이포그래피 매핑 규칙**:
- `text-3xl font-bold` → `text-h1` (페이지 제목)
- `text-xl font-semibold` → `text-h2` (섹션 제목)
- `text-sm` → `text-body-2` (본문, 설명) - 선택적

### 입력 필드

입력 필드는 항상 명시적으로 텍스트 색상을 지정해야 합니다:

```jsx
// ✅ 좋은 예
<input 
  className="border border-gray-300 px-4 py-2 text-body-2 text-gray-900"
  type="text"
/>

// ❌ 나쁜 예
<input 
  className="border border-gray-30 px-4 py-2 text-body-2 text-gray-100"
  type="text"
/>
```

---

## 📊 색상 사용 가이드

### 텍스트 색상 우선순위

1. **`text-gray-900`** - 페이지 제목, 섹션 제목, 주요 내용, 입력 필드 텍스트
2. **`text-gray-800`** - 부제목, 라벨, 중요 정보
3. **`text-gray-700`** - 본문 텍스트 (더 진한 경우)
4. **`text-gray-600`** - 본문 텍스트, 설명, 보조 정보
5. **`text-gray-500`** - 메타 정보, 날짜, 비활성 텍스트
6. **`text-gray-400`** - 비활성 텍스트, placeholder (사용 지양)

### 배경 및 테두리 색상

- **`bg-gray-50`** - 테이블 헤더 배경
- **`bg-gray-100`** - 버튼 배경 (비활성 상태)
- **`border-gray-200`** - 연한 테두리
- **`border-gray-300`** - 일반 테두리 (기본)
- **`border-gray-400`** - 진한 테두리

---

## ✅ 체크리스트

새 페이지를 작성할 때 다음을 확인하세요:

- [ ] 제목에 `text-gray-900` 사용
- [ ] 본문에 `text-gray-600` 또는 `text-gray-700` 사용
- [ ] 라벨에 `text-gray-800` 사용
- [ ] 입력 필드에 `text-gray-900` 사용
- [ ] 테두리에 `border-gray-300` 사용
- [ ] 정의되지 않은 커스텀 색상 클래스 사용하지 않음
- [ ] 타이포그래피 클래스와 색상 클래스를 함께 사용

---

## 🔍 검색 방법

프로젝트에서 정의되지 않은 색상 클래스를 찾으려면:

```bash
# 커스텀 gray 색상 클래스 검색
grep -r "text-gray-\(100\|90\|70\|60\|30\)" app/
grep -r "border-gray-\(100\|90\|70\|60\|30\)" app/
```

---

**완료 일시**: 2025-02-02  
**관련 커밋**: `fix: 텍스트 색상 클래스 표준화 (커스텀 클래스 → 표준 Tailwind 클래스)`

