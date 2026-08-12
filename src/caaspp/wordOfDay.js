// src/caaspp/wordOfDay.js — 5 daily vocabulary words, cached client-side per day,
// with an in-place "use it in a sentence" practice and essay bonus-scoring hookup.
import { useState, useEffect } from "react";
import { C, S, Spinner } from "../App";
import { generateWordsOfDay, evaluateVocabUsage } from "../gemini-caaspp";

function todayKey(uid) {
  const d = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, resets daily
  return `word_of_day_${uid}_${d}`;
}

// Returns [{word, meaning, example}, ...] — generated once per day per user, then cached.
export async function getOrCreateWordsOfDay(user) {
  const key = todayKey(user.id);
  const cached = localStorage.getItem(key);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }
  const r = await generateWordsOfDay(user.profile).catch(() => null);
  if (r?.type === "words_of_day" && r.words?.length) {
    localStorage.setItem(key, JSON.stringify(r.words));
    return r.words;
  }
  return null;
}

export function WordOfDayCard({ user }) {
  const [words, setWords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState({});
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const w = await getOrCreateWordsOfDay(user);
      setLoading(false);
      setWords(w);
    })();
  }, []);

  const checkWord = async (i, word) => {
    setChecking(c => ({ ...c, [i]: true }));
    const r = await evaluateVocabUsage(word, null, sentences[i] || "").catch(() => null);
    setChecking(c => ({ ...c, [i]: false }));
    if (r?.type === "vocab_evaluation") setResults(res => ({ ...res, [i]: r }));
  };

  if (loading) return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <h3 style={S.h3}>📅 Word of the Day</h3>
      <Spinner label="Picking today's words..." />
    </div>
  );
  if (!words?.length) return null;

  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <h3 style={S.h3}>📅 Word of the Day</h3>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        Learn these, practice using them below — and use them in your essay today for bonus points!
      </p>
      {words.map((w, i) => (
        <div key={w.word} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < words.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.gold, marginBottom: 4 }}>{w.word}</div>
          <div style={{ fontSize: 13, color: C.sky, marginBottom: 4 }}>{w.meaning}</div>
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginBottom: 8 }}>e.g. "{w.example}"</div>
          <input style={{ ...S.input, fontSize: 13 }} placeholder={`Write your own sentence using "${w.word}"...`}
            value={sentences[i] || ""} disabled={!!results[i]}
            onChange={e => setSentences(s => ({ ...s, [i]: e.target.value }))} />
          {!results[i] ? (
            <button style={{ ...S.btn("rgba(0,180,216,0.12)", C.teal), marginTop: 8, fontSize: 12, padding: "4px 10px" }}
              onClick={() => checkWord(i, w.word)} disabled={checking[i] || !(sentences[i] || "").trim()}>
              {checking[i] ? "Checking..." : "Check"}
            </button>
          ) : (
            <div style={{ marginTop: 6, fontSize: 12, color: results[i].correct ? C.sage : C.warn }}>
              {results[i].correct ? "✓ " : "🎯 "}{results[i].feedback}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
