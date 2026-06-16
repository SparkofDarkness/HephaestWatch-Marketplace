// Skip Intro Plugin — shows a "Skip Intro" button over the video player.
// Pre-compiled ESM bundle. Uses window.__HW_React and window.__HW_playerBus.

const React = window.__HW_React;
if (!React) throw new Error('[SkipIntro] window.__HW_React is not set');
const { useState, useEffect, createElement: h } = React;

const playerBus = window.__HW_playerBus;
if (!playerBus) throw new Error('[SkipIntro] window.__HW_playerBus is not set');

function SkipIntroOverlay({ config }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    return playerBus.onStateChange(setState);
  }, []);

  const skipSeconds      = config.skipSeconds      ?? 85;
  const showFromSeconds  = config.showFromSeconds  ?? 15;
  const showUntilSeconds = (config.showUntilMinutes ?? 5) * 60;

  const ct = state?.currentTime ?? 0;
  const visible = state?.active && ct >= showFromSeconds && ct <= showUntilSeconds;

  if (!visible) return null;

  return h('button', {
    className: 'vp-skip-intro-btn',
    onClick: () => playerBus.sendCommand({ type: 'seekOffset', seconds: skipSeconds }),
  }, '⏭ Skip Intro');
}

export function init(ctx) {
  ctx.ui.register('player-overlay', () => h(SkipIntroOverlay, { config: ctx.config }));
}

export function teardown() {
  // UI slot cleaned up automatically by the plugin manager
}
