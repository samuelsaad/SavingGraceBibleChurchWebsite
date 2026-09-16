/**
 * Archive enhancement for the Canon: keyboard grids for the shelf and the
 * chapter/verse rulers, focus placement after a search, and disclosure
 * restoration on browser history navigation.
 *
 * Every spine and ruler cell is an ordinary link that performs its search on
 * the server, so nothing here is required for the site to work. With this
 * script each grid becomes one Tab stop: Arrow keys move between links, Home
 * and End jump, Space activates a link, and Escape moves focus to the grid's
 * escape target (its skip link). Skip links and captions stay ordinary Tab
 * stops. Search forms drop empty and default fields on submit so shared URLs
 * stay short; the server accepts either shape.
 */
export const canonScript = `(function () {
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- disclosure restoration on back/forward ---- */
  function restoreDisclosures() {
    var open = document.querySelectorAll('details[data-active="true"]');
    for (var index = 0; index < open.length; index += 1) open[index].open = true;
    var disabled = document.querySelectorAll('form[role="search"] [data-was-disabled]');
    for (var d = 0; d < disabled.length; d += 1) {
      disabled[d].disabled = false;
      disabled[d].removeAttribute('data-was-disabled');
    }
  }
  window.addEventListener('pageshow', restoreDisclosures);
  restoreDisclosures();

  /* ---- tidy search URLs: leave empty and default fields out of the query ---- */
  var forms = document.querySelectorAll('form[role="search"]');
  for (var f = 0; f < forms.length; f += 1) {
    forms[f].addEventListener('submit', function (event) {
      var fields = event.target.querySelectorAll('input[name], select[name]');
      for (var index = 0; index < fields.length; index += 1) {
        var field = fields[index];
        if (field.type === 'hidden' || field.disabled) continue;
        var isDefault = field.value === '' || (field.name === 'order' && field.value === 'DESC');
        if (isDefault) {
          field.disabled = true;
          field.setAttribute('data-was-disabled', 'true');
        }
      }
    });
  }

  /* ---- focus placement after a search or passage step ---- */
  var hash = window.location.hash;
  if (hash === '#results') {
    var results = document.getElementById('results');
    if (results) results.focus({ preventScroll: true });
  } else if (hash === '#canon') {
    var current = document.querySelector('[data-canon-grid] [aria-current="true"]');
    if (current) current.focus({ preventScroll: true });
  }

  /* ---- roving keyboard grids ---- */
  var grids = document.querySelectorAll('[data-canon-grid]');
  for (var g = 0; g < grids.length; g += 1) wireGrid(grids[g]);

  function wireGrid(grid) {
    var links = Array.prototype.slice.call(grid.querySelectorAll('.shelf__row a[href], .ruler a[href]'));
    if (!links.length) return;
    var start = grid.querySelector('a[aria-current="true"]') || links[0];
    for (var index = 0; index < links.length; index += 1) links[index].tabIndex = links[index] === start ? 0 : -1;

    function move(target) {
      for (var index = 0; index < links.length; index += 1) links[index].tabIndex = -1;
      target.tabIndex = 0;
      target.focus();
    }

    function columns() {
      var first = links[0].getBoundingClientRect();
      var count = 1;
      for (var index = 1; index < links.length; index += 1) {
        if (Math.abs(links[index].getBoundingClientRect().top - first.top) < 2) count += 1;
        else break;
      }
      return count;
    }

    grid.addEventListener('keydown', function (event) {
      var link = event.target.closest ? event.target.closest('a[href]') : null;
      if (!link || links.indexOf(link) === -1) return;
      var index = links.indexOf(link);
      var next = index;
      switch (event.key) {
        case 'ArrowRight': next = index + 1; break;
        case 'ArrowLeft': next = index - 1; break;
        case 'ArrowDown': next = index + columns(); break;
        case 'ArrowUp': next = index - columns(); break;
        case 'Home': next = 0; break;
        case 'End': next = links.length - 1; break;
        case ' ': event.preventDefault(); link.click(); return;
        case 'Escape': {
          var escapeId = grid.getAttribute('data-escape-to');
          var escapeTarget = escapeId ? document.getElementById(escapeId) : null;
          if (escapeTarget) { event.preventDefault(); escapeTarget.focus(); }
          return;
        }
        default: return;
      }
      event.preventDefault();
      if (next < 0 || next >= links.length || next === index) return;
      move(links[next]);
    });
  }

  /* ---- smooth in-page scrolling only when motion is welcome ---- */
  if (reducedMotion.matches) document.documentElement.style.scrollBehavior = 'auto';
})();`;
