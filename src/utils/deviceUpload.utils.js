const URL_PATTERN = /^https?:\/\//i;

export const hasUrlValue = (value) => {
  if (!value) return false;
  if (typeof value === "string") return URL_PATTERN.test(value.trim());
  if (Array.isArray(value)) return value.some(hasUrlValue);
  if (typeof value === "object") return Object.values(value).some(hasUrlValue);
  return false;
};

export const rejectPastedMediaUrls = (res, fields = {}) => {
  const blockedFields = Object.entries(fields)
    .filter(([, value]) => hasUrlValue(value))
    .map(([key]) => key);

  if (blockedFields.length === 0) return false;

  res.status(400).json({
    success: false,
    message: "Upload files from the device instead of submitting media URLs.",
    data: { blockedFields },
  });
  return true;
};

const inferAttachmentType = (file = {}) => {
  const mimeType = String(file.mimeType || "").toLowerCase();
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "voice";
  return "image";
};

export const uploadedFileUrls = (req) => (
  Array.isArray(req.imageUrls) ? req.imageUrls : []
);

export const uploadedMessageAttachments = (req) => (
  Array.isArray(req.uploadedFiles) ? req.uploadedFiles : []
).map((file) => ({
  type: inferAttachmentType(file),
  url: file.url,
  mimeType: file.mimeType,
  sizeBytes: file.sizeBytes,
}));
