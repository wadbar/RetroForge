import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace(/responseType:\s*(['"].*?['"])\s*\}\);/g, "responseType: $1,\n        settings: req.body.settings\n      });");
fs.writeFileSync('server.ts', content);
console.log("Replaced responseType in server.ts");
