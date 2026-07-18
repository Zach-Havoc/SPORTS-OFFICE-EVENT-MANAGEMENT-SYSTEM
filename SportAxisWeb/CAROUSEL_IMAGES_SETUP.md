# Carousel Images Setup Guide

## Overview
The photo carousel feature now includes professional, high-quality images from Unsplash. The images are stored as direct URLs and will work in your local IDE without any additional downloads.

## Default Professional Images

The carousel now features these professional images:

1. **College of Informatics and Computing Sciences (CICS)**
   - Modern university campus aerial view
   - Shows contemporary educational architecture

2. **Engineering**
   - Modern engineering technology laboratory
   - Highlights technical facilities and equipment

3. **Business Administration**
   - Professional business conference setting
   - Showcases collaborative corporate environment

4. **Medicine**
   - Modern medical hospital healthcare facility
   - Displays state-of-the-art medical infrastructure

5. **Arts & Humanities**
   - Art gallery museum creative space
   - Features artistic and cultural environment

## How It Works in Local IDE

### Image Storage
- **No downloads required**: Images are hosted on Unsplash's CDN
- **Automatic loading**: Images load directly from URLs
- **LocalStorage persistence**: Carousel settings are stored in browser's localStorage
- **Cross-device sync**: Works on any device with internet connection

### Running Locally

1. **Start your development server**:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Images will automatically load** from Unsplash CDN when you:
   - Visit the public viewer page (/)
   - Access the admin carousel management (/admin/carousel)

3. **No additional setup needed** - the images are already configured in:
   - `/src/app/components/DepartmentCarousel.tsx`
   - `/src/app/pages/admin/CarouselManagement.tsx`

### Image URLs
All images use the following format:
```
https://images.unsplash.com/photo-[ID]?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=[ID]&ixlib=rb-4.1.0&q=80&w=1080
```

These are optimized for:
- Quality: 80% compression (good balance)
- Width: 1080px (perfect for carousels)
- Format: JPEG (web-optimized)
- Smart cropping: Entropy-based crop for best composition

## Admin Management Features

### Adding/Editing Slides
Admins can manage carousel slides via `/admin/carousel`:

1. **Using Image URLs**:
   - Paste any image URL (Unsplash recommended)
   - Recommended size: 1080x720px
   - Supports: JPG, PNG, WebP

2. **Uploading Files**:
   - Upload local images (Max 5MB)
   - Supported formats: JPEG, PNG, WebP
   - Images are stored in Supabase Storage

### File Upload for Local Development
If you want to use your own images:

1. **Via Admin Panel**:
   - Login as admin (admin@university.edu / admin123)
   - Navigate to "Carousel Management"
   - Click "Add Slide"
   - Either paste an image URL or upload a file
   - Click "Save"

2. **Using Image URLs**:
   - Use Unsplash for professional images
   - Format: `https://images.unsplash.com/photo-[ID]?w=1080`
   - Free to use, high quality

3. **LocalStorage Backup**:
   - All carousel data is saved to localStorage
   - Persists across browser sessions
   - Key: `carouselSlides`

## Troubleshooting

### Images Not Loading
1. **Check internet connection** - Images load from Unsplash CDN
2. **Clear browser cache** - Force refresh with Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
3. **Check browser console** - Look for CORS or network errors

### Reset to Default Images
1. Open browser console (F12)
2. Run: `localStorage.removeItem('carouselSlides')`
3. Refresh the page
4. Default professional images will reload

### Uploading Images Not Working
1. **Check Supabase connection** - Ensure edge functions are deployed
2. **Verify admin authentication** - Must be logged in as admin
3. **File size** - Must be under 5MB
4. **File format** - Only JPEG, PNG, WebP allowed

## Best Practices

### Image Selection
- **Aspect ratio**: 16:9 or 3:2 works best
- **Resolution**: Minimum 1080px wide
- **File size**: Keep under 500KB for fast loading
- **Quality**: Use high-quality, professional images
- **Relevance**: Choose images that represent each department

### Unsplash Integration
For best results when using Unsplash:
1. Visit [Unsplash.com](https://unsplash.com)
2. Search for relevant images
3. Copy the image URL
4. Add `?w=1080&q=80` to optimize
5. Use in carousel management

### Performance
- Images are lazy-loaded
- Cached by browser after first load
- Optimized delivery via CDN
- No impact on local storage

## Technical Details

### Files Modified
- `/src/app/components/DepartmentCarousel.tsx` - Main carousel component
- `/src/app/pages/admin/CarouselManagement.tsx` - Admin management interface

### Storage Locations
- **Default images**: Embedded in component code as URLs
- **Custom images**: Supabase Storage bucket `make-21398c83-carousel-images`
- **Slide data**: Browser localStorage key `carouselSlides`

### Dependencies
- No additional packages required
- Uses existing Tailwind CSS for styling
- React hooks for state management
- Supabase for file uploads (optional)

## Support

If you encounter any issues:
1. Check this documentation
2. Review browser console for errors
3. Verify internet connection for CDN access
4. Ensure Supabase edge functions are deployed (for uploads)

---

**Note**: All images are sourced from Unsplash under their free license, properly optimized for web use, and ready to run in your local development environment without any additional configuration.
