import { v2 as cloudinary } from "cloudinary";

interface CloudinaryConfig {
  cloud_name: string;
  api_key: string;
  api_secret: string;
  upload_preset: string;
}

const cloudinaryConfigs: CloudinaryConfig[] = [];

// Dynamically load Cloudinary credentials from environment variables
for (let i = 3; i <= 5; i++) { // Assuming suffixes 3, 4, 5 based on .env
  const cloud_name = import.meta.env[`VITE_CLOUDINARY_CLOUD_NAME${i}`];
  const api_key = import.meta.env[`VITE_CLOUDINARY_API_KEY${i}`];
  const api_secret = import.meta.env[`VITE_CLOUDINARY_API_SECRET${i}`];
  const upload_preset = import.meta.env[`VITE_CLOUDINARY_UPLOAD_PRESET${i}`];

  if (cloud_name && api_key && api_secret && upload_preset) {
    cloudinaryConfigs.push({
      cloud_name,
      api_key,
      api_secret,
      upload_preset,
    });
  }
}

let currentConfigIndex = 0;

export const uploadFileToCloudinary = async (file: File, folder: string) => {
  if (cloudinaryConfigs.length === 0) {
    throw new Error("No Cloudinary configurations found.");
  }

  const currentConfig = cloudinaryConfigs[currentConfigIndex];
  currentConfigIndex = (currentConfigIndex + 1) % cloudinaryConfigs.length; // Rotate to the next config

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", currentConfig.upload_preset);
  formData.append("folder", folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${currentConfig.cloud_name}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (response.ok) {
    return {
      downloadURL: data.secure_url,
      metadata: {
        fullPath: data.public_id,
        name: data.original_filename,
        contentType: data.resource_type,
        size: data.bytes,
      },
    };
  } else {
    throw new Error(data.error.message);
  }
};