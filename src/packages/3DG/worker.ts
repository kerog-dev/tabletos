import { parse } from "mathjs";
import { sleep } from "../../utils.ts";

const polarCache: Partial<Record<string, [number, number]>> = {};

const getPolar = (x: number, y: number): [number, number] => {
  const k = `${x},${y}`;
  if (polarCache[k]) return polarCache[k];
  const A = Math.atan2(y, x);
  const r = Math.sqrt((x ** 2) + (y ** 2));
  polarCache[k] = [A, r];
  return [A, r];
};

const MATH_SYMBOLS = new Set(["sin", "cos", "tan", "sqrt", "abs", "log", "log2", "log10", "pi", "e"]);

function compileEquation(equation: string): (scope: Record<string, number>) => number {
  const node = parse(equation); // throws on invalid syntax

  const vars: string[] = [];
  node.traverse((n: any) => {
    if (n.type === "SymbolNode" && !MATH_SYMBOLS.has(n.name) && !vars.includes(n.name)) {
      vars.push(n.name);
    }
  });

  const js = node.toString()
    .replace(/\^/g, "**")
    .replace(/\b(sin|cos|tan|sqrt|abs|log|log2|log10)\b/g, "Math.$1");

  const fn = new Function(...vars, `return ${js}`);

  return (scope: Record<string, number>) => fn(...vars.map(v => scope[v]));
}

addEventListener("message", async e => {
  postMessage(undefined);
  const size: number = e.data[0];
  const equation: string = e.data[1];
  const compiled = compileEquation(equation);

  for (let t = 1; t <= 100; t += 0.2) {
    const arr = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        try {
          const [A, r] = getPolar(x, y);
          const result = compiled({ x, y, A, r, t });
          arr.push(result);
        } catch {
          arr.push(0xff0000);
        }
      }
    }
    postMessage(arr);
  }
});
