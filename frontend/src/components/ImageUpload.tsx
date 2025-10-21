import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileImage } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    onImageSelect: (file: File) => void;
    onClear: () => void;
    selectedImage: File | null;
    isProcessing?: boolean;
}

export function ImageUpload({
    onImageSelect,
    onClear,
    selectedImage,
    isProcessing = false,
}: ImageUploadProps) {
    const [preview, setPreview] = useState<string | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                const file = acceptedFiles[0];
                onImageSelect(file);

                // Create preview
                const reader = new FileReader();
                reader.onloadend = () => {
                    setPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            }
        },
        [onImageSelect]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp"],
        },
        maxFiles: 1,
        disabled: isProcessing,
    });

    const handleClear = () => {
        setPreview(null);
        onClear();
    };

    if (selectedImage && preview) {
        return (
            <div className="space-y-4">
                <div className="relative rounded-lg border-2 border-dashed border-gray-300 overflow-hidden">
                    <img
                        src={preview}
                        alt="Uploaded drug label"
                        className="w-full h-auto max-h-96 object-contain"
                    />
                    {!isProcessing && (
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={handleClear}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileImage className="h-4 w-4" />
                    <span className="truncate">{selectedImage.name}</span>
                    <span className="text-xs">
                        ({(selectedImage.size / 1024).toFixed(1)} KB)
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            {...getRootProps()}
            className={cn(
                "border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors",
                isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-gray-300 hover:border-gray-400",
                isProcessing && "opacity-50 cursor-not-allowed"
            )}
        >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="rounded-full bg-primary/10 p-6">
                    <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                    <p className="text-lg font-medium">
                        {isDragActive
                            ? "Drop the image here"
                            : "Upload drug label image"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Drag and drop an image, or click to select
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Supports: PNG, JPG, JPEG, GIF, BMP
                    </p>
                </div>
            </div>
        </div>
    );
}
