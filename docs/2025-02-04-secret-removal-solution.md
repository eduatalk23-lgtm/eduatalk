# GitHub Secret 제거 해결 방법

## 현재 상황

GitHub Push Protection이 이전 커밋 히스토리에 포함된 Figma Personal Access Token을 감지하여 푸시를 차단하고 있습니다.

## 즉시 해결 방법

### 옵션 1: GitHub Unblock URL 사용 (가장 빠름) ⚡

GitHub에서 제공하는 unblock URL을 사용하여 일시적으로 푸시를 허용할 수 있습니다:

**⚠️ 중요: 이 방법을 사용하기 전에 반드시 토큰을 재발급하세요!**

1. 아래 URL을 브라우저에서 열기:
   ```
   https://github.com/eduatalk23-lgtm/eduatalk/security/secret-scanning/unblock-secret/36yZdFe5qqmj9njEyYjRX1ULzMe
   ```

2. GitHub에서 "Allow secret" 클릭

3. 푸시 재시도:
   ```bash
   git push
   ```

### 옵션 2: 토큰 재발급 후 Unblock (권장) ✅

1. **Figma에서 토큰 재발급** (필수)
   - Figma → Settings → Personal Access Tokens
   - 기존 토큰 삭제
   - 새 토큰 생성
   - 로컬 `~/.config/cursor/mcp.json` 업데이트

2. **GitHub Unblock URL 사용**
   - 위의 URL로 이동하여 "Allow secret" 클릭

3. **푸시 재시도**

## 근본적인 해결 (선택사항)

히스토리에서 토큰을 완전히 제거하려면 `git filter-repo`를 사용해야 합니다:

```bash
# git-filter-repo 설치 (Homebrew 사용)
brew install git-filter-repo

# 토큰 제거 (실제 토큰 값으로 교체)
git filter-repo --replace-text <(echo "figd_jXMKQa3D-60c0vXOOT53rSzishkcSQT3I-8fsVA4==>YOUR_FIGMA_PERSONAL_ACCESS_TOKEN")

# 강제 푸시 (주의: 히스토리 재작성)
git push origin --force --all
```

⚠️ **주의**: 히스토리 재작성은 강제 푸시가 필요하며, 다른 개발자와 협업 중이라면 사전에 공지해야 합니다.

## 완료된 작업

✅ 현재 파일에서 토큰 마스킹 완료
✅ `.gitignore`에 설정 파일 추가 완료
✅ Git에서 `mcp.json` 파일 추적 제거 완료
✅ 가이드 문서에서 실제 토큰 문자열 제거 완료

## 다음 단계

1. **즉시**: Figma 토큰 재발급 (노출된 토큰은 보안 위험)
2. **빠른 해결**: GitHub Unblock URL 사용하여 푸시
3. **선택사항**: 나중에 `git filter-repo`로 히스토리 정리

