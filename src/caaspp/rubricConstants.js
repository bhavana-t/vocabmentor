// src/caaspp/rubricConstants.js — plain data/logic only, no React/App.js dependency.
// Kept separate from rubric.js so gemini.js (and any non-React code) can import
// these without pulling in App.js and creating a circular import (App.js -> gemini.js).

export const CAASPP_CATEGORIES = [
  { key: "organization", label: "Organization/Purpose", max: 4, icon: "🗂️" },
  { key: "evidence", label: "Evidence/Elaboration", max: 4, icon: "🔎" },
  { key: "conventions", label: "Conventions", max: 2, icon: "✅" }
];

export const CAASPP_RUBRIC_DEFINITIONS = `CAASPP Smarter Balanced ELA essay rubric (score each category independently):
- Organization/Purpose (0-4): Does the essay have a clear thesis/controlling idea, logical paragraph structure (intro/body/conclusion), and effective transitions that connect ideas?
- Evidence/Elaboration (0-4): Does the essay use relevant, specific evidence from the topic/sources and elaborate on WHY that evidence supports the argument (not just stating it)?
- Conventions (0-2): Is the essay largely free of errors in grammar, punctuation, capitalization, and sentence structure (subject-verb agreement, run-ons/fragments)?`;

// Deterministic (non-AI) plain-language weekly progress summary for the parent view.
// e.g. "3 essays this week — Organization improved from 1/4 to 2/4."
export function summarizeWeeklyProgress(essays) {
  const list = essays || [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = list.filter(e => e.created_at && new Date(e.created_at).getTime() >= weekAgo);
  if (thisWeek.length === 0) return null;

  // oldest→newest within the week, so we can compare first vs. latest per category
  const chronological = [...thisWeek].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const first = chronological[0];
  const latest = chronological[chronological.length - 1];

  const lines = [`${thisWeek.length} essay${thisWeek.length === 1 ? "" : "s"} this week`];
  for (const cat of CAASPP_CATEGORIES) {
    const before = first?.rubric_scores?.[cat.key];
    const after = latest?.rubric_scores?.[cat.key];
    if (typeof before === "number" && typeof after === "number" && before !== after) {
      const verb = after > before ? "improved" : "dipped";
      lines.push(`${cat.label} ${verb} from ${before}/${cat.max} to ${after}/${cat.max}`);
    }
  }
  return lines.join(" — ");
}
