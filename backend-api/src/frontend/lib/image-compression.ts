const maxImageBytes = 5 * 1024 * 1024;
const maxAvatarSize = 512;
const avatarQuality = 0.82;

export async function compressProfileImage(file: File) {
  return compressImage(file);
}

export async function compressProductImage(file: File) {
  return compressImage(file);
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar JPG, PNG, WebP, atau GIF.");
  }
  if (file.size > maxImageBytes) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) {
    throw new Error("Gambar tidak valid atau rusak.");
  }

  const scale = Math.min(1, maxAvatarSize / width, maxAvatarSize / height);
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Browser tidak bisa memproses gambar ini.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(image, 0, 0, outputWidth, outputHeight);

  return canvas.toDataURL("image/jpeg", avatarQuality);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file gambar."));
    };
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gambar tidak bisa dibuka. Coba file lain."));
    image.src = src;
  });
}
