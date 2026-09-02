import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import {
  useAdminSiteSlides,
  useCreateSiteSlide,
  useUpdateSiteSlide,
  useDeleteSiteSlide,
  useReorderSiteSlides,
} from '../../hooks/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import Loading from '../../components/Loading';

type SlideType = 'carousel' | 'popup';

interface Slide {
  id: string;
  type: SlideType;
  title?: string | null;
  caption?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  sortOrder: number;
  active: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';

function validateImage(file: File): string | null {
  if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
    return 'Only JPG, PNG or WebP images are allowed.';
  }
  if (file.size > MAX_BYTES) return 'Image must be smaller than 5 MB.';
  return null;
}

// ── Add form ─────────────────────────────────────────────────────────────────

function AddSlideForm({ type, onDone }: { type: SlideType; onDone: () => void }) {
  const create = useCreateSiteSlide();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    const err = validateImage(f);
    if (err) { toast.error(err); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file) { toast.error('Choose an image first.'); return; }
    try {
      await create.mutateAsync({ type, image: file, title, caption, linkUrl, active });
      toast.success(type === 'popup' ? 'Popup image added.' : 'Slide added.');
      onDone();
    } catch (e: any) {
      toast.error(e.message || 'Could not save.');
    }
  };

  return (
    <Card className="mb-6 border-red-100">
      <CardHeader>
        <CardTitle className="text-base">
          {type === 'popup' ? 'New popup image' : 'New slide'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Image <span className="text-red-500">*</span></Label>
            <Input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-gray-500">JPG, PNG or WebP · up to 5 MB · wide photos (21:8) look best in the slideshow.</p>
            {preview && (
              <img src={preview} alt="Preview" className="mt-2 h-40 w-full rounded-lg border object-cover" />
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Title <span className="text-gray-400">(optional)</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening Ceremony" />
            </div>
            <div className="space-y-2">
              <Label>Caption <span className="text-gray-400">(optional)</span></Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} placeholder="Short line shown under the title" />
            </div>
            <div className="space-y-2">
              <Label>Link URL <span className="text-gray-400">(optional)</span></Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={active} onCheckedChange={setActive} id="add-active" />
              <Label htmlFor="add-active" className="cursor-pointer">Visible to the public right away</Label>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" onClick={onDone} disabled={create.isPending}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Edit dialog ──────────────────────────────────────────────────────────────

function EditSlideDialog({ slide, onClose }: { slide: Slide | null; onClose: () => void }) {
  const update = useUpdateSiteSlide();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    setFile(null);
    setPreview('');
    setTitle(slide?.title ?? '');
    setCaption(slide?.caption ?? '');
    setLinkUrl(slide?.linkUrl ?? '');
  }, [slide]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  if (!slide) return null;

  const pickFile = (f: File | null) => {
    if (!f) return;
    const err = validateImage(f);
    if (err) { toast.error(err); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    try {
      await update.mutateAsync({
        id: slide.id,
        data: { title, caption, linkUrl, ...(file ? { image: file } : {}) },
      });
      toast.success('Saved.');
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Could not save.');
    }
  };

  return (
    <Dialog open={!!slide} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {slide.type === 'popup' ? 'popup image' : 'slide'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <img src={preview || slide.imageUrl} alt="" className="h-40 w-full rounded-lg border object-cover" />
          <div className="space-y-2">
            <Label>Replace image <span className="text-gray-400">(optional)</span></Label>
            <Input type="file" accept={ACCEPT} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Link URL</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── One tab (a slide list for a given type) ──────────────────────────────────

function SlideManager({ type }: { type: SlideType }) {
  const { data, isLoading } = useAdminSiteSlides(type);
  const update = useUpdateSiteSlide();
  const remove = useDeleteSiteSlide();
  const reorder = useReorderSiteSlides();

  const slides = useMemo<Slide[]>(
    () => [...((data ?? []) as Slide[])].sort((a, b) => a.sortOrder - b.sortOrder),
    [data],
  );

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);

  const toggleActive = async (s: Slide) => {
    try {
      await update.mutateAsync({ id: s.id, data: { active: !s.active } });
    } catch (e: any) {
      toast.error(e.message || 'Could not update.');
    }
  };

  const del = async (s: Slide) => {
    if (!confirm('Delete this image? This cannot be undone.')) return;
    try {
      await remove.mutateAsync(s.id);
      toast.success('Deleted.');
    } catch (e: any) {
      toast.error(e.message || 'Could not delete.');
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const order = slides.map((s) => s.id);
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await reorder.mutateAsync({ type, order });
    } catch (e: any) {
      toast.error(e.message || 'Could not reorder.');
    }
  };

  if (isLoading) return <Loading fullScreen={false} message="Loading…" />;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {type === 'popup'
            ? 'Shown once per visit when someone opens the public site. If several are visible, the top one is used.'
            : 'The photo slideshow at the top of the public Live Events page. Drag order with the arrows.'}
        </p>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add {type === 'popup' ? 'popup' : 'slide'}
          </Button>
        )}
      </div>

      {adding && <AddSlideForm type={type} onDone={() => setAdding(false)} />}

      {slides.length === 0 && !adding ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ImageIcon className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p>No {type === 'popup' ? 'popup image' : 'slides'} yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {slides.map((s, i) => (
            <Card key={s.id} className={s.active ? '' : 'opacity-60'}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                  <img src={s.imageUrl} alt={s.title ?? ''} className="h-full w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                    #{i + 1}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{s.title || <span className="text-gray-400">Untitled</span>}</p>
                  {s.caption && <p className="mt-0.5 line-clamp-2 text-sm text-gray-500">{s.caption}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    {!s.active && <span className="inline-flex items-center gap-1 text-amber-600"><EyeOff className="h-3 w-3" /> Hidden</span>}
                    {s.linkUrl && (
                      <a href={s.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Link
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <div className="mr-2 flex flex-col">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0 || reorder.isPending}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === slides.length - 1 || reorder.isPending}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} aria-label="Visible" />
                  </div>

                  <Button variant="ghost" size="sm" onClick={() => setEditing(s)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => del(s)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditSlideDialog slide={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CarouselManagement() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/login');
  }, [user, navigate]);

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-4">
        <Link to="/admin/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Site Content</h1>
          <p className="mt-1 text-gray-500">Photos on the public site — you control what shows and in what order.</p>
        </div>
      </div>

      <Tabs defaultValue="carousel" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="carousel">Live Events Slideshow</TabsTrigger>
          <TabsTrigger value="popup">Welcome Popup</TabsTrigger>
        </TabsList>
        <TabsContent value="carousel" className="mt-6">
          <SlideManager type="carousel" />
        </TabsContent>
        <TabsContent value="popup" className="mt-6">
          <SlideManager type="popup" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
