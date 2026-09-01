// Web build of the same two functions — a plain anchor download and a hidden
// file input. Kept so the app can be exercised in a browser (that is how the
// backup flow is regression-tested) without pulling in the native modules.

export type SaveResult = { status: "shared" } | { status: "cancelled" } | { status: "saved"; where: string };

export async function saveTextFile(fileName: string, text: string): Promise<SaveResult> {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cut the download short in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { status: "saved", where: fileName };
}

export async function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    // A cancelled picker fires no "change" event in most browsers, so the
    // promise would hang forever; "cancel" covers it where supported and the
    // window regaining focus is the fallback.
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      finish(file ? await file.text() : null);
    });
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}
