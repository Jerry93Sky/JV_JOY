# JV workspace UX — PR_15C

The existing editor remains the owner of verified selectors, slots, quantities, and calculation request lifecycle. The right-hand result uses the JV-RESULT-1 contract and invalidates immediately when the editor changes. Calculation is temporary; there is no persistent order save and Ctrl+S must not imply persistence.

## Audit and next steps

Current editor is a long single column that repeats complete forms for every position. This is usable on desktop but not the requested precision workspace. Split it into a slot list, active position form, and result pane while retaining unique slot constraints, verified Front door locks, option metadata and existing API lifecycle. At medium width use a collapsible result; at mobile use tabs and keep hidden panels unmounted.

Keyboard navigation should follow native focus order; add explicit shortcuts only with conflict/permission checks and visible help. Undo/redo needs a bounded draft-only history which never restores a calculation response. Neither command search, reorder controls, nor undo/redo are implemented in this stage yet. Avoid pretending a draft is persisted.
