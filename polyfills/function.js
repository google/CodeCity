// TODO: Add tests from https://github.com/tc39/test262/tree/master/test/built-ins/Function

Object.defineProperty(Function.prototype, 'call', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(thisArg, var_args) {
    if (typeof this != 'function') {
      throw TypeError('this is not a function');
    }
    var args = [];
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    return this.apply(thisArg, args);
  }
});
