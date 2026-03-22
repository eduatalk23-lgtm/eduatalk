import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
  return lines.slice(1).map(line => {
    const values = []; let current = ''; let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += char;
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ''; });
    return obj;
  });
}

const subjects = parseCSV(fs.readFileSync('data/과목 정보.csv', 'utf-8'));
const majors = parseCSV(fs.readFileSync('data/대단원 정보.csv', 'utf-8'));
const minors = parseCSV(fs.readFileSync('data/소단원 정보.csv', 'utf-8'));

const subjectMap = {};
for (const s of subjects) subjectMap[s.ID] = { name: s['과목명'], area: s['교과명'], year: s['개정년도명'].replace('년', '') };

const majorRows = []; let sort = 1; const majorIdMap = {};
for (const m of majors) {
  const name = (m['대단원명'] || '').trim(); if (!name) continue;
  const s = subjectMap[m['과목ID']] || {};
  majorRows.push({ curriculum_year: s.year||'', subject_area: s.area||'', subject_name: s.name||'', unit_type: 'major', unit_name: name, sort_order: sort++ });
  majorIdMap[m.ID] = { subject_name: s.name||'', unit_name: name };
}
console.log("대단원:", majorRows.length, "건");
for (let i = 0; i < majorRows.length; i += 50) {
  const batch = majorRows.slice(i, i+50);
  const { error } = await supabase.from('exploration_guide_curriculum_units').upsert(batch, { onConflict: 'curriculum_year,subject_area,subject_name,unit_type,unit_name', ignoreDuplicates: true });
  if (error) console.error("  batch", i, error.message); else console.log("  batch", i, batch.length, "OK");
}

const { data: allMajors } = await supabase.from('exploration_guide_curriculum_units').select('id, subject_name, unit_name').eq('unit_type', 'major');
const lookup = {}; for (const m of allMajors||[]) lookup[m.subject_name+'|'+m.unit_name] = m.id;

const minorRows = [];
for (const mn of minors) {
  const name = (mn['소단원명']||'').trim(); if (!name) continue;
  const parent = majorIdMap[mn['대단원ID']]; if (!parent) continue;
  const pid = lookup[parent.subject_name+'|'+parent.unit_name]; if (!pid) { console.warn("no parent:", parent.subject_name, parent.unit_name); continue; }
  const s = Object.values(subjectMap).find(x => x.name === parent.subject_name) || {};
  minorRows.push({ curriculum_year: s.year||'', subject_area: s.area||'', subject_name: parent.subject_name, unit_type: 'minor', unit_name: name, parent_unit_id: pid, learning_elements: (mn['학습요소']||'').trim()||null, sort_order: sort++ });
}
console.log("소단원:", minorRows.length, "건");
for (let i = 0; i < minorRows.length; i += 50) {
  const batch = minorRows.slice(i, i+50);
  const { error } = await supabase.from('exploration_guide_curriculum_units').upsert(batch, { onConflict: 'curriculum_year,subject_area,subject_name,unit_type,unit_name', ignoreDuplicates: true });
  if (error) console.error("  batch", i, error.message); else console.log("  batch", i, batch.length, "OK");
}

const { count } = await supabase.from('exploration_guide_curriculum_units').select('*', { count: 'exact', head: true });
console.log("\n✅ 최종:", count, "건");
