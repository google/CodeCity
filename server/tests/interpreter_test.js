'use strict';

let Interpreter = require('../');
let autoexec = require('../autoexec');
let testcases = require('./testcases');

for (let i = 0; i < testcases.length; i++) {
  let tc = testcases[i];

  if (!('expected' in tc)) {
    console.log('SKIP\t%s', tc.name);
    continue;
  }
  
  let interpreter = new Interpreter()
  interpreter.appendCode(autoexec);
  interpreter.run();

  let err;
  try {
    interpreter.appendCode(tc.src);
    interpreter.run();
  } catch (e) {
    err = e
  }
  let r = interpreter.pseudoToNative(interpreter.value);

  if (err) {
    console.error('FAILED\t%s\n\n%s\n', tc.name, tc.src.trim());
    console.error(err);
  } else if (r !== tc.expected) {
    console.error('FAILED\t%s\n\n%s\n\ngot: %j  want: %j',
    tc.name, tc.src.trim(), r, tc.expected);
  } else {
    console.log('OK\t%s', tc.name);
  }
}
		  
