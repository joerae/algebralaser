import { GameController } from './game/gameController';
import { InteractionController } from './game/interactionController';
import { CameraManager } from './vision/cameraManager';
import { HandLandmarkerService } from './vision/handLandmarkerService';
import { CanvasOverlay } from './ui/canvasOverlay';
import { EquationView } from './ui/equationView';
import { AnswersView } from './ui/answersView';
import { HudView } from './ui/hudView';
import { classifyHandPose } from './vision/poseClassifier';
import { computeLaserRay } from './vision/coordinateTransform';
import { RaySmoother, castRayAgainstTargets, InteractiveTarget } from './vision/rayCaster';
import { LaserRay } from './vision/types';

class App {
  private game: GameController;
  private interaction: InteractionController;
  private camera: CameraManager;
  private landmarker: HandLandmarkerService;
  private canvasOverlay: CanvasOverlay;
  private equationView: EquationView;
  private answersView: AnswersView;
  private hudView: HudView;
  private raySmoother: RaySmoother;

  private videoEl: HTMLVideoElement;
  private isCameraRunning: boolean = false;

  constructor() {
    // 1. Initialize DOM references
    const canvasEl = document.getElementById('canvas-overlay') as HTMLCanvasElement;
    this.videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    const equationArea = document.getElementById('equation-area') as HTMLElement;
    const answersColumn = document.getElementById('answers-column') as HTMLElement;
    const hudHeader = document.getElementById('hud-header') as HTMLElement;
    const hudFooter = document.getElementById('hud-footer') as HTMLElement;
    const modalEl = document.getElementById('settings-modal') as HTMLElement;
    const debugEl = document.getElementById('debug-overlay') as HTMLElement;
    const bannerEl = document.getElementById('camera-banner') as HTMLElement;

    // 2. Core Controllers & Services
    this.game = new GameController();
    this.interaction = new InteractionController(this.game);
    this.camera = new CameraManager();
    this.landmarker = new HandLandmarkerService();
    this.canvasOverlay = new CanvasOverlay(canvasEl);
    this.raySmoother = new RaySmoother(0.35);

    // 3. UI Views
    this.equationView = new EquationView(equationArea, {
      onPickup: (term) => this.game.pickup(term),
      onDrop: () => this.game.drop(),
      onNext: () => this.game.nextLevel(),
      onReplay: () => this.game.restartLevel()
    });

    this.answersView = new AnswersView(answersColumn, (choice) => {
      this.game.answer(choice);
    });

    this.hudView = new HudView(hudHeader, hudFooter, modalEl, debugEl, bannerEl, {
      onEnableCamera: () => this.startCamera(),
      onToggleMute: () => {},
      onToggleDebug: () => {
        this.canvasOverlay.showDebug = !this.canvasOverlay.showDebug;
      },
      onToggleHandsOnly: () => {
        this.canvasOverlay.handsOnly = !this.canvasOverlay.handsOnly;
      },
      onToggleReducedMotion: () => {
        this.game.reducedMotion = !this.game.reducedMotion;
      },
      onDwellChange: (dwellMs) => {
        this.interaction.dwellDurationMs = dwellMs;
      },
      onUndo: () => this.game.performUndo(),
      onHint: () => alert(this.game.getHint()),
      onRestart: () => this.game.restartLevel()
    });

    // 4. Connect State Updates
    this.game.subscribe((state, extra) => {
      this.updateView(state, extra);
    });

    // 5. Setup Mouse, Touch and Keyboard
    this.setupInputListeners();

    // 6. Show Camera Banner
    this.hudView.showCameraBanner();

    // 7. Start Animation & Vision Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  private updateView(state = this.game.getState(), extra = { currentLevel: this.game.getCurrentLevelNumber(), totalLevels: this.game.getTotalLevels() }) {
    const interState = this.interaction.getState();
    this.equationView.render(state, interState.isDestinationHovered, interState.carriedPosition);
    this.answersView.render(state.pendingArithmetic, interState.hoveredTargetId, interState.dwellProgress);
    this.hudView.updateProgress(extra.currentLevel, extra.totalLevels);

    // Contextual instruction
    let instr = 'Get x on its own.';
    if (state.phase === 'ready') {
      if (state.stage === 'undo_constant') {
        const sign = state.currentB < 0 ? '−' : '+';
        instr = `Point laser at ${sign}${Math.abs(state.currentB)} or drag it across = to undo it.`;
      } else if (state.stage === 'undo_coefficient') {
        instr = `Point laser at ${state.currentA} or drag it beneath = to divide.`;
      }
    } else if (state.phase === 'carrying') {
      instr = 'Aim across = to the target, then curl your index finger (or release mouse) to drop.';
    } else if (state.phase === 'question') {
      instr = 'Aim laser at an answer card and hold to confirm, or click.';
    } else if (state.phase === 'solved') {
      instr = 'Equation balanced! Click Next Puzzle to continue.';
    }
    this.hudView.updateInstruction(instr);
  }

