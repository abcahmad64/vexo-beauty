import { BadRequestException, Injectable } from '@nestjs/common';

import { AiProductContentMode } from '../../ai/dto/ai-product-content.dto';

import {
  AiPermissionContext,
  AiPermissionGuardService,
} from '../../ai/services/ai-permission-guard.service';

import { AiService } from '../../ai/services/ai.service';

import {
  AiToolDefinition,
  AiToolRegistryService,
} from '../../ai/services/ai-tool-registry.service';

import {
  AdminProductAiContentApplyDto,
  AdminProductAiContentDraftDto,
  AdminProductAiSeoApplyDto,
  AdminProductAiSeoDraftDto,
  AdminProductAiQualityAuditDto,
} from '../dto/admin-product-ai.dto';

import { AdminProductSeoDto } from '../dto/admin-product-seo.dto';

import { AdminUpdateProductDto } from '../dto/admin-update-product.dto';

import { AdminProductSeoService } from './admin-product-seo.service';

import { AdminProductService } from './admin-product.service';

type JsonRecord = Record<string, unknown>;

type ProductQualityIssueSeverity =
  'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

type ProductQualityIssue = {
  code: string;
  severity: ProductQualityIssueSeverity;
  field: string;
  title: string;
  message: string;
  suggestion: string;
  aiRoleImpact: string[];
};

@Injectable()
export class AdminProductAiService {
  constructor(
    private readonly adminProductService: AdminProductService,
    private readonly adminProductSeoService: AdminProductSeoService,
    private readonly aiService: AiService,
    private readonly toolRegistry: AiToolRegistryService,
    private readonly permissionGuard: AiPermissionGuardService,
  ) {}

  async generateContentDraft(
    productId: string,
    dto: AdminProductAiContentDraftDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'product.content.draft',
      context,
      'تولید پیش‌نویس محتوای محصول',
    );

    await this.adminProductService.findProductRow(productId, true);

    const mode = dto.mode ?? AiProductContentMode.FULL;

    const result = await this.aiService.generateProductContent(
      {
        productId,
        mode,
        extraInstruction: this.buildContentDraftInstruction(dto),
        applyToProduct: false,
      },
      context.userId ?? undefined,
    );

