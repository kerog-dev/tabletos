import { useState } from "react";
import init, { Numbat, FormatType } from "../assets/numbat/numbat_wasm.js";

await init();
const numbat = Numbat.new(true, true, FormatType.Html);

export default function NumbatApp() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isError, setIsError] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      evaluate();
      setHistory((h) => [...h, input]);
      setHistoryIndex(-1);
      setDraft("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex === -1) setDraft(input);
      const next =
        historyIndex === -1
          ? history.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInput(history[next] ?? input);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInput(draft);
      } else {
        setHistoryIndex(next);
        setInput(history[next]);
      }
    }
  }

  function evaluate() {
    const result = numbat.interpret(input);
    setOutput(result.output);
    setIsError(result.is_error);
  }

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="e.g. ℏ * omega -> eV"
      />
      <button onClick={evaluate}>Run</button>
      <div
        style={{ color: isError ? "red" : "inherit" }}
        dangerouslySetInnerHTML={{ __html: output }}
      />
    </div>
  );
}
