import { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileImage, Plus, Camera } from "lucide-react";
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
    const cameraInputRef = useRef<HTMLInputElement>(null);

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

    const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const fileArray = Array.from(files);
            const newFiles = [...selectedImages, ...fileArray].slice(
                0,
                maxFiles
            );
            onImageSelect(newFiles);

            // Create previews for new files
            fileArray.forEach((file) => {
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
        // Reset input value to allow capturing the same image again
        if (e.target) {
            e.target.value = "";
        }
    };

    const openCamera = () => {
        cameraInputRef.current?.click();
    };

    if (selectedImages.length > 0) {
        return (
            <div className="space-y-4">
                {/* Hidden camera input */}
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleCameraCapture}
                    className="hidden"
                    disabled={isProcessing || selectedImages.length >= maxFiles}
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedImages.map((image, index) => (
                        <div
                            key={image.name}
                            className="relative rounded-lg border-2 border-dashed border-gray-300 overflow-hidden"
                        >
                            <img
                                src={previews[image.name]}
                                alt={`Nhãn thuốc đã tải lên ${index + 1}`}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            {...getRootProps()}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
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
                                        ? "Thả thêm hình ảnh vào đây"
                                        : "Tải lên từ tệp"}
                                </p>
                            </div>
                        </div>

                        <div
                            onClick={openCamera}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors border-gray-300 hover:border-gray-400",
                                isProcessing && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className="flex flex-col items-center justify-center gap-2">
                                <div className="rounded-full bg-primary/10 p-4">
                                    <Camera className="h-6 w-6 text-primary" />
                                </div>
                                <p className="text-sm font-medium">Chụp ảnh</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        Đã chọn {selectedImages.length} hình ảnh
                    </span>
                    {selectedImages.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            disabled={isProcessing}
                        >
                            Xóa Tất Cả
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Hidden camera input */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleCameraCapture}
                className="hidden"
                disabled={isProcessing}
            />

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
                                ? "Thả hình ảnh vào đây"
                                : "Tải lên hình ảnh nhãn thuốc"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Kéo thả hình ảnh hoặc nhấp để chọn
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Hỗ trợ: PNG, JPG, JPEG, GIF, BMP (tối đa {maxFiles}{" "}
                            hình ảnh)
                        </p>
                    </div>
                </div>
            </div>

            {/* Camera button */}
            <div className="flex justify-center">
                <Button
                    variant="outline"
                    onClick={openCamera}
                    disabled={isProcessing}
                    className="gap-2"
                    type="button"
                >
                    <Camera className="h-4 w-4" />
                    Chụp Ảnh Bằng Camera
                </Button>
            </div>
        </div>
    );
}
