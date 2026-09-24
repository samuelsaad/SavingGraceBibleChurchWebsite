/**
 * Sermon page enhancement: click-to-load YouTube, print support and the
 * "On this page" rail's current-section marker.
 *
 * No request reaches YouTube until the visitor activates the button. The
 * video identifier is re-validated in the browser, the privacy-enhanced host
 * is used, autoplay is never requested, and focus moves into the player so
 * keyboard users are not dropped at the top of the document.
 */
import { videoLoaderSource } from "./video-loader";

export const sermonScript = `(function () {${videoLoaderSource}
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
