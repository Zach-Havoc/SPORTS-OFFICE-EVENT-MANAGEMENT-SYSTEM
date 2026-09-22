<!-- ====================================================== -->
<!-- Carousel Images Setup Guide                            -->
<!-- Documentation for Carousel Image Configuration         -->
<!-- This guide explains image setup, storage, and usage    -->
<!-- ====================================================== -->

# Carousel Images Setup Guide

## Overview

<!-- General overview of the carousel image system -->
The photo carousel feature now includes professional, high-quality images from Unsplash. The images are stored as direct URLs and will work in your local IDE without any additional downloads.

The carousel is designed to provide an attractive landing page while remaining lightweight, responsive, and easy to manage. Administrators can replace or upload images without modifying the application source code.

---

<!-- ====================================================== -->
<!-- Default Images                                         -->
<!-- ====================================================== -->

## Default Professional Images

<!-- Default images displayed when no custom slides exist -->

The carousel now features these professional images:

### 1. College of Informatics and Computing Sciences (CICS)

- Modern university campus aerial view
- Shows contemporary educational architecture
- Represents technology-focused education

### 2. Engineering

- Modern engineering technology laboratory
- Highlights technical facilities and equipment
- Represents innovation and engineering excellence

### 3. Business Administration

- Professional business conference setting
- Showcases collaborative corporate environment
- Represents leadership and entrepreneurship

### 4. Medicine

- Modern medical hospital healthcare facility
- Displays state-of-the-art medical infrastructure
- Represents healthcare education and research

### 5. Arts & Humanities

- Art gallery museum creative space
- Features artistic and cultural environment
- Represents creativity and innovation

---

<!-- ====================================================== -->
<!-- Local Development                                      -->
<!-- ====================================================== -->

## How It Works in Local IDE

### Image Storage

<!-- Explains where images come from -->

- **No downloads required** — Images are hosted on Unsplash CDN.
- **Automatic loading** — Images are loaded directly from public URLs.
- **LocalStorage persistence** — Carousel settings remain saved in the browser.
- **Cross-browser compatibility** — Works on all modern browsers.
- **Internet required** — Images are retrieved online from the CDN.

---

<!-- Local setup instructions -->

### Running Locally

1. Start your development server.

```bash
npm run dev

# or

yarn dev
```

2. Images automatically load when you:

- Visit the public viewer page (`/`)
- Open the administrator carousel page (`/admin/carousel`)

3. No additional configuration is required.

Images are already configured inside:

- `/src/app/components/DepartmentCarousel.tsx`
- `/src/app/pages/admin/CarouselManagement.tsx`

---

<!-- ====================================================== -->
<!-- Image Optimization                                     -->
<!-- ====================================================== -->

## Image URLs

All images follow this optimized URL format.

```
https://images.unsplash.com/photo-[ID]?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=[ID]&ixlib=rb-4.1.0&q=80&w=1080
```

Image optimization includes:

- Quality: 80%
- Width: 1080 pixels
- JPEG compression
- Smart entropy cropping
- CDN delivery
- Browser caching

These optimizations reduce loading time while maintaining excellent visual quality.

---

<!-- ====================================================== -->
<!-- Administrator Features                                 -->
<!-- ====================================================== -->

## Admin Management Features

Administrators can customize carousel slides without editing code.

### Adding or Editing Slides

Navigate to:

```
/admin/carousel
```

Features include:

- Add new slides
- Edit existing slides
- Remove slides
- Reorder slides
- Preview carousel changes

---

<!-- Upload via URL -->

### Using Image URLs

Supported sources include:

- Unsplash
- Public CDN links
- Direct image URLs

Recommended specifications:

- Resolution: 1080 × 720
- Aspect Ratio: 16:9
- Formats: JPG, PNG, WebP

---

<!-- Upload files -->

### Uploading Files

Upload images directly from your computer.

Supported features:

- Maximum size: 5 MB
- JPEG
- PNG
- WebP

Uploaded images are stored inside Supabase Storage.

---

<!-- ====================================================== -->
<!-- Local Development Uploads                              -->
<!-- ====================================================== -->

## File Upload for Local Development

### Using the Admin Panel

1. Login as administrator.

```
admin@university.edu
Password: admin123
```

2. Navigate to **Carousel Management**.

3. Select **Add Slide**.

4. Either:

- Upload an image
- Paste an image URL

5. Save changes.

---

