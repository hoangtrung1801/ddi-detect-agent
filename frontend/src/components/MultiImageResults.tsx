import { Fragment, useState } from "react";
import {
    FileImage,
    Loader2,
    CheckCircle,
    XCircle,
    AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";

export interface ImageResult {
    file: File;
    preview: string;
    extractedIngredients: string[];
    isLoading: boolean;
    error?: string;
}

interface MultiImageResultsProps {
    results: ImageResult[];
    onRemoveImage: (fileName: string) => void;
    onRetryImage: (fileName: string) => void;
}

export function MultiImageResults({
    results,
    onRemoveImage,
    onRetryImage,
}: MultiImageResultsProps) {
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    const getStatusIcon = (result: ImageResult) => {
        if (result.isLoading) {
            return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
        }
        if (result.error) {
            return <XCircle className="h-4 w-4 text-red-500" />;
        }
        if (result.extractedIngredients.length > 0) {
            return <CheckCircle className="h-4 w-4 text-green-500" />;
        }
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    };

    const getStatusText = (result: ImageResult) => {
        if (result.isLoading) {
            return "Processing...";
        }
        if (result.error) {
            return "Error";
        }
        if (result.extractedIngredients.length > 0) {
            return `${result.extractedIngredients.length} ingredient${
                result.extractedIngredients.length !== 1 ? "s" : ""
            } found`;
        }
        return "No ingredients found";
    };

    const getStatusColor = (result: ImageResult) => {
        if (result.isLoading) {
            return "bg-blue-50 border-blue-200 text-blue-800";
        }
        if (result.error) {
            return "bg-red-50 border-red-200 text-red-800";
        }
        if (result.extractedIngredients.length > 0) {
            return "bg-green-50 border-green-200 text-green-800";
        }
        return "bg-yellow-50 border-yellow-200 text-yellow-800";
    };

    if (results.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Step 2: Extracted Active Ingredients</CardTitle>
                <CardDescription>
                    Review the active ingredients extracted from each drug image
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {results.map((result, index) => (
                        <Fragment key={result.file.name}>
                            <Card
                                key={result.file.name}
                                className="overflow-hidden"
                            >
                                <CardContent className="p-0">
                                    <div className="flex">
                                        {/* Image Preview */}
                                        <div className="w-32 h-32 shrink-0 relative">
                                            <img
                                                src={result.preview}
                                                alt={`Drug label ${index + 1}`}
                                                className="w-full h-full object-cover cursor-pointer"
                                                onClick={() =>
                                                    setExpandedImage(
                                                        expandedImage ===
                                                            result.file.name
                                                            ? null
                                                            : result.file.name
                                                    )
                                                }
                                            />
                                            <div className="absolute top-2 left-2">
                                                {getStatusIcon(result)}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FileImage className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium text-sm truncate">
                                                            {result.file.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            (
                                                            {(
                                                                result.file
                                                                    .size / 1024
                                                            ).toFixed(1)}{" "}
                                                            KB)
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Badge
                                                            variant="outline"
                                                            className={getStatusColor(
                                                                result
                                                            )}
                                                        >
                                                            {getStatusText(
                                                                result
                                                            )}
                                                        </Badge>
                                                    </div>

                                                    {/* Error Message */}
                                                    {result.error && (
                                                        <div className="text-sm text-red-600 mb-3">
                                                            {result.error}
                                                        </div>
                                                    )}

                                                    {/* Extracted Ingredients */}
                                                    {result.extractedIngredients
                                                        .length > 0 && (
                                                        <div className="space-y-2">
                                                            <p className="text-sm font-medium text-muted-foreground">
                                                                Active
                                                                Ingredients:
                                                            </p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {result.extractedIngredients.map(
                                                                    (
                                                                        ingredient,
                                                                        idx
                                                                    ) => (
                                                                        <Badge
                                                                            key={
                                                                                idx
                                                                            }
                                                                            variant="secondary"
                                                                            className="text-xs"
                                                                        >
                                                                            {
                                                                                ingredient
                                                                            }
                                                                        </Badge>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col gap-2 ml-4">
                                                    {result.error && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                onRetryImage(
                                                                    result.file
                                                                        .name
                                                                )
                                                            }
                                                        >
                                                            Retry
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            onRemoveImage(
                                                                result.file.name
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Expanded Image Modal */}
                            {expandedImage === result.file.name && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
                                        <div className="p-4 border-b flex items-center justify-between">
                                            <h3 className="text-lg font-semibold">
                                                {result.file.name}
                                            </h3>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setExpandedImage(null)
                                                }
                                            >
                                                Close
                                            </Button>
                                        </div>
                                        <div className="p-4">
                                            <img
                                                src={result.preview}
                                                alt={`Expanded view of ${result.file.name}`}
                                                className="max-w-full h-auto"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Fragment>
                    ))}
                </div>

                {/* Summary */}
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Total images: {results.length}
                        </span>
                        <span className="text-muted-foreground">
                            Successfully processed:{" "}
                            {
                                results.filter(
                                    (r) =>
                                        !r.isLoading &&
                                        !r.error &&
                                        r.extractedIngredients.length > 0
                                ).length
                            }
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
