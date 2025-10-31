import {Platform, PermissionsAndroid, Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
  ImagePickerResponse as RNImagePickerResponse,
} from 'react-native-image-picker';

// Image picker types
export interface ImagePickerResponse {
  uri: string;
  type?: string;
  name?: string;
  fileSize?: number;
}

// Request permissions for Android
async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera permission to take photos',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
}

async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs storage permission to access photos',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  }
  return true;
}

// Simple native image picker using native modules (fallback)
async function pickImageNative(
  fromCamera: boolean,
): Promise<ImagePickerResponse | null> {
  try {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.8 as const,
      maxWidth: 1024,
      maxHeight: 1024,
      includeBase64: false,
    };

    const result: RNImagePickerResponse = fromCamera
      ? await launchCamera(options)
      : await launchImageLibrary(options);

    if (result.didCancel) {
      console.log('User cancelled image picker');
      return null;
    }

    if (result.errorCode) {
      console.error('ImagePicker Error:', result.errorMessage);
      Alert.alert('Error', result.errorMessage || 'Failed to pick image');
      return null;
    }

    const asset = result.assets?.[0];
    if (!asset || !asset.uri) {
      console.error('No image selected');
      return null;
    }

    return {
      uri: asset.uri,
      type: asset.type || 'image/jpeg',
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      fileSize: asset.fileSize,
    };
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image');
    return null;
  }
}

export async function pickImage(
  fromCamera: boolean = false,
): Promise<ImagePickerResponse | null> {
  try {
    // Request permissions
    const hasPermission = fromCamera
      ? await requestCameraPermission()
      : await requestStoragePermission();

    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Camera/Storage permission is required to pick images',
      );
      return null;
    }

    return await pickImageNative(fromCamera);
  } catch (error) {
    console.error('Error in pickImage:', error);
    Alert.alert('Error', 'Failed to pick image');
    return null;
  }
}

export async function uploadImageToS3(
  uploadUrl: string,
  imageUri: string,
  fileType: string,
): Promise<boolean> {
  try {
    console.log('Uploading image to S3:', {uploadUrl, imageUri, fileType});

    // Read file data
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Upload to S3 using presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': fileType,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    console.log('Image uploaded successfully to S3');
    return true;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
}

// Get file info from URI
export function getFileInfo(uri: string): {
  name: string;
  type: string;
  extension: string;
} {
  const fileName = uri.split('/').pop() || 'image.jpg';
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';

  const mimeTypes: {[key: string]: string} = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return {
    name: fileName,
    type: mimeTypes[extension] || 'image/jpeg',
    extension,
  };
}

// Resize image (optional - requires additional library)
export async function resizeImage(
  uri: string,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
): Promise<string> {
  // For now, return original URI
  // In production, install react-native-image-resizer
  console.warn('Image resize not implemented, using original size');
  return uri;
}
