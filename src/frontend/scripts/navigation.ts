/**
 * Header navigation enhancement (authenticated preview only).
 *
 * The "Sermons" disclosure and the mobile "Menu" are native <details>
 * elements, so they open and close with a pointer, Enter and Space, and work
 * with no script at all. This enhancement adds the behaviours a native
 * disclosure lacks:
 *
 * - Escape closes the open disclosure and returns focus to its summary;
 * - focus leaving the disclosure, a link inside it being followed, or a
 *   pointer action outside it closes it without moving focus;
 * - closing the mobile menu also closes the Sermons accordion inside it;
 * - aria-expanded on each summary mirrors the open state for assistive
 *   technologies that do not expose the native state.
 */
export const navigationScript = `(function () {
  const disclosures = Array.from(document.querySelectorAll('details[data-nav-disclosure]'));
  const mobile = document.querySelector('details[data-mobile-nav]');

  function summaryOf(details) {
    return details.querySelector(':scope > summary');
  }

  function mirror(details) {
    const summary = summaryOf(details);
    if (summary) summary.setAttribute('aria-expanded', String(details.open));
  }

  function close(details, restoreFocus) {
    if (!details.open) return;
    details.open = false;
    mirror(details);
    if (restoreFocus) {
      const summary = summaryOf(details);
      if (summary) summary.focus();
    }
  }

  const all = mobile ? disclosures.concat([mobile]) : disclosures;
  for (const details of all) {
    mirror(details);
    details.addEventListener('toggle', function () {
      mirror(details);
      if (details === mobile && !mobile.open) {
        for (const inner of disclosures) if (mobile.contains(inner)) close(inner, false);
      }
    });
    details.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || event.defaultPrevented || !details.open) return;
      event.preventDefault();
      event.stopPropagation();
      close(details, true);
    });
    details.addEventListener('focusout', function () {
      queueMicrotask(function () {
        if (!details.contains(document.activeElement)) close(details, false);
      });
    });
    details.addEventListener('click', function (event) {
      if (event.target && event.target.closest && event.target.closest('a')) close(details, false);
    });
  }

  document.addEventListener('pointerdown', function (event) {
    for (const details of all) if (details.open && !details.contains(event.target)) close(details, false);
  });
})();`;
