const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/App.tsx');
const content = fs.readFileSync(filePath, 'utf-8');

const searchStr = 'Sincronizar Meta';
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(searchStr)) {
    console.log(`Line ${i + 1}: ${lines[i].trim()}`);
    // Print 50 lines before and after
    for (let j = Math.max(0, i - 100); j < Math.min(lines.length, i + 100); j++) {
      console.log(`${j + 1}: ${lines[j]}`);
    }
    break;
  }
}
