/**
 * Fast conversion from base64 data URL to Blob using fetch API
 * ~40x faster than manual byte-by-byte conversion
 * @param dataUrl - The base64 data URL
 * @returns Promise with Blob
 */
export const base64ToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

/**
 * Check if a data URL is already compressed (JPEG format)
 * @param dataUrl - The data URL to check
 * @returns true if already JPEG compressed
 */
export const isAlreadyCompressed = (dataUrl: string): boolean => {
  return dataUrl.startsWith('data:image/jpeg');
};

/**
 * Compresses and resizes an image from a base64 data URL
 * @param dataUrl - The base64 data URL of the image
 * @param maxWidth - Maximum width in pixels (default: 1280)
 * @param maxHeight - Maximum height in pixels (default: 1280)
 * @param quality - JPEG quality 0-1 (default: 0.7)
 * @returns Promise with compressed base64 data URL
 */
export const compressImage = async (
  dataUrl: string,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.6
): Promise<string> => {
  // Fast skip: if already JPEG and fits size limit, skip canvas round-trip
  const approxKB = Math.round(dataUrl.length * 0.75 / 1024);
  if (dataUrl.startsWith('data:image/jpeg') && approxKB < 300) {
    console.log(`Image already small (${approxKB}KB), skipping compression`);
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        if (width > height) {
          width = maxWidth;
          height = maxWidth / aspectRatio;
        } else {
          height = maxHeight;
          width = maxHeight * aspectRatio;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // 'medium' is significantly faster than 'high' with minimal visual difference
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      const originalSize = dataUrl.length;
      const compressedSize = compressedDataUrl.length;
      console.log(`Compressed: ${(originalSize / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB`);

      resolve(compressedDataUrl);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

/**
 * Compresses an image file from an input element
 * @param file - The File object from an input element
 * @param maxWidth - Maximum width in pixels (default: 1280)
 * @param maxHeight - Maximum height in pixels (default: 1280)
 * @param quality - JPEG quality 0-1 (default: 0.7)
 * @returns Promise with compressed base64 data URL
 */
export const compressImageFile = async (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.6
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const dataUrl = e.target?.result as string;
        const compressed = await compressImage(dataUrl, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};
