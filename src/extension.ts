// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { dirname, join } from "path";
import { readFileSync } from "jsonfile";
import * as vscode from "vscode";
import { Project, SyntaxKind } from "ts-morph";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.languages.registerCompletionItemProvider(
    { scheme: "file", language: "wxml" },
    {
      provideCompletionItems(documentation, position) {
        // console.log("arguments: ", arguments);
        // console.log(
        //   "documentation: ",
        //   documentation.fileName,
        //   documentation.uri,
        // );
        const dir = dirname(documentation.fileName);
        const jsonFile = join(dir, "index.json");
        const componentConfig = readFileSync(jsonFile);
        const componentNameText = documentation.getText(
          new vscode.Range(
            new vscode.Position(position.line, 0),
            position.translate(0, -1),
          ),
        );
        const componentName = componentNameText.split("<")[1];

        if (!componentName || componentName?.startsWith("/")) {
          return;
        }

        const componentPath =
          componentConfig?.usingComponents?.[componentName] ?? "";
        const jsFile = join(dir, componentPath) + ".ts";
        const project = new Project();

        const jsContent = project.addSourceFileAtPath(jsFile);

        let props: string[] = [];

        jsContent.forEachChild((item) => {
          if (item.asKind(SyntaxKind.ClassDeclaration)) {
            try {
              props =
                item
                  .asKindOrThrow(SyntaxKind.ClassDeclaration)
                  .getPropertyOrThrow("properties")
                  .getInitializer()
                  ?.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
                  ?.getProperties()
                  .map((property) => property.getText()?.split(":")[0] || "")
                  .filter((property) => property) ?? [];
            } catch (e) {
              console.error(e);
            }
          }
        });

        return Promise.resolve(
          props.map((item) => ({
            label: item,
            detail: "属性",
            kind: vscode.CompletionItemKind.Property,
          })),
        );
      },
    },
    "<",
    " ",
    ":",
    "@",
    ".",
    "-",
    '"',
    "'",
    "/",
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
