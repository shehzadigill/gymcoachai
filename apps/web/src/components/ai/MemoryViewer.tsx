'use client';

import React, { useState, useEffect } from 'react';
import {
  Brain,
  Clock,
  Star,
  Edit,
  Trash2,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  Tag,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { formatRelativeTime, formatMemoryType } from '../../lib/ai-utils';
import type { MemoryItem, MemoryType } from '../../types/ai-service';

interface MemoryViewerProps {
  userId: string;
  className?: string;
}

interface MemoryFilter {
  type: MemoryType | 'all';
  importance: 'all' | 'high' | 'medium' | 'low';
  dateRange: 'all' | 'week' | 'month' | 'year';
}

interface SortOption {
  field: 'createdAt' | 'importance' | 'type';
  direction: 'asc' | 'desc';
}

export default function MemoryViewer({
  userId,
  className = '',
}: MemoryViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filteredMemories, setFilteredMemories] = useState<MemoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<MemoryFilter>({
    type: 'all',
    importance: 'all',
    dateRange: 'all',
  });
  const [sort, setSort] = useState<SortOption>({
    field: 'createdAt',
    direction: 'desc',
  });
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(
    new Set()
  );
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemory, setNewMemory] = useState({
    type: 'general' as MemoryType,
    content: '',
    importance: 5,
  });

  useEffect(() => {
    fetchMemories();
  }, [userId]);

  useEffect(() => {
    applyFiltersAndSort();
  }, [memories, searchQuery, filter, sort]);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await aiService.retrieveRelevantMemories(userId, {
        query: '',
        context: 'all',
        limit: 100,
        includeMetadata: true,
      });

      setMemories(response?.data || []);
    } catch (err: any) {
      console.error('Failed to fetch memories:', err);
      setError(err.message || 'Failed to fetch memories');
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...memories];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (memory) =>
          memory.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          memory.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filter.type !== 'all') {
      filtered = filtered.filter((memory) => memory.type === filter.type);
    }

    // Apply importance filter
    if (filter.importance !== 'all') {
      const importanceMap = { high: 7, medium: 4, low: 1 };
      const minImportance =
        importanceMap[filter.importance as keyof typeof importanceMap];
      filtered = filtered.filter(
        (memory) => memory.importance >= minImportance
      );
    }

    // Apply date range filter
    if (filter.dateRange !== 'all') {
      const now = new Date();
      const dateRanges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      const cutoff = new Date(
        now.getTime() - dateRanges[filter.dateRange as keyof typeof dateRanges]
      );
      filtered = filtered.filter(
        (memory) => new Date(memory.createdAt) >= cutoff
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sort.field) {
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        case 'importance':
          aValue = a.importance;
          bValue = b.importance;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (sort.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredMemories(filtered);
  };

  const handleMemoryToggle = (memoryId: string) => {
    setSelectedMemories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memoryId)) {
        newSet.delete(memoryId);
      } else {
        newSet.add(memoryId);
      }
      return newSet;
    });
  };

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      await aiService.deleteMemory(userId, memoryId);
      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
      setSelectedMemories((prev) => {
        const newSet = new Set(prev);
        newSet.delete(memoryId);
        return newSet;
      });
    } catch (err: any) {
      console.error('Failed to delete memory:', err);
      setError(err.message || 'Failed to delete memory');
    }
  };

  const handleUpdateMemory = async (
    memoryId: string,
    updates: Partial<MemoryItem>
  ) => {
    try {
      await aiService.updateMemory(userId, memoryId, updates);
      setMemories((prev) =>
        prev.map((memory) =>
          memory.id === memoryId ? { ...memory, ...updates } : memory
        )
      );
      setEditingMemory(null);
    } catch (err: any) {
      console.error('Failed to update memory:', err);
      setError(err.message || 'Failed to update memory');
    }
  };

  const handleAddMemory = async () => {
    try {
      const response = await aiService.storeConversationMemory(userId, {
        type: newMemory.type,
        content: newMemory.content,
        importance: newMemory.importance,
        context: 'user_created',
      });

      setMemories((prev) => [response.data, ...prev]);
      setNewMemory({ type: 'general', content: '', importance: 5 });
      setShowAddForm(false);
    } catch (err: any) {
      console.error('Failed to add memory:', err);
      setError(err.message || 'Failed to add memory');
    }
  };

  const getImportanceColor = (importance: number) => {
    if (importance >= 7) return 'text-red-600 bg-red-100';
    if (importance >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getImportanceLabel = (importance: number) => {
    if (importance >= 7) return 'High';
    if (importance >= 4) return 'Medium';
    return 'Low';
  };

  const getMemoryIcon = (type: MemoryType) => {
    const icons = {
      goal: Target,
      preference: Settings,
      achievement: Star,
      injury: AlertCircle,
      general: Brain,
    };
    const IconComponent = icons[type] || Brain;
    return <IconComponent className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            AI Memory Viewer
          </h3>
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchMemories}
            disabled={loading}
            className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filter.type}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  type: e.target.value as MemoryType | 'all',
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Types</option>
              <option value="goal">Goals</option>
              <option value="preference">Preferences</option>
              <option value="achievement">Achievements</option>
              <option value="injury">Injuries</option>
              <option value="general">General</option>
            </select>

            <select
              value={filter.importance}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  importance: e.target.value as any,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Importance</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={filter.dateRange}
              onChange={(e) =>
                setFilter((prev) => ({
                  ...prev,
                  dateRange: e.target.value as any,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center space-x-2">
            <select
              value={`${sort.field}-${sort.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-');
                setSort({ field: field as any, direction: direction as any });
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="importance-desc">Most Important</option>
              <option value="importance-asc">Least Important</option>
              <option value="type-asc">Type A-Z</option>
              <option value="type-desc">Type Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Add Memory Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg p-4 mb-6">
          <h4 className="font-medium text-gray-900 mb-4">Add New Memory</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={newMemory.type}
                  onChange={(e) =>
                    setNewMemory((prev) => ({
                      ...prev,
                      type: e.target.value as MemoryType,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="general">General</option>
                  <option value="goal">Goal</option>
                  <option value="preference">Preference</option>
                  <option value="achievement">Achievement</option>
                  <option value="injury">Injury</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Importance (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newMemory.importance}
                  onChange={(e) =>
                    setNewMemory((prev) => ({
                      ...prev,
                      importance: parseInt(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={newMemory.content}
                onChange={(e) =>
                  setNewMemory((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="Enter memory content..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMemory}
                disabled={!newMemory.content.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Memory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Memories List */}
      <div className="space-y-3">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p>No memories found matching your criteria.</p>
          </div>
        ) : (
          filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className={`bg-white rounded-lg border border-gray-200 p-4 transition-all ${
                selectedMemories.has(memory.id) ? 'ring-2 ring-indigo-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedMemories.has(memory.id)}
                    onChange={() => handleMemoryToggle(memory.id)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />

                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getMemoryIcon(memory.type)}
                      <span className="text-sm font-medium text-gray-900">
                        {formatMemoryType(memory.type)}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getImportanceColor(memory.importance)}`}
                      >
                        {getImportanceLabel(memory.importance)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(memory.createdAt)}
                      </span>
                    </div>

                    <div className="text-gray-700 mb-2">
                      {editingMemory?.id === memory.id ? (
                        <textarea
                          value={editingMemory.content}
                          onChange={(e) =>
                            setEditingMemory((prev) =>
                              prev ? { ...prev, content: e.target.value } : null
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          rows={3}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">{memory.content}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {editingMemory?.id === memory.id ? (
                    <>
                      <button
                        onClick={() =>
                          handleUpdateMemory(memory.id, {
                            content: editingMemory.content,
                          })
                        }
                        className="text-green-600 hover:text-green-700 p-1 rounded transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingMemory(null)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingMemory(memory)}
                        className="text-indigo-600 hover:text-indigo-700 p-1 rounded transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteMemory(memory.id)}
                        className="text-red-600 hover:text-red-700 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bulk Actions */}
      {selectedMemories.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-indigo-700">
              {selectedMemories.size} memory
              {selectedMemories.size !== 1 ? 'ies' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  selectedMemories.forEach((memoryId) =>
                    handleDeleteMemory(memoryId)
                  );
                  setSelectedMemories(new Set());
                }}
                className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedMemories(new Set())}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
