// Applies a saved light/dark choice before the page paints (loaded as a normal script in <head>).
// Storage can be unavailable (private windows, blocked site data), so every access is guarded.
(function () {
  try {
    var saved = localStorage.getItem('hp-theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) { /* no storage: follow the system setting */ }
})();
