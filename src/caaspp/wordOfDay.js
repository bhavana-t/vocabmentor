// src/caaspp/wordOfDay.js — vocabulary words that refresh each login session,
// mixing new words with past ones for review, with an in-place "use it in a
// sentence" practice (no reusing a sentence already submitted for a word),
// and an essay bonus-scoring hookup.
import { useState, useEffect } from "react";
import { C, S, Spinner, Badge } from "../App";
import { generateWordsOfDay, evaluateVocabUsage } from "../gemini-caaspp";
import { blockPasteProps, PASTE_BLOCKED_MESSAGE } from "./pasteGuard";
import { savePracticeSet } from "../supabase";

const TOTAL_COUNT = 5;
const REVIEW_COUNT = 2; // how many of today's 5 words are pulled from past sessions, if available

function sessionKey(uid) {
  // sessionStorage (not localStorage) so a fresh browser session naturally gets a fresh mix —
  // combined with clearWordsOfDay() on logout, this means "new mix every login."
  return `word_of_day_${uid}`;
}

function progressKey(uid) {
  // Separate entry for in-progress sentences/feedback, so navigating away from Dashboard
  // and back (which unmounts/remounts WordOfDayCard) doesn't lose already-checked answers.
  return `word_of_day_progress_${uid}`;
}

function historyKey(uid) {
  // Persistent (localStorage, not sessionStorage) record of every word ever shown to this
  // student and every sentence they've successfully used for it — survives across logins.
  return `word_history_${uid}`;
}

function loadProgress(uid) {
  try { return JSON.parse(sessionStorage.getItem(progressKey(uid))) || { sentences: {}, results: {} }; }
  catch { return { sentences: {}, results: {} }; }
}

function saveProgress(uid, sentences, results) {
  sessionStorage.setItem(progressKey(uid), JSON.stringify({ sentences, results }));
}

function loadHistory(uid) {
  try { return JSON.parse(localStorage.getItem(historyKey(uid))) || {}; }
  catch { return {}; }
}

function saveHistory(uid, history) {
  localStorage.setItem(historyKey(uid), JSON.stringify(history));
}

