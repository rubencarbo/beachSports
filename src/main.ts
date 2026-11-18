import Phaser from 'phaser';
import { playerInput } from './core/input';
import { VIEW_H, VIEW_W, view } from './config';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { MatchScene } from './scenes/MatchScene';
import { MenuScene } from './scenes/MenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { LabScene } from './scenes/LabScene';
import { SelectScene } from './scenes/SelectScene';
import { BracketScene } from './scenes/BracketScene';
import { CharStudioScene } from './scenes/CharStudioScene';
import { FootScene } from './scenes/FootScene';
import { initBackend } from './services/backend';
import { GradePipeline, RetroPipeline } from './fx/RetroPipeline';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#5c8ad1',
  scale: {
    mode: Phaser.Scale.EXPAND, // rellena pantallas panorámicas (iPhone ~19.5:9) sin bandas negras
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_W,
    height: VIEW_H,
  },
  pixelArt: true,
  render: { antialias: false, pixelArt: true, roundPixels: false, powerPreference: 'high-performance' },
  pipeline: { RetroPipeline, GradePipeline } as any,
  fps: { target: 60 },
  input: { activePointers: 4 },
  scene: [BootScene, MatchScene, MenuScene, HudScene, SettingsScene, LabScene, SelectScene, BracketScene, CharStudioScene, FootScene],
});

initBackend();

// evita gestos del navegador (zoom, scroll, menú contextual) en iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
(window as any).__game = game;
(window as any).__inp = playerInput;
(window as any).__view = view; // usado por la herramienta que hornea los decorados de la edición TrimUI
import { getTournament } from './game/tournament';
(window as any).__tour = getTournament;
