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
import { InversePanelView } from './ui/inversePanelView';
import { CarriedBubbleView } from './ui/carriedBubbleView';
import { runSplitBalanceAnimation } from './ui/animations/splitBalanceAnimation';
import { getModeDefinition } from './game/modeRegistry';
import { classifyHandPose } from './vision/poseClassifier';
import { computeLaserRay } from './vision/coordinateTransform';
import { RaySmoother, castRayAgainstTargets, InteractiveTarget } from './vision/rayCaster';
import { LaserRay } from './vision/types';
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
  private inversePanelView: InversePanelView;
  private carriedBubbleView: CarriedBubbleView;
  private hudView: HudView;
  private raySmoother: RaySmoother;

  private videoEl: HTMLVideoElement;
  private splitLeftEl: HTMLElement | null = null;
  private splitRightEl: HTMLElement | null = null;
  private arrowSvgEl: SVGSVGElement | null = null;
  private arrowPathEl: SVGPathElement | null = null;
  private cameraBoxEl: HTMLElement | null = null;
  private answersColumnEl: HTMLElement | null = null;
  private forgePanelEl: HTMLElement | null = null;
  private blasterPanelEl: HTMLElement | null = null;
  private inversePanelEl: HTMLElement | null = null;
  private isCameraRunning: boolean = false;
  private isSplitting: boolean = false;
  private isModeDForgeAnimating: boolean = false;
  private cachedTargets: InteractiveTarget[] = [];
  private needTargetsRefresh: boolean = true;

  constructor() {
    // 1. Initialize DOM references
    const canvasEl = document.getElementById('canvas-overlay') as HTMLCanvasElement;
    this.videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    const bubbleEl = document.getElementById('carried-bubble');
    this.carriedBubbleView = new CarriedBubbleView(bubbleEl);
    this.splitLeftEl = document.getElementById('split-bubble-left');
    this.splitRightEl = document.getElementById('split-bubble-right');
    this.arrowSvgEl = document.getElementById('equation-arrow-svg') as unknown as SVGSVGElement | null;
    this.arrowPathEl = document.getElementById('connector-arrow-path') as unknown as SVGPathElement | null;
    this.cameraBoxEl = document.getElementById('camera-box');
    this.answersColumnEl = document.getElementById('answers-column');
    this.forgePanelEl = document.getElementById('forge-panel');
    this.blasterPanelEl = document.getElementById('blaster-panel');
    this.inversePanelEl = document.getElementById('inverse-panel');
    const equationArea = document.getElementById('equation-area') as HTMLElement;
    const answersColumn = document.getElementById('answers-column') as HTMLElement;
    const forgePanel = document.getElementById('forge-panel') as HTMLElement;
    const blasterPanel = document.getElementById('blaster-panel') as HTMLElement;
    const inversePanel = document.getElementById('inverse-panel') as HTMLElement;
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
        } else if (this.game.getState().mode === 'mode_d') {
          this.game.identifyModeDTarget(term);
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
      },
      onBlastModeDSide: (side) => {
        this.game.blastModeDSide(side);
        this.needTargetsRefresh = true;
      },
      onSimplifyModeDSide: (side) => {
        this.game.startSimplifyingSide(side);
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

    this.inversePanelView = new InversePanelView(inversePanel, {
      onSelectChoice: (choiceId) => {
        this.handleModeDInverseChoice(choiceId);
      }
    });
    this.interaction.onModeDInverseRequested = (choiceId) => {
      this.handleModeDInverseChoice(choiceId);
    };

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
      this.carriedBubbleView.triggerNahUhShake();
    }
  }

  private handleSelectBlaster(blaster: BlasterType) {
    this.game.selectBlaster(blaster);
    this.needTargetsRefresh = true;
  }

  private handleModeDInverseChoice(choiceId: string) {
    if (this.isModeDForgeAnimating) return;

    const state = this.game.getState();
    const choice = state.modeDState?.inverseChoices.find(candidate => candidate.id === choiceId);
    if (!choice || !choice.isCorrect) {
      this.game.selectModeDInverse(choiceId);
      this.needTargetsRefresh = true;
      return;
    }

    const sourceText = state.modeDState?.targetTerm === 'coefficient'
      ? `${state.currentA}×`
      : `${state.currentB < 0 ? '−' : '+'}${Math.abs(state.currentB)}`;

    this.isModeDForgeAnimating = true;
    this.inversePanelView.triggerForge(choiceId, sourceText, choice, () => {
      this.isModeDForgeAnimating = false;
      const latest = this.game.getState();
      if (latest.mode === 'mode_d' && latest.phase === 'choose_inverse') {
        this.game.selectModeDInverse(choiceId);
      }
      this.needTargetsRefresh = true;
    }, this.game.reducedMotion);
  }

  private triggerSplitAndBalance() {
    if (this.isSplitting) return;
    this.isSplitting = true;
    this.carriedBubbleView.hide();

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

    runSplitBalanceAnimation({
      splitLeftEl: this.splitLeftEl,
      splitRightEl: this.splitRightEl,
      forgedOp: state.forgedOperation,
      targets,
      eqCenter,
      onLhsImpact: () => {
        this.equationView.triggerLhsCancelFlash();
      },
      onComplete: () => {
        this.isSplitting = false;
        this.game.applyBalance();
        this.game.cancelLhs();
        this.needTargetsRefresh = true;
      }
    });
  }

  private updateView(state = this.game.getState(), extra = { currentLevel: this.game.getCurrentLevelNumber(), totalLevels: this.game.getTotalLevels() }) {
    this.equationView.render(state);
    this.answersView.render(state.pendingArithmetic);
    this.hudView.updateProgress(extra.currentLevel, extra.totalLevels);
    this.needTargetsRefresh = true;

    // Data-driven contextual instructions and camera badge hints
    const modeDef = getModeDefinition(state.mode);
    this.hudView.updateInstruction(modeDef.getInstruction(state));

    const hintBadge = document.getElementById('camera-hint-badge');
    if (hintBadge) {
      hintBadge.textContent = modeDef.getBadgeHint(state);
    }

    if (state.phase === 'question') {
      this.updateArrowAndLayout(state.phase);
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
    const isCarryingLike = (gameState.phase === 'carrying' || gameState.phase === 'forging' || gameState.phase === 'applying') && gameState.carriedTerm && !this.carriedBubbleView.isBusy() && !this.isSplitting;

    if (isCarryingLike) {
      const bubbleRes = this.carriedBubbleView.update(
        gameState,
        interState.carriedPosition,
        laserRay,
        this.equationView.getEqualsX(),
        now
      );

      interState.carriedPosition = bubbleRes.targetPos;
      interState.isDestinationHovered = bubbleRes.isDestinationHovered;

      if (bubbleRes.triggerPop) {
        this.popBubbleAndDrop();
      } else if (bubbleRes.triggerSplit) {
        this.triggerSplitAndBalance();
      }
    } else if (!this.carriedBubbleView.isBusy() && !this.isSplitting) {
      this.carriedBubbleView.hide();
    }

    // 60 FPS lightweight updates
    this.forgePanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.blasterPanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.inversePanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
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
    if (gameState.mode === 'mode_c' || gameState.mode === 'mode_d') {
      const operand = gameState.blasterState?.carriedOperand;
      const isChoosingModeDInverse = gameState.mode === 'mode_d' && gameState.phase === 'choose_inverse';
      const extractedText = isChoosingModeDInverse && !this.isModeDForgeAnimating
        ? (gameState.modeDState?.targetTerm === 'coefficient'
            ? `${gameState.currentA}×`
            : `${gameState.currentB < 0 ? '−' : '+'}${Math.abs(gameState.currentB)}`)
        : null;
      const isForgedDivision = gameState.mode === 'mode_d' && operand?.operator === '÷';
      blasterInfo = {
        type: isChoosingModeDInverse
          ? (gameState.modeDState?.targetTerm === 'coefficient' ? '×' : (gameState.currentB < 0 ? '−' : '+'))
          : (gameState.blasterState?.equipped || (gameState.modeDState?.selectedInverse?.operator || null)),
        carriedOperandText: extractedText || (operand ? (isForgedDivision ? `${operand.value}` : `${operand.operator}${operand.value}`) : null),
        carriedOperandFormat: isForgedDivision ? 'division' : 'text',
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

    // Mode D: Inverse Panel on Left (visible during 'choose_inverse' phase)
    const isInverseVisible = gameState.mode === 'mode_d' && phase === 'choose_inverse';
    if (isInverseVisible && this.cameraBoxEl && this.inversePanelEl) {
      const cameraRect = this.cameraBoxEl.getBoundingClientRect();
      const columnWidth = 175;
      let left = cameraRect.left - columnWidth - 18;
      if (left < 10) left = 10;

      this.inversePanelEl.style.display = 'flex';
      const prompt = gameState.modeDState?.targetTerm === 'constant'
        ? `What blasts away ${gameState.currentB < 0 ? `−${Math.abs(gameState.currentB)}` : `+${gameState.currentB}`}?`
        : `What blasts away ×${gameState.currentA}?`;

      this.inversePanelView.render(true, gameState.modeDState?.inverseChoices || [], prompt);

      const headerEl = this.inversePanelEl.querySelector<HTMLElement>('.inverse-header');
      const headerHeight = headerEl ? headerEl.offsetHeight + 8 : 50;
      const top = Math.max(10, cameraRect.top - headerHeight);
      const totalHeight = cameraRect.height + (cameraRect.top - top);

      this.inversePanelEl.style.left = `${left}px`;
      this.inversePanelEl.style.top = `${top}px`;
      this.inversePanelEl.style.width = `${columnWidth}px`;
      this.inversePanelEl.style.height = `${totalHeight}px`;
      this.inversePanelEl.style.right = 'auto';

      const cardsContainer = this.inversePanelEl.querySelector<HTMLElement>('.inverse-cards-list');
      if (cardsContainer) {
        cardsContainer.style.height = `${cameraRect.height}px`;
        cardsContainer.style.flex = '0 0 auto';
      }
    } else {
      if (this.inversePanelEl) this.inversePanelEl.style.display = 'none';
      this.inversePanelView.render(false);
    }

    // Downward Arrow during Mode D choose_inverse
    if (gameState.mode === 'mode_d' && phase === 'choose_inverse' && this.inversePanelEl && this.arrowSvgEl && this.arrowPathEl) {
      const termEl = document.getElementById('term-constant') || document.getElementById('term-coefficient');
      const headerEl = this.inversePanelEl.querySelector<HTMLElement>('.inverse-header') || this.inversePanelEl;

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
    this.carriedBubbleView.popAndDrop(() => {
      const interState = this.interaction.getState();
      interState.carriedPosition = null;
      interState.isDestinationHovered = false;
      this.game.drop();
    });
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

    if (gameState.mode === 'mode_d' && gameState.phase === 'choose_inverse') {
      const inverseTargets = this.inversePanelView.getInteractiveElements();
      inverseTargets.forEach(t => {
        const rect = t.element.getBoundingClientRect();
        const pad = 16;
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
      const isCarryingLike = (gameState.phase === 'carrying' || gameState.phase === 'forging' || gameState.phase === 'applying') && !this.carriedBubbleView.isBusy() && !this.isSplitting;

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
      } else if (gameState.phase === 'carrying' && !this.carriedBubbleView.isBusy()) {
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
