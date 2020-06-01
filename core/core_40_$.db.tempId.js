/**
 * @license
 * Copyright 2018 Google LLC
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
 * @fileoverview Temporary ID database for Code City.
 * @author fraser@google.com (Neil Fraser)
 */

$.db = {};
$.db.tempId = {};


$.db.tempId.getObjById = function(id) {
  // Find object temporarily stored with the given ID.
  var record = $.db.tempId.tempIds_[id];
  if (record) {
     record.time = Date.now();
     return record.obj;
  }
  return undefined;
};

$.db.tempId.storeObj = function(obj) {
  // Find temporary ID for obj in this.tempIds_,
  // adding it if it's not already there.
  var records = $.db.tempId.tempIds_;
  for (var id in records) {
    if (Object.is(records[id].obj, obj)) {
      records[id].time = Date.now();
      return id;
    }
  }
  do {
    var id = String(Math.random()).substring(2);
  } while (records[id]);
  records[id] = {obj: obj, time: Date.now()};
  // Lazy call of cleanup.
  $.db.tempId.cleanSoon();
  return id;
};

$.db.tempId.tempIds_ = Object.create(null);

$.db.tempId.cleanThread_ = null;

$.db.tempId.cleanSoon = function() {
  // Schedule a cleanup to happen in a minute.
  // Allows multiple calls to be batched together.
  if (!$.db.tempId.cleanThread_) {
    $.db.tempId.cleanThread_ =
        setTimeout($.db.tempId.cleanNow, 60 * 1000);
  }
};

$.db.tempId.cleanNow = function() {
  // Cleanup IDs/objects that have not been accessed in an hour.
  clearTimeout($.db.tempId.cleanThread_);
  $.db.tempId.cleanThread_ = null;
  var ttl = Date.now() - $.db.tempId.timeoutMs;
  var records = $.db.tempId.tempIds_;
  for (var id in records) {
    if (records[id].time < ttl) {
      delete records[id];
    }
  }
};

$.db.tempId.timeoutMs = 60 * 60 * 1000;