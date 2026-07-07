import type { Service } from "../../packages.ts";
import * as ai from "./ai.ts";

export type AISdk = typeof ai;

const service: Service = {
  info: {
    name: "AI SDK Service",
    autostart: true,
  },
  start() {
    return {
      exposed: ai,
      stop() {
      },
    };
  },
};

export default service;
