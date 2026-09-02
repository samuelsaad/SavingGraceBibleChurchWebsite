/**
 * Sermon archive enhancement: the Books → Chapters → Verses passage picker,
 * disclosure restoration for browser history, results focus, and the
 * discovery carousels.
 *
 * Everything here is progressive enhancement over a server-rendered form.
 * Without this script every tile and "Search all of …" control is an ordinary
 * link that performs that search and reveals the next level on the server.
 * With it:
 *
 * - one activation of a book or chapter reveals the next level and never
 *   submits; activating the already-selected tile again, a double activation,
 *   or the explicit "Search all of …" control submits that scope;
 * - one activation of a verse submits the exact verse;
 * - each tile grid is one Tab stop with arrow-key, Home and End movement;
 * - Escape or Backspace inside a grid returns to the parent level;
 * - the broad Bible-book select and the picker's book stay in step so the
 *   form can never submit contradictory books;
 * - open disclosures with active values are restored on back/forward;
 * - carousels never autoplay and show Previous/Next only when they overflow.
 */
export const archiveScript = `(function () {
  const form = document.querySelector('[data-sermon-search-form]');
  if (!form) return;

  const query = function (selector) { return form.querySelector(selector); };
  const broadBook = query('#book-filter');
  const bookInput = query('#passage-book');
  const chapterInput = query('#passage-chapter');
  const verseInput = query('#passage-verse');
  const scopeInput = query('#passage-scope');
  const picker = query('[data-bible-picker]');
  const booksPanel = query('[data-books-panel]');
  const chaptersPanel = query('[data-chapters-panel]');
  const versesPanel = query('[data-verses-panel]');
  const bookGrid = query('[data-tile-grid="book"]');
  const chapterGrid = query('[data-tile-grid="chapter"]');
  const verseGrid = query('[data-tile-grid="verse"]');
  const bookSelection = query('[data-book-selection]');
  const chapterSelection = query('[data-chapter-selection]');
  const searchBook = query('[data-search-whole-book]');
  const searchChapter = query('[data-search-whole-chapter]');
  const live = query('[data-passage-announcement]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function announce(message) {
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = message; }, 50);
  }

  /* ---- disclosure restoration (Advanced search, Browse by Bible passage) ---- */
  function restoreDisclosures() {
    for (const details of form.querySelectorAll('details[data-active="true"]')) details.open = true;
  }
  window.addEventListener('pageshow', function () {
    if (broadBook) broadBook.disabled = false;
    restoreDisclosures();
  });
  restoreDisclosures();

  /* ---- move focus to the results after a search or page change ---- */
  const results = document.getElementById('sermon-results');
  if (results && window.location.hash === '#sermon-results') {
    results.focus({ preventScroll: true });
  }

  /* ---- passage picker ---- */
  if (picker && bookInput && chapterInput && verseInput && scopeInput && bookGrid && chapterGrid && verseGrid) {
    const applied = {
      book: bookInput.value || '',
      chapter: Number(chapterInput.value) || 0,
      verse: Number(verseInput.value) || 0,
      scope: scopeInput.value || ''
    };
    const urlBase = picker.getAttribute('data-passage-url') || '';
    let bookOrigin = form.getAttribute('data-book-origin') || 'none';
    if (bookOrigin === 'both') bookOrigin = 'exact';

    const bookTiles = function () { return Array.from(bookGrid.querySelectorAll('[data-book-tile]')); };
    const selectedBook = function () {
      return bookTiles().find(function (tile) { return tile.getAttribute('aria-current') === 'true'; }) || null;
    };
    const bookName = function () {
      const book = selectedBook();
      return book ? book.getAttribute('data-book-name') || '' : '';
    };

    function passageUrl(parameters) {
      return urlBase + (urlBase.indexOf('?') === -1 ? '?' : '&') + new URLSearchParams(parameters).toString() + '#sermon-results';
    }

    function setRovingFocus(grid, preferred) {
      const tiles = Array.from(grid.querySelectorAll('.bible-tile'));
      const target = preferred
        || tiles.find(function (tile) { return tile.getAttribute('aria-current') === 'true'; })
        || tiles[0];
      for (const tile of tiles) tile.tabIndex = tile === target ? 0 : -1;
    }

    function markSelected(grid, attribute, value) {
      for (const tile of grid.querySelectorAll('.bible-tile')) {
        if (tile.getAttribute(attribute) === String(value)) tile.setAttribute('aria-current', 'true');
        else tile.removeAttribute('aria-current');
      }
    }

    function setInput(input, value) {
      input.value = value;
      input.disabled = !value;
    }

    function setMobilePanel(panel) {
      picker.setAttribute('data-mobile-panel', panel);
    }

    function numberTile(kind, number, href, prefix, isApplied) {
      const tile = document.createElement('a');
      tile.className = 'bible-tile bible-tile--number';
      tile.href = href;
      tile.setAttribute('data-' + kind + '-tile', '');
      tile.setAttribute('data-' + kind, String(number));
      tile.setAttribute('data-applied', String(isApplied));
      tile.tabIndex = -1;
      const label = document.createElement('span');
      label.className = 'bible-tile__label';
      label.textContent = String(number);
      const name = document.createElement('span');
      name.className = 'sr-only';
      name.textContent = ', ' + prefix + ' ' + number + (isApplied ? ', current search' : '');
      tile.append(label, name);
      return tile;
    }

    function hideVerses() {
      if (versesPanel) versesPanel.hidden = true;
      verseGrid.replaceChildren();
      setInput(verseInput, '');
      if (searchChapter) {
        searchChapter.setAttribute('aria-disabled', 'true');
        searchChapter.textContent = 'Search a whole chapter';
      }
    }

    function renderChapters(focusNext, silent) {
      const book = selectedBook();
      if (!book || !chaptersPanel) return;
      const slug = book.getAttribute('data-book') || '';
      const name = book.getAttribute('data-book-name') || '';
      const count = Number(book.getAttribute('data-chapters')) || 0;
      const appliedHere = slug === applied.book && (applied.scope === 'chapter' || applied.scope === 'verse');
      chaptersPanel.hidden = false;
      chapterGrid.replaceChildren.apply(chapterGrid, Array.from({ length: count }, function (_, index) {
        const number = index + 1;
        return numberTile('chapter', number, passageUrl({ passageBook: slug, passageChapter: String(number), passageScope: 'chapter' }), name + ' chapter', appliedHere && number === applied.chapter);
      }));
      if (bookSelection) bookSelection.textContent = name;
      if (searchBook) {
        searchBook.removeAttribute('aria-disabled');
        searchBook.href = passageUrl({ passageBook: slug, passageScope: 'book' });
        searchBook.textContent = 'Search all of ' + name;
      }
      hideVerses();
      picker.setAttribute('data-depth', 'chapter');
      setMobilePanel('chapter');
      setRovingFocus(chapterGrid);
      if (!silent) announce(name + ' selected. ' + count + ' chapters available. Choose a chapter, or search all of ' + name + '.');
      if (focusNext) {
        const first = chapterGrid.querySelector('.bible-tile');
        if (first) first.focus();
      }
    }

    function renderVerses(focusNext) {
      const book = selectedBook();
      const chapter = Number(chapterInput.value) || 0;
      if (!book || !chapter || !versesPanel) return;
      const slug = book.getAttribute('data-book') || '';
      const name = book.getAttribute('data-book-name') || '';
      const counts = (book.getAttribute('data-verse-counts') || '').split(',').map(Number);
      const count = counts[chapter - 1] || 0;
      const appliedHere = slug === applied.book && applied.scope === 'verse' && chapter === applied.chapter;
      versesPanel.hidden = false;
      verseGrid.replaceChildren.apply(verseGrid, Array.from({ length: count }, function (_, index) {
        const number = index + 1;
        return numberTile('verse', number, passageUrl({ passageBook: slug, passageChapter: String(chapter), passageVerse: String(number), passageScope: 'verse' }), name + ' ' + chapter + ' verse', appliedHere && number === applied.verse);
      }));
      if (chapterSelection) chapterSelection.textContent = name + ' ' + chapter;
      if (searchChapter) {
        searchChapter.removeAttribute('aria-disabled');
        searchChapter.href = passageUrl({ passageBook: slug, passageChapter: String(chapter), passageScope: 'chapter' });
        searchChapter.textContent = 'Search all of ' + name + ' ' + chapter;
      }
      picker.setAttribute('data-depth', 'verse');
      setMobilePanel('verse');
      setRovingFocus(verseGrid);
      announce(name + ' ' + chapter + ' selected. ' + count + ' verses available. Choose a verse to search it, or search all of ' + name + ' ' + chapter + '.');
      if (focusNext) {
        const first = verseGrid.querySelector('.bible-tile');
        if (first) first.focus();
      }
    }

    function syncBroadFromExact() {
      if (!broadBook) return;
      const options = Array.from(broadBook.options);
      broadBook.value = options.some(function (option) { return option.value === bookInput.value; }) ? bookInput.value : '';
    }

    function selectBook(tile, focusNext, origin, silent) {
      bookOrigin = origin;
      markSelected(bookGrid, 'data-book', tile.getAttribute('data-book') || '');
      setRovingFocus(bookGrid, tile);
      setInput(bookInput, tile.getAttribute('data-book') || '');
      setInput(chapterInput, '');
      setInput(verseInput, '');
      setInput(scopeInput, 'book');
      if (origin === 'exact') syncBroadFromExact();
      renderChapters(focusNext, silent);
    }

    function clearPicker() {
      markSelected(bookGrid, 'data-book', '');
      setRovingFocus(bookGrid);
      setInput(bookInput, '');
      setInput(chapterInput, '');
      setInput(verseInput, '');
      setInput(scopeInput, '');
      if (chaptersPanel) chaptersPanel.hidden = true;
      if (versesPanel) versesPanel.hidden = true;
      if (searchBook) { searchBook.setAttribute('aria-disabled', 'true'); searchBook.textContent = 'Search a whole book'; }
      if (searchChapter) { searchChapter.setAttribute('aria-disabled', 'true'); searchChapter.textContent = 'Search a whole chapter'; }
      picker.setAttribute('data-depth', 'book');
      setMobilePanel('book');
    }

    function syncExactFromBroad() {
      const value = broadBook ? broadBook.value : '';
      const match = bookTiles().find(function (tile) { return tile.getAttribute('data-book') === value; });
      if (match) selectBook(match, false, 'broad', true);
      else clearPicker();
      bookOrigin = 'broad';
    }

    function selectChapter(tile, focusNext) {
      bookOrigin = 'exact';
      markSelected(chapterGrid, 'data-chapter', tile.getAttribute('data-chapter') || '');
      setRovingFocus(chapterGrid, tile);
      setInput(chapterInput, tile.getAttribute('data-chapter') || '');
      setInput(verseInput, '');
      setInput(scopeInput, 'chapter');
      syncBroadFromExact();
      renderVerses(focusNext);
    }

    function submitScope(scope) {
      bookOrigin = 'exact';
      if (scope === 'book') {
        setInput(chapterInput, '');
        setInput(verseInput, '');
      } else if (scope === 'chapter') {
        setInput(verseInput, '');
      }
      setInput(scopeInput, scope);
      const name = bookName();
      const label = scope === 'book' ? name : scope === 'chapter' ? name + ' ' + chapterInput.value : name + ' ' + chapterInput.value + ':' + verseInput.value;
      announce('Searching sermons preached from ' + label + '.');
      form.requestSubmit();
    }

    function selectVerse(tile) {
      bookOrigin = 'exact';
      markSelected(verseGrid, 'data-verse', tile.getAttribute('data-verse') || '');
      setRovingFocus(verseGrid, tile);
      setInput(verseInput, tile.getAttribute('data-verse') || '');
      setInput(scopeInput, 'verse');
      syncBroadFromExact();
      submitScope('verse');
    }

    function returnTo(panel, name, message) {
      setMobilePanel(name);
      const target = panel ? (panel.querySelector('.bible-tile[aria-current="true"]') || panel.querySelector('.bible-tile')) : null;
      if (target) target.focus();
      announce(message);
    }

    /* initial synchronisation with the server-rendered state */
    if (bookOrigin === 'broad') syncExactFromBroad();
    else if (bookOrigin === 'exact') syncBroadFromExact();
    for (const grid of [bookGrid, chapterGrid, verseGrid]) setRovingFocus(grid);

    if (broadBook) {
      broadBook.addEventListener('change', function () {
        bookOrigin = 'broad';
        syncExactFromBroad();
      });
    }

    picker.addEventListener('click', function (event) {
      const target = event.target.closest('a, button');
      if (!target) return;
      event.preventDefault();
      if (target.getAttribute('aria-disabled') === 'true') return;
      const keyboard = event.detail === 0;
      if (target.matches('[data-book-tile]')) {
        const chaptersVisible = chaptersPanel && !chaptersPanel.hidden;
        if (target.getAttribute('aria-current') === 'true' && chaptersVisible && bookOrigin === 'exact' && !keyboard) submitScope('book');
        else selectBook(target, keyboard, 'exact', false);
      } else if (target.matches('[data-chapter-tile]')) {
        const versesVisible = versesPanel && !versesPanel.hidden;
        if (target.getAttribute('aria-current') === 'true' && versesVisible && !keyboard) submitScope('chapter');
        else selectChapter(target, keyboard);
      } else if (target.matches('[data-verse-tile]')) {
        selectVerse(target);
      } else if (target.matches('[data-search-whole-book]')) {
        submitScope('book');
      } else if (target.matches('[data-search-whole-chapter]')) {
        submitScope('chapter');
      } else if (target.matches('[data-back-to-books]')) {
        returnTo(booksPanel, 'book', 'Returned to Bible books.');
      } else if (target.matches('[data-back-to-chapters]')) {
        returnTo(chaptersPanel, 'chapter', 'Returned to chapters.');
      }
    });

    picker.addEventListener('dblclick', function (event) {
      const target = event.target.closest('.bible-tile');
      if (!target) return;
      event.preventDefault();
      if (target.matches('[data-book-tile]')) {
        if (target.getAttribute('aria-current') !== 'true') selectBook(target, false, 'exact', true);
        submitScope('book');
      } else if (target.matches('[data-chapter-tile]')) {
        if (target.getAttribute('aria-current') !== 'true') selectChapter(target, false);
        submitScope('chapter');
      }
    });

    picker.addEventListener('keydown', function (event) {
      const tile = event.target.closest('.bible-tile');
      if (!tile) return;
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (tile.matches('[data-verse-tile]')) {
          event.preventDefault();
          returnTo(chaptersPanel, 'chapter', 'Returned to chapters.');
        } else if (tile.matches('[data-chapter-tile]')) {
          event.preventDefault();
          returnTo(booksPanel, 'book', 'Returned to Bible books.');
        }
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        tile.click();
        return;
      }
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (keys.indexOf(event.key) === -1) return;
      const grid = tile.closest('[data-tile-grid]');
      if (!grid) return;
      const tiles = Array.from(grid.querySelectorAll('.bible-tile'));
      const index = tiles.indexOf(tile);
      const columns = window.getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
      let next = index;
      if (event.key === 'ArrowLeft') next = index - 1;
      if (event.key === 'ArrowRight') next = index + 1;
      if (event.key === 'ArrowUp') next = index - columns;
      if (event.key === 'ArrowDown') next = index + columns;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tiles.length - 1;
      event.preventDefault();
      if (next < 0 || next >= tiles.length || next === index) return;
      setRovingFocus(grid, tiles[next]);
      tiles[next].focus();
    });

    form.addEventListener('submit', function () {
      if (broadBook) broadBook.disabled = false;
      if (bookOrigin === 'exact' && bookInput.value) {
        if (broadBook) broadBook.disabled = true;
        bookInput.disabled = false;
        chapterInput.disabled = !chapterInput.value;
        verseInput.disabled = !verseInput.value;
        scopeInput.disabled = !scopeInput.value;
      } else {
        bookInput.disabled = true;
        chapterInput.disabled = true;
        verseInput.disabled = true;
        scopeInput.disabled = true;
      }
    });
  }

  /* ---- discovery carousels ---- */
  for (const carousel of document.querySelectorAll('[data-carousel]')) {
    const track = carousel.querySelector('[data-carousel-track]');
    const previous = carousel.querySelector('[data-carousel-previous]');
    const next = carousel.querySelector('[data-carousel-next]');
    if (!track || !previous || !next) continue;
    const tolerance = 8;
    const update = function () {
      const overflow = track.scrollWidth > track.clientWidth + tolerance;
      previous.hidden = !overflow;
      next.hidden = !overflow;
      previous.setAttribute('aria-disabled', String(track.scrollLeft <= tolerance));
      next.setAttribute('aria-disabled', String(track.scrollLeft + track.clientWidth >= track.scrollWidth - tolerance));
    };
    const move = function (direction) {
      track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };
    previous.addEventListener('click', function () { if (previous.getAttribute('aria-disabled') !== 'true') move(-1); });
    next.addEventListener('click', function () { if (next.getAttribute('aria-disabled') !== 'true') move(1); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }
})();`;
