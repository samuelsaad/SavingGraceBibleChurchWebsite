/**
 * The click-to-load YouTube loader shared by the sermon page and the church
 * pages. No request reaches YouTube until the visitor activates the button.
 * A video identifier or a playlist identifier is re-validated in the
 * browser, the privacy-enhanced host is used, autoplay is never requested,
 * and focus moves into the player so keyboard users are not dropped at the
 * top of the document.
 */
export const videoLoaderSource = `
  var loaders = document.querySelectorAll('[data-load-youtube]');
  for (var index = 0; index < loaders.length; index += 1) wireLoader(loaders[index]);

  function wireLoader(button) {
    button.addEventListener('click', function () {
      var frame = button.closest('[data-video-frame]');
      var id = button.getAttribute('data-video-id') || '';
      var list = button.getAttribute('data-playlist-id') || '';
      var title = button.getAttribute('data-video-title') || 'Video';
      var source = '';
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) source = 'https://www.youtube-nocookie.com/embed/' + id;
      else if (/^PL[A-Za-z0-9_-]{10,}$/.test(list)) source = 'https://www.youtube-nocookie.com/embed/videoseries?list=' + list;
      if (!frame || !source) return;
      var iframe = document.createElement('iframe');
      iframe.src = source;
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
`;
