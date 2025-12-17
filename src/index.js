const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");
const express = require("express");

function _build({ entryFile, htmlTemplatePath }) {
  // 모듈 노드를 만들고,
  // 그 노드가 자기 dependencies를 다시 Module로 갖게 해서 트리/그래프처럼 만든다.
  const graph = createDependencyGraph(entryFile);
  //그 그래프를 하나(또는 여러 개) output file로 만든다.
  const outputFiles = bundle(graph);

  outputFiles.push(generateHTMLTemplate(htmlTemplatePath, outputFiles));
  return { outputFiles, graph };
}

function build({ entryFile, outputFolder, htmlTemplatePath }) {
  const { outputFiles } = _build({ entryFile, htmlTemplatePath });

  // 메모리 상에 만들어진 번들 코드를 실제 파일 시스템에 사용 (output 폴더에 저장)
  for (const outputFile of outputFiles) {
    fs.writeFileSync(
      path.join(outputFolder, outputFile.fileName),
      outputFile.content,
      "utf-8"
    );
  }
}

function dev({ entryFile, htmlTemplatePath, devServerOptions = {} }) {
  const { outputFiles } = _build({ entryFile, htmlTemplatePath });

  // 데브는 여기 파일 쓰기 대신 메모리에서 서빙
  const outputFileMap = {};
  for (const outputFile of outputFiles) {
    outputFileMap[outputFile.fileName] = outputFile.content;
  }

  const indexHtml = outputFileMap["index.html"];

  // express 서버 생성
  const app = express();

  app.use((req, res) => {
    // '/bundle.js' -> 'bundle.js'
    const requestFile = req.path.slice(1);

    if (outputFileMap[requestFile]) {
      // 번들된 JS, CSS 등 요청 시 해당 콘텐츠 전송
      return res.send(outputFileMap[requestFile]);
    }
    // 그 외 모든 요청 → index.html 반환 (SPA 라우팅 지원)
    res.send(indexHtml);
  });

  app.listen(devServerOptions.port, () =>
    console.log(
      `Dev server starts at http://localhost:${devServerOptions.port}`
    )
  );
}

const END_BODY_TAG = "</body>";

function generateHTMLTemplate(htmlTemplatePath, outputFiles) {
  // 개발자가 제공한 index.html 템플릿을 문자열로 읽음.
  let htmlTemplate = fs.readFileSync(htmlTemplatePath, "utf-8");
  htmlTemplate = htmlTemplate.replace(
    END_BODY_TAG,
    // 번들링으로 생성된 모든 JS 파일(현재는 bundle.js 하나)을 <script src="/..."></script>로 변환.
    outputFiles
      .filter((file) => file.fileName.endsWith(".js"))
      .map(({ fileName }) => `<script src="/${fileName}"></script>`)
      .join("") + END_BODY_TAG
  );
  return { fileName: "index.html", content: htmlTemplate };
}

function createDependencyGraph(entryFile) {
  const rootModule = createModule(entryFile);
  return rootModule;
}

const MODULE_CACHE = new Map();

function createModule(filePath) {
  const MODULE_LOADERS = {
    ".css": CSSModule,
    ".js": JSModule,
  };

  // 그래프 순환 방지
  if (!MODULE_CACHE.has(filePath)) {
    const fileExtension = path.extname(filePath);
    const ModuleCls = MODULE_LOADERS[fileExtension];

    if (!ModuleCls) {
      throw new Error(`Unsupported extension "${fileExtension}".`);
    }

    const module = new ModuleCls(filePath);
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
  }

  initDependencies() {
    this.dependencies = this.findDependencies();
  }

  // import 문을 찾아서, 그 경로를 반환한다.
  findDependencies() {
    return this.ast.program.body
      .filter((node) => node.type === "ImportDeclaration")
      .map((node) => node.source.value)
      .map((relativePath) => resolveRequest(this.filePath, relativePath))
      .map((absolutePath) => createModule(absolutePath));
  }

  // 실제 바벨 코드임
  transformModuleInterface() {
    const { types: t } = babel;
    const { filePath } = this;
    const { ast, code } = babel.transformFromAstSync(this.ast, this.content, {
      ast: true,
      plugins: [
        function () {
          return {
            visitor: {
              ImportDeclaration(path) {
                const newIdentifier =
                  path.scope.generateUidIdentifier("imported");

                for (const specifier of path.get("specifiers")) {
                  const binding = specifier.scope.getBinding(
                    specifier.node.local.name
                  );
                  const importedKey = specifier.isImportDefaultSpecifier()
                    ? "default"
                    : specifier.get("imported.name").node;

                  for (const referencePath of binding.referencePaths) {
                    referencePath.replaceWith(
                      t.memberExpression(
                        newIdentifier,
                        t.stringLiteral(importedKey),
                        true
                      )
                    );
                  }
                }

                path.replaceWith(
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      newIdentifier,
                      t.callExpression(t.identifier("require"), [
                        t.stringLiteral(
                          resolveRequest(
                            filePath,
                            path.get("source.value").node
                          )
                        ),
                      ])
                    ),
                  ])
                );
              },
              ExportDefaultDeclaration(path) {
                path.replaceWith(
                  t.expressionStatement(
                    t.assignmentExpression(
                      "=",
                      t.memberExpression(
                        t.identifier("exports"),
                        t.identifier("default"),
                        false
                      ),
                      t.toExpression(path.get("declaration").node)
                    )
                  )
                );
              },
              ExportNamedDeclaration(path) {
                const declarations = [];
                if (path.has("declaration")) {
                  if (path.get("declaration").isFunctionDeclaration()) {
                    declarations.push({
                      name: path.get("declaration.id").node,
                      value: t.toExpression(path.get("declaration").node),
                    });
                  } else {
                    path
                      .get("declaration.declarations")
                      .forEach((declaration) => {
                        declarations.push({
                          name: declaration.get("id").node,
                          value: declaration.get("init").node,
                        });
                      });
                  }
                } else {
                  path.get("specifiers").forEach((specifier) => {
                    declarations.push({
                      name: specifier.get("exported").node,
                      value: specifier.get("local").node,
                    });
                  });
                }
                path.replaceWithMultiple(
                  declarations.map((decl) =>
                    t.expressionStatement(
                      t.assignmentExpression(
                        "=",
                        t.memberExpression(
                          t.identifier("exports"),
                          decl.name,
                          false
                        ),
                        decl.value
                      )
                    )
                  )
                );
              },
            },
          };
        },
      ],
    });
    this.ast = ast;
    this.content = code;
  }
}

