import { useCallback, useState } from "react";

export function useScreenshot() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImage, setIsImage] = useState<boolean>(false);

  const capture = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const img = await window.screenAPI.capture();
      setIsImage(true);
      setImage(img);
      return img;
    } catch (e) {
      setIsImage(false);
      setError("Screenshot failed");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    image,
    loading,
    error,
    capture,
    isImage,
    reset: () => setImage(null),
  };
}
