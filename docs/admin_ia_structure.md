# TimeLevelUp 관리자(Admin/Consultant) 영역 정보구조(IA) 설계

## 📋 개요

이 문서는 TimeLevelUp 서비스의 관리자(Admin/Consultant) 영역 전체 정보구조(Information Architecture)를 정의합니다.
역할 기반 네비게이션 및 Breadcrumbs 설계를 위한 기반 데이터로 활용됩니다.

**역할 구분**:
- **Admin**: 전체 관리 권한 (학생 관리, 리포트, 설정, 기관 관리 등)
- **Consultant**: 제한된 관리 권한 (학생 관리, 상담 노트, 리포트 조회)
- **Super Admin**: 전체 기관 관리 권한 (멀티 테넌트 관리)

---

## 🏗 전체 IA 구조 (JSON 트리)

```json
{
  "id": "admin",
  "name": "관리자",
  "path": "/admin",
  "roles": ["admin", "consultant"],
  "children": [
    {
      "id": "dashboard",
      "name": "대시보드",
      "path": "/admin/dashboard",
      "description": "전체 학생 현황 및 통계 요약",
      "type": "page",
      "roles": ["admin", "consultant"]
    },
    {
      "id": "students",
      "name": "학생 관리",
      "path": "/admin/students",
      "description": "학생 목록, 상세 정보, 상담 노트 관리",
      "roles": ["admin", "consultant"],
      "children": [
        {
          "id": "students-list",
          "name": "학생 목록",
          "path": "/admin/students",
          "type": "page",
          "params": {
            "search": "string",
            "grade": "string",
            "has_score": "boolean",
            "sort": "name|created_at|grade",
            "page": "number"
          }
        },
        {
          "id": "students-detail",
          "name": "학생 상세",
          "path": "/admin/students/[id]",
          "type": "resource",
          "dynamic": true,
          "params": {
            "tab": "basic|plan|content|score|session|analysis|consulting"
          },
          "children": [
            {
              "id": "students-detail-basic",
              "name": "기본 정보",
              "path": "/admin/students/[id]?tab=basic",
              "type": "section",
              "tab": "basic"
            },
            {
              "id": "students-detail-plan",
              "name": "학습 계획",
              "path": "/admin/students/[id]?tab=plan",
              "type": "section",
              "tab": "plan"
            },
            {
              "id": "students-detail-content",
              "name": "콘텐츠",
              "path": "/admin/students/[id]?tab=content",
              "type": "section",
              "tab": "content"
            },
            {
              "id": "students-detail-score",
              "name": "성적",
              "path": "/admin/students/[id]?tab=score",
              "type": "section",
              "tab": "score"
            },
            {
              "id": "students-detail-session",
              "name": "학습 기록",
              "path": "/admin/students/[id]?tab=session",
              "type": "section",
              "tab": "session"
            },
            {
              "id": "students-detail-analysis",
              "name": "분석 리포트",
              "path": "/admin/students/[id]?tab=analysis",
              "type": "section",
              "tab": "analysis"
            },
            {
              "id": "students-detail-consulting",
              "name": "상담 노트",
              "path": "/admin/students/[id]?tab=consulting",
              "type": "section",
              "tab": "consulting"
            }
          ]
        }
      ]
    },
    {
      "id": "consulting",
      "name": "상담 노트",
      "path": "/admin/consulting",
      "description": "전체 상담 노트 조회 및 관리",
      "type": "page",
      "roles": ["admin", "consultant"],
      "params": {
        "search": "string",
        "student_id": "string"
      }
    },
    {
      "id": "reports",
      "name": "리포트",
      "path": "/admin/reports",
      "description": "학생별 주간/월간 리포트 생성 및 조회",
      "roles": ["admin", "consultant"],
      "params": {
        "period": "weekly|monthly",
        "search": "string"
      },
      "children": [
        {
          "id": "reports-weekly",
          "name": "주간 리포트",
          "path": "/admin/reports?period=weekly",
          "type": "page",
          "period": "weekly"
        },
        {
          "id": "reports-monthly",
          "name": "월간 리포트",
          "path": "/admin/reports?period=monthly",
          "type": "page",
          "period": "monthly"
        },
        {
          "id": "reports-pdf",
          "name": "PDF 리포트",
          "path": "/report/[period]/pdf?studentId=[id]",
          "type": "resource",
          "dynamic": true,
          "params": {
            "studentId": "string",
            "period": "weekly|monthly"
          }
        }
      ]
    },
    {
      "id": "compare",
      "name": "비교 분석",
      "path": "/admin/compare",
      "description": "여러 학생의 학습 성과 비교 분석",
      "type": "page",
      "roles": ["admin", "consultant"]
    },
    {
      "id": "settings",
      "name": "설정",
      "path": "/admin/settings",
      "description": "계정 및 기관 설정",
      "roles": ["admin", "consultant"],
      "children": [
        {
          "id": "settings-main",
          "name": "계정 설정",
          "path": "/admin/settings",
          "type": "page",
          "roles": ["admin", "consultant"]
        },
        {
          "id": "tenant-settings",
          "name": "기관 설정",
          "path": "/admin/tenant/settings",
          "type": "page",
          "roles": ["admin"],
          "description": "테넌트(기관) 정보 및 멤버 관리"
        },
        {
          "id": "admin-account-management",
          "name": "관리자 계정 관리",
          "path": "/admin/settings",
          "type": "section",
          "roles": ["admin"],
          "description": "코치 계정 목록 조회 (현재 설정 페이지 내 섹션)"
        }
      ]
    },
    {
      "id": "tools",
      "name": "도구",
      "path": "/admin/tools",
      "description": "관리자 유틸리티 도구",
      "type": "page",
      "roles": ["admin", "consultant"],
      "children": [
        {
          "id": "tools-bulk-plan",
          "name": "플랜 대량 생성",
          "type": "tool",
          "status": "planned",
          "description": "여러 학생에게 동일한 플랜 일괄 생성"
        },
        {
          "id": "tools-bulk-score",
          "name": "성적 일괄 입력",
          "type": "tool",
          "status": "planned",
          "description": "엑셀 파일 업로드로 여러 학생 성적 일괄 입력"
        },
        {
          "id": "tools-goal-helper",
          "name": "목표 관리 도우미",
          "type": "tool",
          "status": "planned",
          "description": "학생별 목표 효율적 생성 및 관리"
        }
      ]
    },
    {
      "id": "superadmin-tenants",
      "name": "기관 관리",
      "path": "/admin/superadmin/tenants",
      "description": "전체 테넌트(기관) 관리 (Super Admin 전용)",
      "type": "page",
      "roles": ["superadmin"],
      "children": [
        {
          "id": "superadmin-tenants-list",
          "name": "테넌트 목록",
          "path": "/admin/superadmin/tenants",
          "type": "page"
        },
        {
          "id": "superadmin-tenants-detail",
          "name": "테넌트 상세",
          "path": "/admin/superadmin/tenants/[id]",
          "type": "resource",
          "dynamic": true,
          "status": "planned"
        }
      ]
    }
  ]
}
```

