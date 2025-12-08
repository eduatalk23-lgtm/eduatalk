# 학생 상세 정보 탭 렌더링 문제 수정

## 작업 일시
2025-01-07

## 문제 상황
관리자 페이지의 학생 상세 정보 페이지(`/admin/students/[id]`)에서 기본정보 탭의 내용이 표시되지 않는 문제가 발생했습니다.

## 원인 분석

### 기술적 원인
1. **서버/클라이언트 컴포넌트 간 상호작용 문제**
   - `StudentDetailTabs`는 클라이언트 컴포넌트 (`"use client"`)
   - `TabContent`는 서버 컴포넌트 (기본값)
   - 클라이언트 컴포넌트에서 `React.Children.map`을 사용하여 서버 컴포넌트의 `props`를 읽을 때 제대로 작동하지 않음

2. **Props 접근 문제**
   - `StudentDetailTabs`에서 `child.props.tab`을 읽어서 `activeTab`과 비교하는 로직
   - 서버 컴포넌트의 props는 클라이언트 컴포넌트에서 직접 접근하기 어려움
   - 모든 탭(기본정보, 학습계획, 콘텐츠, 성적, 학습기록, 분석 리포트, 상담노트)에서 동일한 문제 발생 가능

## 해결 방법

### TabContent를 클라이언트 컴포넌트로 변경

`TabContent` 컴포넌트에 `"use client"` 디렉티브를 추가하여 클라이언트 컴포넌트로 변경했습니다.

**변경 전:**
```tsx
import { ReactNode } from "react";

export function TabContent({ tab, children }: { ... }) {
  return <div>{children}</div>;
}
```

**변경 후:**
```tsx
"use client";

import { ReactNode } from "react";

export function TabContent({ tab, children }: { ... }) {
  return <div>{children}</div>;
}
```

### 이유
- 클라이언트 컴포넌트끼리는 props 접근이 정상적으로 작동
- `StudentDetailTabs`가 `React.Children.map`으로 `TabContent`의 `tab` prop을 제대로 읽을 수 있음
- 모든 탭에서 동일한 문제가 해결됨

## 수정된 파일

1. `app/(admin)/admin/students/[id]/_components/TabContent.tsx`
   - `"use client"` 디렉티브 추가

## 영향 범위

이 변경으로 다음 모든 탭이 정상적으로 작동합니다:
- ✅ 기본정보 탭 (`basic`)
- ✅ 학습계획 탭 (`plan`)
- ✅ 콘텐츠 탭 (`content`)
- ✅ 성적 탭 (`score`)
- ✅ 학습기록 탭 (`session`)
- ✅ 분석 리포트 탭 (`analysis`)
- ✅ 상담노트 탭 (`consulting`)

## 검증 방법

1. 학생 상세 페이지에 접근
2. 각 탭을 클릭하여 콘텐츠가 정상적으로 표시되는지 확인
3. URL 파라미터(`?tab=basic` 등)로 직접 탭 전환 시에도 정상 작동 확인

## 참고 사항

### 다른 탭 패턴들
코드베이스에는 다른 탭 구현 패턴도 존재합니다:
- `ContentMetadataTabs`: 조건부 렌더링 방식 (if 문으로 직접 렌더링)
- `BookDetailTabs`: 다른 패턴 사용

각 패턴은 사용 목적에 맞게 선택하되, children을 받아서 필터링하는 방식일 때는 모든 관련 컴포넌트가 클라이언트 컴포넌트여야 합니다.

