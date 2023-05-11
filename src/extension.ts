// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { dirname, join } from "path";
import { readFileSync } from "jsonfile";
import * as vscode from "vscode";
import { Project, SyntaxKind } from "ts-morph";
import { parse } from "comment-parser";

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

        const computedPropsType: string[] = [];
        const newProps: any[] = [];

        const imports = jsContent.getImportDeclarations();
        console.log(imports[0].getModuleSpecifierSourceFile());

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
                  .map((property) => {
                    computedPropsType.push(property?.getType()?.getText());
                    return property.getText()?.split(":")[0] || "";
                  })
                  .filter((property) => property) ?? [];

              item
                .asKindOrThrow(SyntaxKind.ClassDeclaration)
                .getPropertyOrThrow("properties")
                .getType()
                .getApparentType()
                .getProperties()
                .forEach((property, index) => {
                  const tempProperty = property
                    .getValueDeclaration()
                    ?.asKindOrThrow(SyntaxKind.PropertySignature);

                  const comment =
                    tempProperty
                      ?.getLeadingCommentRanges?.()?.[0]
                      ?.getText?.() || "";

                  const parsed = parse(comment, { spacing: "preserve" });
                  const commentObj = parsed[0];
                  const tagStr = commentObj?.tags
                    ?.map?.(
                      (tag) =>
                        `@${tag.tag} - ${tag.type} - ${
                          tag.description || "无"
                        }`,
                    )
                    ?.join("\n ");

                  newProps.push({
                    label: tempProperty?.getText()?.split(":")[0] || "",
                    detail: `
Properties属性
类型：${computedPropsType[index] || ""}
说明：
 ${commentObj?.description || ""}
 ${tagStr || ""}
                    `,
                    kind: vscode.CompletionItemKind.Property,
                  });
                });

              // const comments = item
              //   .asKindOrThrow(SyntaxKind.ClassDeclaration)
              //   .getPropertyOrThrow("properties")
              //   .getInitializerOrThrow()
              //   .asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
              //   .getPropertyOrThrow("name")
              //   .getLeadingCommentRanges();

              // console.log("comments: ", comments.length);
              // comments.forEach((item) => {
              //   console.log(item.getText());
              // });
              // console.log(
              //   item
              //     .asKindOrThrow(SyntaxKind.ClassDeclaration)
              //     .getPropertyOrThrow("properties")
              //     .getTrailingCommentRanges(),
              // );
            } catch (e) {
              console.error(e);
            }
          }
        });

        return Promise.resolve(newProps);
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
