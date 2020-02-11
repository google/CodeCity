/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Reboot the server, and verify restart.
 * @author fraser@google.com (Neil Fraser)
 */

$.system.shutdown();

$.system.log('Benchmarking resurrected fibonacci10k...');
test_fibonacci10k();

$.system.shutdown();
