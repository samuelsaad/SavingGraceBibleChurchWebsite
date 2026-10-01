import { font } from "../tokens";

/** One measured shelf geometry for every archive, including the scoped V4 body.
 * Reserve a separate count row; never clip a label to disguise a sizing defect.
 * Use the delivered church font, not platform-dependent condensed faces.
 */
export function bookshelfLayoutStyles(scope = ""): string {
  return `
${scope}.shelf { --spine-base: 2rem; --spine-height: 9.5rem; }
${scope}.spine__link, ${scope}.spine__ghost { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; justify-content: stretch; justify-items: center; align-items: start; gap: 0.375rem; padding: 0.5rem 0.125rem; }
${scope}.spine__name, ${scope}.spine__abbr { min-height: 0; font-family: ${font.signage}; font-stretch: normal; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.06em; }
${scope}.spine__count { align-self: end; width: max-content; min-height: 1.125rem; height: auto; padding: 0.125rem 0.1875rem; white-space: nowrap; font-family: ${font.signage}; font-stretch: normal; font-size: 0.8125rem; font-weight: 700; line-height: 1; }
${scope}.bookend span { font-family: ${font.signage}; font-stretch: normal; }
@media (max-width: 60rem) {
  ${scope}.shelf { --spine-height: 7rem; }
  ${scope}.spine[data-len="mid"] .spine__name { display: none; }
  ${scope}.spine[data-len="mid"] .spine__abbr { display: block; }
}
@media (max-width: 44rem) {
  ${scope}.shelf { --spine-base: 2rem; --spine-height: 5rem; }
  ${scope}.spine__link, ${scope}.spine__ghost { padding: 0.375rem 0.125rem; gap: 0.25rem; }
}
@media (pointer: coarse) {
  ${scope}.shelf { --spine-base: 2.75rem; --spine-k: 0rem; }
}
`;
}
