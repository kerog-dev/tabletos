window.addEventListener("error", e => {
  if (e.error instanceof Error) {
    alert(`Error: ${e.error.name}: ${e.error.message}\n${e.error.stack ?? "No stack"}`);
  } else {
    alert(`Error: ${e.error}`);
  }
});
window.addEventListener("unhandledrejection", e => {
  alert(`Promise rejection: ${e.reason}`);
});

Object.assign(window as any, {
  $ready: new Promise(res => (window as any).$resolve = res),
});
