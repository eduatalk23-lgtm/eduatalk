# 개발 서버 포트 정리

## 📋 개요

TimeLevelUp 프로젝트에서 사용하는 모든 개발 서버 포트를 정리한 문서입니다.

---

## 🚀 메인 애플리케이션 서버

### Next.js 개발 서버

| 서비스 | 포트 | 기본값 | 설정 위치 | 설명 |
|--------|------|--------|-----------|------|
| **Next.js Dev Server** | `3000` | ✅ | `package.json` → `"dev": "next dev"` | 메인 프론트엔드 개발 서버 |

**실행 방법:**
```bash
npm run dev
# 또는
pnpm dev
```

**접속 URL:**
- http://localhost:3000

**포트 변경 방법:**
```bash
# 환경 변수로 포트 변경
PORT=3001 npm run dev

# 또는 package.json 스크립트 수정
"dev": "next dev -p 3001"
```

---

## 🗄 Supabase 로컬 개발 서버

### Supabase 서비스 포트

| 서비스 | 포트 | 기본값 | 설정 위치 | 설명 |
|--------|------|--------|-----------|------|
| **Supabase API** | `54321` | ✅ | `supabase/config.toml` → `[api].port` | Supabase REST API 엔드포인트 |
| **PostgreSQL Database** | `54322` | ✅ | `supabase/config.toml` → `[db].port` | 로컬 PostgreSQL 데이터베이스 |
| **Shadow Database** | `54320` | ✅ | `supabase/config.toml` → `[db].shadow_port` | 마이그레이션 검증용 Shadow DB |
| **Supabase Studio** | `54323` | ✅ | `supabase/config.toml` → `[studio].port` | Supabase 관리 대시보드 |
| **Inbucket (Email)** | `54324` | ✅ | `supabase/config.toml` → `[inbucket].port` | 이메일 테스트 서버 (웹 UI) |
| **SMTP (Email)** | `54325` | ❌ (주석) | `supabase/config.toml` → `[inbucket].smtp_port` | SMTP 서버 (비활성화) |
| **POP3 (Email)** | `54326` | ❌ (주석) | `supabase/config.toml` → `[inbucket].pop3_port` | POP3 서버 (비활성화) |
| **Analytics** | `54327` | ✅ | `supabase/config.toml` → `[analytics].port` | Supabase Analytics 서비스 |
| **Connection Pooler** | `54329` | ✅ | `supabase/config.toml` → `[db.pooler].port` | 연결 풀러 (비활성화) |
| **Edge Runtime Inspector** | `8083` | ✅ | `supabase/config.toml` → `[edge_runtime].inspector_port` | Edge Functions 디버깅 포트 |

**실행 방법:**
```bash
# Supabase 로컬 서버 시작
supabase start

# 서버 상태 확인
supabase status
```

**접속 URL:**
- **API**: http://localhost:54321
- **Studio**: http://localhost:54323
- **Inbucket**: http://localhost:54324
- **Database**: `postgresql://postgres:postgres@localhost:54322/postgres`

**포트 변경 방법:**
`supabase/config.toml` 파일에서 각 서비스의 `port` 값을 수정합니다.

---

## 🐍 Python ML API 서버

### FastAPI 서버

| 서비스 | 포트 | 기본값 | 설정 위치 | 설명 |
|--------|------|--------|-----------|------|
| **Python ML API** | `8000` | ✅ | `python/Dockerfile` → `EXPOSE 8000` | FastAPI 기반 ML 예측/추천 API |

**실행 방법:**
```bash
# 로컬 개발 환경
cd python
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Docker로 실행
docker build -f python/Dockerfile -t timelevelup-ml-api python/
docker run -p 8000:8000 timelevelup-ml-api
```

**접속 URL:**
- **API**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs

**포트 변경 방법:**
```bash
# uvicorn 실행 시 포트 지정
uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8001

# Dockerfile 수정
EXPOSE 8001
CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

**CORS 설정:**
`python/src/api/main.py`에서 Next.js 개발 서버(`http://localhost:3000`)를 허용하도록 설정되어 있습니다.

---

## 🔧 외부 도구 (Serena)

### Serena MCP 서버

| 서비스 | 포트 | 기본값 | 설정 위치 | 설명 |
|--------|------|--------|-----------|------|
| **Serena MCP Server** | `9121` | ✅ | `serena/compose.yaml` → `SERENA_PORT` | MCP 프로토콜 서버 |
| **Serena Dashboard** | `24282` | ✅ | `serena/compose.yaml` → `SERENA_DASHBOARD_PORT` | 웹 대시보드 (0x5EDA) |

