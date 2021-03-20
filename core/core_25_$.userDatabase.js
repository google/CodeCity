/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview User database for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.userDatabase = {};
Object.setOwnerOf($.userDatabase, $.physicals.Maximilian);
$.userDatabase.get = function get(id) {
  // Returns the user, or undefined.
  var hash = $.utils.string.hash('md5', this.salt_ + id);
  var table = this.byMd5;
  var value = table[hash];
  if (!($.user.isPrototypeOf(value))) {
    delete table[hash];
    return undefined;
  }
  return value;
};
Object.setOwnerOf($.userDatabase.get, $.physicals.Neil);
Object.setOwnerOf($.userDatabase.get.prototype, $.physicals.Maximilian);
$.userDatabase.set = function set(id, user) {
  if (!$.user.isPrototypeOf(user)) {
    throw new TypeError('userDatabase only accepts $.user values');
  }
  var hash = $.utils.string.hash('md5', this.salt_ + id);
  this.byMd5[hash] = user;
};
Object.setOwnerOf($.userDatabase.set, $.physicals.Maximilian);
Object.setOwnerOf($.userDatabase.set.prototype, $.physicals.Maximilian);
$.userDatabase.validate = function validate() {
  var table = this.byMd5
  for (var key in table) {
    if (!($.user.isPrototypeOf(table[key]))) {
      delete table[key];
    }
  }
};
Object.setOwnerOf($.userDatabase.validate, $.physicals.Maximilian);
Object.setOwnerOf($.userDatabase.validate.prototype, $.physicals.Maximilian);
$.userDatabase.salt_ = 'v2OU0LHchCl84mhu';

$.userDatabase.byMd5 = (new 'Object.create')(null);

