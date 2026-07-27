import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Request, Response } from 'express';

import { RateLimit } from '../../core/rate-limit/decorators/rate-limit.decorator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import {
  AdminCreateIpRuleDto,
  AdminUpdateIpRuleDto,
} from './dto/admin-ip-rule.dto';

import { AdminQuerySecurityDto } from './dto/admin-query-security.dto';

import { AdminSecurityEvaluateDto } from './dto/admin-security-evaluate.dto';

import { AdminSecurityExportQueryDto } from './dto/admin-security-export-query.dto';

import {
  AdminAssignSecurityIncidentDto,
  AdminCreateSecurityIncidentDto,
  AdminUpdateSecurityIncidentDto,
  AdminUpdateSecurityIncidentStatusDto,
} from './dto/admin-security-incident.dto';

import { AdminSecurityNoteDto } from './dto/admin-security-note.dto';

import {
  AdminCreateSecurityPolicyDto,
  AdminUpdateSecurityPolicyDto,
} from './dto/admin-security-policy.dto';

import { AdminSecurityExportService } from './services/admin-security-export.service';

import { AdminSecurityService } from './services/admin-security.service';

type RequestUser = {
  id?: string;
  userId?: string;
  sub?: string;
  role?:
    | string
    | {
        name?: string | null;
      };
  roleName?: string | null;
  permissions?: string[];
};

type AuthenticatedRequest = Request & {
  user?: RequestUser;
};

@ApiTags('Admin Security')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/security')
@UseGuards(JwtAuthGuard)
export class AdminSecurityController {
  constructor(
    private readonly adminSecurityService: AdminSecurityService,
    private readonly adminSecurityExportService: AdminSecurityExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد امنیت مدیریت',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.getDashboard();
  }

  @Get('export')
  async exportSecurity(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminSecurityExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertSecurityReader(req);

    const result = await this.adminSecurityExportService.exportSecurity(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Post('evaluate')
  evaluateRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminSecurityEvaluateDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.evaluateRequest(dto, this.getUserId(req));
  }

  @Get('evaluations')
  findEvaluations(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySecurityDto,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findEvaluations(query);
  }

  @Get('incidents')
  findIncidents(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySecurityDto,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findIncidents(query);
  }

  @Post('incidents')
  createIncident(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSecurityIncidentDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.createIncident(dto, this.getUserId(req));
  }

  @Get('incidents/:incidentId')
  findIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findIncident(
      incidentId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('incidents/:incidentId')
  updateIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Body() dto: AdminUpdateSecurityIncidentDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.updateIncident(
      incidentId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('incidents/:incidentId/status')
  updateIncidentStatus(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Body() dto: AdminUpdateSecurityIncidentStatusDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.updateIncidentStatus(
      incidentId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('incidents/:incidentId/assign')
  assignIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Body() dto: AdminAssignSecurityIncidentDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.assignIncident(
      incidentId,
      dto,
      this.getUserId(req),
    );
  }

  @Get('incidents/:incidentId/notes')
  getIncidentNotes(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Query('limit') limit?: string,
  ) {
    this.assertSecurityReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminSecurityService.getIncidentNotes(
      incidentId,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post('incidents/:incidentId/notes')
  createIncidentNote(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
    @Body() dto: AdminSecurityNoteDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.createIncidentNote(
      incidentId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('incidents/:incidentId/restore')
  restoreIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.restoreIncident(
      incidentId,
      this.getUserId(req),
    );
  }

  @Delete('incidents/:incidentId')
  deleteIncident(
    @Req() req: AuthenticatedRequest,
    @Param('incidentId') incidentId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.deleteIncident(
      incidentId,
      this.getUserId(req),
    );
  }

  @Get('policies')
  findPolicies(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySecurityDto,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findPolicies(query);
  }

  @Post('policies')
  createPolicy(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateSecurityPolicyDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.createPolicy(dto, this.getUserId(req));
  }

  @Get('policies/:policyId')
  findPolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findPolicy(
      policyId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('policies/:policyId')
  updatePolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
    @Body() dto: AdminUpdateSecurityPolicyDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.updatePolicy(
      policyId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('policies/:policyId/restore')
  restorePolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.restorePolicy(
      policyId,
      this.getUserId(req),
    );
  }

  @Delete('policies/:policyId')
  deletePolicy(
    @Req() req: AuthenticatedRequest,
    @Param('policyId') policyId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.deletePolicy(
      policyId,
      this.getUserId(req),
    );
  }

  @Get('ip-rules')
  findIpRules(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQuerySecurityDto,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findIpRules(query);
  }

  @Post('ip-rules')
  createIpRule(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateIpRuleDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.createIpRule(dto, this.getUserId(req));
  }

  @Get('ip-rules/:ruleId')
  findIpRule(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertSecurityReader(req);

    return this.adminSecurityService.findIpRule(
      ruleId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('ip-rules/:ruleId')
  updateIpRule(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
    @Body() dto: AdminUpdateIpRuleDto,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.updateIpRule(
      ruleId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('ip-rules/:ruleId/restore')
  restoreIpRule(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.restoreIpRule(ruleId, this.getUserId(req));
  }

  @Delete('ip-rules/:ruleId')
  deleteIpRule(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
  ) {
    this.assertSecurityManager(req);

    return this.adminSecurityService.deleteIpRule(ruleId, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertSecurityReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'security:*',
        'security:read',
        'security:manage',
        'admin-security:*',
        'admin-security:read',
        'audit:read',
        'audits:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException(
      'شما مجوز مشاهده مرکز امنیت مدیریت را ندارید.',
    );
  }

  private assertSecurityManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'security:*',
        'security:manage',
        'security:update',
        'security:incident',
        'admin-security:*',
        'admin-security:manage',
        'admin-security:update',
        'audit:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت مرکز امنیت را ندارید.');
  }

  private hasAdminRole(req: AuthenticatedRequest): boolean {
    const role =
      typeof req.user?.role === 'string'
        ? req.user.role
        : (req.user?.role?.name ?? req.user?.roleName ?? null);

    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }

  private hasAnyPermission(
    req: AuthenticatedRequest,
    permissions: string[],
  ): boolean {
    const userPermissions = req.user?.permissions ?? [];

    return permissions.some((requiredPermission) =>
      this.permissionMatches(userPermissions, requiredPermission),
    );
  }

  private permissionMatches(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    const required = requiredPermission.toLowerCase();

    return userPermissions.some((permission) => {
      const owned = permission.toLowerCase();

      if (owned === '*' || owned === 'admin:*') {
        return true;
      }

      if (owned === required) {
        return true;
      }

      if (owned.endsWith(':*')) {
        const prefix = owned.slice(0, -1);

        return required.startsWith(prefix);
      }

      return false;
    });
  }

  private toBoolean(value?: string): boolean {
    return value === 'true' || value === '1';
  }
}
