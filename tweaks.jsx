/* Site tweaks panel for Will Suan's research site.
   Hooks lightweight knobs: accent color, brain motion,
   section-marker glyph, density, mono typeface. */

(function () {
  const { useEffect } = React;

  const DEFAULTS = /*EDITMODE-BEGIN*/{
    "accent": "#ffd23f",
    "background": "royal",
    "sectionGlyph": "§",
    "brainSpeed": 1.0,
    "density": "comfortable",
    "monoFont": "IBM Plex Mono",
    "showBrain": true
  }/*EDITMODE-END*/;

  // Painted swatches (curated)
  const ACCENTS = ["#ffd23f", "#ff8a1f", "#2fd06b", "#6fb5ff", "#ff3d97"];

  const BACKGROUNDS = {
    royal:    { bg: "#1a3aa3", bg1: "#1f43b3", bg2: "#234bc1", bg3: "#2c57d0",
                fg: "#f5f8ff", fg2: "#d4ddf2", muted: "#9eb0d6", dim: "#7286b0",
                line: "rgba(255,255,255,.16)", line2: "rgba(255,255,255,.28)" },
    ink:      { bg: "#0e1116", bg1: "#141821", bg2: "#1a1f2b", bg3: "#222837",
                fg: "#f1f3f7", fg2: "#cdd3e0", muted: "#8f97a8", dim: "#5d6479",
                line: "rgba(255,255,255,.10)", line2: "rgba(255,255,255,.22)" },
    paper:    { bg: "#efe9dc", bg1: "#e8e1d0", bg2: "#e1d8c1", bg3: "#d6cbaf",
                fg: "#1a1a1a", fg2: "#2a2a2a", muted: "#5a5648", dim: "#8a8470",
                line: "rgba(0,0,0,.12)", line2: "rgba(0,0,0,.24)" },
    forest:   { bg: "#13322a", bg1: "#173a31", bg2: "#1c443a", bg3: "#235547",
                fg: "#f1f7f3", fg2: "#cfdfd4", muted: "#92a89c", dim: "#6a7e73",
                line: "rgba(255,255,255,.14)", line2: "rgba(255,255,255,.26)" },
  };

  const MONO_FONTS = [
    "IBM Plex Mono",
    "JetBrains Mono",
    "Berkeley Mono",
    "ui-monospace",
  ];

  function applyTweaks(t) {
    const r = document.documentElement.style;
    // accent
    r.setProperty('--accent-yellow', t.accent);
    r.setProperty('--warn', t.accent);

    // background palette
    const p = BACKGROUNDS[t.background] || BACKGROUNDS.royal;
    r.setProperty('--bg',     p.bg);
    r.setProperty('--bg-1',   p.bg1);
    r.setProperty('--bg-2',   p.bg2);
    r.setProperty('--bg-3',   p.bg3);
    r.setProperty('--fg',     p.fg);
    r.setProperty('--fg-2',   p.fg2);
    r.setProperty('--muted',  p.muted);
    r.setProperty('--dim',    p.dim);
    r.setProperty('--line',   p.line);
    r.setProperty('--line-2', p.line2);

    // section glyph — swap on every eyebrow.
    // Walk to the first non-empty text node anywhere in the subtree
    // (some eyebrows wrap their label in a <span>; others have it as
    // a direct text child). Only that single text node gets rewritten,
    // so nested pager nav / status pills are untouched.
    document.querySelectorAll('.block-eyebrow').forEach(el => {
      let tn = null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.nodeValue.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      });
      tn = walker.nextNode();
      if (!tn) {
        tn = document.createTextNode('');
        el.insertBefore(tn, el.firstChild);
      }
      const stripped = tn.nodeValue.replace(/^\s*[§¶◊◆]?\s*/, '');
      tn.nodeValue = `${t.sectionGlyph} ${stripped}`;
    });

    // density
    document.body.dataset.density = t.density;

    // mono font — push to var
    r.setProperty('--mono',
      `"${t.monoFont}", ui-monospace, "SF Mono", Menlo, monospace`);

    // brain
    const wrap = document.querySelector('.brain-wrap');
    if (wrap) wrap.style.display = t.showBrain ? '' : 'none';
    window.__brainSpeedMul = t.brainSpeed;
  }

  function TweaksApp() {
    const [t, setTweak] = window.useTweaks(DEFAULTS);

    useEffect(() => { applyTweaks(t); }, [t]);

    return (
      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="Palette">
          <window.TweakColor
            label="Accent"
            value={t.accent}
            onChange={v => setTweak('accent', v)}
            options={ACCENTS}
          />
          <window.TweakRadio
            label="Background"
            value={t.background}
            onChange={v => setTweak('background', v)}
            options={[
              { value: 'royal',  label: 'Royal' },
              { value: 'ink',    label: 'Ink' },
              { value: 'paper',  label: 'Paper' },
              { value: 'forest', label: 'Forest' },
            ]}
          />
        </window.TweakSection>

        <window.TweakSection title="Typography">
          <window.TweakSelect
            label="Mono font"
            value={t.monoFont}
            onChange={v => setTweak('monoFont', v)}
            options={MONO_FONTS.map(f => ({ value: f, label: f }))}
          />
          <window.TweakRadio
            label="Section glyph"
            value={t.sectionGlyph}
            onChange={v => setTweak('sectionGlyph', v)}
            options={[
              { value: '§', label: '§' },
              { value: '¶', label: '¶' },
              { value: '◊', label: '◊' },
            ]}
          />
          <window.TweakRadio
            label="Density"
            value={t.density}
            onChange={v => setTweak('density', v)}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact',     label: 'Compact' },
            ]}
          />
        </window.TweakSection>

        <window.TweakSection title="Brain (research map)">
          <window.TweakToggle
            label="Show brain"
            value={t.showBrain}
            onChange={v => setTweak('showBrain', v)}
          />
          <window.TweakSlider
            label="Auto-rotate speed"
            value={t.brainSpeed}
            min={0} max={3} step={0.1}
            onChange={v => setTweak('brainSpeed', v)}
            formatValue={v => `${v.toFixed(1)}×`}
          />
        </window.TweakSection>
      </window.TweaksPanel>
    );
  }

  // mount once React + the starter helpers are ready
  function mount() {
    if (!window.TweaksPanel || !window.useTweaks) {
      return setTimeout(mount, 50);
    }
    const host = document.createElement('div');
    host.id = '__tweaks_host';
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(<TweaksApp />);
  }
  mount();
})();
