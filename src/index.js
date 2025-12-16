const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

function build({ entryFile, outputFolder }) {
  // 모듈 노드를 만들고,
  // 그 노드가 자기 dependencies를 다시 Module로 갖게 해서 트리/그래프처럼 만든다.
  const graph = createDependencyGraph(entryFile);

  //그 그래프를 하나(또는 여러 개) output file로 만든다.
  const outputFiles = bundle(graph);

  // 메모리 상에 만들어진 번들 코드를 실제 파일 시스템에 사용
  for (const outputFile of outputFiles) {
    fs.writeFileSync(
      path.join(outputFolder, outputFile.fileName),
      outputFile.content,
      "utf-8"
    );
  }
}

function createDependencyGraph(entryFile) {
  const rootModule = createModule(entryFile);
  return rootModule;
}

const MODULE_CACHE = new Map();

function createModule(filePath) {
  if (!MODULE_CACHE.has(filePath)) {
    const module = new Module(filePath);
    MODULE_CACHE.set(filePath, module);
    module.initDependencies();
  }
  return MODULE_CACHE.get(filePath);
}

class Module {
  constructor(filePath) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, "utf-8");
    this.ast = babel.parseSync(this.content);
    this.dependencies = this.findDependencies();
  }

  initDependencies() {}

  // import 문을 찾아서, 그 경로를 반환한다.
  findDependencies() {
    return this.ast.program.body
      .filter((node) => node.type === "ImportDeclaration")
      .map((relativePath) => resolveRequest(this.filePath, relativePath))
      .map((absolutePath) => createModule(absolutePath));
  }

  transformModuleInterface() {}
}

// resolving
function resolveRequest(requester, requestPath) {
  return path.join(path.dirname(requester), requestPath);
}

// bundling
function bundle(graph) {}
function collectModules(graph) {}
function toModuleMap(modules) {}
function addRuntime(moduleMap, entryPoint) {}
function trim(str) {}
build({});