class JSModule extends Module {}

class CSSModule {
  constructor(filePath) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, "utf-8");

    this.ast = null;
    this.dependencies = [];
  }

  initDependencies() {
    this.dependencies = this.findDependencies();
  }

  findDependencies() {
    return [];
  }

  transformModuleInterface() {
    const escapedCSS = this.content
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\${/g, "\\${");

    this.content = trim(`
      const content = \`${escapedCSS}\`;
      const style = document.createElement('style');
      style.type = 'text/css';
      if (style.styleSheet) style.styleSheet.cssText = content;
      else style.appendChild(document.createTextNode(content));
      document.head.appendChild(style);
    `);
  }
}

// resolving
function resolveRequest(requester, requestPath) {
  if (requestPath.startsWith(".")) {
    // 상대경로
    return path.join(path.dirname(requester), requestPath);
  } else {
    const requesterParts = requester.split("/");
    const requestPaths = [];
    for (let i = requesterParts.length - 1; i > 0; i--) {
      requestPaths.push(requesterParts.slice(0, i).join("/") + "/node_modules");
    }

    // 절대경로
    return require.resolve(requestPath, { paths: requestPaths });
  }
}

// bundling
function bundle(graph) {
  const modules = collectModules(graph);
  const moduleMap = toModuleMap(modules);
  const moduleCode = addRuntime(moduleMap, modules[0].filePath);

  return [{ fileName: "bundle.js", content: moduleCode }];
}

function collectModules(graph) {
  const modules = new Set();
  collect(graph, modules);
  return Array.from(modules);

  // DFS로 모듈을 수집한다.
  function collect(module, modules) {
    if (!modules.has(module)) {
      modules.add(module);
      module.dependencies.forEach((dependency) => collect(dependency, modules));
    }
  }
}

function toModuleMap(modules) {
  let moduleMap = "";
  moduleMap += "{";

  for (const module of modules) {
    module.transformModuleInterface();
    moduleMap += `"${module.filePath}": function(exports, require) { ${module.content}\n },`;
  }

  moduleMap += "}";
  return moduleMap;
}

function addRuntime(moduleMap, entryPoint) {
  return trim(`
      const modules = ${moduleMap};
      const entry = "${entryPoint}";

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
    `);
}

function trim(str) {
  const lines = str.split("\n").filter(Boolean);
  const padLength = lines[0].length - lines[0].trimLeft().length;
  const regex = new RegExp(`^\\s{${padLength}}`);
  return lines.map((line) => line.replace(regex, "")).join("\n");
}

/*** 모드 설정 ***/

const MODE =
  process.env.BUNDLER_MODE ||
  process.env.NODE_ENV ||
  process.argv[2] || // node src/index.js dev | build
  "development";

const baseOptions = {
  entryFile: path.join(__dirname, "../fixture/index.js"),
  htmlTemplatePath: path.join(__dirname, "index.html"),
};

if (MODE === "production" || MODE === "build") {
  // 프로덕션 빌드 모드: 파일을 output 폴더에 씀
  build({
    ...baseOptions,
    outputFolder: path.join(__dirname, "../output"),
  });
} else if (MODE === "development" || MODE === "dev") {
  dev({
    ...baseOptions,
    devServerOptions: {
      port: process.env.PORT ? Number(process.env.PORT) : 3000,
      host: process.env.HOST || "localhost",
    },
  });
} else {
  console.error(`Unknown MODE "${MODE}". Use "dev" or "build".`);
  process.exit(1);
}
