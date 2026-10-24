import { uploadFileToCloudinary } from "./cloudinaryConfig";

export const uploadFile = async (file: File, uploadPreset: string) => {
  const response = await uploadFileToCloudinary(file, uploadPreset);
  return {
    downloadURL: response.secure_url,
    metadata: { fullPath: response.public_id, name: response.original_filename, contentType: response.resource_type, size: response.bytes },
  };
};