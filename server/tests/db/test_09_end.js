
$.system.log('Starting tests');

for (var name in tests) {
  var oldBad = console.badCount;
  try {
    tests[name]();
  } catch (e) {
    console.assert(false, 'CRASH: ' + name + '\n' + e);
  }
  if (oldBad < console.badCount) {
    $.system.log(String(tests[name]));
  }
}

$.system.log('');
$.system.log('Completed tests');
$.system.log('Pass: ' + console.goodCount);
$.system.log('Fail: ' + console.badCount);
