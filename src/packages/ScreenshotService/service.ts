import html2canvas from "html2canvas";
import type { Service } from "../../packages.ts";

export interface ScreenshotService {
  screenshot(quality?: number): Promise<Blob>;
}

const service: Service = {
  info: { name: "Screenshot Service", autostart: true },
  start() {
    async function screenshot(quality = 0.92) {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: -window.scrollY, // capture from top of page
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("canvas.toBlob produced null"));
          },
          "image/jpeg",
          quality,
        );
      });
    }

    const exposed: ScreenshotService = {
      screenshot,
    };

    return {
      exposed,
      stop() {
      },
    };
  },
};

export default service;
