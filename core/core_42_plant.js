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
 * @fileoverview Plant demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.seed = (new 'Object.create')($.thing);
$.seed.name = 'Generic Seed';
$.seed.aliases = [];
$.seed.aliases[0] = 'seed';
$.seed.description = 'A harmless looking seed.  Try planting it in a pot, then watering it.';
$.seed.svgText = '<ellipse class="fillWhite" cx="-14.60892" cy="97.64293" fill-opacity="null" rx="2.8451" ry="1.63544" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(19.9831 -14.6089 97.6429)"/>\n<path d="m-16.80718,96.20653l1.575,1.221l1.57498,-0.04348l1.7717,0.9894" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>';
$.seed.contents_ = [];
$.seed.contents_.forObj = $.seed;
Object.defineProperty($.seed.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.seed.contents_.forKey = 'contents_';
Object.defineProperty($.seed.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});

$.seed.location = undefined;

$.physicals['Generic Seed'] = $.seed;

$.pot = (new 'Object.create')($.thing);
$.pot.name = 'flower pot';
$.pot.aliases = [];
$.pot.aliases[0] = 'pot';
$.pot.description = 'A clay flower pot.  Try planting a seed in a pot, then watering it.';
$.pot.plant = function plant(cmd) {
    cmd.user.narrate('You plant ' + String(cmd.dobj) + ' in ' + String(this) + '.');
    if (cmd.user.location) {
      cmd.user.location.narrate(String(cmd.user) + ' plants ' + String(cmd.dobj) + ' in ' + String(this) + '.', cmd.user);
    }
    cmd.dobj.moveTo(null);
    this.stage = 0;
    this.seed = cmd.dobj;
  };
