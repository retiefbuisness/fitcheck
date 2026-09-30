// JS side of the local native module that wraps Google's on-device
// Gemini Nano (ML Kit GenAI Prompt API) and photo colour sampling.
// On devices/builds without the module (iOS, Expo Go) every call reports
// "unavailable" and the app falls back to the style rules engine.
import { requireOptionalNativeModule } from 'expo';

export type NanoStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface GenerateOptions {
  temperature?: number;
  topK?: number;
  maxOutputTokens?: number;
}

export interface DownloadProgressEvent {
  bytesDownloaded: number;
}

interface NativeFitcheckAi {
  getStatus(): Promise<NanoStatus>;
  download(): Promise<boolean>;
  generate(prompt: string, imageUri: string | null, options: GenerateOptions): Promise<string>;
  dominantColors(imageUri: string): Promise<string[]>;
  addListener(event: 'onDownloadProgress', listener: (e: DownloadProgressEvent) => void): { remove(): void };
}

const native = requireOptionalNativeModule<NativeFitcheckAi>('FitcheckAi');

export const isNativeModuleAvailable = native != null;

export async function getStatus(): Promise<NanoStatus> {
  if (!native) return 'unavailable';
  try {
    return await native.getStatus();
  } catch {
    return 'unavailable';
  }
}

export async function download(onProgress?: (bytes: number) => void): Promise<boolean> {
  if (!native) return false;
  const sub = onProgress
    ? native.addListener('onDownloadProgress', (e) => onProgress(e.bytesDownloaded))
    : null;
  try {
    return await native.download();
  } finally {
    sub?.remove();
  }
}

export async function generate(
  prompt: string,
  imageUri: string | null = null,
  options: GenerateOptions = {},
): Promise<string> {
  if (!native) throw new Error('On-device AI is not available on this phone.');
  return native.generate(prompt, imageUri, options);
}

// Returns up to two dominant colours (hex) from the centre of a photo.
export async function dominantColors(imageUri: string): Promise<string[]> {
  if (!native) return [];
  try {
    return await native.dominantColors(imageUri);
  } catch {
    return [];
  }
}
