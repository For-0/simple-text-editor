import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete/dist/index';
import { indentWithTab } from "@codemirror/commands/dist/index";
import { css } from "@codemirror/lang-css/dist/index";
import { html } from "@codemirror/lang-html/dist/index";
import { javascript } from "@codemirror/lang-javascript/dist/index";
import { python } from "@codemirror/lang-python/dist/index";
import { bracketMatching, foldGutter, indentOnInput } from "@codemirror/language/dist/index";
import { StateEffect } from "@codemirror/state/dist/index";
import { highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view/dist/index";
import { EditorView, minimalSetup } from "codemirror/dist/index";
import { FileStore, FILE_ICONS, AllowedMimeTypes } from "./db";

const codemirrorContainer = document.getElementById("codemirror-container")!;
const filePanel = document.getElementById("panel-files-list");
const filenameInput = document.getElementById("input-filename");
const filenameInputNative = filenameInput?.querySelector("input");
const filenameInputExtension = filenameInput?.querySelector<HTMLElement>(".button.is-static");
const btnSave = document.getElementById("btn-save-file");
const btnNew = document.getElementById("btn-create-new");
const btnOpenFilesystem = document.getElementById("btn-open-filesystem");
const languageSelect = <HTMLSelectElement>document.getElementById("select-choose-language");
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

const editor = new EditorView({
    extensions: [...commonExtensions, ...languageExtensions[languageSelect.value]],
    parent: codemirrorContainer
});

let currentFile: FileStore | null = null;

/**
 * @param file The file to create/update a panel row for
 * @param existingRow The row to replace with this one
 */
function createFileRow(file: FileStore, existingRow?: HTMLAnchorElement) {
    const row = document.createElement("a");
    row.dataset.id = file.id;
    row.classList.add("panel-block");
    let fileIcon = row.appendChild(document.createElement("span"));
    fileIcon.classList.add("panel-icon");
    let icon = fileIcon.appendChild(new Image(24, 24));
    icon.src = (FILE_ICONS[file.mimeType] || FILE_ICONS.unknown).href;
    row.appendChild(document.createTextNode(file.name));
    row.addEventListener("click", async e => {
        if (e.ctrlKey && confirm("Are you sure you want to remove this file?")) {
            await file.delete();
            row.remove();
            if (currentFile?.id === file.id) {
                currentFile = null;
                configureEditor("", "", "text/plain");
            }
        } else await openFile(file);
    });
    if (existingRow) existingRow.replaceWith(row);
    else filePanel?.appendChild(row);
    return row;
}

function configureEditor(filename: string, contents: string, mimeType: AllowedMimeTypes, allowEditingMetadata = true) {
    languageSelect.value = mimeType;
    languageSelect.dispatchEvent(new Event("change"));
    if (filenameInputNative) {
        filenameInputNative.value = filename;
        filenameInputNative.disabled = !allowEditingMetadata;
    }
    languageSelect.disabled = !allowEditingMetadata;
    // Set the editor contents
    editor.dispatch({
        changes: {
            from: 0,
            to: editor.state.doc.length,
            insert: contents
        }
    });
    // Set the active file in the file panel
    filePanel?.querySelector(".panel-block.is-active")?.classList.remove("is-active");
}

function refreshCurrentFilePanelItem() {
    if (!currentFile) return;
    const fileRow = filePanel?.querySelector<HTMLAnchorElement>(`.panel-block[data-id="${currentFile.id}"]`);
    filePanel?.querySelector(".panel-block.is-active")?.classList.remove("is-active");
    createFileRow(currentFile, fileRow ?? undefined).classList.add("is-active");
}

/**
 * @param file The file to open in the editor
 */
async function openFile(file: FileStore) {
    const contents = await file.getContents();
    if (!contents) return;
    currentFile = file;
    configureEditor(file.name, contents, file.mimeType, !file.handle); // If the file has a handle (it's stored in the filesystem), don't allow editing the metadata
    refreshCurrentFilePanelItem();
}

async function filterOutExistingFiles(files: FileSystemFileHandle[]) {
    const existingFileHandles = (await FileStore.getAll()).map(file => file.handle).filter(f => f) as FileSystemFileHandle[];
    const outFiles: FileSystemFileHandle[] = [];
    outerLoop: for (const file of files) {
        for (const existingFile of existingFileHandles) {
            if (await file.isSameEntry(existingFile)) continue outerLoop;
        }
        outFiles.push(file);
    }
    return outFiles;
}

function importFiles(files: FileSystemFileHandle[]) {
    return Promise.all(files.map(async fileHandle => {
        const file = await fileHandle.getFile();
        const storeObject = new FileStore({ handle: fileHandle, name: fileHandle.name, mimeType: file.type as AllowedMimeTypes, lastModified: new Date(file.lastModified) });
        await storeObject.save();
        return storeObject;
    }));
}

document.addEventListener('DOMContentLoaded', async() => {
    // Set up the navbar burger for mobile
    const navbar = document.querySelector('.navbar-burger');
    navbar?.addEventListener('click', () => {
        navbar?.classList.toggle('is-active');
        document.querySelector("#main-navbar")?.classList.toggle('is-active');
    });

    // List all files in the file panel
    await FileStore.initDB();
    const files = await FileStore.getAll()
    for (const file of files) createFileRow(file);

    // Event listeners
    languageSelect.addEventListener("change", () => {
        // Configure the syntax highlighting
        editor.dispatch({ effects: StateEffect.reconfigure.of([...commonExtensions, ...languageExtensions[languageSelect.value]])});
        if (filenameInputExtension) filenameInputExtension.innerText = `.${languageFileExts[languageSelect.value]}`;
    });
    btnNew?.addEventListener("click", () => {
        // Clear the editor
        currentFile = null;
        configureEditor("", "", "text/plain");
    });
    btnOpenFilesystem?.addEventListener("click", async () => {
        const fileHandles = await window.showOpenFilePicker({
            types: [...languageSelect.options].map(el => {
                return {
                    description: el.innerText,
                    accept: {[el.value]: `.${languageFileExts[el.value]}`}
                };
            }),
            multiple: true
        });
        const fileObjects = await importFiles(await filterOutExistingFiles(fileHandles));
        for (const file of fileObjects) createFileRow(file);

        // If the user opened a file while the editor was empty, open the first file they opened
        if (!currentFile && fileObjects.length > 0) openFile(fileObjects[0]);
    });
    btnSave?.addEventListener("click", async e => {
        if (!filenameInputNative?.reportValidity()) return;

        const shouldSaveToFilesystem = e.ctrlKey; // If the user pressed ctrl while clicking save, save the file to the filesystem rather than indexeddb

        if (currentFile) {
            // Update the file metadata
            currentFile.customName = filenameInputNative.value;
            currentFile.mimeType = languageSelect.value as AllowedMimeTypes;
            currentFile.lastModified = new Date();
        } else if (shouldSaveToFilesystem) {
            const mimeTypeText = languageSelect.selectedOptions[0].innerText;
            const handle = await window.showSaveFilePicker({
                types: [{
                    description: mimeTypeText,
                    accept: {[languageSelect.value]: `.${languageFileExts[languageSelect.value]}`}
                }],
                suggestedName: filenameInputNative.value
            });
            currentFile = new FileStore({
                name: handle.name,
                mimeType: languageSelect.value as AllowedMimeTypes,
                lastModified: new Date(),
                handle
            });
        } else {
            currentFile = new FileStore({
                name: filenameInputNative.value,
                mimeType: languageSelect.value as AllowedMimeTypes,
                lastModified: new Date()
            });
        }
        
        // Save to indexeddb (and possibly filesystem)
        await currentFile.save();
        await currentFile.setContents(editor.state.doc.toString());

        // Refresh the editor
        await openFile(currentFile);

        // Add a little animation to the save button
        const btnSaveIcon = btnSave.querySelector<HTMLElement>(".icon:nth-child(2)");
        if (!btnSaveIcon) return;
        btnSaveIcon.hidden = true;
        setTimeout(() => btnSaveIcon.hidden = false, 2000);
    });

    if ("launchQueue" in window && window.launchQueue) {
        // the app was launched from the filesystem
        window.launchQueue.setConsumer(async params => {
            if (params.files && params.files.length > 0) {
                const fileObjects = await importFiles(await filterOutExistingFiles(params.files.filter(file => file.kind === "file") as FileSystemFileHandle[]));
                for (const file of fileObjects) createFileRow(file);

                // If the user opened a file while the editor was empty, open the first file they opened
                if (!currentFile && fileObjects.length > 0) openFile(fileObjects[0]);
            }
        });
    }
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register(new URL("service-worker.ts", import.meta.url), { type: "module" });