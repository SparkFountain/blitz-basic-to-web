import { Ident } from "./ast";
import { TokKind, type Token } from "./lexer";

// ===== AST Types =====
export type Suffix = "int" | "float" | "string" | null;
export interface Src {
  line: number;
  col: number;
}

export interface Program {
  kind: "Program";
  body: Stmt[];
}
export type Stmt =
  | VarDecl
  | DimDecl
  | Assign
  | IfStmt
  | WhileStmt
  | RepeatStmt
  | ForStmt
  | SelectStmt
  | FuncDecl
  | ReturnStmt
  | ExprStmt;

export interface VarDecl {
  kind: "VarDecl";
  scope: "global" | "local" | "const";
  id: Ident;
  init?: Expr;
  src: Src;
}
export interface DimDecl {
  kind: "DimDecl";
  id: Ident;
  size: Expr;
  src: Src;
}
export interface Assign {
  kind: "Assign";
  target: LValue;
  value: Expr;
  src: Src;
}
export interface IfStmt {
  kind: "IfStmt";
  branches: { test: Expr; cons: Stmt[] }[];
  alt?: Stmt[];
  src: Src;
}
export interface WhileStmt {
  kind: "WhileStmt";
  test: Expr;
  body: Stmt[];
  src: Src;
}
export interface RepeatStmt {
  kind: "RepeatStmt";
  body: Stmt[];
  until: Expr;
  src: Src;
}
export interface ForStmt {
  kind: "ForStmt";
  id: Ident;
  init: Expr;
  to: Expr;
  step?: Expr;
  body: Stmt[];
  src: Src;
}
export interface SelectStmt {
  kind: "SelectStmt";
  expr: Expr;
  cases: { tests: Expr[]; body: Stmt[] }[];
  default?: Stmt[];
  src: Src;
}
export interface FuncDecl {
  kind: "FuncDecl";
  id: Ident;
  params: Ident[];
  body: Stmt[];
  src: Src;
}
export interface ReturnStmt {
  kind: "ReturnStmt";
  value?: Expr;
  src: Src;
}
export interface ExprStmt {
  kind: "ExprStmt";
  expr: Expr;
  src: Src;
}

export type LValue = VarRef | CallExpr;

export type Expr = Binary | Unary | CallExpr | Literal | VarRef | Grouping;
export interface Binary {
  kind: "Binary";
  op: string;
  left: Expr;
  right: Expr;
  src: Src;
}
export interface Unary {
  kind: "Unary";
  op: string;
  arg: Expr;
  src: Src;
}
export interface CallExpr {
  kind: "CallExpr";
  callee: VarRef;
  args: Expr[];
  src: Src;
}
export interface VarRef {
  kind: "VarRef";
  name: string;
  suffix: Suffix;
  src: Src;
}
export interface Literal {
  kind: "Literal";
  value: number | string | boolean | null;
  suffix: Suffix;
  src: Src;
}
export interface Grouping {
  kind: "Grouping";
  expr: Expr;
  src: Src;
}

// ===== Parser Core =====
class Cursor {
  constructor(public toks: Token[], public i = 0) {}
  cur() {
    return this.toks[this.i];
  }
  eat() {
    return this.toks[this.i++];
  }
  expect(kind: TokKind, val?: string) {
    const t = this.eat();
    if (t.kind !== kind || (val && t.upper !== val.toUpperCase())) {
      throw new Error(
        `Expecting ${TokKind[kind]} '${val ?? ""}' at ${t.line}:${t.col}`
      );
    }
    return t;
  }
}

const PREC = {
  OR: 1,
  AND: 2,
  EQ: 3,
  CMP: 4,
  ADD: 5,
  MUL: 6,
  POW: 7,
  UN: 8,
  CALL: 9,
} as const;

export function parseProgram(toks: Token[]): Program {
  const c = new Cursor(toks);
  const body: Stmt[] = [];
  while (c.cur().kind !== TokKind.EOF) {
    if (c.cur().kind === TokKind.EOL) {
      c.eat();
      continue;
    }
    body.push(parseStatement(c));
    while (
      c.cur().kind === TokKind.EOL ||
      (c.cur().kind === TokKind.Op && c.cur().upper === ":")
    )
      c.eat();
  }
  return { kind: "Program", body };
}