    return {
      productId,
      mode,
      draft: this.toRecord(this.getRecordValue(result, 'content')),
      model: this.getRecordValue(result, 'model') ?? null,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_content_draft_generated',
      },
    };
  }

  async applyGeneratedContent(
    productId: string,
    dto: AdminProductAiContentApplyDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'product.content.apply',
      context,
      'اعمال محتوای تأییدشده روی محصول',
    );

    this.assertApproved(
      dto.approved,
      'برای اعمال مستقیم محتوای هوشمند روی محصول باید approved=true ارسال شود.',
    );

    const product = await this.adminProductService.findOne(productId);

    const mode = dto.mode ?? AiProductContentMode.FULL;
    this.assertContentApplyModeAllowed(mode);

    const generatedResult = dto.editedDraft
      ? null
      : await this.aiService.generateProductContent(
          {
            productId,
            mode,
            extraInstruction: dto.extraInstruction,
            applyToProduct: false,
          },
          context.userId ?? undefined,
        );

    const draft = dto.editedDraft
      ? this.toRecord(dto.editedDraft)
      : this.toRecord(this.getRecordValue(generatedResult, 'content'));

    const updateDto = this.buildProductContentUpdateDto(
      draft,
      product,
      context,
      dto.approvalReason,
    );

    if (!this.hasObjectKeys(updateDto)) {
      throw new BadRequestException(
        'پیش‌نویس ارسالی هیچ فیلد مجاز و قابل اعمالی برای محصول ندارد.',
      );
    }

    const applied = await this.adminProductService.update(
      productId,
      updateDto,
      context.userId ?? undefined,
    );

    return {
      productId,
      mode,
      applied: true,
      appliedFields: Object.keys(updateDto),
      content: draft,
      product: this.toRecord(applied).product ?? null,
      model: generatedResult
        ? (this.getRecordValue(generatedResult, 'model') ?? null)
        : null,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_content_applied',
        approvalReason: dto.approvalReason ?? null,
      },
    };
  }

  async generateSeoDraft(
    productId: string,
    dto: AdminProductAiSeoDraftDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'product.seo.draft',
      context,
      'تولید پیش‌نویس سئوی محصول',
    );

    const product = await this.adminProductService.findOne(productId);

    const result = await this.aiService.generateProductContent(
      {
        productId,
        mode: AiProductContentMode.SEO,
        extraInstruction: this.buildSeoDraftInstruction(dto),
        applyToProduct: false,
      },
      context.userId ?? undefined,
    );

    const seo = this.normalizeSeoDraft(result, product, dto.keywords);

    return {
      productId,
      seo,
      model: this.getRecordValue(result, 'model') ?? null,
      applied: false,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_seo_draft_generated',
      },
    };
  }

  async applySeoDraft(
    productId: string,
    dto: AdminProductAiSeoApplyDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'product.seo.apply',
      context,
      'اعمال سئوی تأییدشده روی محصول',
    );

    this.assertApproved(
      dto.approved,
      'برای اعمال مستقیم سئوی هوشمند روی محصول باید approved=true ارسال شود.',
    );

    const product = await this.adminProductService.findOne(productId);

    const draft = dto.editedSeoDraft
      ? {
          productId,
          seo: this.normalizeSeoDraft(
            { content: dto.editedSeoDraft },
            product,
            dto.keywords,
          ),
          model: null,
        }
      : await this.generateSeoDraft(productId, dto, context);

    const seoDto = draft.seo;

    const seoUpdate = await this.adminProductSeoService.updateSeo(
      productId,
      seoDto,
      context.userId ?? undefined,
    );

    const productUpdateDto = this.buildProductSeoUpdateDto(seoDto);

    const productUpdate = this.hasObjectKeys(productUpdateDto)
      ? await this.adminProductService.update(
          productId,
          productUpdateDto,
          context.userId ?? undefined,
        )
      : null;

    return {
      productId,
      seo: seoDto,
      applied: true,
      product: productUpdate
        ? (this.toRecord(productUpdate).product ?? null)
        : null,
      seoStorage: seoUpdate,
      model: this.toRecord(draft).model ?? null,
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_seo_applied',
        approvalReason: dto.approvalReason ?? null,
      },
    };
  }

  async auditProductQuality(
    productId: string,
    dto: AdminProductAiQualityAuditDto,
    context: AiPermissionContext,
  ) {
    const tool = this.assertToolAccess(
      'product.quality.audit',
      context,
      'ارزیابی کیفیت و ایمنی محتوای محصول',
    );

    if (dto.applyToProduct === true) {
      throw new BadRequestException(
        'ارزیابی کیفیت محصول یک عملیات فقط‌خواندنی است و اجازه تغییر محصول را ندارد. برای اعمال تغییرات از مسیرهای تأییدشده محتوا یا SEO استفاده کنید.',
      );
    }

    const product = await this.adminProductService.findOne(productId);
    const productRecord = this.toRecord(product);
    const quality = this.buildProductQualityAudit(productRecord, dto);

    return {
      productId,
      applied: false,
      ...quality,
      product: null,
      model: 'backend-deterministic-product-quality-auditor',
      tool: this.toPublicTool(tool),
      audit: {
        actorId: context.userId ?? null,
        action: 'product.ai_quality_audit_generated',
      },
    };
  }

  private buildProductQualityAudit(
    productInput: JsonRecord,
    dto: AdminProductAiQualityAuditDto,
  ): {
    score: number;
    status: 'PASS' | 'NEEDS_REVIEW' | 'BLOCKED';
    severityCounts: Record<ProductQualityIssueSeverity, number>;
    issues: ProductQualityIssue[];
    missingFields: string[];
    contradictions: ProductQualityIssue[];
    recommendations: string[];
    attributeSuggestions: Array<{
      code: string;
      label: string;
      dataType: string;
      inputType: string;
      reason: string;
      priority: ProductQualityIssueSeverity;
    }>;
    safety: {
      safeForPublishing: boolean;
      safeForSalesAdvisor: boolean;
      safeForMarketing: boolean;
      blocksPublishing: string[];
      salesAdvisorWarnings: string[];
      marketingWarnings: string[];
    };
    checks: JsonRecord;
  } {
    const product = this.toRecord(productInput.product ?? productInput);
    const pricing = this.toRecord(product.pricing);
    const seo = this.toRecord(product.seo);
    const stock = this.toRecord(product.stock);
    const brand = this.toRecord(product.brand);
    const category = this.toRecord(product.category);
    const productType = this.toRecord(product.productType);
    const productModel = this.toRecord(product.productModel);
    const dimensions = this.toRecord(product.dimensions);
    const images = Array.isArray(product.images) ? product.images : [];
    const attributes = Array.isArray(product.attributes)
      ? product.attributes
      : [];

    const includeMissingFields = dto.includeMissingFields !== false;
    const includeContradictions = dto.includeContradictions !== false;
    const includeSeoChecks = dto.includeSeoChecks !== false;
    const includeMediaChecks = dto.includeMediaChecks !== false;
    const includePricingSafetyChecks = dto.includePricingSafetyChecks !== false;
    const includeAttributeSuggestions =
      dto.includeAttributeSuggestions !== false;

    const issues: ProductQualityIssue[] = [];
    const missingFields: string[] = [];

    const addIssue = (
      code: string,
      severity: ProductQualityIssueSeverity,
      field: string,
      title: string,
      message: string,
      suggestion: string,
      aiRoleImpact: string[],
    ): void => {
      issues.push({
        code,
        severity,
        field,
        title,
        message,
        suggestion,
        aiRoleImpact,
      });
    };

    const addMissing = (
      field: string,
      severity: ProductQualityIssueSeverity,
      title: string,
      message: string,
      suggestion: string,
      aiRoleImpact: string[],
    ): void => {
      missingFields.push(field);
      addIssue(
        `MISSING_${field.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
        severity,
        field,
        title,
        message,
        suggestion,
        aiRoleImpact,
      );
    };

    const name = this.getString(product.name);
    const slug = this.getString(product.slug);
    const sku = this.getString(product.sku);
    const description = this.getString(product.description);
    const shortDescription = this.getString(product.shortDescription);
    const brandName = this.getString(brand.name);
    const categoryName = this.getString(category.name);
    const productTypeName = this.getString(productType.name);
    const productModelName = this.getString(productModel.name);
    const productModelCode = this.getString(productModel.modelCode);
    const seoTitle =
      this.getString(product.seoTitle) ??
      this.getString(seo.title) ??
      this.getString(seo.metaTitle);
    const seoDescription =
      this.getString(product.seoDescription) ??
      this.getString(seo.description) ??
      this.getString(seo.metaDescription);

    const price = this.getNumber(product.price);
    const purchasePrice = this.getNumber(
      product.purchasePrice ?? pricing.purchasePrice,
    );
    const salePrice = this.getNumber(product.salePrice ?? pricing.salePrice);
    const discountPercent = this.getNumber(
      product.discountPercent ?? pricing.discountPercent,
    );
    const finalPrice = this.getNumber(product.finalPrice ?? pricing.finalPrice);
    const minAllowedPrice = this.getNumber(
      product.minAllowedPrice ?? pricing.minAllowedPrice,
    );
    const grossMarginAmount = this.getNumber(
      product.grossMarginAmount ?? pricing.grossMarginAmount,
    );
    const availableStock = this.getNumber(stock.availableStock);
    const totalQuantity = this.getNumber(stock.totalQuantity);

    if (includeMissingFields) {
      if (!name) {
        addMissing(
          'name',
          'CRITICAL',
          'نام محصول ثبت نشده است',
          'بدون نام محصول، صفحه محصول برای کاتالوگ، جستجو و مشاور فروش قابل استفاده نیست.',
          'نام دقیق، فارسی و قابل جستجوی محصول را ثبت کنید.',
          ['CONTENT_AI', 'SEARCH_AI', 'SALES_ADVISOR'],
        );
      }

      if (!slug) {
        addMissing(
          'slug',
          'HIGH',
          'اسلاگ محصول ثبت نشده است',
          'نبودن slug باعث مشکل در URL، canonical و index شدن صفحه محصول می‌شود.',
          'یک slug یکتا، لاتین و خوانا برای محصول ثبت کنید.',
          ['SEO_AI', 'SEARCH_AI'],
        );
      }

      if (!sku) {
        addMissing(
          'sku',
          'HIGH',
          'SKU محصول ثبت نشده است',
          'نبودن SKU ردیابی انبار، سفارش، مرجوعی و گزارش فروش را دشوار می‌کند.',
          'یک SKU یکتا برای محصول ثبت کنید.',
          ['INVENTORY_AI', 'SALES_ADVISOR'],
        );
      }

      if (!brandName) {
        addMissing(
          'brand',
          'HIGH',
          'برند محصول مشخص نیست',
          'نبودن برند کیفیت تولید محتوا، فیلترها و اعتماد خریدار را کاهش می‌دهد.',
          'برند اصلی محصول را انتخاب یا ایجاد کنید.',
          ['CONTENT_AI', 'MARKETING_AI', 'SEARCH_AI'],
        );
      }

      if (!categoryName) {
        addMissing(
          'category',
          'HIGH',
          'دسته‌بندی محصول مشخص نیست',
          'بدون دسته‌بندی، فیلدهای پویا، فیلترها و پیشنهادهای AI دقیق عمل نمی‌کنند.',
          'دسته‌بندی درست محصول را انتخاب کنید.',
          ['CATALOG_AI', 'SEARCH_AI', 'SALES_ADVISOR'],
        );
      }

      if (!productTypeName) {
        addMissing(
          'productType',
          'MEDIUM',
          'نوع محصول مشخص نیست',
          'نبودن نوع محصول باعث می‌شود template مشخصات و attributeهای تخصصی دقیق انتخاب نشوند.',
          'نوع محصول مثل کرم، رژلب، سشوار یا اپیلاتور را ثبت کنید.',
          ['CATALOG_AI', 'CONTENT_AI'],
        );
      }

      if (!productModelName && !productModelCode) {
        addMissing(
          'productModel',
          'LOW',
          'مدل محصول ثبت نشده است',
          'برای محصولات برقی و برندمحور، نبودن مدل احتمال خطا در مشخصات و مقایسه را بالا می‌برد.',
          'در صورت مدل‌دار بودن کالا، مدل یا کد مدل را ثبت کنید.',
          ['CONTENT_AI', 'SALES_ADVISOR'],
        );
      }

      if (!shortDescription || shortDescription.length < 40) {
        addMissing(
          'shortDescription',
          'MEDIUM',
          'توضیح کوتاه کافی نیست',
          'توضیح کوتاه برای کارت محصول، لیست‌ها و previewهای SEO باید کامل‌تر باشد.',
          'یک توضیح کوتاه ۴۰ تا ۱۸۰ کاراکتری و بدون اغراق ثبت کنید.',
          ['CONTENT_AI', 'SEO_AI', 'MARKETING_AI'],
        );
      }

      if (!description || description.length < 120) {
        addMissing(
          'description',
          'HIGH',
          'توضیح کامل محصول کافی نیست',
          'توضیح کامل کوتاه یا خالی، اعتماد خریدار و کیفیت مشاوره فروش را پایین می‌آورد.',
          'توضیح کامل شامل کاربرد، ویژگی‌ها، نحوه انتخاب و هشدارهای لازم را ثبت کنید.',
          ['CONTENT_AI', 'SALES_ADVISOR', 'SEO_AI'],
        );
      }

      if (price === null && salePrice === null && finalPrice === null) {
        addMissing(
          'price',
          'HIGH',
          'قیمت فروش مشخص نیست',
          'بدون قیمت فروش، نمایش محصول و محاسبه تخفیف قابل اعتماد نیست.',
          'قیمت فروش یا قیمت نهایی را ثبت کنید.',
          ['MARKETING_AI', 'SALES_ADVISOR'],
        );
      }

      if (purchasePrice === null) {
        addMissing(
          'purchasePrice',
          'MEDIUM',
          'قیمت خرید برای کنترل تخفیف مشخص نیست',
          'نبود قیمت خرید باعث می‌شود AI مارکتینگ نتواند تخفیف امن و سودآور پیشنهاد دهد.',
          'قیمت خرید را فقط برای مصرف داخلی و محاسبه حاشیه سود ثبت کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }

      if (minAllowedPrice === null) {
        addMissing(
          'minAllowedPrice',
          'MEDIUM',
          'حداقل قیمت مجاز ثبت نشده است',
          'بدون حداقل قیمت مجاز، کنترل تخفیف زیر قیمت امن سخت می‌شود.',
          'حداقل قیمت مجاز را بر اساس قیمت خرید، مالیات و هزینه‌ها ثبت کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }

      if (availableStock === null && totalQuantity === null) {
        addMissing(
          'stock',
          'MEDIUM',
          'موجودی قابل اتکا نیست',
          'مشاور فروش و سیستم سفارش برای پاسخ‌گویی دقیق به موجودی نیاز دارند.',
          'موجودی انبار و آستانه کمبود را ثبت یا همگام‌سازی کنید.',
          ['SALES_ADVISOR', 'INVENTORY_AI'],
        );
      }
    }

    if (includeMediaChecks) {
      const mediaRecords = images.map((item) => this.toRecord(item));
      const activeImages = mediaRecords.filter(
        (image) => image.isActive !== false,
      );
      const primaryImages = activeImages.filter(
        (image) => image.isPrimary === true,
      );
      const imagesWithoutAlt = activeImages.filter(
        (image) => !this.getString(image.altText),
      );

      if (activeImages.length === 0) {
        addIssue(
          'MISSING_ACTIVE_MEDIA',
          'HIGH',
          'images',
          'رسانه فعال برای محصول وجود ندارد',
          'محصول بدون تصویر یا ویدئوی معتبر نرخ تبدیل و اعتماد پایین‌تری دارد.',
          'حداقل یک تصویر اصلی با alt text مناسب آپلود کنید.',
          ['CONTENT_AI', 'SEO_AI', 'SALES_ADVISOR'],
        );
      }

      if (primaryImages.length === 0 && activeImages.length > 0) {
        addIssue(
          'MISSING_PRIMARY_IMAGE',
          'HIGH',
          'images.isPrimary',
          'تصویر اصلی مشخص نیست',
          'برای کارت محصول، صفحه محصول و Open Graph باید یک تصویر اصلی وجود داشته باشد.',
          'یکی از تصاویر فعال را به عنوان تصویر اصلی انتخاب کنید.',
          ['SEO_AI', 'MARKETING_AI', 'SALES_ADVISOR'],
        );
      }

      if (primaryImages.length > 1) {
        addIssue(
          'MEDIA_CONTRADICTION_MULTIPLE_PRIMARY_IMAGES',
          'MEDIUM',
          'images.isPrimary',
          'بیش از یک تصویر اصلی ثبت شده است',
          'چند تصویر اصلی می‌تواند خروجی UI و SEO را غیرقابل پیش‌بینی کند.',
          'فقط یک تصویر را primary نگه دارید.',
          ['SEO_AI', 'MARKETING_AI'],
        );
      }

      if (imagesWithoutAlt.length > 0) {
        addIssue(
          'MISSING_MEDIA_ALT_TEXT',
          'MEDIUM',
          'images.altText',
          'برخی رسانه‌ها alt text ندارند',
          'alt text برای دسترس‌پذیری، SEO و تحلیل محتوای تصویر توسط AI مهم است.',
          'برای همه تصاویر فعال، alt text فارسی دقیق و کوتاه ثبت کنید.',
          ['SEO_AI', 'CONTENT_AI'],
        );
      }
    }

    if (includeSeoChecks) {
      if (!seoTitle || seoTitle.length < 20) {
        addIssue(
          'SEO_TITLE_WEAK',
          'MEDIUM',
          'seoTitle',
          'عنوان سئو ضعیف یا خالی است',
          'عنوان سئو باید نام محصول، برند یا مزیت اصلی را به شکل طبیعی پوشش دهد.',
          'یک عنوان سئو ۲۰ تا ۷۰ کاراکتری و طبیعی ثبت کنید.',
          ['SEO_AI', 'MARKETING_AI'],
        );
      }

      if (seoTitle && seoTitle.length > 75) {
        addIssue(
          'SEO_TITLE_TOO_LONG',
          'LOW',
          'seoTitle',
          'عنوان سئو طولانی است',
          'عنوان خیلی طولانی در نتایج جستجو ناقص نمایش داده می‌شود.',
          'عنوان سئو را کوتاه‌تر و متمرکزتر کنید.',
          ['SEO_AI'],
        );
      }

      if (!seoDescription || seoDescription.length < 70) {
        addIssue(
          'SEO_DESCRIPTION_WEAK',
          'MEDIUM',
          'seoDescription',
          'توضیح سئو کافی نیست',
          'meta description ضعیف نرخ کلیک و درک صفحه توسط موتورهای جستجو را کاهش می‌دهد.',
          'یک توضیح سئو ۷۰ تا ۱۶۰ کاراکتری، طبیعی و دقیق ثبت کنید.',
          ['SEO_AI', 'MARKETING_AI'],
        );
      }

      if (seoDescription && seoDescription.length > 170) {
        addIssue(
          'SEO_DESCRIPTION_TOO_LONG',
          'LOW',
          'seoDescription',
          'توضیح سئو طولانی است',
          'توضیح خیلی طولانی ممکن است در نتایج جستجو ناقص نمایش داده شود.',
          'توضیح سئو را به حدود ۱۵۰ تا ۱۶۰ کاراکتر نزدیک کنید.',
          ['SEO_AI'],
        );
      }
    }

    if (includePricingSafetyChecks) {
      if (
        finalPrice !== null &&
        minAllowedPrice !== null &&
        finalPrice < minAllowedPrice
      ) {
        addIssue(
          'PRICE_CONTRADICTION_FINAL_BELOW_MIN_ALLOWED',
          'CRITICAL',
          'finalPrice',
          'قیمت نهایی کمتر از حداقل مجاز است',
          'این وضعیت می‌تواند باعث زیان مستقیم یا پیشنهاد تخفیف ناامن توسط AI مارکتینگ شود.',
          'قیمت نهایی یا حداقل قیمت مجاز را اصلاح کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }

      if (
        finalPrice !== null &&
        purchasePrice !== null &&
        finalPrice < purchasePrice
      ) {
        addIssue(
          'PRICE_CONTRADICTION_FINAL_BELOW_PURCHASE',
          'CRITICAL',
          'finalPrice',
          'قیمت نهایی کمتر از قیمت خرید است',
          'فروش زیر قیمت خرید باید به صورت صریح و با سیاست مدیریتی انجام شود.',
          'قیمت، تخفیف یا قیمت خرید را بررسی کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }

      if (
        salePrice !== null &&
        purchasePrice !== null &&
        salePrice < purchasePrice
      ) {
        addIssue(
          'PRICE_CONTRADICTION_SALE_BELOW_PURCHASE',
          'HIGH',
          'salePrice',
          'قیمت فروش کمتر از قیمت خرید است',
          'این وضعیت می‌تواند کمپین‌های تخفیف را زیان‌ده کند.',
          'قیمت فروش یا قیمت خرید را بازبینی کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }

      if (
        discountPercent !== null &&
        (discountPercent < 0 || discountPercent > 95)
      ) {
        addIssue(
          'PRICE_CONTRADICTION_INVALID_DISCOUNT_PERCENT',
          'HIGH',
          'discountPercent',
          'درصد تخفیف غیرعادی است',
          'درصد تخفیف خارج از بازه امن می‌تواند نمایش قیمت و منطق کمپین را خراب کند.',
          'درصد تخفیف را در بازه قابل قبول فروشگاه تنظیم کنید.',
          ['MARKETING_AI'],
        );
      }

      if (grossMarginAmount !== null && grossMarginAmount < 0) {
        addIssue(
          'PRICE_CONTRADICTION_NEGATIVE_MARGIN',
          'HIGH',
          'grossMarginAmount',
          'حاشیه سود منفی است',
          'حاشیه سود منفی نشان‌دهنده خطای قیمت‌گذاری یا کمپین زیان‌ده است.',
          'قیمت خرید، قیمت فروش و تخفیف را دوباره محاسبه کنید.',
          ['MARKETING_AI', 'FINANCE_AI'],
        );
      }
    }

    if (includeContradictions) {
      if (description && shortDescription && description === shortDescription) {
        addIssue(
          'CONTENT_CONTRADICTION_SHORT_EQUALS_FULL_DESCRIPTION',
          'LOW',
          'description',
          'توضیح کوتاه و توضیح کامل یکسان هستند',
          'توضیح کوتاه باید خلاصه باشد و توضیح کامل باید جزئیات بیشتری داشته باشد.',
          'توضیح کوتاه و کامل را تفکیک کنید.',
          ['CONTENT_AI', 'SEO_AI'],
        );
      }

      const activeMojibakeFields = [
        ['name', name],
        ['description', description],
        ['shortDescription', shortDescription],
        ['seoTitle', seoTitle],
        ['seoDescription', seoDescription],
        ['brand.name', brandName],
        ['category.name', categoryName],
      ] as const;

      for (const [field, value] of activeMojibakeFields) {
        if (value && this.hasEncodingDamage(value)) {
          addIssue(
            'TEXT_CONTRADICTION_ENCODING_DAMAGE',
            field === 'name' ? 'HIGH' : 'MEDIUM',
            field,
            'متن دارای خرابی encoding است',
            'وجود کاراکترهای mojibake مثل Ø، Ù یا � نشان می‌دهد متن از مسیر encoding اشتباه ذخیره یا نمایش داده شده است.',
            'متن را از منبع UTF-8 سالم دوباره ذخیره کنید و مسیر ارسال JSON/psql را بررسی کنید.',
            ['CONTENT_AI', 'SEO_AI', 'SEARCH_AI'],
          );
        }
      }
    }

    const attributeSuggestions = includeAttributeSuggestions
      ? this.buildAttributeSuggestions(
          attributes,
          categoryName,
          productTypeName,
          productModelName,
          productModelCode,
          dimensions,
        )
      : [];

    const severityCounts: Record<ProductQualityIssueSeverity, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    for (const issue of issues) {
      severityCounts[issue.severity] += 1;
    }

    const contradictions = issues.filter(
      (issue) =>
        issue.code.includes('CONTRADICTION') || issue.code.includes('MISMATCH'),
    );

    const penalty =
      severityCounts.CRITICAL * 35 +
      severityCounts.HIGH * 18 +
      severityCounts.MEDIUM * 8 +
      severityCounts.LOW * 3;

    const attributePenalty = Math.min(attributeSuggestions.length * 2, 10);
    const score = Math.max(0, Math.min(100, 100 - penalty - attributePenalty));

    const status: 'PASS' | 'NEEDS_REVIEW' | 'BLOCKED' =
      severityCounts.CRITICAL > 0 || severityCounts.HIGH >= 4
        ? 'BLOCKED'
        : score >= 80 && severityCounts.HIGH === 0
          ? 'PASS'
          : 'NEEDS_REVIEW';

    const blocksPublishing = issues
      .filter(
        (issue) => issue.severity === 'CRITICAL' || issue.severity === 'HIGH',
      )
      .map((issue) => issue.code);

    const salesAdvisorWarnings = issues
      .filter((issue) => issue.aiRoleImpact.includes('SALES_ADVISOR'))
      .map((issue) => issue.code);

    const marketingWarnings = issues
      .filter(
        (issue) =>
          issue.aiRoleImpact.includes('MARKETING_AI') ||
          issue.aiRoleImpact.includes('FINANCE_AI'),
      )
      .map((issue) => issue.code);

    const recommendations = [
      ...issues
        .filter((issue) => issue.severity !== 'INFO')
        .map((issue) => issue.suggestion),
      ...attributeSuggestions.map(
        (attribute) =>
          `Attribute پیشنهادی ${attribute.label} را اضافه کنید: ${attribute.reason}`,
      ),
    ].filter((value, index, list) => list.indexOf(value) === index);

    return {
      score,
      status,
      severityCounts,
      issues,
      missingFields: [...new Set(missingFields)],
      contradictions,
      recommendations,
      attributeSuggestions,
      safety: {
        safeForPublishing: status !== 'BLOCKED',
        safeForSalesAdvisor:
          severityCounts.CRITICAL === 0 && salesAdvisorWarnings.length === 0,
        safeForMarketing:
          severityCounts.CRITICAL === 0 && marketingWarnings.length === 0,
        blocksPublishing,
        salesAdvisorWarnings,
        marketingWarnings,
      },
      checks: {
        includeMissingFields,
        includeContradictions,
        includeSeoChecks,
        includeMediaChecks,
        includePricingSafetyChecks,
        includeAttributeSuggestions,
        extraInstruction: dto.extraInstruction ?? null,
      },
    };
  }

  private buildAttributeSuggestions(
    attributesInput: unknown[],
    categoryName: string | null,
    productTypeName: string | null,
    productModelName: string | null,
    productModelCode: string | null,
    dimensions: JsonRecord,
  ): Array<{
    code: string;
    label: string;
    dataType: string;
    inputType: string;
    reason: string;
    priority: ProductQualityIssueSeverity;
  }> {
    const attributes = attributesInput.map((item) => this.toRecord(item));
    const haystack = [
      categoryName,
      productTypeName,
      productModelName,
      productModelCode,
      JSON.stringify(dimensions),
      ...attributes.flatMap((attribute) => [
        this.getString(attribute.code),
        this.getString(attribute.name),
        this.getString(attribute.label),
        this.getString(this.toRecord(attribute.attribute).code),
        this.getString(this.toRecord(attribute.attribute).name),
        this.getString(this.toRecord(attribute.attribute).label),
      ]),
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ')
      .toLowerCase();

    const suggestions: Array<{
      code: string;
      label: string;
      dataType: string;
      inputType: string;
      reason: string;
      priority: ProductQualityIssueSeverity;
    }> = [];

    const hasAny = (terms: string[]): boolean =>
      terms.some((term) => haystack.includes(term.toLowerCase()));

    const addSuggestion = (
      code: string,
      label: string,
      dataType: string,
      inputType: string,
      reason: string,
      priority: ProductQualityIssueSeverity,
      aliases: string[],
    ): void => {
      if (hasAny([code, label, ...aliases])) {
        return;
      }

      suggestions.push({ code, label, dataType, inputType, reason, priority });
    };

    const categoryText = `${categoryName ?? ''} ${productTypeName ?? ''}`;

    addSuggestion(
      'country_of_origin',
      'کشور سازنده',
      'STRING',
      'TEXT',
      'برای اعتماد خریدار و مشاوره فروش در محصولات زیبایی و برقی مهم است.',
      'MEDIUM',
      ['origin', 'made in', 'ساخت'],
    );

    addSuggestion(
      'warranty',
      'گارانتی',
      'STRING',
      'TEXT',
      'برای محصولات برقی و کالاهای برندمحور، وضعیت گارانتی باید مشخص باشد.',
      'MEDIUM',
      ['guarantee', 'وارانتی', 'ضمانت'],
    );

    addSuggestion(
      'usage_method',
      'نحوه استفاده',
      'STRING',
      'TEXTAREA',
      'برای جلوگیری از ادعای نادرست و کمک به مشاور فروش لازم است.',
      'MEDIUM',
      ['how to use', 'روش مصرف', 'نحوه مصرف'],
    );

    if (/پوست|کرم|سرم|ضدآفتاب|آرایش|زیبایی|cosmetic|skin/i.test(categoryText)) {
      addSuggestion(
        'skin_type',
        'نوع پوست مناسب',
        'STRING',
        'SELECT',
        'در محصولات مراقبت پوست و آرایشی، نوع پوست یکی از اصلی‌ترین فیلترها و معیارهای مشاوره است.',
        'HIGH',
        ['skin type', 'پوست چرب', 'پوست خشک', 'مختلط'],
      );

      addSuggestion(
        'volume_ml',
        'حجم محصول',
        'NUMBER',
        'NUMBER',
        'حجم/وزن برای مقایسه قیمت، توضیح محصول و اعتماد خریدار لازم است.',
        'MEDIUM',
        ['ml', 'میلی‌لیتر', 'حجم', 'وزن'],
      );
    }

    if (/مو|شامپو|ماسک مو|سشوار|hair/i.test(categoryText)) {
      addSuggestion(
        'hair_type',
        'نوع موی مناسب',
        'STRING',
        'SELECT',
        'برای مشاوره فروش محصولات مراقبت مو و ابزار مو باید نوع موی مناسب مشخص باشد.',
        'HIGH',
        ['hair type', 'موی خشک', 'موی چرب', 'موی رنگ‌شده'],
      );
    }

    if (
      /برقی|سشوار|اپیلاتور|شیور|اصلاح|dryer|epilator|shaver|electric/i.test(
        categoryText,
      )
    ) {
      addSuggestion(
        'power_watt',
        'توان مصرفی',
        'NUMBER',
        'NUMBER',
        'در محصولات برقی، توان مصرفی برای مقایسه و تصمیم خرید مهم است.',
        'HIGH',
        ['watt', 'وات', 'توان'],
      );

      addSuggestion(
        'voltage',
        'ولتاژ',
        'STRING',
        'TEXT',
        'ولتاژ و سازگاری برق برای محصولات برقی باید مشخص شود.',
        'MEDIUM',
        ['volt', 'ولتاژ'],
      );
    }

    return suggestions.slice(0, 12);
  }

  private getNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      const parsed = Number(normalized);

      return Number.isFinite(parsed) ? parsed : null;
    }

    if (typeof value === 'object') {
      const decimalLike = value as { toString?: () => string };

      if (typeof decimalLike.toString === 'function') {
        const parsed = Number(decimalLike.toString());

        return Number.isFinite(parsed) ? parsed : null;
      }
    }

    return null;
  }

  private hasEncodingDamage(value: string): boolean {
    return /[ØÙÛÃ�]|\?\?\?/.test(value);
  }

  private assertToolAccess(
    toolName: string,
    context: AiPermissionContext,
    operationTitle: string,
  ): AiToolDefinition {
    const tool = this.toolRegistry.assertToolEnabled(toolName);

    this.permissionGuard.assertAuthenticated(context);

    this.permissionGuard.assertAllowed(
      context,
      tool.requiredPermissions,
      operationTitle,
    );

    if (tool.requiresApproval) {
      this.permissionGuard.assertApprovalAllowed(context, operationTitle);
    }

    return tool;
  }

  private assertApproved(approved: boolean | undefined, message: string): void {
    if (approved !== true) {
      throw new BadRequestException(message);
    }
  }

  private assertContentApplyModeAllowed(mode: AiProductContentMode): void {
    const allowedModes = new Set<AiProductContentMode>([
      AiProductContentMode.FULL,
      AiProductContentMode.DESCRIPTION,
      AiProductContentMode.SHORT_DESCRIPTION,
    ]);

    if (!allowedModes.has(mode)) {
      throw new BadRequestException(
        'اعمال مستقیم فقط برای توضیح کامل، توضیح اصلی یا توضیح کوتاه محصول مجاز است. برای SEO، FAQ و متن تبلیغاتی از draft یا مسیر اختصاصی SEO استفاده کنید.',
      );
    }
  }

  private buildContentDraftInstruction(
    dto: AdminProductAiContentDraftDto,
  ): string | undefined {
    const instructions: string[] = [];

    if (dto.extraInstruction) {
      instructions.push(dto.extraInstruction);
    }

    if (dto.includeSeoHints) {
      instructions.push(
        'در صورت امکان، پیشنهادهای سئو را هم در فیلدهای seoTitle و seoDescription قرار بده.',
      );
    }

    if (dto.includeMarketingHooks) {
      instructions.push(
        'در صورت امکان، چند مزیت فروش و متن تبلیغاتی کوتاه را در sellingPoints و adCopy قرار بده.',
      );
    }

    if (dto.includeSalesAdvisorNotes) {
      instructions.push(
        'در صورت امکان، نکات مشاوره فروش را بدون افشای قیمت خرید، موجودی دقیق یا حاشیه سود تولید کن.',
      );
    }

    return instructions.length > 0 ? instructions.join('\n') : undefined;
  }

  private buildSeoDraftInstruction(
    dto: AdminProductAiSeoDraftDto,
  ): string | undefined {
    const instructions: string[] = [];

    if (dto.extraInstruction) {
      instructions.push(dto.extraInstruction);
    }

    if (dto.includeStructuredData) {
      instructions.push(
        'در صورت امکان پیشنهاد structured data را نیز در خروجی لحاظ کن.',
      );
    }

    if (dto.includeImageAltSuggestions) {
      instructions.push(
        'در صورت امکان پیشنهاد alt text برای تصاویر محصول را نیز تولید کن.',
      );
    }

    if (dto.includeFaqSuggestions) {
      instructions.push(
        'در صورت امکان چند سؤال متداول مناسب صفحه محصول را نیز پیشنهاد بده.',
      );
    }

    return instructions.length > 0 ? instructions.join('\n') : undefined;
  }

  private buildProductContentUpdateDto(
    draft: JsonRecord,
    product: unknown,
    context: AiPermissionContext,
    approvalReason?: string,
  ): AdminUpdateProductDto {
    const updateDto: AdminUpdateProductDto = {};

    const shortDescription = this.getString(draft.shortDescription);
    if (shortDescription) {
      updateDto.shortDescription = this.truncateText(shortDescription, 500);
    }

    const description = this.getString(draft.description);
    if (description) {
      updateDto.description = description;
    }

    const seoTitle =
      this.getString(draft.seoTitle) ?? this.getString(draft.metaTitle);
    if (seoTitle) {
      updateDto.seoTitle = this.truncateText(seoTitle, 180);
    }

    const seoDescription =
      this.getString(draft.seoDescription) ??
      this.getString(draft.metaDescription);
    if (seoDescription) {
      updateDto.seoDescription = this.truncateText(seoDescription, 320);
    }

    const metadata = this.buildAiContentMetadata(
      draft,
      context,
      approvalReason,
    );

    if (this.hasObjectKeys(metadata)) {
      const productRecord = this.toRecord(product);
      const currentDimensions = this.toRecord(productRecord.dimensions);

      updateDto.dimensions = {
        ...currentDimensions,
        aiContent: metadata,
      };
    }

    return updateDto;
  }

  private buildAiContentMetadata(
    draft: JsonRecord,
    context: AiPermissionContext,
    approvalReason?: string,
  ): JsonRecord {
    const metadata: JsonRecord = {
      appliedAt: new Date().toISOString(),
      appliedBy: context.userId ?? null,
      approvalReason: approvalReason ?? null,
    };

    const sellingPoints = this.getStringArray(draft.sellingPoints);
    if (sellingPoints.length > 0) {
      metadata.sellingPoints = sellingPoints;
    }

    const faq = this.getFaqArray(draft.faq);
    if (faq.length > 0) {
      metadata.faq = faq;
    }

    const adCopy = this.getString(draft.adCopy);
    if (adCopy) {
      metadata.adCopy = adCopy;
    }

    const marketingHooks = this.getStringArray(draft.marketingHooks);
    if (marketingHooks.length > 0) {
      metadata.marketingHooks = marketingHooks;
    }

    const salesAdvisorNotes = this.getString(draft.salesAdvisorNotes);
    if (salesAdvisorNotes) {
      metadata.salesAdvisorNotes = salesAdvisorNotes;
    }

    return metadata;
  }

  private buildProductSeoUpdateDto(
    seoDto: AdminProductSeoDto,
  ): AdminUpdateProductDto {
    const updateDto: AdminUpdateProductDto = {};

    if (seoDto.metaTitle) {
      updateDto.seoTitle = seoDto.metaTitle;
    }

    if (seoDto.metaDescription) {
      updateDto.seoDescription = seoDto.metaDescription;
    }

    if (seoDto.canonicalUrl) {
      updateDto.canonicalUrl = seoDto.canonicalUrl;
    }

    return updateDto;
  }

  private normalizeSeoDraft(
    result: unknown,
    product: unknown,
    requestedKeywords?: string[],
  ): AdminProductSeoDto {
    const resultRecord = this.toRecord(result);
    const content = this.toRecord(resultRecord.content);
    const fallback = this.buildFallbackSeo(product, requestedKeywords);

    const metaTitle = this.truncateText(
      this.getString(content.seoTitle) ??
        this.getString(content.metaTitle) ??
        this.getString(content.title) ??
        fallback.metaTitle,
      180,
    );

    const metaDescription = this.truncateText(
      this.getString(content.seoDescription) ??
        this.getString(content.metaDescription) ??
        this.getString(content.description) ??
        fallback.metaDescription,
      320,
    );

    const keywordsFromContent = this.getStringArray(content.keywords);
    const keywords = this.normalizeKeywords([
      ...(requestedKeywords ?? []),
      ...keywordsFromContent,
    ]);

    return {
      metaTitle,
      metaDescription,
      keywords: keywords.length > 0 ? keywords : fallback.keywords,
      canonicalUrl: this.getString(content.canonicalUrl) ?? undefined,
      ogTitle:
        this.truncateText(this.getString(content.ogTitle) ?? metaTitle, 180) ||
        undefined,
      ogDescription:
        this.truncateText(
          this.getString(content.ogDescription) ?? metaDescription,
          320,
        ) || undefined,
      ogImage: this.getString(content.ogImage) ?? undefined,
      noIndex: typeof content.noIndex === 'boolean' ? content.noIndex : false,
      noFollow:
        typeof content.noFollow === 'boolean' ? content.noFollow : false,
    };
  }

  private buildFallbackSeo(
    product: unknown,
    requestedKeywords?: string[],
  ): Required<
    Pick<AdminProductSeoDto, 'metaTitle' | 'metaDescription' | 'keywords'>
  > {
    const productRecord = this.toRecord(product);
    const name = this.getString(productRecord.name) ?? 'محصول فروشگاه';
    const brand = this.getString(this.toRecord(productRecord.brand).name);
    const category = this.getString(this.toRecord(productRecord.category).name);

    const titleParts = [name, brand].filter(Boolean);
    const keywordCandidates = [
      ...(requestedKeywords ?? []),
      name,
      brand,
      category,
    ];

    return {
      metaTitle: this.truncateText(titleParts.join(' | ') || name, 180),
      metaDescription: this.truncateText(
        `${name} را در فروشگاه VEXO Beauty بررسی کنید. اطلاعات محصول، ویژگی‌های ثبت‌شده و جزئیات خرید را با دقت بخوانید و متناسب با نیاز خود انتخاب کنید.`,
        320,
      ),
      keywords: this.normalizeKeywords(keywordCandidates),
    };
  }

  private normalizeKeywords(
    keywords?: Array<string | null | undefined>,
  ): string[] {
    const unique = new Set<string>();

    for (const keyword of keywords ?? []) {
      const normalized = this.getString(keyword);

      if (!normalized) {
        continue;
      }

      unique.add(this.truncateText(normalized, 80));
    }

    return [...unique].slice(0, 12);
  }

  private toPublicTool(tool: AiToolDefinition) {
    return {
      name: tool.name,
      title: tool.title,
      riskLevel: tool.riskLevel,
      executionMode: tool.executionMode,
      requiresApproval: tool.requiresApproval,
    };
  }

  private getRecordValue(value: unknown, key: string): unknown {
    return this.toRecord(value)[key];
  }

  private toRecord(value: unknown): JsonRecord {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonRecord;
    }

    return {};
  }

  private hasObjectKeys(value: object): boolean {
    return Object.keys(value).length > 0;
  }

  private getString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      const result = String(value).replace(/\s+/g, ' ').trim();

      return result.length > 0 ? result : null;
    }

    return null;
  }

  private getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.getString(item))
      .filter((item): item is string => Boolean(item))
      .map((item) => this.truncateText(item, 240))
      .slice(0, 20);
  }

  private getFaqArray(
    value: unknown,
  ): Array<{ question: string; answer: string }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => {
        const record = this.toRecord(item);
        const question = this.getString(record.question);
        const answer = this.getString(record.answer);

        if (!question || !answer) {
          return null;
        }

        return {
          question: this.truncateText(question, 240),
          answer: this.truncateText(answer, 700),
        };
      })
      .filter((item): item is { question: string; answer: string } =>
        Boolean(item),
      )
      .slice(0, 12);
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return normalized.slice(0, maxLength - 1).trimEnd();
  }
}