function pickRandom(arr, n) {
  const copy = [...arr];
  const picked = [];
  while (picked.length < n && copy.length) {
    picked.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return picked;
}

// Returns [{word, meaning, example, isReview}, ...] — a mix of past words (for review) and
// brand-new words, decided once per login session and cached for the rest of that session.
export async function getOrCreateWordsOfDay(user) {
  const key = sessionKey(user.id);
  const cached = sessionStorage.getItem(key);
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  const history = loadHistory(user.id);
  const knownWords = Object.keys(history);
  const reviewWords = pickRandom(knownWords, Math.min(REVIEW_COUNT, knownWords.length))
    .map(w => ({ word: w, meaning: history[w].meaning, example: history[w].example, isReview: true }));

  const newCount = TOTAL_COUNT - reviewWords.length;
  let newWords = [];
  if (newCount > 0) {
    const r = await generateWordsOfDay(user.profile, newCount, knownWords).catch(() => null);
    if (r?.type === "words_of_day" && r.words?.length) {
      newWords = r.words.map(w => ({ ...w, isReview: false }));
    }
  }

  const words = [...reviewWords, ...newWords];
  if (!words.length) return null;

  // Record/refresh these words in the persistent history (new words start with no sentences used yet).
  const updatedHistory = { ...history };
  for (const w of words) {
    const existing = updatedHistory[w.word];
    updatedHistory[w.word] = {
      meaning: w.meaning,
      example: w.example,
      sentencesUsed: existing?.sentencesUsed || [],
      timesShown: (existing?.timesShown || 0) + 1
    };
  }
  saveHistory(user.id, updatedHistory);

  sessionStorage.setItem(key, JSON.stringify(words));
  return words;
}

export function clearWordsOfDay(uid) {
  if (!uid) return;
  sessionStorage.removeItem(sessionKey(uid));
  sessionStorage.removeItem(progressKey(uid));
  // Note: word history in localStorage is intentionally NOT cleared here — it's meant to
  // persist across logins so review words and reuse-checking work over time.
}

function normalize(s) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isSentenceReused(uid, word, sentence) {
  const history = loadHistory(uid);
  const used = history[word]?.sentencesUsed || [];
  return used.some(s => normalize(s) === normalize(sentence));
}

function recordSentenceUsed(uid, word, sentence) {
  const history = loadHistory(uid);
  if (!history[word]) return;
  const used = history[word].sentencesUsed || [];
  if (!used.some(s => normalize(s) === normalize(sentence))) {
    history[word] = { ...history[word], sentencesUsed: [...used, sentence] };
    saveHistory(uid, history);
  }
}

// Picks up to `count` words the student learned in PAST sessions (excluding whatever's
// showing today, so they're not quizzed twice on the same word in one login) for a
// retrieval-practice recall check. Returns [] if there isn't enough history yet.
function getRecallWords(uid, excludeWords, count) {
  const history = loadHistory(uid);
  const candidates = Object.keys(history).filter(w => !excludeWords.includes(w));
  if (candidates.length < count) return [];
  return pickRandom(candidates, count).map(w => ({ word: w, meaning: history[w].meaning }));
}

export function RecallCheckCard({ user }) {
  const [recallWords, setRecallWords] = useState(null);
  const [guesses, setGuesses] = useState({});
  const [revealed, setRevealed] = useState({});
  const [selfMarks, setSelfMarks] = useState({}); // idx -> "got-it" | "review"
  const [pasteWarning, setPasteWarning] = useState({});

  useEffect(() => {
    if (!user.profile) return;
    (async () => {
      const today = await getOrCreateWordsOfDay(user); // already cached by now — no extra API call
      const todayWords = (today || []).map(w => w.word);
      setRecallWords(getRecallWords(user.id, todayWords, 3));
    })();
  }, [user.profile]);

  if (!recallWords?.length) return null; // not enough word history yet to quiz on

  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <h3 style={S.h3}>🧠 Remember These?</h3>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
        Words you learned before — try to recall the meaning before peeking!
      </p>
      {recallWords.map((w, i) => (
        <div key={w.word} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < recallWords.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.gold, marginBottom: 6 }}>{w.word}</div>
          <input style={{ ...S.input, fontSize: 13 }} placeholder="What do you think this means?"
            value={guesses[i] || ""} disabled={!!revealed[i]}
            onChange={e => setGuesses(g => ({ ...g, [i]: e.target.value }))}
            {...blockPasteProps(v => setPasteWarning(pw => ({ ...pw, [i]: v })))} />
          {pasteWarning[i] && <div style={{ marginTop: 6, fontSize: 12, color: C.warn }}>{PASTE_BLOCKED_MESSAGE}</div>}
          {!revealed[i] ? (
            <button style={{ ...S.btn("rgba(0,180,216,0.12)", C.teal), marginTop: 8, fontSize: 12, padding: "4px 10px" }}
              onClick={() => setRevealed(r => ({ ...r, [i]: true }))} disabled={!(guesses[i] || "").trim()}>
              Reveal Answer
            </button>
          ) : !selfMarks[i] ? (
            <>
              <div style={{ marginTop: 8, background: "rgba(0,180,216,0.08)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.sky }}>
                <strong style={{ color: C.gold }}>Actual meaning: </strong>{w.meaning}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={{ ...S.btn("rgba(82,183,136,0.15)", C.sage), fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setSelfMarks(s => ({ ...s, [i]: "got-it" }))}>✓ I got it right</button>
                <button style={{ ...S.btn("rgba(255,183,3,0.15)", C.warn), fontSize: 12, padding: "4px 10px" }}
                  onClick={() => setSelfMarks(s => ({ ...s, [i]: "review" }))}>🔁 Need more practice</button>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 8, fontSize: 12, color: selfMarks[i] === "got-it" ? C.sage : C.warn }}>
              {selfMarks[i] === "got-it" ? "✓ Nice, you remembered it!" : "🔁 That's okay — it'll come up again for more practice."}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function WordOfDayCard({ user }) {
  const [words, setWords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState({});
  const [results, setResults] = useState({});
  const [checking, setChecking] = useState({});
  const [reuseWarning, setReuseWarning] = useState({});
  const [pasteWarning, setPasteWarning] = useState({});

  useEffect(() => {
    // Right after login the app shows a placeholder user with profile:null while the
    // real profile loads in the background — wait for it instead of failing silently.
    if (!user.profile) { setLoading(true); return; }
    (async () => {
      setLoading(true);
      const w = await getOrCreateWordsOfDay(user);
      setLoading(false);
      setWords(w);
      const progress = loadProgress(user.id);
      setSentences(progress.sentences);
      setResults(progress.results);
    })();
  }, [user.profile]);

  const checkWord = async (i, word) => {
    const sentence = sentences[i] || "";
    if (isSentenceReused(user.id, word, sentence)) {
      setReuseWarning(w => ({ ...w, [i]: true }));
      return;
    }
    setReuseWarning(w => ({ ...w, [i]: false }));
    setChecking(c => ({ ...c, [i]: true }));
    const r = await evaluateVocabUsage(word, null, sentence).catch(() => null);
    setChecking(c => ({ ...c, [i]: false }));
    if (r?.type === "vocab_evaluation") {
      const nextResults = { ...results, [i]: r };
      setResults(nextResults);
      saveProgress(user.id, sentences, nextResults);
      if (r.correct) recordSentenceUsed(user.id, word, sentence);
      // Word of the Day itself only lives in browser storage — save a lightweight record
      // server-side too, purely so Admin can see the student engaged with it that day.
      savePracticeSet(user.id, { type: "wordofday", content: { word }, answers: { sentence }, score: r.correct ? 100 : 0 }).catch(() => {});
    }
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 16, color: C.gold }}>{w.word}</span>
            {w.isReview && <Badge color={C.purple}>🔁 Review</Badge>}
          </div>
          <div style={{ fontSize: 13, color: C.sky, marginBottom: 4 }}>{w.meaning}</div>
          <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", marginBottom: 8 }}>e.g. "{w.example}"</div>
          <input style={{ ...S.input, fontSize: 13 }} placeholder={`Write your own sentence using "${w.word}"...`}
            value={sentences[i] || ""} disabled={!!results[i]}
            onChange={e => {
              setReuseWarning(rw => ({ ...rw, [i]: false }));
              setSentences(s => {
                const next = { ...s, [i]: e.target.value };
                saveProgress(user.id, next, results);
                return next;
              });
            }}
            {...blockPasteProps(v => setPasteWarning(pw => ({ ...pw, [i]: v })))} />
          {pasteWarning[i] && <div style={{ marginTop: 6, fontSize: 12, color: C.warn }}>{PASTE_BLOCKED_MESSAGE}</div>}
          {reuseWarning[i] && (
            <div style={{ marginTop: 6, fontSize: 12, color: C.warn }}>
              🔁 You've already used that exact sentence for "{w.word}" before — try writing a new one!
            </div>
          )}
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
