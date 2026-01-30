import {
  HttpEvent,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Dev-Helfer: loggt alle /api Requests + Responses inkl. Body.
 * So sieht man sofort, ob der Proxy greift und ob JSON ankommt.
 */
export function httpLogInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> {
  const isApi = req.url.startsWith('/api');
  if (!isApi) return next(req);

  const started = performance.now();

  // eslint-disable-next-line no-console
  console.log(`[HTTP] -> ${req.method} ${req.urlWithParams}`);

  return next(req).pipe(
    tap({
      next: (ev) => {
        if (ev instanceof HttpResponse) {
          const ms = Math.round(performance.now() - started);
          // eslint-disable-next-line no-console
          console.log(`[HTTP] <- ${req.method} ${req.urlWithParams} ${ev.status} (${ms}ms)`);
          // eslint-disable-next-line no-console
          console.log('[HTTP] response body:', ev.body);
          try {
            // eslint-disable-next-line no-console
            console.log('[HTTP] response body (pretty):', JSON.stringify(ev.body, null, 2));
          } catch {
            // ignore stringify errors
          }
        }
      },
      error: (err) => {
        const ms = Math.round(performance.now() - started);
        // eslint-disable-next-line no-console
        console.error(`[HTTP] xx ${req.method} ${req.urlWithParams} (${ms}ms)`, err);
        if (err?.error != null) {
          // eslint-disable-next-line no-console
          console.error('[HTTP] error payload:', err.error);
        }
      },
    })
  );
}
