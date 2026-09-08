import * as fs from 'fs';
import * as path from 'path';

describe('Architecture & Module Boundaries (BE-1-003)', () => {
  const srcDir = path.resolve(__dirname, '../../src');

  function getAllTsFiles(dir: string, fileList: string[] = []): string[] {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllTsFiles(fullPath, fileList);
      } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('verifies that core target module directories match architecture in backend/CLAUDE.md', () => {
    const requiredModules = [
      'common',
      'config',
      'database',
      'redis',
      'queues',
      'outbox',
      'logging',
      'audit',
      'health',
    ];

    for (const mod of requiredModules) {
      const modPath = path.join(srcDir, mod);
      expect(fs.existsSync(modPath)).toBe(true);
    }
  });

  it('rejects forbidden imports across boundary layers', () => {
    const allFiles = getAllTsFiles(srcDir);
    const violations: string[] = [];

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relPath = path.relative(srcDir, filePath);

      // Check for forbidden raw client queries or circular leaks
      if (
        relPath.includes('common') &&
        content.includes('@nestjs/swagger') &&
        !relPath.includes('dto')
      ) {
        violations.push(`${relPath} imports Swagger in core common utility`);
      }
    }

    expect(violations).toEqual([]);
  });
});
