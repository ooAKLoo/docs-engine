// Test-server-only instrumentation: no counters or Profiler ship in the package.
export const boardProfilerPlugin = {
  name: 'board-test-profiler',
  enforce: 'pre',
  transform(source, id) {
    if (!id.endsWith('/src/components/Board.tsx')) return;
    return source.replace("import {memo,", "import {Profiler, memo,").replace(
      'const BoardCanvas = memo(RawBoardCanvas);',
      `const BoardCanvas = memo(function ProfiledBoardCanvas(props: React.ComponentProps<typeof RawBoardCanvas>) {
        return <Profiler id="canvas" onRender={() => {
          (window as any).__boardMetrics.canvasCommits++;
        }}><RawBoardCanvas {...props} /></Profiler>;
      });`,
    );
  },
};

export async function installBoardMetrics(page) {
  await page.addInitScript(() => {
    window.__boardMetrics = {commits: 0, canvasCommits: 0};
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      inject: () => 1,
      onCommitFiberRoot: () => { window.__boardMetrics.commits++; },
      onCommitFiberUnmount: () => {},
    };
  });
}

export async function measurePinch(page, canvasSelector, stageSelector) {
  return page.evaluate(async ({canvasSelector, stageSelector}) => {
    const canvas = document.querySelector(canvasSelector);
    const stage = document.querySelector(stageSelector);
    const rect = canvas.getBoundingClientRect();
    const initialScale = new DOMMatrixReadOnly(getComputedStyle(stage).transform).a;
    window.__boardMetrics.commits = 0;
    window.__boardMetrics.canvasCommits = 0;
    const intervals = [];
    let previous;
    let running = true;
    const sample = (now) => {
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      if (running) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    // Timed input is independent of rAF, just like a hardware wheel stream.
    for (let i = 0; i < 60; i++) {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, ctrlKey: true, deltaY: -2,
        clientX: rect.left + rect.width * 0.6,
        clientY: rect.top + rect.height * 0.4,
      }));
      if (i < 59) await new Promise((resolve) => setTimeout(resolve, 16));
    }
    await new Promise(requestAnimationFrame);
    running = false;
    const result = {
      frames: intervals.length,
      meanFrameMs: intervals.reduce((a, b) => a + b, 0) / intervals.length,
      maxFrameMs: Math.max(...intervals),
      ...window.__boardMetrics,
      initialScale,
      nextFrameScale: new DOMMatrixReadOnly(getComputedStyle(stage).transform).a,
    };
    await new Promise((resolve) => setTimeout(resolve, 600));
    return {...result, settledScale: new DOMMatrixReadOnly(getComputedStyle(stage).transform).a,
      commitsIncludingSettle: window.__boardMetrics.commits,
      canvasCommitsIncludingSettle: window.__boardMetrics.canvasCommits};
  }, {canvasSelector, stageSelector});
}
