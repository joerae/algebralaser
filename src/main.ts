import { GameController } from './game/gameController';
import { InteractionController } from './game/interactionController';
import { CameraManager } from './vision/cameraManager';
import { HandLandmarkerService } from './vision/handLandmarkerService';
import { CanvasOverlay, BlasterOverlayInfo } from './ui/canvasOverlay';
import { EquationView } from './ui/equationView';
import { AnswersView } from './ui/answersView';
import { HudView } from './ui/hudView';
import { ForgePanelView, ForgeSign } from './ui/forgePanelView';
import { BlasterPanelView } from './ui/blasterPanelView';
import { classifyHandPose } from './vision/poseClassifier';
import { computeLaserRay } from './vision/coordinateTransform';
import { RaySmoother, castRayAgainstTargets, InteractiveTarget } from './vision/rayCaster';
import { LaserRay } from './vision/types';
import { soundManager } from './audio/soundEffects';
import { SolverMode, BlasterType } from './math/types';

class App {
  private game: GameController;
  private interaction: InteractionController;
  private camera: CameraManager;
  private landmarker: HandLandmarkerService;
  private canvasOverlay: CanvasOverlay;
  private equationView: EquationView;
  private answersView: AnswersView;
  private forgePanelView: ForgePanelView;
  private blasterPanelView: BlasterPanelView;
  private hudView: HudView;
  private raySmoother: RaySmoother;

  private videoEl: HTMLVideoElement;
  private bubbleEl: HTMLElement | null = null;
  private splitLeftEl: HTMLElement | null = null;
  private splitRightEl: HTMLElement | null = null;
  private arrowSvgEl: SVGSVGElement | null = null;
  private arrowPathEl: SVGPathElement | null = null;
  private cameraBoxEl: HTMLElement | null = null;
  private answersColumnEl: HTMLElement | null = null;
  private forgePanelEl: HTMLElement | null = null;
  private blasterPanelEl: HTMLElement | null = null;
  private isCameraRunning: boolean = false;
  private wasSnapped: boolean = false;
  private wasCrossed: boolean = false;
  private snapStartTime: number | null = null;
  private isPopping: boolean = false;
  private isSplitting: boolean = false;
  private cachedTargets: InteractiveTarget[] = [];
  private needTargetsRefresh: boolean = true;

