Object.assign(window as any, {
  $ready: new Promise(res => (window as any).$resolve = res),
});
