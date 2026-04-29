#!/usr/bin/env npx tsx
/**
 * Slot-aware Shadow 점수 측정 도구.
 *
 * 사용법:
 *   npx tsx scripts/measure-shadow-scores.ts <studentId>
 *
 * 출력:
 *   1. 최근 10건 pipeline 별 _slots / _slotAwareScores.stats 요약
 *   2. shadow score 보유 pipeline 의 슬롯 인벤토리 + Top-1 보너스 분포
 *      (tierFit / subjectFit / focusFit / weaknessFix / milestoneFill)
 *
 * 측정 대상 학생 (참고):
 *   김세린:    0e3e149d-4b9c-402d-ad5c-b3df04190889
 *   이가은:    35ee94b6-9484-4bee-8100-c761c1c56831
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { createSupabaseAdminClient } from '../lib/supabase/admin';

async function main() {
  const studentId = process.argv[2];
  if (!studentId) {
    console.error('usage: npx tsx scripts/measure-shadow-scores.ts <studentId>');
    process.exit(1);
  }

  const sb = createSupabaseAdminClient();
  if (!sb) throw new Error('admin client unavailable');

  const { data: rows, error } = await sb
    .from('student_record_analysis_pipelines')
    .select('id, pipeline_type, grade, mode, status, completed_at, started_at, task_results, tasks')
    .eq('student_id', studentId)
    .order('started_at', { ascending: false })
    .limit(10);
  if (error) throw error;

  console.log('=== Recent pipelines ===');
  for (const r of rows ?? []) {
    const tr = (r.task_results ?? {}) as Record<string, unknown>;
    const slots = tr._slots as unknown[] | undefined;
    const shadow = tr._slotAwareScores as { stats?: Record<string, unknown>; topKPerSlot?: unknown[] } | undefined;
    console.log(`\n[${r.pipeline_type} G${r.grade ?? '-'} ${r.mode ?? '-'}] status=${r.status} id=${String(r.id).slice(0,8)}`);
    console.log(`  slots=${slots?.length ?? 0}, shadow.stats=`, shadow?.stats ?? null);
    if (shadow?.topKPerSlot) {
      console.log(`  topKPerSlot.length=${shadow.topKPerSlot.length}`);
    }
  }

  console.log('\n\n=== Slot details (with shadow) ===');
  for (const r of rows ?? []) {
    const tr = (r.task_results ?? {}) as Record<string, unknown>;
    const slots = tr._slots as Array<Record<string, unknown>> | undefined;
    const shadow = tr._slotAwareScores as {
      stats?: Record<string, unknown>;
      topKPerSlot?: Array<Record<string, unknown>>;
    } | undefined;
    if (!slots || !shadow) continue;
    console.log(`\n--- pipeline ${String(r.id).slice(0,8)} (${r.pipeline_type} G${r.grade} ${r.mode}) ---`);
    console.log(`  shadow.stats =`, shadow.stats);

    console.log(`  Slots (n=${slots.length}):`);
    for (const s of slots) {
      const intent = s.intent as Record<string, unknown> | undefined;
      const constraints = s.constraints as Record<string, unknown> | undefined;
      const state = s.state as Record<string, unknown> | undefined;
      const weak = (intent?.weakCompetencies as unknown[]) ?? [];
      const mile = (intent?.unfulfilledMilestones as unknown[]) ?? [];
      console.log(
        `    G${s.grade} ${s.area} ${s.tier} cap=${constraints?.maxDifficulty} weak=${weak.length} mile=${mile.length} prio=${state?.priority}`,
      );
    }

    if (shadow.topKPerSlot && shadow.topKPerSlot.length > 0) {
      console.log(`  Top-1 per slot (bonus breakdown):`);
      const tierFitVals: number[] = [];
      const subjectFitVals: number[] = [];
      const focusFitVals: number[] = [];
      const weaknessFixVals: number[] = [];
      const milestoneVals: number[] = [];
      const topGuideIds = new Set<string>();
      for (const t of shadow.topKPerSlot) {
        const candidates = (t.candidates as Array<Record<string, unknown>>) ?? [];
        const top = candidates[0];
        if (!top) continue;
        topGuideIds.add(String(top.guideId));
        const breakdown = top.breakdown as { bonuses?: Array<{ name?: string; weighted?: number }> } | undefined;
        const bonuses = breakdown?.bonuses ?? [];
        const get = (k: string) => Number(bonuses.find(b => b.name === k)?.weighted ?? 0);
        tierFitVals.push(get('tierFit'));
        subjectFitVals.push(get('subjectFit'));
        focusFitVals.push(get('focusFit'));
        weaknessFixVals.push(get('weaknessFix'));
        milestoneVals.push(get('milestoneFill'));
      }
      const summarize = (label: string, arr: number[]) => {
        const n = arr.length;
        const avg = n ? (arr.reduce((a,b)=>a+b,0)/n).toFixed(2) : '0';
        const perfect = arr.filter(v => v >= (label === 'tierFit' ? 15 : label === 'subjectFit' ? 8 : 5)).length;
        const zero = arr.filter(v => v === 0).length;
        console.log(`    ${label}: avg=${avg} perfect=${perfect}/${n} zero=${zero}`);
      };
      summarize('tierFit', tierFitVals);
      summarize('subjectFit', subjectFitVals);
      summarize('focusFit', focusFitVals);
      summarize('weaknessFix', weaknessFixVals);
      summarize('milestoneFill', milestoneVals);
      console.log(`    Top-1 unique guides: ${topGuideIds.size} / ${shadow.topKPerSlot.length} slots`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
