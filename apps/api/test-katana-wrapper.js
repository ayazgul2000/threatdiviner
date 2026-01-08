/**
 * Direct test of KatanaScanner wrapper
 * Compares output to CLI baseline
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_TARGET_URL = 'http://testphp.vulnweb.com';
const KATANA_PATH = 'C:/Users/ayazg/go/bin/katana.exe';

async function runCliBaseline() {
  console.log('=== CLI Baseline ===');
  const startTime = Date.now();

  const result = execSync(`${KATANA_PATH} -u ${TEST_TARGET_URL} -d 2 -silent -nc`, {
    encoding: 'utf-8',
    timeout: 120000,
  });

  const duration = Date.now() - startTime;
  const urls = result.trim().split('\n').filter(l => l.startsWith('http'));
  const uniqueUrls = [...new Set(urls)];
  const urlsWithParams = uniqueUrls.filter(u => u.includes('?'));

  console.log(`Duration: ${duration}ms`);
  console.log(`Total URLs: ${urls.length}`);
  console.log(`Unique URLs: ${uniqueUrls.length}`);
  console.log(`URLs with params: ${urlsWithParams.length}`);

  return {
    duration,
    urls: uniqueUrls,
    urlsWithParams,
    rawOutput: result,
  };
}

async function runWrapperTest() {
  console.log('\n=== Wrapper Test ===');
  const startTime = Date.now();

  // Use execSync like the actual wrapper does via LocalExecutorService
  const args = [
    '-u', TEST_TARGET_URL,
    '-d', '2',
    '-silent',
    '-nc',
  ];

  let stdout = '';
  let code = 0;

  try {
    stdout = execSync(`"${KATANA_PATH}" ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (err) {
    stdout = err.stdout || '';
    code = err.status || 1;
  }

  const duration = Date.now() - startTime;

  // Parse using the same logic as katana.scanner.ts parseStdoutUrls
  const discoveredUrls = [];
  const discoveredParams = [];
  const jsFiles = [];
  const seenUrls = new Set();
  const seenParams = new Set();

  const lines = stdout.trim().split('\n').filter(l => l.trim());

  for (const line of lines) {
    const url = line.trim();
    if (!url || seenUrls.has(url)) continue;
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;

    seenUrls.add(url);
    discoveredUrls.push(url);

    // Check for JS files
    if (url.match(/\.js(\?|$)/i)) {
      jsFiles.push(url);
    }

    // Extract query parameters
    try {
      const parsed = new URL(url);
      if (parsed.search && parsed.search.length > 1) {
        const params = new URLSearchParams(parsed.search);
        for (const [name] of params) {
          const paramKey = `${parsed.pathname}:${name}`;
          if (!seenParams.has(paramKey)) {
            seenParams.add(paramKey);
            discoveredParams.push({
              url,
              method: 'GET',
              name,
              type: 'query',
            });
          }
        }
      }
    } catch {
      // Invalid URL
    }
  }

  console.log(`Duration: ${duration}ms`);
  console.log(`Discovered URLs: ${discoveredUrls.length}`);
  console.log(`Discovered Params: ${discoveredParams.length}`);
  console.log(`JS Files: ${jsFiles.length}`);

  return {
    duration,
    discoveredUrls,
    discoveredParams,
    jsFiles,
    rawOutput: stdout,
    exitCode: code,
  };
}

function compareResults(cli, wrapper) {
  console.log('\n=== Comparison ===');

  const issues = [];

  // Compare URL counts
  const cliCount = cli.urls.length;
  const wrapperCount = wrapper.discoveredUrls.length;
  const diff = Math.abs(cliCount - wrapperCount);
  const diffPercent = (diff / cliCount * 100).toFixed(1);

  console.log(`CLI URLs: ${cliCount}`);
  console.log(`Wrapper URLs: ${wrapperCount}`);
  console.log(`Difference: ${diff} (${diffPercent}%)`);

  if (diff > 0) {
    // Find missing URLs
    const cliSet = new Set(cli.urls);
    const wrapperSet = new Set(wrapper.discoveredUrls);

    const missingInWrapper = cli.urls.filter(u => !wrapperSet.has(u));
    const extraInWrapper = wrapper.discoveredUrls.filter(u => !cliSet.has(u));

    if (missingInWrapper.length > 0) {
      console.log(`\nMissing in wrapper (${missingInWrapper.length}):`);
      missingInWrapper.slice(0, 5).forEach(u => console.log(`  - ${u}`));
    }

    if (extraInWrapper.length > 0) {
      console.log(`\nExtra in wrapper (${extraInWrapper.length}):`);
      extraInWrapper.slice(0, 5).forEach(u => console.log(`  - ${u}`));
    }
  }

  // Compare parameter extraction
  console.log(`\nCLI URLs with params: ${cli.urlsWithParams.length}`);
  console.log(`Wrapper params extracted: ${wrapper.discoveredParams.length}`);

  // Compare timing
  const timeDiff = wrapper.duration - cli.duration;
  const timePercent = (timeDiff / cli.duration * 100).toFixed(1);
  console.log(`\nTiming: CLI ${cli.duration}ms, Wrapper ${wrapper.duration}ms`);
  console.log(`Overhead: ${timeDiff}ms (${timePercent}%)`);

  if (Math.abs(timeDiff) > cli.duration * 0.1) {
    issues.push(`Wrapper timing differs by more than 10% from CLI`);
  }

  // Validate wrapper found URLs
  if (wrapperCount === 0) {
    issues.push('Wrapper found no URLs');
  }

  // Validate params extracted
  if (wrapper.discoveredParams.length === 0 && cli.urlsWithParams.length > 0) {
    issues.push('Wrapper failed to extract parameters');
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
  console.log('  Katana Scanner Wrapper Test');
  console.log('========================================\n');

  try {
    const cliResult = await runCliBaseline();
    const wrapperResult = await runWrapperTest();
    const issues = compareResults(cliResult, wrapperResult);

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
