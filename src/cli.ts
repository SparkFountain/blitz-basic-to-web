#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { transpile } from "./api";

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  const rest: string[] = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      args[k] = v ?? true;
    } else rest.push(a);
  }
  return { args, rest } as const;
}

function main() {
  const { args, rest } = parseArgs(process.argv);
  if (rest.length === 0 || args["help"]) {
    console.log(`Usage: bb2web <sourcefile.bb> [--format=typescript|javascript] [--out=out.ts]
`);
    process.exit(rest.length === 0 ? 1 : 0);
  }
  const infile = rest[0];
  const format = (args["format"] as string) ?? "typescript";
  const target = format === "javascript" ? "js" : "ts";
  const out =
    (args["out"] as string) ??
    basename(infile).replace(/\.[^.]+$/, "") +
      (target === "ts" ? ".ts" : ".js");

  const src = readFileSync(infile, "utf8");
  const code = transpile(src, target as any);
  writeFileSync(out, code, "utf8");
  console.log(`Wrote ${out}`);
}

main();
