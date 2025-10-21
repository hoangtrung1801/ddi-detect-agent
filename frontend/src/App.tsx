import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pill, Loader2 } from "lucide-react";
import { ImageUpload } from "./components/ImageUpload";
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
import { extractTextFromImage } from "./lib/ocr";
import { drugInteractionAPI } from "./lib/api";
import "./App.css";

function App() {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [detectedDrugs, setDetectedDrugs] = useState<string[]>([]);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [interactionResult, setInteractionResult] = useState<string>("");

    // OCR processing mutation
    const ocrMutation = useMutation({
        mutationFn: async (file: File) => {
            setOcrProgress(0);
            const result = await extractTextFromImage(file, setOcrProgress);
            return result;
        },
        onSuccess: (data) => {
            setDetectedDrugs(data.drugNames);
            setOcrProgress(100);
        },
        onError: (error) => {
            console.error("OCR Error:", error);
            alert("Failed to process image. Please try again.");
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

    const handleImageSelect = (file: File) => {
        setSelectedImage(file);
        setDetectedDrugs([]);
        setInteractionResult("");
        ocrMutation.mutate(file);
    };

    const handleClearImage = () => {
        setSelectedImage(null);
        setDetectedDrugs([]);
        setInteractionResult("");
        setOcrProgress(0);
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

    const isProcessing = ocrMutation.isPending;
    const isCheckingInteractions = interactionMutation.isPending;

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="rounded-full bg-primary/10 p-3">
                            <Pill className="h-8 w-8 text-primary" />
                        </div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            Drug Interaction Checker
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-lg">
                        Upload an image of your medication labels to check for
                        potential drug interactions
                    </p>
                </div>

                {/* Main Content */}
                <div className="space-y-6">
                    {/* Upload Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 1: Upload Image</CardTitle>
                            <CardDescription>
                                Take a photo of your medication labels or
                                prescription
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ImageUpload
                                onImageSelect={handleImageSelect}
                                onClear={handleClearImage}
                                selectedImage={selectedImage}
                                isProcessing={isProcessing}
                            />

                            {/* OCR Progress */}
                            {isProcessing && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                            Processing image...
                                        </span>
                                        <span className="font-medium">
                                            {ocrProgress}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-primary h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${ocrProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
