/** Progressive V5 paging: ordinary links remain the no-JS and failure fallback.
 * Fetches one existing, same-origin, authenticated archive page per activation.
 * It neither changes the eligibility selector nor loads detail/media content. */
export const journalPaginationScript = `(function () {
  var section = document.querySelector('.v5__recent[data-v5-base]');
  if (!section) return;
  var root = section.closest('.v5');
  var status = section.querySelector('[data-v5-load-status]');
  var base = section.getAttribute('data-v5-base');
  var first = section.querySelector('[data-v5-more]');
  if (!root || !status || !first || !base) return;
  var filters = new URL(first.href, location.href).search;
  var loading = false;
  function nextUrl(link, page) {
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.username || url.password ||
        url.pathname !== base + 'page/' + page + '/' || url.search !== filters) {
      throw new Error('Unexpected continuation');
    }
    url.hash = '';
    return url;
  }
  section.addEventListener('click', async function (event) {
    var link = event.target.closest('[data-v5-more]');
    if (!link || !section.contains(link) || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('data-v5-fallback')) return;
    event.preventDefault();
    if (loading) return;
    var controls = section.querySelector('[data-v5-pagination]');
    var page = Number(controls.getAttribute('data-page'));
    var total = Number(controls.getAttribute('data-total'));
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    loading = true;
    controls.setAttribute('aria-busy', 'true');
    link.setAttribute('aria-disabled', 'true');
    link.textContent = 'Loading sermons…';
    status.textContent = '';
    try {
      var url = nextUrl(link, page + 1);
      var response = await fetch(url.href, {
        credentials: 'same-origin', mode: 'same-origin', cache: 'no-store',
        redirect: 'error', signal: controller.signal, headers: { Accept: 'text/html' }
      });
      if (response.status !== 200 || response.url !== url.href ||
          !(response.headers.get('content-type') || '').startsWith('text/html')) throw new Error('Page unavailable');
      var doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      var incoming = doc.querySelector('.v5__recent[data-v5-base]');
      var nextControls = incoming && incoming.querySelector('[data-v5-pagination]');
      var nextList = incoming && incoming.querySelector(':scope > .journal');
      var list = section.querySelector(':scope > .journal');
      if (!incoming || incoming.getAttribute('data-v5-base') !== base || !nextControls || !nextList || !list ||
          Number(nextControls.getAttribute('data-page')) !== page + 1 ||
          Number(nextControls.getAttribute('data-total')) !== total || !nextControls.querySelector('[data-v5-progress]')) {
        throw new Error('Archive changed');
      }
      var continuation = nextControls.querySelector('[data-v5-more]');
      if (continuation) nextUrl(continuation, page + 2);
      // Never import shell scripts, frames, handlers or active external markup.
      var forbidden = 'script,style,iframe,object,embed,base,link,meta,form';
      var nodes = Array.from(nextList.children);
      if (!nodes.length || nodes.length > 9 || nextControls.querySelector(forbidden)) throw new Error('Unexpected page');
      var seen = new Set(Array.from(root.querySelectorAll('[data-sermon-id]'), function (item) { return item.getAttribute('data-sermon-id'); }));
      var additions = [];
      for (var i = 0; i < nodes.length; i += 1) {
        var row = nodes[i];
        var entry = row.querySelector(':scope > .journal__entry[data-sermon-id]');
        if (row.tagName !== 'LI' || !entry || row.querySelector(forbidden) || entry.classList.contains('journal__entry--featured')) throw new Error('Unexpected row');
        var elements = [row].concat(Array.from(row.querySelectorAll('*')));
        for (var j = 0; j < elements.length; j += 1) {
          if (Array.from(elements[j].attributes).some(function (attribute) { return /^on/i.test(attribute.name); })) throw new Error('Unexpected handler');
        }
        var id = entry.getAttribute('data-sermon-id');
        if (!id) throw new Error('Missing identity');
        if (!seen.has(id)) { seen.add(id); additions.push(document.importNode(row, true)); }
      }
      if (!additions.length) throw new Error('No new sermons');
      var replacement = document.importNode(nextControls, true);
      replacement.querySelector('[data-v5-progress]').textContent = 'Showing ' + seen.size + ' of ' + total + ' sermons';
      var fragment = document.createDocumentFragment();
      additions.forEach(function (row) { fragment.appendChild(row); });
      list.appendChild(fragment);
      controls.replaceWith(replacement);
      document.dispatchEvent(new Event('v5:appended'));
      status.textContent = additions.length + ' more sermons added. ' + seen.size + ' of ' + total + ' shown.';
      var title = additions[0].querySelector('.journal__title a');
      if (title) title.focus();
    } catch (_) {
      // Keep the prior list intact and let the next activation navigate normally.
      link.removeAttribute('aria-disabled');
      link.setAttribute('data-v5-fallback', '');
      link.href = base + 'page/' + (page + 1) + '/' + filters + '#v5-results';
      link.textContent = 'Open next page';
      status.textContent = 'More sermons could not be added here. Open the next page or use a page number below.';
    } finally {
      clearTimeout(timer);
      controls.removeAttribute('aria-busy');
      loading = false;
    }
  });
})();`;
