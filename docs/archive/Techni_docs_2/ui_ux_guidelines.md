Techni Docs / UI & UX Consistency
=================================

Goal
- Ensure all screens reuse the same visual language as the Meeting/Project forms: dark theme, consistent spacing, rounded corners, typography, focus/hover states.

Core Components
- Modal: header with title-left, close-right; dark surface, subtle border/shadow, padding; footer with secondary (ghost) + primary buttons aligned right.
- Form fields: `.form-group` (stack), `.form-label` (show * for required), `.form-input` / `.form-textarea` / `.form-select`; placeholder gentle hints.
- Buttons: `btn`, `btn--primary`, `btn--ghost`/`btn--secondary`, `btn--sm`; consistent height/radius/spacing.
- Grid: two-column sections use `form-row` when needed; otherwise single-column stack.

Patterns to Reuse
- Create flows: Meeting, Project, Document upload → same modal/container and input styling.
- Empty states: icon + title + description centered; consistent padding and muted text.
- Lists/tables: `admin-table` or `meeting-list` styles; avoid ad-hoc cards.
- Alerts: use existing `alert` classes for error/success.

Accessibility & Usability
- Keyboard focus visible; ensure tab order follows layout.
- Provide `aria-label` for icon-only buttons (close, refresh, delete).
- Text contrast ≥ WCAG AA on dark background.
- Avoid long inline scroll; set max-height for modals with internal scroll.

What to Fix Next (UI debt)
- Settings page: align fields to form components (labels, inputs) and add aria-labels.
- Meetings/Tasks type errors causing blank screens: resolve to keep UI stable.
- Replace remaining plain `input`/custom styles with standardized classes on all forms (Documents/PreMeet/PostMeet if any deviations).
- Add small loading states to modals (disabled submit + spinner text already used).
