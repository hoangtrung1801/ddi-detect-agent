import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { v2API } from "@/lib/api";
import { KIND_META, pairKind, type InteractionReport } from "@/lib/report";

interface Turn {
  question: string;
  answer: string | null;
  error?: boolean;
}

function contextFor(report: InteractionReport): string {
  const pairs = report.pairs.map((p) => `${p.a} + ${p.b}: ${KIND_META[pairKind(p)].label}`).join("; ");
  return `Ngữ cảnh: người dùng vừa kiểm tra tương tác thuốc. Kết quả: ${pairs}.`;
}

function suggestionsFor(report: InteractionReport): string[] {
  const out: string[] = [];
  const top = report.pairs.find((p) => p.status === "interaction");
  if (top) out.push(`Nếu phải dùng ${top.a} và ${top.b} cùng lúc thì cần lưu ý gì?`);
  const unresolved = report.drugs.find((d) => !d.dbName);
  if (unresolved) out.push(`Thành phần của “${unresolved.input}” là gì?`);
  out.push("Dấu hiệu nào cho thấy tôi cần đi khám ngay?");
  return out.slice(0, 3);
}

/** Follow-up questions about the current result, answered by the v2 chat agent. */
export function AskAboutResult({ report }: { report: InteractionReport }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const busy = turns.some((t) => t.answer === null && !t.error);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setQuestion("");
    setTurns((t) => [...t, { question: text, answer: null }]);
    try {
      // Only the first question needs the result as context; later ones share the session.
      const res = await v2API.chat(sessionId ? text : `${contextFor(report)}\n\nCâu hỏi: ${text}`, sessionId);
      setSessionId(res.session_id);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: res.answer } : x)));
    } catch {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, answer: "Không gửi được câu hỏi. Vui lòng thử lại.", error: true } : x)));
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(question);
  };

  return (
    <section aria-labelledby="ask-title" className="flex flex-col gap-3 rounded-2xl border bg-card px-5 py-4 print:hidden">
      <h2 id="ask-title" className="text-[15px] font-bold">
        Hỏi thêm về kết quả này
      </h2>

      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="self-end rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">{t.question}</div>
              <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
                {t.answer === null ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Đang trả lời…
                  </span>
                ) : (
                  <div className="prose-sm [&_li]:ml-4 [&_ol]:list-decimal [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.answer}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {turns.length === 0 && (
        <div className="flex flex-col gap-1.5">
          {suggestionsFor(report).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              className="min-h-11 rounded-[10px] border bg-muted/60 px-3 py-2 text-left text-sm hover:border-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="ask-input" className="sr-only">
          Câu hỏi của bạn
        </label>
        <Input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Câu hỏi của bạn…"
          className="h-11 bg-card"
        />
        <Button type="submit" size="icon-lg" className="size-11 shrink-0" disabled={busy || !question.trim()} aria-label="Gửi câu hỏi">
          <ArrowRight aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}