---

## 📊 IA 구조표

### Depth 1 (최상위 카테고리)

| ID | 이름 | 경로 | 설명 | 역할 | 아이콘 |
|---|---|---|---|---|---|
| `dashboard` | 대시보드 | `/admin/dashboard` | 전체 학생 현황 및 통계 요약 | admin, consultant | 📊 |
| `students` | 학생 관리 | `/admin/students` | 학생 목록, 상세 정보, 상담 노트 관리 | admin, consultant | 👥 |
| `consulting` | 상담 노트 | `/admin/consulting` | 전체 상담 노트 조회 및 관리 | admin, consultant | 📝 |
| `reports` | 리포트 | `/admin/reports` | 학생별 주간/월간 리포트 생성 및 조회 | admin, consultant | 📄 |
| `compare` | 비교 분석 | `/admin/compare` | 여러 학생의 학습 성과 비교 분석 | admin, consultant | 📈 |
| `settings` | 설정 | `/admin/settings` | 계정 및 기관 설정 | admin, consultant | ⚙️ |
| `tools` | 도구 | `/admin/tools` | 관리자 유틸리티 도구 | admin, consultant | 🛠️ |
| `superadmin-tenants` | 기관 관리 | `/admin/superadmin/tenants` | 전체 테넌트(기관) 관리 | superadmin | 🏛️ |

### Depth 2 (카테고리 하위)

#### 학생 관리 (`students`)

