# Git 관련 Cursor 권한 정리

## 📋 개요

이 문서는 Cursor IDE에서 Git 작업을 수행하기 위한 권한 설정과 관련 파일 정리를 다룹니다.

## 🔐 Cursor 권한 설정

### 설정 파일 위치
- `.claude/settings.local.json`

### Git 명령어 권한

현재 설정된 Git 권한:
```json
"Bash(git:*)"
```

이 설정으로 다음 Git 명령어들을 모두 사용할 수 있습니다:

#### 기본 작업
- `git status` - 저장소 상태 확인
- `git add` - 파일 스테이징
- `git commit` - 커밋 생성
- `git diff` - 변경사항 확인
- `git log` - 커밋 히스토리 확인

#### 브랜치 관리
- `git branch` - 브랜치 목록 확인
- `git checkout` - 브랜치 전환
- `git merge` - 브랜치 병합
- `git rebase` - 브랜치 리베이스

#### 원격 저장소
- `git push` - 원격 저장소에 푸시
- `git pull` - 원격 저장소에서 가져오기
- `git fetch` - 원격 저장소 정보 가져오기
- `git remote` - 원격 저장소 관리

#### 기타
- `git config` - Git 설정 관리
- `git stash` - 임시 저장
- `git tag` - 태그 관리
- `git reset` - 커밋 되돌리기
- `git revert` - 커밋 되돌리기 (안전)

## 📁 .gitignore 설정

### Cursor 관련 파일 무시

다음 파일/디렉토리는 Git에 포함되지 않습니다:

```
# Cursor IDE
.cursor/
.claude/
*.cursor-settings
*.claude-settings

# MCP 설정 (민감 정보 포함 가능)
.cursor/mcp.json
.mcp.json
~/.config/cursor/mcp.json
```

### Git 관련 임시 파일 무시

```
# Git related
*.patch
*.log
.git-rewrite-todo
.git-rewrite-todo-*
```

## 🚀 사용 예시

### 작업 완료 시 자동 커밋

사용자 규칙에 따라 작업 완료 시 자동으로 커밋을 수행합니다:

```bash
# 1. 상태 확인
git status

# 2. 변경사항 스테이징
git add .

# 3. 커밋 생성 (의미 있는 메시지와 함께)
git commit -m "feat: 작업 내용 요약"
```

### 브랜치 작업

```bash
# 새 브랜치 생성 및 전환
git checkout -b feature/작업명

# 작업 후 커밋
git add .
git commit -m "feat: 기능 구현"

# 원격 저장소에 푸시
git push origin feature/작업명
```

## ⚠️ 주의사항

1. **민감 정보 보호**: `.claude/settings.local.json`과 MCP 설정 파일은 Git에 포함되지 않도록 설정되어 있습니다.

2. **의미 있는 커밋 메시지**: 자동 커밋 시에도 의미 있는 커밋 메시지를 작성합니다.
   - `feat: 새로운 기능 추가`
   - `fix: 버그 수정`
   - `refactor: 코드 리팩토링`
   - `docs: 문서 수정`

3. **작업 전 상태 확인**: 중요한 작업 전에는 항상 `git status`로 현재 상태를 확인합니다.

4. **브랜치 전략**: 메인 브랜치에 직접 작업하지 않고, 기능 브랜치를 사용합니다.

## 📝 커밋 메시지 컨벤션

### Conventional Commits 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 포맷팅 (기능 변경 없음)
- `refactor`: 코드 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 빌드 프로세스 또는 보조 도구 변경

### 예시

```bash
git commit -m "feat(plan): 학습 계획 생성 기능 추가"
git commit -m "fix(auth): 로그인 세션 만료 문제 수정"
git commit -m "docs: Git 권한 설정 문서 추가"
```

## 🔄 업데이트 이력

- 2024-12-15: Git 관련 Cursor 권한 정리 문서 작성
  - `.claude/settings.local.json`에 `Bash(git:*)` 권한 추가
  - `.gitignore`에 Cursor 관련 파일 추가

