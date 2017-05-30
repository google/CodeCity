// TODO: Add tests from https://github.com/tc39/test262/tree/master/test/built-ins/Object

Object.defineProperty(Object, 'keys', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(object) {
    if (typeof object != 'function' && (typeof object != 'object' || !object)) {
      throw TypeError('Object.keys called on non-object');
    }
    var keys = [];
    for (var prop in object) {
      if (Object.prototype.hasOwnProperty.call(object, prop)) {
        keys.push(prop);
      }
    }
    return keys;
  }
});

Object.defineProperty(Object, 'defineProperties', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(object, props) {
    if (typeof object != 'function' && (typeof object != 'object' || !object)) {
      throw TypeError('Object.defineProperties called on non-object');
    }
    if (props === undefined || props === null) {
      throw TypeError('Cannot convert undefined or null to object');
    }
    props = Object(props);
    var keys = Object.keys(props);
    for (var i = 0; i < keys.length; i++) {
      Object.defineProperty(object, keys[i], props[keys[i]]);
    }
    return obj;
  }
});

Object.defineProperty(Object.prototype, 'isPrototypeOf', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function(object) {
    var child = Object.getPrototypeOf(object);
    while (child) {
      if (child == this) {
        return true;
      }
      child = Object.getPrototypeOf(child);
    }
    return false;
  }
});

Object.defineProperty(Object.prototype, 'toLocaleString', {
  configurable: true,
  enumerable: false,
  writable: true,
  value: function() {
    return this.toString();
  }
});
