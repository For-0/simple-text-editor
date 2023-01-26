import { openDB } from "idb";

export default class FileMetadata {
    /**
     * @param {Object} param0
     * @param {string} param0.name Unique file name without an extension
     * @param {("application/javascript"|"text/html"|"text/css"|"text/plain"|"text/x-python")} param0.mimeType Mimetype of the file
     * @param {Date} param0.lastModified The last modified date of the file
     * @param {Date} param0.created The date the file was created
     */
    constructor({name, mimeType, lastModified, created}) {
        this.name = name;
        this.mimeType = mimeType;
        this.lastModified = lastModified;
        this.created = created;
    }
    static FILE_ICONS = {
        "application/javascript": new URL("icons/files/application-javascript.svg", import.meta.url),
        "text/html": new URL("icons/files/text-html.svg", import.meta.url),
        "text/css": new URL("icons/files/text-css.svg", import.meta.url),
        "text/plain": new URL("icons/files/text-plain.svg", import.meta.url),
        "text/x-python": new URL("icons/files/text-x-python.svg", import.meta.url)
    }
    static async getDB() {
        return this.db || (this.db = await openDB("TextEditorDB", 1, {
            upgrade(db, oldVersion, newVersion) {
                if (oldVersion < 1 && newVersion === 1) {
                    const fileMetaStore = db.createObjectStore("files_meta", {
                        keyPath: "name",
                        autoIncrement: false
                    });
                    fileMetaStore.createIndex("lastModified", "lastModified");
                    fileMetaStore.createIndex("created", "created");
                    fileMetaStore.createIndex("mimeType", "mimeType");
                    db.createObjectStore("files", {
                        keyPath: "name",
                        autoIncrement: false
                    });
                }
            },
        }));
    }
    /**
     * Get all of the stored files. Only retrievs metadata, not the contents
     * @returns {Promise<FileMetadata[]>}
     */
    static async getAll() {
        const db = await this.getDB();
        const files = await db.getAll("files_meta");
        return files.map(file => new this(file));
    }

    static async get(filename) {
        const db = await this.getDB();
        const file = await db.get("files_meta", filename);
        return file ? new this(file) : null;
    }
    /**
     * Get the contents of this file from the files object store
     * @returns {Promise<string>}
     */
    async getContents() {
        const db = await FileMetadata.getDB();
        const file = await db.get("files", this.name);
        return file && await file.contentsBlob.text();
    }
    /**
     * Saves the contents of the file into a blob in the files object store
     * @param {string} contents The contents of the file
     */
    async setContents(contents) {
        const db = await FileMetadata.getDB();
        const contentsBlob = new Blob([contents], {type: this.mimeType});
        await db.put("files", {name: this.name, contentsBlob});
    }
    /**
     * Delete both the metadata and the contents of the file
     */
    async delete() {
        const db = await FileMetadata.getDB();
        const deleteTx = db.transaction(["files", "files_meta"], "readwrite");
        await deleteTx.objectStore("files").delete(this.name);
        await deleteTx.objectStore("files_meta").delete(this.name);
    }
    /**
     * Save the metadata of the file into the files_meta object store
     */
    async save() {
        const db = await FileMetadata.getDB();
        await db.put("files_meta", {name: this.name, mimeType: this.mimeType, lastModified: this.lastModified, created: this.created});
    }

    get filenameBase64() {
        return Buffer.from(this.name, 'utf8').toString('base64');
    }
}