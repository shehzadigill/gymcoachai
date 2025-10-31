import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {pickImage, uploadImageToS3} from '../../services/imageUpload';
import apiClient from '../../services/api';
import {t} from 'i18next';

interface ProfileImagePickerProps {
  currentImageUrl?: string;
  onImageUploaded: (imageUrl: string) => void;
  size?: number;
}

export const ProfileImagePicker: React.FC<ProfileImagePickerProps> = ({
  currentImageUrl,
  onImageUploaded,
  size = 120,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleImagePick = async () => {
    try {
      // Pick image from gallery or camera
      const result = await pickImage();

      if (result && result.uri) {
        const fileInfo = {
          uri: result.uri,
          type: result.type || 'image/jpeg',
        };
        await uploadImage(fileInfo.uri, fileInfo.type);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('common.errors.failed_to_pick_image'));
    }
  };

  const uploadImage = async (uri: string, mimeType: string) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Generate presigned URL
      const uploadResponse = await apiClient.generateUploadUrl(mimeType);
      const {upload_url, key} = uploadResponse;

      // Upload to S3
      await uploadImageToS3(upload_url, uri, mimeType);

      // Construct the public URL
      const uploadUrlObj = new URL(upload_url);
      const imageUrl = `${uploadUrlObj.protocol}//${uploadUrlObj.hostname}${uploadUrlObj.pathname}`;

      // Update profile with new image URL
      await apiClient.updateUserProfile({
        profileImageUrl: imageUrl,
        updatedAt: new Date().toISOString(),
      });

      onImageUploaded(imageUrl);
      Alert.alert('Success', 'Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(t('common.error'), t('common.errors.failed_to_upload_image'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.imageContainer, {width: size, height: size}]}
        onPress={handleImagePick}
        disabled={uploading}>
        {currentImageUrl ? (
          <Image
            source={{uri: currentImageUrl}}
            style={[styles.image, {width: size, height: size}]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, {width: size, height: size}]}>
            <Icon name="account" size={size * 0.5} color="#9ca3af" />
          </View>
        )}

        {uploading && (
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.uploadingText}>
              {Math.round(uploadProgress)}%
            </Text>
          </View>
        )}

        <View style={styles.cameraButton}>
          <Icon name="camera" size={20} color="#ffffff" />
        </View>
      </Pressable>

      <Pressable
        style={styles.changeButton}
        onPress={handleImagePick}
        disabled={uploading}>
        <Icon name="image-edit" size={16} color="#3b82f6" />
        <Text style={styles.changeButtonText}>
          {uploading ? 'Uploading...' : 'Change Photo'}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 20,
  },
  imageContainer: {
    borderRadius: 1000, // Large value for perfect circle
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    borderRadius: 1000,
  },
  placeholder: {
    borderRadius: 1000,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 1000,
  },
  uploadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
  },
  changeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
});
