// src/caaspp/PassageSetView.js — two-passage reading + comprehension check + synthesis essay handoff.
import { useState, useEffect } from "react";
import { C, S, Spinner, Badge, MicroExercise } from "../App";
import { generatePassageSet } from "../gemini-caaspp";
import { savePracticeSet } from "../supabase";

export function PassageSetView({ user, onBack, onStartSynthesis }) {
  const [set, setSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("passage1"); // passage1|passage2|comprehension
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const pastMistakes = {
        weakSections: (user.tests?.filter(t => !t.passed).flatMap(t =>
          Object.entries(t.scores || {}).filter(([k,v]) => k !== 'total' && v < 75).map(([k]) => k)
        ) || []).slice(-5)
      };
      const r = await generatePassageSet(user.profile, pastMistakes);
      setLoading(false);
      setSet(r.type === "passage_set" ? r : null);
    })();
  }, []);

  const checkQuestions = set?.comprehensionCheck || [];
  const score = () => {
    if (!checkQuestions.length) return 0;
    const correct = checkQuestions.filter((q, i) => (answers[i] || "") === q.answer).length;
    return Math.round((correct / checkQuestions.length) * 100);
  };

  const finishCheck = async () => {
    setSubmitted(true);
    await savePracticeSet(user.id, { type: "passage", content: set, answers, score: score() }).catch(() => {});
  };

  const startWriting = () => {
    onStartSynthesis({ ...set.synthesisTopic, passages: set.passages });
  };

  if (loading) return <div style={{ padding: 40 }}><Spinner label="Building your reading & writing set..." /></div>;
  if (!set) return <div style={{ padding: 24 }}><button onClick={onBack} style={S.btn("rgba(255,255,255,0.1)")}>← Back</button></div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 80px" }}>
      <button onClick={onBack} style={{ ...S.btn("rgba(255,255,255,0.1)"), marginBottom: 16 }}>← Dashboard</button>
      <div style={{ background: `linear-gradient(135deg,${C.purple}44,${C.navy})`, border: `1px solid ${C.purple}66`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <Badge color={C.purple}>📖 Reading & Writing Set</Badge>
        <h2 style={{ ...S.h2, marginTop: 8 }}>
          {stage === "passage1" ? "Passage 1 of 2" : stage === "passage2" ? "Passage 2 of 2" : "Quick Check"}
        </h2>
        <p style={{ color: C.sky, fontSize: 14, margin: 0 }}>Read both passages, answer a few quick questions, then write a synthesis essay using both.</p>
      </div>

      {(stage === "passage1" || stage === "passage2") && (() => {
        const p = set.passages[stage === "passage1" ? 0 : 1];
        return (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={S.h3}>{p.title}</h3>
            <p style={{ fontSize: 14, color: C.sky, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{p.text}</p>
            <button style={{ ...S.btn(`linear-gradient(135deg,${C.purple},${C.teal})`), width: "100%", justifyContent: "center", padding: 12, marginTop: 10 }}
              onClick={() => setStage(stage === "passage1" ? "passage2" : "comprehension")}>
              {stage === "passage1" ? "Next Passage →" : "Quick Check →"}
            </button>
          </div>
        );
      })()}

      {stage === "comprehension" && (
        <>
          <div style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={S.h3}>✅ Quick Check</h3>
            <p style={{ fontSize: 13, color: C.sky, marginBottom: 14 }}>Make sure you understood both passages before writing.</p>
            {checkQuestions.map((q, i) => (
              <MicroExercise key={i} ex={q} idx={i} answers={answers} setAnswers={setAnswers} submitted={submitted} />
            ))}
            {!submitted ? (
              <button style={S.btn(`linear-gradient(135deg,${C.teal},${C.mint})`)} onClick={finishCheck} disabled={Object.keys(answers).length < checkQuestions.length}>
                Check Answers
              </button>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: C.sage }}>Score: {score()}% — nice work! Ready to write when you are.</div>
            )}
          </div>
          {submitted && (
            <button style={{ ...S.btn(`linear-gradient(135deg,${C.purple},${C.coral})`), width: "100%", justifyContent: "center", padding: 14 }}
              onClick={startWriting}>
              ✍️ Start Writing My Synthesis Essay →
            </button>
          )}
        </>
      )}
    </div>
  );
}
