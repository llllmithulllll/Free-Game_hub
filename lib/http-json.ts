export class HttpJsonError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "HttpJsonError";
    this.status = status;
  }
}

/**
 * XMLHttpRequest has a native timeout on Android. React Native fetch with
 * AbortController has stalled on some device/network combinations, leaving
 * catalog screens waiting indefinitely for their finally handlers.
 */
export function requestJson<T>(url: string, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new HttpJsonError(`HTTP ${xhr.status}`, xhr.status));
        return;
      }
      try {
        resolve(JSON.parse(xhr.responseText) as T);
      } catch {
        reject(new HttpJsonError("The service returned invalid JSON."));
      }
    };
    xhr.onerror = () => reject(new HttpJsonError("Could not connect. Check your internet connection or try another network."));
    xhr.ontimeout = () => reject(new HttpJsonError("The request timed out. Check your connection and try again."));
    xhr.onabort = () => reject(new HttpJsonError("The request was interrupted. Please try again."));
    try {
      xhr.send();
    } catch {
      reject(new HttpJsonError("Could not start the network request."));
    }
  });
}
