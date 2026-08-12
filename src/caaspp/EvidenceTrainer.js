// src/caaspp/EvidenceTrainer.js — short Evidence & Elaboration practice, reachable from Dashboard.
import { useState, useEffect } from "react";
import { C, S, Spinner, Badge, Alert, MicroExercise } from "../App";
import { generateEvidenceExercise } from "../gemini-caaspp";
import { savePracticeSet } from "../supabase";

export function EvidenceTrainer({ user, topicTitle = null, onBack }) {
  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true); setError(false); setSet(null);
    generateEvidenceExercise(user.profile, topicTitle).then(r => {
      setLoading(false);
      if (r.type === "evidence_set") setSet(r);
      else setError(true);
    });
  };

  useEffect(() => { load(); }, []);

  const exercises = set?.exercises || [];
  const score = () => {
    if (!exercises.length) return 0;
    const correct = exercises.filter((ex, i) => (answers[i] || "") === ex.answer).length;
    return Math.round((correct / exercises.length) * 100);
  };

  const submit = async () => {
    setSubmitted(true);
    setSaving(true);
    await savePracticeSet(user.id, {
      type: "evidence",
      content: set,
      answers,
      score: score()
    }).catch(() => {});
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40 }}><Spinner label="Building your evidence practice set..." /></div>;
  if (error || !set) return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <Alert type="error">Couldn't generate the practice set. This is usually a temporary API issue — try again.</Alert>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={load} style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)}>Try Again</button>
        <button onClick={onBack} style={S.btn("rgba(255,255,255,0.1)")}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <button onClick={onBack} style={{ ...S.btn("rgba(255,255,255,0.1)"), marginBottom: 16 }}>← Dashboard</button>
      <div style={{ background: `linear-gradient(135deg,${C.teal}33,${C.navy})`, border: `1px solid ${C.teal}55`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <Badge color={C.teal}>🔎 Evidence & Elaboration</Badge>
        <h2 style={{ ...S.h2, marginTop: 8 }}>Pick the Strongest Evidence</h2>
        <p style={{ color: C.sky, fontSize: 14, margin: 0 }}>Read each short passage, then choose the piece of evidence that BEST supports the claim. This is a quick 5-10 minute practice — no pressure!</p>
      </div>

      {exercises.map((ex, i) => (
        <div key={i} style={{ ...S.card, marginBottom: 16, transform: "translateZ(0)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 6 }}>PASSAGE {i + 1}</div>
          <p style={{ fontSize: 14, color: C.sky, marginBottom: 10, lineHeight: 1.6 }}>{ex.passage}</p>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
            <strong style={{ color: C.gold }}>Claim: </strong>{ex.claim}
          </div>
          <MicroExercise ex={ex} idx={i} answers={answers} setAnswers={setAnswers} submitted={submitted} />
        </div>
      ))}

      {submitted ? (
        <div style={{ ...S.card, textAlign: "center", background: "rgba(82,183,136,0.08)", border: `1px solid ${C.sage}44` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{score() >= 70 ? "🎉" : "💪"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.gold }}>{score()}%</div>
          <p style={{ color: C.sky }}>{set.encouragement}</p>
          {saving && <div style={{ fontSize: 12, color: C.muted }}>Saving progress...</div>}
        </div>
      ) : (
        <button style={{ ...S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`), width: "100%", justifyContent: "center", padding: 14 }}
          onClick={submit} disabled={Object.keys(answers).length < exercises.length}>
          Check My Answers
        </button>
      )}
    </div>
  );
}
