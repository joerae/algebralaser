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

export class CanvasOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public handsOnly: boolean = false;
  public showDebug: boolean = false;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    text?: string;
    size?: number;
  }> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  public resize() {
    const dpr = window.devicePixelRatio || 1;
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
    // Luminous Bones
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;

    for (const [fromIdx, toIdx] of connections) {
      const from = transformLandmarkToViewport(landmarks[fromIdx], viewport, true);
      const to = transformLandmarkToViewport(landmarks[toIdx], viewport, true);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    // Glowing Joints & Finger Point Trackers
    const tipIndices = [4, 8, 12, 16, 20];
    for (let i = 0; i < landmarks.length; i++) {
      const pt = transformLandmarkToViewport(landmarks[i], viewport, true);
      const isIndexTip = i === 8;
      const isOtherTip = tipIndices.includes(i) && !isIndexTip;

      // Draw Joint Dot
      ctx.beginPath();
      const radius = isIndexTip ? 6.5 : (isOtherTip ? 5 : 4);
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isIndexTip ? '#fbbf24' : '#38bdf8';
      ctx.shadowColor = isIndexTip ? '#f59e0b' : '#06b6d4';
      ctx.shadowBlur = isIndexTip ? 20 : 10;
      ctx.fill();

      // Outer rings on fingertips
      if (isIndexTip) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;
        ctx.stroke();
      } else if (isOtherTip) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
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
      this.particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 1.8,
        vy: (Math.random() - 0.5) * 1.8 - 0.8,
        life: 0.85,
        color: theme.primary,
        text: theme.symbol,
        size: 16
      });
    }

    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = theme.glowAlpha;
    ctx.lineWidth = 9;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner bright core
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = theme.primary;
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Fingertip emitter ring
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = theme.primary;
    ctx.shadowColor = theme.glow;
    ctx.shadowBlur = 22;
    ctx.fill();

    // Hit impact burst
    if (hit) {
      ctx.beginPath();
      ctx.arc(endX, endY, 14, 0, Math.PI * 2);
      ctx.fillStyle = theme.glowAlpha;
      ctx.strokeStyle = theme.primary;
      ctx.lineWidth = 2;
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.stroke();
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
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x - 12, y - 5);
    ctx.lineTo(x + 12, y - 5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 8;
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
    // Glowing outer bubble
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
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
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  private spawnImpactParticles(x: number, y: number, customColor?: string) {
    if (Math.random() < 0.4) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: customColor || (Math.random() > 0.5 ? '#38bdf8' : '#fbbf24')
      });
    }
  }

  private updateAndDrawParticles() {
    const ctx = this.ctx;
    ctx.save();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.045;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
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
