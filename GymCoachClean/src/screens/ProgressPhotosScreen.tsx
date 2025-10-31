import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {useTheme} from '../theme';
import {Card, Button, LoadingSpinner} from '../components/common/UI';
import apiClient from '../services/api';
import {pickImage, uploadImageToS3, getFileInfo} from '../services/imageUpload';
import {ProgressPhoto} from '../types';
import {useTranslation} from 'react-i18next';

const {width} = Dimensions.get('window');
const IMAGE_SIZE = (width - 48) / 3; // 3 columns with spacing

export default function ProgressPhotosScreen() {
  const {colors, isDark} = useTheme();
  const {t} = useTranslation();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [weight, setWeight] = useState('');

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getProgressPhotos();
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading progress photos:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_load_progress_photos'),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPhotos();
  };

  const handleTakePhoto = async () => {
    setShowUploadModal(true);
  };

  const handleUploadPhoto = async (fromCamera: boolean = false) => {
    try {
      setUploading(true);

      // Pick image
      const image = await pickImage(fromCamera);
      if (!image) {
        setUploading(false);
        return;
      }

      // Get file info
      const fileInfo = getFileInfo(image.uri);

      // Get upload URL
      const uploadData = await apiClient.generateProgressPhotoUploadUrl(
        fileInfo.type,
        notes || undefined,
        weight ? parseFloat(weight) : undefined,
      );

      // Upload to S3
      await uploadImageToS3(uploadData.upload_url, image.uri, fileInfo.type);

      // Reload photos
      await loadPhotos();

      // Reset form
      setNotes('');
      setWeight('');
      setShowUploadModal(false);

      Alert.alert('Success', 'Progress photo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert(t('common.error'), t('common.errors.failed_to_upload_photo'));
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoPress = (photo: ProgressPhoto) => {
    setSelectedPhoto(photo);
    setShowDetailModal(true);
  };

  const handleDeletePhoto = async (photoId: string) => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to delete this progress photo?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteProgressPhoto(photoId);
              await loadPhotos();
              setShowDetailModal(false);
              Alert.alert('Success', 'Photo deleted successfully');
            } catch (error) {
              console.error('Error deleting photo:', error);
              Alert.alert(
                t('common.error'),
                t('common.errors.failed_to_delete_photo'),
              );
            }
          },
        },
      ],
    );
  };

  const handleUpdatePhoto = async () => {
    if (!selectedPhoto) return;

    try {
      await apiClient.updateProgressPhoto(selectedPhoto.id, {
        notes: notes || undefined,
        weight: weight ? parseFloat(weight) : undefined,
      });
      await loadPhotos();
      setShowDetailModal(false);
      setNotes('');
      setWeight('');
      Alert.alert('Success', 'Photo updated successfully');
    } catch (error) {
      console.error('Error updating photo:', error);
      Alert.alert(t('common.error'), t('common.errors.failed_to_update_photo'));
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.background}]}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.text}]}>
          Progress Photos
        </Text>
        <Button title="Add Photo" onPress={handleTakePhoto} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {photos.length === 0 ? (
          <Card>
            <Text style={[styles.emptyText, {color: colors.text}]}>
              No progress photos yet. Start tracking your transformation!
            </Text>
          </Card>
        ) : (
          <View style={styles.grid}>
            {photos.map(photo => (
              <Pressable
                key={photo.id}
                style={styles.photoContainer}
                onPress={() => handlePhotoPress(photo)}>
                <Image
                  source={{uri: photo.photoUrl}}
                  style={styles.photo}
                  resizeMode="cover"
                />
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoDate}>
                    {new Date(photo.date).toLocaleDateString()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
            <Text style={[styles.modalTitle, {color: colors.text}]}>
              Add Progress Photo
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Notes (optional)"
              placeholderTextColor={isDark ? '#888' : '#666'}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Weight (optional)"
              placeholderTextColor={isDark ? '#888' : '#666'}
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />

            <View style={styles.buttonRow}>
              <Button
                title="Take Photo"
                onPress={() => handleUploadPhoto(true)}
                disabled={uploading}
              />
              <Button
                title="Choose from Library"
                onPress={() => handleUploadPhoto(false)}
                disabled={uploading}
              />
            </View>

            <Button
              title="Cancel"
              onPress={() => setShowUploadModal(false)}
              variant="secondary"
            />

            {uploading && <LoadingSpinner />}
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
            {selectedPhoto && (
              <>
                <Image
                  source={{uri: selectedPhoto.photoUrl}}
                  style={styles.fullPhoto}
                  resizeMode="contain"
                />
                <Text style={[styles.photoDateDetail, {color: colors.text}]}>
                  {new Date(selectedPhoto.date).toLocaleDateString()}
                </Text>

                {selectedPhoto.weight && (
                  <Text style={[styles.photoInfo, {color: colors.text}]}>
                    Weight: {selectedPhoto.weight} kg
                  </Text>
                )}

                {selectedPhoto.notes && (
                  <Text style={[styles.photoInfo, {color: colors.text}]}>
                    {selectedPhoto.notes}
                  </Text>
                )}

                <View style={styles.buttonRow}>
                  <Button
                    title="Delete"
                    onPress={() => handleDeletePhoto(selectedPhoto.id)}
                    variant="secondary"
                  />
                  <Button
                    title="Close"
                    onPress={() => setShowDetailModal(false)}
                    variant="secondary"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  photoContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
  },
  photoDate: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    padding: 32,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    minHeight: 50,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    gap: 12,
  },
  fullPhoto: {
    width: '100%',
    height: 300,
    marginBottom: 16,
    borderRadius: 8,
  },
  photoDateDetail: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  photoInfo: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
});
