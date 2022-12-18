import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { indentWithTab } from "@codemirror/commands";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { bracketMatching, foldGutter, indentOnInput } from "@codemirror/language";
import { StateEffect } from "@codemirror/state";
import { highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { EditorView, minimalSetup } from "codemirror";
import FileMetadata from "./db";
const codemirrorContainer = document.getElementById("codemirror-container");
const filePanel = document.getElementById("panel-files-list");
const languageSelect = document.getElementById("select-choose-language");
const languageExtensions = {"text/plain": [], "text/html": [html()], "text/css": [css()], "application/javascript": [javascript()], "text/x-python": [python()]};
const commonExtensions = [minimalSetup,
    lineNumbers(),
    highlightActiveLineGutter(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    highlightActiveLine(),
    keymap.of([
        ...closeBracketsKeymap,
        ...completionKeymap,
        indentWithTab
    ])
];

let editor = new EditorView({
    extensions: [...commonExtensions, ...languageExtensions[languageSelect.value]],
    parent: codemirrorContainer
});

/**
 * @param {FileMetadata} file The file to create a panel row for
 */
function createFileRow(file) {
    const row = document.createElement("a");
    row.classList.add("panel-block");
    let fileIcon = row.appendChild(document.createElement("span"));
    fileIcon.classList.add("panel-icon");
    let icon = fileIcon.appendChild(new Image(24, 24));
    icon.src = FileMetadata.FILE_ICONS[file.mimeType];
    row.appendChild(document.createTextNode(file.name));
    row.addEventListener("click", async () => {
        const contents = await file.getContents();
        languageSelect.value = file.mimeType;
        editor.dispatch({
            effects: StateEffect.reconfigure.of([...commonExtensions, ...languageExtensions[file.mimeType]])
        });
        editor.dispatch({
            changes: {
                from: 0,
                to: editor.state.doc.length,
                insert: contents
            }
        });
    });
    return row;
}

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar-burger');
    navbar.addEventListener('click', () => {
        navbar.classList.toggle('is-active');
        document.querySelector("#main-navbar").classList.toggle('is-active');
    });
    FileMetadata.getAll().then(files => {
        for (const file of files) filePanel.appendChild(createFileRow(file));
    });
    languageSelect.addEventListener("change", () => {
        editor.dispatch({
            effects: StateEffect.reconfigure.of([...commonExtensions, ...languageExtensions[languageSelect.value]])
        });
    });    
});
console.log(FileMetadata);