Object.setOwnerOf($.pot.plant, $.physicals.Maximilian);
$.pot.plant.verb = 'plant|put';
$.pot.plant.dobj = 'any';
$.pot.plant.prep = 'in/inside/into';
$.pot.plant.iobj = 'this';
$.pot.water = function water(cmd) {
  cmd.user.narrate('You water ' + String(this) + '.');
  if (cmd.user.location) {
    cmd.user.location.narrate(String(cmd.user) + ' waters ' + String(this) + '.', cmd.user);
  }
  if (this.seed && this.stage < 4) {
    if (this.stage === 2) {
      var newSeed = Object.create(this.seed);
      newSeed.moveTo(this.location, this);
      cmd.user.location.narrate('A new seed appears.');
    }
    this.stage++;
    this.location.updateScene(true);
  }
};
Object.setOwnerOf($.pot.water, $.physicals.Neil);
$.pot.water.verb = 'water';
$.pot.water.dobj = 'this';
$.pot.water.prep = 'none';
$.pot.water.iobj = 'none';
$.pot.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  commands.push('water ' + this.name);
  return commands;
};
Object.setOwnerOf($.pot.getCommands, $.physicals.Neil);
$.pot.contents_ = [];
$.pot.contents_.forObj = $.pot;
Object.defineProperty($.pot.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.pot.contents_.forKey = 'contents_';
Object.defineProperty($.pot.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.pot.reset = function reset(cmd) {
  $.physicals["a seed"].moveTo(this.location);
  this.stage = 0;
  this.seed = null;
  cmd.user.narrate('You reset ' + String(this) + '.');
};
Object.setOwnerOf($.pot.reset, $.physicals.Neil);
Object.setOwnerOf($.pot.reset.prototype, $.physicals.Neil);
$.pot.reset.verb = 'reset';
$.pot.reset.dobj = 'this';
$.pot.reset.prep = 'none';
$.pot.reset.iobj = 'none';
$.pot.svgText = function svgText() {
  return this.stages[this.stage];
};
Object.setOwnerOf($.pot.svgText, $.physicals.Neil);

$.pot.location = undefined;

$.pot.seed = undefined;

$.pot.stage = undefined;

$.pot.stages = [];
$.pot.stages[0] = '<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>\n<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>';
$.pot.stages[1] = '<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>\n<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path d="m-27.6607,77.44994l0.01557,-2.07037l0.23372,-3.07635l0.85039,-2.90272l0.79706,-1.6423" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.55322,67.75553c0.69425,-0.56003 1.15359,-1.31478 1.75841,-1.96447c0.58404,-0.62737 1.43496,-0.96868 2.3408,-1.06159c0.91634,-0.094 1.96963,-0.48738 2.6644,-0.13516c0.5443,0.27594 0.4357,1.44401 -0.07556,2.12869c-0.5115,0.68502 -1.44461,0.97306 -2.27121,1.30384c-0.84867,0.33961 -1.65573,0.25603 -2.62243,0.25556l-1.61804,-0.42262" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(7.81058 -21.9909 66.3711)"/>\n<path class="fillWhite strokeBlack" d="m-25.76396,67.54478c-0.04318,-0.70648 -0.24023,-1.54869 -0.52687,-2.37312c-0.28528,-0.82052 -0.62256,-1.58778 -1.15685,-2.27388c-0.52987,-0.68044 -1.10796,-1.57005 -1.95843,-1.67432c-0.48733,-0.05975 -0.41485,0.95987 -0.36206,1.80597c0.05552,0.88987 -0.08249,1.76196 0.10537,2.51324c0.1856,0.7422 0.9795,1.19627 1.7738,1.38742l0.78632,0.08829l0.83518,0.10492" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>';
$.pot.stages[2] = '<path class="fillWhite" d="m-15.33193,52.05479c0.99447,0.46979 2.01573,0.95001 2.63483,0.38386c0.61289,-0.56047 -0.13699,-1.46922 -0.6876,-1.75592l-0.8807,-0.10318l-0.85592,0.02993" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>\n<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path d="m-27.76607,77.44994l0.01557,-2.07037l0.23372,-3.07635l0.85039,-2.90272l2.67555,-6.31152l1.41108,-3.67717l1.09493,-4.41479l-0.06417,-4.62554" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.55322,67.75553c0.69425,-0.56003 1.15359,-1.31478 1.75841,-1.96447c0.58404,-0.62737 1.43496,-0.96868 2.3408,-1.06159c0.91634,-0.094 1.96963,-0.48738 2.6644,-0.13516c0.5443,0.27594 0.4357,1.44401 -0.07556,2.12869c-0.5115,0.68502 -1.44461,0.97306 -2.27121,1.30384c-0.84867,0.33961 -1.65573,0.25603 -2.62243,0.25556l-1.61804,-0.42262" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(7.81058 -21.9909 66.3711)"/>\n<path class="fillWhite strokeBlack" d="m-25.76396,67.54478c-0.04318,-0.70648 -0.24023,-1.54869 -0.52687,-2.37312c-0.28528,-0.82052 -0.62256,-1.58778 -1.15685,-2.27388c-0.52987,-0.68044 -1.10796,-1.57005 -1.95843,-1.67432c-0.48733,-0.05975 -0.41485,0.95987 -0.36206,1.80597c0.05552,0.88987 -0.08249,1.76196 0.10537,2.51324c0.1856,0.7422 0.9795,1.19627 1.7738,1.38742l0.78632,0.08829l0.83518,0.10492" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-23.23498,54.69271c-0.21123,0.80087 -0.4857,1.65683 -1.05148,2.29854c-0.57769,0.65524 -1.71748,1.17988 -2.25348,0.49021c-0.51308,-0.66018 0.13502,-1.64304 0.52984,-2.37712l0.75193,-0.31185l1.24075,-0.52485" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-19.33614,55.32139c0.18068,0.83063 0.00168,1.83364 0.5058,2.5079c0.46582,0.62304 1.60054,0.51549 1.70706,-0.3164c0.10934,-0.85386 -0.35328,-1.59642 -0.88781,-2.18771l-0.35912,-0.21454l-0.43906,-0.15806" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.44784,53.10853c-0.36207,0.78314 -0.66601,1.6597 -1.34427,2.13806c-0.66779,0.47097 -1.79337,0.03207 -2.16421,-0.73159c-0.38464,-0.7921 0.12766,-1.54177 0.82364,-2.03652l0.73762,-0.21294l1.47304,-0.10538" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-17.22866,54.0569c0.77374,0.45762 1.303,1.27441 2.0548,1.58281c0.7353,0.30164 1.89823,0.24449 1.94928,-0.55014c0.05578,-0.86815 -0.57155,-1.60436 -1.41075,-1.77029l-0.89849,0l-0.83428,0.10537" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-26.50158,51.00105c-0.97452,0 -1.87253,-0.0001 -2.73973,-0.22831c-0.74498,-0.19605 -1.36818,-0.98574 -1.26449,-1.80372c0.08844,-0.69767 1.23344,-0.70722 2.057,-0.54964l0.77237,0.30447l0.64798,0.51591l0.99431,0.60217" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.97471,48.99895c-0.55293,-0.80132 -1.10757,-1.50199 -1.5124,-2.28718c-0.39846,-0.77285 -0.06737,-1.57484 0.75722,-1.61166c0.74202,-0.03314 1.30537,0.52689 1.43225,1.21967l0.06055,0.70699l0.17562,0.60232" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-15.4373,49.20969c0.8614,-0.16593 1.75931,-0.37352 2.39246,-0.91676c0.64524,-0.5536 0.85589,-1.67983 0.13651,-2.13909c-0.72896,-0.46538 -1.6333,0.05268 -2.43007,0.37667l-0.58814,0.53453l-0.14301,0.81194" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-22.81349,46.57534c-0.14254,-0.86906 -0.38418,-1.71893 -0.84187,-2.44313c-0.40485,-0.64061 -0.85311,-0.19136 -1.055,0.53741l-0.21061,0.74661l0.52659,0.60232l0.63472,0.5063" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-17.54479,46.89146c0.45534,-0.74816 1.1105,-1.43851 1.05374,-2.30067c-0.05404,-0.82089 -0.73696,-1.58422 -1.58946,-1.4928c-0.83913,0.08999 -1.15026,1.04935 -1.39817,1.829l-0.06821,0.87357" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-21.86512,45.83772c-0.52132,-0.76321 -0.92961,-1.6151 -0.77478,-2.42313c0.1549,-0.80838 0.9732,-1.41434 1.61932,-0.88941c0.65289,0.53043 0.73607,1.45683 0.52532,2.23772l-0.06055,0.76136l-0.15019,0.69013" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-21.9705,55.21602c-0.41595,0.80687 -0.7821,1.62598 -0.73762,2.4741c0.04317,0.82297 0.53191,1.60149 1.20394,1.52633c0.71107,-0.07954 1.00892,-0.95012 1.00892,-1.73049l0.0022,-0.84519l-0.05896,-0.57796l-0.15399,-0.63001" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<ellipse class="fillWhite" cx="-20.86407" cy="50.79031" fill-opacity="null" rx="5.21602" ry="4.42571" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>';
$.pot.stages[3] = '<path class="fillWhite" d="m-15.33193,52.05479c0.99447,0.46979 2.01573,0.95001 2.63483,0.38386c0.61289,-0.56047 -0.13699,-1.46922 -0.6876,-1.75592l-0.8807,-0.10318l-0.85592,0.02993" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>\n<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path d="m-27.76607,77.44994l0.01557,-2.07037l0.23372,-3.07635l0.85039,-2.90272l2.67555,-6.31152l1.41108,-3.67717l1.09493,-4.41479l-0.06417,-4.62554" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.55322,67.75553c0.69425,-0.56003 1.15359,-1.31478 1.75841,-1.96447c0.58404,-0.62737 1.43496,-0.96868 2.3408,-1.06159c0.91634,-0.094 1.96963,-0.48738 2.6644,-0.13516c0.5443,0.27594 0.4357,1.44401 -0.07556,2.12869c-0.5115,0.68502 -1.44461,0.97306 -2.27121,1.30384c-0.84867,0.33961 -1.65573,0.25603 -2.62243,0.25556l-1.61804,-0.42262" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(7.81058 -21.9909 66.3711)"/>\n<path class="fillWhite strokeBlack" d="m-25.76396,67.54478c-0.04318,-0.70648 -0.24023,-1.54869 -0.52687,-2.37312c-0.28528,-0.82052 -0.62256,-1.58778 -1.15685,-2.27388c-0.52987,-0.68044 -1.10796,-1.57005 -1.95843,-1.67432c-0.48733,-0.05975 -0.41485,0.95987 -0.36206,1.80597c0.05552,0.88987 -0.08249,1.76196 0.10537,2.51324c0.1856,0.7422 0.9795,1.19627 1.7738,1.38742l0.78632,0.08829l0.83518,0.10492" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-23.23498,54.69271c-0.21123,0.80087 -0.4857,1.65683 -1.05148,2.29854c-0.57769,0.65524 -1.71748,1.17988 -2.25348,0.49021c-0.51308,-0.66018 0.13502,-1.64304 0.52984,-2.37712l0.75193,-0.31185l1.24075,-0.52485" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-19.33614,55.32139c0.18068,0.83063 0.00168,1.83364 0.5058,2.5079c0.46582,0.62304 1.60054,0.51549 1.70706,-0.3164c0.10934,-0.85386 -0.35328,-1.59642 -0.88781,-2.18771l-0.35912,-0.21454l-0.43906,-0.15806" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.44784,53.10853c-0.36207,0.78314 -0.66601,1.6597 -1.34427,2.13806c-0.66779,0.47097 -1.79337,0.03207 -2.16421,-0.73159c-0.38464,-0.7921 0.12766,-1.54177 0.82364,-2.03652l0.73762,-0.21294l1.47304,-0.10538" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-17.22866,54.0569c0.77374,0.45762 1.303,1.27441 2.0548,1.58281c0.7353,0.30164 1.89823,0.24449 1.94928,-0.55014c0.05578,-0.86815 -0.57155,-1.60436 -1.41075,-1.77029l-0.89849,0l-0.83428,0.10537" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-26.50158,51.00105c-0.97452,0 -1.87253,-0.0001 -2.73973,-0.22831c-0.74498,-0.19605 -1.36818,-0.98574 -1.26449,-1.80372c0.08844,-0.69767 1.23344,-0.70722 2.057,-0.54964l0.77237,0.30447l0.64798,0.51591l0.99431,0.60217" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.97471,48.99895c-0.55293,-0.80132 -1.10757,-1.50199 -1.5124,-2.28718c-0.39846,-0.77285 -0.06737,-1.57484 0.75722,-1.61166c0.74202,-0.03314 1.30537,0.52689 1.43225,1.21967l0.06055,0.70699l0.17562,0.60232" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-15.4373,49.20969c0.8614,-0.16593 1.75931,-0.37352 2.39246,-0.91676c0.64524,-0.5536 0.85589,-1.67983 0.13651,-2.13909c-0.72896,-0.46538 -1.6333,0.05268 -2.43007,0.37667l-0.58814,0.53453l-0.14301,0.81194" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-22.81349,46.57534c-0.14254,-0.86906 -0.38418,-1.71893 -0.84187,-2.44313c-0.40485,-0.64061 -0.85311,-0.19136 -1.055,0.53741l-0.21061,0.74661l0.52659,0.60232l0.63472,0.5063" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-17.54479,46.89146c0.45534,-0.74816 1.1105,-1.43851 1.05374,-2.30067c-0.05404,-0.82089 -0.73696,-1.58422 -1.58946,-1.4928c-0.83913,0.08999 -1.15026,1.04935 -1.39817,1.829l-0.06821,0.87357" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-21.86512,45.83772c-0.52132,-0.76321 -0.92961,-1.6151 -0.77478,-2.42313c0.1549,-0.80838 0.9732,-1.41434 1.61932,-0.88941c0.65289,0.53043 0.73607,1.45683 0.52532,2.23772l-0.06055,0.76136l-0.15019,0.69013" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-21.9705,55.21602c-0.41595,0.80687 -0.7821,1.62598 -0.73762,2.4741c0.04317,0.82297 0.53191,1.60149 1.20394,1.52633c0.71107,-0.07954 1.00892,-0.95012 1.00892,-1.73049l0.0022,-0.84519l-0.05896,-0.57796l-0.15399,-0.63001" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<ellipse class="fillWhite" cx="-20.86407" cy="50.79031" fill-opacity="null" rx="5.21602" ry="4.42571" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>';
$.pot.stages[4] = '<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>\n<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path d="m-27.76607,77.44994l0.01557,-2.07037l0.23372,-3.07635l0.85039,-2.90272l2.67555,-6.31152l1.41108,-3.67717l1.09493,-4.41479l-0.06417,-4.62554" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite" d="m-25.55322,67.75553c0.69425,-0.56003 1.15359,-1.31478 1.75841,-1.96447c0.58404,-0.62737 1.43496,-0.96868 2.3408,-1.06159c0.91634,-0.094 1.96963,-0.48738 2.6644,-0.13516c0.5443,0.27594 0.4357,1.44401 -0.07556,2.12869c-0.5115,0.68502 -1.44461,0.97306 -2.27121,1.30384c-0.84867,0.33961 -1.65573,0.25603 -2.62243,0.25556l-1.61804,-0.42262" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(7.81058 -21.9909 66.3711)"/>\n<path class="fillWhite strokeBlack" d="m-25.76396,67.54478c-0.04318,-0.70648 -0.24023,-1.54869 -0.52687,-2.37312c-0.28528,-0.82052 -0.62256,-1.58778 -1.15685,-2.27388c-0.52987,-0.68044 -1.10796,-1.57005 -1.95843,-1.67432c-0.48733,-0.05975 -0.41485,0.95987 -0.36206,1.80597c0.05552,0.88987 -0.08249,1.76196 0.10537,2.51324c0.1856,0.7422 0.9795,1.19627 1.7738,1.38742l0.78632,0.08829l0.83518,0.10492" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<g transform="scale(-1, 1) translate(50, 0)">\n <path class="fillWhite" d="m-25.3595,55.75391c-17.03652,-7.72601 -11.7986,-25.43283 3.27911,-22.03468c7.53886,1.69907 15.52472,6.01549 16.12798,7.92411c0.60325,1.90862 2.78068,6.99427 -1.92957,4.96314c-4.71025,-2.03113 -10.49024,-2.09877 -10.65832,-1.88742c-0.16808,0.21134 6.50568,8.15007 11.21126,8.74324c4.70558,0.59317 -5.23155,8.10778 -14.19902,3.53609l-3.83144,-1.24448z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n <ellipse class="fillBlack" cx="-18.38778" cy="38.56691" fill-opacity="null" rx="2.21286" ry="0.94837" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(21.8014 -18.3878 38.5669)"/>\n <path d="m-6.26976,53.74078l1.11596,-2.21252l-2.73396,1.89274l-0.63091,-2.83912l-2.10305,1.36698l-0.42061,-2.94427l-2.2082,0.84122l-0.42061,-2.52366l-1.9979,0.42061" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n <path d="m-5.32139,47.10222l0.27275,2.21784l-1.57773,-2.20776l-1.78715,1.05108l-0.84122,-2.10305l-2.41851,1.05153l-1.15668,-1.9979" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n <line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" x1="-34.93151" x2="-27.02845" y1="28.34563" y2="37.19705"/>\n <line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" x1="-41.25395" x2="-30.0843" y1="28.13488" y2="38.35616"/>\n <line fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" x1="-41.99157" x2="-31.55954" y1="36.03793" y2="40.35827"/>\n</g>';
$.pot.stages[5] = '<path class="fillWhite" d="m-33.77239,82.99355l1.77938,16.27304l10.10505,0l1.69713,-16.38982l-13.58156,0.11678z" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="strokeGrey" d="m-27.76607,77.44994l0.01557,-2.07037l0.23372,-3.07635l0.85039,-2.90272l0.88419,-2.20193" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<path class="fillWhite strokeGrey" d="m-27.87145,72.49736c0.69425,-0.56003 1.15359,-1.31478 1.75841,-1.96447c0.58404,-0.62737 1.43496,-0.96868 2.3408,-1.06159c0.91634,-0.094 1.96963,-0.48738 2.6644,-0.13516c0.5443,0.27594 0.4357,1.44401 -0.07556,2.12869c-0.5115,0.68502 -1.44461,0.97306 -2.27121,1.30384c-0.84867,0.33961 -1.65573,0.25603 -2.62243,0.25556l-1.61804,-0.42262" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(90.3565 -24.3091 71.113)"/>\n<path class="fillWhite strokeGrey" d="m-27.55532,72.49736c-0.04318,-0.70648 -0.24023,-1.54869 -0.52687,-2.37312c-0.28528,-0.82052 -0.62256,-1.58778 -1.15685,-2.27388c-0.52987,-0.68044 -1.10796,-1.57005 -1.95843,-1.67432c-0.48733,-0.05975 -0.41485,0.95987 -0.36206,1.80597c0.05552,0.88987 -0.08249,1.76196 0.10537,2.51324c0.1856,0.7422 0.9795,1.19627 1.7738,1.38742l0.78632,0.08829l0.83518,0.10492" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null" transform="rotate(-77.5564 -29.5764 69.3354)"/>\n<path class="strokeGrey" d="m-25.86934,67.65016c0.40309,-1.45683 1.41882,-2.34001 2.45746,-2.32875c1.03865,0.01126 2.21288,-0.00228 2.43864,2.82569" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/>\n<rect class="fillWhite" height="5.05796" width="17.38672" x="-35.87987" y="77.76607"/>';

$.physicals['flower pot'] = $.pot;

$.thrower = (new 'Object.create')($.thing);
$.thrower.name = 'a flame thrower';
$.thrower.aliases = [];
Object.setOwnerOf($.thrower.aliases, $.physicals.Maximilian);
$.thrower.aliases[0] = 'flame thrower';
$.thrower.aliases[1] = 'flamethrower';
$.thrower.aliases[2] = 'a flamethrower';
$.thrower.aliases[3] = 'thrower';
$.thrower.description = 'A backpack filled with napalm.  A pilot light is burning quietly.';
$.thrower.svgText = '<g transform=\'scale(-1.5, 1.5) translate(17, -10)\'><rect class="strokeBlack fillGrey" height="13.06639" width="4.10959" x="-19.44152" y="48.68282"/>\n<path d="m-19.75764,50.15806c-2.23042,-3.16122 -8.40716,0.81052 0.148,10.25242"/>\n<path class="strokeBlack fillGrey" d="m-17.33404,58.58799l-8.74377,0.19224l-7.6768,-4.20565l-0.7354,1.68199l8.09674,4.41641l9.04311,-0.42061" fill-opacity="null" stroke-dasharray="null" stroke-linecap="null" stroke-linejoin="null" stroke-opacity="null" stroke-width="null"/></g>';
$.thrower.wear = function wear(user) {
  if (this.savedSvg) {
    user.narrate(String(this) + ' is already being worn.');
    return;
  }
  this.moveTo(user);
  this.savedSvg = user.svgText;
  user.svgText += this.svgText;
  if (user.location) {
    user.location.updateScene(true);
    user.location.narrate(String(user) + ' straps on ' + String(this) + '.', user);
  }
  user.narrate('You strap on ' + String(this) + '.');
};
Object.setOwnerOf($.thrower.wear, $.physicals.Neil);
$.thrower.unwear = function unwear(user) {
  if (!this.savedSvg) {
    user.narrate('You aren\'t wearing ' + String(this) + '.');
    return;
  }
  user.svgText = this.savedSvg;
  this.savedSvg = undefined;
  if (user.location) {
    user.location.updateScene(true);
    user.location.narrate(String(user) + ' takes off ' + String(this) + '.', user);
  }
  user.narrate('You takes off ' + String(this) + '.');
};
Object.setOwnerOf($.thrower.unwear, $.physicals.Neil);
$.thrower.fire = function fire(cmd) {
  var memo = {
    type: 'iframe',
    url: '/static/flamethrower.html',
    alt: 'FIRE!!!'
  };
  cmd.user.location.sendMemo(memo);
  if (cmd.iobj.seed) {
    cmd.iobj.seed = null;
  }
  if (typeof cmd.iobj.stage === 'number') {
    if (cmd.iobj.stage > 0) {
      cmd.iobj.stage = cmd.iobj.stages.length - 1;
    }
  }
  suspend(5000);
  cmd.user.location.updateScene(true);
};
Object.setOwnerOf($.thrower.fire, $.physicals.Neil);
$.thrower.fire.verb = 'fire';
$.thrower.fire.dobj = 'this';
$.thrower.fire.prep = 'at/to';
$.thrower.fire.iobj = 'any';
$.thrower.getCommands = function getCommands(who) {
  var commands = $.thing.getCommands.call(this, who);
  if (this.savedSvg) {
    commands.push('take off ' + this.name);
  } else {
    commands.push('put on ' + this.name);
  }
  return commands;
};
Object.setOwnerOf($.thrower.getCommands, $.physicals.Neil);
$.thrower.contents_ = [];
$.thrower.contents_.forObj = $.thrower;
Object.defineProperty($.thrower.contents_, 'forObj', {writable: false, enumerable: false, configurable: false});
$.thrower.contents_.forKey = 'contents_';
Object.defineProperty($.thrower.contents_, 'forKey', {writable: false, enumerable: false, configurable: false});
$.thrower.unwear1 = function unwear1(cmd) {
  this.unwear(cmd.user);
};
Object.setOwnerOf($.thrower.unwear1, $.physicals.Neil);
Object.setOwnerOf($.thrower.unwear1.prototype, $.physicals.Neil);
$.thrower.unwear1.verb = 'take';
$.thrower.unwear1.dobj = 'this';
$.thrower.unwear1.prep = 'off/off of';
$.thrower.unwear1.iobj = 'none';
$.thrower.unwear2 = function unwear2(cmd) {
  this.unwear(cmd.user);
};
Object.setOwnerOf($.thrower.unwear2, $.physicals.Neil);
Object.setOwnerOf($.thrower.unwear2.prototype, $.physicals.Neil);
$.thrower.unwear2.verb = 'take';
$.thrower.unwear2.dobj = 'none';
$.thrower.unwear2.prep = 'off/off of';
$.thrower.unwear2.iobj = 'this';
$.thrower.wear1 = function wear1(cmd) {
  this.wear(cmd.user);
};
Object.setOwnerOf($.thrower.wear1, $.physicals.Neil);
Object.setOwnerOf($.thrower.wear1.prototype, $.physicals.Neil);
$.thrower.wear1.verb = 'put';
$.thrower.wear1.dobj = 'this';
$.thrower.wear1.prep = 'on top of/on/onto/upon';
$.thrower.wear1.iobj = 'none';
$.thrower.wear2 = function wear2(cmd) {
  this.wear(cmd.user);
};
Object.setOwnerOf($.thrower.wear2, $.physicals.Neil);
Object.setOwnerOf($.thrower.wear2.prototype, $.physicals.Neil);
$.thrower.wear2.verb = 'put';
$.thrower.wear2.dobj = 'none';
$.thrower.wear2.prep = 'on top of/on/onto/upon';
$.thrower.wear2.iobj = 'this';

$.thrower.location = undefined;

$.thrower.savedSvg = undefined;

$.physicals['a flame thrower'] = $.thrower;

