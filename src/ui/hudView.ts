import { soundManager } from '../audio/soundEffects';
import versionText from '../data/version.txt?raw';
import { SolverMode, DEFAULT_MODE } from '../math/types';
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
  onToggleStoryMode: (enabled: boolean) => void;
  onToggleSkipTutorial?: (enabled: boolean) => void;
  onToggleCameraAutoStart?: (enabled: boolean) => void;
  onChooseKeyboard?: () => void;
  onCameraDockChange?: (dock: 'left' | 'right') => void;
  onDesktopDockChange?: (dock: 'left' | 'right') => void;
}

export class HudView {
  private headerEl: HTMLElement;
  private footerEl: HTMLElement;
  private modalEl: HTMLElement;
  private debugEl: HTMLElement;
  private bannerEl: HTMLElement;
  private callbacks: HudCallbacks;

  private currentMode: SolverMode = DEFAULT_MODE;
  private isMuted: boolean = false;
  private isCameraActive: boolean = false;
  private showDebug: boolean = false;
  private handsOnly: boolean = false;
  private reducedMotion: boolean = false;
  private dwellMs: number = 450;
  private isModalOpen: boolean = false;
  private storyModeEnabled: boolean = true;
  private skipTutorial: boolean = false;
  private cameraAutoStart: boolean = true;
  private cameraDock: 'left' | 'right' = 'right';
  private desktopDock: 'left' | 'right' = 'left';

