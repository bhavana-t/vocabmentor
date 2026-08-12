// src/gemini-caaspp.js
// ─────────────────────────────────────────────────────────────────────────────
// CAASPP-specific Gemini prompt functions, kept separate from gemini.js so the
// core essay/lesson/test grading calls aren't crowded by this module's growth.
// Reuses the same callGemini() transport (retry/timeout/JSON-parse handling).
// ─────────────────────────────────────────────────────────────────────────────
import { callGemini } from "./gemini";

function profileCtx(profile) {
  return profile.type === "student"
    ? `Grade ${profile.grade}, Level: ${profile.level}, Interests: ${profile.interests || "general"}`
    : `${profile.career}, Level: ${profile.level}`;
}

// ── Evidence & Elaboration trainer ──────────────────────────────────────────
export async function generateEvidenceExercise(profile, topicTitle = null) {
  const topicCtx = topicTitle
    ? `Base the passages/claims on this topic if possible: "${topicTitle}".`
    : "Pick an age-appropriate, engaging topic.";

  return callGemini(`Create a short Evidence & Elaboration practice set for a ${profileCtx(profile)} student, in the style of CAASPP performance tasks.
${topicCtx}

Create 3 separate claim+evidence exercises. For each: give a short passage (2-4 sentences) and a claim, then present 4 possible pieces of evidence — only ONE is the strongest, most relevant support for the claim. The other 3 should be plausible-sounding but weaker (off-topic, too vague, or unrelated).

Respond with this exact JSON:
{
  "type": "evidence_set",
  "exercises": [
    {
      "type": "mcq",
      "passage": "string (2-4 sentence short passage)",
      "claim": "string (the claim the evidence should support)",
      "question": "Which piece of evidence BEST supports this claim?",
      "options": ["string", "string", "string", "string"],
      "answer": "string (must exactly match one of the options)",
      "explanation": "string (plain-language explanation of why the correct answer is strongest, and briefly why the others are weaker)"
    },
    {"type":"mcq","passage":"string","claim":"string","question":"Which piece of evidence BEST supports this claim?","options":["string","string","string","string"],"answer":"string","explanation":"string"},
    {"type":"mcq","passage":"string","claim":"string","question":"Which piece of evidence BEST supports this claim?","options":["string","string","string","string"],"answer":"string","explanation":"string"}
  ],
  "encouragement": "string"
}`);
}

// ── Conventions micro-quizzes ───────────────────────────────────────────────
const CONVENTION_FOCUS_AREAS = ["Subject-Verb Agreement", "Punctuation", "Capitalization", "Run-ons & Fragments"];

export async function generateConventionsQuiz(profile, cycleIndex = 0) {
  const focusArea = CONVENTION_FOCUS_AREAS[cycleIndex % CONVENTION_FOCUS_AREAS.length];

  return callGemini(`Create a short (2-3 minute) Conventions practice quiz for a ${profileCtx(profile)} student, targeting common CAASPP-level error types.
Focus this quiz specifically on: ${focusArea}.

Create 5 quick questions mixing types: some multiple-choice (pick the corrected sentence, or identify the error), some fill-in-the-blank. Keep sentences short and age-appropriate.

Respond with this exact JSON:
{
  "type": "conventions_quiz",
  "focusArea": "${focusArea}",
  "exercises": [
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string (must exactly match one option)", "explanation": "string (brief plain-language rule)"},
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string", "explanation": "string"},
    {"type": "fill", "question": "string", "answer": "string", "explanation": "string"},
    {"type": "fill", "question": "string", "answer": "string", "explanation": "string"},
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string", "explanation": "string"}
  ],
  "encouragement": "string"
}`);
}

// ── Real-time convention flagging during essay drafting ────────────────────
export async function checkConventions(text) {
  if (!text || text.trim().split(/\s+/).length < 15) return { type: "conventions_check", issues: [] };
  return callGemini(`Quickly scan this in-progress essay draft for CAASPP-level convention errors ONLY (subject-verb agreement, punctuation, capitalization, run-on sentences, sentence fragments). Do NOT comment on content, structure, or word choice — conventions only. This is a lightweight check while the student is still writing, so only flag clear, confident errors (max 5), not stylistic nitpicks.

Draft:
${text}

Respond with this exact JSON:
{
  "type": "conventions_check",
  "issues": [
    {"quote": "string (short exact phrase from the draft with the error)", "explanation": "string (one plain-language sentence: what's wrong and how to fix it)"}
  ]
}`);
}

// ── Reading comprehension & synthesis passage sets ──────────────────────────
export async function generatePassageSet(profile, pastMistakes = null) {
  const focusArea = pastMistakes?.weakSections?.length ? pastMistakes.weakSections[0] : null;
  const focusCtx = focusArea ? `\nThe student has been weak in: ${focusArea}. If relevant, let the synthesis topic give them a chance to practice that.` : "";

  return callGemini(`Create a CAASPP-style multi-source reading + synthesis writing task for a ${profileCtx(profile)} student.
${focusCtx}

Two short, related passages (150-250 words each) on the same topic but offering different angles, facts, or perspectives — the kind that requires combining information from both to write well. Then a short comprehension check (3-4 multiple choice questions, testing understanding of each passage individually), then a synthesis essay prompt that explicitly requires using information from BOTH passages.

Respond with this exact JSON:
{
  "type": "passage_set",
  "passages": [
    {"title": "string", "text": "string (150-250 word passage)"},
    {"title": "string", "text": "string (150-250 word passage, related but distinct angle)"}
  ],
  "comprehensionCheck": [
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string", "explanation": "string"},
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string", "explanation": "string"},
    {"type": "mcq", "question": "string", "options": ["string","string","string","string"], "answer": "string", "explanation": "string"}
  ],
  "synthesisTopic": {
    "type": "essay_topic",
    "title": "string (essay title/prompt requiring both passages)",
    "background": "string (2-3 sentences framing the task)",
    "instructions": "string (must explicitly say to use evidence from BOTH passages)",
    "minWords": 150,
    "maxWords": 400,
    "structure": {
      "introduction": "string",
      "body": "string (should mention combining evidence from both passages)",
      "conclusion": "string"
    },
    "resources": [],
    "reminderDays": 2,
    "focusPoint": null,
    "encouragement": "string"
  }
}`);
}

// ── Argument vocabulary in context ──────────────────────────────────────────
export async function evaluateVocabUsage(word, topicTitle, sentence) {
  if (!sentence || !sentence.trim()) {
    return { type: "vocab_evaluation", correct: false, feedback: "Write a sentence first!" };
  }
  return callGemini(`A student is practicing using the word "${word}" correctly in a sentence about this essay topic: "${topicTitle}".

Their sentence: "${sentence}"

Check: does the sentence use "${word}" with the right meaning and correct grammatical form, and is it relevant to the essay topic?

Respond with this exact JSON:
{
  "type": "vocab_evaluation",
  "correct": true,
  "feedback": "string (short, encouraging, specific feedback — if incorrect, explain what's off and show a quick corrected example)"
}`);
}
