// Home-page interactive mood demo. Data mirrors the real mood set in
// frontend/src/constants/data.ts — flavor profiles only, since actual
// dishes are generated per-session by the AI chef, not a fixed list.
(function () {
  var MOODS = [
    { id: 'happy', name: 'Happy', color: 'var(--mood-happy)', profile: 'Bright, vibrant flavors', note: 'Expect citrus, fresh herbs and a plate that looks as good as it tastes.' },
    { id: 'cozy', name: 'Cozy', color: 'var(--mood-cozy)', profile: 'Warm & comforting dishes', note: 'Slow-cooked, deeply seasoned food built for staying in.' },
    { id: 'stressed', name: 'Stressed', color: 'var(--mood-stressed)', profile: 'Simple, calming meals', note: 'Few steps, familiar textures — nothing that asks more of you.' },
    { id: 'low', name: 'Low', color: 'var(--mood-low)', profile: 'Soul-soothing comfort food', note: 'Gentle, restorative dishes for the days that need a little extra care.' },
    { id: 'energetic', name: 'Energetic', color: 'var(--mood-energetic)', profile: 'Fresh, protein-packed fuel', note: 'Built to match the pace you are already moving at.' },
    { id: 'calm', name: 'Calm', color: 'var(--mood-calm)', profile: 'Light & zen-like plates', note: 'Clean, unfussy food that keeps the quiet going.' },
    { id: 'romantic', name: 'Romantic', color: 'var(--mood-romantic)', profile: 'Elegant, intimate dishes', note: 'A little ceremony, a little indulgence, made for two.' },
    { id: 'excited', name: 'Excited', color: 'var(--mood-excited)', profile: 'Fun, adventurous plates', note: 'New flavors and combinations worth telling someone about.' },
  ];

  document.addEventListener('DOMContentLoaded', function () {
    var row = document.getElementById('mood-chip-row');
    var resultProfile = document.getElementById('mood-result-profile');
    var resultNote = document.getElementById('mood-result-note');
    var resultThumb = document.getElementById('mood-result-thumb');
    var resultName = document.getElementById('mood-result-name');
    if (!row) return;

    function render(activeId) {
      row.innerHTML = '';
      MOODS.forEach(function (mood) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mood-chip';
        btn.setAttribute('aria-pressed', mood.id === activeId ? 'true' : 'false');
        btn.innerHTML =
          '<span class="dot" style="background:' + mood.color + '"></span>' +
          '<span class="label">' + mood.name + '</span>';
        btn.addEventListener('click', function () { setActive(mood.id); });
        row.appendChild(btn);
      });
      var active = MOODS.filter(function (m) { return m.id === activeId; })[0];
      resultName.textContent = active.name;
      resultProfile.textContent = active.profile;
      resultNote.textContent = active.note;
      resultThumb.style.background = active.color;
    }

    function setActive(id) { render(id); }

    render('cozy');
  });
})();
