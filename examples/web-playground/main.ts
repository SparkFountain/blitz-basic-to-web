import { transpile, runtime } from "../../src";

const el = document.getElementById("app")!;
el.innerHTML = `<textarea id="src" style="width:48%;height:300px">Graphics 320,240
Color 255,255,255
Text 10,20,\"Hallo Blitz→Web!\"
Flip</textarea>
<pre id="out" style="width:48%;height:300px;float:right;border:1px solid #ccc;overflow:auto"></pre>
<button id="run">Transpile & Run</button>`;

const src = document.getElementById("src") as HTMLTextAreaElement;
const out = document.getElementById("out") as HTMLPreElement;

document.getElementById("run")!.addEventListener("click", () => {
  try {
    const code = transpile(src.value, "js");
    out.textContent = code;
    // Laufzeit bereitstellen
    (window as any).rt = runtime.rt;
    // Execute in IIFE
    new Function(code)();
  } catch (e: any) {
    out.textContent = String(e.stack || e);
  }
});
