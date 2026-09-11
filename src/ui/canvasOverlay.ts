import { HandLandmarks, LaserRay, RayHitResult, LandmarkPoint } from '../vision/types';
import { transformLandmarkToViewport, ViewportRect } from '../vision/coordinateTransform';
import { InteractiveTarget } from '../vision/rayCaster';

export interface BlasterOverlayInfo {
  type: string | null;
  carriedOperandText?: string | null;
  carriedOperandFormat?: 'text' | 'division';
  dwellProgress?: number;
}

interface BlasterTheme {
  primary: string;
  glow: string;
  glowAlpha: string;
  symbol: string;
}

function getBlasterTheme(type: string | null | undefined): BlasterTheme {
  switch (type) {
    case '+':
      return { primary: '#10b981', glow: '#34d399', glowAlpha: 'rgba(16, 185, 129, 0.45)', symbol: '+' };
    case '-':
    case '−':
      return { primary: '#f43f5e', glow: '#fb7185', glowAlpha: 'rgba(244, 63, 94, 0.45)', symbol: '−' };
    case '×':
      return { primary: '#f59e0b', glow: '#fbbf24', glowAlpha: 'rgba(245, 158, 11, 0.45)', symbol: '×' };
    case '÷':
    case '/':
      return { primary: '#a855f7', glow: '#c084fc', glowAlpha: 'rgba(168, 85, 247, 0.45)', symbol: '÷' };
    case 'calc':
      return { primary: '#38bdf8', glow: '#60a5fa', glowAlpha: 'rgba(56, 189, 248, 0.5)', symbol: '⚡' };
    default:
      return { primary: '#fbbf24', glow: '#06b6d4', glowAlpha: 'rgba(6, 182, 212, 0.4)', symbol: '' };
  }
}

interface OverlayParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  text?: string;
  size?: number;
}

