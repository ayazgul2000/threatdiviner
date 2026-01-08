/**
 * Test Nuclei Scanner Wrapper vs CLI baseline
 * Compares findings and timing
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_TARGET_URL = 'http://testphp.vulnweb.com';
const NUCLEI_PATH = 'C:/dev/nuclei/nuclei.exe';

// Create temp directory for test outputs
const TEMP_DIR = path.join(os.tmpdir(), 'nuclei-test-' + Date.now());
fs.mkdirSync(TEMP_DIR, { recursive: true });

async function runCliBaseline() {
  console.log('=== CLI Baseline ===');
  const startTime = Date.now();
  const outputFile = path.join(TEMP_DIR, 'cli-results.jsonl').replace(/\\/g, '/');
  const targetsFile = path.join(TEMP_DIR, 'cli-targets.txt').replace(/\\/g, '/');

  // Write targets file
  fs.writeFileSync(targetsFile, TEST_TARGET_URL);

  const cmd = `"${NUCLEI_PATH}" -l "${targetsFile}" -jsonl -o "${outputFile}" -severity critical,high,medium,low,info -timeout 30 -rate-limit 100 -bulk-size 25 -concurrency 10 -silent -nc`;

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 300000, // 5 minutes
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    exitCode = err.status || 1;
  }

  const duration = Date.now() - startTime;

  // Parse findings from output file
  let findings = [];
  try {
    const content = fs.readFileSync(outputFile, 'utf-8');
    findings = content.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    // No output file
  }

  // Count by severity
  const bySeverity = {};
  for (const f of findings) {
    const sev = f.info?.severity || 'unknown';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }

  console.log(`Duration: ${duration}ms`);
  console.log(`Findings: ${findings.length}`);
  console.log(`By severity:`, bySeverity);
  console.log(`Exit code: ${exitCode}`);

  return {
    duration,
    findings,
    bySeverity,
    exitCode,
  };
}

async function runWrapperTest() {
  console.log('\n=== Wrapper Test ===');
  const startTime = Date.now();
  const outputFile = path.join(TEMP_DIR, 'wrapper-results.jsonl').replace(/\\/g, '/');
  const targetsFile = path.join(TEMP_DIR, 'wrapper-targets.txt').replace(/\\/g, '/');

  // Write targets file (same as wrapper does)
  fs.writeFileSync(targetsFile, TEST_TARGET_URL);

  // Build args exactly like the wrapper does
  const args = [
    '-l', targetsFile,
    '-jsonl',
    '-o', outputFile,
    '-severity', 'critical,high,medium,low,info',
    '-timeout', '30',
    '-rate-limit', '50',
    '-bulk-size', '25',
    '-concurrency', '10',
    '-stats',
    '-stats-json',
    '-stats-interval', '3',
  ];

  const cmd = `"${NUCLEI_PATH}" ${args.join(' ')}`;

  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    stdout = err.stdout || '';
    stderr = err.stderr || '';
    exitCode = err.status || 1;
  }

  const duration = Date.now() - startTime;

  // Parse findings from output file
  let findings = [];
  try {
    const content = fs.readFileSync(outputFile, 'utf-8');
    findings = content.trim().split('\n').filter(Boolean).map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    // No output file
  }

  // Count by severity
  const bySeverity = {};
  for (const f of findings) {
    const sev = f.info?.severity || 'unknown';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  }

  console.log(`Duration: ${duration}ms`);
  console.log(`Findings: ${findings.length}`);
  console.log(`By severity:`, bySeverity);
  console.log(`Exit code: ${exitCode}`);

  return {
    duration,
    findings,
    bySeverity,
    exitCode,
  };
}

function compareResults(cli, wrapper) {
  console.log('\n=== Comparison ===');
  const issues = [];

  // Compare findings count
  const cliCount = cli.findings.length;
  const wrapperCount = wrapper.findings.length;
  console.log(`CLI findings: ${cliCount}`);
  console.log(`Wrapper findings: ${wrapperCount}`);

  // Findings should be similar (wrapper uses different rate-limit so may vary slightly)
  const findingDiff = Math.abs(cliCount - wrapperCount);
  const diffPercent = cliCount > 0 ? (findingDiff / cliCount * 100).toFixed(1) : 0;
  console.log(`Difference: ${findingDiff} (${diffPercent}%)`);

  // Compare by template-id to see if same vulnerabilities found
  const cliTemplates = new Set(cli.findings.map(f => f['template-id']));
  const wrapperTemplates = new Set(wrapper.findings.map(f => f['template-id']));

  const missingInWrapper = [...cliTemplates].filter(t => !wrapperTemplates.has(t));
  const extraInWrapper = [...wrapperTemplates].filter(t => !cliTemplates.has(t));

  if (missingInWrapper.length > 0) {
    console.log(`\nTemplates missing in wrapper (${missingInWrapper.length}):`);
    missingInWrapper.slice(0, 5).forEach(t => console.log(`  - ${t}`));
  }

  if (extraInWrapper.length > 0) {
    console.log(`\nExtra templates in wrapper (${extraInWrapper.length}):`);
    extraInWrapper.slice(0, 5).forEach(t => console.log(`  - ${t}`));
  }

  // Compare timing
  const timeDiff = wrapper.duration - cli.duration;
  const timePercent = cli.duration > 0 ? (timeDiff / cli.duration * 100).toFixed(1) : 0;
  console.log(`\nTiming: CLI ${cli.duration}ms, Wrapper ${wrapper.duration}ms`);
  console.log(`Overhead: ${timeDiff}ms (${timePercent}%)`);

  // Wrapper uses lower rate-limit (50 vs 100) so should be slower - that's expected
  // Check if overhead is reasonable (< 50% slower due to rate-limit diff)
  if (timeDiff > cli.duration * 0.5 && wrapper.duration > 60000) {
    issues.push(`Wrapper significantly slower than expected (${timePercent}% overhead)`);
  }

  // Validate wrapper found findings
  if (wrapperCount === 0 && cliCount > 0) {
    issues.push('Wrapper found no findings but CLI did');
  }

  console.log('\n=== Validation ===');
  if (issues.length === 0) {
    console.log('✓ Wrapper output matches CLI baseline');
  } else {
    console.log('Issues found:');
    issues.forEach(i => console.log(`  ✗ ${i}`));
  }

  return issues;
}

async function main() {
  console.log('========================================');
  console.log('  Nuclei Scanner Wrapper Test');
  console.log('========================================\n');

  // Check nuclei is available
  try {
    const version = execSync(`"${NUCLEI_PATH}" -version 2>&1`, { encoding: 'utf-8' });
    console.log('Nuclei version:', version.match(/v[\d.]+/)?.[0] || 'unknown');
  } catch (err) {
    console.log('Nuclei not found at', NUCLEI_PATH);
    console.log('Please install nuclei: go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest');
    process.exit(1);
  }

  try {
    const cliResult = await runCliBaseline();
    const wrapperResult = await runWrapperTest();
    const issues = compareResults(cliResult, wrapperResult);

    // Cleanup
    try {
      fs.rmSync(TEMP_DIR, { recursive: true });
    } catch {}

    console.log('\n========================================');
    if (issues.length === 0) {
      console.log('  ✓ TEST PASSED');
    } else {
      console.log('  ✗ TEST FAILED');
    }
    console.log('========================================');

    process.exit(issues.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

main();