  constructor() {
    // 1. Initialize DOM references
    const canvasEl = document.getElementById('canvas-overlay') as HTMLCanvasElement;
    this.videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    this.bubbleEl = document.getElementById('carried-bubble');
    this.splitLeftEl = document.getElementById('split-bubble-left');
    this.splitRightEl = document.getElementById('split-bubble-right');
    this.arrowSvgEl = document.getElementById('equation-arrow-svg') as unknown as SVGSVGElement | null;
    this.arrowPathEl = document.getElementById('connector-arrow-path') as unknown as SVGPathElement | null;
    this.cameraBoxEl = document.getElementById('camera-box');
    this.answersColumnEl = document.getElementById('answers-column');
    this.forgePanelEl = document.getElementById('forge-panel');
    this.blasterPanelEl = document.getElementById('blaster-panel');
    const equationArea = document.getElementById('equation-area') as HTMLElement;
    const answersColumn = document.getElementById('answers-column') as HTMLElement;
    const forgePanel = document.getElementById('forge-panel') as HTMLElement;
    const blasterPanel = document.getElementById('blaster-panel') as HTMLElement;
    const hudHeader = document.getElementById('hud-header') as HTMLElement;
    const hudFooter = document.getElementById('hud-footer') as HTMLElement;
    const modalEl = document.getElementById('settings-modal') as HTMLElement;
    const debugEl = document.getElementById('debug-overlay') as HTMLElement;
    const bannerEl = document.getElementById('camera-banner') as HTMLElement;

    // 2. Core Controllers & Services
    const savedMode = (localStorage.getItem('algebra_solver_mode') as SolverMode) || 'mode_b';
    this.game = new GameController(undefined, savedMode);
    this.interaction = new InteractionController(this.game);
    this.camera = new CameraManager();
    this.landmarker = new HandLandmarkerService();
    this.canvasOverlay = new CanvasOverlay(canvasEl);
    this.raySmoother = new RaySmoother(0.38, 0.85);

    // Wire arithmetic RHS collapse animation before advancing to next step
    this.game.onBeforeCorrectAdvance = (correctVal, done) => {
      this.equationView.triggerCollapse(correctVal, done);
    };

    // Wire index curl / hold drop to popping animation in Mode A
    this.interaction.onDropRequested = () => {
      this.popBubbleAndDrop();
    };

    // Wire Mode B not yet, forging, and applying callbacks
    this.interaction.onNotYetRequested = () => {
      this.equationView.triggerNotYet();
    };

    this.interaction.onForgeRequested = (sign) => {
      this.handleForgeSign(sign);
    };

    this.interaction.onApplyEqualsRequested = () => {
      this.triggerSplitAndBalance();
    };

    // Wire Mode C callbacks
    this.interaction.onBlasterSelected = (blaster) => {
      this.handleSelectBlaster(blaster);
    };

    this.interaction.onSmashLhsRequested = () => {
      this.game.shootLhs();
      this.needTargetsRefresh = true;
    };

    this.interaction.onBlastRhsRequested = () => {
      this.game.shootRhs();
      this.needTargetsRefresh = true;
    };

    this.interaction.onBlastSimplifyRequested = () => {
      this.game.shootSimplify();
      this.needTargetsRefresh = true;
    };

    window.addEventListener('resize', () => {
      this.needTargetsRefresh = true;
    });

    // 3. UI Views
    this.equationView = new EquationView(equationArea, {
      onPickup: (term) => {
        if (this.game.getState().mode === 'mode_c') {
          this.game.shootLhs();
          this.needTargetsRefresh = true;
        } else {
          this.game.pickup(term);
        }
      },
      onDrop: () => this.popBubbleAndDrop(),
      onNext: () => this.game.nextLevel(),
      onReplay: () => this.game.restartLevel(),
      onNotYet: () => this.equationView.triggerNotYet(),
      onApplyEquals: () => this.triggerSplitAndBalance(),
      onBlastRhs: () => {
        this.game.shootRhs();
        this.needTargetsRefresh = true;
      },
      onBlastSimplify: () => {
        this.game.shootSimplify();
        this.needTargetsRefresh = true;
      }
    });

    this.answersView = new AnswersView(answersColumn, (choice) => {
      this.game.answer(choice);
    });

    this.forgePanelView = new ForgePanelView(forgePanel, {
      onSelectSign: (sign) => this.handleForgeSign(sign)
    });

    this.blasterPanelView = new BlasterPanelView(blasterPanel, {
      onSelectBlaster: (blaster) => this.handleSelectBlaster(blaster)
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
      onRestart: () => this.game.restartLevel(),
      onModeChange: (mode) => {
        try {
          localStorage.setItem('algebra_solver_mode', mode);
        } catch {}
        this.game.setMode(mode);
        this.needTargetsRefresh = true;
      }
    }, savedMode);

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

  private handleForgeSign(sign: ForgeSign) {
    const ok = this.game.forge(sign);
    if (ok) {
      this.forgePanelView.triggerSuccess(sign);
      this.needTargetsRefresh = true;
    } else {
      this.forgePanelView.triggerShake(sign);
      if (this.bubbleEl) {
        this.bubbleEl.classList.remove('shake-nah-uh');
        void this.bubbleEl.offsetWidth;
        this.bubbleEl.classList.add('shake-nah-uh');
        window.setTimeout(() => this.bubbleEl?.classList.remove('shake-nah-uh'), 450);
      }
    }
  }

  private handleSelectBlaster(blaster: BlasterType) {
    this.game.selectBlaster(blaster);
    this.needTargetsRefresh = true;
  }

  private triggerSplitAndBalance() {
    if (this.isSplitting) return;
    this.isSplitting = true;
    if (this.bubbleEl) this.bubbleEl.style.display = 'none';

    const targets = this.equationView.getSplitTargets();
    const eqRect = this.equationView.getEqualsRect();

    if (!targets || !eqRect || !this.splitLeftEl || !this.splitRightEl) {
      this.game.applyBalance();
      this.game.cancelLhs();
      this.isSplitting = false;
      this.needTargetsRefresh = true;
      return;
    }

    const eqCenter = { x: eqRect.left + eqRect.width / 2, y: eqRect.top + eqRect.height / 2 };
    const state = this.game.getState();
    const forgedOp = state.forgedOperation;
    const symbol = forgedOp 
      ? `${forgedOp.forgedOperator === '-' ? '−' : forgedOp.forgedOperator}${forgedOp.forgedOperand}` 
      : '';
    const opClass = forgedOp?.forgedOperator === '+' ? 'op-plus' : (forgedOp?.forgedOperator === '-' ? 'op-minus' : (forgedOp?.forgedOperator === '×' ? 'op-times' : 'op-divide'));

    [this.splitLeftEl, this.splitRightEl].forEach(el => {
      el.className = `carried-bubble split-clone ${opClass}`;
      el.style.display = 'flex';
      el.style.left = `${eqCenter.x}px`;
      el.style.top = `${eqCenter.y}px`;
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      const term = el.querySelector('.bubble-term');
      if (term) term.textContent = symbol;
    });

    soundManager.playSplit();

    // Stage 1: Float up above both sides (LHS & RHS)
    window.requestAnimationFrame(() => {
      if (this.splitLeftEl && this.splitRightEl) {
        this.splitLeftEl.classList.add('hovering');
        this.splitRightEl.classList.add('hovering');
        this.splitLeftEl.style.left = `${targets.left.hover.x}px`;
        this.splitLeftEl.style.top = `${targets.left.hover.y}px`;
        this.splitRightEl.style.left = `${targets.right.hover.x}px`;
        this.splitRightEl.style.top = `${targets.right.hover.y}px`;
      }
    });

    // Stage 2: Smash Side 1 (LHS) into term
    window.setTimeout(() => {
      if (!this.splitLeftEl) return;
      this.splitLeftEl.classList.remove('hovering');
      this.splitLeftEl.classList.add('smashing');
      this.splitLeftEl.style.left = `${targets.left.smash.x}px`;
      this.splitLeftEl.style.top = `${targets.left.smash.y}px`;

      // Impact on LHS
      window.setTimeout(() => {
        soundManager.playPop();
        this.equationView.triggerLhsCancelFlash();
        if (this.splitLeftEl) {
          this.splitLeftEl.classList.add('smashed');
          window.setTimeout(() => {
            if (this.splitLeftEl) this.splitLeftEl.style.display = 'none';
          }, 180);
        }

        // Stage 3: Smash Side 2 (RHS) into constant
        window.setTimeout(() => {
          if (!this.splitRightEl) return;
          this.splitRightEl.classList.remove('hovering');
          this.splitRightEl.classList.add('smashing');
          this.splitRightEl.style.left = `${targets.right.smash.x}px`;
          this.splitRightEl.style.top = `${targets.right.smash.y}px`;

          // Impact on RHS
          window.setTimeout(() => {
            soundManager.playSnap();
            if (this.splitRightEl) {
              this.splitRightEl.classList.add('smashed');
              window.setTimeout(() => {
                if (this.splitRightEl) this.splitRightEl.style.display = 'none';
              }, 180);
            }

            // Stage 4: Transition directly into Question phase & arrow
            this.isSplitting = false;
            this.game.applyBalance();
            this.game.cancelLhs(); // Directly advances state to 'question' phase!
            this.needTargetsRefresh = true;
          }, 240);
        }, 220);
      }, 240);
    }, 450);
  }

  private updateView(state = this.game.getState(), extra = { currentLevel: this.game.getCurrentLevelNumber(), totalLevels: this.game.getTotalLevels() }) {
    this.equationView.render(state);
    this.answersView.render(state.pendingArithmetic);
    this.hudView.updateProgress(extra.currentLevel, extra.totalLevels);
    this.needTargetsRefresh = true;

    // Contextual instruction
    let instr = 'Get Y on its own.';
    if (state.mode === 'mode_c') {
      instr = this.game.getHint();
      if (state.phase === 'question') {
        this.updateArrowAndLayout(state.phase);
      }
    } else if (state.mode === 'mode_b') {
      if (state.phase === 'ready') {
        if (state.stage === 'undo_constant') {
          const sign = state.currentB < 0 ? '−' : '+';
          instr = `Point laser at ${sign}${Math.abs(state.currentB)} or click to pick it up.`;
        } else if (state.stage === 'undo_coefficient') {
          instr = `Point laser at ${state.currentA} in ${state.currentA}x or click to pick it up.`;
        }
      } else if (state.phase === 'forging') {
        instr = 'Hold bubble on the opposite sign (+, −, ×, ÷) for 1s to forge it, or click.';
      } else if (state.phase === 'applying') {
        instr = 'Pull forged bubble up to the equation to balance both sides!';
      } else if (state.phase === 'balancing') {
        instr = 'Opposites balance! Cancelling inverse operations on variable side...';
      } else if (state.phase === 'question') {
        instr = 'Aim laser at an answer card and hold to confirm, or click.';
        this.updateArrowAndLayout(state.phase);
      } else if (state.phase === 'solved') {
        instr = 'Equation balanced! Aim at Next Puzzle → or hold Open Palm 👋 to continue.';
      }
    } else {
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
        this.updateArrowAndLayout(state.phase);
      } else if (state.phase === 'solved') {
        instr = 'Equation balanced! Aim at Next Puzzle → or hold Open Palm 👋 to continue.';
      }
    }
    this.hudView.updateInstruction(instr);

    // Contextual camera badge hint
    const hintBadge = document.getElementById('camera-hint-badge');
    if (hintBadge) {
      if (state.mode === 'mode_c') {
        if (state.phase === 'ready') {
          hintBadge.textContent = state.blasterState?.equipped ? 'Shoot LHS Term 💥' : 'Equip Blaster 🔫';
        } else if (state.phase === 'blasting_rhs') {
          hintBadge.textContent = 'Blast RHS to Balance 🎯';
        } else if (state.phase === 'awaiting_simplify') {
          hintBadge.textContent = 'Equip Calculator 🖩 & Blast';
        } else if (state.phase === 'question') {
          hintBadge.textContent = 'Aim laser at answer 👉';
        } else if (state.phase === 'solved') {
          hintBadge.textContent = 'Show Open Palm 👋 or Point Next';
        }
      } else if (state.mode === 'mode_b') {
        if (state.phase === 'ready') {
          hintBadge.textContent = 'Point up at equation ☝️';
        } else if (state.phase === 'forging') {
          hintBadge.textContent = 'Forge opposite sign ⚡';
        } else if (state.phase === 'applying') {
          hintBadge.textContent = 'Aim at equation to balance ⚖️';
        } else if (state.phase === 'question') {
          hintBadge.textContent = 'Aim laser at answer 👉';
        } else if (state.phase === 'solved') {
          hintBadge.textContent = 'Show Open Palm 👋 or Point Next';
        }
      } else {
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
    if ((gameState.phase === 'carrying' || gameState.phase === 'forging' || gameState.phase === 'applying') && gameState.carriedTerm && !this.isPopping && !this.isSplitting) {
      let targetX = interState.carriedPosition?.x || (window.innerWidth / 2);
      let targetY = interState.carriedPosition?.y || 160;
      let isSnapped = false;

      // Mode A: Destination Slot Snapping
      if (gameState.phase === 'carrying') {
        const destEl = document.getElementById('drop-destination');
        if (destEl) {
          const destRect = destEl.getBoundingClientRect();
          const destCenter = {
            x: destRect.left + destRect.width / 2,
            y: destRect.top + destRect.height / 2
          };

          if (laserRay && laserRay.active) {
            const t = (destCenter.y - laserRay.origin.y) / laserRay.direction.y;
            if (t > 0) {
              targetX = laserRay.origin.x + t * laserRay.direction.x;
              targetY = destCenter.y;
            }
          }

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
      }

      // Mode B: Whole Equation Rail Snapping during 'applying'
      if (gameState.phase === 'applying') {
        const dropTargetEl = document.getElementById('equation-drop-target') || document.getElementById('eq-equals-target');
        if (dropTargetEl) {
          const rect = dropTargetEl.getBoundingClientRect();
          const targetCenterY = rect.top + rect.height / 2;

          if (laserRay && laserRay.active) {
            const t = (targetCenterY - laserRay.origin.y) / laserRay.direction.y;
            if (t > 0) {
              targetX = laserRay.origin.x + t * laserRay.direction.x;
              targetY = targetCenterY;
            }
          }

          const isNearRail = (
            targetX >= rect.left - 40 &&
            targetX <= rect.right + 40 &&
            targetY >= rect.top - 45 &&
            targetY <= rect.bottom + 45
          );

          isSnapped = isNearRail;

          if (isSnapped) {
            targetY = targetCenterY;
            targetX = Math.max(rect.left + 35, Math.min(rect.right - 35, targetX));
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
      }

      interState.carriedPosition = { x: targetX, y: targetY };

      // Update DOM Floating Bubble
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'flex';
        this.bubbleEl.style.left = `${targetX}px`;
        this.bubbleEl.style.top = `${targetY}px`;
        this.bubbleEl.classList.toggle('snapped', isSnapped);

        const caption = this.bubbleEl.querySelector('.bubble-caption');
        const termEl = this.bubbleEl.querySelector('.bubble-term');
        const ringFill = this.bubbleEl.querySelector<SVGCircleElement>('.bubble-ring-fill');
        const circumference = 2 * Math.PI * 45; // ~283

        this.bubbleEl.classList.remove('op-plus', 'op-minus', 'op-times', 'op-divide');

        // 1. Mode B: Forging Phase
        if (gameState.phase === 'forging') {
          this.bubbleEl.classList.remove('crossed');
          if (termEl) {
            if (gameState.carriedTerm === 'constant') {
              const isNeg = gameState.currentB < 0;
              const absB = Math.abs(gameState.currentB);
              termEl.textContent = `${isNeg ? '−' : '+'}${absB}`;
              this.bubbleEl.classList.add(isNeg ? 'op-minus' : 'op-plus');
            } else if (gameState.carriedTerm === 'coefficient') {
              termEl.textContent = `x ${gameState.currentA}`;
              this.bubbleEl.classList.add('op-times');
            }
          }
          if (caption) {
            caption.textContent = 'Hold on opposite sign ⚡';
          }
          if (ringFill) {
            ringFill.style.strokeDashoffset = `${circumference}`;
          }
        }

        // 2. Mode B: Applying Phase
        else if (gameState.phase === 'applying') {
          this.bubbleEl.classList.remove('crossed');
          const forged = gameState.forgedOperation;
          if (forged && termEl) {
            const opSymbol = forged.forgedOperator === '-' ? '−' : forged.forgedOperator;
            termEl.textContent = `${opSymbol}${forged.forgedOperand}`;
            const opClass = forged.forgedOperator === '+' ? 'op-plus' : (forged.forgedOperator === '-' ? 'op-minus' : (forged.forgedOperator === '×' ? 'op-times' : 'op-divide'));
            this.bubbleEl.classList.add(opClass);
          }

          if (isSnapped) {
            if (!this.snapStartTime) {
              this.snapStartTime = now;
            }
            const holdDuration = now - this.snapStartTime;
            const progress = Math.min(1.0, holdDuration / 450);

            if (ringFill) {
              ringFill.style.strokeDashoffset = `${circumference * (1 - progress)}`;
            }

            if (progress > 0.15 && holdDuration % 120 < 18) {
              soundManager.playDwellTick(progress);
            }

            if (caption) {
              caption.textContent = progress >= 0.9 ? 'SPLIT!' : 'Hold to balance ⚖️';
            }

            if (progress >= 1.0) {
              this.triggerSplitAndBalance();
            }
          } else {
            this.snapStartTime = null;
            if (ringFill) {
              ringFill.style.strokeDashoffset = `${circumference}`;
            }
            if (caption) {
              caption.textContent = 'Drag to equation ☝️';
            }
          }
        }

        // 3. Mode A: Carrying Phase
        else if (gameState.phase === 'carrying') {
          const equalsX = this.equationView.getEqualsX();
          const isCrossed = targetX >= equalsX;

          if (isCrossed && !this.wasCrossed) {
            soundManager.playSnap();
            this.wasCrossed = true;
          } else if (!isCrossed && this.wasCrossed) {
            soundManager.playSnap();
            this.wasCrossed = false;
          }

          this.bubbleEl.classList.toggle('crossed', isCrossed);

          if (termEl) {
            if (gameState.carriedTerm === 'constant') {
              const isNeg = gameState.currentB < 0;
              const absB = Math.abs(gameState.currentB);
              if (isCrossed) {
                const flippedSign = isNeg ? '+' : '−';
                termEl.textContent = `${flippedSign}${absB}`;
                this.bubbleEl.classList.add(isNeg ? 'op-plus' : 'op-minus');
              } else {
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

          const HOLD_DURATION_MS = 1000;
          if (isSnapped) {
            if (!this.snapStartTime) {
              this.snapStartTime = now;
            }
            const holdDuration = now - this.snapStartTime;
            const progress = Math.min(1.0, holdDuration / HOLD_DURATION_MS);

            if (ringFill) {
              const offset = circumference * (1 - progress);
              ringFill.style.strokeDashoffset = `${offset}`;
            }

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
            if (ringFill) {
              ringFill.style.strokeDashoffset = `${circumference}`;
            }
            if (caption) {
              caption.textContent = isCrossed ? 'Drag to Landing Slot' : 'Move across =';
            }
          }
        }
      }
    } else if (!this.isPopping && !this.isSplitting) {
      if (this.bubbleEl) {
        this.bubbleEl.style.display = 'none';
        const ringFill = this.bubbleEl.querySelector<SVGCircleElement>('.bubble-ring-fill');
        if (ringFill) ringFill.style.strokeDashoffset = `${2 * Math.PI * 45}`;
      }
      this.wasSnapped = false;
      this.wasCrossed = false;
      this.snapStartTime = null;
    }

    // 60 FPS lightweight updates
    this.forgePanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.blasterPanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.equationView.setDestinationHovered(interState.isDestinationHovered);
    this.answersView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);

    if (gameState.phase === 'solved') {
      this.equationView.updateSolvedDwell(
        interState.hoveredTargetId,
        interState.dwellProgress,
        interState.openPalmProgress
      );
    }

    let blasterInfo: BlasterOverlayInfo | undefined = undefined;
    if (gameState.mode === 'mode_c') {
      const operand = gameState.blasterState?.carriedOperand;
      blasterInfo = {
        type: gameState.blasterState?.equipped || null,
        carriedOperandText: operand ? `${operand.operator}${operand.value}` : null,
        dwellProgress: interState.dwellProgress
      };
    }

    // Render Canvas Overlay (hand skeleton, laser, particles)
    this.canvasOverlay.render(
      hands,
      laserRay,
      hitResult,
      interState.carriedPosition,
      cameraViewport,
      interactiveTargets,
      blasterInfo
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  private updateArrowAndLayout(phase: string) {
    const gameState = this.game.getState();

    // 1. Forge Panel on Left (visible during forging or applying in Mode B)
    const isForgeVisible = gameState.mode === 'mode_b' && (phase === 'forging' || phase === 'applying');
    if (isForgeVisible && this.cameraBoxEl && this.forgePanelEl) {
      const cameraRect = this.cameraBoxEl.getBoundingClientRect();
      const columnWidth = 165;
      let left = cameraRect.left - columnWidth - 18;
      if (left < 10) left = 10;

      this.forgePanelEl.style.display = 'flex';
      this.forgePanelView.render(true, phase as 'forging' | 'applying', gameState.forgedOperation?.forgedOperator || null);

      // Vertically align the 4 operator cards with the camera viewport
      const headerEl = this.forgePanelEl.querySelector<HTMLElement>('.forge-header');
      const headerHeight = headerEl ? headerEl.offsetHeight + 8 : 50;
      const top = Math.max(10, cameraRect.top - headerHeight);
      const totalHeight = cameraRect.height + (cameraRect.top - top);

      this.forgePanelEl.style.left = `${left}px`;
      this.forgePanelEl.style.top = `${top}px`;
      this.forgePanelEl.style.width = `${columnWidth}px`;
      this.forgePanelEl.style.height = `${totalHeight}px`;
      this.forgePanelEl.style.right = 'auto';

      const cardsContainer = this.forgePanelEl.querySelector<HTMLElement>('.forge-cards-vertical');
      if (cardsContainer) {
        cardsContainer.style.height = `${cameraRect.height}px`;
        cardsContainer.style.flex = '0 0 auto';
      }
    } else {
      if (this.forgePanelEl) this.forgePanelEl.style.display = 'none';
      this.forgePanelView.render(false);
    }

    // Mode C: Blaster Panel on Left
    const isBlasterVisible = gameState.mode === 'mode_c';
    if (isBlasterVisible && this.cameraBoxEl && this.blasterPanelEl) {
      const cameraRect = this.cameraBoxEl.getBoundingClientRect();
      const columnWidth = 165;
      let left = cameraRect.left - columnWidth - 18;
      if (left < 10) left = 10;

      this.blasterPanelEl.style.display = 'flex';
      const activeBlaster = gameState.blasterState?.equipped || null;
      let recommended: BlasterType | null = null;
      if (gameState.phase === 'awaiting_simplify') {
        recommended = 'calc';
      } else if (gameState.phase === 'ready') {
        recommended = gameState.stage === 'undo_constant' 
          ? (gameState.currentB < 0 ? '+' : '-') 
          : '÷';
      }
      this.blasterPanelView.render(true, activeBlaster, gameState.phase, recommended);

      const headerEl = this.blasterPanelEl.querySelector<HTMLElement>('.blaster-header');
      const headerHeight = headerEl ? headerEl.offsetHeight + 8 : 50;
      const top = Math.max(10, cameraRect.top - headerHeight);
      const totalHeight = cameraRect.height + (cameraRect.top - top);

      this.blasterPanelEl.style.left = `${left}px`;
      this.blasterPanelEl.style.top = `${top}px`;
      this.blasterPanelEl.style.width = `${columnWidth}px`;
      this.blasterPanelEl.style.height = `${totalHeight}px`;
      this.blasterPanelEl.style.right = 'auto';

      const cardsContainer = this.blasterPanelEl.querySelector<HTMLElement>('.blaster-cards-vertical');
      if (cardsContainer) {
        cardsContainer.style.height = `${cameraRect.height}px`;
        cardsContainer.style.flex = '0 0 auto';
      }
    } else {
      if (this.blasterPanelEl) this.blasterPanelEl.style.display = 'none';
      this.blasterPanelView.render(false);
    }

    // 2. Downward Arrow to Top of Forge Area during 'forging' phase (Mode B)
    if (gameState.mode === 'mode_b' && phase === 'forging' && this.forgePanelEl && this.arrowSvgEl && this.arrowPathEl) {
      const termEl = document.getElementById('term-constant') || document.getElementById('term-coefficient');
      const headerEl = this.forgePanelEl.querySelector<HTMLElement>('.forge-header') || this.forgePanelEl;

      if (termEl && headerEl) {
        const termRect = termEl.getBoundingClientRect();
        const headerRect = headerEl.getBoundingClientRect();

        const startX = termRect.left + termRect.width / 2;
        const startY = termRect.bottom + 6;
        const endX = headerRect.right + 8;
        const endY = headerRect.top + headerRect.height / 2;

        const cp1X = startX;
        const cp1Y = startY + (endY - startY) * 0.45;
        const cp2X = endX + 40;
        const cp2Y = endY;

        const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
        this.arrowPathEl.setAttribute('d', d);
        this.arrowSvgEl.style.display = 'block';
      }
      if (this.answersColumnEl) this.answersColumnEl.style.display = 'none';
      return;
    }

    // 3. Answers Column on Right (visible during question phase)
    if (phase !== 'question') {
      if (this.arrowSvgEl) this.arrowSvgEl.style.display = 'none';
      if (this.answersColumnEl) this.answersColumnEl.style.display = 'none';
      return;
    }

    if (!this.cameraBoxEl || !this.answersColumnEl) return;

    this.answersColumnEl.style.display = 'flex';
    const cameraRect = this.cameraBoxEl.getBoundingClientRect();
    const columnWidth = 260;

    let left = cameraRect.right + 18;
    if (left + columnWidth > window.innerWidth - 14) {
      left = Math.max(14, window.innerWidth - columnWidth - 14);
    }
    const top = Math.max(65, cameraRect.top);

    this.answersColumnEl.style.left = `${left}px`;
    this.answersColumnEl.style.top = `${top}px`;
    this.answersColumnEl.style.right = 'auto';

    // Curving arrow from equation to question card
    const termEl = document.getElementById('arithmetic-rhs') || document.getElementById('term-simplify-target') || document.getElementById('term-rhs-mode-c');
    const questionCard = this.answersColumnEl.querySelector<HTMLElement>('.arithmetic-question');

    if (termEl && questionCard && this.arrowSvgEl && this.arrowPathEl) {
      const termRect = termEl.getBoundingClientRect();
      const qRect = questionCard.getBoundingClientRect();

      const startX = termRect.right + 6;
      const startY = termRect.top + termRect.height / 2;
      const endX = qRect.left - 10;
      const endY = qRect.top + 28;

      const cornerX = Math.max(startX + 30, Math.min(cameraRect.right + 10, endX - 10));

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
    const gameState = this.game.getState();
    const isDynamicPhase = gameState.phase === 'question' || gameState.phase === 'solved' || gameState.phase === 'forging' || gameState.phase === 'applying' || gameState.phase === 'blasting_rhs' || gameState.phase === 'awaiting_simplify';
    if (!this.needTargetsRefresh && this.cachedTargets.length > 0 && !isDynamicPhase) {
      return this.cachedTargets;
    }

    const targets: InteractiveTarget[] = [];
    const eqTargets = this.equationView.getInteractiveElements();
    const ansTargets = this.answersView.getInteractiveElements();
    const forgeTargets = this.forgePanelView.getInteractiveElements();
    const blasterTargets = this.blasterPanelView.getInteractiveElements();

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

    if (gameState.phase === 'forging') {
      forgeTargets.forEach(t => {
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
    }

    if (gameState.mode === 'mode_c') {
      blasterTargets.forEach(t => {
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
    }

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

    // Mouse Dragging for Carried / Forging / Applying Term
    window.addEventListener('mousemove', (e) => {
      const gameState = this.game.getState();
      const isCarryingLike = (gameState.phase === 'carrying' || gameState.phase === 'forging' || gameState.phase === 'applying') && !this.isPopping && !this.isSplitting;

      if (isCarryingLike) {
        let isDestHovered = false;

        if (gameState.phase === 'carrying') {
          const dest = document.getElementById('drop-destination');
          if (dest) {
            const rect = dest.getBoundingClientRect();
            isDestHovered = (
              e.clientX >= rect.left &&
              e.clientX <= rect.right &&
              e.clientY >= rect.top &&
              e.clientY <= rect.bottom
            );
          }
        } else if (gameState.phase === 'applying') {
          const eqDest = document.getElementById('equation-drop-target') || document.getElementById('eq-equals-target');
          if (eqDest) {
            const rect = eqDest.getBoundingClientRect();
            isDestHovered = (
              e.clientX >= rect.left - 25 &&
              e.clientX <= rect.right + 25 &&
              e.clientY >= rect.top - 25 &&
              e.clientY <= rect.bottom + 25
            );
          }
        }

        const interState = this.interaction.getState();
        interState.carriedPosition = { x: e.clientX, y: e.clientY };
        interState.isDestinationHovered = isDestHovered;
        this.equationView.setDestinationHovered(isDestHovered);
      }
    });

    window.addEventListener('mouseup', () => {
      const gameState = this.game.getState();
      const interState = this.interaction.getState();

      if (gameState.phase === 'applying' && !this.isSplitting) {
        if (interState.isDestinationHovered) {
          this.triggerSplitAndBalance();
        }
      } else if (gameState.phase === 'carrying' && !this.isPopping) {
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
        } catch {}
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
