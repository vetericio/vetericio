import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const file = fs.readFileSync("src/lib/serial-write-queue.ts", "utf8");
const output = ts.transpileModule(file, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { SerialWriteQueue } = await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));

const queue = new SerialWriteQueue();
let active = 0, maxActive = 0, amount = 10;
const attempts = [3, 5, 2, 7, 1, 4];
const results = await Promise.all(attempts.map((value) => queue.run(async () => {
  active++;
  maxActive = Math.max(active, maxActive);
  const old = amount;
  await new Promise((resolve) => setTimeout(resolve, 3));
  amount = old - value;
  active--;
  return amount;
})));
assert.equal(maxActive, 1);
assert.equal(amount, 10 - attempts.reduce((a,b)=>a+b,0));
assert.equal(results.at(-1), amount);

// A failed operation must never poison the queue.
await assert.rejects(queue.run(async () => { throw new Error("Drive indisponível"); }), /Drive indisponível/);
assert.equal(await queue.run(async () => 42), 42);
console.log("Serial coordinator: one writer at a time, safe failure release OK");
