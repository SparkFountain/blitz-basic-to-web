import { transpile } from "../src";

const bb = `
Graphics 100,100
Local x% = 1
If x% = 1 Then x% = x% + 1`;
const js = transpile(bb, "js");
console.assert(js.includes("rt.Graphics(100,100)"), "Graphics call missing");
