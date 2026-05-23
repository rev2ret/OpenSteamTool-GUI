const fs = require('fs');
const p = 'src/Hook/Patterns.h';
let data = fs.readFileSync(p, 'utf8');
data = data.replace(/\{"1778281814", (.*?)\},  \/\/ stable/g, `{"1779486452", $1},  // new stable\n    {"1778281814", $1},  // stable`);
fs.writeFileSync(p, data);
console.log('Patched!');