  private async startCamera() {
    const startRes = await this.camera.startCamera(this.videoEl);
    if (!startRes.success) {
      alert(startRes.error || 'Unable to access camera.');
      return;
    }

    const landmarkerRes = await this.landmarker.initialize();
    if (!landmarkerRes.success) {
      alert(landmarkerRes.error || 'Unable to load hand landmarker.');
      this.camera.stopCamera();
      return;
    }

    this.isCameraRunning = true;
    this.hudView.setCameraState(true);
  }

  private loop(timestamp: number) {
    const now = timestamp;
    const nowSec = performance.now();

    let hands = null;
    let laserRay: LaserRay | null = null;
    let hitResult = null;
    let classifiedPose = null;
    let interactiveTargets: InteractiveTarget[] = [];

    // Collect interactive targets from DOM
    interactiveTargets = this.collectTargets();

    if (this.isCameraRunning && this.videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      hands = this.landmarker.detect(this.videoEl, nowSec);

      if (hands && hands.length > 0) {
        // Choose primary hand (first hand or matching locked hand)
        const primaryHand = hands[0];
        classifiedPose = classifyHandPose(primaryHand.landmarks, primaryHand.score);

        const viewport = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const rawRay = computeLaserRay(
          primaryHand.landmarks[8], // index tip
          primaryHand.landmarks[6], // index pip
          viewport,
          true
        );

        const smoothed = this.raySmoother.smooth(rawRay.origin, rawRay.direction);

        laserRay = {
          origin: smoothed.origin,
          direction: smoothed.direction,
          active: classifiedPose.isPointing
        };

        if (laserRay.active) {
          hitResult = castRayAgainstTargets(laserRay, interactiveTargets);
          laserRay.targetHit = hitResult;
        }

        this.hudView.updateDebugInfo({
          inferenceFps: this.landmarker.inferenceFps,
          inferenceDuration: this.landmarker.inferenceDuration,
          isPointing: classifiedPose.isPointing,
          isCurled: classifiedPose.isIndexCurled,
          isOpenPalm: classifiedPose.isOpenPalm,
          handedness: primaryHand.handedness
        });
      }
    }

    // Update interaction controller with vision frame
    this.interaction.updateVisionFrame(laserRay, classifiedPose, hitResult, now);

    // Re-render UI if carrying or dwelling
    const interState = this.interaction.getState();
    const gameState = this.game.getState();

    if (gameState.phase === 'carrying' || gameState.phase === 'question') {
      this.equationView.render(gameState, interState.isDestinationHovered, interState.carriedPosition);
      this.answersView.render(gameState.pendingArithmetic, interState.hoveredTargetId, interState.dwellProgress);
    }

    // Render Canvas Overlay (camera video, hand skeleton, laser, particles)
    this.canvasOverlay.render(
      this.videoEl,
      hands,
      laserRay,
      hitResult,
      interState.carriedPosition,
      interactiveTargets
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private collectTargets(): InteractiveTarget[] {
    const targets: InteractiveTarget[] = [];
    const eqTargets = this.equationView.getInteractiveElements();
    const ansTargets = this.answersView.getInteractiveElements();

    eqTargets.forEach(t => {
      const rect = t.element.getBoundingClientRect();
      // Add padding for friendly acquisition
      const pad = 12;
      targets.push({
        id: t.id,
        type: t.type,
        rect: {
          left: rect.left - pad,
          top: rect.top - pad,
          right: rect.right + pad,
          bottom: rect.bottom + pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2
        },
        enabled: true,
        priority: 1
      });
    });

    ansTargets.forEach(t => {
      const rect = t.element.getBoundingClientRect();
      const pad = 10;
      targets.push({
        id: t.id,
        type: t.type,
        rect: {
          left: rect.left - pad,
          top: rect.top - pad,
          right: rect.right + pad,
          bottom: rect.bottom + pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2
        },
        enabled: true,
        priority: 2
      });
    });

    // Solved Next button
    const nextBtn = document.getElementById('btn-next');
    if (nextBtn) {
      const rect = nextBtn.getBoundingClientRect();
      targets.push({
        id: 'btn-next',
        type: 'utility',
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        },
        enabled: true
      });
    }

    return targets;
  }

  private setupInputListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.interaction.handleKeyDown(e);
    });

    // Mouse Dragging for Carried Term
    window.addEventListener('mousemove', (e) => {
      const gameState = this.game.getState();
      if (gameState.phase === 'carrying') {
        const dest = document.getElementById('drop-destination');
        let isDestHovered = false;
        if (dest) {
          const rect = dest.getBoundingClientRect();
          isDestHovered = (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
          );
        }
        const interState = this.interaction.getState();
        interState.carriedPosition = { x: e.clientX, y: e.clientY };
        interState.isDestinationHovered = isDestHovered;
        this.equationView.render(gameState, isDestHovered, interState.carriedPosition);
      }
    });

    window.addEventListener('mouseup', () => {
      const gameState = this.game.getState();
      if (gameState.phase === 'carrying') {
        const interState = this.interaction.getState();
        if (interState.isDestinationHovered) {
          this.game.drop();
        } else {
          this.game.cancel();
        }
        interState.carriedPosition = null;
        interState.isDestinationHovered = false;
      }
    });
  }
}

// Bootstrap when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
