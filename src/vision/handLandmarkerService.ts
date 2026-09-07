import { 
  FilesetResolver, 
  HandLandmarker, 
  HandLandmarkerResult 
} from '@mediapipe/tasks-vision';
import { LandmarkPoint, HandLandmarks } from './types';

export class HandLandmarkerService {
  private landmarker: HandLandmarker | null = null;
  private isInitializing: boolean = false;
  private isDetecting: boolean = false;
  private lastTimestamp: number = -1;
  private initToken: number = 0;

  // Performance telemetry
  public inferenceDuration: number = 0;
  public inferenceFps: number = 0;
  private frameCount: number = 0;
  private lastFpsCalcTime: number = performance.now();

  public async initialize(): Promise<{ success: boolean; error?: string }> {
    if (this.landmarker) return { success: true };
    if (this.isInitializing) return { success: false, error: 'Initialization in progress' };

    this.isInitializing = true;
    this.initToken++;
    const currentToken = this.initToken;

    try {
      // 1. Resolve WASM assets (try local first, fallback to CDN)
      let visionWasm;
      try {
        visionWasm = await FilesetResolver.forVisionTasks('/wasm');
      } catch {
        visionWasm = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
      }

      if (currentToken !== this.initToken) {
        return { success: false, error: 'Cancelled' };
      }

      // 2. Try loading model with robust fallbacks: Local GPU -> Local CPU -> CDN GPU -> CDN CPU
      const localModel = '/models/hand_landmarker.task';
      const cdnModel = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      const createOptions = (modelAssetPath: string, delegate: 'GPU' | 'CPU') => ({
        baseOptions: {
          modelAssetPath,
          delegate
        },
        runningMode: 'VIDEO' as const,
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      try {
        this.landmarker = await HandLandmarker.createFromOptions(visionWasm, createOptions(localModel, 'GPU'));
      } catch (e1) {
        console.warn('Local GPU model load failed, trying local CPU:', e1);
        try {
          this.landmarker = await HandLandmarker.createFromOptions(visionWasm, createOptions(localModel, 'CPU'));
        } catch (e2) {
          console.warn('Local CPU model load failed, trying CDN GPU:', e2);
          try {
            this.landmarker = await HandLandmarker.createFromOptions(visionWasm, createOptions(cdnModel, 'GPU'));
          } catch (e3) {
            console.warn('CDN GPU model load failed, trying CDN CPU:', e3);
            this.landmarker = await HandLandmarker.createFromOptions(visionWasm, createOptions(cdnModel, 'CPU'));
          }
        }
      }

      this.isInitializing = false;
      return { success: true };
    } catch (err: unknown) {
      this.isInitializing = false;
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to load Hand Landmarker: ${msg}` };
    }
  }

  public detect(video: HTMLVideoElement, timestamp: number): HandLandmarks[] | null {
    if (!this.landmarker || this.isDetecting) {
      return null; // Drop frame if landmarker not ready or prior detection in flight
    }

    // Monotonic timestamp requirement for detectForVideo
    const validTimestamp = timestamp > this.lastTimestamp ? timestamp : this.lastTimestamp + 1;
    this.lastTimestamp = validTimestamp;

    this.isDetecting = true;
    const startTime = performance.now();

    try {
      const result: HandLandmarkerResult = this.landmarker.detectForVideo(video, validTimestamp);
      const duration = performance.now() - startTime;
      this.inferenceDuration = duration;

      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsCalcTime >= 1000) {
        this.inferenceFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsCalcTime));
        this.frameCount = 0;
        this.lastFpsCalcTime = now;
      }

      const hands: HandLandmarks[] = [];
      if (result.landmarks && result.landmarks.length > 0) {
        for (let i = 0; i < result.landmarks.length; i++) {
          const rawLandmarks = result.landmarks[i];
          const handednessCategory = result.handedness?.[i]?.[0];
          const handedness = (handednessCategory?.categoryName === 'Left' ? 'Left' : 'Right');
          const score = handednessCategory?.score ?? 0.8;

          const points: LandmarkPoint[] = rawLandmarks.map(p => ({
            x: p.x,
            y: p.y,
            z: p.z
          }));

          hands.push({
            landmarks: points,
            handedness,
            score
          });
        }
      }

      this.isDetecting = false;
      return hands;
    } catch (err) {
      this.isDetecting = false;
      console.warn('Error during hand detection:', err);
      return null;
    }
  }

  public dispose() {
    this.initToken++;
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.isInitializing = false;
    this.isDetecting = false;
  }
}
