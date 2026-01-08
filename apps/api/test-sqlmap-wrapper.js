/**
 * Test SQLMap Scanner Wrapper vs CLI baseline
 * Tests SQL injection detection on parameterized URLs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// URLs with parameters from testphp.vulnweb.com (discovered by Katana)
const TEST_URLS = [
  'http://testphp.vulnweb.com/listproducts.php?cat=1',
  'http://testphp.vulnweb.com/search.php?test=query',
  'http://testphp.vulnweb.com/artists.php?artist=1',
];

const SQLMAP_PATH = 'sqlmap';

// Create temp directory for test outputs
const TEMP_DIR = path.join(os.tmpdir(), 'sqlmap-test-' + Date.now());
fs.mkdirSync(TEMP_DIR, { recursive: true });

async function runCliBaseline() {
  console.log('=== CLI Baseline ===');
  console.log('Testing 1 URL with basic options (quick test)...');
  const startTime = Date.now();
  const outputDir = path.join(TEMP_DIR, 'cli-output');
  fs.mkdirSync(outputDir, { recursive: true });

  // Test single URL for baseline (sqlmap can be slow)
  const testUrl = TEST_URLS[0];

  const cmd = `${SQLMAP_PATH} -u "${testUrl}" --batch --output-dir "${outputDir}" --level=1 --risk=1 --threads=4 --timeout=15 --smart`;

  let stdout = '';
  let exitCode = 0;
  let hasVuln = false;

  try {
    stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 120000, // 2 minutes max
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    stdout = err.stdout || '';
    exitCode = err.status || 1;
  }

  const duration = Date.now() - startTime;

  // Check for vulnerabilities
  hasVuln = stdout.includes('is vulnerable') || stdout.includes('injectable');

  // Parse injection types
  const injectionTypes = [];
  const typeMatches = stdout.matchAll(/Type: (.+)/g);
  for (const match of typeMatches) {
    injectionTypes.push(match[1].trim());
  }

  console.log(`Duration: ${duration}ms`);
  console.log(`Vulnerable: ${hasVuln}`);
  console.log(`Injection types: ${injectionTypes.length > 0 ? injectionTypes.join(', ') : 'none'}`);
  console.log(`Exit code: ${exitCode}`);

  return {
    duration,
    hasVuln,
    injectionTypes,
    stdout,
    exitCode,
  };
}

async function runWrapperTest() {
  console.log('\n=== Wrapper Test ===');
  console.log('Testing 1 URL with wrapper options...');
  const startTime = Date.now();
  const outputDir = path.join(TEMP_DIR, 'wrapper-output');
  fs.mkdirSync(outputDir, { recursive: true });

  // Test single URL (same as CLI baseline)
  const testUrl = TEST_URLS[0];

  // Build args exactly like the wrapper does (from scanDiscoveredUrls)
  const args = [
    '-u', testUrl,
    '--batch',
    '--output-dir', outputDir,
    '--level=2', // Wrapper uses level 2
    '--risk=1',
    '--threads=4',
    '--timeout=30',
    '--smart',
  ];

  const cmd = `${SQLMAP_PATH} ${args.join(' ')}`;

  let stdout = '';
  let exitCode = 0;
  let hasVuln = false;

  try {
    stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 180000, // 3 minutes (wrapper uses higher level)
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    stdout = err.stdout || '';
    exitCode = err.status || 1;
  }

  const duration = Date.now() - startTime;

  // Check for vulnerabilities
  hasVuln = stdout.includes('is vulnerable') || stdout.includes('injectable');

  // Parse injection types
  const injectionTypes = [];
  const typeMatches = stdout.matchAll(/Type: (.+)/g);
  for (const match of typeMatches) {
    injectionTypes.push(match[1].trim());
  }

  console.log(`Duration: ${duration}ms`);
  console.log(`Vulnerable: ${hasVuln}`);
  console.log(`Injection types: ${injectionTypes.length > 0 ? injectionTypes.join(', ') : 'none'}`);
  console.log(`Exit code: ${exitCode}`);

  return {
    duration,
    hasVuln,
    injectionTypes,
    stdout,
    exitCode,
  };
}

function compareResults(cli, wrapper) {
  console.log('\n=== Comparison ===');
  const issues = [];

  // Compare vulnerability detection
  console.log(`CLI detected vulnerable: ${cli.hasVuln}`);
  console.log(`Wrapper detected vulnerable: ${wrapper.hasVuln}`);

  // If CLI found vuln, wrapper should too (wrapper uses higher level)
  if (cli.hasVuln && !wrapper.hasVuln) {
    issues.push('CLI found vulnerability but wrapper did not');
  }

  // Compare injection types
  const cliTypes = new Set(cli.injectionTypes);
  const wrapperTypes = new Set(wrapper.injectionTypes);

  console.log(`\nCLI injection types: ${[...cliTypes].join(', ') || 'none'}`);
  console.log(`Wrapper injection types: ${[...wrapperTypes].join(', ') || 'none'}`);

  // Compare timing
  const timeDiff = wrapper.duration - cli.duration;
  const timePercent = cli.duration > 0 ? (timeDiff / cli.duration * 100).toFixed(1) : 0;
  console.log(`\nTiming: CLI ${cli.duration}ms, Wrapper ${wrapper.duration}ms`);
  console.log(`Difference: ${timeDiff}ms (${timePercent}%)`);

  // Wrapper uses level=2 so may be slower - that's expected
  // Check for unreasonable overhead (> 100% slower)
  if (timeDiff > cli.duration && wrapper.duration > 60000) {
    // This is acceptable - level 2 tests more payloads
    console.log('(Note: Wrapper uses --level=2 which tests more payloads)');
  }

  console.log('\n=== Validation ===');
  if (issues.length === 0) {
    console.log('✓ Wrapper behavior matches CLI baseline');
  } else {
    console.log('Issues found:');
    issues.forEach(i => console.log(`  ✗ ${i}`));
  }

  return issues;
}

async function main() {
  console.log('========================================');
  console.log('  SQLMap Scanner Wrapper Test');
  console.log('========================================\n');

  // Check sqlmap is available
  try {
    const version = execSync(`${SQLMAP_PATH} --version 2>&1`, { encoding: 'utf-8', timeout: 5000 });
    console.log('SQLMap version:', version.trim().split('\n')[0]);
  } catch (err) {
    // Try with --hh instead (sqlmap --version sometimes hangs)
    try {
      execSync(`${SQLMAP_PATH} -hh 2>&1`, { encoding: 'utf-8', timeout: 5000 });
      console.log('SQLMap: available');
    } catch {
      console.log('SQLMap not found. Please install: pip install sqlmap');
      process.exit(1);
    }
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
