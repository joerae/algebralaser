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
import { runForgeRoundTripAnimation, runPickupToFingerAnimation, runSplitBalanceAnimation } from './ui/animations/splitBalanceAnimation';
import { getModeDefinition } from './game/modeRegistry';
import { classifyHandPose, PointingStabilizer } from './vision/poseClassifier';
import { computeLaserRay, ViewportRect } from './vision/coordinateTransform';
import { getObjectFitViewport } from './vision/mediaViewport';
import { RaySmoother, castRayAgainstTargets, InteractiveTarget } from './vision/rayCaster';
import { LaserRay, HandLandmarks } from './vision/types';
import { SolverMode, DEFAULT_MODE, BlasterType } from './math/types';
import { StoryController } from './game/storyController';
import { StoryView } from './ui/storyView';
import { EquationChoiceView } from './ui/equationChoiceView';
import { soundManager } from './audio/soundEffects';
import { StoryPresentationState } from './story/types';
import { expandNonOverlappingTargets, TargetRectInput } from './ui/responsiveTargetGeometry';

class App {
  private game: GameController;
  private interaction: InteractionController;
  private storyController: StoryController;
  private storyView!: StoryView;
  private equationChoiceView: EquationChoiceView | null = null;
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
  private pointingStabilizer = new PointingStabilizer();

  private videoEl: HTMLVideoElement;
  private storyAreaEl: HTMLElement | null = null;
  private equationAreaEl: HTMLElement | null = null;
  private splitLeftEl: HTMLElement | null = null;
  private splitRightEl: HTMLElement | null = null;
  private arrowSvgEl: SVGSVGElement | null = null;
  private arrowPathEl: SVGPathElement | null = null;
  private cameraBoxEl: HTMLElement | null = null;
  private answersColumnEl: HTMLElement | null = null;
  private storyChoicesColumnEl: HTMLElement | null = null;
  private forgePanelEl: HTMLElement | null = null;
  private blasterPanelEl: HTMLElement | null = null;
  private inversePanelEl: HTMLElement | null = null;
  private isCameraRunning: boolean = false;
  private cameraDock: 'left' | 'right' = 'right';
  private isSplitting: boolean = false;
  private isModeBCleanupAnimating: boolean = false;
  private isModeBForgeAnimating: boolean = false;
  private isModeBPickupAnimating: boolean = false;
  private isModeDForgeAnimating: boolean = false;
  private cachedTargets: InteractiveTarget[] = [];
  private needTargetsRefresh: boolean = true;
  private layoutDirty: boolean = true;
  private resizeObserver: ResizeObserver | null = null;
  private lastLevelId: string = '';
  // Low-end & Chromebook optimization: 30Hz vision throttle & cached geometry
  private cachedCameraViewport: ViewportRect | null = null;
  private lastInferenceTime: number = 0;
  private lastVideoCurrentTime: number = -1;
  private lastHands: HandLandmarks[] | null = null;

  constructor() {
    // 1. Initialize DOM references
    const canvasEl = document.getElementById('canvas-overlay') as HTMLCanvasElement;
    this.videoEl = document.getElementById('webcam-video') as HTMLVideoElement;
    this.storyAreaEl = document.getElementById('story-area');
    this.equationAreaEl = document.getElementById('equation-area');
    const bubbleEl = document.getElementById('carried-bubble');
    this.carriedBubbleView = new CarriedBubbleView(bubbleEl);
    this.splitLeftEl = document.getElementById('split-bubble-left');
    this.splitRightEl = document.getElementById('split-bubble-right');
    this.arrowSvgEl = document.getElementById('equation-arrow-svg') as unknown as SVGSVGElement | null;
    this.arrowPathEl = document.getElementById('connector-arrow-path') as unknown as SVGPathElement | null;
    this.cameraBoxEl = document.getElementById('camera-box');
    this.answersColumnEl = document.getElementById('answers-column');
    this.storyChoicesColumnEl = document.getElementById('story-choices-column');
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
    this.videoEl.addEventListener('resize', () => this.syncCameraMediaAspect());

    // 2. Core Controllers & Services
    const urlParams = new URLSearchParams(window.location.search);
    const storyParam = urlParams.get('story');
    const initialStoryMode = storyParam !== null
      ? storyParam !== 'false'
      : localStorage.getItem('algebra_story_mode') !== 'false';

    const savedMode = (localStorage.getItem('algebra_solver_mode') as SolverMode) || DEFAULT_MODE;
    const initialSkipTutorial = localStorage.getItem('algebra_skip_tutorial') === 'true';
    this.cameraDock = localStorage.getItem('algebra_camera_dock') === 'left' ? 'left' : 'right';
    this.game = new GameController(undefined, savedMode, initialSkipTutorial);
    this.interaction = new InteractionController(this.game);
    this.storyController = new StoryController(this.game.getCurrentLevel(), initialStoryMode);
    this.storyController.reducedMotion = this.game.reducedMotion;
    this.lastLevelId = this.game.getCurrentLevel().id;
    this.camera = new CameraManager();
    this.landmarker = new HandLandmarkerService();
    this.canvasOverlay = new CanvasOverlay(canvasEl);
    this.raySmoother = new RaySmoother(0.38, 0.85);

    // Wire arithmetic RHS collapse animation before advancing to next step
    this.game.onBeforeCorrectAdvance = (correctVal, done) => {
      const state = this.game.getState();
      if (state.mode === 'mode_b' && state.phase === 'awaiting_cleanup') {
        done();
        return;
      }
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

    this.interaction.onModeBCleanupRequested = () => {
      this.triggerModeBCleanup();
    };

    this.interaction.onModeBPickupRequested = (term, source, finger) => {
      this.handleModeBPickup(term, source, finger);
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

    // Wire Story Mode callbacks
    this.interaction.onEquationChoiceRequested = (choiceId) => {
      this.handleStoryEquationChoice(choiceId);
    };
    this.interaction.onShowStoryToggleRequested = () => {
      this.storyController.togglePopover();
      this.needTargetsRefresh = true;
    };
    this.interaction.onCloseStoryRequested = () => {
      this.storyController.closePopover();
      this.needTargetsRefresh = true;
    };

    window.addEventListener('resize', () => {
      this.syncCameraMediaAspect();
      this.markLayoutDirty();
    });
    window.visualViewport?.addEventListener('resize', () => {
      this.syncCameraMediaAspect();
      this.markLayoutDirty();
    });

    // 3. UI Views
    if (this.storyAreaEl) {
      this.storyView = new StoryView(this.storyAreaEl, {
        onCloseStoryRequested: () => {
          this.storyController.closePopover();
          this.needTargetsRefresh = true;
        }
      });
    }

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
      onNext: () => {
        this.game.nextLevel();
        this.storyController.initLevel(this.game.getCurrentLevel());
      },
      onReplay: () => {
        this.game.restartLevel();
        this.storyController.restartLevel();
      },
      onNotYet: () => this.equationView.triggerNotYet(),
      onApplyEquals: () => this.triggerSplitAndBalance(),
      onModeBCleanup: () => this.triggerModeBCleanup(),
      onActivateModeBRhs: () => this.game.activateModeBRhsCalculation(),
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
        this.storyController.reducedMotion = this.game.reducedMotion;
      },
      onDwellChange: (dwellMs) => {
        this.interaction.dwellDurationMs = dwellMs;
      },
      onUndo: () => this.game.performUndo(),
      onHint: () => alert(this.game.getHint()),
      onRestart: () => {
        this.game.restartLevel();
        this.storyController.restartLevel();
      },
      onModeChange: (mode) => {
        try {
          localStorage.setItem('algebra_solver_mode', mode);
        } catch {}
        this.game.setMode(mode);
        this.storyController.handleModeSwitch();
        this.needTargetsRefresh = true;
      },
      onToggleStoryMode: (enabled) => {
        this.handleToggleStoryMode(enabled);
      },
      onToggleSkipTutorial: (enabled) => {
        if (enabled) {
          if (this.game.isTutorialLevel()) {
            this.game.skipToGeneratedLevels();
            this.storyController.initLevel(this.game.getCurrentLevel());
            this.needTargetsRefresh = true;
          }
        } else {
          if (this.game.getCurrentLevelNumber() === 1 && !this.game.isTutorialLevel()) {
            this.game.restoreTutorialLevels();
            this.storyController.initLevel(this.game.getCurrentLevel());
            this.needTargetsRefresh = true;
          }
        }
      },
      onToggleCameraAutoStart: (enabled) => {
        if (enabled && !this.isCameraRunning) {
          this.startCamera(false).catch(() => {});
        }
      },
      onChooseKeyboard: () => {
        this.setCameraUiState(false);
      },
      onCameraDockChange: (dock) => {
        this.cameraDock = dock;
        const appEl = document.getElementById('app');
        if (appEl) appEl.dataset.cameraDock = dock;
        this.markLayoutDirty();
      }
    }, savedMode, initialStoryMode);

