interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemDirectoryHandle {
  requestPermission?(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  keys(): AsyncIterableIterator<string>;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: "read" | "readwrite";
    id?: string;
    startIn?: FileSystemHandle | "desktop" | "documents" | "downloads";
  }): Promise<FileSystemDirectoryHandle>;
}
