# Magic Finger Algebra ⚡

An interactive browser-based algebra game where players manipulate linear equations using a laser beam projected from their onscreen index finger via webcam hand tracking, with comprehensive mouse, touch, and keyboard support.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended, tested on Node v22.19)
- Modern web browser (Chrome, Edge, Safari, Firefox) with WebGL and Web Audio support

### Development Server
```bash
npm install
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Run Automated Tests
```bash
npm test
```
Runs Vitest unit tests covering the pure math state machine, equation transitions, guided solver constraints, distractor arithmetic generation, orientation-invariant pose classification, and ray casting math.

### Production Build
```bash
npm run build
npm run preview
```

---

## 🎮 How to Play

### 1. The Core Loop
1. **Pick Up**: Aim your finger laser at an interactive algebraic term (e.g. `−1` or `3`) or click/drag it.
2. **Carry Across**: Aim across the equals (`=`) sign towards the highlighted destination slot.
   - For constant terms: carries to the right of the constant (e.g. `[ + 1 ]`).
   - For coefficient terms: carries beneath the right side into the denominator of a real fraction.
3. **Curl to Drop**: Curl your index finger over the destination (or release the mouse button).
4. **Choose an Answer**: Three cards appear on the right. Point your laser at the card and hold (~450ms dwell confirmation ring) or click it.
5. **Simplify & Verify**: Watch the equation simplify. Complete the equation to see the balanced verification check ($11 = 11$).

### 2. Multi-Modal Controls & Accessibility
- **Laser Finger Tracking (Camera)**:
  - Mirrored webcam with a luminous holographic hand skeleton.
  - Directional laser ray emerging from the index fingertip.
  - Direction-invariant pointing: works upward, downward, sideways, or diagonally.
  - Curl detection with tracking loss protection (losing tracking or open palms will NEVER drop a tile).
  - Dwell confirmation timer on answer cards to prevent misclicks during sweeping.
- **Mouse & Touch**:
  - Drag terms directly to destination zones and release to drop.
  - Click or tap answer cards to submit immediately.
- **Keyboard**:
  - `Enter` or `Space`: Pick up term / Drop term / Next puzzle.
  - `1`, `2`, `3`: Select answer cards.
  - `Escape`: Cancel current carry.
  - `U`: Undo previous move.
  - `H`: Display hint for current step.

---

## 📐 Mathematical Model & Content Progression

- **Guided Solver**: Teaches valid balance transformations (applying inverse operations to both sides). If a player attempts coefficient division while a constant is present ($3x - 1 = 11$), the system gently guides: *"First undo the −1."*
- **Visual Fractions**: When dividing by a coefficient, the equation displays as a real vertical fraction with numerator, fraction bar, and denominator ($\frac{12}{3}$).
- **Cancellation Animations**: Shows balance steps ($3x - 1 + 1 = 11 + 1$) before evaluating arithmetic.
- **Progression**:
  1. Warm-up: $x + 1 = 3$
  2. Benchmark: $3x - 1 = 11$
  3. Additional levels generated from the 5 linear equation families:
     - $x + b = c$
     - $x - b = c$
     - $ax = c$
     - $ax + b = c$
     - $ax - b = c$
- **Balance Verification**: Final check substituting $x$ back into the original problem ($3 \times 4 - 1 = 11 \rightarrow 11 = 11$).

---

## 🤖 MediaPipe & Machine Learning Assets

- **Hand Landmarker**: Powered by `@mediapipe/tasks-vision` with `HandLandmarker`.
- **Offline / Self-Hosted**:
  - Model file: Bundled in `public/models/hand_landmarker.task` (Google MediaPipe float16).
  - WASM files: Bundled in `public/wasm/` (`vision_wasm_internal.wasm`, `vision_wasm_nosimd_internal.wasm`).
  - Automatic fallback to CDN if local files cannot be loaded.
- **Privacy**: All computer vision runs 100% locally in client WebAssembly/WebGL. Zero camera frames or trajectories are recorded or transmitted over the network.
