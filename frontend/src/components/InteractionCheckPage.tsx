import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { drugInteractionAPI, type DrugInput } from "@/lib/api";
import useAuthStore from "@/stores/use-auth-store";
import { CheckStart } from "@/components/check/CheckStart";
import { DrugBar, resolutionOf } from "@/components/check/DrugBar";
import { ResultsPanel } from "@/components/check/ResultsPanel";
import { useInteractionCheck } from "@/components/check/useInteractionCheck";
import { photoErrorMessage, prepareImage } from "@/lib/image";
import { MAX_DRUGS, type DrugEntry, type PhotoEntry, type ProductKind } from "@/components/check/types";

let nextId = 0;
const newId = () => `e${++nextId}`;
const norm = (s: string) => s.trim().toLowerCase();
const toInputs = (list: DrugEntry[]): DrugInput[] => list.map((d) => (d.ingredients?.length ? { name: d.name, ingredients: d.ingredients } : d.name));

interface InteractionCheckPageProps {
  /** Drugs to pre-fill and check immediately, e.g. from the medicine cabinet. */
  initialDrugs?: string[];
  onRequireLogin?: () => void;
}

/** Two steps on one page: collect the drugs, then the verdict and every pair. */
export function InteractionCheckPage({ initialDrugs, onRequireLogin }: InteractionCheckPageProps) {
  const [drugs, setDrugs] = useState<DrugEntry[]>(() => (initialDrugs ?? []).map((name) => ({ id: newId(), name })));
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Result step: shown from the first run until the user starts over.
  const [showResult, setShowResult] = useState(false);
  const [stale, setStale] = useState(false);
  const [fixId, setFixId] = useState<string | null>(null);
  const [photoView, setPhotoView] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const check = useInteractionCheck();
  const { run, reset } = check;
  const { user, isAuthenticated, addInteractionCheck, addToMedicineCabinet } = useAuthStore();

  const runCheck = useCallback(
    async (list: DrugEntry[]) => {
      setShowResult(true);
      setStale(false);
      setFixId(null);
      window.scrollTo({ top: 0 });
      const report = await run(toInputs(list));
      if (report && useAuthStore.getState().isAuthenticated) addInteractionCheck(list.map((d) => d.name), report);
    },
    [run, addInteractionCheck],
  );

  // Check pre-filled drugs once on mount.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || drugs.length < 2) return;
    autoRan.current = true;
    void runCheck(drugs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!check.error) return;
    toast.error(check.error);
    setStale(true);
  }, [check.error]);

  // On the result step a change keeps the old result on screen, marked as out of date.
  const changeDrugs = (update: (prev: DrugEntry[]) => DrugEntry[]) => {
    setDrugs(update);
    if (showResult) setStale(true);
  };

  const addDrug = (name: string, source?: string, ingredients?: string[], kind?: ProductKind) =>
    changeDrugs((prev) =>
      prev.length >= MAX_DRUGS || prev.some((d) => norm(d.name) === norm(name))
        ? prev
        : [...prev, { id: newId(), name, source, ...(ingredients?.length ? { ingredients, kind: kind ?? "multi" } : {}) }],
    );

  const readPhoto = async (photo: PhotoEntry) => {
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "loading" } : p)));
    let stage: "convert" | "upload" = "convert";
    try {
      const prepared = await prepareImage(photo.file);
      stage = "upload";
      const res = await drugInteractionAPI.extractDrugNamesFromImage(prepared);
      const product = res.product_name?.trim() || undefined;
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "done", names: res.result, product } : p)));
      if (res.result.length > 1) {
        // One packaging photo is ONE product made of several ingredients.
        addDrug(product ?? photo.file.name.replace(/\.[^.]+$/, ""), photo.file.name, res.result);
      } else {
        for (const name of res.result) addDrug(name, photo.file.name);
      }
    } catch (e) {
      const error = photoErrorMessage(e, stage);
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: "error", error } : p)));
      toast.error(`${photo.file.name}: ${error}`);
    }
  };

  const addPhotos = (files: File[]) => {
    const entries: PhotoEntry[] = files.map((file) => ({ id: newId(), file, preview: URL.createObjectURL(file), status: "loading", names: [] }));
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

  const clearPhotos = () => {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  };

  const startOver = () => {
    reset();
    clearPhotos();
    setDrugs([]);
    setShowResult(false);
    setStale(false);
    setFixId(null);
    window.scrollTo({ top: 0 });
  };

  const applyFix = (id: string, names: string[]) => {
    const next = drugs.map((d) =>
      d.id !== id ? d : d.ingredients?.length || names.length > 1 ? { ...d, ingredients: names, kind: d.kind ?? "multi" } : { ...d, name: names[0]! },
    );
    setDrugs(next);
    void runCheck(next);
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

  const resolved = check.report?.drugs ?? check.resolved;
  const toFix = drugs.filter((d) => resolutionOf(d, resolved).needsFix);
  const cabinet = isAuthenticated && user ? (user.personalMedicineCabinet ?? []).map((d) => (typeof d === "string" ? d : d.drug_name)) : null;

  if (!showResult) {
    return (
      <CheckStart
        ref={inputRef}
        drugs={drugs}
        photos={photos}
        cabinet={cabinet}
        onAddDrug={(name) => addDrug(name)}
        onAddProduct={(name, ingredients, kind) => addDrug(name, undefined, ingredients, kind)}
        onRemoveDrug={(id) => changeDrugs((prev) => prev.filter((d) => d.id !== id))}
        onClearAll={() => {
          clearPhotos();
          setDrugs([]);
        }}
        onAddPhotos={addPhotos}
        onRemovePhoto={removePhoto}
        onRetryPhoto={(id) => {
          const p = photos.find((x) => x.id === id);
          if (p) void readPhoto(p);
        }}
        onCheck={() => void runCheck(drugs)}
        onRequireLogin={onRequireLogin}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 sm:px-6">
      <DrugBar
        drugs={drugs}
        resolved={resolved}
        running={check.running}
        stale={stale}
        fixId={fixId}
        photos={photos}
        onViewPhoto={setPhotoView}
        onFix={setFixId}
        onApplyFix={applyFix}
        onAddDrug={(name) => addDrug(name)}
        onRemoveDrug={(id) => changeDrugs((prev) => prev.filter((d) => d.id !== id))}
        onRerun={() => void runCheck(drugs)}
        onNewCheck={startOver}
      />
      <ResultsPanel
        drugs={check.drugs}
        pairs={check.pairs}
        report={check.report}
        running={check.running}
        steps={check.steps}
        resolved={resolved}
        livePairs={check.livePairs}
        unresolved={toFix.map((d) => d.name)}
        stale={stale}
        photos={photos}
        photoView={photoView}
        onViewPhoto={setPhotoView}
        onSave={saveToCabinet}
        isSaving={isSaving}
        onFixDrug={() => setFixId(toFix[0]?.id ?? null)}
      />
    </div>
  );
}
