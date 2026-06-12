// src/gemini.js
// ─────────────────────────────────────────────────────────────────────────────
// PASTE YOUR GEMINI API KEY BELOW
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

const SYSTEM = `You are VocabMentor, an intelligent adaptive English language tutor helping users build vocabulary, writing, speaking skills and confidence.

BEHAVIOR:
- Warm, encouraging, patient. Adapt tone to age/profile.
- For children: playful and motivating. For adults: professional and goal-focused.
- Never embarrass users — treat errors as learning opportunities.
- Always celebrate progress with specific praise.

CRITICAL: Always respond in valid JSON only. No markdown, no backticks, no preamble. Raw JSON only.`;

export async function callGemini(prompt) {
  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("Gemini error:", e);
    return { type: "error", message: e.message };
  }
}

// ── Lesson generation ─────────────────────────────────────────────────────────
export async function generateLesson(profile, lessonNum, day, skill) {
  const ctx = profile.type === "student"
    ? `Student: ${profile.name}, Age ${profile.age}, Grade ${profile.grade}, Level: ${profile.level}. Goal: ${profile.goal}. Interests: ${profile.interests || "general"}.`
    : `Adult: ${profile.name}, Age ${profile.age}, Career: ${profile.career}, Level: ${profile.level}. Goal: ${profile.goal}.`;

  return callGemini(`Generate a ${day === 1 ? "LEARN" : "PRACTICE"} lesson.
${ctx}
Lesson ${lessonNum}, Skill Focus: ${skill}, Day ${day} of 2.
${day === 2 ? "Practice day — reinforce Day 1 concepts with slightly harder exercises." : ""}

Respond with this exact JSON:
{
  "type": "lesson",
  "title": "string",
  "explanation": "string",
  "examples": ["string", "string", "string"],
  "exercises": [
    {"question":"string","type":"mcq","options":["a","b","c","d"],"answer":"string","hint":"string"},
    {"question":"string","type":"fill","answer":"string","hint":"string"},
    {"question":"string","type":"mcq","options":["a","b","c","d"],"answer":"string","hint":"string"},
    {"question":"string","type":"fill","answer":"string","hint":"string"}
  ],
  "vocabulary": [
    {"word":"string","phonetic":"string","meaning":"string","example":"string"},
    {"word":"string","phonetic":"string","meaning":"string","example":"string"},
    {"word":"string","phonetic":"string","meaning":"string","example":"string"},
    {"word":"string","phonetic":"string","meaning":"string","example":"string"},
    {"word":"string","phonetic":"string","meaning":"string","example":"string"}
  ],
  "speakingPrompt": "string",
  "readAloudPassage": "string (2-3 sentences appropriate for their level)",
  "encouragement": "string"
}`);
}

// ── Test generation ───────────────────────────────────────────────────────────
export async function generateTest(profile, lessonNum, attemptNum, skill) {
  const ctx = profile.type === "student"
    ? `Student: ${profile.name}, Grade ${profile.grade}, Level: ${profile.level}`
    : `Adult: ${profile.name}, Career: ${profile.career}, Level: ${profile.level}`;

  return callGemini(`Generate a formal TEST.
${ctx}
Lesson ${lessonNum}, Skill: ${skill}, Attempt ${attemptNum}.
${attemptNum > 1 ? "Use COMPLETELY DIFFERENT questions from previous attempts." : ""}

Respond with this exact JSON:
{
  "type": "test",
  "title": "string",
  "sections": {
    "knowledge": [
      {"question":"string","options":["a","b","c","d"],"answer":"string","explanation":"string"},
      {"question":"string","options":["a","b","c","d"],"answer":"string","explanation":"string"},
      {"question":"string","options":["a","b","c","d"],"answer":"string","explanation":"string"},
      {"question":"string","options":["a","b","c","d"],"answer":"string","explanation":"string"},
      {"question":"string","options":["a","b","c","d"],"answer":"string","explanation":"string"}
    ],
    "application": [
      {"question":"string","answer":"string","explanation":"string"},
      {"question":"string","answer":"string","explanation":"string"},
      {"question":"string","answer":"string","explanation":"string"},
      {"question":"string","answer":"string","explanation":"string"},
      {"question":"string","answer":"string","explanation":"string"}
    ],
    "writing": {
      "prompt": "string",
      "minWords": 50,
      "criteria": ["grammar","vocabulary","structure","clarity"]
    },
    "speaking": {
      "passage": "string (3-4 sentences at their level)",
      "prompt": "string"
    }
  }
}`);
}

