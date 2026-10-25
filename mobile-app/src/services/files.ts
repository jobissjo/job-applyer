import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { API_BASE_URL, getAuthToken } from "./http";
import { resumesApi } from "./api";
import type { Resume } from "@/types";

export async function pickResume() {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  return result.canceled ? null : result.assets[0];
}
export async function uploadResume(
  asset: DocumentPicker.DocumentPickerAsset,
  title: string,
  ids: number[],
) {
  const body = new FormData();
  body.append("title", title.trim());
  body.append("job_title_ids", ids.join(","));
  if (Platform.OS === "web" && asset.file)
    body.append("file", asset.file, asset.name);
  else
    body.append("file", {
      uri: asset.uri,
      name: asset.name,
      type:
        asset.mimeType ||
        (asset.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    } as unknown as Blob);
  return resumesApi.upload(body);
}
export async function shareResume(resume: Resume) {
  if (Platform.OS === "web") {
    const blob = await resumesApi.download(resume.id);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = resume.file_name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const token = getAuthToken();
  if (!token) throw new Error("Please sign in again.");
  const filename = resume.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const file = await File.downloadFileAsync(
    `${API_BASE_URL}/resumes/${resume.id}/download`,
    new File(Paths.cache, `${resume.id}-${filename}`),
    { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
  );
  try {
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri);
    else await file.preview();
  } finally {
    if (file.exists) file.delete();
  }
}
