
$.system.shutdown();

$.system.log('Benchmarking resurrected fibonacci10k...');
test_fibonacci10k();
setTimeout($.system.shutdown, 1000);
