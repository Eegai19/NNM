import { useEffect } from "react";

/** Keep the browser tab title in sync with the active page. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · NNM`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
