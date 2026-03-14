#!/bin/bash
# lint-rls-policies.sh
# Checks migration files for unoptimized RLS auth function calls.
# Usage: ./scripts/lint-rls-policies.sh [file...]
# Without args: scans all migrations in supabase/migrations/

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

files=("$@")
if [ ${#files[@]} -eq 0 ]; then
  files=(supabase/migrations/*.sql)
fi

errors=0

for file in "${files[@]}"; do
  [ -f "$file" ] || continue

  # Find auth.uid()/auth.role()/auth.jwt() NOT preceded by SELECT
  # Uses grep -P for lookbehind
  if grep -Pn '(?<!SELECT )auth\.(uid|role|jwt)\(\)' "$file" | grep -iv '^\s*--' > /dev/null 2>&1; then
    matches=$(grep -Pn '(?<!SELECT )auth\.(uid|role|jwt)\(\)' "$file" | grep -iv '^\s*--')
    if [ -n "$matches" ]; then
      echo -e "${RED}✗ $file${NC}"
      echo "$matches" | while read -r line; do
        echo "  $line"
      done
      echo "  → Use (SELECT auth.uid()) instead of auth.uid()"
      echo ""
      errors=$((errors + 1))
    fi
  fi
done

if [ $errors -eq 0 ]; then
  echo -e "${GREEN}✓ All RLS policies use (SELECT auth.uid()) pattern${NC}"
  exit 0
else
  echo -e "${RED}Found $errors file(s) with unoptimized auth calls${NC}"
  exit 1
fi
