# STRICT INSTRUCTIONS - DO EXACTLY THIS, NOTHING ELSE

You must add a `getPullRequests` method to enable PR fetching. Follow these EXACT steps in order. Do NOT remove any existing code. Do NOT refactor. Do NOT change anything else.

## STEP 1: scm-provider.interface.ts

Find this line:
```
// Clone URL with auth
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
  // Pull requests
  getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'merged' | 'all',
    limit?: number,
  ): Promise<ScmPullRequest[]>;

```

## STEP 2: github.provider.ts

Find this method signature:
```
getAuthenticatedCloneUrl(accessToken: string
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
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
    return data.filter(pr => state !== 'merged' || pr.merged_at).slice(0, limit).map(pr => ({
      number: pr.number,
      title: pr.title,
      state: pr.merged_at ? 'merged' : pr.state,
      htmlUrl: pr.html_url,
      headSha: pr.head.sha,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
    })) as ScmPullRequest[];
  }

```

## STEP 3: gitlab.provider.ts

Find this method signature:
```
getAuthenticatedCloneUrl(accessToken: string
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const projectPath = encodeURIComponent(owner + '/' + repo);
    const glState = state === 'open' ? 'opened' : state;
    const response = await fetch('https://gitlab.com/api/v4/projects/' + projectPath + '/merge_requests?state=' + glState + '&per_page=' + limit, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!response.ok) throw new Error('GitLab API error: ' + response.status);
    const data = await response.json();
    return data.map((mr: any) => ({
      number: mr.iid,
      title: mr.title,
      state: mr.state === 'merged' ? 'merged' : mr.state === 'closed' ? 'closed' : 'open',
      htmlUrl: mr.web_url,
      headSha: mr.sha || '',
      baseBranch: mr.target_branch,
      headBranch: mr.source_branch,
    }));
  }

```

## STEP 4: azure-devops.provider.ts

Find this method signature:
```
getAuthenticatedCloneUrl(accessToken: string
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const parts = repo.includes('/') ? repo.split('/') : [repo, repo];
    const project = parts[0];
    const repoName = parts[1];
    const adoStatus = state === 'open' ? 'active' : state === 'closed' ? 'abandoned' : state === 'merged' ? 'completed' : 'all';
    const url = 'https://dev.azure.com/' + owner + '/' + project + '/_apis/git/repositories/' + repoName + '/pullrequests?searchCriteria.status=' + adoStatus + '&$top=' + limit + '&api-version=7.0';
    const response = await fetch(url, { headers: { 'Authorization': 'Bearer ' + accessToken } });
    if (!response.ok) throw new Error('ADO API error: ' + response.status);
    const data = await response.json();
    return (data.value || []).map((pr: any) => ({
      number: pr.pullRequestId,
      title: pr.title,
      state: pr.status === 'completed' ? 'merged' : pr.status === 'abandoned' ? 'closed' : 'open',
      htmlUrl: pr._links?.web?.href || '',
      headSha: pr.lastMergeSourceCommit?.commitId || '',
      baseBranch: (pr.targetRefName || '').replace('refs/heads/', ''),
      headBranch: (pr.sourceRefName || '').replace('refs/heads/', ''),
    }));
  }

```

## STEP 5: bitbucket.provider.ts

Find this method signature:
```
getAuthenticatedCloneUrl(accessToken: string
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
  async getPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50,
  ): Promise<ScmPullRequest[]> {
    const bbState = state === 'open' ? 'OPEN' : state === 'merged' ? 'MERGED' : state === 'closed' ? 'DECLINED' : '';
    const stateQuery = bbState ? '&state=' + bbState : '';
    const response = await fetch('https://api.bitbucket.org/2.0/repositories/' + owner + '/' + repo + '/pullrequests?pagelen=' + limit + stateQuery, {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!response.ok) throw new Error('Bitbucket API error: ' + response.status);
    const data = await response.json();
    return (data.values || []).map((pr: any) => ({
      number: pr.id,
      title: pr.title,
      state: pr.state === 'MERGED' ? 'merged' : pr.state === 'OPEN' ? 'open' : 'closed',
      htmlUrl: pr.links?.html?.href || '',
      headSha: pr.source?.commit?.hash || '',
      baseBranch: pr.destination?.branch?.name || '',
      headBranch: pr.source?.branch?.name || '',
    }));
  }

```

## STEP 6: scm.service.ts

Find this method signature:
```
async getLanguages(
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
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

```

## STEP 7: scm.controller.ts

Find this decorator:
```
@Get('repositories/:repositoryId/languages')
```

Insert this IMMEDIATELY BEFORE that line:
```typescript
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

```

## RULES - READ CAREFULLY

1. DO NOT delete any existing code
2. DO NOT refactor or rename anything
3. DO NOT change imports unless adding new ones
4. DO NOT modify any other methods
5. ONLY insert the code blocks above at the EXACT locations specified
6. After each step, verify the file still compiles
7. If ScmPullRequest import is missing in a provider, add it to existing imports from './scm-provider.interface'

## VERIFICATION

After all changes, run:
```
npx tsc --noEmit
```

All 7 files must have the new `getPullRequests` method.
