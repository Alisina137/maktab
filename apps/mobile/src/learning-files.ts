import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { api } from "./api";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp"
};

/** Native Expo Go picker; uploaded bytes remain authenticated and school-scoped. */
export async function pickAndUploadLearningFile(accessToken: string) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED, copyToCacheDirectory: true, multiple: false
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0]!;
  if (asset.size && asset.size > 1_048_576) throw new Error("File must be 1 MB or smaller.");
  const ext = asset.name.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = asset.mimeType && ACCEPTED.includes(asset.mimeType) ? asset.mimeType : EXTENSIONS[ext];
  if (!mimeType || !ACCEPTED.includes(mimeType)) throw new Error("Only PDF and image files are supported.");
  const file = new File(asset.uri);
  if (file.size > 1_048_576) throw new Error("File must be 1 MB or smaller.");
  const base64 = await file.base64();
  const uploaded = await api.uploadLearningFile(accessToken, asset.name, mimeType, base64);
  return uploaded.file;
}

/** Never open an unprotected static URL: retrieve through the session API. */
export async function shareLearningFile(accessToken: string, fileId: string) {
  const result = await api.readLearningFile(accessToken, fileId);
  const safeName = result.file.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
  const destination = new File(Paths.cache, `maktab-${fileId}-${safeName}`);
  destination.create({ overwrite: true });
  destination.write(result.file.base64, { encoding: "base64" });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destination.uri, { mimeType: result.file.mimeType });
  } else {
    throw new Error("No compatible file viewer is installed.");
  }
}
