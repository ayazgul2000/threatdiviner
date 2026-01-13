// ============================================================
// ADD TO: apps/api/src/scm/providers/github.provider.ts
// Add this method to the GitHubProvider class
// ============================================================

  async getPullRequests(
    token: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50
  ): Promise<PullRequest[]> {
    const octokit = new Octokit({ auth: token });
    
    // GitHub API uses 'all' for all states, but 'merged' isn't a direct state
    // We need to fetch closed PRs and filter by merged_at
    const ghState = state === 'merged' ? 'closed' : state === 'all' ? 'all' : state;
    
    const { data } = await octokit.rest.pulls.list({
      owner,
      repo,
      state: ghState as 'open' | 'closed' | 'all',
      per_page: Math.min(limit, 100),
      sort: 'updated',
      direction: 'desc',
    });

    let pulls = data.map(pr => this.mapPullRequest(pr));
    
    // Filter for merged only if requested
    if (state === 'merged') {
      pulls = pulls.filter(pr => pr.status === 'merged');
    }

    return pulls.slice(0, limit);
  }

  private mapPullRequest(pr: any): PullRequest {
    return {
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      sourceBranch: pr.head?.ref || '',
      targetBranch: pr.base?.ref || '',
      status: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
      url: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at || null,
      mergedBy: pr.merged_by?.login || null,
      reviewers: (pr.requested_reviewers || []).map((r: any) => ({
        name: r.login,
        approved: false, // Would need separate API call for review status
      })),
      labels: (pr.labels || []).map((l: any) => l.name),
      isDraft: pr.draft || false,
    };
  }

// ============================================================
// ADD TO: apps/api/src/scm/providers/types.ts (or interfaces file)
// ============================================================

export interface PullRequest {
  number: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'merged' | 'closed';
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  mergedBy: string | null;
  reviewers: { name: string; approved: boolean }[];
  labels: string[];
  isDraft: boolean;
}
