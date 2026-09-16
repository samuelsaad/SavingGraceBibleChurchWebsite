/**
 * Styles emitted only by authenticated preview responses. Nothing here
 * reaches the static production build.
 */
export const previewStyles = `
.preview-band { display: flex; align-items: center; justify-content: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--colour-gilt-soft); color: var(--colour-ink); font-family: var(--font-signage); font-stretch: 87.5%; font-size: var(--size-small); font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; text-align: center; }
.preview-band .mark { width: 1.25rem; height: 1.25rem; }
@media print { .preview-band { display: none !important; } }
`;
