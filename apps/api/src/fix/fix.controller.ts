import { Controller, Post, Param, Query, Res, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { FixService } from './fix.service';

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

/**
 * Fix Controller
 * Handles PR action links: Apply Fix, Dismiss, AI Triage
 * These endpoints are called from links in PR comments
 */
@ApiTags('fix')
@Controller('fix')
export class FixController {
  constructor(private readonly fixService: FixService) {}

  /**
   * Apply auto-fix for a finding
   * Called from PR comment link
   */
  @Post(':findingId')
  @ApiOperation({ summary: 'Apply auto-fix to a finding' })
  async applyFix(
    @Param('findingId') findingId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.fixService.applyFix(findingId);

      if (result.success) {
        if (result.redirectUrl) {
          return res.redirect(result.redirectUrl + '?fixed=' + findingId);
        }
        return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?fixed=true`);
      }

      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?error=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?error=${encodeURIComponent(message)}`);
    }
  }

  /**
   * Apply all auto-fixes for a scan
   */
  @Post('all/:scanId')
  @ApiOperation({ summary: 'Apply all auto-fixes for a scan' })
  async applyAllFixes(
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.fixService.applyAllFixes(scanId);

      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl + '?fixed=all');
      }
      return res.redirect(`${DASHBOARD_URL}/dashboard/scans/${scanId}?fixed=all`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`${DASHBOARD_URL}/dashboard/scans/${scanId}?error=${encodeURIComponent(message)}`);
    }
  }

  /**
   * Dismiss a finding
   */
  @Post('dismiss/:findingId')
  @ApiOperation({ summary: 'Dismiss a finding' })
  async dismiss(
    @Param('findingId') findingId: string,
    @Query('reason') reason: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.fixService.dismiss(findingId, reason);

      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?dismissed=true`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?error=${encodeURIComponent(message)}`);
    }
  }

  /**
   * AI triage a finding
   */
  @Post('triage/:findingId')
  @ApiOperation({ summary: 'AI triage a finding' })
  async triage(
    @Param('findingId') findingId: string,
    @Query('reply') reply: string,
    @Res() res: Response,
  ) {
    try {
      const replyToPr = reply === 'true';
      const result = await this.fixService.triage(findingId, replyToPr);

      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?triaged=true`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`${DASHBOARD_URL}/dashboard/findings/${findingId}?error=${encodeURIComponent(message)}`);
    }
  }

  /**
   * AI triage all findings for a scan
   */
  @Post('triage-all/:scanId')
  @ApiOperation({ summary: 'AI triage all findings for a scan' })
  async triageAll(
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.fixService.triageAll(scanId);

      if (result.redirectUrl) {
        return res.redirect(result.redirectUrl);
      }
      return res.redirect(`${DASHBOARD_URL}/dashboard/scans/${scanId}?triaged=all`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(`${DASHBOARD_URL}/dashboard/scans/${scanId}?error=${encodeURIComponent(message)}`);
    }
  }

  /**
   * API endpoint for fix status (JSON response)
   */
  @Get('status/:findingId')
  @ApiOperation({ summary: 'Get fix status for a finding' })
  async getFixStatus(@Param('findingId') findingId: string) {
    // This could be used by the dashboard to check fix availability
    return {
      findingId,
      autoFixAvailable: false, // Would query from DB
      aiTriaged: false,
    };
  }
}
