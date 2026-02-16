// ============================================================
// ADD TO: apps/api/src/scm/scm.service.ts
// Add this method to the ScmService class
// ============================================================

  async getPullRequests(
    tenantId: string, 
    repositoryId: string, 
    state: 'open' | 'closed' | 'merged' | 'all' = 'all',
    limit: number = 50
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
