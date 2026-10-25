(function () {
  var stored = {};
  try {
    stored = JSON.parse(localStorage.getItem('msr-theme') || '{}');
  } catch (e) {}
  var mode = stored.mode || 'system';
  var dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.dataset.style = stored.style || 'aurora';
  root.dataset.mode = dark ? 'dark' : 'light';
  root.dataset.nav = stored.nav || 'sidebar';
})();
