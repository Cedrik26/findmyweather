import 'zone.js';
import 'zone.js/testing';
import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { ResourceLoader } from '@angular/compiler';

getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

const resourceModules = import.meta.glob('./app/**/*.{html,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const resourcesByFullPath = new Map<string, string>();
const resourcesByFileName = new Map<string, string>();

for (const [path, content] of Object.entries(resourceModules)) {
  const normalized = path.replace(/^\.\/app\//, '');
  resourcesByFullPath.set(normalized, content);
  resourcesByFileName.set(normalized.split('/').pop()!, content);
}

class VitestResourceLoader extends ResourceLoader {
  override async get(url: string): Promise<string> {
    const normalized = String(url)
      .replace(/^\.\//, '')
      .replace(/^src\/app\//, '')
      .replace(/^\/src\/app\//, '')
      .replace(/^file:\/\/.*?\/src\/app\//, '');

    const byPath = resourcesByFullPath.get(normalized);
    if (byPath != null) return byPath;

    const fileName = normalized.split('/').pop()!;
    const byFileName = resourcesByFileName.get(fileName);
    if (byFileName != null) return byFileName;

    throw new Error(`Resource not found in Vitest loader: ${url}`);
  }
}

getTestBed().configureCompiler({
  providers: [{ provide: ResourceLoader, useClass: VitestResourceLoader }],
});
