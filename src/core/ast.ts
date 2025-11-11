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

export interface Ident {
  kind: "VarRef"; // or alternatively: 'Ident' – depending on consistency in AST
  name: string; // Identifier name without type suffix
  suffix: Suffix; // 'int' | 'float' | 'string' | null
  src: Src; // Source position (line, column)
}

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

export type LValue = VarRef | CallExpr; // Blitz erlaubt z.B. a(i) = ...

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
