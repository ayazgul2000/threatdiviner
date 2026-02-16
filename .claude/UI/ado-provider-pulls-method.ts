// ============================================================
// ADD TO: apps/api/src/scm/providers/azure-devops.provider.ts
// Add this method to the AzureDevOpsProvider class
// ============================================================

  async getPullRequests(
    token: string,
    owner: string, // organization
    repo: string,  // project/repo
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50
  ): Promise<PullRequest[]> {
    // ADO format: owner = organization, repo = project/repository
    const [project, repoName] = repo.includes('/') ? repo.split('/') : [repo, repo];
    
    // ADO uses status: active, abandoned, completed, all
    let adoStatus = 'all';
    if (state === 'open') adoStatus = 'active';
    else if (state === 'closed') adoStatus = 'abandoned';
    else if (state === 'merged') adoStatus = 'completed';
    
    const url = `https://dev.azure.com/${owner}/${project}/_apis/git/repositories/${repoName}/pullrequests?searchCriteria.status=${adoStatus}&$top=${limit}&api-version=7.0`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Azure DevOps API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.value || []).map((pr: any) => this.mapPullRequest(pr));
  }

  private mapPullRequest(pr: any): PullRequest {
    const status = pr.status === 'completed' ? 'merged' : 
                   pr.status === 'abandoned' ? 'closed' : 'open';
    
    return {
      number: pr.pullRequestId,
      title: pr.title,
      author: pr.createdBy?.displayName || pr.createdBy?.uniqueName || 'unknown',
      sourceBranch: pr.sourceRefName?.replace('refs/heads/', '') || '',
      targetBranch: pr.targetRefName?.replace('refs/heads/', '') || '',
      status,
      url: pr._links?.web?.href || '',
      createdAt: pr.creationDate,
      updatedAt: pr.creationDate, // ADO doesn't have updatedAt in list
      mergedAt: pr.closedDate && status === 'merged' ? pr.closedDate : null,
      mergedBy: pr.closedBy?.displayName || null,
      reviewers: (pr.reviewers || []).map((r: any) => ({
        name: r.displayName || r.uniqueName,
        approved: r.vote > 0,
      })),
      labels: (pr.labels || []).map((l: any) => l.name),
      isDraft: pr.isDraft || false,
    };
  }
