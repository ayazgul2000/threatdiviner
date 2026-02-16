const TM_ID = '550e8400-e29b-41d4-a716-446655440500';

async function main() {
  // Step 1: Login
  console.log('=== STEP 1: LOGIN ===');
  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@acme.com', password: 'admin123', tenantSlug: 'acme-corp' }),
  });
  const cookie = loginRes.headers.getSetCookie().find(c => c.startsWith('accessToken='));
  const token = cookie.split('=')[1].split(';')[0];
  console.log('Logged in. Token:', token.substring(0, 30) + '...');

  const headers = { Cookie: `accessToken=${token}` };

  // Step 2: Sync diagram
  console.log('\n=== STEP 2: SYNC DIAGRAM ===');
  const syncRes = await fetch(`http://localhost:3001/threat-modeling/${TM_ID}/diagram/sync`, {
    method: 'POST', headers
  });
  const syncData = await syncRes.json();
  console.log('Sync result:', JSON.stringify(syncData, null, 2));

  // Step 3: Run analysis
  console.log('\n=== STEP 3: RUN ANALYSIS ===');
  const analysisRes = await fetch(`http://localhost:3001/threat-modeling/${TM_ID}/analyze/threagile`, {
    method: 'POST', headers
  });
  const analysisData = await analysisRes.json();
  console.log('Analysis response:', JSON.stringify(analysisData, null, 2));

  // Step 4: Wait and poll for results
  if (analysisData.analysisRunId) {
    console.log('\n=== STEP 4: POLLING FOR RESULTS ===');
    const runId = analysisData.analysisRunId;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`http://localhost:3001/threat-modeling/${TM_ID}/analysis/${runId}`, { headers });
      const pollData = await pollRes.json();
      console.log(`Poll ${i+1}: status=${pollData.status}, risks=${pollData.riskCount || 0}`);
      if (pollData.status === 'completed' || pollData.status === 'failed') {
        console.log('\nFinal result:', JSON.stringify(pollData, null, 2));
        break;
      }
    }
  }
}

main().catch(e => console.error('FAILED:', e.message));
