// Cross-reference: for each diagrams _type, show what Layer 1 CWEs it would get
// from both CWE-699 subcategories and applicablePlatforms.technologies

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Current Layer 1 mapping (from our JSON)
const layer1 = {
  "database": {
    "cwe699": ["CWE-1214", "CWE-19"],
    "tech": ["Database Server"]
  },
  "network": {
    "cwe699": ["CWE-137", "CWE-417"],
    "tech": ["Web Server"]
  },
  "security-auth": {
    "cwe699": ["CWE-1211", "CWE-1212", "CWE-255"],
    "tech": []
  },
  "security-crypto": {
    "cwe699": ["CWE-310", "CWE-320"],
    "tech": []
  },
  "storage": {
    "cwe699": ["CWE-1219"],
    "tech": []
  },
  "queue": {
    "cwe699": ["CWE-417", "CWE-557"],
    "tech": []
  },
  "logging": {
    "cwe699": ["CWE-1210"],
    "tech": []
  },
  "compute": {
    "cwe699": ["CWE-1218", "CWE-399"],
    "tech": []
  },
  "client": {
    "cwe699": ["CWE-355"],
    "tech": ["Web Server"]
  }
};

// Potential new categories based on _type values we saw
const potentialNew = {
  "iot": {
    "cwe699": ["CWE-417", "CWE-1218", "CWE-399"],
    "tech": ["Microcontroller Hardware", "Sensor Hardware"]
  },
  "container": {
    "cwe699": ["CWE-557", "CWE-265", "CWE-399", "CWE-452"],
    "tech": []
  },
  "ml": {
    "cwe699": [],
    "tech": ["AI/ML"]
  },
  "web": {
    "cwe699": ["CWE-137", "CWE-1215", "CWE-355", "CWE-1217"],
    "tech": ["Web Server"]
  },
  "integration": {
    "cwe699": ["CWE-1228", "CWE-137", "CWE-840"],
    "tech": []
  }
};

async function run() {
  const allCategories = { ...layer1, ...potentialNew };

  for (const [catName, config] of Object.entries(allCategories)) {
    const cweSet = new Set();

    // CWE-699 members
    if (config.cwe699.length > 0) {
      const members = await p.cweCategoryMember.findMany({
        where: { categoryId: { in: config.cwe699 } },
        select: { cweId: true }
      });
      members.forEach(m => cweSet.add(m.cweId));
    }

    // applicablePlatforms.technologies
    for (const techKeyword of config.tech) {
      const cwes = await p.$queryRaw`
        SELECT id FROM cwes
        WHERE applicable_platforms::jsonb -> 'technologies' @> ${JSON.stringify([{ name: techKeyword }])}::jsonb
      `;
      cwes.forEach(c => cweSet.add(c.id));
    }

    const sorted = Array.from(cweSet).sort();
    const isNew = catName in potentialNew;
    console.log(`${isNew ? '[NEW] ' : ''}${catName}: ${sorted.length} CWEs from ${config.cwe699.length} subcategories + ${config.tech.length} tech keywords`);
    console.log(`  CWE-699: ${config.cwe699.join(', ') || 'none'}`);
    console.log(`  Tech: ${config.tech.join(', ') || 'none'}`);
    console.log(`  CWEs: ${sorted.join(', ')}`);
    console.log('');
  }

  await p.$disconnect();
}

run().catch(e => { console.error(e); p.$disconnect(); });
