// src/caaspp/ConventionsQuiz.js — short conventions (grammar/mechanics) quiz, reachable anytime from Dashboard.
import { useState, useEffect } from "react";
import { C, S, Spinner, Badge, Alert, MicroExercise } from "../App";
import { generateConventionsQuiz } from "../gemini-caaspp";
import { savePracticeSet } from "../supabase";

export function ConventionsQuiz({ user, onBack }) {
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true); setError(false); setQuiz(null);
    // cycle focus area based on how many conventions quizzes this student has already done
    const priorCount = (user.practiceSets || []).filter(p => p.type === "conventions").length;
    generateConventionsQuiz(user.profile, priorCount).then(r => {
      setLoading(false);
      if (r.type === "conventions_quiz") setQuiz(r);
      else setError(true);
    });
  };

  useEffect(() => { load(); }, []);

  const exercises = quiz?.exercises || [];
  const score = () => {
    if (!exercises.length) return 0;
    const correct = exercises.filter((ex, i) => (answers[i] || "").toLowerCase().trim() === (ex.answer || "").toLowerCase().trim()).length;
    return Math.round((correct / exercises.length) * 100);
  };

  const submit = async () => {
    setSubmitted(true);
    setSaving(true);
    await savePracticeSet(user.id, { type: "conventions", content: quiz, answers, score: score() }).catch(() => {});
    setSaving(false);
  };

  if (loading) return <div style={{ padding: 40 }}><Spinner label="Building your conventions quiz..." /></div>;
  if (error || !quiz) return (
    <div style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <Alert type="error">Couldn't generate the quiz. This is usually a temporary API issue — try again.</Alert>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={load} style={S.btn(`linear-gradient(135deg,${C.gold},${C.coral})`)}>Try Again</button>
        <button onClick={onBack} style={S.btn("rgba(255,255,255,0.1)")}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <button onClick={onBack} style={{ ...S.btn("rgba(255,255,255,0.1)"), marginBottom: 16 }}>← Dashboard</button>
      <div style={{ background: `linear-gradient(135deg,${C.gold}33,${C.navy})`, border: `1px solid ${C.gold}55`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <Badge color={C.gold}>✅ Conventions</Badge>
        <h2 style={{ ...S.h2, marginTop: 8 }}>{quiz.focusArea} — Quick Quiz</h2>
        <p style={{ color: C.sky, fontSize: 14, margin: 0 }}>5 quick questions, 2-3 minutes. Let's go!</p>
      </div>

      <div style={{ ...S.card, marginBottom: 16, transform: "translateZ(0)" }}>
        {exercises.map((ex, i) => (
          <MicroExercise key={i} ex={ex} idx={i} answers={answers} setAnswers={setAnswers} submitted={submitted} />
        ))}
      </div>

      {submitted ? (
        <div style={{ ...S.card, textAlign: "center", background: "rgba(82,183,136,0.08)", border: `1px solid ${C.sage}44` }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{score() >= 70 ? "🎉" : "💪"}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.gold }}>{score()}%</div>
          <p style={{ color: C.sky }}>{quiz.encouragement}</p>
          {saving && <div style={{ fontSize: 12, color: C.muted }}>Saving progress...</div>}
        </div>
      ) : (
        <button style={{ ...S.btn(`linear-gradient(135deg,${C.gold},${C.coral})`), width: "100%", justifyContent: "center", padding: 14 }}
          onClick={submit} disabled={Object.keys(answers).length < exercises.length}>
          Check My Answers
        </button>
      )}
    </div>
  );
}
