import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

// Vitest/JSdom: Standalone-Components nutzen templateUrl/styleUrl.
// In der Vite/Vitest-Umgebung werden diese Ressourcen nicht automatisch via XHR geladen.
// Wir patchen den Angular ResourceLoader auf einen Vite-Import (raw), damit TestBed
// die Component-Templates/Styles kompilieren kann.
// (
//   getTestBed().inject(ResourceLoader) as unknown as { get: (url: string) => Promise<string> }
// ).get = async (url: string) => {
//   // url ist relativ zur TS-Datei. In unserem Projekt liegen alle Templates/Styles im src/.
//   const cleaned = url.replace(/^\.\//, '');
//   const mod = await import(/* @vite-ignore */ `./${cleaned}?raw`);
//   return (mod as any).default ?? String(mod);
// };
