// src/caaspp/rubric.js — React display components for the CAASPP rubric.
import { C, S } from "../App";
import { CAASPP_CATEGORIES } from "./rubricConstants";

export { CAASPP_CATEGORIES, CAASPP_RUBRIC_DEFINITIONS, summarizeWeeklyProgress } from "./rubricConstants";

function rubricColor(score, max) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return pct >= 75 ? C.sage : pct >= 50 ? C.warn : C.error;
}

// A CAASPP category score bar, sized to its own max (4, 4, or 2) rather than 100.
export function RubricBar({ label, score, max, icon }) {
  const color = rubricColor(score, max);
  const pct = max > 0 ? (score / max) * 100 : 0;
  const p = S.prog(pct, color);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{icon} {label}</span>
        <span style={{ fontWeight: 700, color }}>{score}/{max}</span>
      </div>
      <div style={p.outer}><div style={p.inner} /></div>
    </div>
  );
}

// Full CAASPP scorecard for a single essay's rubric_scores object: {organization, evidence, conventions}
export function RubricScorecard({ rubric, title = "📊 CAASPP Rubric Score" }) {
  if (!rubric) return null;
  return (
    <div style={{ ...S.card, marginBottom: 16, background: "rgba(0,180,216,0.06)" }}>
      <h3 style={S.h3}>{title}</h3>
      {CAASPP_CATEGORIES.map(cat => (
        <RubricBar key={cat.key} label={cat.label} icon={cat.icon} score={rubric[cat.key] ?? 0} max={cat.max} />
      ))}
    </div>
  );
}

// "Here's what's graded, and what to include" — shown before the student starts writing.
export function CaasppChecklist({ collapsed = false }) {
  const body = (
    <>
      <p style={{ fontSize: 13, color: C.sky, marginBottom: 14 }}>
        Every essay is scored on 3 things. Here's what to aim for in each:
      </p>
      {CAASPP_CATEGORIES.map(cat => (
        <div key={cat.key} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, marginBottom: 6 }}>
            {cat.icon} {cat.label} <span style={{ color: C.muted, fontWeight: 400 }}>(out of {cat.max})</span>
          </div>
          {cat.tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, color: C.sky, marginBottom: 4, paddingLeft: 4 }}>✓ {tip}</div>
          ))}
        </div>
      ))}
    </>
  );

  if (collapsed) {
    return (
      <details style={{ ...S.card, marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 14, color: C.gold }}>📋 What's being graded? (tap to review)</summary>
        <div style={{ marginTop: 12 }}>{body}</div>
      </details>
    );
  }

  return (
    <div style={{ ...S.card, marginBottom: 16, background: "rgba(244,162,97,0.06)", border: `1px solid ${C.gold}44` }}>
      <h3 style={S.h3}>📋 Before You Start — What's Graded</h3>
      {body}
    </div>
  );
}

// Compact trend row: last N essays' score for one category, shown as small colored pips.
export function RubricTrendRow({ essays, categoryKey, max }) {
  const scored = (essays || [])
    .filter(e => e.rubric_scores && typeof e.rubric_scores[categoryKey] === "number")
    .slice(0, 5)
    .reverse();
  if (scored.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {scored.map((e, i) => {
        const score = e.rubric_scores[categoryKey];
        const color = rubricColor(score, max);
        return (
          <div key={i} title={`${score}/${max}`} style={{
            width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: `${color}22`, border: `1px solid ${color}66`, fontSize: 11, fontWeight: 700, color
          }}>{score}</div>
        );
      })}
    </div>
  );
}
