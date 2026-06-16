import { parser } from "mathjs";
import { useRef, useState } from "react";
import { toast, Urgency } from "../toast.tsx";

export default function Calculator() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");
  const curParser = useRef(parser());

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      evaluate();
      setHistory((h) => [...h, input]);
      setHistoryIndex(-1);
      setDraft("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex === -1) setDraft(input);
      const next = historyIndex === -1
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
    try {
      const result = curParser.current.evaluate(input);
      setOutput(String(result));
    } catch (e) {
      toast({
        title: "Calculator Error",
        desc: (e as any).message,
        urgency: Urgency.Error,
      });
      setOutput("");
    }
  }

  return (
    <div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="e.g. 18 months to year"
      />
      <button onClick={evaluate}>Run</button>
      <div>{output}</div>
    </div>
  );
}
