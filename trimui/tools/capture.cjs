// Hornea los decorados de la edición TrimUI a partir de la versión web (vite preview en :4173).
// Cada capa se dibuja sola sobre fondo negro y blanco (para recuperar la transparencia) a zoom 0,55 y en
// dos mitades. Salida: trimui/build/cap/*.png (luego bake.py las reduce y las incrusta).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || 'trimui/build/cap';
fs.mkdirSync(OUT, { recursive: true });
const ZOOM = 0.55, CY = 230, CXS = [1400 - 520, 1400 + 520];
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:4173');
  await p.waitForTimeout(2500);
  const canvas = await p.$('canvas');
  const setup = async (venue) => {
    await p.evaluate((venue) => {
      const g = window.__game;
      for (const k of ['Menu', 'Hud', 'Select', 'Settings']) g.scene.stop(k);
      g.scene.start('Match', { mode: 'attract', venue });
    }, venue);
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      const g = window.__game, m = g.scene.getScene('Match');
      g.scene.pause('Match');
      const cam = m.cameras.main;
      cam.resetPostPipeline(); cam.resetFX?.(); cam.shakeEffect?.reset?.(); cam.flashEffect?.reset?.();
      window.__view.vpx = 1400;
      m.stage.applyParallax(1400, 462, 1);
      m.stage.drawCourt(); m.stage.drawNet();
      window.__all = m.children.list.slice();
    });
  };
  // show: lista de índices de capas de stage.layers, más extras ('courtG','ads','net','board')
  const shot = async (name, show, opts = {}) => {
    for (const [ci, cx] of CXS.entries()) {
      for (const [bi, bg] of ['#000000', '#ffffff'].entries()) {
        await p.evaluate(({ show, cx, bg, ZOOM, CY, opts }) => {
          const g = window.__game, m = g.scene.getScene('Match'), st = m.stage;
          for (const o of window.__all) o.setVisible(false);
          st.layers.forEach((l, i) => l.c.setVisible(show.includes(i)));
          // dentro de las capas: ocultar lo animado
          for (const f of st.fans) f.s.setVisible(!!opts.fans);
          for (const t of st.boardTexts) t.setVisible(false);
          for (const gl of st.gulls) gl.s.setVisible(false);
          for (const s of st.sparkles) s.setVisible(false);
          st.rays.setVisible(false);
          if (show.includes('courtG')) st.courtG.setVisible(true);
          if (show.includes('ads')) for (const a of st.ads) a.im.setVisible(true);
          if (show.includes('net')) st.netG.setVisible(true);
          if (opts.fg) { const L = st.layers[opts.fg]; L.c.setPosition(0, 0).setScale(1); }
          const cam = m.cameras.main;
          cam.setBackgroundColor(bg); cam.setZoom(ZOOM); cam.centerOn(cx, CY);
          m.sys.renderer && g.loop.step(performance.now());
        }, { show, cx, bg, ZOOM, CY, opts });
        await p.waitForTimeout(120);
        await canvas.screenshot({ path: `${OUT}/${name}_${ci}_${bi}.png` });
      }
    }
  };
  for (const venue of ['mediodia', 'bahia', 'atardecer']) {
    await setup(venue);
    const n = await p.evaluate(() => window.__game.scene.getScene('Match').stage.layers.length);
    if (venue === 'mediodia') {
      console.log('layers', n);
      await shot('far', [0, 1, 2]);
      await shot('beach', [3, 5]);
      await shot('fg', [11], { fg: 11 });
      // texturas sueltas
      const tex = await p.evaluate(() => {
        const g = window.__game, out = {};
        for (const k of ['fronds', 'frondFg', 'shadow', 'ball', 'football', 'comet_sun', 'comet_wave', 'rays', 'soft', 'flag']) {
          try { if (g.textures.exists(k)) out[k] = g.textures.getBase64(k); } catch (e) { out[k] = 'ERR ' + e.message; }
        }
        return out;
      });
      for (const [k, v] of Object.entries(tex)) if (v.startsWith('data:')) fs.writeFileSync(`${OUT}/tex_${k}.png`, Buffer.from(v.split(',')[1], 'base64'));
      console.log('tex', Object.keys(tex));
    }
    await shot(`mid_${venue}`, [6, 7, 8]);
    await shot(`court_${venue}`, [9, 'courtG', 'ads']);
  }
  // posiciones del público (para dibujarlo vivo en la consola)
  await b.close();
})();
