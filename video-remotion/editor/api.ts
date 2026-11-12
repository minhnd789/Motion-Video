import type { MediaMeta, Project } from "../src/engine/types";

export type ProjectInfo = { id: string; name: string; updatedAt: number };
export type SourceFile = { name: string; kind: "video" | "image" | "audio"; size: number; imported: boolean };
export type RenderState = {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  stage: string;
  output: string | null;
  error: string | null;
};

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Lỗi ${res.status}`);
  return body as T;
};

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  listProjects: () => request<ProjectInfo[]>("/api/projects"),
  getProject: (id: string) => request<Project>(`/api/projects/${encodeURIComponent(id)}`),
  saveProject: (project: Project) =>
    request<{ ok: true }>(`/api/projects/${encodeURIComponent(project.id)}`, {
      ...post(project),
      method: "PUT",
    }),
  listSources: () => request<{ dir: string; files: SourceFile[] }>("/api/sources"),
  importMedia: (name: string) => request<MediaMeta>("/api/import", post({ name })),
  startRender: (id: string) => request<RenderState>("/api/render", post({ id })),
  renderStatus: () => request<RenderState>("/api/render"),
  reveal: () => request<{ ok: true }>("/api/reveal", post({})),
};

export const thumbUrl = (sourceName: string) => `/api/thumb?name=${encodeURIComponent(sourceName)}`;
