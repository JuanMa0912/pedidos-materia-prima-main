declare module "browser-image-compression" {
  export type Options = {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    maxIteration?: number;
    initialQuality?: number;
    fileType?: string;
  };

  export default function imageCompression(
    file: File,
    options?: Options
  ): Promise<File>;
}
