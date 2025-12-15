const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

function build({ entryFile, outputFolder }) {
  // 모듈 노드를 만들고,
  // 그 노드가 자기 dependencies를 다시 Module로 갖게 해서 트리/그래프처럼 만든다.
  const graph = createDependencyGraph(entryFile);

  //그 그래프를 하나(또는 여러 개) output file로 만든다.
  const outputFiles = bundle(graph);
}

function createDependencyGraph(entryFile) {
  const rootModule = createModule(entryFile);
  return rootModule;
}

const MODULE_CACHE = new Map();

function createModule(filePath) {
  if (!MODULE_CACHE.has(filePath)) {
  }
  return MODULE_CACHE.get(filePath);
}

class Module {}

// resolving

// bundling
