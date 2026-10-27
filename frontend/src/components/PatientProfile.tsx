import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, LogOut, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DrugSearch } from "@/components/check/DrugSearch";
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

/** History rows speak the same language as the verdict. */
const RISK_ANSWER: Record<OverallRisk, string> = {
  high: "Có cặp không nên dùng chung",
  medium: "Có cặp cần theo dõi",
  low: "Chỉ có tương tác nhẹ",
  none: "Không ghi nhận tương tác",
  unknown: "Chưa kiểm tra được hết",
};

function riskOf(record: InteractionCheckRecord): OverallRisk | null {
  const r = record.result as Partial<InteractionReport> | null;
  return r && typeof r === "object" && typeof r.overall_risk === "string" && r.overall_risk in RISK_META ? (r.overall_risk as OverallRisk) : null;
}

const GENDER_LABEL: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

export function PatientProfile({ onCheckDrugs, onRequireLogin }: PatientProfileProps) {
  const { user, logout, updateProfile, fetchMedicineCabinet, removeDrugFromCabinet, addToMedicineCabinet } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [busyDrug, setBusyDrug] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", dateOfBirth: "", gender: "", address: "" });

  useEffect(() => {
    if (user?.id) void fetchMedicineCabinet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Tủ thuốc của tôi</h1>
        <p className="text-muted-foreground">Đăng nhập để lưu thuốc đang dùng và được cảnh báo khi thêm thuốc mới có tương tác.</p>
        <Button className="h-11 px-6" onClick={onRequireLogin}>
          Đăng nhập
        </Button>
      </div>
    );
  }

  const cabinet = (user.personalMedicineCabinet ?? []).map((d) => (typeof d === "string" ? { drug_name: d } : d));
  const names = cabinet.map((d) => d.drug_name);
  const history = user.interactionHistory ?? [];
  // Each interacting pair once, as a task to deal with.
  const issues = [
    ...new Map(
      cabinet.flatMap((d) =>
        partnersOf(d.drug_name, d.interactions).map((p) => {
          const pair = [d.drug_name, p].sort((x, y) => x.localeCompare(y)) as [string, string];
          return [pair.join("\u0000").toLowerCase(), pair] as const;
        }),
      ),
    ).values(),
  ];
  const lastCheck = history[0] ? new Date(history[0].timestamp).toLocaleDateString("vi-VN") : null;

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

  const addDrug = async (name: string) => {
    setBusyDrug(name);
    try {
      const added = await addToMedicineCabinet([name]);
      if (added) toast.success(`Đã thêm ${name}`);
      else toast.info(`${name} đã có trong tủ thuốc hoặc không nhận diện được`);
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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Tủ thuốc của tôi</h1>
          <p className="mt-1 text-muted-foreground">
            {cabinet.length} thuốc đang dùng{lastCheck ? ` · kiểm tra lần cuối ${lastCheck}` : ""}
          </p>
        </div>
        <Button variant="outline" className="h-11 bg-card px-4 font-semibold" disabled={names.length < 2} onClick={() => onCheckDrugs(names)}>
          <RotateCw aria-hidden="true" />
          Kiểm tra lại cả tủ
        </Button>
      </div>

      {issues.length > 0 && (
        <section aria-labelledby="issues-title" className="overflow-hidden rounded-2xl border border-sev-major/30 bg-card">
          <div className="flex items-center gap-2.5 bg-sev-major-soft px-5 py-3.5">
            <AlertTriangle className="size-5 shrink-0 text-sev-major" aria-hidden="true" />
            <h2 id="issues-title" className="font-bold text-sev-major-ink">
              {issues.length} việc cần xử lý trong tủ thuốc
            </h2>
          </div>
          <ul>
            {issues.map(([a, b]) => (
              <li key={`${a}|${b}`} className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t px-5 py-4 first:border-t-0">
                <div className="flex min-w-0 flex-[1_1_360px] flex-col">
                  <span className="text-[17px] font-bold">
                    {a} và {b} có tương tác
                  </span>
                  <span className="text-neutral-ink">Xem mức độ, điều gì xảy ra và nên làm gì trước khi dùng tiếp.</span>
                </div>
                <Button variant="outline" className="h-11 bg-card font-semibold" onClick={() => onCheckDrugs([a, b])}>
                  Xem giải thích
                  <ArrowRight aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-labelledby="cabinet-title" className="flex min-w-0 flex-[999_1_620px] flex-col gap-3">
          <h2 id="cabinet-title" className="text-lg font-bold">
            Thuốc đang dùng
          </h2>
          <div className="flex flex-col gap-1.5 rounded-2xl border bg-card p-4">
            <span className="text-sm font-semibold" aria-hidden="true">
              Thêm thuốc vào tủ
            </span>
            <DrugSearch onAdd={(n) => void addDrug(n)} disabled={busyDrug !== null} placeholder="VD: Warfarin, Panadol…" inputClassName="h-11 rounded-xl border pl-11 text-[15px]" />
          </div>

          {cabinet.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card px-6 py-10 text-center text-muted-foreground">
              Chưa có thuốc nào. Thêm ở trên, hoặc bấm “Lưu thuốc vào tủ thuốc” sau khi kiểm tra.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {cabinet.map((d) => {
                const partners = partnersOf(d.drug_name, d.interactions);
                return (
                  <li
                    key={d.drug_name}
                    className={cn("flex flex-col gap-3 rounded-2xl border bg-card px-4 py-3.5", partners.length && "border-sev-major/30 bg-sev-major-soft/30")}
                  >
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 pt-1.5 text-[17px] font-bold break-words">{d.drug_name}</h3>
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        className="size-10 shrink-0"
                        disabled={busyDrug === d.drug_name}
                        onClick={() => void removeDrug(d.drug_name)}
                        aria-label={`Bỏ ${d.drug_name} khỏi tủ thuốc`}
                      >
                        {busyDrug === d.drug_name ? <Loader2 className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5 border-t pt-2.5 text-sm">
                      {partners.length ? (
                        partners.map((p) => (
                          <div key={p} className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-[3px] bg-sev-major" aria-hidden="true" />
                            <span>
                              Có tương tác với <b>{p}</b>
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-neutral-ink">
                          <Check className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden="true" />
                          Chưa ghi nhận tương tác với thuốc khác trong tủ
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <section aria-labelledby="profile-title" className="flex flex-col gap-4 rounded-2xl border bg-card px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-ink">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="profile-title" className="truncate font-bold">
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
                    <dt className="text-[13px] text-muted-foreground">{k}</dt>
                    <dd className={cn("font-semibold break-words", !v && "font-normal text-muted-foreground")}>{v || "Chưa cập nhật"}</dd>
                  </div>
                ))}
              </dl>
            )}

            <Button variant="outline" className="h-11" onClick={logout}>
              <LogOut aria-hidden="true" />
              Đăng xuất
            </Button>
          </section>

          <section aria-labelledby="history-title" className="flex flex-col rounded-2xl border bg-card px-5 py-4">
            <h2 id="history-title" className="pb-2 font-bold">
              Lần kiểm tra trước
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
                    className="flex flex-col gap-0.5 border-t py-2.5 text-left first:border-t-0 hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className={cn("size-2 shrink-0 rounded-full", risk ? RISK_DOT[risk] : "bg-border")} aria-hidden="true" />
                      <b>{risk ? RISK_ANSWER[risk] : "Kết quả cũ"}</b>
                      <span className="ml-auto text-muted-foreground tabular-nums">{new Date(h.timestamp).toLocaleDateString("vi-VN")}</span>
                    </span>
                    <span className="font-medium">{h.drugs.join(", ")}</span>
                  </button>
                );
              })
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
