import { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  label: string;
  description: string;
  onImageSelect: (file: File, preview: string) => void;
  onImageRemove: () => void;
  preview?: string;
  required?: boolean;
}

export function ImageUpload({
  label,
  description,
  onImageSelect,
  onImageRemove,
  preview,
  required = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          onImageSelect(file, reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onImageSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
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
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>

      {preview ? (
        <div className="relative group rounded-xl overflow-hidden border border-border bg-card">
          <img
            src={preview}
            alt="Yüklenen görsel"
            className="w-full h-48 object-cover"
          />
          <button
            type="button"
            onClick={onImageRemove}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <p className="text-white text-xs font-medium flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              Görsel yüklendi
            </p>
          </div>
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-primary bg-accent'
              : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
          )}
        >
          <div className="flex flex-col items-center justify-center py-4">
            <div className={cn(
              'p-3 rounded-full mb-3 transition-colors',
              isDragging ? 'bg-primary/20' : 'bg-muted'
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
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleInputChange}
          />
        </label>
      )}
    </div>
  );
}
