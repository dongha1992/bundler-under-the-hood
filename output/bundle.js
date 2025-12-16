const modules = {"/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/index.js": function(exports, require) { const _imported = require("/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/add3.js");
const _imported2 = require("/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/add5.js");
exports.NUMBER_TO_ADD = 2;
const n = 1;
console.log(`add3(n) + NUMBER_TO_ADD :`, _imported["default"](n));
console.log(`add5(n) + NUMBER_TO_ADD :`, _imported2["default"](n)); },"/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/add3.js": function(exports, require) { const _imported = require("/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/index.js");
function add3(n) {
  return n + 3 + _imported["NUMBER_TO_ADD"];
}
exports.default = add3; },"/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/add5.js": function(exports, require) { const _imported = require("/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/index.js");
function add5(n) {
  return n + 5 + _imported["NUMBER_TO_ADD"];
}
exports.default = add5; },};
const entry = "/Users/dongha/Desktop/dongha/bundler/bundler-under-the-hood/fixture/index.js";
function webpackStart({ modules, entry }) {
  const moduleCache = {};
 const require = moduleName => {
  
  if (moduleCache[moduleName]) {
    return moduleCache[moduleName];
  }
  const exports = {};
  // 순환 의존성 방지
  moduleCache[moduleName] = exports;
    
  // 모듈 실행
  modules[moduleName](exports, require);
  return moduleCache[moduleName];
};
  // 실제 프로그램 시작
  require(entry);
}
webpackStart({ modules, entry });
    