import WindowManager from "./components/wm/WindowManager.tsx";
import { Toasts } from "./toast.tsx";

function Main() {
  return (
    <>
      <Toasts />
      <WindowManager />
    </>
  );
}

export default Main;
