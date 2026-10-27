import { cn } from "@/lib/utils";
import { KIND_META } from "@/lib/report";
import type { DisplayDrug, DisplayPair } from "./types";

interface PairMatrixProps {
  drugs: DisplayDrug[];
  pairs: DisplayPair[];
  onPick: (id: string) => void;
}

/** Drug × drug table: one coloured cell per pair, easier to scan than a network once there are more than a few drugs. */
export function PairMatrix({ drugs, pairs, onPick }: PairMatrixProps) {
  const find = (a: string, b: string) => pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card px-4 py-4 sm:px-5">
      <p className="text-sm text-muted-foreground">Mỗi ô là một cặp thuốc. Bấm vào ô để mở giải thích.</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1.5">
          <thead>
            <tr>
              <td />
              {drugs.map((d) => (
                <th key={d.label} scope="col" className="w-[120px] min-w-[96px] px-1 pb-1 text-center align-bottom text-[13px] leading-tight font-bold">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drugs.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="max-w-[180px] pr-2 text-right text-[13px] leading-tight font-bold">
                  {row.label}
                </th>
                {drugs.map((col) => {
                  const p = row.label === col.label ? undefined : find(row.label, col.label);
                  if (!p) return <td key={col.label} className="h-13 rounded-lg bg-muted/60" aria-hidden={row.label === col.label} />;
                  const meta = KIND_META[p.kind];
                  const pendingInteraction = p.pending && p.status === "interaction";
                  return (
                    <td key={col.label} className="p-0">
                      <button
                        type="button"
                        onClick={() => onPick(p.id)}
                        aria-label={`${row.label} và ${col.label}: ${pendingInteraction ? "có tương tác, đang đánh giá" : meta.answer}`}
                        className={cn(
                          "min-h-13 w-full rounded-lg px-1.5 py-1 text-xs leading-tight font-bold transition-transform hover:scale-[1.04]",
                          pendingInteraction ? "bg-foreground text-background" : meta.badge,
                        )}
                      >
                        {pendingInteraction ? "Có tương tác" : meta.short}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
