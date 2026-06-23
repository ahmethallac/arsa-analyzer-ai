import { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UploadedImage } from '@/types/analysis';

interface MultiImageUploadProps {
  label: string;
  description: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  type: 'sahibinden' | 'arazi';
  maxImages?: number;
  required?: boolean;
}

export function MultiImageUpload({
  label,
  description,
  images,
  onImagesChange,
  type,
  maxImages = 5,
  required = false,
}: MultiImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      
      const newImages: UploadedImage[] = [];
      const remainingSlots = maxImages - images.length;
      const filesToProcess = Math.min(files.length, remainingSlots);

      let processed = 0;
      for (let i = 0; i < filesToProcess; i++) {
        const file = files[i];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
            newImages.push({
              file,
              preview: reader.result as string,
              type,
            });
            processed++;
            if (processed === filesToProcess) {
              onImagesChange([...images, ...newImages]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    },
    [images, onImagesChange, type, maxImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const canAddMore = images.length < maxImages;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-foreground">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {images.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">
            {images.length}/{maxImages}
          </span>
        )}
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative group aspect-[4/3] rounded-xl overflow-hidden border border-border bg-card shadow-sm"
            >
              <img
                src={image.preview}
                alt={`Yüklenen görsel ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/60 to-transparent p-2">
                <p className="text-primary-foreground text-xs font-medium flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  Görsel {index + 1}
                </p>
              </div>
            </div>
          ))}

          {canAddMore && (
            <label
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'flex flex-col items-center justify-center aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-primary bg-accent'
                  : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
              )}
            >
              <Plus className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Ekle</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleInputChange}
              />
            </label>
          )}
        </div>
      )}

      {images.length === 0 && (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'flex flex-col items-center justify-center w-full py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-primary bg-accent'
              : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
          )}
        >
          <div className={cn(
            'p-3 rounded-full mb-3 transition-colors',
            isDragging ? 'bg-primary/20' : 'bg-secondary'
          )}>
            <Upload className={cn(
              'w-6 h-6 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            Görsel yükle
          </p>
          <p className="text-xs text-muted-foreground">
            Sürükle-bırak veya tıkla
          </p>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleInputChange}
          />
        </label>
      )}
    </div>
  );
}
