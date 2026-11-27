import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { advisorRequestSchema, type AdvisorNeeds } from "./advisor";
import { billResultSchema, fillNeedsFromBill, type BillResult } from "./bill";
import type { AdvisorPhoto } from "./advisor-image";

const DRAFT_KEY = "groofai-advisor-progress";
const BILL_KEY = "groofai-advisor-bill";
const draftSchema = z.object({ photo: advisorRequestSchema.shape.image.nullable(), needs: advisorRequestSchema.shape.needs,
  step: z.number().int().min(0).max(2), bill: billResultSchema.nullable() });
export type AdvisorDraft = { photo: AdvisorPhoto | null; needs: AdvisorNeeds; step: number; bill: BillResult | null };
type Progress = { save: (draft: AdvisorDraft) => void; load: () => AdvisorDraft | null;
  transfer: (bill: BillResult) => void; takeBill: () => BillResult | null; revision: number };
const Context = createContext<Progress | null>(null);

/** Per-visit memory survives navigation even when session storage rejects a large roof photo. */
export function AdvisorProgressProvider({ children }: { children: ReactNode }) {
  const draft = useRef<AdvisorDraft | null>(null);
  const pending = useRef<BillResult | null>(null);
  const [revision, setRevision] = useState(0);
  const save = useCallback((next: AdvisorDraft) => {
    draft.current = next;
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...next,
      photo: next.photo ? { mimeType: next.photo.mimeType, data: next.photo.data } : null })); } catch { /* memory fallback */ }
  }, []);
  const load = useCallback(() => {
    if (draft.current) return draft.current;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = draftSchema.parse(JSON.parse(raw));
      return { ...parsed, photo: parsed.photo ? { ...parsed.photo, url: `data:${parsed.photo.mimeType};base64,${parsed.photo.data}` } : null };
    } catch { return null; }
  }, []);
  const transfer = useCallback((bill: BillResult) => {
    pending.current = bill;
    const previous = load();
    if (previous) save({ ...previous, needs: fillNeedsFromBill(previous.needs, bill), bill, step: 1 });
    try { sessionStorage.setItem(BILL_KEY, JSON.stringify(bill)); } catch { /* memory fallback */ }
    setRevision((value) => value + 1);
  }, [load, save]);
  const takeBill = useCallback(() => {
    let bill = pending.current;
    pending.current = null;
    try {
      const raw = sessionStorage.getItem(BILL_KEY);
      sessionStorage.removeItem(BILL_KEY);
      if (!bill && raw) bill = billResultSchema.parse(JSON.parse(raw));
    } catch { /* memory fallback */ }
    return bill;
  }, []);
  return <Context.Provider value={{ save, load, transfer, takeBill, revision }}>{children}</Context.Provider>;
}

export function useAdvisorProgress() {
  const context = useContext(Context);
  if (!context) throw new Error("Advisor progress provider missing");
  return context;
}