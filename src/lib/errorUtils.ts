export type NormalizedError = {
  message: string;
  name?: string;
  code?: string;
  status?: number;
  details?: unknown;
};

export function normalizeError(err: unknown): NormalizedError {
  if (!err) return { message: "Unknown error" };

  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message || "Error",
      details: { stack: err.stack },
    };
  }

  // Supabase/PostgREST errors are often plain objects
  if (typeof err === "object") {
    const anyErr = err as Record<string, any>;
    const message =
      (typeof anyErr.message === "string" && anyErr.message) ||
      (typeof anyErr.error === "string" && anyErr.error) ||
      (typeof anyErr.msg === "string" && anyErr.msg) ||
      JSON.stringify(anyErr);

    return {
      message,
      code: typeof anyErr.code === "string" ? anyErr.code : undefined,
      status: typeof anyErr.status === "number" ? anyErr.status : undefined,
      details: anyErr,
    };
  }

  return { message: String(err) };
}
