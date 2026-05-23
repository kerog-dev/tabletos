import storage, { useStorage } from "../storage.ts";

storage.counter ??= {};
storage.counter.value ??= 0;

export default function Counter() {
  const [value, setValue] = useStorage("counter.value", 0);
  return (
    <>
      {value}
      <button onClick={() => setValue(value + 1)}>increment</button>
    </>
  );
}
