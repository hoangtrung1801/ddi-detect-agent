import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Loader2, LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { RISK_META, type InteractionReport, type OverallRisk } from "@/lib/report";
import useAuthStore, { type InteractionCheckRecord } from "@/stores/use-auth-store";

interface PatientProfileProps {
  /** Opens the check page with these drugs and runs the check. */
  onCheckDrugs: (drugs: string[]) => void;
  onRequireLogin: () => void;
}

/** Interaction partners from the cabinet API text: "Tương tác giữa A và B: … | …". */
function partnersOf(drug: string, interactions?: string | null): string[] {
  if (!interactions) return [];
  const out = new Set<string>();
  for (const part of interactions.split("|")) {
    const m = part.trim().match(/^Tương tác giữa\s+(.+?)\s+và\s+(.+?):/i);
    if (!m) continue;
    const [a, b] = [m[1]!.trim(), m[2]!.trim()];
    out.add(a.toLowerCase() === drug.toLowerCase() ? b : a);
  }
  return [...out];
}

const RISK_DOT: Record<OverallRisk, string> = {
  high: "bg-sev-major",
  medium: "bg-sev-moderate",
  low: "bg-sev-minor",
  none: "bg-neutral-line",
  unknown: "border-[1.5px] border-neutral-stroke",
};

function riskOf(record: InteractionCheckRecord): OverallRisk | null {
  const r = record.result as Partial<InteractionReport> | null;
  return r && typeof r === "object" && typeof r.overall_risk === "string" && r.overall_risk in RISK_META ? (r.overall_risk as OverallRisk) : null;
}

const GENDER_LABEL: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

