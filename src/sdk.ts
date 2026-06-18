import { toast, Urgency } from "./toast.tsx";

interface Sdk {
  toast: typeof toast;
  Urgency: typeof Urgency;
}

const sdk: Sdk = {
  toast,
  Urgency,
};

(window as any).$ = sdk;

export { type Sdk };