function parseExpr(c: Cursor, minPrec: number): Expr {
  let left = parseUnary(c);
  while (true) {
    const t = c.cur();
    if (t.kind === TokKind.Op && t.upper === "^") {
      const prec = PREC.POW;
      if (prec < minPrec) break;
      c.eat();
      const right = parseExpr(c, PREC.POW);
      left = {
        kind: "Binary",
        op: "^",
        left,
        right,
        src: { line: t.line, col: t.col },
      };
      continue;
    }
    const opPrec = binPrec(t);
    if (opPrec && opPrec >= minPrec) {
      const op = t.upper;
      c.eat();
      const right = parseExpr(c, opPrec + 1);
      left = {
        kind: "Binary",
        op,
        left,
        right,
        src: { line: t.line, col: t.col },
      };
      continue;
    }
    if (t.kind === TokKind.Op && t.upper === "(") {
      c.eat();
      const args: Expr[] = [];
      if (!(c.cur().kind === TokKind.Op && c.cur().upper === ")")) {
        do {
          args.push(parseExpr(c, 0));
        } while (
          c.cur().kind === TokKind.Op &&
          c.cur().upper === "," &&
          c.eat()
        );
      }
      c.expect(TokKind.Op, ")");
      left = {
        kind: "CallExpr",
        callee: asVarRef(left),
        args,
        src: srcOf(left),
      };
      continue;
    }
    break;
  }
  return left;
}

function parseUnary(c: Cursor): Expr {
  const t = c.cur();
  if (t.kind === TokKind.Op && t.upper === "-") {
    c.eat();
    const arg = parseUnary(c);
    return { kind: "Unary", op: "-", arg, src: { line: t.line, col: t.col } };
  }
  if (t.kind === TokKind.Keyword && t.upper === "NOT") {
    c.eat();
    const arg = parseUnary(c);
    return { kind: "Unary", op: "NOT", arg, src: { line: t.line, col: t.col } };
  }
  return parsePrimary(c);
}

