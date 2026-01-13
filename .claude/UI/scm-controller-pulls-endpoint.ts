// ============================================================
// ADD TO: apps/api/src/scm/scm.controller.ts
// Add this endpoint after the existing branches endpoint
// ============================================================

  // Pull Requests
  @Get('repositories/:repositoryId/pulls')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get pull requests for a repository' })
  @ApiParam({ name: 'repositoryId', description: 'Repository ID' })
  @ApiQuery({ name: 'state', required: false, enum: ['open', 'closed', 'merged', 'all'], description: 'PR state filter' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max results' })
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
      limit ? parseInt(limit, 10) : 50
    );
    return { pulls };
  }
