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
 * @fileoverview World-related utils for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.utils.commandMenu = function commandMenu(commands) {
  var cmdXml = '';
  if (commands.length) {
    cmdXml += '<cmds>';
    for (var i = 0; i < commands.length; i++) {
      cmdXml += '<cmd>' + $.utils.html.escape(commands[i]) + '</cmd>';
    }
    cmdXml += '</cmds>';
  }
  return cmdXml;
};
Object.setOwnerOf($.utils.commandMenu, $.physicals.Maximilian);

$.utils.replacePhysicalsWithName = function replacePhysicalsWithName(value) {
  /* Deeply clone JSON object.
   * Replace all instances of $.physical with the object's name.
   */
  if (Array.isArray(value)) {
    var newArray = [];
    for (var i = 0; i < value.length; i++) {
      newArray[i] = replacePhysicalsWithName(value[i]);
    }
    return newArray;
  }
  if ($.physical.isPrototypeOf(value)) {
    return value.name;
  }
  if (typeof value === 'object' && value !== null) {
    var newObject = {};
    for (var prop in value) {
      newObject[prop] = replacePhysicalsWithName(value[prop]);
    }
    return newObject;
  }
  return value;
};
Object.setOwnerOf($.utils.replacePhysicalsWithName, $.physicals.Maximilian);

