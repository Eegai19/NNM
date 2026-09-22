import { Loader2, Search, X } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { getErrorMessage } from "@/services/api";
import { searchService } from "@/services/search.service";
import type { GlobalSearchResponse, SearchHit } from "@/types";
import { cn } from "@/utils/cn";

const GROUPS: { key: keyof GlobalSearchResponse; label: string }[] = [
  { key: "nodes", label: "Nodes" },
  { key: "activities", label: "Activities" },
  { key: "engineers", label: "People" },
  { key: "circles", label: "Circles" },
  { key: "products", label: "Products" },
];

/** Type-ahead search across every entity, shown in the top bar. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<GlobalSearchResponse | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const debounced = useDebounce(query, 300);

  React.useEffect(() => {
    let cancelled = false;
    const term = debounced.trim();

    if (term.length < 2) {
      setResults(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    void searchService
      .global(term, 1, 5)
      .then((response) => {
        if (!cancelled) {
          setResults(response);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setResults(null);
          setError(getErrorMessage(cause, "Search failed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // Close the dropdown on an outside click or Escape.
  React.useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      // Ctrl/Cmd+K focuses the search box, like Jira and ServiceNow.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        containerRef.current?.querySelector("input")?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const goTo = (hit: SearchHit) => {
    setOpen(false);
    setQuery("");
    navigate(hit.url);
  };

  const groups = GROUPS.map((group) => ({
    ...group,
    page: results ? (results[group.key] as GlobalSearchResponse["nodes"]) : null,
  })).filter((group) => group.page && group.page.items.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search nodes, activities, people…"
        aria-label="Global search"
        className="pl-9 pr-9"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setResults(null);
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-popover p-2 shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : error ? (
            <p className="p-3 text-sm text-destructive">{error}</p>
          ) : groups.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No matches for “{query.trim()}”
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.key as string} className="py-1">
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                  <span className="ml-1 font-normal normal-case">({group.page?.total})</span>
                </p>
                {group.page?.items.map((hit) => (
                  <button
                    key={`${hit.type}-${hit.id}`}
                    type="button"
                    onClick={() => goTo(hit)}
                    className={cn(
                      "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="font-medium">{hit.title}</span>
                    {hit.subtitle ? (
                      <span className="text-xs text-muted-foreground">{hit.subtitle}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