<!-- URL recommendations -->

### Using Image URLs

For best results:

- Use Unsplash images.
- Choose high-resolution photographs.
- Prefer landscape orientation.
- Use optimized URLs.

Example:

```
https://images.unsplash.com/photo-[ID]?w=1080&q=80
```

---

<!-- Browser storage -->

### LocalStorage Backup

Carousel configuration is automatically stored in:

```
carouselSlides
```

Benefits:

- Fast loading
- Offline persistence
- Automatic recovery
- Easy reset

---

<!-- ====================================================== -->
<!-- Troubleshooting Section                                -->
<!-- ====================================================== -->

## Troubleshooting

### Images Not Loading

Possible causes include:

1. No internet connection
2. Browser cache
3. Network restrictions
4. CDN temporarily unavailable

Recommended solutions:

- Refresh the page
- Clear browser cache
- Check Developer Tools
- Verify network connectivity

---

### Reset to Default Images

Open Developer Tools.

Run:

```javascript
localStorage.removeItem("carouselSlides")
```

Refresh the page.

The application automatically restores the default image collection.

---

### Upload Issues

Possible reasons include:

- Supabase unavailable
- Authentication expired
- Unsupported image format
- File exceeds maximum size
- Storage permissions

Verify:

- Administrator login
- Edge Functions deployment
- Storage bucket configuration

---

<!-- ====================================================== -->
<!-- Best Practices                                         -->
<!-- ====================================================== -->

## Best Practices

### Image Selection

Recommended guidelines:

- 16:9 aspect ratio
- Minimum width: 1080px
- Maximum size: 500 KB
- High-quality photography
- Professional appearance
- Department-related content
- Consistent lighting
- Modern campus imagery

---

### Unsplash Integration

Recommended workflow:

1. Visit Unsplash.
2. Search for department-related photos.
3. Copy image URL.
4. Optimize URL.

Example:

```
?w=1080&q=80
```

5. Save through Carousel Management.

---

### Performance Optimization

The carousel includes several performance improvements.

Features:

- Lazy loading
- Browser caching
- CDN delivery
- Optimized compression
- Responsive image sizing
- Smooth transitions

These optimizations reduce bandwidth usage while improving user experience.

---

<!-- ====================================================== -->
<!-- Technical Documentation                                -->
<!-- ====================================================== -->

## Technical Details

### Files Modified

Project files include:

```
/src/app/components/DepartmentCarousel.tsx
```

Main public carousel component.

```
/src/app/pages/admin/CarouselManagement.tsx
```

Administrator management interface.

---

### Storage Locations

Default Images

- Stored as embedded URL references

Custom Images

- Supabase Storage

Storage Bucket

```
make-21398c83-carousel-images
```

Browser Storage

```
carouselSlides
```

---

### Dependencies

The carousel uses existing project dependencies.

No additional packages are required.

Technologies include:

- React
- TypeScript
- Tailwind CSS
- Supabase
- LocalStorage API

---

<!-- ====================================================== -->
<!-- Future Improvements                                    -->
<!-- ====================================================== -->

## Future Enhancements

Planned improvements include:

- Image drag-and-drop sorting
- Automatic image compression
- AI image recommendations
- Dark mode optimized banners
- Carousel scheduling
- Multiple carousel collections
- Video banner support
- Image cropping tools
- Analytics dashboard
- Cloudflare image optimization

---

<!-- ====================================================== -->
<!-- Support Information                                    -->
<!-- ====================================================== -->

## Support

If problems occur:

1. Review this documentation.
2. Check browser Developer Tools.
3. Verify internet connectivity.
4. Confirm Supabase services are operational.
5. Ensure administrator permissions.
6. Verify Storage bucket access.
7. Check browser LocalStorage.

---

<!-- ====================================================== -->
<!-- Additional Notes                                       -->
<!-- ====================================================== -->

## Notes

- Images are sourced from Unsplash.
- Optimized for responsive layouts.
- Ready for local development.
- Compatible with desktop and mobile browsers.
- Easily customizable through the admin interface.
- Designed for scalability and future expansion.
- Requires no manual asset downloads.
- Uses modern web optimization practices.

---

<!-- ====================================================== -->
<!-- End of Carousel Images Documentation                   -->
<!-- Thank you for using the SportAxisWeb Carousel System.  -->
<!-- Future updates should be documented in this guide.     -->
<!-- ====================================================== -->