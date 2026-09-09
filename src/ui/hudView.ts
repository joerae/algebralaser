import { soundManager } from '../audio/soundEffects';
import versionText from '../data/version.txt?raw';
import { SolverMode } from '../math/types';
import { MODE_DEFINITIONS } from '../game/modeRegistry';

export interface HudCallbacks {
  onEnableCamera: () => void;
  onToggleMute: () => void;
  onToggleDebug: () => void;
  onToggleHandsOnly: () => void;
  onToggleReducedMotion: () => void;
  onDwellChange: (dwellMs: number) => void;
  onUndo: () => void;
  onHint: () => void;
  onRestart: () => void;
  onModeChange: (mode: SolverMode) => void;
}

export class HudView {
  private headerEl: HTMLElement;
  private footerEl: HTMLElement;
  private modalEl: HTMLElement;
  private debugEl: HTMLElement;
  private bannerEl: HTMLElement;
  private callbacks: HudCallbacks;

  private currentMode: SolverMode = 'mode_a';
  private isMuted: boolean = false;
  private isCameraActive: boolean = false;
  private showDebug: boolean = false;
  private handsOnly: boolean = false;
  private reducedMotion: boolean = false;
  private dwellMs: number = 450;
  private isModalOpen: boolean = false;

  constructor(
    header: HTMLElement,
    footer: HTMLElement,
    modal: HTMLElement,
    debug: HTMLElement,
    banner: HTMLElement,
    callbacks: HudCallbacks,
    initialMode: SolverMode = 'mode_b'
  ) {
    this.headerEl = header;
    this.footerEl = footer;
    this.modalEl = modal;
    this.debugEl = debug;
    this.bannerEl = banner;
    this.callbacks = callbacks;
    this.currentMode = initialMode;
    this.renderHeader(1, 5);
    this.renderFooter('Get Y on its own.');
  }

