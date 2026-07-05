import type { Sdk } from "./sdk.ts";

export function sdk(): Sdk {
  return (window as any).$;
}
