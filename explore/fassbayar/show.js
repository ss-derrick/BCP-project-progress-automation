// Print the visible elements of an explore dump:  node explore/show.js 01-login
const fs = require('fs');
const dir = process.env.EXPLORE_OUT ?? 'explore-dumps';
const d = JSON.parse(fs.readFileSync(`${dir}/${process.argv[2]}.json`, 'utf8'));
console.log(d.url, '|', d.title);
for (const f of d.frames) {
  console.log('FRAME', f.url, f.name);
  for (const i of f.items) {
    if (!i.visible && process.argv[3] !== 'all') continue;
    const o = Object.fromEntries(Object.entries(i).filter(([k, v]) => v !== null && v !== '' && v !== undefined && k !== 'visible'));
    console.log(JSON.stringify(o));
  }
}
