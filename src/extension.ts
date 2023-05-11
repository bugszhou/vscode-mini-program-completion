import * as vscode from "vscode";
import Wxml from "./Completions/wxml";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.languages.registerCompletionItemProvider(
    { scheme: "file", language: "wxml" },
    new Wxml(),
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
