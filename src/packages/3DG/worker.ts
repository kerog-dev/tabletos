import { compile } from "mathjs";

const polarCache: Partial<Record<string, [number, number]>> = {};

const getPolar = (x: number, y: number): [number, number] => {
  const k = `${x},${y}`;
  if (polarCache[k]) return polarCache[k];
  const A = Math.atan2(y, x);
  const r = Math.sqrt((x ** 2) + (y ** 2));
  polarCache[k] = [A, r];
  return [A, r];
};

addEventListener("message", e => {
  const size: number = e.data[0];
  const equation: string = e.data[1];
  const compiled = compile(equation);

  const arr = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const [A, r] = getPolar(x, y);
      const result = compiled.evaluate({ x, y, A, r });
      arr.push([x, y, result]);
    }
  }

  postMessage(arr);
});