// ── Evaluation ────────────────────────────────────────────────────────────────
export async function evaluateSubmission(profile, skill, answers, isTest = false) {
  return callGemini(`Evaluate this ${isTest ? "TEST" : "exercise"} submission.
Profile: ${profile.type}, Level: ${profile.level}, Skill: ${skill}

Knowledge answers: ${JSON.stringify(answers.knowledge || [])}
Application answers: ${JSON.stringify(answers.application || [])}
Writing response: ${answers.writing || "(none)"}
Speaking transcript: ${answers.speaking || "(none)"}

${isTest ? "Score each section 0-100. Pass = 75%+ overall AND no section below 60%." : "Give encouraging feedback on exercises."}

Respond with this exact JSON:
{
  "type": "evaluation",
  "scores": {"knowledge": 0, "application": 0, "writing": 0, "speaking": 0, "total": 0},
  "passed": true,
  "feedback": {
    "strengths": ["string", "string"],
    "improvements": ["string", "string"],
    "corrections": [
      {"original": "string", "corrected": "string", "explanation": "string"}
    ]
  },
  "encouragement": "string"
}`);
}

// ── Assessment ────────────────────────────────────────────────────────────────
export async function assessLevel(profile, answers) {
  const ctx = profile.type === "student"
    ? `Student: Age ${profile.age}, Grade ${profile.grade}. Goal: ${profile.goal}.`
    : `Adult: Age ${profile.age}, Career: ${profile.career}. Goal: ${profile.goal}.`;

  return callGemini(`Assess this ${profile.type}'s English level.
Profile: ${ctx}
Assessment answers: ${JSON.stringify(answers)}

Respond with this exact JSON:
{
  "type": "assessment",
  "level": "Beginner|Elementary|Intermediate|Upper-Intermediate|Advanced",
  "strengths": ["string", "string"],
  "areasToImprove": ["string", "string"],
  "recommendedPath": "string",
  "encouragement": "string"
}`);
}

// ── Essay topic generation ────────────────────────────────────────────────────
export async function generateEssayTopic(profile) {
  const ctx = profile.type === "student"
    ? `Student: Grade ${profile.grade}, Age ${profile.age}, Interests: ${profile.interests || "general topics"}, Level: ${profile.level}`
    : `Adult: Career: ${profile.career}, Goal: ${profile.goal}, Level: ${profile.level}`;

  return callGemini(`Generate an essay topic and resources for:
${ctx}

For students: Pick from current affairs, grade-appropriate topics, or their interests.
For adults: Pick a topic directly relevant to their career/goal (e.g. professional report, case study, reflection).

Respond with this exact JSON:
{
  "type": "essay_topic",
  "title": "string (essay title/prompt)",
  "background": "string (2-3 sentences of context about the topic)",
  "instructions": "string (what to write, structure guidance)",
  "minWords": 150,
  "maxWords": 400,
  "structure": {
    "introduction": "string (what to cover in intro)",
    "body": "string (what to cover in body paragraphs)",
    "conclusion": "string (what to cover in conclusion)"
  },
  "resources": [
    {"title": "string", "searchQuery": "string (google search query to find this)", "description": "string (what they will learn from this resource)", "type": "article|video|wikipedia"},
    {"title": "string", "searchQuery": "string", "description": "string", "type": "article|video|wikipedia"},
    {"title": "string", "searchQuery": "string", "description": "string", "type": "article|video|wikipedia"},
    {"title": "string", "searchQuery": "string", "description": "string", "type": "article|video|wikipedia"}
  ],
  "reminderDays": 2,
  "encouragement": "string"
}`);
}

// ── Essay evaluation ──────────────────────────────────────────────────────────
export async function evaluateEssay(profile, topic, essayText, isResubmission = false, firstEssay = null) {
  return callGemini(`Evaluate this essay submission.
Profile: ${profile.type}, Grade/Career: ${profile.type === "student" ? profile.grade : profile.career}, Level: ${profile.level}
Topic: ${topic}
Essay: ${essayText}
${isResubmission && firstEssay ? `This is a RESUBMISSION. First essay was: "${firstEssay}". Compare improvement.` : "This is the FIRST submission."}

Respond with this exact JSON:
{
  "type": "essay_evaluation",
  "scores": {
    "structure": 0,
    "grammar": 0,
    "vocabulary": 0,
    "argument": 0,
    "clarity": 0,
    "overall": 0
  },
  "grade": "A|B|C|D|F",
  "summary": "string (2-3 sentence overall feedback)",
  "strengths": ["string", "string", "string"],
  "improvements": ["string", "string", "string"],
  "corrections": [
    {"original": "string (exact phrase from essay)", "corrected": "string", "explanation": "string"},
    {"original": "string", "corrected": "string", "explanation": "string"},
    {"original": "string", "corrected": "string", "explanation": "string"}
  ],
  "improvedVersion": "string (a model paragraph showing how one section could be improved)",
  "improvementFromFirst": ${isResubmission ? '"string (specific comparison of what improved)"' : "null"},
  "readyToMove": true,
  "encouragement": "string"
}`);
}
