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
const filenameInput = document.getElementById("input-filename");
const filenameInputNative = filenameInput.querySelector("input");
const btnSave = document.getElementById("btn-save-file");
const btnNew = document.getElementById("btn-create-new");
const languageSelect = document.getElementById("select-choose-language");
const languageExtensions = {"text/plain": [], "text/html": [html()], "text/css": [css()], "application/javascript": [javascript()], "text/x-python": [python()]};
const languageFileExts = {"text/plain": "txt", "text/html": "html", "text/css": "css", "application/javascript": "js", "text/x-python": "py"};
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

/** @type {FileMetadata} */
let currentFile = null;

/**
 * @param {FileMetadata} file The file to create/update a panel row for
 * @param {HTMLAnchorElement?} existingRow The row to replace with this one
 */
function createFileRow(file, existingRow=null) {
    const row = document.createElement("a");
    row.dataset.filename = file.filenameBase64;
    row.classList.add("panel-block");
    let fileIcon = row.appendChild(document.createElement("span"));
    fileIcon.classList.add("panel-icon");
    let icon = fileIcon.appendChild(new Image(24, 24));
    icon.src = FileMetadata.FILE_ICONS[file.mimeType];
    row.appendChild(document.createTextNode(file.name));
    row.addEventListener("click", openFile.bind(this, file));
    if (existingRow) existingRow.replaceWith(row);
    else filePanel.appendChild(row);
    return row;
}

/**
 * @param {FileMetadata} file The file to open in the editor
 */
async function openFile(file) {
    const contents = await file.getContents();
    currentFile = file;
    languageSelect.value = file.mimeType;
    languageSelect.dispatchEvent(new Event("change"));
    filenameInput.querySelector("input").value = file.name;
    editor.dispatch({
        changes: {
            from: 0,
            to: editor.state.doc.length,
            insert: contents
        }
    });
    filePanel.querySelector(".panel-block.is-active")?.classList.remove("is-active");
    filePanel.querySelector(`.panel-block[data-filename="${file.filenameBase64}"]`)?.classList.add("is-active");
}

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar-burger');
    navbar.addEventListener('click', () => {
        navbar.classList.toggle('is-active');
        document.querySelector("#main-navbar").classList.toggle('is-active');
    });
    FileMetadata.getAll().then(async files => {
        for (const file of files) createFileRow(file);
        if (files.length > 0) await openFile(files[0]);
    });
    languageSelect.addEventListener("change", () => {
        editor.dispatch({ effects: StateEffect.reconfigure.of([...commonExtensions, ...languageExtensions[languageSelect.value]])});
        filenameInput.querySelector(".button.is-static").innerText = `.${languageFileExts[languageSelect.value]}`;
    });
    filenameInput.addEventListener("change", () => filenameInputNative.setCustomValidity(""));
    btnNew.addEventListener("click", () => {
        currentFile = null;
        languageSelect.value = "text/plain";
        languageSelect.dispatchEvent(new Event("change"));
        filenameInput.querySelector("input").value = "";
        editor.dispatch({
            changes: {
                from: 0,
                to: editor.state.doc.length,
                insert: ""
            }
        });
        filePanel.querySelector(".panel-block.is-active")?.classList.remove("is-active");
    });
    btnSave.addEventListener("click", async () => {
        filenameInputNative.setCustomValidity("");
        if (!filenameInputNative.reportValidity()) return;
        let filenameChanged = currentFile?.name !== filenameInputNative.value;
        let possibleExistingFile = await FileMetadata.get(filenameInputNative.value);
        if (filenameChanged && possibleExistingFile) {
            filenameInputNative.setCustomValidity("A file with that name already exists");
            return filenameInputNative.reportValidity();
        }
        if (currentFile) {
            currentFile.name = filenameInputNative.value;
            currentFile.mimeType = languageSelect.value;
            currentFile.lastModified = new Date();
        } else currentFile = new FileMetadata({ name: filenameInputNative.value, mimeType: languageSelect.value, lastModified: new Date(), created: new Date() });
        let fileRow = filePanel.querySelector(`.panel-block[data-filename="${currentFile.filenameBase64}"]`);
        filePanel.querySelector(".panel-block.is-active")?.classList.remove("is-active");
        createFileRow(currentFile, fileRow).classList.add("is-active");
        await currentFile.save();
        await currentFile.setContents(editor.state.doc.toString());
        btnSave.querySelector("i").innerText = "done";
        setTimeout(() => btnSave.querySelector("i").innerText = "save", 2000);
    });
});