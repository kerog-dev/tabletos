import { useRef } from "react";
import SimpleKeyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";

export default function Keyboard() {
  const keyboardRef = useRef<ReturnType<typeof SimpleKeyboard> | null>(null);

  const toggleShift = () => {
    if (!keyboardRef.current) return;
    const current = keyboardRef.current.options.layoutName;
    keyboardRef.current.setOptions({
      layoutName: current === "default" ? "shift" : "default",
    });
  };
  const onKeyPress = (b: string) => {
    console.log(b);
    if (b === "{shift}" || b === "{lock}") toggleShift();
    const target = document.activeElement ?? document.body;

    console.log(target);

    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: b,
        bubbles: true,
      }),
    );

    target.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: b,
        bubbles: true,
      }),
    );

    if ((target as any).value !== undefined) {
      const i = target as HTMLInputElement;
      if (b.startsWith("{") && b.endsWith("}")) {
        console.log(b.slice(1, -1));
        switch (b.slice(1, -1)) {
          case "bksp":
            i.value = i.value.slice(0, -1);
            break;
        }
      } else i.value += b;
    }
  };

  return (
    <div>
      <SimpleKeyboard
        keyboardRef={r => keyboardRef.current = r}
        onKeyPress={onKeyPress}
        autoUseTouchEvents={true}
        preventMouseDownDefault={true}
        preventMouseUpDefault={true}
      />
    </div>
  );
}
