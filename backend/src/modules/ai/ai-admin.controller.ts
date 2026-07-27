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
  AdminCreateAiGuardrailDto,
  AdminUpdateAiGuardrailDto,
} from './dto/admin-ai-guardrail.dto';

import {
  AdminCreateAiKnowledgeDto,
  AdminUpdateAiKnowledgeDto,
} from './dto/admin-ai-knowledge.dto';

import { AdminAiNoteDto } from './dto/admin-ai-note.dto';

import {
  AdminCreateAiRecommendationDto,
  AdminUpdateAiRecommendationStatusDto,
} from './dto/admin-ai-recommendation.dto';

import {
  AdminCreateAiTemplateDto,
  AdminUpdateAiTemplateDto,
} from './dto/admin-ai-template.dto';

import { AdminAiExportQueryDto } from './dto/admin-ai-export-query.dto';

import { AdminQueryAiDto } from './dto/admin-query-ai.dto';

import { AdminRunAiTaskDto } from './dto/admin-run-ai-task.dto';

import { AdminAiExportService } from './services/admin-ai-export.service';

import { AdminAiService } from './services/admin-ai.service';

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

@ApiTags('AI Admin')
@ApiBearerAuth('access-token')
@RateLimit('admin')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard)
export class AiAdminController {
  constructor(
    private readonly adminAiService: AdminAiService,
    private readonly adminAiExportService: AdminAiExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'دریافت داشبورد هوشمندی مدیریتی',
  })
  getDashboard(@Req() req: AuthenticatedRequest) {
    this.assertAiReader(req);

    return this.adminAiService.getDashboard();
  }

  @Post('run')
  @ApiOperation({
    summary: 'اجرای وظیفه هوشمند مدیریتی',
  })
  runTask(@Req() req: AuthenticatedRequest, @Body() dto: AdminRunAiTaskDto) {
    this.assertAiManager(req);

    return this.adminAiService.runTask(dto, this.getUserId(req));
  }

  @Get('runs')
  findRuns(@Req() req: AuthenticatedRequest, @Query() query: AdminQueryAiDto) {
    this.assertAiReader(req);

    return this.adminAiService.findRuns(query);
  }

  @Get('runs/:runId')
  findRun(
    @Req() req: AuthenticatedRequest,
    @Param('runId') runId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findRun(runId, this.toBoolean(includeDeleted));
  }

  @Get('export')
  async exportAi(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminAiExportQueryDto,
    @Res() res: Response,
  ) {
    this.assertAiReader(req);

    const result = await this.adminAiExportService.exportAi(query);

    res.setHeader('Content-Type', result.mimeType);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );

    return res.send(result.content);
  }

  @Get('templates')
  findTemplates(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAiDto,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findTemplates(query);
  }

  @Post('templates')
  createTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiTemplateDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.createTemplate(dto, this.getUserId(req));
  }

  @Get('templates/:templateId')
  findTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findTemplate(
      templateId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('templates/:templateId')
  updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
    @Body() dto: AdminUpdateAiTemplateDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.updateTemplate(
      templateId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('templates/:templateId/restore')
  restoreTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.restoreTemplate(templateId, this.getUserId(req));
  }

  @Delete('templates/:templateId')
  deleteTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('templateId') templateId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.deleteTemplate(templateId, this.getUserId(req));
  }

  @Get('knowledge')
  findKnowledge(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAiDto,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findKnowledge(query);
  }

  @Post('knowledge')
  createKnowledge(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiKnowledgeDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.createKnowledge(dto, this.getUserId(req));
  }

  @Get('knowledge/:documentId')
  findKnowledgeDocument(
    @Req() req: AuthenticatedRequest,
    @Param('documentId') documentId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findKnowledgeDocument(
      documentId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('knowledge/:documentId')
  updateKnowledge(
    @Req() req: AuthenticatedRequest,
    @Param('documentId') documentId: string,
    @Body() dto: AdminUpdateAiKnowledgeDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.updateKnowledge(
      documentId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('knowledge/:documentId/restore')
  restoreKnowledge(
    @Req() req: AuthenticatedRequest,
    @Param('documentId') documentId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.restoreKnowledge(
      documentId,
      this.getUserId(req),
    );
  }

  @Delete('knowledge/:documentId')
  deleteKnowledge(
    @Req() req: AuthenticatedRequest,
    @Param('documentId') documentId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.deleteKnowledge(documentId, this.getUserId(req));
  }

  @Get('guardrails')
  findGuardrails(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAiDto,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findGuardrails(query);
  }

  @Post('guardrails')
  createGuardrail(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiGuardrailDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.createGuardrail(dto, this.getUserId(req));
  }

  @Get('guardrails/:ruleId')
  findGuardrail(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findGuardrail(
      ruleId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('guardrails/:ruleId')
  updateGuardrail(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
    @Body() dto: AdminUpdateAiGuardrailDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.updateGuardrail(
      ruleId,
      dto,
      this.getUserId(req),
    );
  }

  @Patch('guardrails/:ruleId/restore')
  restoreGuardrail(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.restoreGuardrail(ruleId, this.getUserId(req));
  }

  @Delete('guardrails/:ruleId')
  deleteGuardrail(
    @Req() req: AuthenticatedRequest,
    @Param('ruleId') ruleId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.deleteGuardrail(ruleId, this.getUserId(req));
  }

  @Get('recommendations')
  findRecommendations(
    @Req() req: AuthenticatedRequest,
    @Query() query: AdminQueryAiDto,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findRecommendations(query);
  }

  @Post('recommendations')
  createRecommendation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminCreateAiRecommendationDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.createRecommendation(dto, this.getUserId(req));
  }

  @Get('recommendations/:recommendationId')
  findRecommendation(
    @Req() req: AuthenticatedRequest,
    @Param('recommendationId') recommendationId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    this.assertAiReader(req);

    return this.adminAiService.findRecommendation(
      recommendationId,
      this.toBoolean(includeDeleted),
    );
  }

  @Patch('recommendations/:recommendationId/status')
  updateRecommendationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('recommendationId') recommendationId: string,
    @Body() dto: AdminUpdateAiRecommendationStatusDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.updateRecommendationStatus(
      recommendationId,
      dto,
      this.getUserId(req),
    );
  }

  @Delete('recommendations/:recommendationId')
  deleteRecommendation(
    @Req() req: AuthenticatedRequest,
    @Param('recommendationId') recommendationId: string,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.deleteRecommendation(
      recommendationId,
      this.getUserId(req),
    );
  }

  @Get('notes')
  getAllNotes(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limit?: string,
  ) {
    this.assertAiReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminAiService.getAllNotes(
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Get('notes/:entityKey')
  getNotes(
    @Req() req: AuthenticatedRequest,
    @Param('entityKey') entityKey: string,
    @Query('limit') limit?: string,
  ) {
    this.assertAiReader(req);

    const parsedLimit = limit ? Number(limit) : 50;

    return this.adminAiService.getNotes(
      entityKey,
      Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 50,
    );
  }

  @Post('notes/:entityKey')
  createNote(
    @Req() req: AuthenticatedRequest,
    @Param('entityKey') entityKey: string,
    @Body() dto: AdminAiNoteDto,
  ) {
    this.assertAiManager(req);

    return this.adminAiService.createNote(entityKey, dto, this.getUserId(req));
  }

  private getUserId(req: AuthenticatedRequest): string {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;

    if (!userId) {
      throw new ForbiddenException('شناسه کاربر احرازهویت‌شده یافت نشد.');
    }

    return userId;
  }

  private assertAiReader(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:read',
        'ai:*',
        'ai:read',
        'ai:manage',
        'analytics:read',
        'reports:read',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مشاهده مدیریت هوشمندی را ندارید.');
  }

  private assertAiManager(req: AuthenticatedRequest): void {
    if (this.hasAdminRole(req)) {
      return;
    }

    if (
      this.hasAnyPermission(req, [
        'admin:*',
        'admin:manage',
        'ai:*',
        'ai:manage',
        'ai:run',
        'ai:update',
        'ai:delete',
        'analytics:manage',
      ])
    ) {
      return;
    }

    throw new ForbiddenException('شما مجوز مدیریت هوشمندی را ندارید.');
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
