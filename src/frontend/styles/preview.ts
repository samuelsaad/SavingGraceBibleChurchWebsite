/**
 * Styles emitted only by authenticated preview responses. Nothing here
 * reaches the static production build.
 */
export const previewStyles = `
.preview-banner { padding: var(--space-2) var(--space-4); background: var(--colour-ember); color: var(--colour-on-ink); text-align: center; font-size: var(--size-sm); font-weight: 600; }
@media print { .preview-banner { display: none !important; } }
`;
