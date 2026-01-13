# Add getPullRequests to ThreatDiviner API
# Run from: C:\Dev\threatdiviner-v0.2.0

$basePath = "C:\Dev\threatdiviner-v0.2.0\apps\api\src\scm"

# 1. Add getPullRequests to ScmProvider interface
$interfaceFile = "$basePath\providers\scm-provider.interface.ts"
$interfaceContent = Get-Content $interfaceFile -Raw

if ($interfaceContent -notmatch "getPullRequests") {
    $insertPoint = "// Clone URL with auth"
    $newMethod = @"
// Pull requests
  getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'merged' | 'all',
    limit?: number,
  ): Promise<ScmPullRequest[]>;

  // Clone URL with auth
"@
    $interfaceContent = $interfaceContent -replace [regex]::Escape($insertPoint), $newMethod
    Set-Content $interfaceFile $interfaceContent -NoNewline
    Write-Host "✓ Added getPullRequests to interface"
} else {
    Write-Host "- Interface already has getPullRequests"
}

# 2. Add to GitHub provider
$githubFile = "$basePath\providers\github.provider.ts"
$githubContent = Get-Content $githubFile -Raw

if ($githubContent -notmatch "async getPullRequests") {
    # Find a good insertion point - before getAuthenticatedCloneUrl
    $insertPoint = "getAuthenticatedCloneUrl\(accessToken: string"
    $newMethod = @"
async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const octokit = new Octokit({ auth: accessToken });
    const ghState = state === 'merged' ? 'closed' : state === 'all' ? 'all' : state;
    
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: ghState as 'open' | 'closed' | 'all',
      per_page: Math.min(limit, 100),
      sort: 'updated',
      direction: 'desc',
    });

    return data
      .filter(pr => state !== 'merged' || pr.merged_at)
      .slice(0, limit)
      .map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state,
        htmlUrl: pr.html_url,
        headSha: pr.head.sha,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        author: pr.user?.login || 'unknown',
        mergedAt: pr.merged_at || null,
        mergedBy: pr.merged_by?.login || null,
      })) as ScmPullRequest[];
  }

  getAuthenticatedCloneUrl(accessToken: string
"@
    $githubContent = $githubContent -replace $insertPoint, $newMethod
    Set-Content $githubFile $githubContent -NoNewline
    Write-Host "✓ Added getPullRequests to GitHub provider"
} else {
    Write-Host "- GitHub provider already has getPullRequests"
}

# 3. Add to GitLab provider
$gitlabFile = "$basePath\providers\gitlab.provider.ts"
$gitlabContent = Get-Content $gitlabFile -Raw

if ($gitlabContent -notmatch "async getPullRequests") {
    $insertPoint = "getAuthenticatedCloneUrl\(accessToken: string"
    $newMethod = @"
async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const projectPath = encodeURIComponent(`+"`${owner}/${repo}`"+`);
    const glState = state === 'open' ? 'opened' : state;
    
    const response = await fetch(
      `+"`https://gitlab.com/api/v4/projects/${projectPath}/merge_requests?state=${glState}&per_page=${limit}&order_by=updated_at`"+`,
      { headers: { 'Authorization': `+"`Bearer ${accessToken}`"+` } }
    );

    if (!response.ok) throw new Error(`+"``GitLab API error: ${response.status}``"+`);
    const data = await response.json();

    return data.map((mr: any) => ({
      number: mr.iid,
      title: mr.title,
      state: mr.state === 'merged' ? 'merged' : mr.state === 'closed' ? 'closed' : 'open',
      htmlUrl: mr.web_url,
      headSha: mr.sha || '',
      baseBranch: mr.target_branch,
      headBranch: mr.source_branch,
      author: mr.author?.username || 'unknown',
      mergedAt: mr.merged_at || null,
      mergedBy: mr.merged_by?.username || null,
    }));
  }

  getAuthenticatedCloneUrl(accessToken: string
"@
    $gitlabContent = $gitlabContent -replace $insertPoint, $newMethod
    Set-Content $gitlabFile $gitlabContent -NoNewline
    Write-Host "✓ Added getPullRequests to GitLab provider"
} else {
    Write-Host "- GitLab provider already has getPullRequests"
}

# 4. Add to Azure DevOps provider
$adoFile = "$basePath\providers\azure-devops.provider.ts"
$adoContent = Get-Content $adoFile -Raw

