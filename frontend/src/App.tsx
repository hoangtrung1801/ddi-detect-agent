import { useState } from "react";
import { InteractionCheckPage } from "@/components/InteractionCheckPage";
import { PatientProfile } from "@/components/PatientProfile";
import { LoginDialog } from "@/components/LoginDialog";
import { LandingPage } from "@/components/landing/LandingPage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import useAuthStore from "@/stores/use-auth-store";

type Page = "home" | "interaction" | "cabinet";

const NAV: { id: Page; label: string }[] = [
  { id: "interaction", label: "Kiểm tra tương tác" },
  { id: "cabinet", label: "Tủ thuốc" },
];

function Logo() {
  return (
    <span className="flex size-[34px] items-center justify-center rounded-[9px] bg-primary">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground" aria-hidden="true">
        <path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    </span>
  );
}

function App() {
  const [page, setPage] = useState<Page>("home");
  // Drugs handed to the check page (from the landing page or the cabinet); the run counter remounts the page for a fresh check.
  const [prefill, setPrefill] = useState<{ drugs: string[]; run: number } | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  const go = (p: Page) => {
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  const checkDrugs = (drugs: string[]) => {
    setPrefill((p) => ({ drugs, run: (p?.run ?? 0) + 1 }));
    go("interaction");
  };

  const home = (
    <button type="button" onClick={() => go("home")} className="flex items-center gap-2.5">
      <Logo />
      <span className="text-lg font-bold tracking-tight">DDISafe</span>
    </button>
  );

  const account =
    isAuthenticated && user ? (
      <button type="button" onClick={() => go("cabinet")} className="flex min-h-11 items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-ink">
          {(user.name || user.email).charAt(0).toUpperCase()}
        </span>
        <span className="max-w-40 truncate font-semibold">{user.name || user.email}</span>
      </button>
    ) : (
      <Button variant="outline" className="h-11 px-4 font-semibold" onClick={() => setIsLoginOpen(true)}>
        Đăng nhập
      </Button>
    );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {page !== "home" && (
        <header className="border-b bg-card print:hidden">
          <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
            {home}
            <nav aria-label="Điều hướng chính" className="flex flex-1 flex-wrap gap-1">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  aria-current={page === n.id ? "page" : undefined}
                  onClick={() => go(n.id)}
                  className={cn(
                    "min-h-11 rounded-lg px-3.5 text-[15px] transition-colors",
                    page === n.id ? "bg-brand-soft font-semibold text-brand-ink" : "font-medium text-neutral-ink hover:bg-muted",
                  )}
                >
                  {n.label}
                </button>
              ))}
            </nav>
            {account}
          </div>
        </header>
      )}

      <main className="flex-1">
        {page === "home" ? (
          <LandingPage logo={home} account={account} onStart={checkDrugs} onOpenCheck={() => go("interaction")} />
        ) : page === "interaction" ? (
          <InteractionCheckPage key={prefill?.run ?? 0} initialDrugs={prefill?.drugs} onRequireLogin={() => setIsLoginOpen(true)} />
        ) : (
          <PatientProfile onCheckDrugs={checkDrugs} onRequireLogin={() => setIsLoginOpen(true)} />
        )}
      </main>

      <footer className="border-t bg-card print:hidden">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap justify-between gap-2 px-4 py-4 text-sm text-muted-foreground sm:px-6">
          <span>DDISafe — phát hiện tương tác thuốc bằng AI. Thông tin chỉ mang tính tham khảo.</span>
          <a
            href="https://github.com/hoangtrung1801/ddi-detect-agent"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            GitHub
          </a>
        </div>
      </footer>
      <LoginDialog open={isLoginOpen} onOpenChange={setIsLoginOpen} />
    </div>
  );
}

export default App;
