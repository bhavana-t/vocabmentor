// src/caaspp/pasteGuard.js — blocks pasting or drag-dropping text into fields where the
// student is meant to compose their own original writing (essays, outlines, sentence
// practice), so answers can't be copied in from another website or document.
export function blockPasteProps(setWarning) {
  const block = (e) => {
    e.preventDefault();
    setWarning(true);
    setTimeout(() => setWarning(false), 4000);
  };
  return { onPaste: block, onDrop: block };
}

export const PASTE_BLOCKED_MESSAGE = "🚫 Pasting isn't allowed here — please type your own words!";