| ID | 이름 | 경로 | 타입 | 설명 | 쿼리 파라미터 |
|---|---|---|---|---|---|
| `students-list` | 학생 목록 | `/admin/students` | page | 학생 목록 및 검색/필터 | `search`, `grade`, `has_score`, `sort`, `page` |
| `students-detail` | 학생 상세 | `/admin/students/[id]` | resource | 학생 상세 정보 및 관리 | `tab` |

#### 리포트 (`reports`)

| ID | 이름 | 경로 | 타입 | 설명 | 기간 |
|---|---|---|---|---|---|
| `reports-weekly` | 주간 리포트 | `/admin/reports?period=weekly` | page | 주간 리포트 목록 | weekly |
| `reports-monthly` | 월간 리포트 | `/admin/reports?period=monthly` | page | 월간 리포트 목록 | monthly |
| `reports-pdf` | PDF 리포트 | `/report/[period]/pdf?studentId=[id]` | resource | PDF 리포트 생성/다운로드 | weekly, monthly |

#### 설정 (`settings`)

| ID | 이름 | 경로 | 타입 | 설명 | 역할 |
|---|---|---|---|---|---|
| `settings-main` | 계정 설정 | `/admin/settings` | page | 현재 계정 정보 및 기본 설정 | admin, consultant |
| `tenant-settings` | 기관 설정 | `/admin/tenant/settings` | page | 테넌트(기관) 정보 및 멤버 관리 | admin |
| `admin-account-management` | 관리자 계정 관리 | `/admin/settings` | section | 코치 계정 목록 조회 | admin |

#### 도구 (`tools`)

| ID | 이름 | 타입 | 상태 | 설명 |
|---|---|---|---|---|
| `tools-bulk-plan` | 플랜 대량 생성 | tool | planned | 여러 학생에게 동일한 플랜 일괄 생성 |
| `tools-bulk-score` | 성적 일괄 입력 | tool | planned | 엑셀 파일 업로드로 여러 학생 성적 일괄 입력 |
| `tools-goal-helper` | 목표 관리 도우미 | tool | planned | 학생별 목표 효율적 생성 및 관리 |

#### 기관 관리 (`superadmin-tenants`)

| ID | 이름 | 경로 | 타입 | 설명 | 상태 |
|---|---|---|---|---|---|
| `superadmin-tenants-list` | 테넌트 목록 | `/admin/superadmin/tenants` | page | 전체 테넌트(기관) 목록 조회 | active |
| `superadmin-tenants-detail` | 테넌트 상세 | `/admin/superadmin/tenants/[id]` | resource | 개별 테넌트 상세 정보 | planned |

### Depth 3 (상세/리소스/액션)

#### 학생 상세 - 탭 구조 (`students-detail`)

| ID | 이름 | 경로 | 타입 | 탭 키 | 설명 |
|---|---|---|---|---|---|
| `students-detail-basic` | 기본 정보 | `/admin/students/[id]?tab=basic` | section | basic | 학생 기본 정보 (이름, 학년, 반, 생년월일) |
| `students-detail-plan` | 학습 계획 | `/admin/students/[id]?tab=plan` | section | plan | 학생의 학습 플랜 목록 및 진행 현황 |
| `students-detail-content` | 콘텐츠 | `/admin/students/[id]?tab=content` | section | content | 학생이 등록한 콘텐츠 목록 (책/강의/커스텀) |
| `students-detail-score` | 성적 | `/admin/students/[id]?tab=score` | section | score | 내신/모의고사 성적 추이 및 통계 |
| `students-detail-session` | 학습 기록 | `/admin/students/[id]?tab=session` | section | session | 학습 세션 기록 및 학습 시간 통계 |
| `students-detail-analysis` | 분석 리포트 | `/admin/students/[id]?tab=analysis` | section | analysis | Risk Index, 취약 과목 분석, 추천 사항 |
| `students-detail-consulting` | 상담 노트 | `/admin/students/[id]?tab=consulting` | section | consulting | 학생 상담 노트 작성 및 조회 |

---

## 🔗 경로 패턴 설명

### 정적 경로 (Static Routes)

```
/admin/dashboard
/admin/students
/admin/consulting
/admin/reports
/admin/compare
/admin/settings
/admin/tools
/admin/tenant/settings
/admin/superadmin/tenants
```

