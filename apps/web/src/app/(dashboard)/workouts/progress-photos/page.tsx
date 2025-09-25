'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Camera,
  Upload,
  Trash2,
  Eye,
  Calendar,
  Filter,
  Grid3X3,
  List,
} from 'lucide-react';

interface ProgressPhoto {
  id: string;
  photo_type: string; // 'before', 'after', 'progress'
  photo_url: string;
  s3_key: string;
  taken_at: string;
  notes?: string;
  workout_session_id?: string;
}

const photoTypes = ['All', 'before', 'after', 'progress'];

export default function ProgressPhotosPage() {
  const user = useCurrentUser();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(
    null
  );

  // Filters and view
  const [selectedType, setSelectedType] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchPhotos();
  }, []);

  useEffect(() => {
    filterPhotos();
  }, [photos, selectedType]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getProgressPhotos();
      if (response && Array.isArray(response)) {
        // Transform API response if needed
        const transformedPhotos: ProgressPhoto[] = response.map(
          (photo: any) => ({
            id: photo.id || photo.ProgressPhotoId,
            photo_type: photo.photo_type || photo.PhotoType,
            photo_url: photo.photo_url || photo.PhotoUrl,
            s3_key: photo.s3_key || photo.S3Key,
            taken_at: photo.taken_at || photo.TakenAt,
            notes: photo.notes || photo.Notes,
          })
        );
        setPhotos(transformedPhotos);
      } else {
        setError('No progress photos found');
        setPhotos([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch progress photos:', e);
      setError(e.message || 'Failed to fetch progress photos');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPhotos = () => {
    let filtered = [...photos];

    if (selectedType !== 'All') {
      filtered = filtered.filter((photo) => photo.photo_type === selectedType);
    }

    // Sort by date (newest first)
    filtered.sort(
      (a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime()
    );

    setFilteredPhotos(filtered);
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this progress photo?'))
      return;

    try {
      await api.deleteProgressPhoto(photoId);
      setPhotos(photos.filter((p) => p.id !== photoId));
    } catch (e: any) {
      console.error('Failed to delete progress photo:', e);
      alert('Failed to delete progress photo');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'before':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'after':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'progress':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Progress Photos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your fitness transformation with progress photos
          </p>
        </div>
        <button
          onClick={() => alert('Photo upload feature coming soon!')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Camera className="h-4 w-4" />
          <span>Add Photo</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Camera className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Photos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {photos.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Upload className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Before Photos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {photos.filter((p) => p.photo_type === 'before').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Progress Photos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {photos.filter((p) => p.photo_type === 'progress').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Eye className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                After Photos
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {photos.filter((p) => p.photo_type === 'after').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and View Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {photoTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'All'
                    ? 'All Types'
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg ${
                viewMode === 'grid'
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg ${
                viewMode === 'list'
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Photos Display */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-12">
          <Camera className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No progress photos
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start documenting your fitness journey by adding your first photo.
          </p>
          <div className="mt-6">
            <button
              onClick={() => alert('Photo upload feature coming soon!')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
            >
              <Camera className="h-4 w-4" />
              <span>Add Photo</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Photo */}
              <div className="aspect-w-3 aspect-h-4 relative">
                <img
                  src={photo.photo_url}
                  alt={`${photo.photo_type} photo`}
                  className="w-full h-64 object-cover cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                />
                <div className="absolute top-2 left-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(photo.photo_type)}`}
                  >
                    {photo.photo_type}
                  </span>
                </div>
              </div>

              {/* Photo Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(photo.taken_at)}
                  </div>
                </div>

                {photo.notes && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                    {photo.notes}
                  </p>
                )}

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setSelectedPhoto(photo)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                  >
                    View
                  </button>
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPhotos.map((photo) => (
            <div
              key={photo.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start space-x-4">
                <img
                  src={photo.photo_url}
                  alt={`${photo.photo_type} photo`}
                  className="w-24 h-32 object-cover rounded-lg cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(photo.photo_type)}`}
                      >
                        {photo.photo_type}
                      </span>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(photo.taken_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {photo.notes && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">
                      {photo.notes}
                    </p>
                  )}

                  <button
                    onClick={() => setSelectedPhoto(photo)}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                  >
                    View full size
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo View Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(selectedPhoto.photo_type)}`}
                  >
                    {selectedPhoto.photo_type}
                  </span>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-1" />
                    {formatDate(selectedPhoto.taken_at)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="flex justify-center mb-4">
                <img
                  src={selectedPhoto.photo_url}
                  alt={`${selectedPhoto.photo_type} photo`}
                  className="max-w-full max-h-96 object-contain rounded-lg"
                />
              </div>

              {selectedPhoto.notes && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Notes
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {selectedPhoto.notes}
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    deletePhoto(selectedPhoto.id);
                    setSelectedPhoto(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                >
                  Delete Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