    this.setupResponsiveObservers(hudHeader, hudFooter);

    // Wire Story Presentation updates
    this.storyController.subscribe((storyState) => {
      this.renderStory(storyState);
    });

    // 4. Connect State Updates
    this.game.subscribe((state) => {
      this.updateView(state);
    });

    // 5. Setup Mouse, Touch and Keyboard
    this.setupInputListeners();

    // 6. Camera Auto-Start / Camera Banner
    this.setCameraUiState(false);
    const autoStartCamera = localStorage.getItem('algebra_camera_enabled') !== 'false';
    if (autoStartCamera) {
      this.startCamera(true).catch(() => {
        this.hudView.showCameraBanner();
      });
    } else {
      this.hudView.showCameraBanner();
    }

    // 7. Start Animation & Vision Loop
    requestAnimationFrame((t) => this.loop(t));
  }

  private markLayoutDirty() {
    this.layoutDirty = true;
    this.needTargetsRefresh = true;
    this.cachedCameraViewport = null;
    this.carriedBubbleView.invalidateTargetRect();
  }

  private computeCameraViewport(): ViewportRect {
    const cameraFeedEl = document.getElementById('camera-feed-container');
    const cameraRect = cameraFeedEl ? cameraFeedEl.getBoundingClientRect() : {
      left: window.innerWidth * 0.35,
      top: window.innerHeight * 0.6,
      width: window.innerWidth * 0.3,
      height: window.innerHeight * 0.35
    };
    const cameraElementViewport = {
      left: cameraRect.left,
      top: cameraRect.top,
      width: cameraRect.width,
      height: cameraRect.height
    };
    return getObjectFitViewport(
      cameraElementViewport,
      this.videoEl.videoWidth || 640,
      this.videoEl.videoHeight || 480,
      getComputedStyle(this.videoEl).objectFit === 'cover' ? 'cover' : 'contain'
    );
  }

  private setupResponsiveObservers(header: HTMLElement, footer: HTMLElement) {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.markLayoutDirty());
    [
      header,
      footer,
      this.storyAreaEl,
      this.equationAreaEl,
      this.cameraBoxEl,
      this.forgePanelEl,
      this.storyChoicesColumnEl,
      this.answersColumnEl
    ].forEach(element => {
      if (element) this.resizeObserver?.observe(element);
    });
  }

  private syncCameraMediaAspect() {
    if (!this.videoEl.videoWidth || !this.videoEl.videoHeight) return;
    const isPortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    let aspect = this.videoEl.videoWidth / this.videoEl.videoHeight;
    if (isPortrait && aspect > 1) {
      aspect = this.videoEl.videoHeight / this.videoEl.videoWidth;
    }
    document.getElementById('app')?.style.setProperty('--camera-media-aspect', String(aspect));
    this.markLayoutDirty();
  }

  private handleToggleStoryMode(enabled: boolean) {
    try {
      localStorage.setItem('algebra_story_mode', enabled ? 'true' : 'false');
      const url = new URL(window.location.href);
      url.searchParams.set('story', enabled ? 'true' : 'false');
      window.history.replaceState({}, '', url.toString());
    } catch {}
    this.storyController.setEnabled(enabled);
    this.hudView.setStoryMode(enabled);
    this.renderStory();
    this.markLayoutDirty();
  }

  private handleStoryEquationChoice(choiceId: string) {
    const res = this.storyController.selectEquationChoice(choiceId);
    if (!res.success) return;
    if (!res.isCorrect) {
      soundManager.playIncorrect();
      this.equationChoiceView?.triggerShake(choiceId);
    } else {
      soundManager.playCorrect();
    }
    this.markLayoutDirty();
  }

  private renderStory(storyState: StoryPresentationState = this.storyController.getState()) {
    if (!this.storyAreaEl) return;
    this.storyView.render(storyState);

    if (this.storyChoicesColumnEl) {
      this.equationChoiceView = new EquationChoiceView(this.storyChoicesColumnEl, {
        onSelectChoice: (choiceId) => this.handleStoryEquationChoice(choiceId)
      });
      if (storyState.enabled && storyState.phase === 'choosing_equation') {
        this.equationChoiceView.render(
          storyState.candidates,
          storyState.story.item,
          storyState.lastFeedback,
          storyState.selectedCandidateId
        );
      } else {
        this.storyChoicesColumnEl.style.display = 'none';
        this.storyChoicesColumnEl.innerHTML = '';
      }
    } else {
      this.equationChoiceView = null;
    }

    if (this.equationAreaEl) {
      const isIntro = storyState.enabled && (
        storyState.phase === 'reading' ||
        storyState.phase === 'choosing_equation' ||
        storyState.phase === 'condensing'
      );
      const wasHidden = this.equationAreaEl.style.display === 'none';
      if (isIntro) {
        this.equationAreaEl.style.display = 'none';
        this.equationAreaEl.style.opacity = '0';
      } else {
        this.equationAreaEl.style.display = 'flex';
        // Smooth fade-in when equation area transitions from hidden (story) to visible (solving)
        if (wasHidden) {
          this.equationAreaEl.style.opacity = '0';
          requestAnimationFrame(() => {
            if (this.equationAreaEl) {
              this.equationAreaEl.style.opacity = '1';
            }
          });
        }
      }
    }

    const activeItem = storyState.enabled ? storyState.story.item : null;
    this.equationView.setMagicItem(activeItem);
    this.answersView.setMagicItem(activeItem);

    this.interaction.isStoryChoosingEquation = storyState.enabled && storyState.phase === 'choosing_equation';
    this.interaction.isStoryBlockingSolver = this.storyController.blocksSolverInteraction();

    if (storyState.enabled) {
      if (storyState.phase === 'reading') {
        this.hudView.updateInstruction('🧙‍♂️ Read the Magic Shop purchase...');
      } else if (storyState.phase === 'choosing_equation') {
        this.hudView.updateInstruction('🧙‍♂️ Which equation matches? Point laser or press 1–3');
      } else if (storyState.phase === 'condensing') {
        this.hudView.updateInstruction('✨ Writing down the equation...');
      } else if (storyState.phase === 'completed') {
        this.hudView.updateInstruction('✨ Purchase verified! Open palm or dwell on Next to continue');
      }
    }

    this.markLayoutDirty();
  }

  private handleForgeSign(sign: ForgeSign) {
    if (this.isModeBForgeAnimating || this.isModeBPickupAnimating) return;
    const before = this.game.getState();
    const target = this.forgePanelView.getCardCenter(sign);
    const from = this.interaction.getState().carriedPosition;
    const ok = this.game.forge(sign);
    if (ok) {
      this.forgePanelView.triggerSuccess(sign);
      this.needTargetsRefresh = true;
      if (target && from && this.splitLeftEl && before.carriedTerm) {
        const isDivision = Boolean(before.problem.d && before.problem.d > 1);
        const operand = before.carriedTerm === 'constant'
          ? Math.abs(before.currentB)
          : (isDivision ? before.problem.d! : before.currentA);
        const originalSymbol = before.carriedTerm === 'constant'
          ? `${before.currentB < 0 ? '\u2212' : '+'}${operand}`
          : (isDivision ? `÷${operand}` : `\u00d7${operand}`);
        const forgedSymbol = `${sign === '-' || sign === '−' ? '\u2212' : sign}${operand}`;
        const originalClass = before.carriedTerm === 'constant'
          ? (before.currentB < 0 ? 'op-minus' : 'op-plus')
          : (isDivision ? 'op-divide' : 'op-times');
        const forgedClass = sign === '+'
          ? 'op-plus'
          : (sign === '-' || sign === '−' ? 'op-minus' : (sign === '×' ? 'op-times' : 'op-divide'));

        this.isModeBForgeAnimating = true;
        this.carriedBubbleView.hide();
        runForgeRoundTripAnimation({
          bubbleEl: this.splitLeftEl,
          twinEl: this.splitRightEl || undefined,
          from,
          to: target,
          originalSymbol,
          forgedSymbol,
          originalClass,
          forgedClass,
          getReturnPosition: () => this.interaction.getState().carriedPosition,
          reducedMotion: this.game.reducedMotion,
          onComplete: () => {
            this.isModeBForgeAnimating = false;
            this.needTargetsRefresh = true;
          }
        });
      }
    } else {
      this.forgePanelView.triggerShake(sign);
      this.carriedBubbleView.triggerNahUhShake();
    }
  }

  private handleSelectBlaster(blaster: BlasterType) {
    this.game.selectBlaster(blaster);
    this.needTargetsRefresh = true;
  }

  private handleModeBPickup(
    term: 'constant' | 'coefficient',
    source: { x: number; y: number },
    finger: { x: number; y: number }
  ) {
    const before = this.game.getState();
    if (!this.game.pickup(term) || !this.splitRightEl) return;

    const isDivision = Boolean(before.problem.d && before.problem.d > 1);
    const operand = term === 'constant'
      ? Math.abs(before.currentB)
      : (isDivision ? before.problem.d! : before.currentA);
    const symbol = term === 'constant'
      ? `${before.currentB < 0 ? '\u2212' : '+'}${operand}`
      : (isDivision ? `÷${operand}` : `\u00d7${operand}`);
    const operationClass = term === 'constant'
      ? (before.currentB < 0 ? 'op-minus' : 'op-plus')
      : (isDivision ? 'op-divide' : 'op-times');

    this.isModeBPickupAnimating = true;
    this.carriedBubbleView.hide();
    runPickupToFingerAnimation({
      bubbleEl: this.splitRightEl,
      source,
      finger,
      symbol,
      operationClass,
      reducedMotion: this.game.reducedMotion,
      onComplete: () => {
        this.isModeBPickupAnimating = false;
        this.needTargetsRefresh = true;
      }
    });
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
    if (this.isSplitting || this.isModeBForgeAnimating || this.isModeBPickupAnimating) return;
    this.isSplitting = true;
    const splitSource = this.interaction.getState().carriedPosition || undefined;
    this.carriedBubbleView.hide();

    const targets = this.equationView.getSplitTargets();
    const eqRect = this.equationView.getEqualsRect();

    if (!this.game.applyBalance()) {
      this.isSplitting = false;
      return;
    }

    if (!targets || !eqRect || !this.splitLeftEl || !this.splitRightEl) {
      this.game.revealModeBBalanceSide('lhs');
      this.game.revealModeBBalanceSide('rhs');
      this.game.finishModeBBalance();
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
      source: splitSource,
      onLhsImpact: () => {
        this.game.revealModeBBalanceSide('lhs');
        this.needTargetsRefresh = true;
      },
      onRhsImpact: () => {
        this.game.revealModeBBalanceSide('rhs');
        this.needTargetsRefresh = true;
      },
      onComplete: () => {
        this.isSplitting = false;
        this.game.finishModeBBalance();
        this.needTargetsRefresh = true;
      },
      reducedMotion: this.game.reducedMotion
    });
  }

  private triggerModeBCleanup() {
    if (this.isModeBCleanupAnimating || this.game.getState().phase !== 'awaiting_cleanup') return;
    this.isModeBCleanupAnimating = true;
    this.equationView.triggerModeBCleanup(() => {
      this.isModeBCleanupAnimating = false;
      this.game.cancelLhs();
      this.needTargetsRefresh = true;
    }, this.game.reducedMotion);
  }

  private updateView(state = this.game.getState()) {
    const currentEquation = this.game.getCurrentLevel();
    if (this.lastLevelId !== currentEquation.id) {
      this.lastLevelId = currentEquation.id;
      this.storyController.initLevel(currentEquation);
    }

    if (state.phase === 'solved') {
      this.storyController.handlePuzzleSolved();
    }

    this.equationView.render(state);
    const showModeBAnswer = state.mode === 'mode_b'
      && state.phase === 'awaiting_cleanup'
      && !!state.balancedDisplay?.rhsActivated
      && !state.balancedDisplay?.rhsSolved;
    this.answersView.render((state.phase === 'question' || showModeBAnswer) ? state.pendingArithmetic : null);
    this.markLayoutDirty();

    // Data-driven contextual instructions and camera badge hints
    const storyState = this.storyController.getState();
    if (!storyState.enabled || (storyState.phase === 'solving' && !storyState.isPopoverOpen)) {
      const modeDef = getModeDefinition(state.mode);
      this.hudView.updateInstruction(modeDef.getInstruction(state));

      const hintBadge = document.getElementById('camera-hint-badge');
      if (hintBadge) {
        hintBadge.textContent = modeDef.getBadgeHint(state);
      }
    }

  }

  private async toggleCamera() {
    if (this.isCameraRunning) {
      this.camera.stopCamera();
      this.isCameraRunning = false;
      this.lastHands = null;
      this.lastVideoCurrentTime = -1;
      this.lastInferenceTime = 0;
      try {
        localStorage.setItem('algebra_camera_enabled', 'false');
      } catch {}
      this.hudView.setCameraAutoStart(false);
      this.setCameraUiState(false);
      this.hudView.updateInstruction('Camera stopped. Mouse & keyboard active.');
      return;
    }
    await this.startCamera();
  }

  private async startCamera(silentFail: boolean = false) {
    this.hudView.updateInstruction('Requesting camera access...');
    const startRes = await this.camera.startCamera(this.videoEl);
    if (!startRes.success) {
      if (startRes.errorName === 'NotAllowedError' || startRes.errorName === 'SecurityError') {
        try {
          localStorage.setItem('algebra_camera_enabled', 'false');
        } catch {}
        this.hudView.setCameraAutoStart(false);
      }
      this.setCameraUiState(false);
      if (!silentFail) {
        alert(startRes.error || 'Unable to access camera.');
      }
      this.hudView.updateInstruction('Camera unavailable. Playing with mouse & keyboard.');
      this.hudView.showCameraBanner();
      return;
    }

    this.hudView.updateInstruction('Loading hand tracking model...');
    const landmarkerRes = await this.landmarker.initialize();
    if (!landmarkerRes.success) {
      if (!silentFail) {
        alert(landmarkerRes.error || 'Unable to load hand landmarker.');
      }
      this.camera.stopCamera();
      this.setCameraUiState(false);
      this.hudView.updateInstruction('Hand tracking model failed to load. Playing with mouse.');
      this.hudView.showCameraBanner();
      return;
    }

    this.isCameraRunning = true;
    try {
      localStorage.setItem('algebra_camera_enabled', 'true');
    } catch {}
    this.syncCameraMediaAspect();
    this.hudView.setCameraAutoStart(true);
    this.setCameraUiState(true);
    this.hudView.updateInstruction('Camera & finger laser active! Point your index finger.');
  }

  private setCameraUiState(active: boolean) {
    this.cachedCameraViewport = null;
    if (!active) {
      this.lastHands = null;
      this.lastVideoCurrentTime = -1;
      this.lastInferenceTime = 0;
      this.pointingStabilizer.reset();
    }
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.dataset.cameraActive = String(active);
      appEl.dataset.cameraDock = this.cameraDock;
    }
    this.hudView.setCameraState(active);
    this.videoEl.classList.toggle('active', active);
    this.cameraBoxEl?.classList.toggle('active', active);
    document.getElementById('camera-status-dot')?.classList.toggle('active', active);
    const placeholder = document.getElementById('camera-placeholder');
    if (placeholder) placeholder.style.display = active ? 'none' : 'flex';
    this.markLayoutDirty();
  }

  private loop(timestamp: number) {
    const now = timestamp;
    const nowSec = performance.now();

    let hands = null;
    let laserRay: LaserRay | null = null;
    let hitResult = null;
    let classifiedPose = null;
    let interactiveTargets: InteractiveTarget[] = [];

    // Responsive geometry is measured only after state/content/viewport changes.
    const currentPhase = this.game.getState().phase;
    if (this.layoutDirty) {
      this.layoutDirty = false;
      this.updateArrowAndLayout(currentPhase);
      this.needTargetsRefresh = true;
      this.cachedCameraViewport = null;
    }

    // Collect interactive targets from DOM
    interactiveTargets = this.collectTargets();

    // Determine camera viewport bounds (cached to eliminate 60 FPS DOM queries & style recalculations)
    if (!this.cachedCameraViewport) {
      this.cachedCameraViewport = this.computeCameraViewport();
    }
    const cameraViewport = this.cachedCameraViewport;

    if (this.isCameraRunning && this.videoEl.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      // Throttle vision inference to 30 FPS and run only when a new camera frame has been decoded
      const timeSinceLastInference = nowSec - this.lastInferenceTime;
      const isNewFrame = this.videoEl.currentTime !== this.lastVideoCurrentTime;

      if (timeSinceLastInference >= 30 && isNewFrame) {
        this.lastInferenceTime = nowSec;
        this.lastVideoCurrentTime = this.videoEl.currentTime;
        hands = this.landmarker.detect(this.videoEl, nowSec);
        this.lastHands = hands;
      } else {
        // Reuse prior detection for silky-smooth 60 FPS laser interpolation
        hands = this.lastHands;
      }

      if (hands && hands.length > 0) {
        // Choose primary hand (first hand or matching locked hand)
        const primaryHand = hands[0];
        classifiedPose = classifyHandPose(primaryHand.landmarks, primaryHand.score);
        if (this.pointingStabilizer.update(classifiedPose, now)) {
          classifiedPose.isPointing = true;
        }

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
      if (!hands || hands.length === 0) {
        this.pointingStabilizer.reset();
      }
    }

    // Update interaction controller with vision frame
    this.interaction.updateVisionFrame(laserRay, classifiedPose, hitResult, now);

    const interState = this.interaction.getState();
    const gameState = this.game.getState();

    // Process Carried Bubble Position & Magnetic Snapping
    const isCarryingLike = (gameState.phase === 'carrying' || gameState.phase === 'forging' || gameState.phase === 'applying') && gameState.carriedTerm && !this.carriedBubbleView.isBusy() && !this.isSplitting && !this.isModeBForgeAnimating && !this.isModeBPickupAnimating;

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
    } else if (!this.carriedBubbleView.isBusy() && !this.isSplitting && !this.isModeBForgeAnimating && !this.isModeBPickupAnimating) {
      this.carriedBubbleView.hide();
    }

    // 60 FPS lightweight updates
    this.forgePanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.blasterPanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.inversePanelView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
    this.equationView.setDestinationHovered(interState.isDestinationHovered);
    this.answersView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);

    if (this.storyController.isEnabled()) {
      if (this.storyController.getState().phase === 'choosing_equation' && this.equationChoiceView) {
        this.equationChoiceView.updateDwell(interState.hoveredTargetId, interState.dwellProgress);
      }
      const btnCloseStory = document.getElementById('btn-close-story');
      if (btnCloseStory) {
        if (interState.hoveredTargetId === 'btn-close-story') {
          btnCloseStory.classList.add('dwell-active');
        } else {
          btnCloseStory.classList.remove('dwell-active');
        }
      }
    }

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

  private positionPortraitPanel(
    panel: HTMLElement,
    cameraRect: DOMRect,
    stageLeft: number,
    stageTop: number,
    stageWidth: number
  ) {
    const gap = 6;
    const edge = 8;
    const cameraLeft = cameraRect.left - stageLeft;
    const cameraRight = cameraRect.right - stageLeft;
    const dockOnRight = this.cameraDock === 'right';
    const left = dockOnRight ? edge : cameraRight + gap;
    const width = Math.max(104, dockOnRight
      ? cameraLeft - gap - edge
      : stageWidth - left - edge);

    panel.style.setProperty('left', `${left}px`, 'important');
    panel.style.setProperty('top', `${cameraRect.top - stageTop}px`, 'important');
    panel.style.setProperty('width', `${width}px`, 'important');
    panel.style.setProperty('height', `${cameraRect.height}px`, 'important');

    const cardsContainer = panel.querySelector<HTMLElement>(
      '.forge-cards-vertical, .blaster-cards-vertical, .inverse-cards-list, .answer-cards-list, .story-equation-cards-vertical'
    );
    if (cardsContainer) {
      const cardsHeight = Math.max(0, cameraRect.height - cardsContainer.offsetTop);
      cardsContainer.style.setProperty('height', `${cardsHeight}px`, 'important');
      cardsContainer.style.setProperty('flex', '0 0 auto');
    }
  }

  private positionKeyboardPanel(
    panel: HTMLElement,
    stageTop: number,
    stageWidth: number,
    maxBottom: number
  ) {
    const width = Math.min(stageWidth - 16, window.innerWidth <= 768 ? 440 : 360);
    const visibleAnchors = [this.storyAreaEl, this.equationAreaEl]
      .filter((element): element is HTMLElement => Boolean(element && getComputedStyle(element).display !== 'none'))
      .map(element => element.getBoundingClientRect().bottom);
    const contentBottom = Math.max(stageTop, ...visibleAnchors);
    const top = Math.max(8, contentBottom - stageTop + 8);
    const height = Math.max(140, Math.min(380, maxBottom - stageTop - top));
    const left = Math.max(8, (stageWidth - width) / 2);

    panel.style.setProperty('left', `${left}px`, 'important');
    panel.style.setProperty('top', `${top}px`, 'important');
    panel.style.setProperty('width', `${width}px`, 'important');
    panel.style.setProperty('height', `${height}px`, 'important');
    panel.style.setProperty('right', 'auto', 'important');

    const cardsContainer = panel.querySelector<HTMLElement>(
      '.forge-cards-vertical, .blaster-cards-vertical, .inverse-cards-list, .answer-cards-list, .story-equation-cards-vertical'
    );
    if (cardsContainer) {
      const cardsHeight = Math.max(80, height - cardsContainer.offsetTop);
      cardsContainer.style.setProperty('height', `${cardsHeight}px`, 'important');
      cardsContainer.style.setProperty('flex', '0 0 auto');
    }
  }

  private fitEquationRail() {
    const rail = this.equationAreaEl?.querySelector<HTMLElement>('.equation-rail');
    if (!rail) return;
    rail.style.removeProperty('zoom');
    if (window.innerWidth > 768 || window.innerHeight <= window.innerWidth) return;

    const availableWidth = Math.max(240, Math.min(window.innerWidth - 16, this.equationAreaEl?.clientWidth || window.innerWidth));
    const naturalWidth = Math.max(rail.scrollWidth, rail.offsetWidth);
    if (naturalWidth > availableWidth) {
      rail.style.setProperty('zoom', String(Math.max(0.62, availableWidth / naturalWidth)));
    }
  }

  private updateArrowAndLayout(phase: string) {
    const gameState = this.game.getState();
    const storyState = this.storyController.getState();
    const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
    const showModeBAnswer = gameState.mode === 'mode_b'
      && phase === 'awaiting_cleanup'
      && !!gameState.balancedDisplay?.rhsActivated
      && !gameState.balancedDisplay?.rhsSolved;
    const hasPortraitPanel = storyState.enabled && storyState.phase === 'choosing_equation'
      || gameState.mode === 'mode_b' && phase === 'forging'
      || gameState.mode === 'mode_b' && (phase === 'question' || showModeBAnswer)
      || gameState.mode === 'mode_c'
      || gameState.mode === 'mode_d' && phase === 'choose_inverse';
    const appEl = document.getElementById('app');
    if (appEl) {
      const portraitPanelValue = String(isMobilePortrait && hasPortraitPanel);
      const portraitPanelChanged = appEl.dataset.portraitPanel !== portraitPanelValue;
      appEl.dataset.mode = gameState.mode;
      appEl.dataset.phase = phase;
      appEl.dataset.storyPhase = storyState.enabled ? storyState.phase : 'disabled';
      appEl.dataset.storyFeedback = String(Boolean(storyState.lastFeedback));
      appEl.dataset.portraitPanel = portraitPanelValue;
      appEl.classList.toggle('layout-portrait', isMobilePortrait);
      if (this.cameraBoxEl && this.isCameraRunning) {
        appEl.style.setProperty('--camera-inline-size', `${this.cameraBoxEl.getBoundingClientRect().width}px`);
      } else {
        appEl.style.removeProperty('--camera-inline-size');
      }
      if (portraitPanelChanged) {
        requestAnimationFrame(() => this.markLayoutDirty());
      }
    }
    this.fitEquationRail();
    const stageRect = document.querySelector<HTMLElement>('.stage-container')?.getBoundingClientRect();
    const stageLeft = stageRect?.left ?? 0;
    const stageTop = stageRect?.top ?? 0;
    const stageWidth = stageRect?.width ?? window.innerWidth;
    const footerEl = document.getElementById('hud-footer');
    const footerHeight = footerEl ? footerEl.offsetHeight : 55;
    const maxBottom = window.innerHeight - footerHeight - 10;

    // 1. Forge Panel on Left (visible during forging or applying in Mode B)
    const isForgeVisible = gameState.mode === 'mode_b' && phase === 'forging';
    if (isForgeVisible && this.cameraBoxEl && this.forgePanelEl) {
      this.forgePanelEl.style.display = 'flex';
      this.forgePanelView.render(true, phase as 'forging' | 'applying', gameState.forgedOperation?.forgedOperator || null);

      if (!this.isCameraRunning) {
        this.forgePanelEl.classList.toggle('panel-portrait-dock', isMobilePortrait);
        this.positionKeyboardPanel(this.forgePanelEl, stageTop, stageWidth, maxBottom);
      } else if (isMobilePortrait) {
        this.forgePanelEl.classList.add('panel-portrait-dock');
        this.forgePanelEl.style.left = '';
        this.forgePanelEl.style.top = '';
        this.forgePanelEl.style.width = '';
        this.forgePanelEl.style.height = '';
        this.forgePanelEl.style.right = '';
        const cardsContainer = this.forgePanelEl.querySelector<HTMLElement>('.forge-cards-vertical');
        if (cardsContainer) {
          cardsContainer.style.height = '';
          cardsContainer.style.flex = '';
        }
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        this.positionPortraitPanel(this.forgePanelEl, cameraRect, stageLeft, stageTop, stageWidth);
      } else {
        this.forgePanelEl.classList.remove('panel-portrait-dock');
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        const columnWidth = window.innerWidth <= 1366 || window.innerHeight <= 820 ? 145 : 165;
        let left = cameraRect.left - stageLeft - columnWidth - 14;
        if (left < 10) left = 10;

        const cardsContainer = this.forgePanelEl.querySelector<HTMLElement>('.forge-cards-vertical');
        const headerHeight = cardsContainer?.offsetTop ?? 46;
        const top = Math.max(4, cameraRect.top - stageTop - headerHeight);
        const safeCardsHeight = cameraRect.height;
        const totalHeight = safeCardsHeight + headerHeight;

        this.forgePanelEl.style.left = `${left}px`;
        this.forgePanelEl.style.top = `${top}px`;
        this.forgePanelEl.style.width = `${columnWidth}px`;
        this.forgePanelEl.style.height = `${totalHeight}px`;
        this.forgePanelEl.style.right = 'auto';

        if (cardsContainer) {
          cardsContainer.style.height = `${safeCardsHeight}px`;
          cardsContainer.style.flex = '0 0 auto';
        }
      }
    } else {
      if (this.forgePanelEl) {
        this.forgePanelEl.classList.remove('panel-portrait-dock');
        this.forgePanelEl.style.display = 'none';
      }
      this.forgePanelView.render(false);
    }

    // Mode C: Blaster Panel on Left
    const isBlasterVisible = gameState.mode === 'mode_c';
    if (isBlasterVisible && this.cameraBoxEl && this.blasterPanelEl) {
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

      if (!this.isCameraRunning) {
        this.blasterPanelEl.classList.toggle('panel-portrait-dock', isMobilePortrait);
        this.positionKeyboardPanel(this.blasterPanelEl, stageTop, stageWidth, maxBottom);
      } else if (isMobilePortrait) {
        this.blasterPanelEl.classList.add('panel-portrait-dock');
        this.blasterPanelEl.style.left = '';
        this.blasterPanelEl.style.top = '';
        this.blasterPanelEl.style.width = '';
        this.blasterPanelEl.style.height = '';
        this.blasterPanelEl.style.right = '';
        const cardsContainer = this.blasterPanelEl.querySelector<HTMLElement>('.blaster-cards-vertical');
        if (cardsContainer) {
          cardsContainer.style.height = '';
          cardsContainer.style.flex = '';
        }
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        this.positionPortraitPanel(this.blasterPanelEl, cameraRect, stageLeft, stageTop, stageWidth);
      } else {
        this.blasterPanelEl.classList.remove('panel-portrait-dock');
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        const columnWidth = window.innerWidth <= 1366 || window.innerHeight <= 820 ? 145 : 165;
        let left = cameraRect.left - columnWidth - 14;
        if (left < 10) left = 10;

        const headerEl = this.blasterPanelEl.querySelector<HTMLElement>('.blaster-header');
        const headerHeight = headerEl ? headerEl.offsetHeight + 6 : 46;
        const top = Math.max(10, cameraRect.top - headerHeight);
        const safeCardsHeight = Math.max(100, Math.min(cameraRect.height, maxBottom - cameraRect.top));
        const totalHeight = safeCardsHeight + (cameraRect.top - top);

        this.blasterPanelEl.style.left = `${left}px`;
        this.blasterPanelEl.style.top = `${top}px`;
        this.blasterPanelEl.style.width = `${columnWidth}px`;
        this.blasterPanelEl.style.height = `${totalHeight}px`;
        this.blasterPanelEl.style.right = 'auto';

        const cardsContainer = this.blasterPanelEl.querySelector<HTMLElement>('.blaster-cards-vertical');
        if (cardsContainer) {
          cardsContainer.style.height = `${safeCardsHeight}px`;
          cardsContainer.style.flex = '0 0 auto';
        }
      }
    } else {
      if (this.blasterPanelEl) {
        this.blasterPanelEl.classList.remove('panel-portrait-dock');
        this.blasterPanelEl.style.display = 'none';
      }
      this.blasterPanelView.render(false);
    }

    // Mode D: Inverse Panel on Left (visible during 'choose_inverse' phase)
    const isInverseVisible = gameState.mode === 'mode_d' && phase === 'choose_inverse';
    if (isInverseVisible && this.cameraBoxEl && this.inversePanelEl) {
      this.inversePanelEl.style.display = 'flex';
      const prompt = gameState.modeDState?.targetTerm === 'constant'
        ? `What blasts away ${gameState.currentB < 0 ? `−${Math.abs(gameState.currentB)}` : `+${gameState.currentB}`}?`
        : `What blasts away ×${gameState.currentA}?`;

      this.inversePanelView.render(true, gameState.modeDState?.inverseChoices || [], prompt);

      if (!this.isCameraRunning) {
        this.inversePanelEl.classList.toggle('panel-portrait-dock', isMobilePortrait);
        this.positionKeyboardPanel(this.inversePanelEl, stageTop, stageWidth, maxBottom);
      } else if (isMobilePortrait) {
        this.inversePanelEl.classList.add('panel-portrait-dock');
        this.inversePanelEl.style.left = '';
        this.inversePanelEl.style.top = '';
        this.inversePanelEl.style.width = '';
        this.inversePanelEl.style.height = '';
        this.inversePanelEl.style.right = '';
        const cardsContainer = this.inversePanelEl.querySelector<HTMLElement>('.inverse-cards-list');
        if (cardsContainer) {
          cardsContainer.style.height = '';
          cardsContainer.style.flex = '';
        }
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        this.positionPortraitPanel(this.inversePanelEl, cameraRect, stageLeft, stageTop, stageWidth);
      } else {
        this.inversePanelEl.classList.remove('panel-portrait-dock');
        const cameraRect = this.cameraBoxEl.getBoundingClientRect();
        const columnWidth = window.innerWidth <= 1366 || window.innerHeight <= 820 ? 150 : 175;
        let left = cameraRect.left - columnWidth - 14;
        if (left < 10) left = 10;

        const headerEl = this.inversePanelEl.querySelector<HTMLElement>('.inverse-header');
        const headerHeight = headerEl ? headerEl.offsetHeight + 6 : 46;
        const top = Math.max(10, cameraRect.top - headerHeight);
        const safeCardsHeight = Math.max(100, Math.min(cameraRect.height, maxBottom - cameraRect.top));
        const totalHeight = safeCardsHeight + (cameraRect.top - top);

        this.inversePanelEl.style.left = `${left}px`;
        this.inversePanelEl.style.top = `${top}px`;
        this.inversePanelEl.style.width = `${columnWidth}px`;
        this.inversePanelEl.style.height = `${totalHeight}px`;
        this.inversePanelEl.style.right = 'auto';

        const cardsContainer = this.inversePanelEl.querySelector<HTMLElement>('.inverse-cards-list');
        if (cardsContainer) {
          cardsContainer.style.height = `${safeCardsHeight}px`;
          cardsContainer.style.flex = '0 0 auto';
        }
      }
    } else {
      if (this.inversePanelEl) {
        this.inversePanelEl.classList.remove('panel-portrait-dock');
        this.inversePanelEl.style.display = 'none';
      }
      this.inversePanelView.render(false);
    }

    // Mode D: Inverse operation blast arrow from left panel to targeted side
    if (isInverseVisible && this.cameraBoxEl && gameState.modeDState?.selectedInverse) {
      const activeCard = this.inversePanelEl?.querySelector<HTMLElement>('.inverse-card.active');
      const targetedSide: 'lhs' | 'rhs' = 'lhs';
      const targetSideEl = targetedSide === 'lhs' 
        ? (document.getElementById('term-group-a') || document.getElementById('equation-lhs'))
        : (document.getElementById('term-rhs') || document.getElementById('equation-rhs'));

      if (activeCard && targetSideEl && this.arrowSvgEl && this.arrowPathEl) {
        const sourceRect = activeCard.getBoundingClientRect();
        const targetRect = targetSideEl.getBoundingClientRect();

        const startX = sourceRect.right + 6;
        const startY = sourceRect.top + sourceRect.height / 2;
        const endX = targetRect.left - 10;
        const endY = targetRect.top + targetRect.height / 2;

        const cp1X = startX + (endX - startX) * 0.45;
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

    // 2.5 Story Mode Equation Choices Column on Right (matches answers-column layout)
    const isStoryChoiceVisible = storyState.enabled && storyState.phase === 'choosing_equation';
    if (isStoryChoiceVisible && this.cameraBoxEl && this.storyChoicesColumnEl) {
      this.storyChoicesColumnEl.style.display = 'flex';
      const cameraRect = this.cameraBoxEl.getBoundingClientRect();

      if (!this.isCameraRunning) {
        this.storyChoicesColumnEl.classList.toggle('panel-portrait-dock', isMobilePortrait);
        this.positionKeyboardPanel(this.storyChoicesColumnEl, stageTop, stageWidth, maxBottom);
      } else if (isMobilePortrait) {
        this.storyChoicesColumnEl.classList.add('panel-portrait-dock');
        this.storyChoicesColumnEl.style.left = '';
        this.storyChoicesColumnEl.style.top = '';
        this.storyChoicesColumnEl.style.width = '';
        this.storyChoicesColumnEl.style.height = '';
        this.storyChoicesColumnEl.style.right = '';
        const cardsContainer = this.storyChoicesColumnEl.querySelector<HTMLElement>('.story-equation-cards-vertical');
        if (cardsContainer) {
          cardsContainer.style.height = '';
          cardsContainer.style.flex = '';
        }
        this.positionPortraitPanel(this.storyChoicesColumnEl, cameraRect, stageLeft, stageTop, stageWidth);
      } else {
        this.storyChoicesColumnEl.classList.remove('panel-portrait-dock');
        const columnWidth = window.innerWidth >= 1600 ? 310 : (window.innerWidth <= 1366 || window.innerHeight <= 820 ? 250 : 280);

        let left = cameraRect.right - stageLeft + 16;
        if (stageRect && left + columnWidth > stageRect.width - 12) {
          left = Math.max(10, stageRect.width - columnWidth - 12);
        }

        const cardsContainer = this.storyChoicesColumnEl.querySelector<HTMLElement>('.story-equation-cards-vertical');
        const headerExtra = cardsContainer?.offsetTop ?? 48;
        const top = Math.max(4, cameraRect.top - stageTop - headerExtra);
        const safeCardsHeight = cameraRect.height;
        const totalHeight = safeCardsHeight + headerExtra;

        this.storyChoicesColumnEl.style.left = `${left}px`;
        this.storyChoicesColumnEl.style.top = `${top}px`;
        this.storyChoicesColumnEl.style.width = `${columnWidth}px`;
        this.storyChoicesColumnEl.style.height = `${totalHeight}px`;
        this.storyChoicesColumnEl.style.right = 'auto';

        if (cardsContainer) {
          cardsContainer.style.height = `${safeCardsHeight}px`;
          cardsContainer.style.flex = '0 0 auto';
        }
      }
      if (this.arrowSvgEl) this.arrowSvgEl.style.display = 'none';
      if (this.answersColumnEl) {
        this.answersColumnEl.classList.remove('panel-portrait-dock');
        this.answersColumnEl.style.display = 'none';
      }
      return;
    } else if (this.storyChoicesColumnEl) {
      this.storyChoicesColumnEl.classList.remove('panel-portrait-dock');
      this.storyChoicesColumnEl.style.display = 'none';
    }

    // 3. Answers Column on Right (also available during Mode B's parallel cleanup stage)
    if (phase !== 'question' && !showModeBAnswer) {
      if (this.arrowSvgEl) this.arrowSvgEl.style.display = 'none';
      if (this.answersColumnEl) {
        this.answersColumnEl.classList.remove('panel-portrait-dock');
        this.answersColumnEl.style.display = 'none';
      }
      return;
    }

    if (!this.cameraBoxEl || !this.answersColumnEl) return;

    this.answersColumnEl.style.display = 'flex';
    const cameraRect = this.cameraBoxEl.getBoundingClientRect();

    if (!this.isCameraRunning) {
      this.answersColumnEl.classList.toggle('panel-portrait-dock', isMobilePortrait);
      this.positionKeyboardPanel(this.answersColumnEl, stageTop, stageWidth, maxBottom);
    } else if (isMobilePortrait) {
      this.answersColumnEl.classList.add('panel-portrait-dock');
      this.answersColumnEl.style.left = '';
      this.answersColumnEl.style.top = '';
      this.answersColumnEl.style.width = '';
      this.answersColumnEl.style.height = '';
      this.answersColumnEl.style.right = '';
      const cardsContainer = this.answersColumnEl.querySelector<HTMLElement>('.answer-cards-list');
      if (cardsContainer) {
        cardsContainer.style.height = '';
        cardsContainer.style.flex = '';
      }
      this.positionPortraitPanel(this.answersColumnEl, cameraRect, stageLeft, stageTop, stageWidth);
    } else {
      this.answersColumnEl.classList.remove('panel-portrait-dock');
      const columnWidth = window.innerWidth <= 1366 || window.innerHeight <= 820 ? 220 : 260;

      let left = cameraRect.right - stageLeft + 16;
      if (stageRect && left + columnWidth > stageRect.width - 12) {
        left = Math.max(10, stageRect.width - columnWidth - 12);
      }

      const cardsContainer = this.answersColumnEl.querySelector<HTMLElement>('.answer-cards-list');
      const questionHeight = cardsContainer?.offsetTop ?? 48;
      const top = Math.max(4, cameraRect.top - stageTop - questionHeight);
      const safeCardsHeight = cameraRect.height;
      const totalHeight = safeCardsHeight + questionHeight;

      this.answersColumnEl.style.left = `${left}px`;
      this.answersColumnEl.style.top = `${top}px`;
      this.answersColumnEl.style.width = `${columnWidth}px`;
      this.answersColumnEl.style.height = `${totalHeight}px`;
      this.answersColumnEl.style.right = 'auto';

      if (cardsContainer) {
        cardsContainer.style.height = `${safeCardsHeight}px`;
        cardsContainer.style.flex = '0 0 auto';
      }
    }

    // Curving arrow from equation to question card
    const termEl = document.getElementById('arithmetic-rhs') || document.getElementById('term-simplify-target') || document.getElementById('term-rhs-mode-c');
    const questionCard = this.answersColumnEl.querySelector<HTMLElement>('.arithmetic-question');

    if (termEl && questionCard && this.arrowSvgEl && this.arrowPathEl) {
      const termRect = termEl.getBoundingClientRect();
      const qRect = questionCard.getBoundingClientRect();

      if (isMobilePortrait || !this.isCameraRunning) {
        const startX = termRect.left + termRect.width / 2;
        const startY = termRect.bottom + 4;
        const endX = qRect.left + qRect.width / 2;
        const endY = qRect.top - 6;
        const midY = startY + (endY - startY) * 0.5;
        const d = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
        this.arrowPathEl.setAttribute('d', d);
        this.arrowSvgEl.style.display = 'block';
      } else {
        const startX = termRect.right + 6;
        const startY = termRect.top + termRect.height / 2;
        const endX = qRect.left - 10;
        const endY = qRect.top + 28;

        const cornerX = Math.max(startX + 24, Math.min(cameraRect.right + 10, endX - 10));
        const d = `M ${startX} ${startY} C ${cornerX} ${startY}, ${cornerX} ${endY}, ${endX} ${endY}`;
        this.arrowPathEl.setAttribute('d', d);
        this.arrowSvgEl.style.display = 'block';
      }
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

  private appendPanelTargets(
    targets: InteractiveTarget[],
    elements: Array<{ id: string; element: HTMLElement }>,
    type: InteractiveTarget['type'],
    padding: number,
    priority: number
  ) {
    const sourceRects: TargetRectInput[] = elements.map(({ element }) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const expandedRects = expandNonOverlappingTargets(sourceRects, {
      padding,
      guard: 4,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    });

    elements.forEach((target, index) => {
      targets.push({
        id: target.id,
        type,
        rect: expandedRects[index],
        enabled: true,
        priority
      });
    });
  }

  private collectTargets(): InteractiveTarget[] {
    const gameState = this.game.getState();
    const storyState = this.storyController.getState();
    if (!this.needTargetsRefresh) {
      return this.cachedTargets;
    }

    const targets: InteractiveTarget[] = [];

    // If Story Mode is blocking solver interactions (reading, choosing, condensing, or popover open)
    if (this.storyController.blocksSolverInteraction()) {
      if (storyState.phase === 'choosing_equation' && this.equationChoiceView) {
        const choiceTargets = this.equationChoiceView.getInteractiveElements();
        this.appendPanelTargets(targets, choiceTargets, 'equation_choice', 16, 2);
      }

      if (this.storyView) {
        const storyUtility = this.storyView.getInteractiveElements();
        storyUtility.forEach(t => {
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
            priority: 3
          });
        });
      }

      this.cachedTargets = targets;
      this.needTargetsRefresh = false;
      return targets;
    }

    // Normal solver targets:
    const eqTargets = this.equationView.getInteractiveElements();
    const ansTargets = this.answersView.getInteractiveElements();
    const forgeTargets = this.forgePanelView.getInteractiveElements();
    const blasterTargets = this.blasterPanelView.getInteractiveElements();

    eqTargets.forEach(t => {
      const rect = t.element.getBoundingClientRect();
      const isModeBAction = t.id === 'mode-b-rhs-target' || t.id === 'mode-b-cleanup-target';
      const pad = t.id === 'mode-b-cleanup-target' ? 16 : (isModeBAction ? 32 : 24);
      const priority = isModeBAction ? 2 : 1;
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
        priority
      });
    });

    if (gameState.phase === 'forging') {
      this.appendPanelTargets(targets, forgeTargets, 'forge', 22, 2);
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

    this.appendPanelTargets(targets, ansTargets, 'answer', 22, 2);

    if (storyState.enabled && this.storyView) {
      const storyUtility = this.storyView.getInteractiveElements();
      storyUtility.forEach(t => {
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
          priority: 1
        });
      });
    }

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
      if (this.storyController.blocksSolverInteraction()) return;
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
      if (this.storyController.blocksSolverInteraction()) return;
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
        this.markLayoutDirty();
      });
    }
  }
}

// Bootstrap when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
