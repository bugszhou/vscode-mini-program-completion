import { existsSync } from "fs";
import { readFileSync } from "jsonfile";
import { dirname, join } from "path";
import { CallExpression, Project, SyntaxKind } from "ts-morph";
import { parse } from "comment-parser";
import * as vscode from "vscode";
import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionItemProvider,
  CompletionList,
  Position,
  ProviderResult,
  TextDocument,
} from "vscode";

export default class Wxml implements CompletionItemProvider {
  provideCompletionItems(
    documentation: TextDocument,
    position: Position,
    token: CancellationToken,
    context: CompletionContext,
  ): ProviderResult<CompletionItem[] | CompletionList<CompletionItem>> {
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
    const componentName = componentNameText.split("<")[1]?.split(" ")?.[0];

    const isMethod = documentation
      .getText(
        new vscode.Range(
          new vscode.Position(position.line, position.character),
          position.translate(0, -1),
        ),
      )
      .includes(":");

    const lastSpaceIndex = componentNameText.split("").lastIndexOf(" ");

    const typingText = documentation
      .getText(
        new vscode.Range(
          new vscode.Position(position.line, lastSpaceIndex),
          position.translate(0, 0),
        ),
      )
      ?.trim();

    if (!componentName || componentName?.startsWith("/")) {
      return;
    }

    const componentPath =
      componentConfig?.usingComponents?.[componentName] ?? "";
    const jsFile = join(dir, componentPath) + ".ts";

    if (!existsSync(jsFile)) {
      return;
    }

    const project = new Project();

    const jsContent = project.addSourceFileAtPath(jsFile);

    const computedPropsType: string[] = [];
    const newProps: any[] = [];
    const events: any[] = [];

    jsContent.forEachChild((item) => {
      if (item.asKind(SyntaxKind.ClassDeclaration)) {
        try {
          item
            .getChildrenOfKind(SyntaxKind.MethodDeclaration)
            .filter((func) =>
              func.getBodyOrThrow().getText().includes("triggerEvent"),
            )
            .forEach((func) => {
              const allExpression = func
                .getStatements()
                .filter((state) =>
                  state.getText()?.includes("this.triggerEvent"),
                )
                .map((state) => {
                  return state
                    .asKind(SyntaxKind.ExpressionStatement)
                    ?.getExpressionIfKind(SyntaxKind.CallExpression);
                });
              console.log(allExpression);

              allExpression.forEach((statement) => {
                events.push(getEvent(statement));
              });

              function getEvent(expression?: CallExpression) {
                const argumentsNodes = expression?.getArguments();

                const comment =
                  expression?.getLeadingCommentRanges()?.[0]?.getText() || "";

                const parsed = parse(comment, { spacing: "preserve" });
                const commentObj = parsed[0];
                const tagStr = commentObj?.tags
                  ?.map?.(
                    (tag) =>
                      `@${tag?.tag}${tag?.type ? ` - ${tag.type}` : ""}${
                        tag?.description ? ` - ${tag.description || ""}` : ""
                      }`,
                  )
                  ?.join("\n ");

                const eventName = (argumentsNodes?.[0]?.getText() || "")
                  .replace(/^(\"|\')/, "")
                  .replace(/(\"|\')$/, "");
                const dataType =
                  argumentsNodes?.[1]
                    ?.getType()
                    ?.getApparentType()
                    ?.getText() || "";

                const detail = new vscode.MarkdownString(`
- 自定义事件
- 数据类型：${dataType}
- 说明：\n
  ${commentObj?.description || ""}
  ${tagStr || ""}\n
`);
                detail.appendMarkdown(`[点击查看文件](${jsFile})`);
                detail.isTrusted = true;
                return {
                  label: eventName,
                  insertText:
                    typingText.length > 1 && /\:$/.test(typingText)
                      ? `${eventName}=""`
                      : ` catch:${eventName}=""`,
                  sortText: "_",
                  documentation: detail,
                  kind: vscode.CompletionItemKind.Method,
                };
              }
            });

          if (isMethod) {
            return;
          }

          item
            .asKindOrThrow(SyntaxKind.ClassDeclaration)
            .getPropertyOrThrow("properties")
            .getInitializer()
            ?.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
            ?.getProperties()
            .forEach((property) => {
              computedPropsType.push(property?.getType()?.getText());
            });

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
                tempProperty?.getLeadingCommentRanges?.()?.[0]?.getText?.() ||
                "";

              const parsed = parse(comment, { spacing: "preserve" });
              const commentObj = parsed[0];
              const tagStr = commentObj?.tags
                ?.map?.(
                  (tag) =>
                    `@${tag?.tag}${tag?.type ? ` - ${tag.type}` : ""}${
                      tag?.description ? ` - ${tag.description || ""}` : ""
                    }`,
                )
                ?.join("\n ");

              const detail = new vscode.MarkdownString(`
- 自定义事件
- 数据类型：${computedPropsType[index] || ""}
- 说明：\n
  ${commentObj?.description || ""}
  ${tagStr || ""}\n
`);
              detail.appendMarkdown(`[点击查看文件](${jsFile})`);
              detail.isTrusted = true;

              newProps.push({
                label: tempProperty?.getText()?.split(":")[0] || "",
                insertText: `${
                  tempProperty?.getText()?.split(":")[0] || ""
                }="{{  }}"`,
                documentation: detail,
                kind: vscode.CompletionItemKind.Property,
              });
            });
        } catch (e) {
          console.error(e);
        }
      }
    });

    return Promise.resolve([...newProps, ...events]);
  }
}
