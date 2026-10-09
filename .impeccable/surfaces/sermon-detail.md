---
target: src/frontend/pages/sermon.ts
mode: read
---

## Thesis
Keep the approved sermon easy to read and let visitors choose when to reveal
each reflection answer. Retain the incumbent Claude sermon reading room.

## Interaction
Independent light Show answer/Hide answer controls use the existing type,
spacing, focus and 44-pixel target vocabulary. Answers are complete
server-rendered content, readable without JavaScript and included when printing.
Keep Arabic question/answer direction; English controls declare their language.
Separate outbound provider buttons are absent; existing media controls remain.

## Finish
Bounded anonymous desktop/mobile captures inspected; 21 offline browser cases
passed. Final finish verdict: ship. No remaining scoped design defects.

## Answer motion refinement
The focal interaction is a reading panel that unfolds directly beneath its
question: a bounded grid-row reveal preserves the relationship and page flow.
Use 240ms ease-out on arrival and 180ms on closing, with a small chevron turn
and immediate Show/Hide feedback. Keep controls light and aligned with the
question text. No loops, blur, dependencies or page-load effects. Reduced motion
uses immediate layout and control-state feedback. Repeated
activation reverses cleanly; printing cancels motion and restores prior states.
Transcripts start closed, but their shortcut explicitly opens them.
