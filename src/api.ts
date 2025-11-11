import { lex } from "./core/lexer";
import { parseProgram } from "./core/parser";
import { emit } from "./core/emitter";

export type { Program } from "./core/parser";

export function transpile(src: string, target: "ts" | "js" = "ts") {
  const toks = lex(src);
  const ast = parseProgram(toks);
  return emit(ast, { target });
}

export { lex, parseProgram as parse, emit };
