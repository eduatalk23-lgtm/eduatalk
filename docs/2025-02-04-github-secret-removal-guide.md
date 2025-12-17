# GitHub Secret 제거 가이드

## 작업 일시
2025년 2월 4일

## 문제 상황

GitHub Push Protection이 Figma Personal Access Token을 감지하여 푸시가 차단되었습니다.

### 감지된 위치
1. `docs/2025-02-02-figma-mcp-setup.md:34` - 커밋 e8411001
2. `docs/2025-02-02-figma-mcp-setup.md:77` - 커밋 e8411001
3. `~/.config/cursor/mcp.json:8` - 커밋 54f70160, 4007b131

## 완료된 작업

✅ **현재 파일 수정 완료**
- `docs/2025-02-02-figma-mcp-setup.md`의 토큰을 `YOUR_FIGMA_PERSONAL_ACCESS_TOKEN`으로 마스킹
- `~/.config/cursor/mcp.json`의 토큰을 `YOUR_FIGMA_PERSONAL_ACCESS_TOKEN`으로 마스킹
- `~/.config/cursor/mcp.json`을 `.gitignore`에 추가
- Git에서 `mcp.json` 파일 추적 제거
- 변경사항 커밋 완료 (커밋: 052ef150)

## 추가 작업 필요

⚠️ **이전 커밋 히스토리에서 토큰 제거 필요**

현재 파일은 수정되었지만, 이전 커밋 히스토리에 토큰이 여전히 포함되어 있어 GitHub가 차단합니다.

### 해결 방법 옵션

#### 옵션 1: GitHub Secret Unblock (임시 해결)

GitHub에서 제공하는 unblock URL을 사용하여 일시적으로 푸시를 허용할 수 있습니다:

```
https://github.com/eduatalk23-lgtm/eduatalk/security/secret-scanning/unblock-secret/36yZdFe5qqmj9njEyYjRX1ULzMe
```

⚠️ **주의**: 이 방법은 토큰이 이미 노출되었으므로, **토큰을 즉시 재발급**해야 합니다.

#### 옵션 2: Git 히스토리에서 토큰 제거 (권장)

커밋 히스토리에서 토큰을 완전히 제거하는 것이 가장 안전합니다.

##### 방법 A: git filter-repo 사용 (권장)

```bash
# git-filter-repo 설치 (macOS)
brew install git-filter-repo

# 또는 pip로 설치
pip install git-filter-repo

# 토큰 제거 (실제 토큰을 YOUR_FIGMA_PERSONAL_ACCESS_TOKEN으로 교체)
git filter-repo --replace-text <(echo "figd_<YOUR_ACTUAL_TOKEN>==>YOUR_FIGMA_PERSONAL_ACCESS_TOKEN")

# 강제 푸시 (주의: 히스토리 재작성)
git push origin --force --all
```

##### 방법 B: BFG Repo-Cleaner 사용

```bash
# BFG 설치
brew install bfg

# 토큰 제거
bfg --replace-text replacements.txt

# replacements.txt 내용 (실제 토큰을 YOUR_FIGMA_PERSONAL_ACCESS_TOKEN으로 교체):
# figd_<YOUR_ACTUAL_TOKEN>==>YOUR_FIGMA_PERSONAL_ACCESS_TOKEN

# 정리 및 강제 푸시
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

##### 방법 C: Interactive Rebase 사용

```bash
# 문제가 되는 커밋들 수정
git rebase -i e8411001^  # e8411001 이전 커밋부터 시작

# 각 커밋에서 'edit'으로 표시하고 토큰 수정
# 수정 후:
git commit --amend
git rebase --continue

# 강제 푸시
git push origin --force --all
```

## 중요 사항

### 1. 토큰 재발급 필수

노출된 토큰은 즉시 재발급해야 합니다:

1. Figma 계정 설정 → Personal Access Tokens
2. 기존 토큰 삭제
3. 새 토큰 생성
4. 로컬 설정 파일(`~/.config/cursor/mcp.json`) 업데이트

### 2. 히스토리 재작성 주의사항

- 히스토리 재작성은 **강제 푸시**가 필요합니다
- 다른 개발자와 협업 중이라면 사전에 공지해야 합니다
- 모든 로컬 브랜치를 백업하세요

### 3. 향후 예방

- `.gitignore`에 설정 파일 추가 완료
- 문서에는 예시 값만 사용
- 실제 토큰은 환경 변수나 보안 저장소 사용

## 참고 자료

- [GitHub Secret Scanning](https://docs.github.com/code-security/secret-scanning)
- [git-filter-repo 문서](https://github.com/newren/git-filter-repo)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

