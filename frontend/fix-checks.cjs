const fs = require('fs');
const file = 'd:/vibe/aitziec-recruitment-platform/frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const implemented = new Set([
  'FE-3-001', 'FE-3-003', 'FE-3-004', 'FE-3-007', 'FE-3-008', 'FE-3-009',
  'FE-3-011', 'FE-3-012', 'FE-3-013', 'FE-3-014', 'FE-3-015', 'FE-3-016',
  'FE-3-017', 'FE-3-018', 'FE-3-019', 'FE-3-022',
  'FE-4-001', 'FE-4-002', 'FE-4-003', 'FE-4-004', 'FE-4-005', 'FE-4-006',
  'FE-4-007', 'FE-4-008', 'FE-4-009', 'FE-4-011', 'FE-4-012', 'FE-4-014',
  'FE-4-016', 'FE-4-017', 'FE-4-018', 'FE-4-019', 'FE-4-020'
]);

for (let i = 165; i < 225; i++) {
  // We want to process any line that is a task
  if (lines[i].includes('- [ ]') || lines[i].includes('- [x]')) {
    const match = lines[i].match(/\*\*(FE-[34]-\d{3})/);
    if (match) {
      if (implemented.has(match[1])) {
        lines[i] = lines[i].replace('- [ ]', '- [x]');
      } else {
        lines[i] = lines[i].replace('- [x]', '- [ ]');
      }
    }
  }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Fixed checkmarks properly!');
