import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pill, Loader2 } from "lucide-react";
import { ImageUpload } from "./components/ImageUpload";
import {
    MultiImageResults,
    type ImageResult,
} from "./components/MultiImageResults";
import { DrugList } from "./components/DrugList";
import { InteractionResults } from "./components/InteractionResults";
import { Button } from "./components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "./components/ui/card";
import { drugInteractionAPI } from "./lib/api";
import "./App.css";

function App() {
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imageResults, setImageResults] = useState<ImageResult[]>([]);
    const [detectedDrugs, setDetectedDrugs] = useState<string[]>([]);
    const [interactionResult, setInteractionResult] = useState<string>("");
    const [isProcessingImages, setIsProcessingImages] = useState(false);

    // Drug name extraction mutation
    const drugExtractionMutation = useMutation({
        mutationFn: async (file: File) => {
            const result = await drugInteractionAPI.extractDrugNamesFromImage(
                file
            );
            return result;
        },
        onError: (error) => {
            console.error("Drug extraction error:", error);
        },
    });

    // Drug interaction query mutation
    const interactionMutation = useMutation({
        mutationFn: async (drugs: string[]) => {
            const question =
                drugs.length === 1
                    ? `Show me all interactions for ${drugs[0]}`
                    : `What are the interactions between ${drugs.join(", ")}?`;

            const response = await drugInteractionAPI.query(question);
            return response;
        },
        onSuccess: (data) => {
            setInteractionResult(data.answer);
        },
        onError: (error) => {
            console.error("API Error:", error);
            alert(
                "Failed to check interactions. Please make sure the backend is running."
            );
        },
    });

    // Process multiple images
    const processImages = useCallback(
        async (files: File[]) => {
            setIsProcessingImages(true);
            // Don't clear existing results - append new ones
            setInteractionResult("");

            const newResults: ImageResult[] = files.map((file) => ({
                file,
                preview: URL.createObjectURL(file),
                extractedIngredients: [],
                isLoading: true,
            }));

            setImageResults((prev) => [...prev, ...newResults]);

            // Process each image
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    // const result =
                    //     await drugInteractionAPI.extractDrugNamesFromImage(file);
                    const result = await drugExtractionMutation.mutateAsync(
                        file
                    );

                    setImageResults((prev) =>
                        prev.map((imgResult) =>
                            imgResult.file.name === file.name
                                ? {
                                      ...imgResult,
                                      extractedIngredients: result.result,
                                      isLoading: false,
                                  }
                                : imgResult
                        )
                    );

                    // Add to detected drugs list
                    setDetectedDrugs((prev) => {
                        const newDrugs = result.result.filter(
                            (drug) => !prev.includes(drug)
                        );
                        return [...prev, ...newDrugs];
                    });
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    setImageResults((prev) =>
                        prev.map((imgResult) =>
                            imgResult.file.name === file.name
                                ? {
                                      ...imgResult,
                                      isLoading: false,
                                      error: "Failed to extract ingredients",
                                  }
                                : imgResult
                        )
                    );
                }
            }

            setIsProcessingImages(false);
        },
        [drugExtractionMutation]
    );

    const handleImageSelect = (files: File[]) => {
        setSelectedImages(files);
        // Don't process immediately - wait for user to click OK button
    };

    const handleStartExtraction = () => {
        if (selectedImages.length > 0) {
            // Only process images that haven't been processed yet
            const processedFileNames = imageResults.map(
                (result) => result.file.name
            );
            const unprocessedImages = selectedImages.filter(
                (img) => !processedFileNames.includes(img.name)
            );

            if (unprocessedImages.length > 0) {
                processImages(unprocessedImages);
            }
        }
    };

    const handleClearImages = () => {
        setSelectedImages([]);
        setImageResults([]);
        setDetectedDrugs([]);
        setInteractionResult("");
    };

    const handleRemoveImage = (fileName: string) => {
        const newImages = selectedImages.filter((img) => img.name !== fileName);
        setSelectedImages(newImages);

        setImageResults((prev) => {
            const newResults = prev.filter(
                (result) => result.file.name !== fileName
            );
            return newResults;
        });

        // Update detected drugs list
        const removedResult = imageResults.find(
            (result) => result.file.name === fileName
        );
        if (removedResult) {
            setDetectedDrugs((prev) =>
                prev.filter(
                    (drug) => !removedResult.extractedIngredients.includes(drug)
                )
            );
        }
    };

    const handleRetryImage = (fileName: string) => {
        const file = selectedImages.find((img) => img.name === fileName);
        if (file) {
            processImages([file]);
        }
    };

    const handleRemoveDrug = (drug: string) => {
        setDetectedDrugs((prev) => prev.filter((d) => d !== drug));
        setInteractionResult("");
    };

    const handleCheckInteractions = () => {
        if (detectedDrugs.length === 0) {
            alert("Please upload an image with drug names first.");
            return;
        }
        interactionMutation.mutate(detectedDrugs);
    };

    const isProcessing = isProcessingImages;
    const isCheckingInteractions = interactionMutation.isPending;

    return (
        <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <Pill className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Drug Interaction Checker
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-lg">
                        Upload images of your medication labels to extract
                        active ingredients and check for potential drug
                        interactions
                    </p>
                </div>

                {/* Main Content */}
                <div className="space-y-6">
                    {/* Upload Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 1: Upload Images</CardTitle>
                            <CardDescription>
                                Upload images of your medication labels to
                                extract active ingredients
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ImageUpload
                                onImageSelect={handleImageSelect}
                                onClear={handleClearImages}
                                selectedImages={selectedImages}
                                isProcessing={isProcessing}
                                maxFiles={5}
                            />

                            {/* OK Button to Start Extraction */}
                            {selectedImages.length > imageResults.length &&
                                !isProcessingImages && (
                                    <div className="mt-4">
                                        <Button
                                            variant="default"
                                            onClick={handleStartExtraction}
                                            disabled={isProcessing}
                                            className="w-full"
                                            size="lg"
                                        >
                                            {imageResults.length === 0
                                                ? "OK - Extract Drug Names"
                                                : `Extract ${
                                                      selectedImages.length -
                                                      imageResults.length
                                                  } More Image${
                                                      selectedImages.length -
                                                          imageResults.length >
                                                      1
                                                          ? "s"
                                                          : ""
                                                  }`}
                                        </Button>
                                    </div>
                                )}

                            {/* Processing Progress */}
                            {isProcessingImages && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Processing images...
                                        </span>
                                        <span className="font-medium">
                                            {
                                                imageResults.filter(
                                                    (r) => !r.isLoading
                                                ).length
                                            }{" "}
                                            of {selectedImages.length} completed
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-primary h-2 rounded-full transition-all duration-300"
                                            style={{
                                                width: `${
                                                    selectedImages.length > 0
                                                        ? (imageResults.filter(
                                                              (r) =>
                                                                  !r.isLoading
                                                          ).length /
                                                              selectedImages.length) *
                                                          100
                                                        : 0
                                                }%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Image Results */}
                    {imageResults.length > 0 && (
                        <MultiImageResults
                            results={imageResults}
                            onRemoveImage={handleRemoveImage}
                            onRetryImage={handleRetryImage}
                        />
                    )}

                    {/* Detected Drugs */}
                    {detectedDrugs.length > 0 && (
                        <>
                            <DrugList
                                drugs={detectedDrugs}
                                onRemoveDrug={handleRemoveDrug}
                                onAddDrug={(drug) =>
                                    setDetectedDrugs([...detectedDrugs, drug])
                                }
                            />

                            {/* Check Interactions Button */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        Step 2: Check Interactions
                                    </CardTitle>
                                    <CardDescription>
                                        Analyze the detected drugs for potential
                                        interactions
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button
                                        variant="default"
                                        onClick={handleCheckInteractions}
                                        disabled={
                                            detectedDrugs.length === 0 ||
                                            isCheckingInteractions
                                        }
                                        className="w-full"
                                        size="lg"
                                    >
                                        {isCheckingInteractions ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Checking Interactions...
                                            </>
                                        ) : (
                                            `Check Interactions for ${
                                                detectedDrugs.length
                                            } Drug${
                                                detectedDrugs.length !== 1
                                                    ? "s"
                                                    : ""
                                            }`
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {/* Results */}
                    <InteractionResults
                        result={interactionResult}
                        isLoading={isCheckingInteractions}
                    />

                    {/* Info Footer */}
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="pt-6">
                            <div className="flex gap-3">
                                <div className="text-blue-600 mt-1">ℹ️</div>
                                <div className="text-sm text-blue-900">
                                    <p className="font-medium mb-1">
                                        Important Notice
                                    </p>
                                    <p className="text-blue-800">
                                        This tool is for informational purposes
                                        only. Always consult with a healthcare
                                        professional before making any changes
                                        to your medication regimen. This is not
                                        a substitute for professional medical
                                        advice.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default App;
