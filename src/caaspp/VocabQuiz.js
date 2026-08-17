// src/caaspp/VocabQuiz.js — post-essay "use the word in a sentence about this topic" quiz.
import { useState, useEffect } from "react";
import { C, S } from "../App";
import { evaluateVocabUsage } from "../gemini-caaspp";
import { savePracticeSet } from "../supabase";
import { ARGUMENT_VOCAB } from "./wordBanks";
import { blockPasteProps, PASTE_BLOCKED_MESSAGE } from "./pasteGuard";

function pickThree(words) {
  const arr = [...words];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3);
}

export function VocabInContextQuiz({ user, topicTitle }) {
  const [words] = useState(() => pickThree(ARGUMENT_VOCAB[0]?.items || []));
  const [sentences, setSentences] = useState({});
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState({});
  const [saved, setSaved] = useState(false);
  const [pasteWarning, setPasteWarning] = useState({});

  const checkWord = async (i, word) => {
    setChecking(c => ({ ...c, [i]: true }));
    const r = await evaluateVocabUsage(word, topicTitle, sentences[i] || "").catch(() => null);
    setChecking(c => ({ ...c, [i]: false }));
    if (r?.type === "vocab_evaluation") setResults(res => ({ ...res, [i]: r }));
  };

  const allChecked = words.length > 0 && words.every((_, i) => results[i]);

  useEffect(() => {
    if (!allChecked || saved) return;
    setSaved(true);
    const scorePct = Math.round((words.filter((_, i) => results[i]?.correct).length / words.length) * 100);
    savePracticeSet(user.id, { type: "vocab", content: { words, topicTitle }, answers: sentences, score: scorePct }).catch(() => {});
  }, [allChecked]);

  if (!words.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 16, transform: "translateZ(0)" }}>
      <h3 style={S.h3}>📚 Use It in a Sentence</h3>
      <p style={{ fontSize: 13, color: C.sky, marginBottom: 14 }}>Try using each word correctly in a sentence about your essay topic.</p>
      {words.map((word, i) => (
        <div key={word} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, marginBottom: 6 }}>{word}</div>
          <input style={S.input} placeholder={`Write a sentence using "${word}"...`}
            value={sentences[i] || ""} disabled={!!results[i]}
            onChange={e => setSentences(s => ({ ...s, [i]: e.target.value }))}
            {...blockPasteProps(v => setPasteWarning(pw => ({ ...pw, [i]: v })))} />
          {pasteWarning[i] && <div style={{ marginTop:6, fontSize:12, color:C.warn }}>{PASTE_BLOCKED_MESSAGE}</div>}
          {!results[i] ? (
            <button style={{ ...S.btn("rgba(0,180,216,0.12)", C.teal), marginTop:8, fontSize:12, padding:"6px 12px" }}
              onClick={() => checkWord(i, word)} disabled={checking[i] || !(sentences[i] || "").trim()}>
              {checking[i] ? "Checking..." : "Check My Sentence"}
            </button>
          ) : (
            <div style={{ marginTop:6, fontSize:12, color: results[i].correct ? C.sage : C.warn }}>
              {results[i].correct ? "✓ " : "🎯 "}{results[i].feedback}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