### 동적 경로 (Dynamic Routes)

```
/admin/students/[id]
/report/[period]/pdf
/admin/superadmin/tenants/[id] (planned)
```

### 쿼리 파라미터 (Query Parameters)

#### 학생 목록 (`/admin/students`)
```
?search=검색어
&grade=학년
&has_score=true
&sort=name|created_at|grade
&page=페이지번호
```

#### 학생 상세 (`/admin/students/[id]`)
```
?tab=basic|plan|content|score|session|analysis|consulting
```

#### 리포트 (`/admin/reports`)
```
?period=weekly|monthly
&search=검색어
```

#### 상담 노트 (`/admin/consulting`)
```
?search=검색어
&student_id=학생ID
```

#### PDF 리포트 (`/report/[period]/pdf`)
```
?studentId=학생ID
&period=weekly|monthly
```

---

## 📱 네비게이션 계층 구조

### 메인 네비게이션 (Depth 1)

#### 관리 카테고리
```
👥 관리
  ├─ 📊 대시보드
  ├─ 👥 학생 관리
  └─ 📝 상담 노트
```

#### 리포트 카테고리
```
📄 리포트
  ├─ 📄 리포트
  └─ 📈 비교 분석
```

#### 설정 카테고리
```
⚙️ 설정
  ├─ ⚙️ 설정
  ├─ 🛠️ 도구
  ├─ 🏢 기관 설정
  └─ 🏛️ 기관 관리 (Super Admin)
```

### 서브 네비게이션 예시

#### 학생 관리 서브메뉴
```
👥 학생 관리
  ├─ 학생 목록
  └─ 학생 상세
      ├─ 기본 정보
      ├─ 학습 계획
      ├─ 콘텐츠
      ├─ 성적
      ├─ 학습 기록
      ├─ 분석 리포트
      └─ 상담 노트
```

#### 리포트 서브메뉴
```
📄 리포트
  ├─ 주간 리포트
  ├─ 월간 리포트
  └─ PDF 리포트
```

---

## 🍞 Breadcrumbs 구조 예시

### 예시 1: 학생 상세 (기본 정보 탭)
```
홈 > 학생 관리 > 학생 목록 > [학생 이름] > 기본 정보
```

### 예시 2: 학생 상세 (상담 노트 탭)
```
홈 > 학생 관리 > 학생 목록 > [학생 이름] > 상담 노트
```

### 예시 3: 리포트 (주간)
```
홈 > 리포트 > 주간 리포트 > [학생 이름]
```

### 예시 4: 기관 설정
```
홈 > 설정 > 기관 설정
```

### 예시 5: 비교 분석
```
홈 > 리포트 > 비교 분석
```

### 예시 6: 상담 노트 목록
```
홈 > 상담 노트
```

---

## 🔐 역할별 접근 권한

### Admin (관리자)

**접근 가능한 모든 기능**:
- ✅ 대시보드
- ✅ 학생 관리 (목록, 상세, 모든 탭)
- ✅ 상담 노트 (전체 조회)
- ✅ 리포트 (주간/월간)
- ✅ 비교 분석
- ✅ 설정 (계정 설정, 기관 설정, 관리자 계정 관리)
- ✅ 도구
- ✅ 기관 관리 (Super Admin인 경우만)

### Consultant (상담사)

**접근 가능한 기능**:
- ✅ 대시보드
- ✅ 학생 관리 (목록, 상세, 모든 탭)
- ✅ 상담 노트 (본인이 작성한 노트만 조회 가능)
- ✅ 리포트 (주간/월간 조회)
- ✅ 비교 분석
- ✅ 설정 (계정 설정만)

**접근 불가능한 기능**:
- ❌ 기관 설정
- ❌ 관리자 계정 관리
- ❌ 도구
- ❌ 기관 관리

### Super Admin

**추가 접근 가능한 기능**:
- ✅ 기관 관리 (테넌트 목록 및 관리)

---

## 📝 노트 및 고려사항

### 1. 동적 라우트 처리

- Next.js 15 App Router 기준으로 설계
- 동적 세그먼트는 `[param]` 형식 사용
- 쿼리 파라미터는 필터링, 탭 전환, 검색에 활용

### 2. 리소스 타입 구분

