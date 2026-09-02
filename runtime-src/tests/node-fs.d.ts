// tsconfig.runtime.json sets `types: []` on purpose — it typechecks the runtime
// as DOM-only code, so ambient Node types must not be in scope for
// runtime-src/<entry>/. tests/common/no-bare-strings.test.ts is a lint-style
// guard that reads the entry sources as text, so it needs exactly one Node API.
// Declaring just that keeps the DOM-only guard intact instead of pulling all of
// @types/node into the runtime programme.
declare module "node:fs" {
  export function readFileSync(path: URL | string, encoding: "utf8"): string;
}
