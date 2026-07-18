import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Image as ImageIcon, Upload } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import Loading from '../../components/Loading';
import { API_URL } from '../../../config/api';

interface CarouselSlide {
  id: string;
  name: string;
  abbreviation: string;
  image: string;
  fileName?: string; // Store the file name for deletion
}

export default function CarouselManagement() {
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    image: '',
    fileName: ''
  });

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/login');
      return;
    }
    loadSlides();
  }, [user, navigate]);

  const loadSlides = async () => {
    try {
      // Load carousel slides from localStorage for now
      const savedSlides = localStorage.getItem('carouselSlides');
      if (savedSlides) {
        setSlides(JSON.parse(savedSlides));
      } else {
        // Set default slides with professional images
        const defaultSlides: CarouselSlide[] = [
          {
            id: '1',
            name: 'College of Informatics and Computing Sciences',
            abbreviation: 'CICS',
            image: 'https://images.unsplash.com/photo-1603857365671-93cd96dc1df8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwYnVpbGRpbmclMjBjYW1wdXMlMjBhZXJpYWx8ZW58MXx8fHwxNzc1MTg3Nzg5fDA&ixlib=rb-4.1.0&q=80&w=1080'
          },
          {
            id: '2',
            name: 'Engineering',
            abbreviation: 'ENG',
            image: 'https://images.unsplash.com/photo-1581093577421-f561a654a353?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBlbmdpbmVlcmluZyUyMHRlY2hub2xvZ3klMjBsYWJvcmF0b3J5fGVufDF8fHx8MTc3NTE4Nzc4OXww&ixlib=rb-4.1.0&q=80&w=1080'
          },
          {
            id: '3',
            name: 'Business Administration',
            abbreviation: 'BA',
            image: 'https://images.unsplash.com/photo-1769739576456-0aefcff3f4b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGNvbmZlcmVuY2UlMjBtZWV0aW5nJTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3NTE4Nzc5MHww&ixlib=rb-4.1.0&q=80&w=1080'
          },
          {
            id: '4',
            name: 'Medicine',
            abbreviation: 'MED',
            image: 'https://images.unsplash.com/photo-1761881917053-a48d16611196?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwaG9zcGl0YWwlMjBoZWFsdGhjYXJlJTIwZmFjaWxpdHl8ZW58MXx8fHwxNzc1MTg3NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080'
          },
          {
            id: '5',
            name: 'Arts & Humanities',
            abbreviation: 'AH',
            image: 'https://images.unsplash.com/photo-1772987020530-4ceac482c95a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnQlMjBnYWxsZXJ5JTIwbXVzZXVtJTIwY3JlYXRpdmV8ZW58MXx8fHwxNzc1MTg3NzkwfDA&ixlib=rb-4.1.0&q=80&w=1080'
          }
        ];
        setSlides(defaultSlides);
        localStorage.setItem('carouselSlides', JSON.stringify(defaultSlides));
      }
    } catch (error) {
      console.error('Error loading carousel slides:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSlides = (updatedSlides: CarouselSlide[]) => {
    localStorage.setItem('carouselSlides', JSON.stringify(updatedSlides));
    // Update the carousel component state
    window.dispatchEvent(new Event('carouselSlidesUpdated'));
  };

  const handleAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', image: '', fileName: '' });
  };

  const handleEdit = (slide: CarouselSlide) => {
    setIsEditing(true);
    setEditingId(slide.id);
    setFormData({
      name: slide.name,
      abbreviation: slide.abbreviation,
      image: slide.image,
      fileName: slide.fileName || ''
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.abbreviation || !formData.image) {
      toast.error('Please fill in all fields');
      return;
    }

    let updatedSlides: CarouselSlide[];
    if (editingId) {
      // Update existing slide
      updatedSlides = slides.map(slide =>
        slide.id === editingId
          ? { ...slide, ...formData }
          : slide
      );
      toast.success('Carousel slide updated successfully!');
    } else {
      // Add new slide
      const newSlide: CarouselSlide = {
        id: Date.now().toString(),
        ...formData
      };
      updatedSlides = [...slides, newSlide];
      toast.success('Carousel slide added successfully!');
    }

    setSlides(updatedSlides);
    saveSlides(updatedSlides);
    setIsEditing(false);
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', image: '', fileName: '' });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this slide?')) return;
    const updatedSlides = slides.filter(slide => slide.id !== id);
    setSlides(updatedSlides);
    saveSlides(updatedSlides);
    toast.success('Carousel slide deleted successfully!');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', image: '', fileName: '' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
        return;
      }
      
      // Validate file size (5MB)
      if (file.size > 5242880) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      // Create temporary preview
      const previewURL = URL.createObjectURL(file);
      setPreviewUrl(previewURL);
      setFormData({ ...formData, image: previewURL });
      
      // Auto-upload the file
      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      
      const authToken = localStorage.getItem('auth_token');
      // If the backend doesn't support this yet, it will fail gracefully.
      const response = await fetch(`${API_URL}/carousel/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: uploadFormData
      });
      
      const data = await response.json();
      
      if (response.ok && data.url) {
        // Clean up the preview URL
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setFormData(prev => ({ ...prev, image: data.url, fileName: data.fileName }));
        setPreviewUrl('');
        toast.success('Image uploaded successfully!');
      } else {
        toast.error(data.error || 'Upload failed');
        // Reset file selection
        setSelectedFile(null);
        setPreviewUrl('');
        setFormData(prev => ({ ...prev, image: '' }));
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Upload failed. Please try again.');
      setSelectedFile(null);
      setPreviewUrl('');
      setFormData(prev => ({ ...prev, image: '' }));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading carousel..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Carousel Management</h1>
            <p className="text-gray-500 mt-1">Manage department images in public view carousel</p>
          </div>
        </div>
        {!isEditing && (
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Slide
          </Button>
        )}
      </div>

      {/* Edit Form */}
      {isEditing && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Slide' : 'Add New Slide'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Department Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="abbreviation">Abbreviation</Label>
                  <Input
                    id="abbreviation"
                    value={formData.abbreviation}
                    onChange={e => setFormData({ ...formData, abbreviation: e.target.value })}
                    placeholder="e.g., CS"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">Image URL</Label>
                <Input
                  id="image"
                  value={formData.image}
                  onChange={e => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                />
                <p className="text-xs text-gray-500">
                  Use Unsplash or other high-quality image URLs. Recommended size: 1080x720px
                </p>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Upload Image File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="flex-1"
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      Uploading...
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Upload a photo file (JPEG, PNG, WebP). Max size: 5MB. Or use an image URL above.
                </p>
              </div>

              {/* Image Preview */}
              {formData.image && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="relative h-48 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={formData.image}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/1080x720?text=Invalid+Image+URL';
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <p className="text-sm text-white opacity-90">{formData.abbreviation}</p>
                      <h3 className="text-xl font-bold text-white">{formData.name}</h3>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Slides List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {slides.map((slide, index) => (
          <Card key={slide.id} className="overflow-hidden">
            <div className="relative h-48">
              <img
                src={slide.image}
                alt={slide.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-xs opacity-90">{slide.abbreviation}</p>
                <h3 className="text-lg font-bold">{slide.name}</h3>
              </div>
              <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-gray-700">
                #{index + 1}
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleEdit(slide)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDelete(slide.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {slides.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No carousel slides yet</p>
            <Button onClick={handleAdd} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Slide
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}