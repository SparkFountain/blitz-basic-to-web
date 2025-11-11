export enum TokKind {
  Ident,
  Number,
  String,
  Keyword,
  Op,
  EOL,
  EOF,
}
export interface Token {
  kind: TokKind;
  lexeme: string;
  upper: string;
  line: number;
  col: number;
}

// Keep only control-flow / declaration keywords here.
// Runtime commands like GRAPHICS/CLS/... must NOT be here.
const keywords = new Set([
  "GLOBAL",
  "LOCAL",
  "CONST",
  "DIM",
  "IF",
  "THEN",
  "ELSE",
  "ELSEIF",
  "ENDIF",
  "WHILE",
  "WEND",
  "REPEAT",
  "UNTIL",
  "FOR",
  "TO",
  "STEP",
  "NEXT",
  "SELECT",
  "CASE",
  "DEFAULT",
  "END",
  "FUNCTION",
  "RETURN",
  "NOT",
  "AND",
  "OR",
  "MOD",
]);

export function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0,
    line = 1,
    col = 1;
  const push = (kind: TokKind, lexeme: string) =>
    tokens.push({ kind, lexeme, upper: lexeme.toUpperCase(), line, col });

  const peek = () => source[i] ?? "\0";
  const next = () => {
    const ch = source[i++] ?? "\0";
    if (ch === "\n") {
      line++;
      col = 1;
    } else col++;
    return ch;
  };
  const match = (re: RegExp) => {
    const m = re.exec(source.slice(i));
    if (m && m.index === 0) {
      i += m[0].length;
      col += m[0].length;
      return m[0];
    }
    return null;
  };

  while (i < source.length) {
    // Blockkommentar
    if (source.slice(i).toUpperCase().startsWith("REM")) {
      const startCol = col;
      i += 3;
      col += 3;
      // bis "End Rem"
      const idx = source.slice(i).toUpperCase().indexOf("END REM");
      if (idx >= 0) {
        i += idx + 7;
        col += idx + 7;
        continue;
      } else break; // bis Dateiende
    }

    const ch = peek();
    if (ch === "'") {
      while (peek() !== "\n" && peek() !== "\0") next();
      continue;
    }
    if (/[ \t\r]/.test(ch)) {
      next();
      continue;
    }

    if (ch === "\n") {
      next();
      push(TokKind.EOL, "\n");
      continue;
    }

    // String
    if (ch === '"') {
      next();
      let s = "";
      let esc = false;
      let c;
      while ((c = next()) !== "\0") {
        if (esc) {
          s += c;
          esc = false;
        } else if (c === "\\") esc = true;
        else if (c === '"') break;
        else s += c;
      }
      push(TokKind.String, s);
      continue;
    }

    // Zahl
    const num = match(/^(?:\d+\.\d*|\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      push(TokKind.Number, num);
      continue;
    }

    // Identifier + optionaler Typesuffix
    const id = match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (id) {
      // Typesuffix beibehalten, aber als separates Op-Token behandeln (Parsen übernimmt Suffixbindung)
      if (keywords.has(id.toUpperCase())) push(TokKind.Keyword, id);
      else push(TokKind.Ident, id);
      // Suffix direkt anhängen, falls vorhanden
      const suf = match(/^[%#$]/);
      if (suf) push(TokKind.Op, suf);
      continue;
    }

    // Operator/Sonderzeichen
    const op = match(/^(<>|<=|>=|\^|:=|[+\-*/=(),:\[\]<>])/);
    if (op) {
      push(TokKind.Op, op);
      continue;
    }

    throw new Error(`Unerwartetes Zeichen '${ch}' bei ${line}:${col}`);
  }

  push(TokKind.EOF, "");
  return tokens;
}
