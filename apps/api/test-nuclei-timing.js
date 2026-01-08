// Direct Nuclei scanner timing test
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const NUCLEI_PATH = 'C:/dev/nuclei/nuclei.exe';
const TARGET_URL = 'http://127.0.0.1:3500';

// Discovery templates (same as app uses)
const DISCOVERY_TEMPLATES = [
  'http/technologies',
  'http/exposed-panels',
  'http/misconfiguration',
];

async function runNucleiTiming() {
  console.log('=== NUCLEI API-EQUIVALENT TIMING TEST ===\n');
  console.log(`Target: ${TARGET_URL}`);
  console.log(`Nuclei: ${NUCLEI_PATH}\n`);

  // Create temp dir
  const workDir = path.join(os.tmpdir(), `nuclei-test-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  const targetsFile = path.join(workDir, 'targets.txt');
  const outputFile = path.join(workDir, 'results.json');

  // Write target URL
  fs.writeFileSync(targetsFile, TARGET_URL.replace(/localhost/gi, '127.0.0.1'));

  // Build args exactly as the app does (WITH NEW RATE LIMITS)
  const args = [
    '-l', targetsFile,
    '-json-export', outputFile,
    '-silent',
    '-no-color',
    '-rate-limit', '150',     // NEW: was 20
    '-bulk-size', '50',        // NEW: was 25
    '-concurrency', '50',      // NEW: was 10
  ];

  // Add discovery templates
  for (const template of DISCOVERY_TEMPLATES) {
    args.push('-t', template);
  }

  args.push('-timeout', '300'); // 5 min timeout

  console.log('Command:', NUCLEI_PATH, args.join(' '));
  console.log('\n--- Starting scan ---');

  const startTime = Date.now();

  return new Promise((resolve) => {
    const nuclei = spawn(NUCLEI_PATH, args, { cwd: workDir });

    let stdout = '';
    let stderr = '';

    nuclei.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    nuclei.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    nuclei.on('close', (code) => {
      const duration = (Date.now() - startTime) / 1000;

      console.log(`\n--- Scan complete ---`);
      console.log(`Exit code: ${code}`);
      console.log(`Duration: ${duration.toFixed(1)} seconds`);

      // Parse results
      if (fs.existsSync(outputFile)) {
        const content = fs.readFileSync(outputFile, 'utf-8').trim();
        let findings = [];

        if (content.startsWith('[')) {
          // JSON array format
          findings = JSON.parse(content);
        } else {
          // JSONL format
          findings = content.split('\n').filter(Boolean).map(line => JSON.parse(line));
        }

        console.log(`Findings: ${findings.length}`);

        if (findings.length > 0) {
          console.log('\nFindings by severity:');
          const bySeverity = {};
          for (const f of findings) {
            const sev = f.info?.severity || 'unknown';
            bySeverity[sev] = (bySeverity[sev] || 0) + 1;
          }
          Object.entries(bySeverity).sort().forEach(([sev, count]) => {
            console.log(`  ${sev}: ${count}`);
          });
        }
      } else {
        console.log('No output file created');
        if (stderr) console.log('Stderr:', stderr);
      }

      // Cleanup
      fs.rmSync(workDir, { recursive: true, force: true });

      resolve({ duration, code });
    });
  });
}

runNucleiTiming().catch(console.error);
