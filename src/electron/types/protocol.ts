export type QluelyInput =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      text: string;
      image: {
        mimeType: string;
        base64: string;
      };
    }
  | {
      type: "mixed";
      text: string;
      image: {
        mimeType: string;
        base64: string;
      };
    };

export interface QluelyChunk {
  type: "text";
  text: string;
}

export interface QluelyError {
  message: string;
}
