import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

// Native side of "download / upload". Metro picks this file on iOS and
// Android and `backupFile.web.ts` on web, so neither bundle carries the
// other's APIs (expo-file-system in particular has no real web backend).

export type SaveResult = { status: "shared" } | { status: "cancelled" } | { status: "saved"; where: string };

/**
 * Writes the text to a file and hands it to the system share sheet, where
 * "Save to Files"/Drive/a messenger are all one tap away. Sharing rather than
 * writing straight to Downloads keeps this working without any storage
 * permission on every Android version.
 */
export async function saveTextFile(fileName: string, text: string): Promise<SaveResult> {
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });

  if (!(await Sharing.isAvailableAsync())) {
    // No share target at all (rare, mostly bare emulators): the file is still
    // written, so say where it is instead of pretending nothing happened.
    return { status: "saved", where: uri };
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    UTI: "public.json",
    dialogTitle: "Сохранить резервную копию",
  });
  return { status: "shared" };
}

/** Opens the system file picker. `null` means the user backed out. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Some file managers tag a .json as octet-stream or text/plain, so the
    // filter stays wide and the content check in parseBackupText does the
    // real gatekeeping.
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}
