export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface UploadArtifactFileOptions {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a file's bytes directly to the pre-signed S3 URL returned by
 * `api.artifacts.create()`. This request goes straight to S3, bypassing the
 * `/api/keygen` proxy — the pre-signed URL carries its own auth, and per Keygen's
 * docs, replaying our Authorization header cross-origin causes S3 to reject the
 * request. Uses XMLHttpRequest rather than fetch because only XHR exposes
 * upload progress events.
 */
export function uploadArtifactFile(
  file: File,
  uploadUrl: string,
  options: UploadArtifactFileOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress!({ loaded: event.loaded, total: event.total });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload was cancelled'));

    if (options.signal) {
      if (options.signal.aborted) {
        reject(new Error('Upload was cancelled'));
        return;
      }
      options.signal.addEventListener('abort', () => xhr.abort());
    }

    xhr.send(file);
  });
}
