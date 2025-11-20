import { X } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface DrugListProps {
    drugs: string[];
    onRemoveDrug: (drug: string) => void;
    onAddDrug: (drug: string) => void;
}

export function DrugList({ drugs, onRemoveDrug }: DrugListProps) {
    if (drugs.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Thuốc Đã Phát Hiện</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-2">
                    {drugs.map((drug, index) => (
                        <Badge
                            key={`${drug}-${index}`}
                            variant="secondary"
                            className="text-sm px-3 py-1.5 flex items-center gap-2"
                        >
                            {drug}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0 hover:bg-transparent"
                                onClick={() => onRemoveDrug(drug)}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </Badge>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Đã phát hiện {drugs.length} thuốc. Xóa những thuốc không
                    chính xác.
                </p>
            </CardContent>
        </Card>
    );
}
