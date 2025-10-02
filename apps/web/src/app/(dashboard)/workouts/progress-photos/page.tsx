'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  Download,
  Share2,
  // Compare (not available in lucide-react, using TrendingUp instead)
  TrendingUp,
  BarChart3,
  Star,
  Tag,
  Edit3,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Heart,
  MessageCircle,
  Clock,
  Target,
  Award,
  Zap,
  Activity,
  Image as ImageIcon,
  Calendar as CalendarIcon,
  Users,
  Lightbulb,
  Sparkles,
} from 'lucide-react';

interface ProgressPhoto {
  id: string;
  photo_type: string;
  photo_url: string;
  s3_key: string;
  taken_at: string;
  notes?: string;
  workout_session_id?: string;
  tags: string[];
  metadata?: PhotoMetadata;
  created_at: string;
  updated_at: string;
}

interface PhotoMetadata {
  file_size?: number;
  dimensions?: { width: number; height: number };
  device_info?: string;
  location?: string;
}

interface ProgressPhotoAnalytics {
  total_photos: number;
  photos_by_type: Record<string, number>;
  photos_by_month: MonthlyPhotoCount[];
  upload_frequency: PhotoUploadFrequency;
  consistency_score: number;
  transformation_insights: TransformationInsights;
}

interface MonthlyPhotoCount {
  month: string;
  count: number;
  types: Record<string, number>;
}

interface PhotoUploadFrequency {
  daily_average: number;
  weekly_average: number;
  monthly_average: number;
  longest_streak: number;
  current_streak: number;
}

interface TransformationInsights {
  total_duration_days: number;
  milestone_photos: MilestonePhoto[];
  progress_indicators: ProgressIndicator[];
}

interface MilestonePhoto {
  photo_id: string;
  milestone_type: string;
  date: string;
  significance: string;
}

interface ProgressIndicator {
  indicator_type: string;
  value: number;
  description: string;
  trend: string;
}

interface PhotoTimelineEntry {
  date: string;
  photos: ProgressPhoto[];
  week_number: number;
  month_name: string;
  days_since_start: number;
  workout_context?: {
    sessions_that_week: number;
    primary_focus?: string;
    achievements: string[];
  };
}

const photoTypes = [
  'All',
  'before',
  'progress',
  'after',
  'front',
  'side',
  'back',
];
const timeRanges = ['7d', '30d', '90d', '6m', '1y', 'all'];

