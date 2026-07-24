import React from "react";
import * as JSXRuntime from "react/jsx-runtime";

export async function boot() {
  const unlistenEarlyErrorListeners = (() => {
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

  try {
    // TODO: show boot progress
    // TODO: verify no toplevel side effects and do toplevel import
    const { eventlog, EventUrgency } = await import("./eventlog.ts");
    await import("./sdk.ts");
    const { mountVendorFs } = await import("./vendorfs.ts");
    await mountVendorFs();
    const { loadPackages } = await import("./loader/loader.ts");
    const { toast, Urgency } = await import("./toast.tsx");

    Object.assign(window as any, {
      __React: React,
      __ReactJsxRuntime: JSXRuntime,
    });

    window.addEventListener("error", (e) => {
      try {
        eventlog.add("Errors", "Uncaught error", EventUrgency.Error, "Error: " + String(e.error));
        toast({ title: "Error", desc: String(e.error), urgency: Urgency.Error });
      } catch {
        alert(String(e.error));
      }
    });

    window.addEventListener("unhandledrejection", (e) => {
      try {
        eventlog.add("Errors", "Unhandled rejection", EventUrgency.Error, "Reason: " + String(e.reason));
        toast({ title: "Unhandled rejection", desc: String(e.reason), urgency: Urgency.Error });
      } catch {
        alert(String(e.reason));
      }
    });

    loadPackages();
  } catch (e) {
    unlistenEarlyErrorListeners();
    throw e;
  }

  unlistenEarlyErrorListeners();
}
