import { useToast } from '@/components/ui/use-toast';

/**
 * Uploads a file to Cloudinary with multiple fallback options
 * @param file The file to upload
 * @param onSuccess Optional callback when upload succeeds
 * @param onError Optional callback when all upload attempts fail
 * @returns Promise with the upload result containing url and public_id
 */
const getResourceType = (fileType: string): string => {
  if (fileType.startsWith('image/')) {
    return 'image';
  } else if (fileType.startsWith('video/')) {
    return 'video';
  } else {
    return 'raw'; // For documents, audio, etc.
  }
};

export const uploadToCloudinary = async (
  file: File,
  onSuccess?: (result: { url: string; id: string }) => void,
  onError?: (error: Error) => void
): Promise<{ url: string; id: string } | null> => {
  const resourceType = getResourceType(file.type);
  // Try primary Cloudinary account
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await response.json();
    if (data.public_id) {
      const result = { url: data.secure_url, id: data.public_id };
      if (onSuccess) onSuccess(result);
      return result;
    } else {
      throw new Error(`Cloudinary upload failed: ${data.error ? data.error.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error uploading to primary Cloudinary account:", error);
    
    // Try first fallback
    try {
      console.log("Attempting first fallback upload for image:", file.name);
      const formData1 = new FormData();
      formData1.append('file', file);
      formData1.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET1);

      const response1 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME1}/${resourceType}/upload`, {
        method: 'POST',
        body: formData1,
      });
      
      const data1 = await response1.json();
      if (data1.public_id) {
        const result = { url: data1.secure_url, id: data1.public_id };
        if (onSuccess) onSuccess(result);
        return result;
      } else {
        throw new Error(`First fallback Cloudinary upload failed: ${data1.error ? data1.error.message : 'Unknown error'}`);
      }
    } catch (firstFallbackError) {
      console.error("Error during first fallback image upload:", firstFallbackError);
      
      // Try second fallback
      try {
        console.log("Attempting second fallback upload for image:", file.name);
        const formData2 = new FormData();
        formData2.append('file', file);
        formData2.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET2);

        const response2 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME2}/${resourceType}/upload`, {
          method: 'POST',
          body: formData2,
        });
        
        const data2 = await response2.json();
        if (data2.public_id) {
          const result = { url: data2.secure_url, id: data2.public_id };
          if (onSuccess) onSuccess(result);
          return result;
        } else {
          throw new Error(`Second fallback Cloudinary upload failed: ${data2.error ? data2.error.message : 'Unknown error'}`);
        }
      } catch (secondFallbackError) {
        console.error("Error during second fallback image upload:", secondFallbackError);
        
        // Try third fallback
        try {
          console.log("Attempting third fallback upload for image:", file.name);
          const formData3 = new FormData();
          formData3.append('file', file);
          formData3.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET3);

          const response3 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME3}/${resourceType}/upload`, {
            method: 'POST',
            body: formData3,
          });
          
          const data3 = await response3.json();
          if (data3.public_id) {
            const result = { url: data3.secure_url, id: data3.public_id };
            if (onSuccess) onSuccess(result);
            return result;
          } else {
            throw new Error(`Third fallback Cloudinary upload failed: ${data3.error ? data3.error.message : 'Unknown error'}`);
          }
        } catch (thirdFallbackError) {
          console.error("Error during third fallback image upload:", thirdFallbackError);
          
          // Try fourth fallback
          try {
            console.log("Attempting fourth fallback upload for image:", file.name);
            const formData4 = new FormData();
            formData4.append('file', file);
            formData4.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET4);

            const response4 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME4}/${resourceType}/upload`, {
              method: 'POST',
              body: formData4,
            });
            
            const data4 = await response4.json();
            if (data4.public_id) {
              const result = { url: data4.secure_url, id: data4.public_id };
              if (onSuccess) onSuccess(result);
              return result;
            } else {
              throw new Error(`Fourth fallback Cloudinary upload failed: ${data4.error ? data4.error.message : 'Unknown error'}`);
            }
          } catch (fourthFallbackError) {
            console.error("Error during fourth fallback image upload:", fourthFallbackError);
            
            // Try fifth fallback
            try {
              console.log("Attempting fifth fallback upload for image:", file.name);
              const formData5 = new FormData();
              formData5.append('file', file);
              formData5.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET5);

              const response5 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME5}/image/upload`, {
                method: 'POST',
                body: formData5,
              });
              
              const data5 = await response5.json();
              if (data5.public_id) {
                const result = { url: data5.secure_url, id: data5.public_id };
                if (onSuccess) onSuccess(result);
                return result;
              } else {
                throw new Error(`Fifth fallback Cloudinary upload failed: ${data5.error ? data5.error.message : 'Unknown error'}`);
              }
            } catch (fifthFallbackError) {
              console.error("Error during fifth fallback image upload:", fifthFallbackError);
              
              // Try sixth fallback
              try {
                console.log("Attempting sixth fallback upload for image:", file.name);
                const formData6 = new FormData();
                formData6.append('file', file);
                formData6.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET6);

                const response6 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME6}/image/upload`, {
                  method: 'POST',
                  body: formData6,
                });
                
                const data6 = await response6.json();
                if (data6.public_id) {
                  const result = { url: data6.secure_url, id: data6.public_id };
                  if (onSuccess) onSuccess(result);
                  return result;
                } else {
                  throw new Error(`Sixth fallback Cloudinary upload failed: ${data6.error ? data6.error.message : 'Unknown error'}`);
                }
              } catch (sixthFallbackError) {
                console.error("Error during sixth fallback image upload:", sixthFallbackError);
                
                // Try seventh fallback
                try {
                  console.log("Attempting seventh fallback upload for image:", file.name);
                  const formData7 = new FormData();
                  formData7.append('file', file);
                  formData7.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET7);

                  const response7 = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME7}/image/upload`, {
                    method: 'POST',
                    body: formData7,
                  });
                  
                  const data7 = await response7.json();
                  if (data7.public_id) {
                    const result = { url: data7.secure_url, id: data7.public_id };
                    if (onSuccess) onSuccess(result);
                    return result;
                  } else {
                    throw new Error(`Seventh fallback Cloudinary upload failed: ${data7.error ? data7.error.message : 'Unknown error'}`);
                  }
                } catch (seventhFallbackError) {
                  console.error("Error during seventh fallback image upload:", seventhFallbackError);
                  const finalError = new Error("All Cloudinary upload attempts failed");
                  if (onError) onError(finalError);
                  return null;
                }
              }
            }
          }
        }
      }
    }
  }
};