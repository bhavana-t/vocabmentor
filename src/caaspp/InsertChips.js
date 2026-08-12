// src/caaspp/InsertChips.js — reusable tap-to-insert word/phrase chip bank.
// Used for transition words, sentence starters, and argument vocabulary in the essay writing stage.
import { C, S } from "../App";

// Inserts `text` at the current cursor position of the given textarea ref, returns the new value.
// Falls back to appending at the end if the ref isn't attached yet.
export function insertAtCursor(textareaRef, currentValue, textToInsert) {
  const el = textareaRef?.current;
  const value = currentValue || "";
  if (!el) {
    const needsSpace = value.length > 0 && !/\s$/.test(value);
    return value + (needsSpace ? " " : "") + textToInsert + " ";
  }
  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const insertion = (needsSpaceBefore ? " " : "") + textToInsert + " ";
  const newValue = before + insertion + after;
  requestAnimationFrame(() => {
    const pos = (before + insertion).length;
    el.focus();
    el.setSelectionRange(pos, pos);
  });
  return newValue;
}

// groups: [{ heading, items: [string] }, ...]
export function InsertChips({ label, hint, groups, textareaRef, value, onInsert }) {
  if (!groups?.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: C.sky, marginBottom: 4 }}>{label}</div>}
      {hint && <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{hint}</div>}
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginBottom: 8 }}>
          {g.heading && <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{g.heading}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {g.items.map((item, i) => (
              <button key={i} type="button"
                onClick={() => onInsert(insertAtCursor(textareaRef, value, item))}
                style={{ ...S.btn("rgba(0,180,216,0.12)", C.teal), padding: "4px 10px", fontSize: 12, border: `1px solid ${C.teal}44` }}>
                + {item}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
