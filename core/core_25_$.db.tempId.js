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
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.db = {};

$.db.tempId = {};
$.db.tempId.getObjById = function(id) {
  // Find object temporarily stored with the given ID.
  var record = this.tempIds_[id];
  if (record) {
     record.time = Date.now();
     return record.obj;
  }
  return undefined;
};
delete $.db.tempId.getObjById.name;
Object.setOwnerOf($.db.tempId.getObjById, Object.getOwnerOf($.Jssp.prototype.compile));
$.db.tempId.storeObj = function(obj) {
  // Find temporary ID for obj in this.tempIds_,
  // adding it if it's not already there.
  var records = this.tempIds_;
  for (var id in records) {
    if (Object.is(records[id].obj, obj)) {
      records[id].time = Date.now();
      return id;
    }
  }
  do {
    var id = Math.floor(Math.random() * 0xFFFFFFFF);
  } while (records[id]);
  records[id] = {obj: obj, time: Date.now()};
  // Lazy call of cleanup.
  this.cleanSoon();
  return id;
};
delete $.db.tempId.storeObj.name;
Object.setOwnerOf($.db.tempId.storeObj, Object.getOwnerOf($.Jssp.prototype.compile));
$.db.tempId.cleanSoon = function cleanSoon() {
  // Schedule a cleanup to happen in a minute.
  // Allows multiple calls to be batched together.
  if (!this.cleanThread_) {
    this.cleanThread_ = setTimeout(this.cleanNow.bind(this), 60 * 1000);
  }
};
Object.setOwnerOf($.db.tempId.cleanSoon, Object.getOwnerOf($.Jssp.prototype.compile));
$.db.tempId.cleanNow = function cleanNow() {
  // Cleanup IDs/objects that have not been accessed in an hour.
  clearTimeout(this.cleanThread_);
  this.cleanThread_ = null;
  var ttl = Date.now() - this.timeoutMs;
  var records = this.tempIds_;
  for (var id in records) {
    if (records[id].time < ttl) {
      delete records[id];
    }
  }
};
Object.setOwnerOf($.db.tempId.cleanNow, Object.getOwnerOf($.Jssp.prototype.compile));
$.db.tempId.timeoutMs = 3600000;

$.db.tempId.tempIds_ = (new 'Object.create')(null);

$.db.tempId.cleanThread_ = null;

