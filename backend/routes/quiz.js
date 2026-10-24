const express = require('express');
const cloudinary = require('cloudinary').v2;
const router = express.Router();
require('dotenv').config();

// Configure multiple Cloudinary accounts
const cloudinaryConfigs = [];

// Assuming environment variables are CLOUDINARY_CLOUD_NAME_1, CLOUDINARY_API_KEY_1, CLOUDINARY_API_SECRET_1, etc.
// You can adjust this loop based on how many accounts you have or how you want to structure your .env
for (let i = 0; i <= 2; i++) { // Adjusted to match user's provided env vars (0, 1, 2)
  const suffix = i === 0 ? '' : i;
  const cloudName = process.env[`VITE_CLOUDINARY_CLOUD_NAME${suffix}`];
  const apiKey = process.env[`VITE_CLOUDINARY_API_KEY${suffix}`];
  const apiSecret = process.env[`VITE_CLOUDINARY_API_SECRET${suffix}`];

  if (cloudName && apiKey && apiSecret) {
    cloudinaryConfigs.push({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });
  }
}

// Helper function to extract public ID from Cloudinary URL
function extractPublicIdFromUrl(url) {
  if (!url) {
    console.warn('Attempted to extract public ID from null or undefined URL.');
    return null;
  }
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) {
    console.warn(`URL does not contain '/upload/': ${url}`);
    return null;
  }
  let publicIdPath = url.substring(uploadIndex + '/upload/'.length);
  // Remove transformations if present (e.g., /c_fill,w_100/)
  const transformationRegex = /^([a-z]_\w+,?)+\//; // Matches c_fill,w_100/
  if (transformationRegex.test(publicIdPath)) {
    publicIdPath = publicIdPath.replace(transformationRegex, '');
  }
  // Remove version number if present (e.g., v1234567890/)
  const versionRegex = /^v\d+\//;
  if (versionRegex.test(publicIdPath)) {
    publicIdPath = publicIdPath.replace(versionRegex, '');
  }
  // Remove file extension and any query parameters
  const publicId = publicIdPath.split('.')[0].split('?')[0].split('#')[0];

  if (publicId) {
    return publicId;
  } else {
    console.warn(`Could not extract public ID from URL after processing: ${url}`);
    return null;
  }
}

// Delete quiz with images
router.delete('/quiz/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { imageUrls } = req.body; // Array of image URLs from frontend

    console.log('Received DELETE request for quizId:', quizId);
    console.log('Received imageUrls:', imageUrls);

    // Input validation
    if (!quizId || typeof quizId !== 'string') {
      return res.status(400).json({ message: 'Invalid quizId provided.' });
    }

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ message: 'imageUrls must be a non-empty array.' });
    }

    const invalidUrls = imageUrls.filter(url => typeof url !== 'string' || !url.startsWith('http'));
    if (invalidUrls.length > 0) {
      return res.status(400).json({ message: 'One or more imageUrls are invalid or malformed.' });
    }
    
    // Extract public IDs from image URLs
    const publicIds = imageUrls
      .map(url => extractPublicIdFromUrl(url))
      .filter(Boolean);

    console.log('Extracted publicIds:', publicIds);
    
    // Delete images from Cloudinary if any exist
    let successfullyDeletedPublicIds = new Set();

    if (publicIds.length === 0) {
      console.log('No valid public IDs extracted from imageUrls. Skipping Cloudinary deletion.');
      return res.status(200).json({ success: true, message: 'No images to delete or invalid image URLs provided.' });
    }

    if (publicIds.length > 0) {
      for (const config of cloudinaryConfigs) {
        // Configure the global cloudinary object for the current account
        cloudinary.config({
          cloud_name: config.cloud_name,
          api_key: config.api_key,
          api_secret: config.api_secret
        });
        try {
          const deleteResult = await cloudinary.api.delete_resources(publicIds);
          console.log(`Cloudinary deletion attempt for account ${config.cloud_name} with publicIds:`, publicIds);
          console.log(`Cloudinary deletion result for ${config.cloud_name}:`, JSON.stringify(deleteResult, null, 2));

          // Add successfully deleted public IDs to the set
          for (const id of publicIds) {
            if (deleteResult.deleted && deleteResult.deleted[id] === 'deleted') {
              successfullyDeletedPublicIds.add(id);
            }
          }
        } catch (error) {
          console.warn(`Failed to delete from Cloudinary account ${config.cloud_name} for publicIds: ${publicIds.join(', ')}`, error.message);
          console.error('Cloudinary deletion error details:', error);
          // Continue to the next configuration if deletion fails for this one
        }
      }
    }
    
    // Check if all requested public IDs were successfully deleted across all accounts
    const allRequestedDeleted = publicIds.every(id => successfullyDeletedPublicIds.has(id));

    if (allRequestedDeleted) {
      res.json({ success: true, deletedImages: successfullyDeletedPublicIds.size });
    } else {
      const failedToDelete = publicIds.filter(id => !successfullyDeletedPublicIds.has(id));
      res.status(200).json({
        success: false,
        message: 'Some images could not be deleted.',
        deletedImages: successfullyDeletedPublicIds.size,
        failedImages: failedToDelete
      });
    }
    

  } catch (error) {
    console.error('Error deleting quiz images for quizId:', quizId, 'Error:', error);
    res.status(500).json({ error: 'Failed to delete images' });
  }
});

module.exports = router;