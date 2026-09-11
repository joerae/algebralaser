const pages = await fetch('http://127.0.0.1:9334/json').then((response) => response.json());
const page = pages.find((entry) => entry.type === 'page');
if (!page) throw new Error('No page target');

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let id = 1;
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  message.error ? request.reject(message.error) : request.resolve(message.result);
});
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const send = (method, params = {}) => {
  const requestId = id++;
  socket.send(JSON.stringify({ id: requestId, method, params }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
};

const viewportWidth = Number(process.argv[2] ?? 390);
const viewportHeight = Number(process.argv[3] ?? 844);
await send('Emulation.setDeviceMetricsOverride', {
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1,
  mobile: viewportWidth <= 768,
  screenWidth: viewportWidth,
  screenHeight: viewportHeight,
});
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:3000/?story=true' });
await new Promise((resolve) => setTimeout(resolve, 3600));

const measure = `(() => {
  const rect = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
  };
  return {
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    story: rect('.story-presentation-panel'),
    camera: rect('.camera-box'),
    feed: rect('.camera-feed-container'),
    panel: rect('.story-choices-column:not([style*="display: none"]), .forge-panel:not([style*="display: none"]), #answers-column:not([style*="display: none"])'),
    cards: [...document.querySelectorAll('.story-equation-card, .forge-card, .answer-card')]
      .filter((element) => element.offsetParent !== null)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      }),
    footer: rect('.hud-footer'),
    overflowX: document.documentElement.scrollWidth > innerWidth,
    overflowY: document.documentElement.scrollHeight > innerHeight,
  };
})()`;

let result = await send('Runtime.evaluate', { expression: measure, returnByValue: true });
console.log('SPLIT ' + JSON.stringify(result.result.value, null, 2));

result = await send('Runtime.evaluate', { expression: `(() => {
  const app = document.querySelector('#app');
  const story = document.querySelector('#story-area');
  const equation = document.querySelector('#equation-area');
  app.dataset.phase = 'solved';
  app.dataset.storyPhase = 'completed';
  app.dataset.portraitPanel = 'false';
  story.innerHTML = '';
  equation.style.display = 'flex';
  equation.innerHTML = '<div class="solved-panel"><div class="equation-history-container"><div class="history-line" data-depth="1">Y + 3 = 8</div></div><div class="equation-rail"><div class="solved-line-wrap"><span>Y</span><span class="math-symbol">=</span><span class="math-symbol">5 gold</span><span class="solved-check">✓</span></div></div><div class="solved-actions"><button class="icon-btn">Replay</button><button class="action-btn-primary">Next Puzzle →</button></div><div class="open-palm-advance-badge"><span>👋</span><span class="palm-text">Aim laser at Next Puzzle → or show Open Palm 👋 to continue</span></div></div>';
  const get = (selector) => {
    const box = document.querySelector(selector).getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height };
  };
  return { header: get('.hud-header'), stage: get('.stage-container'), equation: get('.equation-area'), solved: get('.solved-panel'), camera: get('.camera-box'), footer: get('.hud-footer') };
})()`, returnByValue: true });
console.log('SOLVED ' + JSON.stringify(result.result.value, null, 2));
socket.close();
