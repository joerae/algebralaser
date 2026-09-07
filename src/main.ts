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
import { soundManager } from './audio/soundEffects';

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
  private bubbleEl: HTMLElement | null = null;
  private arrowSvgEl: SVGSVGElement | null = null;
  private arrowPathEl: SVGPathElement | null = null;
  private cameraBoxEl: HTMLElement | null = null;
  private answersColumnEl: HTMLElement | null = null;
  private isCameraRunning: boolean = false;
  private wasSnapped: boolean = false;
  private wasCrossed: boolean = false;
  private snapStartTime: number | null = null;
  private isPopping: boolean = false;
  private cachedTargets: InteractiveTarget[] = [];
  private needTargetsRefresh: boolean = true;

  constructor() {
    // 1. Initialize DOM references
    const canvasEl = document.getElementById('canvas-overlay') as HTMLCanvasElement;
    this.videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    this.bubbleEl = document.getElementById('carried-bubble');
    this.arrowSvgEl = document.getElementById('equation-arrow-svg') as unknown as SVGSVGElement | null;
    this.arrowPathEl = document.getElementById('connector-arrow-path') as unknown as SVGPathElement | null;
    this.cameraBoxEl = document.getElementById('camera-box');
    this.answersColumnEl = document.getElementById('answers-column');
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
    this.raySmoother = new RaySmoother(0.38, 0.85);

    // Wire arithmetic RHS collapse animation before advancing to next step
    this.game.onBeforeCorrectAdvance = (correctVal, done) => {
      this.equationView.triggerCollapse(correctVal, done);
    };

    // Wire index curl / hold drop to popping animation
    this.interaction.onDropRequested = () => {
      this.popBubbleAndDrop();
    };

    window.addEventListener('resize', () => {
      this.needTargetsRefresh = true;
    });

    // 3. UI Views
    this.equationView = new EquationView(equationArea, {
      onPickup: (term) => this.game.pickup(term),
      onDrop: () => this.popBubbleAndDrop(),
      onNext: () => this.game.nextLevel(),
      onReplay: () => this.game.restartLevel()
    });

    this.answersView = new AnswersView(answersColumn, (choice) => {
      this.game.answer(choice);
    });

    this.hudView = new HudView(hudHeader, hudFooter, modalEl, debugEl, bannerEl, {
      onEnableCamera: () => this.toggleCamera(),
      onToggleMute: () => {},
      onToggleDebug: () => {
        this.canvasOverlay.showDebug = !this.canvasOverlay.showDebug;
      },
      onToggleHandsOnly: () => {
        this.canvasOverlay.handsOnly = !this.canvasOverlay.handsOnly;
        if (this.canvasOverlay.handsOnly) {
          this.videoEl.classList.add('hands-only');
        } else {
          this.videoEl.classList.remove('hands-only');
        }
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
    this.equationView.render(state);
    this.answersView.render(state.pendingArithmetic);
    this.hudView.updateProgress(extra.currentLevel, extra.totalLevels);
    this.needTargetsRefresh = true;

    // Contextual instruction
    let instr = 'Get Y on its own.';
    if (state.phase === 'ready') {
      if (state.stage === 'undo_constant') {
        const sign = state.currentB < 0 ? '−' : '+';
        instr = `Point laser at ${sign}${Math.abs(state.currentB)} or drag it across = to undo it.`;
      } else if (state.stage === 'undo_coefficient') {
        instr = `Point laser at ${state.currentA} or drag it beneath = to divide.`;
      }
    } else if (state.phase === 'carrying') {
      instr = 'Drag across = to the drop zone and hold to pop the bubble!';
    } else if (state.phase === 'question') {
      instr = 'Aim laser at an answer card and hold to confirm, or click.';
      // Position answer column immediately so it is rendered in place
      this.updateArrowAndLayout(state.phase);
    } else if (state.phase === 'solved') {
      instr = 'Equation balanced! Aim at Next Puzzle → or hold Open Palm 👋 to continue.';
    }
    this.hudView.updateInstruction(instr);

    // Contextual camera badge hint
    const hintBadge = document.getElementById('camera-hint-badge');
    if (hintBadge) {
      if (state.phase === 'ready') {
        hintBadge.textContent = 'Point up at equation ☝️';
      } else if (state.phase === 'carrying') {
        hintBadge.textContent = 'Drag term to drop slot 🧲';
      } else if (state.phase === 'question') {
        hintBadge.textContent = 'Aim laser at answer 👉';
      } else if (state.phase === 'solved') {
        hintBadge.textContent = 'Show Open Palm 👋 or Point Next';
      }
    }
  }

  private async toggleCamera() {
    if (this.isCameraRunning) {
      this.camera.stopCamera();
      this.isCameraRunning = false;
      this.hudView.setCameraState(false);
      this.videoEl.classList.remove('active');
      document.getElementById('camera-box')?.classList.remove('active');
      document.getElementById('camera-status-dot')?.classList.remove('active');
      const placeholder = document.getElementById('camera-placeholder');
      if (placeholder) placeholder.style.display = 'flex';
      this.hudView.updateInstruction('Camera stopped. Mouse & keyboard active.');
      return;
    }
    await this.startCamera();
  }

  private async startCamera() {
    this.hudView.updateInstruction('Requesting camera access...');
    const startRes = await this.camera.startCamera(this.videoEl);
    if (!startRes.success) {
      alert(startRes.error || 'Unable to access camera.');
      this.hudView.updateInstruction('Camera unavailable. Playing with mouse & keyboard.');
      return;
    }

    this.hudView.updateInstruction('Loading hand tracking model...');
    const landmarkerRes = await this.landmarker.initialize();
    if (!landmarkerRes.success) {
      alert(landmarkerRes.error || 'Unable to load hand landmarker.');
      this.camera.stopCamera();
      this.hudView.updateInstruction('Hand tracking model failed to load. Playing with mouse.');
      return;
    }

    this.isCameraRunning = true;
    this.hudView.setCameraState(true);
    this.videoEl.classList.add('active');
    document.getElementById('camera-box')?.classList.add('active');
    document.getElementById('camera-status-dot')?.classList.add('active');
    const placeholder = document.getElementById('camera-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    this.hudView.updateInstruction('Camera & finger laser active! Point your index finger.');
  }

  private loop(timestamp: number) {
    const now = timestamp;
    const nowSec = performance.now();

    let hands = null;
    let laserRay: LaserRay | null = null;
    let hitResult = null;
    let classifiedPose = null;
    let interactiveTargets: InteractiveTarget[] = [];

    // Position answers column and arrow FIRST before gathering bounding boxes
    const currentPhase = this.game.getState().phase;
    this.updateArrowAndLayout(currentPhase);

    // Collect interactive targets from DOM
    interactiveTargets = this.collectTargets();

    // Determine camera viewport bounds (1/3 screen box)
    const cameraFeedEl = document.getElementById('camera-feed-container');
    const cameraRect = cameraFeedEl ? cameraFeedEl.getBoundingClientRect() : {
      left: window.innerWidth * 0.35,
      top: window.innerHeight * 0.6,
      width: window.innerWidth * 0.3,
      height: window.innerHeight * 0.35
    };
    const cameraViewport = {
      left: cameraRect.left,
      top: cameraRect.top,
      width: cameraRect.width,
      height: cameraRect.height
    };

    if (this.isCameraRunning && this.videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      hands = this.landmarker.detect(this.videoEl, nowSec);

      if (hands && hands.length > 0) {
        // Choose primary hand (first hand or matching locked hand)
        const primaryHand = hands[0];
        classifiedPose = classifyHandPose(primaryHand.landmarks, primaryHand.score);

        const rawRay = computeLaserRay(
          primaryHand.landmarks[8], // index tip
          primaryHand.landmarks[6], // index pip
          cameraViewport,
          true,
          primaryHand.landmarks[5]  // index mcp knuckle for rock-solid stability
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

    const interState = this.interaction.getState();
    const gameState = this.game.getState();

    // Process Carried Bubble Position & Magnetic Snapping
    if (gameState.phase === 'carrying' && gameState.carriedTerm && !this.isPopping) {
      const destEl = document.getElementById('drop-destination');
      let targetX = interState.carriedPosition?.x || (window.innerWidth / 2);
      let targetY = interState.carriedPosition?.y || 160;
      let isSnapped = false;

      if (destEl) {
        const destRect = destEl.getBoundingClientRect();
        const destCenter = {
          x: destRect.left + destRect.width / 2,
          y: destRect.top + destRect.height / 2
        };

        // If laser is active, project ray onto destination rail height
        if (laserRay && laserRay.active) {
          const t = (destCenter.y - laserRay.origin.y) / laserRay.direction.y;
          if (t > 0) {
            targetX = laserRay.origin.x + t * laserRay.direction.x;
            targetY = destCenter.y;
          }
        }

        // Check magnetic snapping distance
        const dist = Math.hypot(targetX - destCenter.x, targetY - destCenter.y);
        isSnapped = dist < 120;

        if (isSnapped) {
          targetX = destCenter.x;
          targetY = destCenter.y;
          interState.isDestinationHovered = true;
          if (!this.wasSnapped) {
            soundManager.playSnap();
            this.wasSnapped = true;
          }
        } else {
          interState.isDestinationHovered = false;
          this.wasSnapped = false;
        }
      }

      interState.carriedPosition = { x: targetX, y: targetY };

      // Equals X coordinate check for dynamic sign flip
      const equalsX = this.equationView.getEqualsX();
      const isCrossed = targetX >= equalsX;

      if (isCrossed && !this.wasCrossed) {
        soundManager.playSnap();
        this.wasCrossed = true;
      } else if (!isCrossed && this.wasCrossed) {
        soundManager.playSnap();
        this.wasCrossed = false;
      }

      // Update DOM Floating Bubble
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'flex';
        this.bubbleEl.style.left = `${targetX}px`;
        this.bubbleEl.style.top = `${targetY}px`;
        this.bubbleEl.classList.toggle('crossed', isCrossed);
        this.bubbleEl.classList.toggle('snapped', isSnapped);

        const caption = this.bubbleEl.querySelector('.bubble-caption');
        const termEl = this.bubbleEl.querySelector('.bubble-term');

        // Dynamic sign and operation color flip inside bubble
        this.bubbleEl.classList.remove('op-plus', 'op-minus', 'op-times', 'op-divide');
        if (termEl) {
          if (gameState.carriedTerm === 'constant') {
            const isNeg = gameState.currentB < 0;
            const absB = Math.abs(gameState.currentB);
            if (isCrossed) {
              // Inverted operation after crossing equals sign
              const flippedSign = isNeg ? '+' : '−';
              termEl.textContent = `${flippedSign}${absB}`;
              this.bubbleEl.classList.add(isNeg ? 'op-plus' : 'op-minus');
            } else {
              // Original operation on LHS
              const origSign = isNeg ? '−' : '+';
              termEl.textContent = `${origSign}${absB}`;
              this.bubbleEl.classList.add(isNeg ? 'op-minus' : 'op-plus');
            }
          } else if (gameState.carriedTerm === 'coefficient') {
            if (isCrossed) {
              termEl.textContent = `÷ ${gameState.currentA}`;
              this.bubbleEl.classList.add('op-divide');
            } else {
              termEl.textContent = `x ${gameState.currentA}`;
              this.bubbleEl.classList.add('op-times');
            }
          }
        }

        // Hold-to-pop logic with physical progress ring (1 second hold)
        const HOLD_DURATION_MS = 1000;
        const ringFill = this.bubbleEl.querySelector<SVGCircleElement>('.bubble-ring-fill');
        const circumference = 2 * Math.PI * 45; // ~283

        if (isSnapped) {
          if (!this.snapStartTime) {
            this.snapStartTime = now;
          }
          const holdDuration = now - this.snapStartTime;
          const progress = Math.min(1.0, holdDuration / HOLD_DURATION_MS);

          // Update SVG progress ring
          if (ringFill) {
            const offset = circumference * (1 - progress);
            ringFill.style.strokeDashoffset = `${offset}`;
          }

          // Ticking audio feedback at milestones
          if (progress > 0.15 && holdDuration % 120 < 18) {
            soundManager.playDwellTick(progress);
          }

          if (caption) {
            if (progress < 0.5) {
              caption.textContent = 'Hold...';
            } else if (progress < 0.85) {
              caption.textContent = 'Almost...';
            } else {
              caption.textContent = 'POP!';
            }
          }

          if (progress >= 1.0) {
            this.popBubbleAndDrop();
          }
        } else {
          this.snapStartTime = null;
          // Reset progress ring when leaving snap zone
          if (ringFill) {
            ringFill.style.strokeDashoffset = `${circumference}`;
          }
          if (caption) {
            caption.textContent = isCrossed ? 'Drag to Landing Slot' : 'Move across =';
          }
        }
      }
    } else if (!this.isPopping) {
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'none';
        // Reset ring when bubble hides
        const ringFill = this.bubbleEl.querySelector<SVGCircleElement>('.bubble-ring-fill');
        if (ringFill) ringFill.style.strokeDashoffset = `${2 * Math.PI * 45}`;
      }
      this.wasSnapped = false;
      this.wasCrossed = false;
      this.snapStartTime = null;
    }

    // 60 FPS lightweight updates (ZERO DOM innerHTML rebuilds!)
    this.equationView.setDestinationHovered(interState.isDestinationHovered);
    this.answersView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);

    if (gameState.phase === 'solved') {
      this.equationView.updateSolvedDwell(
        interState.hoveredTargetId,
        interState.dwellProgress,
        interState.openPalmProgress
      );
    }

    // Render Canvas Overlay (hand skeleton, laser, particles)
    this.canvasOverlay.render(
      hands,
      laserRay,
      hitResult,
      interState.carriedPosition,
      cameraViewport,
      interactiveTargets
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateArrowAndLayout(phase: string) {
    if (phase !== 'question') {
      if (this.arrowSvgEl) this.arrowSvgEl.style.display = 'none';
      return;
    }

    if (!this.cameraBoxEl || !this.answersColumnEl) return;

    // 1. Position answers column snug next to the right edge of camera box
    const cameraRect = this.cameraBoxEl.getBoundingClientRect();
    const columnWidth = 260;

    let left = cameraRect.right + 18;
    // Clamp if window is narrower
    if (left + columnWidth > window.innerWidth - 14) {
      left = Math.max(14, window.innerWidth - columnWidth - 14);
    }
    const top = Math.max(65, cameraRect.top);

    this.answersColumnEl.style.left = `${left}px`;
    this.answersColumnEl.style.top = `${top}px`;
    this.answersColumnEl.style.right = 'auto';

    // 2. Compute curving arrow from equation term around camera corner to question
    const termEl = document.getElementById('arithmetic-rhs');
    const questionCard = this.answersColumnEl.querySelector<HTMLElement>('.arithmetic-question');

    if (termEl && questionCard && this.arrowSvgEl && this.arrowPathEl) {
      const termRect = termEl.getBoundingClientRect();
      const qRect = questionCard.getBoundingClientRect();

      // Start: right side of the unsimplified equation term
      const startX = termRect.right + 6;
      const startY = termRect.top + termRect.height / 2;

      // End: left side of the arithmetic question card (with room for arrowhead)
      const endX = qRect.left - 10;
      const endY = qRect.top + 28;

      // Corner control point around top-right of camera frame
      const cornerX = Math.max(startX + 30, Math.min(cameraRect.right + 10, endX - 10));

      // Cubic Bezier curve:
      // Starts horizontal from equation -> sweeps past top of camera -> turns down & right into question
      const cp1X = cornerX;
      const cp1Y = startY;
      const cp2X = cornerX;
      const cp2Y = endY;

      const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      this.arrowPathEl.setAttribute('d', d);
      this.arrowSvgEl.style.display = 'block';
    } else if (this.arrowSvgEl) {
      this.arrowSvgEl.style.display = 'none';
    }
  }

  private popBubbleAndDrop() {
    if (this.isPopping) return;
    this.isPopping = true;
    this.snapStartTime = null;
    this.wasSnapped = false;
    soundManager.playPop();

    if (this.bubbleEl) {
      this.bubbleEl.classList.add('popping');
    }

    // Match the bubbleBurst animation duration (350ms)
    window.setTimeout(() => {
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'none';
        this.bubbleEl.classList.remove('popping', 'snapped', 'crossed');
        // Reset the ring
        const ringFill = this.bubbleEl.querySelector<SVGCircleElement>('.bubble-ring-fill');
        if (ringFill) ringFill.style.strokeDashoffset = `${2 * Math.PI * 45}`;
      }
      this.isPopping = false;
      const interState = this.interaction.getState();
      interState.carriedPosition = null;
      interState.isDestinationHovered = false;
      this.game.drop();
    }, 350);
  }

  private collectTargets(): InteractiveTarget[] {
    const isDynamicPhase = this.game.getState().phase === 'question' || this.game.getState().phase === 'solved';
    if (!this.needTargetsRefresh && this.cachedTargets.length > 0 && !isDynamicPhase) {
      return this.cachedTargets;
    }

    const targets: InteractiveTarget[] = [];
    const eqTargets = this.equationView.getInteractiveElements();
    const ansTargets = this.answersView.getInteractiveElements();

    eqTargets.forEach(t => {
      const rect = t.element.getBoundingClientRect();
      const pad = 24;
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
      const pad = 22;
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
      const pad = 22;
      targets.push({
        id: 'btn-next',
        type: 'utility',
        rect: {
          left: rect.left - pad,
          top: rect.top - pad,
          right: rect.right + pad,
          bottom: rect.bottom + pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2
        },
        enabled: true,
        priority: 3
      });
    }

    // Solved Replay button
    const replayBtn = document.getElementById('btn-replay');
    if (replayBtn) {
      const rect = replayBtn.getBoundingClientRect();
      const pad = 16;
      targets.push({
        id: 'btn-replay',
        type: 'utility',
        rect: {
          left: rect.left - pad,
          top: rect.top - pad,
          right: rect.right + pad,
          bottom: rect.bottom + pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2
        },
        enabled: true,
        priority: 3
      });
    }

    this.cachedTargets = targets;
    this.needTargetsRefresh = false;
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
      if (gameState.phase === 'carrying' && !this.isPopping) {
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
        this.equationView.setDestinationHovered(isDestHovered);
      }
    });

    window.addEventListener('mouseup', () => {
      const gameState = this.game.getState();
      if (gameState.phase === 'carrying' && !this.isPopping) {
        const interState = this.interaction.getState();
        if (interState.isDestinationHovered) {
          this.popBubbleAndDrop();
        } else {
          this.game.cancel();
          interState.carriedPosition = null;
          interState.isDestinationHovered = false;
        }
      }
    });

    // Camera View Size Toggle (2x Large vs 1x Standard)
    const sizeBtn = document.getElementById('btn-camera-size');
    if (sizeBtn && this.cameraBoxEl) {
      const updateSizeUI = () => {
        const isCompact = this.cameraBoxEl?.classList.contains('size-compact');
        const label = document.getElementById('camera-size-label');
        if (label) {
          label.textContent = isCompact ? '1x View' : '2x View';
        }
        sizeBtn.setAttribute(
          'title',
          isCompact ? 'Click to expand to 2x Large View' : 'Click to shrink to 1x Standard View'
        );
      };

      // Restore saved preference if exists
      const savedPreference = localStorage.getItem('algebra_camera_size');
      if (savedPreference === 'compact') {
        this.cameraBoxEl.classList.add('size-compact');
      }
      updateSizeUI();

      sizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.cameraBoxEl?.classList.toggle('size-compact');
        const isNowCompact = this.cameraBoxEl?.classList.contains('size-compact');
        try {
          localStorage.setItem('algebra_camera_size', isNowCompact ? 'compact' : 'large');
        } catch {
          // localStorage may fail in private mode
        }
        updateSizeUI();
        this.needTargetsRefresh = true;
        this.updateArrowAndLayout(this.game.getState().phase);
      });
    }
  }
}

// Bootstrap when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
