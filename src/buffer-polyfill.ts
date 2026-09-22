// Polyfill legacy new Buffer(...) and Buffer(...) calls to prevent [DEP0005] DeprecationWarning on Node 24+
const OriginalBuffer = global.Buffer;

if (typeof OriginalBuffer === 'function') {
  global.Buffer = new Proxy(OriginalBuffer, {
    apply(target, _thisArg, args) {
      if (typeof args[0] === 'number') {
        return target.alloc(args[0]);
      }
      return Reflect.apply(target.from, target, args);
    },
    construct(target, args) {
      if (typeof args[0] === 'number') {
        return target.alloc(args[0]);
      }
      return Reflect.apply(target.from, target, args);
    }
  });
}
