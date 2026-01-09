$ErrorActionPreference = 'Stop'
$API = 'http://localhost:3001'
$TARGET_URL = 'http://127.0.0.1:3500'
$start = Get-Date

Write-Host '=== Nuclei Tech Scan Test ==='

# Login
Write-Host '[1] Logging in...'
$login = Invoke-RestMethod -Uri "$API/auth/login" -Method POST -ContentType 'application/json' -Body '{"email":"admin@acme.com","password":"admin123"}'
$token = $login.access_token
Write-Host 'Login OK'

$headers = @{ Authorization = "Bearer $token" }

# Get org
Write-Host '[2] Getting org...'
$orgs = Invoke-RestMethod -Uri "$API/organizations" -Headers $headers
$orgId = $orgs[0].id
Write-Host "Org: $orgId"

# Find or create target
Write-Host '[3] Finding target...'
$targets = Invoke-RestMethod -Uri "$API/targets?organizationId=$orgId" -Headers $headers
$target = $targets | Where-Object { $_.url -eq $TARGET_URL } | Select-Object -First 1

if (-not $target) {
    Write-Host 'Creating target...'
    $body = @{ name='JuiceShop'; url=$TARGET_URL; organizationId=$orgId } | ConvertTo-Json
    $target = Invoke-RestMethod -Uri "$API/targets" -Method POST -Headers $headers -ContentType 'application/json' -Body $body
}
Write-Host "Target: $($target.id)"

# Start scan
Write-Host '[4] Starting quick scan...'
$scanBody = @{ targetId=$target.id; scanType='quick' } | ConvertTo-Json
$scan = Invoke-RestMethod -Uri "$API/scans" -Method POST -Headers $headers -ContentType 'application/json' -Body $scanBody
Write-Host "Scan: $($scan.id)"

# Poll for techs
Write-Host '[5] Polling for technologies...'
for ($i = 1; $i -le 30; $i++) {
    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -gt 110) { Write-Host 'TIME LIMIT REACHED'; break }

    $s = Invoke-RestMethod -Uri "$API/scans/$($scan.id)" -Headers $headers
    $techCount = if ($s.technologies) { $s.technologies.Count } else { 0 }
    Write-Host "[$i] Status: $($s.status), Techs: $techCount, Elapsed: $([int]$elapsed)s"

    if ($s.technologies -and $s.technologies.Count -gt 0) {
        Write-Host '=== TECHNOLOGIES FOUND ==='
        $s.technologies | ConvertTo-Json -Depth 3
        Write-Host '=== TEST PASSED ==='
        exit 0
    }

    if ($s.status -eq 'completed' -or $s.status -eq 'failed') {
        Write-Host "Scan ended: $($s.status)"
        break
    }
    Start-Sleep -Seconds 3
}
Write-Host "=== Done in $([int]$elapsed)s ==="
