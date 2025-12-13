# 디자인 시스템 색상 매핑 가이드

## 개요

이 문서는 하드코딩된 Tailwind 색상 클래스를 디자인 시스템의 CSS 변수 기반 색상으로 전환하기 위한 매핑 규칙을 정의합니다.

## 색상 시스템 구조

디자인 시스템은 `app/globals.css`에 CSS 변수로 정의되어 있으며, Tailwind의 `@theme` 구성을 통해 클래스로 사용 가능합니다.

### 주요 색상 팔레트

- **Primary (Indigo)**: `primary-50` ~ `primary-900`
- **Secondary (Gray)**: `secondary-50` ~ `secondary-900`
- **Success (Green/Emerald)**: `success-50` ~ `success-900`
- **Warning (Amber/Yellow)**: `warning-50` ~ `warning-900`
- **Error (Red)**: `error-50` ~ `error-900`
- **Info (Blue)**: `info-50` ~ `info-900`
- **Text Colors**: `text-primary`, `text-secondary`, `text-tertiary`, `text-placeholder`, `text-disabled`

## 매핑 규칙

### 텍스트 색상

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `text-gray-900` | `text-text-primary` 또는 `text-[var(--text-primary)]` | 기본 텍스트 (가장 진함) |
| `text-gray-800` | `text-text-primary` | 기본 텍스트 (약간 밝음) |
| `text-gray-700` | `text-text-secondary` 또는 `text-[var(--text-secondary)]` | 보조 텍스트 |
| `text-gray-600` | `text-text-secondary` | 보조 텍스트 (약간 밝음) |
| `text-gray-500` | `text-text-tertiary` 또는 `text-[var(--text-tertiary)]` | 3차 텍스트 |
| `text-gray-400` | `text-text-tertiary` | 3차 텍스트 (약간 밝음) |
| `text-gray-300` | `text-text-placeholder` 또는 `text-[var(--text-placeholder)]` | 플레이스홀더 |

### 배경 색상

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `bg-indigo-600` | `bg-primary-600` | Primary 강조 |
| `bg-indigo-500` | `bg-primary-500` | Primary 중간 |
| `bg-indigo-50` | `bg-primary-50` | Primary 배경 (연함) |
| `bg-blue-600` | `bg-info-600` | Info 강조 |
| `bg-blue-500` | `bg-info-500` | Info 중간 |
| `bg-blue-50` | `bg-info-50` | Info 배경 (연함) |
| `bg-gray-100` | `bg-secondary-100` | Secondary 배경 (연함) |
| `bg-gray-50` | `bg-secondary-50` | Secondary 배경 (매우 연함) |
| `bg-white` | `bg-white` | 흰색 배경 (유지, 다크모드 필요시 `bg-[var(--background)]`) |
| `bg-red-600` | `bg-error-600` | Error 강조 |
| `bg-red-500` | `bg-error-500` | Error 중간 |
| `bg-red-50` | `bg-error-50` | Error 배경 (연함) |
| `bg-green-600` | `bg-success-600` | Success 강조 |
| `bg-green-500` | `bg-success-500` | Success 중간 |
| `bg-green-50` | `bg-success-50` | Success 배경 (연함) |
| `bg-yellow-600` | `bg-warning-600` | Warning 강조 |
| `bg-yellow-500` | `bg-warning-500` | Warning 중간 |
| `bg-yellow-50` | `bg-warning-50` | Warning 배경 (연함) |

### 경계선 색상

| 하드코딩된 클래스 | 디자인 시스템 클래스 | 설명 |
|-----------------|-------------------|------|
| `border-gray-200` | `border-secondary-200` | 기본 경계선 |
| `border-gray-300` | `border-secondary-300` | 진한 경계선 |
| `border-indigo-200` | `border-primary-200` | Primary 경계선 |
| `border-indigo-300` | `border-primary-300` | Primary 경계선 (진함) |
| `border-blue-200` | `border-info-200` | Info 경계선 |
| `border-red-200` | `border-error-200` | Error 경계선 |

### 특수 색상 (도메인별)

#### 등급 색상
등급별 색상은 `lib/constants/colors.ts`의 `getGradeColor()` 함수를 사용합니다.

```typescript
import { getGradeColor } from "@/lib/constants/colors";

const gradeColor = getGradeColor(grade);
// gradeColor.text, gradeColor.bg, gradeColor.border, gradeColor.badge 사용
```

#### 위험도 색상
위험도 색상은 `lib/constants/colors.ts`의 `getRiskColor()` 함수를 사용합니다.

```typescript
import { getRiskColor } from "@/lib/constants/colors";

const riskColor = getRiskColor(riskScore);
// riskColor.text, riskColor.bg, riskColor.border, riskColor.badge 사용
```

## 사용 예시

### Before (하드코딩)
```tsx
<div className="rounded-lg border border-gray-200 bg-white p-6">
  <h2 className="text-xl font-semibold text-gray-900">제목</h2>
  <p className="text-sm text-gray-600">내용</p>
  <button className="bg-indigo-600 text-white hover:bg-indigo-700">
    버튼
  </button>
</div>
```

### After (디자인 시스템)
```tsx
<div className="rounded-lg border border-secondary-200 bg-white p-6">
  <h2 className="text-h2 text-text-primary">제목</h2>
  <p className="text-body-2 text-text-secondary">내용</p>
  <button className="bg-primary-600 text-white hover:bg-primary-700">
    버튼
  </button>
</div>
```

## 주의사항

1. **다크모드 대응**: `bg-white` 등은 다크모드에서 문제가 될 수 있으므로 필요시 `bg-[var(--background)]` 사용
2. **의미적 색상**: 색상의 의미를 고려하여 적절한 팔레트 선택 (Primary, Info, Error, Success, Warning)
3. **일관성**: 동일한 의미의 색상은 항상 동일한 디자인 시스템 클래스 사용

