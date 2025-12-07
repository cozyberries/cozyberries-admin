// lib/cloudinary.ts
export const uploadImageToCloudinary = async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
    if (!cloudName || !preset) {
      throw new Error("Missing Cloudinary env vars (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or UPLOAD_PRESET).");
    }
  
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", preset);
  
    const resp = await fetch(url, {
      method: "POST",
      body: fd,
    });
  
    const data = await resp.json();

    if (!resp.ok) {
      const message = data.error?.message || JSON.stringify(data);
      throw new Error(`Cloudinary upload failed: ${message}`);
    }

    return data.secure_url as string;
  };
  