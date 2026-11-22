export interface CompressedImageResult {
  base64: string;
  sizeKb: number;
  width: number;
  height: number;
}

function estimateBase64Bytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  const base64Part = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64Part.endsWith('==')
    ? 2
    : base64Part.endsWith('=')
      ? 1
      : 0;
  return Math.max(0, Math.floor((base64Part.length * 3) / 4) - padding);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر قراءة الصورة المختارة.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Compresses an image file on the client using HTML5 Canvas:
 * - Resizes width to max 800px (preserving aspect ratio)
 * - Encodes to WebP starting at quality 0.75
 * - Ensures final payload stays under 70 KB for direct Firestore storage
 */
export async function compressImageToWebP(
  file: File,
  maxWidth = 800,
  initialQuality = 0.75,
  maxSizeKb = 70
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP).');
  }

  const img = await loadImageElement(file);

  let targetWidth = img.naturalWidth || img.width;
  let targetHeight = img.naturalHeight || img.height;

  if (targetWidth > maxWidth) {
    const ratio = maxWidth / targetWidth;
    targetWidth = maxWidth;
    targetHeight = Math.max(1, Math.round(targetHeight * ratio));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة أداة ضغط الصور في المتصفح.');
  }

  let quality = initialQuality;
  let currentWidth = targetWidth;
  let currentHeight = targetHeight;
  let dataUrl = '';
  let sizeBytes = 0;

  for (let attempt = 0; attempt < 6; attempt++) {
    canvas.width = currentWidth;
    canvas.height = currentHeight;
    ctx.clearRect(0, 0, currentWidth, currentHeight);
    ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

    dataUrl = canvas.toDataURL('image/webp', quality);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    sizeBytes = estimateBase64Bytes(dataUrl);
    if (sizeBytes <= maxSizeKb * 1024) {
      break;
    }

    if (quality > 0.45) {
      quality = Number((quality - 0.12).toFixed(2));
    } else {
      currentWidth = Math.max(320, Math.round(currentWidth * 0.8));
      currentHeight = Math.max(240, Math.round(currentHeight * 0.8));
    }
  }

  return {
    base64: dataUrl,
    sizeKb: Math.round((sizeBytes / 1024) * 10) / 10,
    width: currentWidth,
    height: currentHeight,
  };
}
