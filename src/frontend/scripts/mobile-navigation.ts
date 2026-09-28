/** Progressive enhancement: no JavaScript leaves the complete navigation visible. */
export const mobileNavigationScript = `(function () {
  var header = document.querySelector('[data-site-header]');
  var toggle = document.querySelector('[data-site-toggle]');
  if (!header || !toggle) return;
  header.classList.add('masthead--compact');
  toggle.hidden = false;
  function setOpen(open, returnFocus) {
    toggle.setAttribute('aria-expanded', String(open));
    if (open) header.setAttribute('data-nav-open', '');
    else header.removeAttribute('data-nav-open');
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true', false); });
  header.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      event.preventDefault(); setOpen(false, true);
    }
  });
  document.addEventListener('click', function (event) {
    if (!header.contains(event.target)) setOpen(false, false);
  });
})();`;
