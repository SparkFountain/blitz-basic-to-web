import { Program } from "../api";
import { Stmt, VarRef, LValue, Expr, CallExpr } from "./ast";

export interface EmitOpts {
  target: "ts" | "js";
}

export function emit(p: Program, opts: EmitOpts = { target: "ts" }): string {
  const out: string[] = [];
  out.push(`// generiert\n`);
  out.push(`import { rt } from './bb_runtime';\n\n`);
  out.push(`(function(){\n`);
  out.push(` const env:any = Object.create(null);\n`);
  for (const s of p.body) emitStmt(s);
  out.push(`})();\n`);
  return out.join("");

  function w(s: string) {
    out.push(s);
  }

  function emitBlock(body: Stmt[]) {
    for (const s of body) emitStmt(s);
  }

  function id(v: VarRef) {
    return `env[${JSON.stringify(mangle(v))}]`;
  }
  function mangle(v: VarRef) {
    // Typesuffix in Namen einkodieren
    const suf = v.suffix
      ? v.suffix === "int"
        ? "%"
        : v.suffix === "float"
        ? "#"
        : "$"
      : "";
    return v.name + suf;
  }

  function emitStmt(s: Stmt) {
    switch (s.kind) {
      case "VarDecl":
        w(`// ${s.scope} ${mangle(s.id as any)}\n`);
        if (s.init) w(`${id(s.id as any)}=${emitExpr(s.init)};\n`);
        else w(`${id(s.id as any)}=undefined;\n`);
        break;
      case "DimDecl":
        w(`${id(s.id as any)}=new Array(${emitExpr(s.size)}).fill(0);\n`);
        break;
      case "Assign":
        w(`${emitLValue(s.target)}=${emitExpr(s.value)};\n`);
        break;
      case "IfStmt": {
        let first = true;
        for (const br of s.branches) {
          w(`${first ? "if" : "else if"}(${emitExpr(br.test)}){\n`);
          emitBlock(br.cons);
          w(`}\n`);
          first = false;
        }
        if (s.alt) {
          w(`else{\n`);
          emitBlock(s.alt);
          w(`}\n`);
        }
        break;
      }
      case "WhileStmt":
        w(`while(${emitExpr(s.test)}){\n`);
        emitBlock(s.body);
        w(`}\n`);
        break;
      case "RepeatStmt":
        w(`do{\n`);
        emitBlock(s.body);
        w(`}while(!(${emitExpr(s.until)}));\n`);
        break;
      case "ForStmt": {
        const v = s.id as any;
        const name = id(v);
        const init = emitExpr(s.init),
          to = emitExpr(s.to),
          step = s.step ? emitExpr(s.step) : "1";
        w(
          `for(${name}=${init}; (${
            Number(step) >= 0 ? `${name}<=${to}` : `${name}>=${to}`
          }); ${name}+=(${step})){\n`
        );
        emitBlock(s.body);
        w(`}\n`);
        break;
      }
      case "SelectStmt": {
        const tmp = `_tmp${Math.random().toString(36).slice(2, 6)}`;
        w(`const ${tmp}=${emitExpr(s.expr)};\n`);
        let opened = false;
        s.cases.forEach((c, i) => {
          w(
            `${i === 0 ? "if" : "else if"}([${c.tests
              .map((t) => emitExpr(t))
              .join(",")}].includes(${tmp})){\n`
          );
          emitBlock(c.body);
          w(`}\n`);
        });
        if (s.default) {
          w(`else{\n`);
          emitBlock(s.default);
          w(`}\n`);
        }
        break;
      }
      case "FuncDecl": {
        const name = mangle(s.id as any);
        w(
          `function ${name}(${(s.params as any[])
            .map((p) => mangle(p))
            .join(",")}){\n`
        );
        emitBlock(s.body);
        w(`}\n`);
        break;
      }
      case "ReturnStmt":
        w(`return ${s.value ? emitExpr(s.value) : ""};\n`);
        break;
      case "ExprStmt":
        w(`${emitExpr(s.expr)};\n`);
        break;
    }
  }

  function emitLValue(l: LValue): string {
    if (l.kind === "VarRef") return id(l);
    if (l.kind === "CallExpr") {
      // a(i) = v → env["a%"][i]
      const base = id(l.callee);
      const idxs = l.args.map((a) => emitExpr(a)).join(",");
      return `${base}[${idxs}]`;
    }
    throw new Error("unsupported LValue");
  }

  function emitExpr(e: Expr): string {
    switch (e.kind) {
      case "Literal":
        return typeof e.value === "string"
          ? JSON.stringify(e.value)
          : String(e.value);
      case "VarRef":
        return id(e);
      case "Grouping":
        return `(${emitExpr(e.expr)})`;
      case "Unary":
        return e.op === "NOT"
          ? `!(${emitExpr(e.arg)})`
          : `-(${emitExpr(e.arg)})`;
      case "Binary":
        return mapBin(e.op, emitExpr(e.left), emitExpr(e.right));
      case "CallExpr":
        return emitCall(e);
    }
  }

  function emitCall(ca: CallExpr): string {
    const name = ca.callee.name.toUpperCase();
    // eingebaute Befehle
    switch (name) {
      case "GRAPHICS":
        return `rt.Graphics(${ca.args.map(emitExpr).join(",")})`;
      case "CLS":
        return `rt.Cls()`;
      case "COLOR":
        return `rt.Color(${ca.args.map(emitExpr).join(",")})`;
      case "PLOT":
        return `rt.Plot(${ca.args.map(emitExpr).join(",")})`;
      case "LINE":
        return `rt.Line(${ca.args.map(emitExpr).join(",")})`;
      case "RECT":
        return `rt.Rect(${ca.args.map(emitExpr).join(",")})`;
      case "OVAL":
        return `rt.Oval(${ca.args.map(emitExpr).join(",")})`;
      case "TEXT":
        return `rt.Text(${ca.args.map(emitExpr).join(",")})`;
      case "FLIP":
        return `rt.Flip()`;
      case "MILLISECS":
        return `rt.MilliSecs()`;
      case "KEYDOWN":
        return `rt.KeyDown(${ca.args.map(emitExpr).join(",")})`;
      case "MOUSEX":
        return `rt.MouseX()`;
      case "MOUSEY":
        return `rt.MouseY()`;
      case "RND":
        return `rt.Rnd(${ca.args.map(emitExpr).join(",")})`;
      case "SEEDRND":
        return `rt.SeedRnd(${ca.args.map(emitExpr).join(",")})`;
      default: {
        // Nutzerfunktion
        return `${ca.callee.name}(${ca.args.map(emitExpr).join(",")})`;
      }
    }
  }

  function mapBin(op: string, a: string, b: string): string {
    switch (op) {
      case "=":
        return `(${a})===(${b})`;
      case "<>":
        return `(${a})!==(${b})`;
      case "AND":
        return `(${a})&&(${b})`;
      case "OR":
        return `(${a})||(${b})`;
      case "MOD":
        return `(${a})%(${b})`;
      case "^":
        return `Math.pow((${a}),(${b}))`;
      default:
        return `(${a})${op}(${b})`;
    }
  }
}