  public setMode(mode: SolverMode) {
    this.currentMode = mode;
    this.headerEl.querySelectorAll<HTMLButtonElement>('.mode-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }


  public setCameraState(active: boolean) {
    this.isCameraActive = active;
    if (active) {
      this.bannerEl.style.display = 'none';
    }
    this.updateCameraBtn();
  }

  public updateProgress(level: number, total: number) {
    const levelInd = this.headerEl.querySelector('.level-indicator');
    if (levelInd) {
      levelInd.textContent = `Level ${level} of ${total}`;
    }
  }

  public updateInstruction(text: string) {
    const instrEl = this.footerEl.querySelector('.instruction-text');
    if (instrEl) {
      instrEl.innerHTML = `<span>⚡</span> <span>${text}</span>`;
    }
  }

  public updateDebugInfo(info: {
    videoFps?: number;
    inferenceFps: number;
    inferenceDuration: number;
    isPointing: boolean;
    isCurled: boolean;
    isOpenPalm: boolean;
    handedness?: string;
  }) {
    if (!this.showDebug) {
      this.debugEl.style.display = 'none';
      return;
    }
    this.debugEl.style.display = 'block';
    this.debugEl.innerHTML = `
      <div><strong>Laser Telemetry</strong></div>
      <div>Infer FPS: ${info.inferenceFps} (${info.inferenceDuration.toFixed(1)}ms)</div>
      <div>Hand: ${info.handedness || 'None'}</div>
      <div>Pointing: ${info.isPointing ? 'YES' : 'no'}</div>
      <div>Curled: ${info.isCurled ? 'YES' : 'no'}</div>
      <div>Open Palm: ${info.isOpenPalm ? 'YES' : 'no'}</div>
    `;
  }

  public showCameraBanner() {
    if (!this.isCameraActive) {
      this.bannerEl.style.display = 'flex';
      this.bannerEl.innerHTML = `
        <div class="banner-text">👉 Play with your finger laser! Enable your webcam or continue with mouse/keyboard.</div>
        <button id="banner-btn-enable" class="banner-btn-enable">Enable Camera</button>
        <button id="banner-btn-dismiss" class="banner-btn-dismiss">Play with Mouse</button>
      `;

      this.bannerEl.querySelector('#banner-btn-enable')?.addEventListener('click', () => {
        this.callbacks.onEnableCamera();
        this.bannerEl.style.display = 'none';
      });

      this.bannerEl.querySelector('#banner-btn-dismiss')?.addEventListener('click', () => {
        this.bannerEl.style.display = 'none';
      });
    }
  }

  private updateCameraBtn() {
    const btn = this.headerEl.querySelector('#btn-toggle-camera');
    if (btn) {
      btn.className = `icon-btn ${this.isCameraActive ? 'active' : ''}`;
      btn.innerHTML = this.isCameraActive ? '📷 Camera Active' : '📷 Enable Camera';
    }
  }

  public renderHeader(level: number, total: number) {
    this.headerEl.innerHTML = `
      <div class="brand-title">
        <span>Magic Finger Algebra</span>
        <span class="brand-badge">Laser Powered</span>
      </div>
      <div class="mode-toggle-group" role="group" aria-label="Equation interaction mode">
        ${MODE_DEFINITIONS.map(m => `
          <button id="btn-${m.id.replace('_', '-')}" data-mode="${m.id}" class="mode-toggle-btn ${this.currentMode === m.id ? 'active' : ''}" title="${m.title}">
            <span class="mode-icon">${m.icon}</span>
            <span class="mode-label">${m.label}</span>
          </button>
        `).join('')}
      </div>
      <div class="header-controls">
        <div class="level-indicator">Level ${level} of ${total}</div>
        <button id="btn-toggle-camera" class="icon-btn">📷 Enable Camera</button>
        <button id="btn-mute" class="icon-btn">${this.isMuted ? '🔇' : '🔊'}</button>
        <button id="btn-settings" class="icon-btn">⚙️ Settings</button>
      </div>
    `;

    this.headerEl.querySelector('.mode-toggle-group')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.mode-toggle-btn');
      if (!btn) return;
      const mode = btn.dataset.mode as SolverMode;
      if (mode && this.currentMode !== mode) {
        this.setMode(mode);
        this.callbacks.onModeChange(mode);
      }
    });

    this.headerEl.querySelector('#btn-toggle-camera')?.addEventListener('click', () => {
      this.callbacks.onEnableCamera();
    });

    this.headerEl.querySelector('#btn-mute')?.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      soundManager.setMuted(this.isMuted);
      const muteBtn = this.headerEl.querySelector('#btn-mute');
      if (muteBtn) muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
      this.callbacks.onToggleMute();
    });

    this.headerEl.querySelector('#btn-settings')?.addEventListener('click', () => {
      this.toggleSettingsModal();
    });
  }

  public renderFooter(instruction: string) {
    this.footerEl.innerHTML = `
      <div class="instruction-text">
        <span>⚡</span> <span>${instruction}</span>
      </div>
      <div class="hud-actions">
        <button id="btn-hint" class="icon-btn">💡 Hint</button>
        <button id="btn-undo" class="icon-btn">↩ Undo</button>
        <button id="btn-restart" class="icon-btn">🔄 Restart</button>
        <button id="btn-version" class="version-badge" title="Click to view Version Notes">v1.8.3</button>
      </div>
    `;

    this.footerEl.querySelector('#btn-hint')?.addEventListener('click', () => this.callbacks.onHint());
    this.footerEl.querySelector('#btn-undo')?.addEventListener('click', () => this.callbacks.onUndo());
    this.footerEl.querySelector('#btn-restart')?.addEventListener('click', () => this.callbacks.onRestart());
    this.footerEl.querySelector('#btn-version')?.addEventListener('click', () => this.showVersionModal());
  }

  private showVersionModal() {
    this.modalEl.style.display = 'flex';
    this.modalEl.innerHTML = `
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <div class="modal-title">Release Notes</div>
          <button id="modal-close" class="icon-btn" style="padding: 4px 10px;">✕</button>
        </div>
        <pre class="version-notes-pre">${versionText}</pre>
      </div>
    `;

    this.modalEl.querySelector('#modal-close')?.addEventListener('click', () => {
      this.modalEl.style.display = 'none';
    });
  }

  private toggleSettingsModal() {
    this.isModalOpen = !this.isModalOpen;
    if (!this.isModalOpen) {
      this.modalEl.style.display = 'none';
      return;
    }

    this.modalEl.style.display = 'flex';
    this.modalEl.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">Settings</div>
          <button id="modal-close" class="icon-btn" style="padding: 4px 10px;">✕</button>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Hands-Only View</div>
            <div class="setting-desc">Hides webcam background video, shows only glowing skeleton</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-hands-only" ${this.handsOnly ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Reduced Motion</div>
            <div class="setting-desc">Instant mathematical transitions without flying particles</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-reduced-motion" ${this.reducedMotion ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Debug Inspector</div>
            <div class="setting-desc">Shows real-time ray casting hitboxes and inference FPS</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-debug" ${this.showDebug ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row" style="flex-direction: column; align-items: flex-start; gap: 8px;">
          <div style="display: flex; justify-content: space-between; width: 100%;">
            <div class="setting-label">Answer Dwell Hold Duration</div>
            <div id="dwell-val" class="setting-desc" style="color: #38bdf8;">${this.dwellMs}ms</div>
          </div>
          <input type="range" id="range-dwell" min="250" max="800" step="50" value="${this.dwellMs}" style="width: 100%;">
        </div>
      </div>
    `;

    this.modalEl.querySelector('#modal-close')?.addEventListener('click', () => this.toggleSettingsModal());
    this.modalEl.querySelector('#chk-hands-only')?.addEventListener('change', (e) => {
      this.handsOnly = (e.target as HTMLInputElement).checked;
      this.callbacks.onToggleHandsOnly();
    });
    this.modalEl.querySelector('#chk-reduced-motion')?.addEventListener('change', (e) => {
      this.reducedMotion = (e.target as HTMLInputElement).checked;
      this.callbacks.onToggleReducedMotion();
    });
    this.modalEl.querySelector('#chk-debug')?.addEventListener('change', (e) => {
      this.showDebug = (e.target as HTMLInputElement).checked;
      this.callbacks.onToggleDebug();
    });
    this.modalEl.querySelector('#range-dwell')?.addEventListener('input', (e) => {
      this.dwellMs = Number((e.target as HTMLInputElement).value);
      const valEl = this.modalEl.querySelector('#dwell-val');
      if (valEl) valEl.textContent = `${this.dwellMs}ms`;
      this.callbacks.onDwellChange(this.dwellMs);
    });
  }
}