export class CanvasOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public handsOnly: boolean = false;
  public showDebug: boolean = false;

  private static readonly MAX_PARTICLES = 64;
  private particlePool: OverlayParticle[] = Array.from({ length: CanvasOverlay.MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    color: '',
    text: undefined,
    size: 16
  }));

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
  }

  public render(
    hands: HandLandmarks[] | null,
    ray: LaserRay | null,
    hit: RayHitResult | null,
    carriedPos: { x: number; y: number } | null,
    cameraViewport: ViewportRect,
    debugTargets?: InteractiveTarget[],
    blasterInfo?: BlasterOverlayInfo
  ) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw Hand Skeletons over camera viewport
    if (hands && hands.length > 0) {
      for (const hand of hands) {
        this.drawHandSkeleton(hand.landmarks, cameraViewport);
      }
    }

    // 3. Draw Laser Ray
    if (ray && ray.active) {
      this.drawLaserRay(ray, hit, blasterInfo);
    }

    // 4. Draw Tether to Carried Term (Mode A)
    if (ray && ray.active && carriedPos) {
      this.drawTether(ray.origin, carriedPos);
    }

    // 5. Update and Draw Particles
    this.updateAndDrawParticles();

    // 6. Debug Target Overlays
    if (this.showDebug && debugTargets) {
      this.drawDebugTargets(debugTargets, hit);
    }
  }

  private drawHandSkeleton(landmarks: LandmarkPoint[], viewport: ViewportRect) {
    const ctx = this.ctx;
    const connections = [
      // Thumb
      [0, 1], [1, 2], [2, 3], [3, 4],
      // Index
      [0, 5], [5, 6], [6, 7], [7, 8],
      // Middle
      [0, 9], [9, 10], [10, 11], [11, 12],
      // Ring
      [0, 13], [13, 14], [14, 15], [15, 16],
      // Pinky
      [0, 17], [17, 18], [18, 19], [19, 20],
      // Palm cross
      [5, 9], [9, 13], [13, 17]
    ];

    ctx.save();
    ctx.lineCap = 'round';

    // Batch all bone lines into a single path for high-performance rendering (2 draw calls vs 42)
    ctx.beginPath();
    for (const [fromIdx, toIdx] of connections) {
      const from = transformLandmarkToViewport(landmarks[fromIdx], viewport, true);
      const to = transformLandmarkToViewport(landmarks[toIdx], viewport, true);
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    }

    // Pass 1: Outer soft cyan glow
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.28)';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Pass 2: Core luminous bone
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Glowing Joints & Finger Point Trackers
    const tipIndices = [4, 8, 12, 16, 20];
    for (let i = 0; i < landmarks.length; i++) {
      const pt = transformLandmarkToViewport(landmarks[i], viewport, true);
      const isIndexTip = i === 8;
      const isOtherTip = tipIndices.includes(i) && !isIndexTip;

      // Draw Joint Dot
      ctx.beginPath();
      const radius = isIndexTip ? 6.5 : (isOtherTip ? 4.5 : 3.5);
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isIndexTip ? '#fbbf24' : '#38bdf8';
      ctx.fill();

      // High-performance concentric rings on fingertips
      if (isIndexTip) {
        // Outer soft glow ring
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Inner crisp ring
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isOtherTip) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawLaserRay(ray: LaserRay, hit: RayHitResult | null, blasterInfo?: BlasterOverlayInfo) {
    const ctx = this.ctx;
    const { origin, direction } = ray;
    const theme = getBlasterTheme(blasterInfo?.type);

    // Determine ray length
    let endX = origin.x + direction.x * 2000;
    let endY = origin.y + direction.y * 2000;

    if (hit) {
      endX = hit.point.x;
      endY = hit.point.y;
      this.spawnImpactParticles(endX, endY, theme.primary);
    }

    // Spawn symbol particles floating along the laser ray
    if (Math.random() < 0.3 && theme.symbol) {
      const t = Math.random() * 0.85 + 0.1;
      const px = origin.x + (endX - origin.x) * t;
      const py = origin.y + (endY - origin.y) * t;
      this.spawnParticle(
        px,
        py,
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.8 - 0.8,
        0.85,
        theme.primary,
        theme.symbol,
        16
      );
    }

    ctx.save();
    ctx.lineCap = 'round';

    // 1. Ray Pass 1: Wide diffuse glow (zero shadowBlur!)
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = theme.glowAlpha;
    ctx.lineWidth = 14;
    ctx.stroke();

    // 1. Ray Pass 2: Intense mid-glow
    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // 1. Ray Pass 3: Brilliant razor core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Fingertip emitter: layered concentric circles
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 14, 0, Math.PI * 2);
    ctx.fillStyle = theme.glowAlpha;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = theme.primary;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 3. Hit impact burst: layered halo and core
    if (hit) {
      ctx.beginPath();
      ctx.arc(endX, endY, 16, 0, Math.PI * 2);
      ctx.fillStyle = theme.glowAlpha;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(endX, endY, 9, 0, Math.PI * 2);
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(endX, endY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    ctx.restore();

    // Draw carried operand badge moving down the laser line!
    if (blasterInfo?.carriedOperandText) {
      let badgeX = origin.x;
      let badgeY = origin.y;
      const isTargeting = hit && (
        hit.targetId === 'term-rhs-mode-c' ||
        hit.targetId.startsWith('scale-pan-') ||
        hit.targetId.startsWith('blast-target-') ||
        hit.targetId.startsWith('equation-side-') ||
        hit.targetId.startsWith('inverse-choice-')
      );
      if (isTargeting) {
        const progress = Math.min(1, Math.max(0, blasterInfo.dwellProgress || 0));
        badgeX = origin.x + (endX - origin.x) * progress;
        badgeY = origin.y + (endY - origin.y) * progress;
      }
      if (blasterInfo.carriedOperandFormat === 'division') {
        this.drawCarriedDivisionBadge(badgeX, badgeY, blasterInfo.carriedOperandText, theme.primary);
      } else {
        this.drawCarriedOperandBadge(badgeX, badgeY, blasterInfo.carriedOperandText, theme.primary);
      }
    }
  }

  private drawCarriedDivisionBadge(x: number, y: number, denominator: string, color: string) {
    const ctx = this.ctx;
    ctx.save();

    // Outer soft halo
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main bubble
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Division bar
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 5);
    ctx.lineTo(x + 12, y - 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 17px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(denominator, x, y + 8);
    ctx.restore();
  }

  private drawCarriedOperandBadge(x: number, y: number, text: string, color: string) {
    const ctx = this.ctx;
    ctx.save();

    // Outer soft halo
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Main bubble
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // Inner text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
    ctx.restore();
  }

  private drawTether(from: { x: number; y: number }, to: { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    text?: string,
    size?: number
  ) {
    const p = this.particlePool.find(item => !item.active) || this.particlePool[0];
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.color = color;
    p.text = text;
    p.size = size;
  }

  private spawnImpactParticles(x: number, y: number, customColor?: string) {
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      this.spawnParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        1.0,
        customColor || (Math.random() > 0.5 ? '#38bdf8' : '#fbbf24')
      );
    }
  }

  private updateAndDrawParticles() {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.045;

      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;

      if (p.text) {
        ctx.font = `bold ${p.size || 16}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.life * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawDebugTargets(
    targets: InteractiveTarget[],
    hit: RayHitResult | null
  ) {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (const t of targets) {
      const isHit = hit && hit.targetId === t.id;
      ctx.strokeStyle = isHit ? '#10b981' : 'rgba(255, 255, 255, 0.3)';
      ctx.fillStyle = isHit ? 'rgba(16, 185, 129, 0.15)' : 'transparent';
      ctx.strokeRect(t.rect.left, t.rect.top, t.rect.width, t.rect.height);
      ctx.fillRect(t.rect.left, t.rect.top, t.rect.width, t.rect.height);

      ctx.fillStyle = isHit ? '#10b981' : '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText(`${t.id} (${t.type})`, t.rect.left + 4, t.rect.top + 12);
    }
    ctx.restore();
  }
}
