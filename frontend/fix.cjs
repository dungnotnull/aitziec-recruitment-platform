const fs = require('fs');
const file = 'd:/vibe/aitziec-recruitment-platform/frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/â€”/g, '—').replace(/â€“/g, '–');

fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
