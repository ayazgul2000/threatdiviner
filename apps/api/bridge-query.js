const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  // Get all CWE-699 subcategories with their member counts
  const cats = await p.cweCategory.findMany({
    where: { viewId: 'CWE-699' },
    include: { _count: { select: { members: true } } },
    orderBy: { name: 'asc' }
  });

  console.log('=== CWE-699 Subcategories ===');
  cats.forEach(c => console.log(c.id + ' | ' + c.name + ' | ' + c._count.members + ' members'));

  // Get unique technology values from applicablePlatforms
  const cwes = await p.cwe.findMany({
    select: { id: true, applicablePlatforms: true }
  });

  const techValues = {};
  cwes.forEach(c => {
    const ap = c.applicablePlatforms;
    if (ap && ap.technologies) {
      ap.technologies.forEach(t => {
        if (t.name && t.name !== 'Not Technology-Specific') {
          if (!techValues[t.name]) techValues[t.name] = [];
          techValues[t.name].push(c.id);
        }
      });
    }
  });

  console.log('');
  console.log('=== applicablePlatforms.technologies ===');
  Object.keys(techValues).sort().forEach(k => {
    console.log(k + ' | ' + techValues[k].length + ' CWEs | ' + techValues[k].slice(0, 5).join(', ') + (techValues[k].length > 5 ? '...' : ''));
  });

  // Get unique language values
  const langValues = {};
  cwes.forEach(c => {
    const ap = c.applicablePlatforms;
    if (ap && ap.languages) {
      ap.languages.forEach(l => {
        if (l.name && l.name !== 'Not Language-Specific' && l.name !== 'Language-Independent') {
          if (!langValues[l.name]) langValues[l.name] = [];
          langValues[l.name].push(c.id);
        }
      });
    }
  });

  console.log('');
  console.log('=== applicablePlatforms.languages ===');
  Object.keys(langValues).sort().forEach(k => {
    console.log(k + ' | ' + langValues[k].length + ' CWEs');
  });

  await p.$disconnect();
}

run().catch(e => { console.error(e); p.$disconnect(); });
