import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileImage, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
    onImageSelect: (files: File[]) => void;
    onClear: () => void;
    selectedImages: File[];
    isProcessing?: boolean;
    maxFiles?: number;
}

export function ImageUpload({
    onImageSelect,
    onClear,
    selectedImages,
    isProcessing = false,
    maxFiles = 5,
}: ImageUploadProps) {
    const [previews, setPreviews] = useState<{ [key: string]: string }>({});

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length > 0) {
                const newFiles = [...selectedImages, ...acceptedFiles].slice(
                    0,
                    maxFiles
                );
                onImageSelect(newFiles);

                // Create previews for new files
                acceptedFiles.forEach((file) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setPreviews((prev) => ({
                            ...prev,
                            [file.name]: reader.result as string,
                        }));
                    };
                    reader.readAsDataURL(file);
                });
            }
        },
        [onImageSelect, selectedImages, maxFiles]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp"],
        },
        maxFiles: maxFiles - selectedImages.length,
        disabled: isProcessing || selectedImages.length >= maxFiles,
    });

    const handleClear = () => {
        setPreviews({});
        onClear();
    };

    const handleRemoveImage = (fileName: string) => {
        const newImages = selectedImages.filter((img) => img.name !== fileName);
        onImageSelect(newImages);

        const newPreviews = { ...previews };
        delete newPreviews[fileName];
        setPreviews(newPreviews);
    };

    if (selectedImages.length > 0) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedImages.map((image, index) => (
                        <div
                            key={image.name}
                            className="relative rounded-lg border-2 border-dashed border-gray-300 overflow-hidden"
                        >
                            <img
                                src={previews[image.name]}
                                alt={`Uploaded drug label ${index + 1}`}
                                className="w-full h-auto max-h-64 object-contain"
                            />
                            {!isProcessing && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2"
                                    onClick={() =>
                                        handleRemoveImage(image.name)
                                    }
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileImage className="h-4 w-4" />
                                    <span className="truncate">
                                        {image.name}
                                    </span>
                                    <span className="text-xs">
                                        ({(image.size / 1024).toFixed(1)} KB)
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedImages.length < maxFiles && (
                    <div
                        {...getRootProps()}
                        className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                            isDragActive
                                ? "border-primary bg-primary/5"
                                : "border-gray-300 hover:border-gray-400",
                            isProcessing && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center justify-center gap-2">
                            <div className="rounded-full bg-primary/10 p-4">
                                <Plus className="h-6 w-6 text-primary" />
                            </div>
                            <p className="text-sm font-medium">
                                {isDragActive
                                    ? "Drop more images here"
                                    : "Add more images"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {selectedImages.length} of {maxFiles} images
                                uploaded
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        {selectedImages.length} image
                        {selectedImages.length !== 1 ? "s" : ""} selected
                    </span>
                    {selectedImages.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={isProcessing}
                        >
                            Clear All
                        </Button>
                    )}
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
                            ? "Drop the images here"
                            : "Upload drug label images"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Drag and drop images, or click to select
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Supports: PNG, JPG, JPEG, GIF, BMP (up to {maxFiles}{" "}
                        images)
                    </p>
                </div>
            </div>
        </div>
    );
}
