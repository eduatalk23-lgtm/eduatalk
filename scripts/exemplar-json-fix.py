#!/usr/bin/env python3
"""
Exemplar JSON 후처리 스크립트
에이전트가 생성한 JSON을 importer가 기대하는 형식으로 자동 변환.

Usage:
  python3 scripts/exemplar-json-fix.py                    # data/exemplar-parsed/ 전체
  python3 scripts/exemplar-json-fix.py --file=김지민       # 특정 파일만
"""

import json
import glob
import sys
import os

JSON_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'exemplar-parsed')

def fix_json(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        d = json.load(f)

    fixes = []

    # === 1. grades 필드명 매핑 ===
    GRADE_KEY_MAP = {
        'subject': 'subjectName',
        'category': 'subjectType',
        'units': 'creditHours',
        'standardDeviation': 'stdDev',
        'numberOfStudents': 'totalStudents',
        'rank': 'rankGrade',
    }
    for g in d.get('grades', []):
        for old, new in GRADE_KEY_MAP.items():
            if old in g and new not in g:
                g[new] = g.pop(old)
                fixes.append(f'grades: {old}->{new}')

    # === 2. seteks 필드명 + semester 수정 ===
    for s in d.get('seteks', []):
        if 'subject' in s and 'subjectName' not in s:
            s['subjectName'] = s.pop('subject')
            fixes.append('seteks: subject->subjectName')
        # semester 0 or null -> 1
        if s.get('semester') in (0, None, ''):
            s['semester'] = 1
            fixes.append(f'seteks: semester 0->1 ({s.get("subjectName","")})')

    # === 3. seteks 중복 병합 (grade+semester+subjectName) ===
    if d.get('seteks'):
        merged = {}
        for s in d['seteks']:
            key = (s.get('grade'), s.get('semester'), s.get('subjectName'))
            if key in merged:
                merged[key]['content'] += '\n' + (s.get('content') or '')
                fixes.append(f'seteks: merged dup {key}')
            else:
                merged[key] = s.copy()
        d['seteks'] = list(merged.values())

    # === 4. peArtGrades 필드명 매핑 ===
    for p in d.get('peArtGrades', []):
        if 'subject' in p and 'subjectName' not in p:
            p['subjectName'] = p.pop('subject')
        if 'category' in p and 'subjectType' not in p:
            p['subjectType'] = p.pop('category')
        if 'units' in p and 'creditHours' not in p:
            p['creditHours'] = p.pop('units')

    # === 5. reading 필드명 + null 제거 ===
    for r in d.get('reading', []):
        if 'subject' in r and 'subjectArea' not in r:
            r['subjectArea'] = r.pop('subject')
        if 'content' in r and 'bookDescription' not in r:
            r['bookDescription'] = r.pop('content')
    # null bookDescription 또는 subjectArea 제거
    original_count = len(d.get('reading', []))
    d['reading'] = [
        r for r in d.get('reading', [])
        if (r.get('bookDescription') or '').strip()
    ]
    for r in d['reading']:
        if not r.get('subjectArea'):
            r['subjectArea'] = '공통'
            fixes.append('reading: null subjectArea->공통')
    if len(d.get('reading', [])) < original_count:
        fixes.append(f'reading: removed {original_count - len(d["reading"])} empty entries')

    # === 6. enrollment: 빈 항목 제거 + grade 중복 병합 + grade<1 수정 ===
    d['enrollment'] = [e for e in d.get('enrollment', []) if (e.get('description') or '').strip()]
    # grade < 1 수정
    for e in d['enrollment']:
        if e.get('grade', 0) < 1:
            e['grade'] = 1
            fixes.append('enrollment: grade<1->1')
    # grade 중복 병합
    grade_map = {}
    for e in d['enrollment']:
        g = e.get('grade')
        if g in grade_map:
            grade_map[g]['description'] += '\n' + e.get('description', '')
            fixes.append(f'enrollment: merged dup grade {g}')
        else:
            grade_map[g] = e.copy()
    d['enrollment'] = list(grade_map.values())
    # enrollment이 비어있으면 기본값 추가
    if not d['enrollment']:
        school = d.get('studentInfo', {}).get('schoolName', '학교')
        year = d.get('studentInfo', {}).get('enrollmentYear', 2015)
        d['enrollment'] = [{"grade": 1, "description": f"{school} 제1학년 입학 ({year})"}]
        fixes.append('enrollment: added default entry')

    # === 7. certifications 필드명 매핑 ===
    for c in d.get('certifications', []):
        CERT_MAP = {
            'certificationName': 'certName',
            'certificationDate': 'certDate',
            'issuingBody': 'issuingOrg',
            'issuingOrganization': 'issuingOrg',
        }
        for old, new in CERT_MAP.items():
            if old in c and new not in c:
                c[new] = c.pop(old)
                fixes.append(f'cert: {old}->{new}')

    # === 8. rawContentByPage 키 제거 ===
    if 'rawContentByPage' in d:
        del d['rawContentByPage']
        fixes.append('removed rawContentByPage')

    # 저장
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

    return fixes


def main():
    args = sys.argv[1:]
    file_filter = None
    for a in args:
        if a.startswith('--file='):
            file_filter = a.split('=')[1]

    files = sorted(glob.glob(os.path.join(JSON_DIR, '*.json')))
    if file_filter:
        files = [f for f in files if file_filter in f]

    print(f'📁 JSON 파일: {len(files)}건\n')

    total_fixes = 0
    for filepath in files:
        fname = os.path.basename(filepath)
        fixes = fix_json(filepath)
        if fixes:
            print(f'[{fname}] {len(fixes)}건 수정')
            for fix in fixes[:5]:
                print(f'  - {fix}')
            if len(fixes) > 5:
                print(f'  ... +{len(fixes)-5}건')
            total_fixes += len(fixes)
        else:
            print(f'[{fname}] ✅ 수정 불필요')

    print(f'\n완료: {total_fixes}건 수정됨')


if __name__ == '__main__':
    main()
