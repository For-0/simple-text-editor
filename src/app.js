import { EditorView, minimalSetup } from "codemirror";
import { StateEffect } from "@codemirror/state";
import { javascript } from "@codemirror/lang-javascript"
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { lineNumbers, highlightActiveLineGutter, highlightActiveLine, keymap } from "@codemirror/view";
import { foldGutter, indentOnInput, bracketMatching } from "@codemirror/language";
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
const codemirrorContainer = document.getElementById("codemirror-container");
const languageSelect = document.getElementById("select-choose-language");
const languageExtensions = [[], [html()], [css()], [javascript()], [python()]];
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
document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar-burger');
    navbar.addEventListener('click', () => {
        navbar.classList.toggle('is-active');
        document.querySelector("#main-navbar").classList.toggle('is-active');
    });
});
let editor = new EditorView({
    extensions: [...commonExtensions, ...languageExtensions[parseInt(languageSelect.value)]],
    parent: codemirrorContainer
});
languageSelect.addEventListener("change", () => {
    editor.dispatch({
        effects: StateEffect.reconfigure.of([...commonExtensions, ...languageExtensions[parseInt(languageSelect.value)]])
    });
})