import storage from "./storage.ts";
import { toast, Urgency } from "./toast.tsx";

interface Sdk {
  toast: typeof toast;
  Urgency: typeof Urgency;
  storage: typeof storage;
}

const sdk: Sdk = {
  toast,
  Urgency,
  storage,
};

(window as any).$ = sdk;

export { type Sdk };
