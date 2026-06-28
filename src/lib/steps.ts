import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export async function saveDailySteps(
  supabase: SupabaseClient<Database>,
  userId: string,
  date: string,
  stepsCount: number,
) {
  const { data: dailyLog } = await supabase
    .from('daily_logs')
    .select('id')
    .eq('log_date', date)
    .maybeSingle();

  if (dailyLog) {
    await supabase.from('daily_logs').update({ steps_count: stepsCount }).eq('id', dailyLog.id);
  } else {
    await supabase.from('daily_logs').insert({
      user_id: userId,
      log_date: date,
      steps_count: stepsCount,
    });
  }

  const { data: existingSteps } = await supabase
    .from('cardio_sessions')
    .select('id')
    .eq('session_date', date)
    .eq('type', 'daily_steps')
    .maybeSingle();

  const details = { steps_count: stepsCount };

  if (existingSteps) {
    await supabase.from('cardio_sessions').update({ details }).eq('id', existingSteps.id);
  } else if (stepsCount > 0) {
    await supabase.from('cardio_sessions').insert({
      user_id: userId,
      session_date: date,
      type: 'daily_steps',
      source: 'manual',
      details,
    });
  }
}
