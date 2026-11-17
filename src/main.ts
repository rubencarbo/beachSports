import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './config';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { initBackend } from './services/backend';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8cc8f0',
  scale: {
    mode: Phaser.Scale.EXPAND, // rellena pantallas panorámicas (iPhone ~19.5:9) sin bandas negras
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_W,
    height: VIEW_H,
  },
  render: { antialias: true, powerPreference: 'high-performance' },
  fps: { target: 60 },
  input: { activePointers: 4 },
  scene: [BootScene, MatchScene, MenuScene, HudScene],
});

initBackend();

// evita gestos del navegador (zoom, scroll, menú contextual) en iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
(window as any).__game = game;
