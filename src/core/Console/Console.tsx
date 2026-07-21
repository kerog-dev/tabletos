import { Fragment, type JSX, useEffect, useRef, useState } from "react";
import styles from "./Console.module.css";

function PromiseTracker({ promise }: { promise: Promise<any> }) {
  const [status, setStatus] = useState(`ongoing`);

  useEffect(() => {
    promise.then(value => setStatus(`resolved: ${value}`)).catch(reason => setStatus(`rejected: ${reason}`));
  }, [promise]);

  return <span>promise: {status}</span>;
}

function Evaluated({ script }: { script: string }): JSX.Element {
  const [result, setResult] = useState<JSX.Element | null>(null);

  useEffect(() => {
    try {
      const result = window.eval(script);
      if (result instanceof Promise) {
        setResult(<PromiseTracker promise={result} />);
      } else {
        setResult(<span>{String(result)}</span>);
      }
    } catch (e) {
      setResult(<span style={{ color: "red" }}>{String(e)}</span>);
    }
  }, [script]);

  return <>{result}</>;
}

export default function Console() {
  const [outputs, setOutputs] = useState<JSX.Element[]>(() => [<span>Enter JS and see it's output here:</span>]);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);

  const clicked = () => {
    if (!inputRef.current || !outputRef.current) return;
    const script = inputRef.current?.value ?? "'Nothing entered.'";
    setOutputs(outputs => [...outputs, <Evaluated script={script} />]);
    setTimeout(() => outputRef.current!.scrollTop = outputRef.current!.scrollHeight, 100);
    inputRef.current.value = "";
  };

  return (
    <div className={styles.console}>
      <div className={styles.output} ref={outputRef}>
        {outputs.map((o, i) => (
          <Fragment key={i}>
            {o}
            <br />
          </Fragment>
        ))}
      </div>
      <div className={styles.controls}>
        <textarea
          className={styles.input}
          ref={inputRef}
          onKeyDown={e => {
            if (e.code === "Enter" && e.ctrlKey) clicked();
          }}
        />
        <button
          className={styles.run}
          onClick={clicked}
        >
          Run
        </button>
      </div>
    </div>
  );
}
