/**
 * Sermon page enhancement: click-to-load YouTube, print support and the
 * "On this page" rail's current-section marker.
 *
 * No request reaches YouTube until the visitor activates the button. The
 * video identifier is re-validated in the browser, the privacy-enhanced host
 * is used, explicit play shortcuts request playback, and focus moves into the player so
 * keyboard users are not dropped at the top of the document.
 */
import { videoLoaderSource } from "./video-loader";
import { audioLoaderSource } from './audio-loader';

export const sermonScript = `(function () {${videoLoaderSource}${audioLoaderSource}
  /* ---- independent, reversible answer reveals; all content is already in HTML ---- */
  var answerControls = [];
  function setAnswer(control, expanded, animate) {
    var answer = control.answer;
    window.clearTimeout(control.timer);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var instant = !animate || reduce;
    if (instant) answer.setAttribute('data-answer-instant', '');
    control.button.setAttribute('aria-expanded', String(expanded));
    control.label.textContent = expanded ? 'Hide answer' : 'Show answer';
    answer.inert = !expanded;
    if (expanded) {
      answer.removeAttribute('aria-hidden');
      answer.hidden = false;
      // Establish the closed grid before opening it; reversals retain current height.
      if (!answer.hasAttribute('data-answer-open')) void answer.offsetHeight;
      answer.setAttribute('data-answer-open', '');
    } else {
      answer.setAttribute('aria-hidden', 'true');
      answer.removeAttribute('data-answer-open');
      if (instant) answer.hidden = true;
      else control.timer = window.setTimeout(function () {
        if (control.button.getAttribute('aria-expanded') !== 'true') answer.hidden = true;
      }, 260);
    }
    if (instant) {
      if (expanded) void answer.offsetHeight;
      answer.removeAttribute('data-answer-instant');
    }
  }
  document.querySelectorAll('[data-toggle-answer]').forEach(function (button) {
    var answer = document.getElementById(button.getAttribute('aria-controls') || '');
    var label = button.querySelector('[data-answer-label]');
    if (!answer || !label || button.closest('.question') !== answer.closest('.question')) return;
    var control = {button: button, answer: answer, label: label, timer: null};
    answer.setAttribute('data-answer-ready', '');
    setAnswer(control, false, false);
    button.hidden = false;
    button.addEventListener('click', function () {
      setAnswer(control, button.getAttribute('aria-expanded') !== 'true', true);
    });
    answer.addEventListener('transitionend', function (event) {
      if (event.target === answer && event.propertyName === 'grid-template-rows' && button.getAttribute('aria-expanded') !== 'true') {
        window.clearTimeout(control.timer);
        answer.hidden = true;
      }
    });
    answerControls.push(control);
  });
  var printAnswerStates = null;
  window.addEventListener('beforeprint', function () {
    if (printAnswerStates !== null) return;
    printAnswerStates = answerControls.map(function (control) {
      return {control: control, expanded: control.button.getAttribute('aria-expanded') === 'true'};
    });
    answerControls.forEach(function (control) { setAnswer(control, true, false); });
  });
  window.addEventListener('afterprint', function () {
    if (printAnswerStates === null) return;
    printAnswerStates.forEach(function (state) { setAnswer(state.control, state.expanded, false); });
    printAnswerStates = null;
  });

  /* ---- explicit media shortcuts and transcript deep links ---- */
  function reveal(target) {
    if (!target) return;
    target.scrollIntoView({block: 'start', behavior: 'instant'});
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll: true});
  }
  function unavailable(label) {
    var target = document.getElementById('sermon-shortcut-status');
    if (!target) {
      target = document.createElement('p');
      target.id = 'sermon-shortcut-status';
      target.className = 'sermon-section note';
      target.setAttribute('role', 'status');
      var body = document.querySelector('.sermon__body');
      if (!body) return;
      var next = document.getElementById('watch') || document.getElementById('transcript') || document.getElementById('questions');
      body.insertBefore(target, next);
    }
    target.textContent = label + ' is not available for this sermon.';
    reveal(target);
  }
  function openTranscript() {
    var section = document.getElementById('transcript');
    if (!section) { unavailable('Transcript'); return; }
    section.querySelectorAll('details').forEach(function (details) { details.open = true; });
    reveal(document.getElementById('transcript-heading') || section);
  }
  function requestedContent() {
    var action = window.location.hash;
    if (action === '#transcript' || action === '#transcript-heading') { openTranscript(); return; }
    if (action !== '#play-audio' && action !== '#play-video') return;
    var audio = action === '#play-audio';
    var frame = document.querySelector(audio ? '[data-audio-frame]' : '[data-video-frame]');
    var button = frame && frame.querySelector(audio ? '[data-load-sermonaudio]' : '[data-load-youtube]');
    if (!frame) { unavailable(audio ? 'SermonAudio recording' : 'YouTube video'); return; }
    if (audio) {
      var id = frame.getAttribute('data-sermonaudio-id') || '';
      if (!/^[0-9]{1,24}$/.test(id)) { unavailable('SermonAudio recording'); return; }
      // The provider's own audio page exposes autoplay=1. Its embed autoplay
      // contract is not documented; do not guess a parameter for the iframe.
      // Replace this handoff page so Back returns to the sermon list.
      window.location.replace('https://www.sermonaudio.com/sermons/' + id + '/a?autoplay=1');
      return;
    }
    var player = frame.querySelector('iframe') || loadYouTube(button, true);
    if (!player) { unavailable('YouTube video'); return; }
    frame.scrollIntoView({block: 'start', behavior: 'instant'});
    player.focus({preventScroll: true});
  }
  // Native fragment navigation runs after parsing; wait until pageshow so it
  // cannot move focus back out of the requested player or transcript heading.
  window.addEventListener('pageshow', requestedContent);
  if (document.readyState === 'complete') requestedContent();
  window.addEventListener('hashchange', requestedContent);
  document.addEventListener('click', function (event) {
    var link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    var target = new URL(link.href, window.location.href);
    if (target.origin === location.origin && target.pathname === location.pathname && target.search === location.search &&
        (target.hash === '#transcript' || target.hash === '#transcript-heading')) {
      event.preventDefault();
      if (location.hash !== target.hash) history.pushState(null, '', target.hash);
      openTranscript();
    }
  });

  /* ---- transcript opens for printing, then returns to its previous state ---- */
  var printable = Array.prototype.slice.call(document.querySelectorAll('details[data-open-for-print]'));
  var reopened = null;
  window.addEventListener('beforeprint', function () {
    if (reopened !== null) return;
    reopened = printable.filter(function (details) { return !details.open; });
    for (var index = 0; index < reopened.length; index += 1) reopened[index].open = true;
  });
  window.addEventListener('afterprint', function () {
    if (reopened === null) return;
    for (var index = 0; index < reopened.length; index += 1) reopened[index].open = false;
    reopened = null;
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
