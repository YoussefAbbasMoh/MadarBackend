/**
 * Mongoose-like query chain: .select().sort().limit().lean().populate() → thenable.
 */
function createFindChain(execFn) {
  const state = {
    selectStr: null,
    selectCalled: false,
    sortObj: null,
    limitN: null,
    skipN: null,
    lean: false,
    populateArgs: null,
    populates: [],
  };
  const chain = {
    select(s) {
      state.selectStr = s;
      state.selectCalled = true;
      return chain;
    },
    sort(o) {
      state.sortObj = o;
      return chain;
    },
    limit(n) {
      state.limitN = n;
      return chain;
    },
    skip(n) {
      state.skipN = n;
      return chain;
    },
    lean() {
      state.lean = true;
      return chain;
    },
    populate(path, select) {
      state.populates.push({ path, select });
      state.populateArgs = true;
      return chain;
    },
    then(onF, onR) {
      return execFn(state).then(onF, onR);
    },
    catch(onR) {
      return execFn(state).catch(onR);
    },
    exec() {
      return execFn(state);
    },
  };
  return chain;
}

module.exports = { createFindChain };
