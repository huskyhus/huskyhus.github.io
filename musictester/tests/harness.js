// Node とブラウザの両方で動く、小さなテストの道具。
const registered = [];

export function test(name, fn) {
  registered.push({ name, fn });
}

const show = x => {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
};

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => deepEqual(a[k], b[k]));
}

export const assert = {
  ok(v, msg = "") {
    if (!v) throw new Error(`真であるべき: ${msg}`);
  },
  equal(a, b, msg = "") {
    if (a !== b) throw new Error(`${msg} 期待 ${show(b)} / 実際 ${show(a)}`);
  },
  deepEqual(a, b, msg = "") {
    if (!deepEqual(a, b)) throw new Error(`${msg} 期待 ${show(b)} / 実際 ${show(a)}`);
  },
  throws(fn, pattern, msg = "") {
    try {
      fn();
    } catch (e) {
      if (pattern && !pattern.test(e.message)) throw new Error(`${msg} 例外の文が違います: ${e.message}`);
      return;
    }
    throw new Error(`${msg} 例外が出るはずです`);
  },
};

/** 登録したテストを全部動かす → [{ name, error }] */
export function runAll() {
  return registered.map(({ name, fn }) => {
    try {
      fn();
      return { name, error: null };
    } catch (e) {
      return { name, error: e };
    }
  });
}
