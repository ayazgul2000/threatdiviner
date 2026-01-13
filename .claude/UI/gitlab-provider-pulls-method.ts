// ============================================================
// ADD TO: apps/api/src/scm/providers/gitlab.provider.ts
// Add this method to the GitLabProvider class
// ============================================================

  async getPullRequests(
    token: string,
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50
  ): Promise<PullRequest[]> {
    const projectPath = encodeURIComponent(`${owner}/${repo}`);
    
    // GitLab uses 'opened', 'closed', 'merged', 'all'
    const glState = state === 'open' ? 'opened' : state;
    
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/${projectPath}/merge_requests?state=${glState}&per_page=${limit}&order_by=updated_at`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GitLab API error: ${response.status}`);
    }

    const data = await response.json();
    return data.map((mr: any) => this.mapMergeRequest(mr));
  }

  private mapMergeRequest(mr: any): PullRequest {
    return {
      number: mr.iid,
      title: mr.title,
      author: mr.author?.username || 'unknown',
      sourceBranch: mr.source_branch || '',
      targetBranch: mr.target_branch || '',
      status: mr.state === 'merged' ? 'merged' : mr.state === 'closed' ? 'closed' : 'open',
      url: mr.web_url,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      mergedAt: mr.merged_at || null,
      mergedBy: mr.merged_by?.username || null,
      reviewers: (mr.reviewers || []).map((r: any) => ({
        name: r.username,
        approved: false,
      })),
      labels: mr.labels || [],
      isDraft: mr.draft || mr.work_in_progress || false,
    };
  }
