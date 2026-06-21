import type { Sdk } from "../../sdk";

export interface RpcObject {
  run(script: string): string;
}

const { conn }: Sdk = (window as any).$;

const object: RpcObject = {
  run(script) {
    let result: string;
    try {
      result = String(window.eval(script));
    } catch (e) {
      result = "Error: " + String(e);
    }
    return result;
  },
};
conn.exposeObject(object, "jsserver");

export default function JSServer() {
  return (
    <div>
      <span>you are: {conn.name}</span>
    </div>
  );
}