export default function AdvancedProgressPhotosPage() {
  const user = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<ProgressPhoto[]>([]);
  const [analytics, setAnalytics] = useState<ProgressPhotoAnalytics | null>(
    null
  );
  const [timeline, setTimeline] = useState<PhotoTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI State
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(
    null
  );
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<
    'grid' | 'list' | 'timeline' | 'comparison'
  >('grid');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState('1y');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Upload state
  const [uploadData, setUploadData] = useState({
    photo_type: 'progress',
    notes: '',
    tags: [] as string[],
    file: null as File | null,
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'type' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, selectedTimeRange]);

  useEffect(() => {
    filterPhotos();
  }, [photos, selectedType, searchQuery, sortBy, sortOrder]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [photosData, analyticsData, timelineData] = await Promise.all([
        api.getProgressPhotos(undefined, {
          photo_type: selectedType !== 'All' ? selectedType : undefined,
          limit: 100,
        }),
        api.getProgressPhotoAnalytics(undefined, selectedTimeRange),
        api.getProgressPhotoTimeline(
          undefined,
          selectedType !== 'All' ? selectedType : undefined
        ),
      ]);

      if (photosData && Array.isArray(photosData)) {
        // Transform API response to match interface
        const transformedPhotos: ProgressPhoto[] = photosData.map(
          (photo: any) => ({
            id: photo.id || photo.ProgressPhotoId,
            photo_type: photo.photo_type || photo.PhotoType,
            photo_url: photo.photo_url || photo.PhotoUrl,
            s3_key: photo.s3_key || photo.S3Key,
            taken_at: photo.taken_at || photo.TakenAt,
            notes: photo.notes || photo.Notes,
            workout_session_id: photo.workout_session_id,
            tags: photo.tags || [],
            metadata: photo.metadata,
            created_at: photo.created_at || photo.taken_at,
            updated_at: photo.updated_at || photo.taken_at,
          })
        );
        setPhotos(transformedPhotos);
      } else {
        setPhotos([]);
      }

      setAnalytics(analyticsData);
      setTimeline(timelineData || []);
    } catch (e: any) {
      console.error('Failed to fetch progress photos data:', e);
      setError(e.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const filterPhotos = useCallback(() => {
    let filtered = [...photos];

    // Type filter
    if (selectedType !== 'All') {
      filtered = filtered.filter((photo) => photo.photo_type === selectedType);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (photo) =>
          photo.notes?.toLowerCase().includes(query) ||
          photo.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          photo.photo_type.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.taken_at).getTime();
          bValue = new Date(b.taken_at).getTime();
          break;
        case 'type':
          aValue = a.photo_type;
          bValue = b.photo_type;
          break;
        case 'name':
          aValue = a.notes || '';
          bValue = b.notes || '';
          break;
        default:
          aValue = new Date(a.taken_at).getTime();
          bValue = new Date(b.taken_at).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredPhotos(filtered);
  }, [photos, selectedType, searchQuery, sortBy, sortOrder]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadData((prev) => ({ ...prev, file }));
      setShowUploadModal(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadData.file) return;

    try {
      setIsUploading(true);
      const result = await api.uploadProgressPhoto({
        photo_type: uploadData.photo_type,
        file: uploadData.file,
        notes: uploadData.notes || undefined,
      });

      if (result) {
        await fetchAllData(); // Refresh data
        setShowUploadModal(false);
        setUploadData({
          photo_type: 'progress',
          notes: '',
          tags: [],
          file: null,
        });
      }
    } catch (e: any) {
      console.error('Upload failed:', e);
      setError(e.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      // Find the photo to get its taken_at timestamp
      const photo = photos.find((p) => p.id === photoId);
      if (!photo) {
        throw new Error('Photo not found');
      }

      await api.deleteProgressPhoto(photoId, photo.taken_at);
      await fetchAllData();
    } catch (e: any) {
      console.error('Delete failed:', e);
      setError(e.message || 'Delete failed');
    }
  };

  const handlePhotoSelect = (photoId: string) => {
    setSelectedPhotos((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedPhotos.length} photos?`)) return;

    try {
      await Promise.all(
        selectedPhotos.map((id) => {
          const photo = photos.find((p) => p.id === id);
          if (!photo) throw new Error(`Photo ${id} not found`);
          return api.deleteProgressPhoto(id, photo.taken_at);
        })
      );
      await fetchAllData();
      setSelectedPhotos([]);
    } catch (e: any) {
      console.error('Bulk delete failed:', e);
      setError(e.message || 'Bulk delete failed');
    }
  };

  const handleComparePhotos = async () => {
    if (selectedPhotos.length < 2) return;

    try {
      const comparison = await api.getProgressPhotoComparison(selectedPhotos);
      // Handle comparison result - could show in modal or new view
      console.log('Comparison result:', comparison);
    } catch (e: any) {
      console.error('Comparison failed:', e);
      setError(e.message || 'Comparison failed');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPhotoTypeIcon = (type: string) => {
    switch (type) {
      case 'before':
        return <Star className="h-4 w-4 text-blue-500" />;
      case 'after':
        return <Award className="h-4 w-4 text-green-500" />;
      case 'progress':
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      case 'front':
        return <Users className="h-4 w-4 text-orange-500" />;
      case 'side':
        return <Activity className="h-4 w-4 text-pink-500" />;
      case 'back':
        return <Target className="h-4 w-4 text-indigo-500" />;
      default:
        return <ImageIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConsistencyColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'before':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'after':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'progress':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'front':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'side':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400';
      case 'back':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400';
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

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
          onClick={() => fileInputRef.current?.click()}
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
              onClick={() => fileInputRef.current?.click()}
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
                    onClick={() => handleDeletePhoto(photo.id)}
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
                      onClick={() => handleDeletePhoto(photo.id)}
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
                    handleDeletePhoto(selectedPhoto.id);
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Upload Progress Photo
            </h2>

            {uploadData.file && (
              <div className="mb-4">
                <img
                  src={URL.createObjectURL(uploadData.file)}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photo Type
                </label>
                <select
                  value={uploadData.photo_type}
                  onChange={(e) =>
                    setUploadData((prev) => ({
                      ...prev,
                      photo_type: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="progress">Progress</option>
                  <option value="before">Before</option>
                  <option value="after">After</option>
                  <option value="front">Front</option>
                  <option value="side">Side</option>
                  <option value="back">Back</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={uploadData.notes}
                  onChange={(e) =>
                    setUploadData((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Add any notes about this photo..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadData((prev) => ({ ...prev, file: null, notes: '' }));
                }}
                disabled={isUploading}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !uploadData.file}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 flex items-center space-x-2"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Upload Photo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
