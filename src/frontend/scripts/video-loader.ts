/** Lazy YouTube loading; only an explicit sermon play shortcut requests autoplay. */
export const videoLoaderSource = `
  document.querySelectorAll('[data-load-youtube]').forEach(function (button) {
    button.addEventListener('click', function () { loadYouTube(button, false); });
  });

  function loadYouTube(button, autoplay) {
    var frame = button && button.closest('[data-video-frame]');
    var id = button ? button.getAttribute('data-video-id') || '' : '';
    var list = button ? button.getAttribute('data-playlist-id') || '' : '';
    var source = '';
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) source = 'https://www.youtube-nocookie.com/embed/' + id;
    else if (/^PL[A-Za-z0-9_-]{10,}$/.test(list)) source = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + list;
    if (!frame || !source) return null;
    var existing = frame.querySelector('iframe');
    if (existing) return existing;
    if (autoplay === true) source += (source.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1';
    var iframe = document.createElement('iframe');
    iframe.src = source;
    iframe.title = button.getAttribute('data-video-title') || 'Video';
    iframe.allow = (autoplay === true ? 'autoplay; ' : '') + 'accelerometer; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.tabIndex = 0;
    var status = document.createElement('p');
    status.className = 'plate__status';
    status.setAttribute('role', 'status');
    status.textContent = 'Loading the video player…';
    var timer = window.setTimeout(function () {
      status.textContent = 'The video player is taking longer to load. Reload the page or use the YouTube link if available.';
    }, 12000);
    iframe.addEventListener('load', function () {
      window.clearTimeout(timer);
      status.remove();
      frame.setAttribute('data-video-loaded', 'true');
    });
    iframe.addEventListener('error', function () {
      window.clearTimeout(timer);
      status.textContent = 'The video player could not load. Reload the page or use the YouTube link if available.';
    });
    frame.replaceChildren(status, iframe);
    frame.setAttribute('data-video-loaded', 'loading');
    iframe.focus();
    return iframe;
  }
`;
