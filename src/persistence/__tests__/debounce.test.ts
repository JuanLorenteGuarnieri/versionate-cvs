import test from "node:test";
import assert from "node:assert/strict";
import { debounce } from "../debounce.js";

test("call() no ejecuta fn inmediatamente, solo tras delayMs sin nuevas llamadas", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const d = debounce(() => {
    calls++;
  }, 500);

  d.call();
  assert.equal(calls, 0);
  t.mock.timers.tick(499);
  assert.equal(calls, 0);
  t.mock.timers.tick(1);
  assert.equal(calls, 1);
});

test("llamadas repetidas reinician el temporizador: solo se ejecuta una vez con los últimos args", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const received: number[] = [];
  const d = debounce((n: number) => {
    received.push(n);
  }, 500);

  d.call(1);
  t.mock.timers.tick(300);
  d.call(2);
  t.mock.timers.tick(300);
  d.call(3);
  t.mock.timers.tick(500);

  assert.deepEqual(received, [3]);
});

test("flush() ejecuta inmediatamente si había una llamada pendiente", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const d = debounce(() => {
    calls++;
  }, 500);
  d.call();
  d.flush();
  assert.equal(calls, 1);
  t.mock.timers.tick(500);
  assert.equal(calls, 1, "no debe volver a ejecutarse cuando llegue el timer original");
});

test("flush() no hace nada si no había ninguna llamada pendiente", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const d = debounce(() => {
    calls++;
  }, 500);
  d.flush();
  assert.equal(calls, 0);
});

test("cancel() descarta la llamada pendiente sin ejecutarla", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const d = debounce(() => {
    calls++;
  }, 500);
  d.call();
  d.cancel();
  t.mock.timers.tick(500);
  assert.equal(calls, 0);
});

test("isPending() refleja si hay una ejecución programada", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const d = debounce(() => {}, 500);
  assert.equal(d.isPending(), false);
  d.call();
  assert.equal(d.isPending(), true);
  t.mock.timers.tick(500);
  assert.equal(d.isPending(), false);
});