function parsePrimary(c: Cursor): Expr {
  const t = c.eat();
  if (t.kind === TokKind.Number)
    return {
      kind: "Literal",
      value: Number(t.lexeme),
      suffix: null,
      src: { line: t.line, col: t.col },
    };
  if (t.kind === TokKind.String)
    return {
      kind: "Literal",
      value: t.lexeme,
      suffix: "string",
      src: { line: t.line, col: t.col },
    };
  if (t.kind === TokKind.Ident) {
    let suffix: Suffix = null;
    if (c.cur().kind === TokKind.Op && /^[%#$]$/.test(c.cur().lexeme)) {
      suffix =
        c.cur().lexeme === "%"
          ? "int"
          : c.cur().lexeme === "#"
          ? "float"
          : "string";
      c.eat();
    }
    return {
      kind: "VarRef",
      name: t.lexeme,
      suffix,
      src: { line: t.line, col: t.col },
    };
  }
  if (t.kind === TokKind.Op && t.upper === "(") {
    const e = parseExpr(c, 0);
    c.expect(TokKind.Op, ")");
    return { kind: "Grouping", expr: e, src: { line: t.line, col: t.col } };
  }
  throw new Error(`Unexpected token ${TokKind[t.kind]} at ${t.line}:${t.col}`);
}

function binPrec(t: Token): number | undefined {
  if (t.kind === TokKind.Keyword) {
    if (t.upper === "OR") return PREC.OR;
    if (t.upper === "AND") return PREC.AND;
    if (t.upper === "MOD") return PREC.MUL;
  }
  if (t.kind === TokKind.Op) {
    switch (t.upper) {
      case "=":
      case "<>":
        return PREC.EQ;
      case "<":
      case ">":
      case "<=":
      case ">=":
        return PREC.CMP;
      case "+":
      case "-":
        return PREC.ADD;
      case "*":
      case "/":
        return PREC.MUL;
    }
  }
  return undefined;
}

function asVarRef(e: Expr): VarRef {
  if (e.kind !== "VarRef") throw new Error("Call target must be VarRef");
  return e;
}

function exprToLValue(e: Expr): LValue {
  if (e.kind === "VarRef" || e.kind === "CallExpr") return e as any;
  throw new Error("Left value expected");
}

function srcOf(e: Expr): Src {
  return (e as any).src ?? { line: 0, col: 0 };
}

function parseVarDecl(c: Cursor): VarDecl {
  const scopeTok = c.eat(); // GLOBAL | LOCAL | CONST
  const scope = scopeTok.upper.toLowerCase() as "global" | "local" | "const";
  const id = readIdent(c);
  let init: Expr | undefined;
  if (c.cur().kind === TokKind.Op && c.cur().upper === "=") {
    c.eat();
    init = parseExpr(c, 0);
  }
  return {
    kind: "VarDecl",
    scope,
    id,
    init,
    src: { line: scopeTok.line, col: scopeTok.col },
  };
}

function parseDim(c: Cursor): DimDecl {
  const dimTok = c.eat(); // DIM
  const id = readIdent(c);
  c.expect(TokKind.Op, "(");
  const size = parseExpr(c, 0);
  c.expect(TokKind.Op, ")");
  return {
    kind: "DimDecl",
    id,
    size,
    src: { line: dimTok.line, col: dimTok.col },
  };
}

// IF parser supporting both single-line and block forms
function parseIf(c: Cursor): IfStmt {
  const ifTok = c.eat(); // IF
  const test = parseExpr(c, 0);
  c.expect(TokKind.Keyword, "THEN");

  // Single-line IF? -> next token starts a statement and must end at EOL/":"/EOF
  if (!isSepOrEOF(c.cur())) {
    // then-part (single statement)
    const thenStmt = parseSingleLineStmt(c);

    // optionally: ELSE <single statement>
    let alt: Stmt[] | undefined;
    if (
      !isSepOrEOF(c.cur()) &&
      c.cur().kind === TokKind.Keyword &&
      c.cur().upper === "ELSE"
    ) {
      c.eat(); // ELSE
      if (isSepOrEOF(c.cur())) {
        alt = []; // empty else on same line
      } else {
        const elseStmt = parseSingleLineStmt(c);
        alt = [elseStmt];
      }
    }

    // Caller (program/block) will eat separators; we just build the node
    return {
      kind: "IfStmt",
      branches: [{ test, cons: [thenStmt] }],
      alt,
      src: { line: ifTok.line, col: ifTok.col },
    };
  }

  // Block form: THEN is followed by a separator; parse until ELSEIF/ELSE/END
  // eat any separators before the block content
  while (isSep(c.cur())) c.eat();

  const branches: { test: Expr; cons: Stmt[] }[] = [];
  // then-block
  const thenBody = parseBlockUntil(
    c,
    (t) =>
      (t.kind === TokKind.Keyword &&
        (t.upper === "ELSEIF" || t.upper === "ELSE" || t.upper === "END")) ||
      t.kind === TokKind.EOF
  );
  branches.push({ test, cons: thenBody });

  // zero or more ELSEIF blocks
  while (c.cur().kind === TokKind.Keyword && c.cur().upper === "ELSEIF") {
    c.eat(); // ELSEIF
    const t2 = parseExpr(c, 0);
    c.expect(TokKind.Keyword, "THEN");
    while (isSep(c.cur())) c.eat();
    const cons = parseBlockUntil(
      c,
      (t) =>
        (t.kind === TokKind.Keyword &&
          (t.upper === "ELSEIF" || t.upper === "ELSE" || t.upper === "END")) ||
        t.kind === TokKind.EOF
    );
    branches.push({ test: t2, cons });
  }

  // optional ELSE block
  let altBlock: Stmt[] | undefined;
  if (c.cur().kind === TokKind.Keyword && c.cur().upper === "ELSE") {
    c.eat();
    while (isSep(c.cur())) c.eat();
    altBlock = parseBlockUntil(
      c,
      (t) =>
        (t.kind === TokKind.Keyword && t.upper === "END") ||
        t.kind === TokKind.EOF
    );
  }

  // END [IF] — tolerate EOF to avoid hard crash on incomplete files
  if (c.cur().kind === TokKind.Keyword && c.cur().upper === "END") {
    c.eat();
    if (c.cur().kind === TokKind.Keyword && c.cur().upper === "IF") c.eat();
  } else if (c.cur().kind !== TokKind.EOF) {
    // If it's not EOF and not END, it's a syntax error
    throw new Error(`Expected END (IF) at ${c.cur().line}:${c.cur().col}`);
  }

  return {
    kind: "IfStmt",
    branches,
    alt: altBlock,
    src: { line: ifTok.line, col: ifTok.col },
  };
}

function parseWhile(c: Cursor): WhileStmt {
  const wTok = c.eat(); // WHILE
  const test = parseExpr(c, 0);
  eatSeps(c);
  const body = parseBlockUntil(
    c,
    (t) => t.kind === TokKind.Keyword && t.upper === "WEND"
  );
  c.expect(TokKind.Keyword, "WEND");
  return {
    kind: "WhileStmt",
    test,
    body,
    src: { line: wTok.line, col: wTok.col },
  };
}

function parseRepeat(c: Cursor): RepeatStmt {
  const rTok = c.eat(); // REPEAT
  eatSeps(c);
  const body = parseBlockUntil(
    c,
    (t) => t.kind === TokKind.Keyword && t.upper === "UNTIL"
  );
  c.expect(TokKind.Keyword, "UNTIL");
  const until = parseExpr(c, 0);
  return {
    kind: "RepeatStmt",
    body,
    until,
    src: { line: rTok.line, col: rTok.col },
  };
}

function parseFor(c: Cursor): ForStmt {
  const fTok = c.eat(); // FOR
  const id = readIdent(c);
  c.expect(TokKind.Op, "=");
  const init = parseExpr(c, 0);
  c.expect(TokKind.Keyword, "TO");
  const to = parseExpr(c, 0);
  let step: Expr | undefined;
  if (c.cur().kind === TokKind.Keyword && c.cur().upper === "STEP") {
    c.eat();
    step = parseExpr(c, 0);
  }
  eatSeps(c);
  const body = parseBlockUntil(
    c,
    (t) => t.kind === TokKind.Keyword && t.upper === "NEXT"
  );
  c.expect(TokKind.Keyword, "NEXT");
  if (c.cur().kind === TokKind.Ident) c.eat();
  return {
    kind: "ForStmt",
    id,
    init,
    to,
    step,
    body,
    src: { line: fTok.line, col: fTok.col },
  };
}

function parseSelect(c: Cursor): SelectStmt {
  const sTok = c.eat(); // SELECT
  const expr = parseExpr(c, 0);
  eatSeps(c);

  const cases: { tests: Expr[]; body: Stmt[] }[] = [];
  let defBody: Stmt[] | undefined;

  while (!(c.cur().kind === TokKind.Keyword && c.cur().upper === "END")) {
    const kw = c.cur();
    if (kw.kind === TokKind.Keyword && kw.upper === "CASE") {
      c.eat();
      const tests: Expr[] = [parseExpr(c, 0)];
      while (c.cur().kind === TokKind.Op && c.cur().upper === ",") {
        c.eat();
        tests.push(parseExpr(c, 0));
      }
      eatSeps(c);
      const body = parseBlockUntil(
        c,
        (t) =>
          t.kind === TokKind.Keyword &&
          (t.upper === "CASE" || t.upper === "DEFAULT" || t.upper === "END")
      );
      cases.push({ tests, body });
      continue;
    }
    if (kw.kind === TokKind.Keyword && kw.upper === "DEFAULT") {
      c.eat();
      eatSeps(c);
      defBody = parseBlockUntil(
        c,
        (t) => t.kind === TokKind.Keyword && t.upper === "END"
      );
      continue;
    }
    throw new Error(
      `SELECT: unexpected token ${TokKind[kw.kind]} at ${kw.line}:${kw.col}`
    );
  }

  c.expect(TokKind.Keyword, "END");
  c.expect(TokKind.Keyword, "SELECT");

  return {
    kind: "SelectStmt",
    expr,
    cases,
    default: defBody,
    src: { line: sTok.line, col: sTok.col },
  };
}

function parseFunc(c: Cursor): FuncDecl {
  const fTok = c.eat(); // FUNCTION
  const id = readIdent(c);
  c.expect(TokKind.Op, "(");
  const params: Ident[] = [];
  if (!(c.cur().kind === TokKind.Op && c.cur().upper === ")")) {
    do {
      params.push(readIdent(c));
    } while (c.cur().kind === TokKind.Op && c.cur().upper === "," && c.eat());
  }
  c.expect(TokKind.Op, ")");
  eatSeps(c);
  const body = parseBlockUntil(
    c,
    (t) => t.kind === TokKind.Keyword && t.upper === "END"
  );
  c.expect(TokKind.Keyword, "END");
  c.expect(TokKind.Keyword, "FUNCTION");
  return {
    kind: "FuncDecl",
    id,
    params,
    body,
    src: { line: fTok.line, col: fTok.col },
  };
}

function parseReturn(c: Cursor): ReturnStmt {
  const rTok = c.eat(); // RETURN
  if (isSep(c.cur()))
    return {
      kind: "ReturnStmt",
      src: { line: rTok.line, col: rTok.col },
    } as any;
  const value = parseExpr(c, 0);
  return { kind: "ReturnStmt", value, src: { line: rTok.line, col: rTok.col } };
}

// === Helpers for statement separators & ident parsing ===

// Helper: detect statement separators
// Treat EOL, ":" and EOF as statement separators in certain contexts
function isSep(t: Token) {
  return t.kind === TokKind.EOL || (t.kind === TokKind.Op && t.upper === ":");
}
function isSepOrEOF(t: Token) {
  return isSep(t) || t.kind === TokKind.EOF;
}

// Parse a single statement that must end at EOL, ":" or EOF (for one-line IF parts)
function parseSingleLineStmt(c: Cursor): Stmt {
  const s = parseStatement(c);
  // Do not consume separators here; the caller decides
  return s;
}

// Helper: can an argument start here? (for bare call arglist)
function beginsExprToken(t: Token): boolean {
  if (t.kind === TokKind.Number || t.kind === TokKind.String) return true;
  if (t.kind === TokKind.Ident) return true;
  if (t.kind === TokKind.Op && (t.upper === "(" || t.upper === "-"))
    return true;
  if (t.kind === TokKind.Keyword && t.upper === "NOT") return true;
  return false;
}

function parseStatement(c: Cursor): Stmt {
  const t = c.cur();

  // Bare-call or assignment starting with identifier
  if (t.kind === TokKind.Ident) {
    // Lookahead to distinguish assignment vs. call
    const idTok = c.eat();
    // Optional type suffix directly after the ident (already lexed as Op)
    let suffix: Suffix = null;
    if (c.cur().kind === TokKind.Op && /^[%#$]$/.test(c.cur().lexeme)) {
      suffix =
        c.cur().lexeme === "%"
          ? "int"
          : c.cur().lexeme === "#"
          ? "float"
          : "string";
      c.eat();
    }
    const vref: VarRef = {
      kind: "VarRef",
      name: idTok.lexeme,
      suffix,
      src: { line: idTok.line, col: idTok.col },
    };

    // Assignment: ident (=) expr
    if (c.cur().kind === TokKind.Op && c.cur().upper === "=") {
      c.eat();
      const value = parseExpr(c, 0);
      return {
        kind: "Assign",
        target: vref,
        value,
        src: { line: idTok.line, col: idTok.col },
      };
    }

    // Bare call: ident [arg {, arg}*]
    const args: Expr[] = [];
    if (beginsExprToken(c.cur())) {
      args.push(parseExpr(c, 0));
      while (c.cur().kind === TokKind.Op && c.cur().upper === ",") {
        c.eat();
        args.push(parseExpr(c, 0));
      }
    }
    // Zero-arg bare call also valid: e.g. "Cls" or "Flip"
    const call: CallExpr = {
      kind: "CallExpr",
      callee: vref,
      args,
      src: { line: idTok.line, col: idTok.col },
    };
    return {
      kind: "ExprStmt",
      expr: call,
      src: { line: idTok.line, col: idTok.col },
    };
  }

  // Existing keyword-driven statements (IF/WHILE/…)
  if (t.kind === TokKind.Keyword) {
    switch (t.upper) {
      case "GLOBAL":
      case "LOCAL":
      case "CONST":
        return parseVarDecl(c);
      case "DIM":
        return parseDim(c);
      case "IF":
        return parseIf(c);
      case "WHILE":
        return parseWhile(c);
      case "REPEAT":
        return parseRepeat(c);
      case "FOR":
        return parseFor(c);
      case "SELECT":
        return parseSelect(c);
      case "FUNCTION":
        return parseFunc(c);
      case "RETURN":
        return parseReturn(c);
    }
  }

  // Fallback: expression statement (includes calls with parentheses)
  const expr = parseExpr(c, 0);
  if (c.cur().kind === TokKind.Op && c.cur().upper === "=") {
    const target = exprToLValue(expr);
    c.eat();
    const value = parseExpr(c, 0);
    return { kind: "Assign", target, value, src: srcOf(expr) };
  }
  return { kind: "ExprStmt", expr, src: srcOf(expr) };
}

function eatSeps(c: Cursor) {
  while (isSep(c.cur())) c.eat();
}

function readIdent(c: Cursor): VarRef {
  const t = c.expect(TokKind.Ident);
  let suffix: Suffix = null;
  if (c.cur().kind === TokKind.Op && /^[%#$]$/.test(c.cur().lexeme)) {
    suffix =
      c.cur().lexeme === "%"
        ? "int"
        : c.cur().lexeme === "#"
        ? "float"
        : "string";
    c.eat();
  }
  return {
    kind: "VarRef",
    name: t.lexeme,
    suffix,
    src: { line: t.line, col: t.col },
  };
}

function parseBlockUntil(c: Cursor, stop: (t: Token) => boolean): Stmt[] {
  const body: Stmt[] = [];
  while (isSep(c.cur())) c.eat();
  while (!stop(c.cur())) {
    if (c.cur().kind === TokKind.EOF) break; // allow EOF as block end
    body.push(parseStatement(c));
    while (isSep(c.cur())) c.eat();
  }
  return body;
}
