# UI polish
- [ ] Polish button and questionnaire states and progress.
- [ ] Highlight building hover and animate roof panel entrances.
- [ ] Animate results and verify mobile/desktop roof-to-report flow.

# Sample roof outline
- [x] Hand-traced 8-corner sample roof (~500 m², placeholder until exact coordinates arrive)
- [x] Dev-only "Copy outline coordinates" button (?dev=1)
- [x] Edit corners: drag midpoints to add, right-click to delete
- [x] "Try a sample roof" zooms to fit the roof outline

# Before/after slider
- [x] Two locked satellite maps of the real roof outline with a draggable/keyboard slider
- [x] Real solar panel layout (1.7 × 1.0 m, 0.6 m setback) and overlays for each upgrade
- [x] Loading, retry, too-small and missing-outline states

# Solar after-preview and budget
- [x] Remove the budget question and every budget scoring factor
- [x] Fill the roof outline with panels (min-area orientation, landscape/portrait, walkways, 3000 drawn cap)
- [x] Solar card numbers, note and coverage caption come from the drawn panel count

# Budget and recommended solar size
- [x] Budget question back (5 questions) with its scoring factor
- [x] Recommended size = min(roof max, need ~2.5 kW, budget), whole 400 W panels, at least 1
- [x] Budget options Low (~₹50k), Medium (~₹1.5L), High (~₹5L), Not sure (no cap)
- [x] Low/Medium/High size = what the budget buys (not capped at the typical need); Not sure = typical need
- [x] Editable roof-coverage percent drives panel count, numbers and drawn panels; "Above your budget" note; reset link

# Adjustable cost tile
- [x] Up/down stepper on the solar Cost tile (one panel per step, hold to repeat, Up/Down keys, 1 panel to roof max)
- [x] Linked to panel count, % of usable roof, all solar tiles, note, pill and drawn panels; numbers glide

# Subsidy and loan
- [x] Government subsidy card with a "What if" system size slider (1 panel to roof max, "Full subsidy" marker at 3 kW, live sentence, reset link) sharing the one panel count
- [x] "Pay with a bank loan" toggle: monthly EMI vs monthly saving, verdict line, loan interest and years in Advanced assumptions
- [x] Note in the Government subsidy card: how it is calculated, official sources with links, date last checked
- [x] "How is the bank loan calculated?" fold-out, shown only while the bank loan toggle is on

# Before you install section
- [x] Subsidy explainer box: three plain-language steps worked out with the chosen size, visible "Check it yourself" sources, last-checked line
- [x] Make the "Before you install" checklist more striking (numbered cards)
