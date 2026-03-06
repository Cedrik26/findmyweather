import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { httpLogInterceptor } from './http-log.interceptor';

describe('httpLogInterceptor', () => {
  const originalNow = performance.now.bind(performance);

  beforeEach(() => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    performance.now = originalNow;
  });

  it('should pass through non-api requests without logging', () => {
    const req = new HttpRequest('GET', '/assets/logo.png');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200, body: { ok: true } })));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    httpLogInterceptor(req, next).subscribe();

    expect(next).toHaveBeenCalledWith(req);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should log api success responses', () => {
    const req = new HttpRequest('GET', '/api/stations');
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200, body: { ok: true } })));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(145);

    httpLogInterceptor(req, next).subscribe();

    expect(logSpy).toHaveBeenCalledWith('[HTTP] -> GET /api/stations');
    expect(logSpy).toHaveBeenCalledWith('[HTTP] <- GET /api/stations 200 (45ms)');
    expect(logSpy).toHaveBeenCalledWith('[HTTP] response body:', { ok: true });
  });

  it('should log api error responses including payload', () => {
    const req = new HttpRequest('POST', '/api/stations');
    const err = { error: { message: 'boom' } };
    const next = vi.fn().mockReturnValue(throwError(() => err));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(160);

    httpLogInterceptor(req, next).subscribe({ error: () => undefined });

    expect(errSpy).toHaveBeenCalledWith('[HTTP] xx POST /api/stations (60ms)', err);
    expect(errSpy).toHaveBeenCalledWith('[HTTP] error payload:', { message: 'boom' });
  });
});

