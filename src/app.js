import { EditorView, basicSetup } from "codemirror"
import { javascript } from "@codemirror/lang-javascript"
const codemirrorContainer = document.getElementById("codemirror-container");

document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.querySelector('.navbar-burger');
    navbar.addEventListener('click', () => {
        navbar.classList.toggle('is-active');
        document.querySelector("#main-navbar").classList.toggle('is-active');
    });
});
let editor = new EditorView({
    extensions: [basicSetup, javascript()],
    parent: codemirrorContainer
});