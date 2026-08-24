export function parseDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
} | null {
  if (!dataUrl.startsWith("data:")) {
    return null;
  }

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}
