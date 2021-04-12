/**
 * @license
 * Copyright 2021 Google LLC
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
 * @fileoverview Security course demo for Code City.
 */

//////////////////////////////////////////////////////////////////////
// AUTO-GENERATED CODE FROM DUMP.  EDIT WITH CAUTION!
//////////////////////////////////////////////////////////////////////

$.securityCourse = {};
Object.setOwnerOf($.securityCourse, $.physicals.Neil);
$.securityCourse.StoreHost = function StoreHost() {
  /* A $.servers.http.Host subclass for per-user stores for the security
   * course.
   */
  $.servers.http.Host.call(this);
  var user = Object.getOwnerOf(this);
  if (!($.user.isPrototypeOf(user))) {
    throw new TypeError('new store must be owned by a $.user');
  }
  var hostname = user.name.toLowerCase();
  if (hostname in $.securityCourse.storeHosts) {
    throw new RangeError('a store named ' + hostname + ' already exists');
  } else if (hostname in $.hosts.root.subdomains) {
    throw new RangeError('the subdomain ' + hostname + ' is already in use');
  }
  (function inner() {
    // Run set-up with non-privileged perms.
    setPerms(user);
    var store = Object.create($.securityCourse.storePagePrototype);
    store.name = user.name + "'s Store";
    this['/'] = store;
  }).call(this);
  $.securityCourse.storeHosts[hostname] = this;
  $.hosts.root.addSubdomain(hostname, this);

};
Object.setOwnerOf($.securityCourse.StoreHost, $.physicals.Maximilian);
Object.setPrototypeOf($.securityCourse.StoreHost.prototype, $.servers.http.Host.prototype);
Object.setOwnerOf($.securityCourse.StoreHost.prototype, $.physicals.Maximilian);
$.securityCourse.StoreHost.prototype.destroy = function destroy() {
  if (!(this instanceof $.securityCourse.StoreHost)) {
    throw new TypeError('destroy must be called on a StoreHost');
  }
  var callerPerms = Thread.callers()[0].callerPerms;
  if(Object.getOwnerOf(this) !== callerPerms) {
    throw new PermissionError('can only be deleted by owner');
  }
  $.hosts.root.deleteSubdomain(this);
  var stores = $.securityCourse.storeHosts;
  for (var key in stores) {
    if (stores[key] === this) {
      delete stores[key];
    }
  }
};
Object.setOwnerOf($.securityCourse.StoreHost.prototype.destroy, $.physicals.Maximilian);
Object.setOwnerOf($.securityCourse.StoreHost.prototype.destroy.prototype, $.physicals.Maximilian);
$.securityCourse.storePagePrototype = {};
Object.setOwnerOf($.securityCourse.storePagePrototype, $.physicals.Neil);
$.securityCourse.storePagePrototype.www = function www(request, response) {
  // This is a routing function.  There's nothing interesting here.  Honest.
  var prop = {
    'basket': 'wwwBasket',
    'confirm': 'wwwConfirm',
  }[request.parameters.page] || 'wwwHome';
  $.jssp.eval(this, prop, request, response);
};
Object.setOwnerOf($.securityCourse.storePagePrototype.www, $.physicals.Maximilian);
Object.setOwnerOf($.securityCourse.storePagePrototype.www.prototype, $.physicals.Neil);
$.securityCourse.storePagePrototype.name = 'Security Store';
$.securityCourse.storePagePrototype.inventory = [];
Object.setOwnerOf($.securityCourse.storePagePrototype.inventory, $.physicals.Neil);
$.securityCourse.storePagePrototype.inventory[0] = {};
Object.setOwnerOf($.securityCourse.storePagePrototype.inventory[0], $.physicals.Neil);
$.securityCourse.storePagePrototype.inventory[0].name = 'Beach ball';
$.securityCourse.storePagePrototype.inventory[0].price = '2.75';
$.securityCourse.storePagePrototype.inventory[0].id = 'yYrq3jVfWK';
$.securityCourse.storePagePrototype.inventory[0].public = true;
$.securityCourse.storePagePrototype.inventory[0].img = 'beachball.png';
$.securityCourse.storePagePrototype.inventory[1] = {};
Object.setOwnerOf($.securityCourse.storePagePrototype.inventory[1], $.physicals.Neil);
$.securityCourse.storePagePrototype.inventory[1].name = 'Flip flops';
$.securityCourse.storePagePrototype.inventory[1].price = '8.50';
$.securityCourse.storePagePrototype.inventory[1].id = 'GSaYngk5Jn';
$.securityCourse.storePagePrototype.inventory[1].public = true;
$.securityCourse.storePagePrototype.inventory[1].img = 'flipflops.png';
$.securityCourse.storePagePrototype.inventory[2] = {};
Object.setOwnerOf($.securityCourse.storePagePrototype.inventory[2], $.physicals.Neil);
$.securityCourse.storePagePrototype.inventory[2].name = 'Nuclear waste';
$.securityCourse.storePagePrototype.inventory[2].price = '666';
$.securityCourse.storePagePrototype.inventory[2].id = 'iu9i5GvLeJ';
$.securityCourse.storePagePrototype.inventory[2].public = false;
$.securityCourse.storePagePrototype.inventory[2].img = 'radioactive.png';
$.securityCourse.storePagePrototype.inventory[3] = {};
Object.setOwnerOf($.securityCourse.storePagePrototype.inventory[3], $.physicals.Neil);
$.securityCourse.storePagePrototype.inventory[3].name = 'Guitar';
$.securityCourse.storePagePrototype.inventory[3].price = '24.30';
$.securityCourse.storePagePrototype.inventory[3].id = 'uazSOLHfkt';
$.securityCourse.storePagePrototype.inventory[3].public = true;
$.securityCourse.storePagePrototype.inventory[3].img = 'guitar.png';
$.securityCourse.storePagePrototype.wwwHome = '<% include(\'header\'); %>\n<h1><%= this.name %> Home</h1>\n\n<form>\n<input type="hidden" name="page" value="basket">\n\n<%\nvar staticUrl = request.hostUrl(\'static\');\nfor (var i = 0; i < this.inventory.length; i++) {\n  var item = this.inventory[i];\n  if (!item || !item.public) continue;\n%>\n<p>\n  <img src="<%=staticUrl%>securitystore/<%=item.img%>" class="productImage" />\n  <div class="productName"><%=item.name%></div>\n  <div class="price"><%=item.price%></div>\n  <div class="quantity">Quantity: <input type="number" name="item<%=i%>" value="0" min="0" max="100"></div>\n<p> \n<% } %>\n\n<p>\n  <input type="submit" value="Add to basket">\n</p>\n</form>  \n  \n<% include(\'footer\'); %>';
$.securityCourse.storePagePrototype.wwwBasket = '<% include(\'header\'); %>\n<h1><%= this.name %> Basket</h1>\n\n<table>\n<%\nvar staticUrl = request.hostUrl(\'static\');\nvar total = 0;  \nvar order = {};\nfor (var param in request.parameters) {\n  if (!param.startsWith(\'item\')) continue;\n  var item = this.inventory[Number(param.substring(4))];\n  var quant = Number(request.parameters[param]);\n  if (!item || !quant) continue;\n  var lineTotal = quant * item.price;\n  total += lineTotal;\n  order[item.id] = quant;\n%>\n<tr>\n  <td><img src="<%=staticUrl%>securitystore/<%=item.img%>" class="basketImage" /></td>\n  <td><%=item.name%></td>\n  <td><%=quant%> x <span class="price"><%=item.price%></span> = <span class="price"><%=lineTotal%></span></td>\n<tr> \n<% } %>\n</table>\n\n<p>Total: <span class="price"><%=total%></span></p>\n\n<form method="POST">\n<input type="hidden" name="page" value="confirm">\n<input type="hidden" name="order" value=\'<%=JSON.stringify(order)%>\'>\n<input type="hidden" name="total" value="<%=total%>">\n\n<p>\n  Name: <input name="name">\n</p>\n<p>\n  Credit card: <input name="card"><br>\n  (Don\'t enter a real card number, \'123\' is fine.)\n</p>\n<p>\n  <input type="submit" value="Purchase">\n</p>\n</form>  \n  \n<% include(\'footer\'); %>';
$.securityCourse.storePagePrototype.wwwConfirm = "<% include('header'); %>\n<h1><%= this.name %> Confirm</h1>\n\n<p>Thank you <%=request.parameters.name%>!<p>\n<p>Your credit card has been billed for <span class=\"price\"><%=request.parameters.total%></span>.<p>\n<p>Your order will be shipped as soon as this store's <em>massive</em> security holes have been patched.</p>\n\n<% include('footer'); %>";
$.securityCourse.storePagePrototype.escape = $.utils.html.escape;
$.securityCourse.storePagePrototype.header = '<html>\n  <head>\n    <title>Security Store</title>\n    <link href="<%=request.hostUrl(\'static\')%>securitystore/style.css" rel="stylesheet" type="text/css" />\n    <script src="https://neil.fraser.name/securitystore/utils.js"></script>\n  </head>\n  <body>';
$.securityCourse.storePagePrototype.footer = '    <hr>\n    <div class="balls"><img src="https://dom-tutorials.appspot.com/static/google_balls.jpg" height=68 width=101></div>\n    <div class="footer">Google &copy; 2021</div>\n  </body>\n</html>';
$.securityCourse.www = '<%\nvar storeHosts = $.securityCourse.storeHosts;\nvar storeKey;\nfor (var key in storeHosts) {\n  if (Object.getOwnerOf(storeHosts[key]) === request.user) {\n    storeKey = key;\n    break;\n  }\n}\n\nif (request.method === \'POST\') {\n  if (request.parameters.create) {\n    (function create() {\n      setPerms(request.user);\n      new $.securityCourse.StoreHost();\n    }).call(this);\n  }\n  if (request.parameters.delete) {\n    (function del() {\n      setPerms(request.user);\n      storeHosts[request.parameters.delete].destroy();\n    }).call(this);\n  }\n  response.sendRedirect(\'securitycourse\');\n  return;\n}\nvar staticUrl = request.hostUrl(\'static\');\n%>\n<!doctype html>\n<html>\n  <head>\n  <title>engEDU Security Course</title>\n  <style>\n    body {\n      font-family: "Roboto Mono", monospace;\n    }\n    iframe {\n      border-style: solid 1px #ccc;\n      width: 100%;\n      height: 15em;\n    }\n    th {\n      text-align: left;\n    }\n    td {\n      padding-right: 1em;\n    }\n    .myRow {\n      font-weight: bold;\n    }\n  </style>\n  <link href="https://fonts.googleapis.com/css?family=Roboto+Mono" rel="stylesheet">\n  <link href="<%=staticUrl%>favicon.ico" rel="shortcut icon">\n  <link href="<%=staticUrl%>style/jfk.css" rel="stylesheet"> \n  </head>\n  <body>\n    <h1>engEDU Security Course</h1>\n    \n    <% if (!storeKey) { %>\n    <p>\n    <form method="post">\n      To join the course, click \n      <input type="submit" name="create" value="Create Store" class="jfk-button jfk-button-action">\n    </form>\n    </p>\n    <% } %>\n\n    <% if (Object.getOwnPropertyNames(storeHosts).length) { %>\n    <p>\n      <table>\n        <tr style="text-align:left">\n          <th colspan="2">Stores in this class</th>\n        </tr>\n        <%\n          for (var hostName in storeHosts) {\n            var storeName = storeHosts[hostName][\'/\'].name;\n        %>\n        <tr class="<%= hostName === storeKey ? \'myRow\' : \'\' %>">\n          <td><a href="<%= request.hostUrl(hostName) %>" target="_blank" rel="noopener">\n            <%= $.securityCourse.storePagePrototype.escape(storeName) %>\n          </a></td>\n          <td><a href="<%= request.hostUrl(\'code\') + \'?\' + encodeURIComponent(\'$.securityCourse.storeHosts.\' + hostName + "[\'/\']") %>" target="_blank" rel="noopener">Code</a><td>\n          <% if (hostName === storeKey) { %>\n          <td>\n            <form method="post" onsubmit="return confirm(\'Are you sure you want to delete your store?\')">\n              <button class="jfk-button" type="submit" name="delete" value=<%= JSON.stringify(hostName) %>>Delete</button>\n            </form>\n          </td>\n          <% } %>\n        </tr>\n        <% } %>\n      </table>\n    </p>\n    <% } %>\n    <p>\n      <iframe src="<%=request.hostUrl(\'code\')%>eval"></iframe>\n    </p>\n  </body>\n</html>';

$.securityCourse.storeHosts = (new 'Object.create')(null);

$.hosts.root['/securitycourse'] = $.securityCourse;

