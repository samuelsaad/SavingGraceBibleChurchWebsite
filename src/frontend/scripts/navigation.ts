/**
 * Masthead menus: every `[data-menu]` disclosure mirrors its open state to
 * aria-expanded, closes on Escape (returning focus to its toggle), on
 * focus leaving it, on a link activation and on a click outside, opens
 * with ArrowDown, and opening one closes the others. The Sermons menu keeps
 * its double-click shortcut to the archive. Native disclosure and ordinary
 * links remain usable without JavaScript.
 */
export const navigationScript = `(function () {
  var menus = Array.prototype.slice.call(document.querySelectorAll('[data-menu]'));
  if (!menus.length) return;
  menus.forEach(wireMenu);

  function closeOthers(except) {
    menus.forEach(function (other) {
      if (other !== except && other.open) { other.open = false; sync(other); }
    });
  }
  function sync(menu) {
    var toggle = menu.querySelector('summary');
    if (toggle) toggle.setAttribute('aria-expanded', String(menu.open));
  }

  function wireMenu(menu) {
    var toggle = menu.querySelector('summary');
    var links = menu.querySelectorAll('a[href]');
    var archive = menu.querySelector('[data-sermon-archive]');
    if (!toggle || !links.length) return;

    function close(returnFocus) {
      menu.open = false;
      sync(menu);
      if (returnFocus) toggle.focus();
    }
    menu.addEventListener('toggle', function () { sync(menu); if (menu.open) closeOthers(menu); });
    sync(menu);

    if (menu.hasAttribute('data-sermon-menu')) {
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
    }
    toggle.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown') return;
      event.preventDefault();
      menu.open = true;
      sync(menu);
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
  }

  document.addEventListener('click', function (event) {
    menus.forEach(function (menu) {
      if (menu.open && !menu.contains(event.target)) { menu.open = false; sync(menu); }
    });
  });
})();`;
