import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { drugInteractionAPI, type DrugInput } from "@/lib/api";
import useAuthStore from "@/stores/use-auth-store";
import { DrugComposer, MAX_DRUGS, type DrugEntry, type PhotoEntry } from "@/components/check/DrugComposer";
import { AnalysisProgress } from "@/components/check/AnalysisProgress";
import { ResultsPanel } from "@/components/check/ResultsPanel";
import { useInteractionCheck } from "@/components/check/useInteractionCheck";

let nextId = 0;
const newId = () => `e${++nextId}`;
const norm = (s: string) => s.trim().toLowerCase();

interface InteractionCheckPageProps {
  /** Drugs to pre-fill and check immediately, e.g. from the medicine cabinet. */
  initialDrugs?: string[];
  onRequireLogin?: () => void;
}

export function InteractionCheckPage({ initialDrugs, onRequireLogin }: InteractionCheckPageProps) {
  const [drugs, setDrugs] = useState<DrugEntry[]>(() => (initialDrugs ?? []).map((name) => ({ id: newId(), name })));
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const check = useInteractionCheck();
  const { run, reset } = check;
  const { isAuthenticated, addInteractionCheck, addToMedicineCabinet } = useAuthStore();

  const runCheck = useCallback(
    async (inputs: DrugInput[]) => {
      const report = await run(inputs);
      const names = inputs.map((d) => (typeof d === "string" ? d : d.name));
      if (report && useAuthStore.getState().isAuthenticated) addInteractionCheck(names, report);
    },
    [run, addInteractionCheck],
  );

  // Check pre-filled drugs once on mount.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !initialDrugs || initialDrugs.length < 2) return;
    autoRan.current = true;
    void runCheck(initialDrugs);
  }, [initialDrugs, runCheck]);

  useEffect(() => {
    if (check.error) toast.error(check.error);
  }, [check.error]);

  // Any change to the list makes the shown result stale.
  const changeDrugs = (update: (prev: DrugEntry[]) => DrugEntry[]) => {
    setDrugs(update);
    if (check.report || check.error || check.running) reset();
  };

  const addDrug = (name: string, source?: string, ingredients?: string[]) =>
    changeDrugs((prev) =>
      prev.length >= MAX_DRUGS || prev.some((d) => norm(d.name) === norm(name))
        ? prev
        : [...prev, { id: newId(), name, source, ...(ingredients?.length ? { ingredients } : {}) }],
    );

  const readPhoto = async (photo: PhotoEntry) => {
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "loading" } : p)));
    try {
      const res = await drugInteractionAPI.extractDrugNamesFromImage(photo.file);
      const product = res.product_name?.trim() || undefined;
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "done", names: res.result, product } : p)));
      if (res.result.length > 1) {
        // One packaging photo is ONE drug made of several ingredients.
        addDrug(product ?? photo.file.name.replace(/\.[^.]+$/, ""), photo.file.name, res.result);
      } else {
        for (const name of res.result) addDrug(name, photo.file.name);
      }
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "error" } : p)));
    }
  };

  const addPhotos = (files: File[]) => {
    const entries: PhotoEntry[] = files.map((file) => ({
      id: newId(),
      file,
      preview: URL.createObjectURL(file),
      status: "loading",
      names: [],
    }));
    setPhotos((prev) => [...prev, ...entries]);
    for (const e of entries) void readPhoto(e);
  };

  const removePhoto = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    URL.revokeObjectURL(photo.preview);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    changeDrugs((prev) => prev.filter((d) => d.source !== photo.file.name));
  };

  const clearAll = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
    changeDrugs(() => []);
  };

  const saveToCabinet = async () => {
    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }
    const names = check.drugs.filter((d) => d.resolved).map((d) => d.label);
    setIsSaving(true);
    try {
      const added = await addToMedicineCabinet(names);
      toast.success(added ? `Đã thêm ${added} thuốc vào tủ thuốc` : "Các thuốc này đã có trong tủ thuốc");
    } catch {
      toast.error("Không lưu được vào tủ thuốc");
    } finally {
      setIsSaving(false);
    }
  };

  const fixDrug = () => {
    const unknown = check.report?.drugs.find((d) => !d.dbName);
    inputRef.current?.focus();
    if (unknown) toast.info(`Hãy xoá “${unknown.input}” và nhập tên hoạt chất in trên hộp thuốc.`);
  };

  const resolved = check.report?.drugs ?? check.resolved;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 print:hidden">
        <DrugComposer
          ref={inputRef}
          drugs={drugs}
          photos={photos}
          resolved={resolved}
          running={check.running}
          onAddDrug={(name) => addDrug(name)}
          onRemoveDrug={(id) => changeDrugs((prev) => prev.filter((d) => d.id !== id))}
          onClearAll={clearAll}
          onAddPhotos={addPhotos}
          onRemovePhoto={removePhoto}
          onRetryPhoto={(id) => {
            const p = photos.find((x) => x.id === id);
            if (p) void readPhoto(p);
          }}
          onCheck={() => void runCheck(drugs.map((d) => (d.ingredients?.length ? { name: d.name, ingredients: d.ingredients } : d.name)))}
        />
        {(check.running || check.report) && (
          <AnalysisProgress steps={check.steps} running={check.running} resolved={resolved} pairs={check.report?.pairs ?? check.livePairs} />
        )}
      </div>

      <div className="flex min-w-0 flex-[999_1_600px] flex-col">
        <ResultsPanel
          drugs={check.drugs}
          pairs={check.pairs}
          report={check.report}
          running={check.running}
          onSave={saveToCabinet}
          isSaving={isSaving}
          onFixDrug={fixDrug}
        />
      </div>
    </div>
  );
}
