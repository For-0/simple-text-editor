import { DBSchema, IDBPDatabase, openDB } from "idb/build/index";

export type AllowedMimeTypes = ("application/javascript" | "text/html" | "text/css" | "text/plain" | "text/x-python" | "unknown");
type DbFileMetadata = Pick<FileStore, "id" | "name" | "mimeType" | "lastModified" | "handle">;

interface EditorDBSchema extends DBSchema {
    files_meta: {
        key: string;
        value: DbFileMetadata;
        indexes: {
            lastModified: Date;
            mimeType: AllowedMimeTypes;
        }
    }
    files: {
        key: string;
        value: Blob;
    }
}

export const FILE_ICONS = {
    "application/javascript": new URL("icons/files/application-javascript.svg", import.meta.url),
    "text/html": new URL("icons/files/text-html.svg", import.meta.url),
    "text/css": new URL("icons/files/text-css.svg", import.meta.url),
    "text/plain": new URL("icons/files/text-plain.svg", import.meta.url),
    "text/x-python": new URL("icons/files/text-x-python.svg", import.meta.url),
    "unknown": new URL("icons/files/unknown.svg", import.meta.url)
};

export class FileStore {
    static db: IDBPDatabase<EditorDBSchema>;
    customName: string;
    mimeType: AllowedMimeTypes;
    lastModified: Date | null;
    id: string;
    handle?: FileSystemFileHandle;
    constructor({id, name, mimeType, lastModified, handle}: Omit<DbFileMetadata, "id"> & {id?: string}) {
        this.id = id ?? crypto.randomUUID();
        this.customName = name;
        this.mimeType = mimeType;
        this.lastModified = lastModified;
        this.handle = handle;
    }
    static async initDB() {
        this.db = await openDB<EditorDBSchema>("TextEditorDB", 2, {
            upgrade(db, oldVersion) {
                if (oldVersion === 1) {
                    // just delete the old object store
                    db.deleteObjectStore("files");
                    db.deleteObjectStore("files_meta");
                }
                const fileMetaStore = db.createObjectStore("files_meta", {
                    keyPath: "id",
                    autoIncrement: false
                });
                fileMetaStore.createIndex("lastModified", "lastModified");
                fileMetaStore.createIndex("mimeType", "mimeType");
                db.createObjectStore("files", {
                    autoIncrement: false
                });
            },
        });
    }
    /**
     * Get all of the stored files. Only retrievs metadata, not the contents
     */
    static async getAll(): Promise<FileStore[]> {
        const files = await FileStore.db.getAll("files_meta");
        return files.map(file => new this(file));
    }

    static async get(id: string) {
        const file = await FileStore.db.get("files_meta", id);
        return file ? new this(file) : null;
    }
    /**
     * @requiresUserGesture because we call requestPermission
     */
    async loadFile(mode: FileSystemPermissionMode = "read"): Promise<boolean> {
        if (!this.handle) return false; // we can't load a file handle if it's stored in the database as a blob
        const permission = await this.handle.requestPermission({mode});
        if (permission === "granted") {
            const file = await this.handle.getFile();
            // Override the current metadata with the new metadata
            this.mimeType = file.type as AllowedMimeTypes;
            this.lastModified = new Date(file.lastModified);
            return true;
        }
        return false;
    }
    /**
     * Get the contents of this file from the files object store
     * @requiresUserGesture
     */
    async getContents() {
        if (this.handle) {
            if (await this.loadFile()) {
                const file = await this.handle.getFile();
                return await file.text();
            }
        } else {
            const file = await FileStore.db.get("files", this.id);
            return file && await file.text();
        }
    }
    /**
     * Saves the contents of the file into a blob in the files object store
     * @param contents The contents of the file
     * @requiresUserGesture
     */
    async setContents(contents: string) {
        if (this.handle) {
            if (await this.loadFile("readwrite")) {
                const writable = await this.handle.createWritable();
                await writable.write(contents);
                await writable.close();
            }
        } else {
            const contentsBlob = new Blob([contents], {type: this.mimeType});
            await FileStore.db.put("files", contentsBlob, this.id);
        }
    }
    /**
     * Delete both the metadata and the contents of the file
     */
    async delete() {
        const deleteTx = FileStore.db.transaction(["files", "files_meta"], "readwrite");
        await deleteTx.objectStore("files").delete(this.id);
        await deleteTx.objectStore("files_meta").delete(this.id);
    }
    /**
     * Save the metadata of the file into the files_meta object store
     * @requiresUserGesture
     */
    async save() {
        await this.loadFile();
        await FileStore.db.put("files_meta", {name: this.name, mimeType: this.mimeType, lastModified: this.lastModified, id: this.id, handle: this.handle});
    }
    get name() {
        return this.handle?.name || this.customName;
    }
}
