// src/caaspp/dailyCompletion.js — infer, per calendar day, which practice categories a
// student engaged with (Word of the Day, CAASPP Quick Practice, Essay work), so gaps on
// an otherwise-active day can be flagged for Admin.
//
// There's no dedicated login-event log in this app, so "active day" is approximated as
// any calendar day with at least one recorded activity (test, lesson, essay, or practice
// set). A day with zero activity isn't shown at all — there's nothing to flag either way.
//
// Note: essay records only carry the FIRST draft's timestamp (there's no separate
// "rewrite submitted at" column), so a rewrite submitted days later than the first draft
// won't get its own entry here — the essay category will only show on the day the first
// draft was written.

function dateKey(iso) {
  return new Date(iso).toISOString().slice(0, 10); // YYYY-MM-DD
}

export function computeDailyCompletion(user) {
  const days = {};

  const touch = (iso, field) => {
    if (!iso) return;
    const d = dateKey(iso);
    if (!days[d]) days[d] = { date: d, wordOfDay: false, caasppPractice: false, essay: false, lessonOrTest: false };
    days[d][field] = true;
  };

  (user.tests || []).forEach(t => touch(t.created_at, "lessonOrTest"));
  (user.lessons || []).forEach(l => touch(l.created_at, "lessonOrTest"));
  (user.essays || []).forEach(e => touch(e.created_at, "essay"));
  (user.practiceSets || []).forEach(p => {
    if (p.type === "wordofday") touch(p.created_at, "wordOfDay");
    else if (["evidence", "conventions", "passage"].includes(p.type)) touch(p.created_at, "caasppPractice");
  });

  return Object.values(days)
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first
    .map(d => ({ ...d, complete: d.wordOfDay && d.caasppPractice && d.essay }));
}
