// src/caaspp/wordBanks.js — curated word banks surfaced as click-to-insert chips in the essay loop.
// Plain data only, no React/App.js dependency.

export const TRANSITION_WORDS = [
  { heading: "Add an idea", items: ["furthermore", "in addition", "moreover", "also"] },
  { heading: "Show contrast", items: ["in contrast", "however", "on the other hand", "although"] },
  { heading: "Cause & effect", items: ["as a result", "therefore", "because of this", "consequently"] },
  { heading: "Give an example", items: ["for example", "for instance", "specifically", "such as"] }
];

export const SENTENCE_STARTERS = [
  { heading: "Explain your evidence", items: [
    "This shows that",
    "This supports the idea that",
    "This is important because",
    "This proves that",
    "In other words,"
  ] }
];

export const ARGUMENT_VOCAB = [
  { heading: "Strengthen your argument", items: [
    "assert", "claim", "evidence", "counterargument", "persuade",
    "consequently", "undermine", "corroborate", "significant", "credible"
  ] }
];
