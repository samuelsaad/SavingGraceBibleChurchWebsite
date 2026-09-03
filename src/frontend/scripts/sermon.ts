/**
 * Sermon page enhancement: click-to-load YouTube, print support and the
 * "On this page" rail's current-section marker.
 *
 * No request reaches YouTube until the visitor activates the button. The
 * video identifier is re-validated in the browser, the privacy-enhanced host
 * is used, autoplay is never requested, and focus moves into the player so
 * keyboard users are not dropped at the top of the document.
 */
export const sermonScript = `(function () {
  var loaders = document.querySelectorAll('[data-load-youtube]');
  for (var index = 0; index < loaders.length; index += 1) wireLoader(loaders[index]);

  function wireLoader(button) {
    button.addEventListener('click', function () {
      var frame = button.closest('[data-video-frame]');
      var id = button.getAttribute('data-video-id') || '';
      var title = button.getAttribute('data-video-title') || 'Sermon video';
      if (!frame || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id;
      iframe.title = title;
      iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = 0;
      var status = document.createElement('p');
      status.className = 'plate__status';
      status.setAttribute('role', 'status');
      status.textContent = 'Loading the video player…';
      iframe.addEventListener('load', function () {
        status.remove();
        frame.setAttribute('data-video-loaded', 'true');
      });
      frame.replaceChildren(status, iframe);
      frame.setAttribute('data-video-loaded', 'loading');
      iframe.focus();
    });
  }

  /* ---- transcript opens for printing, then returns to its previous state ---- */
  var printable = Array.prototype.slice.call(document.querySelectorAll('details[data-open-for-print]'));
  var reopened = [];
  window.addEventListener('beforeprint', function () {
    reopened = printable.filter(function (details) { return !details.open; });
    for (var index = 0; index < reopened.length; index += 1) reopened[index].open = true;
  });
  window.addEventListener('afterprint', function () {
    for (var index = 0; index < reopened.length; index += 1) reopened[index].open = false;
    reopened = [];
  });

  /* ---- "On this page": mark the section currently in view ---- */
  var rail = document.querySelector('[data-contents]');
  if (rail && 'IntersectionObserver' in window) {
    var links = Array.prototype.slice.call(rail.querySelectorAll('a[href^="#"]'));
    var targets = links.map(function (link) { return document.getElementById(link.getAttribute('href').slice(1)); }).filter(Boolean);
    var visible = new Map();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible.set(entry.target, entry.isIntersecting); });
      var first = targets.find(function (target) { return visible.get(target); });
      links.forEach(function (link) {
        var isCurrent = first && link.getAttribute('href') === '#' + first.id;
        if (isCurrent) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }, { rootMargin: '-10% 0px -70% 0px' });
    targets.forEach(function (target) { observer.observe(target); });
  }
})();`;