  constructor(
    header: HTMLElement,
    footer: HTMLElement,
    modal: HTMLElement,
    debug: HTMLElement,
    banner: HTMLElement,
    callbacks: HudCallbacks,
    initialMode: SolverMode = DEFAULT_MODE,
    initialStoryMode: boolean = true
  ) {
    this.headerEl = header;
    this.footerEl = footer;
    this.modalEl = modal;
    this.debugEl = debug;
    this.bannerEl = banner;
    this.callbacks = callbacks;
    this.currentMode = initialMode;
    this.storyModeEnabled = initialStoryMode;
    try {
      this.skipTutorial = localStorage.getItem('algebra_skip_tutorial') === 'true';
      this.cameraAutoStart = localStorage.getItem('algebra_camera_enabled') !== 'false';
      this.cameraDock = localStorage.getItem('algebra_camera_dock') === 'left' ? 'left' : 'right';
      this.desktopDock = localStorage.getItem('algebra_desktop_dock') === 'right' ? 'right' : 'left';
    } catch {}
    this.renderHeader();
    this.renderFooter('Get Y on its own.');

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        this.toggleSettingsModal();
      } else if (e.key === 'Escape' && this.isModalOpen) {
        this.toggleSettingsModal();
      }
    });
  }

  public setStoryMode(enabled: boolean) {
    this.storyModeEnabled = enabled;
    const chk = this.modalEl.querySelector<HTMLInputElement>('#chk-story-mode');
    if (chk) {
      chk.checked = enabled;
    }
  }

  public setSkipTutorial(enabled: boolean) {
    this.skipTutorial = enabled;
    const chk = this.modalEl.querySelector<HTMLInputElement>('#chk-skip-tutorial');
    if (chk) {
      chk.checked = enabled;
    }
  }

  public setDesktopDock(dock: 'left' | 'right') {
    this.desktopDock = dock;
    const checkbox = this.modalEl.querySelector<HTMLInputElement>('#chk-desktop-dock-right');
    if (checkbox) checkbox.checked = dock === 'right';
  }

  public setMode(mode: SolverMode) {
    this.currentMode = mode;
    this.modalEl.querySelectorAll<HTMLButtonElement>('.mode-toggle-btn').forEach(btn => {
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

  public setCameraAutoStart(enabled: boolean) {
    this.cameraAutoStart = enabled;
    const checkbox = this.modalEl.querySelector<HTMLInputElement>('#chk-camera-remember');
    if (checkbox) checkbox.checked = enabled;
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
      if (this.debugEl.style.display !== 'none') {
        this.debugEl.style.display = 'none';
      }
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
        <button id="banner-btn-dismiss" class="banner-btn-dismiss">Play without camera</button>
      `;

      this.bannerEl.querySelector('#banner-btn-enable')?.addEventListener('click', () => {
        this.callbacks.onEnableCamera();
        this.bannerEl.style.display = 'none';
      });

      this.bannerEl.querySelector('#banner-btn-dismiss')?.addEventListener('click', () => {
        try {
          localStorage.setItem('algebra_camera_enabled', 'false');
        } catch {}
        this.cameraAutoStart = false;
        const chk = this.modalEl.querySelector<HTMLInputElement>('#chk-camera-remember');
        if (chk) chk.checked = false;
        this.bannerEl.style.display = 'none';
        this.callbacks.onChooseKeyboard?.();
      });
    }
  }

  private updateCameraBtn() {
    const btn = this.headerEl.querySelector<HTMLButtonElement>('#btn-toggle-camera');
    if (btn) {
      const label = this.isCameraActive ? 'Camera Active' : 'Enable Camera';
      btn.className = `icon-btn ${this.isCameraActive ? 'active' : ''}`;
      btn.innerHTML = `<span class="control-icon" aria-hidden="true">📷</span><span class="camera-button-label">${label}</span>`;
      btn.title = this.isCameraActive ? 'Stop camera' : 'Enable camera';
      btn.setAttribute('aria-label', btn.title);
      btn.setAttribute('aria-pressed', String(this.isCameraActive));
    }
  }

  public renderHeader() {
    this.headerEl.innerHTML = `
      <div class="brand-title">
        <span>Magic Finger Algebra</span>
      </div>
      <div class="header-controls">
        <button id="btn-toggle-camera" class="icon-btn" title="Enable camera" aria-label="Enable camera" aria-pressed="false">
          <span class="control-icon" aria-hidden="true">📷</span><span class="camera-button-label">Enable Camera</span>
        </button>
        <button id="btn-settings" class="icon-btn" title="Settings & Solver Modes (Press M)" aria-label="Settings & Solver Modes">
          <span class="control-icon" aria-hidden="true">⚙️</span><span class="settings-button-label">Settings</span>
        </button>
      </div>
    `;

    this.headerEl.querySelector('#btn-toggle-camera')?.addEventListener('click', () => {
      this.callbacks.onEnableCamera();
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
        <button id="btn-version" class="version-badge" title="Click to view Version Notes">v1.12.14</button>
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
          <button id="modal-close" class="icon-btn" style="padding: 4px 10px;" title="Close (Escape)">✕</button>
        </div>
        <div class="setting-section">
          <div class="setting-section-title">Solver Mode</div>
          <div class="mode-toggle-group in-settings" role="group" aria-label="Equation interaction mode">
            ${MODE_DEFINITIONS.map(m => `
              <button id="btn-${m.id.replace('_', '-')}" data-mode="${m.id}" class="mode-toggle-btn ${this.currentMode === m.id ? 'active' : ''}" title="${m.title}">
                <span class="mode-icon">${m.icon}</span>
                <span class="mode-label">${m.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Sound Effects</div>
            <div class="setting-desc">Laser audio and celebration sounds</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-sound" ${!this.isMuted ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Story Mode</div>
            <div class="setting-desc">Magic shop items, word problems & equation matching</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-story-mode" ${this.storyModeEnabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Hands-Only View</div>
            <div class="setting-desc">Hide webcam video, show glowing hand skeleton only</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-hands-only" ${this.handsOnly ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Reduced Motion</div>
            <div class="setting-desc">Instant math transitions without flying particles</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-reduced-motion" ${this.reducedMotion ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Debug Inspector</div>
            <div class="setting-desc">Show real-time ray hitboxes and FPS overlay</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-debug" ${this.showDebug ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Skip Tutorial Problems</div>
            <div class="setting-desc">Skip the 4 pure intro levels (+, −, ×, ÷) and jump to multi-family equations</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-skip-tutorial" ${this.skipTutorial ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Remember Camera Access</div>
            <div class="setting-desc">Auto-start the camera on future visits.<span style="display: block; color: #fbbf24; font-size: 11px; margin-top: 2px;">💡 iOS controls permission prompts. To stop repeat prompts, tap <strong>aA</strong> in Safari → Website Settings → Camera → Allow.</span></div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-camera-remember" ${this.cameraAutoStart ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Selections on Right (Desktop)</div>
            <div class="setting-desc">Dock all selections to the right of the camera. Toggle off to dock to the left for one-handed play.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-desktop-dock-right" ${this.desktopDock === 'right' ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Camera on Right (Mobile)</div>
            <div class="setting-desc">Dock the camera on the right and question choices on the left in portrait mode.</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="chk-camera-right" ${this.cameraDock === 'right' ? 'checked' : ''}>
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

    this.modalEl.querySelector('.mode-toggle-group')?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.mode-toggle-btn');
      if (!btn) return;
      const mode = btn.dataset.mode as SolverMode;
      if (mode && this.currentMode !== mode) {
        this.setMode(mode);
        this.callbacks.onModeChange(mode);
      }
    });

    this.modalEl.querySelector('#chk-sound')?.addEventListener('change', (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.isMuted = !checked;
      soundManager.setMuted(this.isMuted);
      this.callbacks.onToggleMute();
    });

    this.modalEl.querySelector('#chk-story-mode')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).checked;
      this.setStoryMode(val);
      this.callbacks.onToggleStoryMode(val);
    });

    this.modalEl.querySelector('#chk-skip-tutorial')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).checked;
      this.skipTutorial = val;
      try {
        localStorage.setItem('algebra_skip_tutorial', String(val));
      } catch {}
      this.callbacks.onToggleSkipTutorial?.(val);
    });

    this.modalEl.querySelector('#chk-camera-remember')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).checked;
      this.cameraAutoStart = val;
      try {
        localStorage.setItem('algebra_camera_enabled', String(val));
      } catch {}
      this.callbacks.onToggleCameraAutoStart?.(val);
    });

    this.modalEl.querySelector('#chk-camera-right')?.addEventListener('change', (e) => {
      this.cameraDock = (e.target as HTMLInputElement).checked ? 'right' : 'left';
      try {
        localStorage.setItem('algebra_camera_dock', this.cameraDock);
      } catch {}
      this.callbacks.onCameraDockChange?.(this.cameraDock);
    });

    this.modalEl.querySelector('#chk-desktop-dock-right')?.addEventListener('change', (e) => {
      this.desktopDock = (e.target as HTMLInputElement).checked ? 'right' : 'left';
      try {
        localStorage.setItem('algebra_desktop_dock', this.desktopDock);
      } catch {}
      this.callbacks.onDesktopDockChange?.(this.desktopDock);
    });

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
