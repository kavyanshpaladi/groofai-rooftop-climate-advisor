import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Crosshair, Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { toast } from "sonner";
import { fetchSuggestions, searchAddress, type Place, type Suggestion } from "@/lib/geocode";
import { useI18n } from "@/lib/i18n";

const PIN_MS = 4000;

export function SearchBox({ map, onSearch }: { map: L.Map | null; onSearch?: () => void }) {
  const { tx } = useI18n();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [photonDown, setPhotonDown] = useState(false);
  const [locating, setLocating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const skipRef = useRef(false);
  const pinRef = useRef<L.Marker | null>(null);

  // Debounced Photon autocomplete; aborts stale requests.
  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return; }
    const term = q.trim();
    ctrlRef.current?.abort();
    if (term.length < 3) { setResults([]); setLoading(false); setOpen(false); return; }
    const t = setTimeout(async () => {
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setLoading(true); setOpen(true); setActive(-1);
      try {
        const list = await fetchSuggestions(term, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setResults(list); setPhotonDown(false);
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === "AbortError") return;
        setResults([]); setPhotonDown(true); setOpen(false);
        toast.error(tx("Suggestions are unavailable. Press Enter to search instead."));
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  useEffect(() => () => { ctrlRef.current?.abort(); pinRef.current?.remove(); }, []);

  function flyTo(p: Pick<Place, "lat" | "lon">) {
    if (!map) return;
    map.flyTo([p.lat, p.lon], 18, { duration: 1.2 });
    pinRef.current?.remove();
    const pin = L.marker([p.lat, p.lon], {
      interactive: false,
      icon: L.divIcon({ className: "search-pin", html: '<span class="search-pin-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
    }).addTo(map);
    pinRef.current = pin;
    setTimeout(() => { pin.remove(); if (pinRef.current === pin) pinRef.current = null; }, PIN_MS);
  }

  function select(s: Suggestion) {
    ctrlRef.current?.abort();
    skipRef.current = true;
    setQ(s.name); setResults([]); setOpen(false); setActive(-1); setLoading(false); setMsg(null);
    onSearch?.();
    flyTo(s);
  }

  async function fallbackSearch() {
    const term = q.trim();
    if (!term) return;
    setLoading(true); setMsg(null);
    try {
      const p = await searchAddress(term);
      if (p) { onSearch?.(); flyTo(p); } else setMsg(tx("No places found."));
    } catch { toast.error(tx("Search is unavailable right now.")); }
    finally { setLoading(false); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && results.length) {
      e.preventDefault(); setOpen(true); setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp" && results.length) {
      e.preventDefault(); setOpen(true); setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = results[active] ?? (open ? results[0] : undefined);
      if (pick) select(pick);
      else if (photonDown) void fallbackSearch();
    } else if (e.key === "Escape") {
      setOpen(false); setActive(-1);
    }
  }

  function locate() {
    setMsg(null);
    if (!("geolocation" in navigator)) { setMsg(tx("Your browser can't share your location.")); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); flyTo({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      (err) => {
        setLocating(false);
        setMsg(tx(err.code === err.PERMISSION_DENIED
          ? "Location access is turned off. Allow it in your browser settings, or search an address instead."
          : "We couldn't find your location. Try searching an address instead."));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const showList = open && q.trim().length >= 3 && (loading || results.length > 0 || !photonDown);

  return (
    <div ref={rootRef} className="relative flex flex-1 flex-col">
      <Toaster position="top-center" />
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setMsg(null); }}
            onFocus={() => results.length && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={tx("Search an address")}
            role="combobox"
            aria-expanded={showList}
            aria-controls="place-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `place-opt-${active}` : undefined}
            className="h-11 w-full rounded-lg border border-input bg-card py-2 pl-3 pr-9 text-base shadow-sm outline-none focus:ring-2 focus:ring-ring md:h-10 md:text-sm"
          />
          {loading && <Loader2 aria-label={tx("Searching")} className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <Button type="button" variant="outline" onClick={locate} disabled={locating || !map}
          aria-label={tx("Use my current location")} title={tx("Use my current location")} className="h-11 w-11 bg-card p-0 md:h-10 md:w-10">
          {locating ? <Loader2 className="animate-spin" /> : <Crosshair />}
        </Button>
      </div>

      {showList && (
        <ul id="place-suggestions" role="listbox"
          className="absolute inset-x-0 top-full z-[1100] mt-1 overflow-hidden rounded-xl border border-border bg-card py-1 text-card-foreground shadow-lg">
          {results.map((s, i) => (
            <li key={s.id} id={`place-opt-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(s)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-14 cursor-pointer items-center gap-3 px-3 py-3 md:min-h-0 md:py-2 ${i === active ? "bg-primary/10" : "hover:bg-primary/10"}`}>
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{s.name}</p>
                {s.detail && <p className="truncate text-xs text-muted-foreground">{s.detail}</p>}
              </div>
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted-foreground">{tx("No places found")}</li>
          )}
          {loading && results.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{tx("Searching…")}</li>
          )}
        </ul>
      )}
      {msg && <p className="mt-1 rounded bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">{msg}</p>}
    </div>
  );
}
