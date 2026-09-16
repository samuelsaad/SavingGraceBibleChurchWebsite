/** Native disclosure and ordinary links remain usable without JavaScript. */
export const navigationScript = `(function () {
  var menu = document.querySelector('[data-sermon-menu]');
  if (!menu) return;
  var toggle = menu.querySelector('summary');
  var links = menu.querySelectorAll('a[href]');
  var archive = menu.querySelector('[data-sermon-archive]');
  if (!toggle || !links.length) return;

  function sync() { toggle.setAttribute('aria-expanded', String(menu.open)); }
  function close(returnFocus) {
    menu.open = false;
    sync();
    if (returnFocus) toggle.focus();
  }
  menu.addEventListener('toggle', sync);
  sync();

  // Native single activation opens immediately. The second pointer click
  // must not toggle it closed before the double-click shortcut is handled.
  toggle.addEventListener('click', function (event) {
    if (event.detail > 1) event.preventDefault();
  });
  toggle.addEventListener('dblclick', function (event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (archive) window.location.assign(archive.href);
  });
  toggle.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    menu.open = true;
    sync();
    links[0].focus();
  });
  menu.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.open) {
      event.preventDefault();
      close(true);
    }
  });
  menu.addEventListener('focusout', function (event) {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) close(false);
  });
  menu.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('a[href]')) close(false);
  });
  document.addEventListener('click', function (event) {
    if (menu.open && !menu.contains(event.target)) close(false);
  });
})();`;