if ($adoContent -notmatch "async getPullRequests") {
    $insertPoint = "getAuthenticatedCloneUrl\(accessToken: string"
    $newMethod = @"
async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const [project, repoName] = repo.includes('/') ? repo.split('/') : [repo, repo];
    const adoStatus = state === 'open' ? 'active' : state === 'closed' ? 'abandoned' : state === 'merged' ? 'completed' : 'all';
    
    const url = `+"`https://dev.azure.com/${owner}/${project}/_apis/git/repositories/${repoName}/pullrequests?searchCriteria.status=${adoStatus}&\\$top=${limit}&api-version=7.0`"+`;
    const response = await fetch(url, {
      headers: { 'Authorization': `+"`Bearer ${accessToken}`"+`, 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`+"``ADO API error: ${response.status}``"+`);
    const data = await response.json();

    return (data.value || []).map((pr: any) => ({
      number: pr.pullRequestId,
      title: pr.title,
      state: pr.status === 'completed' ? 'merged' : pr.status === 'abandoned' ? 'closed' : 'open',
      htmlUrl: pr._links?.web?.href || '',
      headSha: pr.lastMergeSourceCommit?.commitId || '',
      baseBranch: pr.targetRefName?.replace('refs/heads/', '') || '',
      headBranch: pr.sourceRefName?.replace('refs/heads/', '') || '',
      author: pr.createdBy?.displayName || 'unknown',
      mergedAt: pr.closedDate || null,
      mergedBy: pr.closedBy?.displayName || null,
    }));
  }

  getAuthenticatedCloneUrl(accessToken: string
"@
    $adoContent = $adoContent -replace $insertPoint, $newMethod
    Set-Content $adoFile $adoContent -NoNewline
    Write-Host "✓ Added getPullRequests to ADO provider"
} else {
    Write-Host "- ADO provider already has getPullRequests"
}

# 5. Add to Bitbucket provider
$bitbucketFile = "$basePath\providers\bitbucket.provider.ts"
$bitbucketContent = Get-Content $bitbucketFile -Raw

if ($bitbucketContent -notmatch "async getPullRequests") {
    $insertPoint = "getAuthenticatedCloneUrl\(accessToken: string"
    $newMethod = @"
async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const bbState = state === 'open' ? 'OPEN' : state === 'merged' ? 'MERGED' : state === 'closed' ? 'DECLINED' : '';
    const stateQuery = bbState ? `+"`&state=${bbState}`"+` : '';
    
    const response = await fetch(
      `+"`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/pullrequests?pagelen=${limit}${stateQuery}`"+`,
      { headers: { 'Authorization': `+"`Bearer ${accessToken}`"+` } }
    );

    if (!response.ok) throw new Error(`+"``Bitbucket API error: ${response.status}``"+`);
    const data = await response.json();

    return (data.values || []).map((pr: any) => ({
      number: pr.id,
      title: pr.title,
      state: pr.state === 'MERGED' ? 'merged' : pr.state === 'OPEN' ? 'open' : 'closed',
      htmlUrl: pr.links?.html?.href || '',
      headSha: pr.source?.commit?.hash || '',
      baseBranch: pr.destination?.branch?.name || '',
      headBranch: pr.source?.branch?.name || '',
      author: pr.author?.display_name || 'unknown',
      mergedAt: pr.state === 'MERGED' ? pr.updated_on : null,
      mergedBy: pr.closed_by?.display_name || null,
    }));
  }

  getAuthenticatedCloneUrl(accessToken: string
"@
    $bitbucketContent = $bitbucketContent -replace $insertPoint, $newMethod
    Set-Content $bitbucketFile $bitbucketContent -NoNewline
    Write-Host "✓ Added getPullRequests to Bitbucket provider"
} else {
    Write-Host "- Bitbucket provider already has getPullRequests"
}

# 6. Add to SCM service
$serviceFile = "$basePath\services\scm.service.ts"
$serviceContent = Get-Content $serviceFile -Raw

if ($serviceContent -notmatch "async getPullRequests") {
    # Find end of class or another method to insert before
    $insertPoint = "async getLanguages\("
    $newMethod = @"
async getPullRequests(
    tenantId: string,
    repositoryId: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    const provider = this.getProvider(repository.connection.provider);
    const token = this.cryptoService.decrypt(repository.connection.accessToken);
    const [owner, repoName] = repository.fullName.split('/');

    return provider.getPullRequests(token, owner, repoName, state, limit);
  }

  async getLanguages(
"@
    $serviceContent = $serviceContent -replace [regex]::Escape($insertPoint), $newMethod
    Set-Content $serviceFile $serviceContent -NoNewline
    Write-Host "✓ Added getPullRequests to SCM service"
} else {
    Write-Host "- SCM service already has getPullRequests"
}

# 7. Add endpoint to SCM controller
$controllerFile = "$basePath\scm.controller.ts"
$controllerContent = Get-Content $controllerFile -Raw

if ($controllerContent -notmatch "repositories/:repositoryId/pulls") {
    # Find branches endpoint and add after it
    $insertPoint = "@Get\('repositories/:repositoryId/languages'\)"
    $newEndpoint = @"
@Get('repositories/:repositoryId/pulls')
  @UseGuards(JwtAuthGuard)
  async getPullRequests(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
    @Query('state') state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    @Query('limit') limit?: string,
  ) {
    const pulls = await this.scmService.getPullRequests(
      user.tenantId,
      repositoryId,
      state,
      limit ? parseInt(limit, 10) : 50,
    );
    return { pulls };
  }

  @Get('repositories/:repositoryId/languages')
"@
    $controllerContent = $controllerContent -replace $insertPoint, $newEndpoint
    Set-Content $controllerFile $controllerContent -NoNewline
    Write-Host "✓ Added getPullRequests endpoint to controller"
} else {
    Write-Host "- Controller already has pulls endpoint"
}

Write-Host ""
Write-Host "Done! Now restart your API server:"
Write-Host "  cd apps/api && npm run start:dev"
Write-Host ""
Write-Host "Then copy the UI:"
Write-Host "  Copy-Item 'C:\Dev\threatdiviner-v0.2.0\.claude\ui\page-step17.tsx' 'C:\Dev\threatdiviner-v0.2.0\apps\dashboard\src\app\dashboard\repos\page.tsx' -Force"
