import { InjectionToken } from '@angular/core';

/**
 * Injection token used in tests and during app bootstrap to provide the global `document`.
 *
 * Why: Vitest + Vite can struggle with Angular's reflection-based DI metadata.
 * Using explicit tokens avoids relying on emitted decorator metadata.
 */
export const DOCUMENT_TOKEN = new InjectionToken<Document>('DOCUMENT_TOKEN');

