const unlisten = (() => {
  const errorListener = (e: ErrorEvent) => {
    if (e.error instanceof Error) {
      alert(`Error: ${e.error.name}: ${e.error.message}\n${e.error.stack ?? "No stack"}`);
    } else {
      alert(`Error: ${e.error}`);
    }
  };
  const unhandledRejectionListener = (e: PromiseRejectionEvent) => {
    alert(`Promise rejection: ${e.reason}`);
  };

  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", unhandledRejectionListener);

  return () => {
    window.removeEventListener("error", errorListener);
    window.removeEventListener("unhandledrejection", unhandledRejectionListener);
  };
})();

Object.assign(window as any, {
  $ready: new Promise(res => (window as any).$resolve = res),
});

export { unlisten };