**실행 방법:**
```bash
# Docker Compose로 실행
cd serena
docker-compose up serena

# 커스텀 포트로 실행
SERENA_PORT=9122 SERENA_DASHBOARD_PORT=8080 docker-compose up serena
```

**접속 URL:**
- **Dashboard**: http://localhost:24282/dashboard

**포트 변경 방법:**
환경 변수로 설정:
```bash
export SERENA_PORT=9122
export SERENA_DASHBOARD_PORT=8080
```

---

## 📊 포트 사용 현황 요약

### 활성 포트 (기본 사용)

| 포트 | 서비스 | 프로토콜 | 필수 여부 |
|------|--------|----------|-----------|
| `3000` | Next.js Dev Server | HTTP | ✅ 필수 |
| `54320` | Supabase Shadow DB | PostgreSQL | ✅ 필수 (마이그레이션 시) |
| `54321` | Supabase API | HTTP | ✅ 필수 |
| `54322` | Supabase Database | PostgreSQL | ✅ 필수 |
| `54323` | Supabase Studio | HTTP | ⚠️ 선택 (관리용) |
| `54324` | Inbucket (Email) | HTTP | ⚠️ 선택 (이메일 테스트용) |
| `54327` | Supabase Analytics | HTTP | ⚠️ 선택 |
| `8000` | Python ML API | HTTP | ⚠️ 선택 (ML 기능 사용 시) |
| `8083` | Edge Runtime Inspector | WebSocket | ⚠️ 선택 (디버깅용) |

### 비활성 포트 (설정 주석 처리됨)

| 포트 | 서비스 | 상태 |
|------|--------|------|
| `54325` | SMTP | ❌ 비활성화 |
| `54326` | POP3 | ❌ 비활성화 |
| `54329` | Connection Pooler | ❌ 비활성화 |

### 외부 도구 포트

| 포트 | 서비스 | 필수 여부 |
|------|--------|-----------|
| `9121` | Serena MCP Server | ❌ 선택 (외부 도구) |
| `24282` | Serena Dashboard | ❌ 선택 (외부 도구) |

---

## 🔍 포트 충돌 확인 및 해결

### 포트 사용 확인 방법

**macOS/Linux:**
```bash
# 특정 포트 확인
lsof -i :3000
lsof -i :54321

# 모든 포트 확인
lsof -i -P -n | grep LISTEN
```

**Windows:**
```powershell
# 특정 포트 확인
netstat -ano | findstr :3000
netstat -ano | findstr :54321

# 모든 포트 확인
netstat -ano | findstr LISTENING
```

### 포트 충돌 해결

1. **포트 변경**: 위의 "포트 변경 방법" 섹션 참조
2. **프로세스 종료**: 사용 중인 프로세스 종료
   ```bash
   # macOS/Linux
   kill -9 $(lsof -t -i:3000)
   
   # Windows
   taskkill /PID <PID> /F
   ```

---

## 📝 환경 변수 설정

### Next.js 포트 설정

`.env.local` 파일에 추가:
```env
PORT=3000
# 또는
NEXT_PUBLIC_PORT=3000
```

### Supabase 포트 설정

`supabase/config.toml` 파일에서 직접 수정:
```toml
[api]
port = 54321  # 원하는 포트로 변경

[db]
port = 54322  # 원하는 포트로 변경
```

### Python ML API 포트 설정

환경 변수 또는 Dockerfile에서 설정:
```bash
# 환경 변수
export PORT=8000

# 또는 Dockerfile
ENV PORT=8000
EXPOSE $PORT
```

---

## 🚨 주의사항

1. **포트 충돌**: 여러 프로젝트를 동시에 실행할 때 포트 충돌 주의
2. **방화벽 설정**: 로컬 개발 환경에서 포트가 차단되지 않았는지 확인
3. **환경 변수**: 프로덕션 환경에서는 환경 변수로 포트를 관리하는 것이 좋습니다
4. **Supabase Shadow DB**: 마이그레이션 실행 시에만 사용되므로 일반적으로는 비활성 상태입니다

---

## 📚 참고 문서

- [Next.js 포트 설정](https://nextjs.org/docs/api-reference/cli#development)
- [Supabase 로컬 개발 가이드](https://supabase.com/docs/guides/cli/local-development)
- [FastAPI 배포 가이드](https://fastapi.tiangolo.com/deployment/)
- [Serena Docker 문서](serena/DOCKER.md)

---

**마지막 업데이트**: 2026-01-15

