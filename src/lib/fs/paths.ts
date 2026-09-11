export function hostSlash(p: string): string {
  return String(p || "").replace(/\\/g, "/");
}

export function hostParent(p: string): string {
  const n = hostSlash(p).replace(/\/+$/, "");
  if (!n || n === "/") return "/";
  if (/^[A-Za-z]:$/.test(n)) return n + "/";
  const i = n.lastIndexOf("/");
  if (i <= 0) return "/";
  const parent = n.slice(0, i);
  if (/^[A-Za-z]:$/.test(parent)) return parent + "/";
  return parent || "/";
}

export function hostJoin(dir: string, name: string): string {
  const d = hostSlash(dir).replace(/\/+$/, "");
  const leaf = String(name).replace(/^[/\\]+/, "");
  if (/^[A-Za-z]:$/.test(d)) return `${d}/${leaf}`;
  if (!d || d === "/") return `/${leaf}`;
  return `${d}/${leaf}`;
}

export function hostBase(p: string): string {
  const n = hostSlash(p).replace(/\/+$/, "");
  if (/^[A-Za-z]:$/.test(n)) return n + "/";
  const i = Math.max(n.lastIndexOf("/"), n.lastIndexOf("\\"));
  return i >= 0 ? n.slice(i + 1) : n;
}

export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}
