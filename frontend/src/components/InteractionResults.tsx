import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface InteractionResultsProps {
    result: string;
    isLoading: boolean;
}

export function InteractionResults({
    result,
    isLoading,
}: InteractionResultsProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Analyzing Interactions...
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Checking for drug interactions in our database...
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!result) {
        return null;
    }

    // Determine severity based on keywords in the result
    const getSeverity = (text: string): "info" | "warning" | "safe" => {
        const lowerText = text.toLowerCase();
        if (
            lowerText.includes("no interaction") ||
            lowerText.includes("no known interaction") ||
            lowerText.includes("safe")
        ) {
            return "safe";
        }
        if (
            lowerText.includes("severe") ||
            lowerText.includes("dangerous") ||
            lowerText.includes("contraindicated") ||
            lowerText.includes("bleeding") ||
            lowerText.includes("toxicity")
        ) {
            return "warning";
        }
        return "info";
    };

    const severity = getSeverity(result);

    const getIcon = () => {
        switch (severity) {
            case "safe":
                return <CheckCircle className="h-5 w-5 text-green-600" />;
            case "warning":
                return <AlertTriangle className="h-5 w-5 text-red-600" />;
            default:
                return <Info className="h-5 w-5 text-blue-600" />;
        }
    };

    const getTitle = () => {
        switch (severity) {
            case "safe":
                return "No Interactions Found";
            case "warning":
                return "Interaction Warning";
            default:
                return "Interaction Information";
        }
    };

    return (
        <Alert
            variant={severity === "warning" ? "destructive" : "default"}
            className="mt-6"
        >
            <div className="flex items-start gap-3">
                {getIcon()}
                <div className="flex-1">
                    <AlertTitle className="text-base font-semibold mb-2">
                        {getTitle()}
                    </AlertTitle>
                    <AlertDescription className="text-sm leading-relaxed whitespace-pre-wrap">
                        {result}
                    </AlertDescription>
                </div>
            </div>
        </Alert>
    );
}
