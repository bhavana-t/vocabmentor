// src/caaspp/OutlineBuilder.js — guided pre-writing outline for Organization/Purpose.
import { C, S } from "../App";

export const BLANK_OUTLINE = { thesis: "", points: ["", "", ""], conclusion: "" };

export function OutlineBuilder({ outline, setOutline, onContinue }) {
  const o = outline || BLANK_OUTLINE;
  const points = o.points?.length === 3 ? o.points : ["", "", ""];

  const updatePoint = (i, val) => {
    const next = [...points];
    next[i] = val;
    setOutline({ ...o, points: next });
  };

  const filledPoints = points.filter(p => p.trim()).length;
  const ready = o.thesis.trim().length > 0 && filledPoints >= 1 && o.conclusion.trim().length > 0;

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <h3 style={S.h3}>🗂️ Plan Your Essay First</h3>
      <p style={{ fontSize: 13, color: C.sky, marginBottom: 14 }}>
        Great essays start with a plan. Fill these in before you write — a clear plan is the biggest thing that helps with Organization on CAASPP.
      </p>

      <label style={S.label}>Thesis statement — what's your main point?</label>
      <textarea style={{ ...S.input, minHeight: 60, marginBottom: 12, resize: "vertical" }}
        placeholder="e.g. School should start later because it would help students focus and do better in class."
        value={o.thesis} onChange={e => setOutline({ ...o, thesis: e.target.value })} />

      <label style={S.label}>3 supporting points</label>
      {[0, 1, 2].map(i => (
        <input key={i} style={{ ...S.input, marginBottom: 8 }}
          placeholder={`Supporting point ${i + 1}`}
          value={points[i]} onChange={e => updatePoint(i, e.target.value)} />
      ))}

      <label style={S.label}>Conclusion idea — how will you wrap it up?</label>
      <textarea style={{ ...S.input, minHeight: 50, marginBottom: 14, resize: "vertical" }}
        placeholder="e.g. Restate why a later start time matters and what it would change."
        value={o.conclusion} onChange={e => setOutline({ ...o, conclusion: e.target.value })} />

      {!ready && (o.thesis || o.conclusion || filledPoints > 0) && (
        <div style={{ fontSize: 12, color: C.warn, marginBottom: 10 }}>
          Fill in a thesis, at least one supporting point, and a conclusion idea to continue.
        </div>
      )}

      <button style={{ ...S.btn(`linear-gradient(135deg,${C.purple},${C.teal})`), width: "100%", justifyContent: "center", padding: 12 }}
        disabled={!ready} onClick={onContinue}>
        ✍️ Start Writing →
      </button>
    </div>
  );
}
