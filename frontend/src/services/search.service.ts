import { api } from "@/services/api";
import type { GlobalSearchResponse } from "@/types";

export const searchService = {
  async global(query: string, page = 1, pageSize = 5): Promise<GlobalSearchResponse> {
    const { data } = await api.get<GlobalSearchResponse>("/search", {
      params: { q: query, page, page_size: pageSize },
    });
    return data;
  },
};