export function PatientProfile({ onCheckDrugs, onRequireLogin }: PatientProfileProps) {
  const { user, logout, updateProfile, fetchMedicineCabinet, removeDrugFromCabinet, addToMedicineCabinet } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [newDrug, setNewDrug] = useState("");
  const [busyDrug, setBusyDrug] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "" });

  useEffect(() => {
    if (user?.id) void fetchMedicineCabinet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Tủ thuốc cá nhân</h1>
        <p className="text-muted-foreground">Đăng nhập để lưu thuốc đang dùng và được cảnh báo khi thêm thuốc mới có tương tác.</p>
        <Button className="h-11 px-6" onClick={onRequireLogin}>
          Đăng nhập
        </Button>
      </div>
    );
  }

  const cabinet = (user.personalMedicineCabinet ?? []).map((d) => (typeof d === "string" ? { drug_name: d } : d));
  const names = cabinet.map((d) => d.drug_name);
  const flagged = cabinet.filter((d) => partnersOf(d.drug_name, d.interactions).length > 0);
  const history = user.interactionHistory ?? [];

  const startEdit = () => {
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      dateOfBirth: user.dateOfBirth ?? "",
      gender: user.gender ?? "",
      address: user.address ?? "",
    });
    setIsEditing(true);
  };

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateProfile({ ...form, gender: (form.gender || undefined) as "male" | "female" | "other" | undefined });
    setIsEditing(false);
    toast.success("Đã lưu hồ sơ");
  };

  const addDrug = async (e: FormEvent) => {
    e.preventDefault();
    const name = newDrug.trim();
    if (!name) return;
    setBusyDrug(name);
    try {
      const added = await addToMedicineCabinet([name]);
      if (added) {
        toast.success(`Đã thêm ${name}`);
        setNewDrug("");
      } else toast.info(`${name} đã có trong tủ thuốc hoặc không nhận diện được`);
    } finally {
      setBusyDrug(null);
    }
  };

  const removeDrug = async (name: string) => {
    setBusyDrug(name);
    try {
      await removeDrugFromCabinet(name);
    } catch {
      toast.error(`Không xoá được ${name}`);
    } finally {
      setBusyDrug(null);
    }
  };

  const profileRows: [string, string | undefined][] = [
    ["Email", user.email],
    ["Số điện thoại", user.phone],
    ["Ngày sinh", user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString("vi-VN") : undefined],
    ["Giới tính", user.gender ? GENDER_LABEL[user.gender] : undefined],
    ["Địa chỉ", user.address],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Tủ thuốc của tôi</h1>
          <p className="mt-1 text-muted-foreground">Lưu các thuốc đang dùng để kiểm tra tương tác giữa chúng bất cứ lúc nào.</p>
        </div>
        <Button className="h-11 px-5" disabled={names.length < 2} onClick={() => onCheckDrugs(names)}>
          Kiểm tra cả tủ thuốc
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>

      {flagged.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-sev-major/30 bg-sev-major-soft px-5 py-4">
          <AlertTriangle className="size-5 shrink-0 text-sev-major" aria-hidden="true" />
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="font-bold text-sev-major-ink">{flagged.length} thuốc trong tủ có tương tác với thuốc khác</div>
            <div className="text-sm text-sev-major-ink/90">Xem sơ đồ để biết cặp nào và mức độ ra sao.</div>
          </div>
          <Button variant="outline" className="h-11 bg-card" onClick={() => onCheckDrugs(names)}>
            Xem chi tiết
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <aside aria-labelledby="profile-title" className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-lg font-bold text-brand-ink">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="profile-title" className="truncate text-base font-bold">
                {user.name || user.email}
              </h2>
              <div className="text-sm text-muted-foreground">Hồ sơ cá nhân</div>
            </div>
            {!isEditing && (
              <Button variant="ghost" className="h-11" onClick={startEdit}>
                Sửa
              </Button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={saveProfile} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-name">Họ và tên</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-phone">Số điện thoại</Label>
                <Input id="p-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-dob">Ngày sinh</Label>
                  <Input id="p-dob" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} className="h-10" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="p-gender">Giới tính</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger id="p-gender" className="h-10">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Nam</SelectItem>
                      <SelectItem value="female">Nữ</SelectItem>
                      <SelectItem value="other">Khác</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="p-address">Địa chỉ</Label>
                <Textarea id="p-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="h-11">
                  Lưu
                </Button>
                <Button type="button" variant="outline" className="h-11" onClick={() => setIsEditing(false)}>
                  Huỷ
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-3">
              {profileRows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className={cn("font-medium break-words", !v && "text-muted-foreground")}>{v || "Chưa cập nhật"}</dd>
                </div>
              ))}
            </dl>
          )}

          <Button variant="outline" className="mt-2 h-11" onClick={logout}>
            <LogOut aria-hidden="true" />
            Đăng xuất
          </Button>
        </aside>

        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-6">
          <section aria-labelledby="cabinet-title" className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex flex-col gap-3 border-b px-6 py-5">
              <h2 id="cabinet-title" className="text-base font-bold">
                Đang dùng ({cabinet.length})
              </h2>
              <form onSubmit={addDrug} className="flex gap-2">
                <label htmlFor="cabinet-add" className="sr-only">
                  Thêm thuốc vào tủ
                </label>
                <Input
                  id="cabinet-add"
                  value={newDrug}
                  onChange={(e) => setNewDrug(e.target.value)}
                  placeholder="Thêm thuốc, VD: Warfarin"
                  className="h-11 bg-card"
                />
                <Button type="submit" className="h-11 px-4" disabled={!newDrug.trim() || busyDrug !== null}>
                  {busyDrug === newDrug.trim() && busyDrug ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
                  Thêm
                </Button>
              </form>
            </div>
            {cabinet.length === 0 ? (
              <p className="px-6 py-8 text-center text-muted-foreground">
                Chưa có thuốc nào. Thêm ở trên, hoặc bấm “Lưu vào tủ thuốc” sau khi kiểm tra tương tác.
              </p>
            ) : (
              <ul>
                {cabinet.map((d) => {
                  const partners = partnersOf(d.drug_name, d.interactions);
                  return (
                    <li key={d.drug_name} className={cn("flex items-center gap-3 border-t px-6 py-3 first:border-t-0", partners.length && "bg-sev-major-soft/40")}>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{d.drug_name}</div>
                        {partners.length > 0 && <div className="text-sm text-muted-foreground">Tương tác với {partners.join(", ")}</div>}
                      </div>
                      {partners.length > 0 ? (
                        <span className="shrink-0 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background">
                          {partners.length} tương tác
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-neutral-line bg-neutral-soft px-2.5 py-0.5 text-xs font-semibold text-neutral-ink">
                          Chưa ghi nhận
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-11 shrink-0"
                        disabled={busyDrug === d.drug_name}
                        onClick={() => void removeDrug(d.drug_name)}
                        aria-label={`Xoá ${d.drug_name}`}
                      >
                        {busyDrug === d.drug_name ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-title" className="flex flex-col rounded-2xl border bg-card px-6 py-5">
            <h2 id="history-title" className="pb-2 text-base font-bold">
              Lần kiểm tra gần đây
            </h2>
            {history.length === 0 ? (
              <p className="py-2 text-muted-foreground">Chưa có lần kiểm tra nào.</p>
            ) : (
              history.slice(0, 8).map((h) => {
                const risk = riskOf(h);
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onCheckDrugs(h.drugs)}
                    className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-t py-3 text-left first:border-t-0 hover:bg-muted/40"
                  >
                    <span className={cn("size-2.5 shrink-0 rounded-full", risk ? RISK_DOT[risk] : "bg-border")} aria-hidden="true" />
                    <span className="min-w-0 flex-[1_1_240px] font-medium">{h.drugs.join(", ")}</span>
                    <span className="text-sm font-semibold text-muted-foreground">{risk ? RISK_META[risk].label : "Kết quả cũ"}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{new Date(h.timestamp).toLocaleDateString("vi-VN")}</span>
                  </button>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
