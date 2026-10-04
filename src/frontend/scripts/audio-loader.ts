/** No iframe, prefetch, connection or autoplay permission before activation. */
export const audioLoaderSource = `
  document.querySelectorAll('[data-load-sermonaudio]').forEach(function (button) {
    button.addEventListener('click', function () {
      var frame = button.closest('[data-audio-frame]');
      var id = button.getAttribute('data-sermonaudio-id') || '';
      if (!frame || !/^[0-9]{1,24}$/.test(id) || frame.querySelector('iframe')) return;
      button.disabled = true;
      var iframe = document.createElement('iframe');
      iframe.src = 'https://embed.sermonaudio.com/player/a/' + id + '/';
      iframe.title = button.getAttribute('data-audio-title') || 'Sermon audio player';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.tabIndex = 0;
      var status = document.createElement('p');
      status.className = 'audio-plate__note';
      status.setAttribute('role', 'status');
      status.textContent = 'Loading the audio player…';
      var timer = window.setTimeout(function () {
        status.textContent = 'If the player does not load, use “Listen on SermonAudio” below.';
      }, 12000);
      iframe.addEventListener('load', function () { window.clearTimeout(timer); status.remove(); });
      iframe.addEventListener('error', function () {
        window.clearTimeout(timer);
        status.textContent = 'The audio player could not load. Use “Listen on SermonAudio” below.';
      });
      frame.replaceChildren(status, iframe);
      frame.setAttribute('data-audio-loaded', 'true');
      iframe.focus();
    });
  });
`;
