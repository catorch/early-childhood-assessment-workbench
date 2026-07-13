export interface ClientRouter {
  replace(href: string): void;
}

export function handleProtectedResponse(
  response: Response,
  router: ClientRouter,
  returnTo: string
): boolean {
  if (response.status === 401) {
    router.replace(`/session-expired?returnTo=${encodeURIComponent(returnTo)}`);
    return true;
  }
  if (response.status === 403 || response.status === 404) {
    router.replace("/unavailable");
    return true;
  }
  return false;
}

export async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { readonly error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
