(function () {
  var $ = function (id) { return document.getElementById(id); };
  var title = $('title');
  var slug = $('slug');
  var content = $('content');
  var preview = $('preview');
  var stats = $('stats');
  var format = $('contentFormat');
  var coverInput = $('coverImage');
  var coverFile = $('coverFile');
  var coverPreview = $('cover-preview');

  if (format.value === 'html') {
    $('format-hint').textContent = '(legacy post: raw HTML)';
    document.querySelector('.editor-toolbar').style.display = 'none';
  } else {
    $('format-hint').textContent = '(Markdown, HTML also allowed)';
  }

  // ----- slug auto-fill -----
  function slugify(s) {
    return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  }
  var slugTouched = !!slug.dataset.locked || !!slug.value;
  slug.addEventListener('input', function () { slugTouched = true; });
  title.addEventListener('input', function () {
    if (!slugTouched) slug.value = slugify(title.value);
  });

  // ----- cover preview -----
  function imgSrc(v) {
    if (!v) return '';
    return /^(https?:)?\/\//i.test(v) || v.charAt(0) === '/' ? v : '/' + v;
  }
  coverInput.addEventListener('input', function () { coverPreview.src = imgSrc(coverInput.value.trim()); });
  coverFile.addEventListener('change', function () {
    if (coverFile.files[0]) coverPreview.src = URL.createObjectURL(coverFile.files[0]);
  });

  // ----- live preview + word count (rendered server-side so it matches the published page exactly) -----
  var timer = null;
  var seq = 0;
  function refresh() {
    var mine = ++seq;
    fetch('/admin/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ content: content.value, format: format.value }),
    })
      .then(function (r) {
        if (r.status === 401) throw new Error('Session expired, log in again (open a new tab so you don\'t lose this draft).');
        return r.json();
      })
      .then(function (data) {
        if (mine !== seq) return;
        preview.innerHTML = data.html || '<p class="text-muted">Live preview appears here.</p>';
        stats.textContent = data.wordCount + ' words · ' + data.readTime + ' min read';
      })
      .catch(function (e) { stats.textContent = e.message; });
  }
  content.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
  });
  refresh();

  // ----- toolbar -----
  function insert(before, after) {
    var start = content.selectionStart, end = content.selectionEnd;
    var selected = content.value.slice(start, end);
    content.setRangeText(before + selected + after, start, end, 'end');
    if (!selected) content.selectionStart = content.selectionEnd = start + before.length;
    content.focus();
    content.dispatchEvent(new Event('input'));
  }
  document.querySelectorAll('[data-md]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var parts = btn.getAttribute('data-md').replace(/\\n/g, '\n').split('|');
      insert(parts[0], parts[1] || '');
    });
  });

  // ----- inline image upload -----
  $('inline-image').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var fd = new FormData();
    fd.append('file', file);
    stats.textContent = 'Uploading image…';
    fetch('/admin/media', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        insert('\n![' + file.name.replace(/\.[^.]+$/, '') + '](' + data.url + ')\n', '');
      })
      .catch(function (err) { stats.textContent = 'Upload failed: ' + err.message; })
      .finally(function () { e.target.value = ''; });
  });

  // ----- warn before leaving with unsaved changes -----
  var dirty = false;
  document.getElementById('blog-form').addEventListener('input', function () { dirty = true; });
  document.getElementById('blog-form').addEventListener('submit', function () { dirty = false; });
  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();
