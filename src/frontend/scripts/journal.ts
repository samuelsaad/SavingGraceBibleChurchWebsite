/** V5 description-only enhancement. Full descriptions remain readable without JS. */
export const journalScript = `(function () {
  var buttons = document.querySelectorAll('.v5 .journal__toggle');
  var refreshers = [];
  for (var index = 0; index < buttons.length; index += 1) wire(buttons[index]);
  function wire(button) {
    var description = document.getElementById(button.getAttribute('aria-controls'));
    var label = button.querySelector('[data-description-label]');
    if (!description || !label) return;
    function refresh() {
      if (button.getAttribute('aria-expanded') === 'true') return;
      description.classList.add('is-collapsed');
      button.hidden = description.scrollHeight <= description.clientHeight + 1;
      if (button.hidden) description.classList.remove('is-collapsed');
    }
    button.addEventListener('click', function () {
      var expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      description.classList.toggle('is-collapsed', !expanded);
      label.textContent = expanded ? 'See less' : 'See more';
    });
    refreshers.push(refresh);
    refresh();
  }
  function refreshAll() { for (var i = 0; i < refreshers.length; i += 1) refreshers[i](); }
  if (document.fonts) document.fonts.ready.then(refreshAll);
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 100);
  });
})();`;

