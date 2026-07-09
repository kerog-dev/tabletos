export function dragger(element: HTMLElement, canDrag: () => boolean) {
  const handlers: Record<"start" | "stop" | "move", ((...args: any) => void)[]> = {
    start: [],
    stop: [],
    move: [],
  };
  let lastTouch: Touch | null = null;
  let dragging = false;

  const touchStartListener = (e: Event) => {
    if (e.target !== element) return;
    if (!canDrag()) return;
    dragging = true;
    handlers.start.forEach(l => l());
  };
  const touchEndListener = () => {
    lastTouch = null;
    dragging = false;
    handlers.stop.forEach(l => l());
  };
  const touchMoveListener = (e: TouchEvent) => {
    if (!dragging || !canDrag()) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (lastTouch) {
      const movementX = touch.clientX - lastTouch.clientX;
      const movementY = touch.clientY - lastTouch.clientY;
      handlers.move.forEach(l => l([movementX, movementY]));
    }
    lastTouch = touch;
  };

  const downListener = (e: MouseEvent) => {
    if (e.target !== element) return;
    if (dragging || !canDrag()) return;
    e.preventDefault();
    dragging = true;
    handlers.start.forEach(l => l());
  };
  const upListener = () => {
    dragging = false;
    handlers.stop.forEach(l => l());
  };
  const moveListener = (e: MouseEvent) => {
    if (!dragging || !canDrag()) return;
    handlers.move.forEach(l => l([e.movementX, e.movementY]));
  };

  const pairs = [
    [
      element,
      "mousedown",
      downListener,
    ],
    [
      document.body,
      "mouseup",
      upListener,
    ],
    [
      document.body,
      "mousemove",
      moveListener,
    ],
    [element, "touchstart", touchStartListener],
    [document.body, "touchend", touchEndListener],
    [document.body, "touchmove", touchMoveListener],
  ] as const;
  pairs.forEach(([target, evName, listener]) => {
    target.addEventListener(evName, listener as EventListener);
  });
  return {
    destroy: () =>
      pairs.forEach(([target, evName, listener]) => {
        target.removeEventListener(evName, listener as EventListener);
      }),
    onStart(listener: () => void) {
      handlers.start.push(listener);
    },
    onStop(listener: () => void) {
      handlers.stop.push(listener);
    },
    onMove(listener: (change: [number, number]) => void) {
      handlers.move.push(listener);
    },
  };
}
