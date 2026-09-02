/**
 * Sermon detail enhancement: click-to-load YouTube and print support.
 *
 * No request reaches YouTube until the visitor activates the button. The
 * video identifier is re-validated in the browser, the privacy-enhanced host
 * is used, autoplay is never requested, and focus moves into the player so
 * keyboard users are not dropped at the top of the document.
 *
 * Before printing, closed transcript disclosures are opened so the printed
 * page contains the full approved text; they are restored afterwards.
 */
export const sermonScript = `(function () {
  for (const button of document.querySelectorAll('[data-load-youtube]')) {
    button.addEventListener('click', function () {
      const frame = button.closest('[data-video-frame]');
      const id = button.getAttribute('data-video-id') || '';
      const title = button.getAttribute('data-video-title') || 'Sermon video';
      if (!frame || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id;
      iframe.title = title;
      iframe.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = 0;
      const status = document.createElement('p');
      status.className = 'video-frame__status';
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

  const printable = Array.from(document.querySelectorAll('details[data-open-for-print]'));
  let reopened = [];
  window.addEventListener('beforeprint', function () {
    reopened = printable.filter(function (details) { return !details.open; });
    for (const details of reopened) details.open = true;
  });
  window.addEventListener('afterprint', function () {
    for (const details of reopened) details.open = false;
    reopened = [];
  });
})();`;
