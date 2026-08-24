import { LoaderPinwheel, Monitor } from "lucide-react";

// import {LaptopMinimal, LoaderPinwheel } from "lucide-react";
export interface ScreenshotProps {
  image: string | null;
  loading?: boolean;
  error?: string | null;
  capture: () => Promise<string>;
  isImage?: boolean;
  reset?: () => void;
}

export default function Screenshot({ loading, capture, image, reset }: ScreenshotProps) {
  return (
    <div className="flex gap-3 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-all">
      {image ? (
        <button
          onClick={reset}
          className="flex gap-1 justify-center items-center px-2 py-1 rounded-sm"
        >
          Clear
        </button>
      ) : (
        <button onClick={capture} className="text-zinc-400 hover:text-white">
          {loading ? (
            <p className="flex gap-1 justify-center items-center px-2 py-1 rounded-sm">
              {/* <LaptopMinimal size={18} /> */}
              <LoaderPinwheel size={18} />
            </p>
          ) : (
            <p className="flex gap-2 justify-center items-center px-2 py-1 rounded-sm">
              {/* <LaptopMinimal size={18} /> */}
              <Monitor size={18} />
              <span className="text-white">Analyse</span>
            </p>
          )}
        </button>
      )}
    </div>
  );
}
//
