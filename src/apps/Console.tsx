import { useRef, useState } from "react";

export default function Console() {
  const [output, setOutput] = useState("Enter JS and see it's output here:\n");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const clicked = () => {
    if (!inputRef.current) return;
    setOutput(output + window.eval(inputRef.current.value ?? "") + "\n");
    inputRef.current.value = "";
  };

  return (
    <div>
      <pre>{output}</pre>
      <input
        type="text"
        ref={inputRef}
        onKeyUp={e => {
          if (e.code === "Enter") clicked();
        }}
      />
      <button
        onClick={clicked}
      >
        Run
      </button>
    </div>
  );
}