- **page**: 일반 페이지 (목록, 대시보드 등)
- **resource**: 리소스 상세 페이지 (개별 항목 조회)
- **section**: 페이지 내 섹션 (탭 기반 콘텐츠)
- **tool**: 도구/유틸리티 기능

### 3. 탭 기반 네비게이션

- 학생 상세 페이지는 `tab` 쿼리 파라미터로 탭 전환
- 기본 탭은 `basic`
- 각 탭은 독립적인 섹션 컴포넌트로 구성

### 4. 역할 기반 접근 제어

- 모든 관리자 영역 페이지는 `/app/(admin)` 그룹 내에 위치
- `AdminLayout`에서 역할 기반 접근 제어 수행
- `admin` 또는 `consultant` 역할이 아닌 경우 `/login`으로 리다이렉트
- `Super Admin`은 별도 권한 체크 필요

### 5. 성적 관리 기능 위치

**현재 구현**:
- 학생 상세 > 성적 탭: 성적 조회 및 추이 확인
- 대시보드: 성적 입력 학생 통계
- 학생 목록: 성적 입력 여부 필터링

**향후 계획**:
- 도구 > 성적 일괄 입력: 엑셀 파일 업로드로 일괄 입력
- 별도 성적 관리 페이지 (현재 미구현, 학생 상세 탭으로 통합)

### 6. 콘텐츠 관리 기능 위치

**현재 구현**:
- 학생 상세 > 콘텐츠 탭: 학생이 등록한 콘텐츠 조회
- 관리자 직접 콘텐츠 관리 페이지는 미구현 (학생 영역의 `/contents` 활용)

**향후 계획**:
- 관리자 콘텐츠 관리 페이지 추가 고려 (전체 학생 공통 콘텐츠 관리)

### 7. 자동 스케줄 관리

**현재 구현**:
- 학생 영역의 `/scheduler` 활용
- 관리자 영역에서는 학생 상세 > 학습 계획 탭에서 조회만 가능

**향후 계획**:
- 관리자 대시보드에서 자동 스케줄 생성 도구 추가 고려

### 8. 확장 고려사항

- 향후 추가될 기능은 기존 Depth 구조에 맞춰 확장 가능
- 새로운 도메인 추가 시 Depth 1에 추가, 이후 Depth 2, 3 순차 확장
- 역할 기반 접근 제어는 각 노드의 `roles` 필드로 관리

---

## 🎯 활용 방안

이 IA 구조는 다음 용도로 활용됩니다:

1. **역할 기반 네비게이션 컴포넌트 설계**
2. **Breadcrumbs 컴포넌트 자동 생성**
3. **사이트맵 생성**
4. **SEO 메타데이터 구조화**
5. **사용자 플로우 분석 및 최적화**
6. **접근 권한 관리 및 검증**

---

## 📊 기능 매핑 체크리스트

### 요구사항 대응 확인

| 요구사항 | 구현 상태 | 경로/위치 |
|---|---|---|
| 학생 관리 (목록) | ✅ 구현됨 | `/admin/students` |
| 학생 관리 (상세) | ✅ 구현됨 | `/admin/students/[id]` |
| 학생 관리 (상담) | ✅ 구현됨 | `/admin/consulting`, `/admin/students/[id]?tab=consulting` |
| 학생 관리 (노트) | ✅ 구현됨 | 학생 상세 > 상담 노트 탭 |
| 성적 관리·입력 | ⚠️ 부분 구현 | 학생 상세 > 성적 탭 (조회), 일괄 입력은 계획 중 |
| 분석 리포트 | ✅ 구현됨 | `/admin/reports`, 학생 상세 > 분석 리포트 탭 |
| 자동 스케줄 관리 | ⚠️ 부분 구현 | 학생 영역 활용, 관리자 대시보드 통합 계획 중 |
| 콘텐츠 관리 | ⚠️ 부분 구현 | 학생 상세 > 콘텐츠 탭 (조회), 직접 관리 페이지는 미구현 |
| 대시보드 | ✅ 구현됨 | `/admin/dashboard` |
| 테넌트 설정 | ✅ 구현됨 | `/admin/tenant/settings` |
| 관리자 계정 관리 | ✅ 구현됨 | `/admin/settings` (섹션) |

---

**작성일**: 2025-01-13  
**버전**: 1.0  
**담당자**: TimeLevelUp 개발팀

