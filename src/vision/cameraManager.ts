export class CameraManager {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isRunning: boolean = false;
  private startupToken: number = 0;

  constructor() {
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public isStreamActive(): boolean {
    return this.isRunning && !!this.stream && this.stream.active;
  }

  public async startCamera(videoElement: HTMLVideoElement): Promise<{ success: boolean; error?: string }> {
    this.stopCamera();
    this.videoElement = videoElement;
    this.startupToken++;
    const currentToken = this.startupToken;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { success: false, error: 'Camera API not supported in this browser. You can still play with Mouse & Keyboard!' };
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn('Ideal camera constraints failed, attempting fallback:', e);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      // Guard against race conditions if stopped during request
      if (currentToken !== this.startupToken) {
        stream.getTracks().forEach(t => t.stop());
        return { success: false, error: 'Camera start cancelled' };
      }

      this.stream = stream;
      videoElement.srcObject = stream;
      videoElement.muted = true;
      videoElement.autoplay = true;
      videoElement.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          videoElement.removeEventListener('loadedmetadata', onLoaded);
          videoElement.removeEventListener('error', onError);
          resolve();
        };
        const onError = (e: Event) => {
          videoElement.removeEventListener('loadedmetadata', onLoaded);
          videoElement.removeEventListener('error', onError);
          reject(e);
        };

        if (videoElement.readyState >= HTMLMediaElement.HAVE_METADATA) {
          resolve();
        } else {
          videoElement.addEventListener('loadedmetadata', onLoaded);
          videoElement.addEventListener('error', onError);
        }
      });

      await videoElement.play();
      this.isRunning = true;
      return { success: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { 
        success: false, 
        error: `Camera access failed: ${errorMsg}. Mouse & Keyboard mode is available!` 
      };
    }
  }

  public stopCamera() {
    this.startupToken++;
    this.isRunning = false;
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      // Tab hidden - interaction paused by game controller
    }
  }

  public dispose() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.stopCamera();
    this.videoElement = null;
  }
}
