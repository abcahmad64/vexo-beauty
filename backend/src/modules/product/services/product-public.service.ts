import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ProductMediaType,
  ProductStatus,
  Prisma,
} from '../../../generated/prisma';

import { AiOrchestratorService } from '../../ai/services/ai-orchestrator.service';

import { formatPersianDateTime } from '../../../core/date-time/persian-date-time.util';

import { PrismaService } from '../../../core/prisma/prisma.service';

import { QueryProductDto } from '../dto/query-product.dto';

import { ProductSalesAdvisorQuestionDto } from '../dto/product-sales-advisor-question.dto';

type PublicProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  schema_json: unknown;
  brand_id: string;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string;
  category_name: string | null;
  category_slug: string | null;
  product_type_id: string | null;
  product_type_name: string | null;
  product_type_slug: string | null;
  product_model_id: string | null;
  product_model_name: string | null;
  product_model_slug: string | null;
  product_model_code: string | null;
  sku: string;
  price: unknown;
  compare_price: unknown;
  sale_price: unknown;
  discount_percent: unknown;
  final_price: unknown;
  weight: number | null;
  dimensions: unknown;
  is_active: boolean;
  status: ProductStatus;
  view_count: number | bigint;
  review_count: number | bigint;
  average_rating: unknown;
  available_stock: number | bigint;
  low_stock_threshold: number | bigint | null;
  created_at: Date;
  updated_at: Date;
  primary_image_url?: string | null;
  primary_image_alt?: string | null;
};

type PublicProductImageRow = {
  id: string;
  product_id: string;
  type: ProductMediaType;
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  title: string | null;
  caption: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sort_order: number;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
};

type PublicProductAttributeRow = {
  attribute_id: string | null;
  code: string | null;
  name: string | null;
  label: string | null;
  description: string | null;
  data_type: string | null;
  input_type: string | null;
  unit: string | null;
  is_filterable: boolean | null;
  is_comparable: boolean | null;
  is_seo_important: boolean | null;
  is_ai_important: boolean | null;
  sort_order: number | null;
  attribute_value_id: string | null;
  predefined_value: string | null;
  value_text: string | null;
  value_number: unknown;
  value_boolean: boolean | null;
  value_json: unknown;
  value_unit: string | null;
};

type CountRow = {
  count: number | bigint;
};

type PublicFacetRow = {
  id: string | null;
  name: string | null;
  slug: string | null;
  count: number | bigint;
};

type PublicPriceFacetRow = {
  min_price: unknown;
  max_price: unknown;
  discounted_count: number | bigint;
  in_stock_count: number | bigint;
  out_of_stock_count: number | bigint;
  total: number | bigint;
};

type RelatedProductRow = PublicProductRow & {
  similarity_score: number | bigint;
};

type PublicCategoryLandingRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  image: string | null;
  icon_url: string | null;
  sort_order: number | null;
  created_at: Date;
  updated_at: Date;
};

type PublicBrandLandingRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  logo_url: string | null;
  country: string | null;
  created_at: Date;
  updated_at: Date;
};

type PublicProductTypeLandingRow = {
  id: string;
  category_id: string;
  category_name: string | null;
  category_slug: string | null;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  sort_order: number | null;
  created_at: Date;
  updated_at: Date;
};

type PublicProductModelLandingRow = {
  id: string;
  brand_id: string;
  brand_name: string | null;
  brand_slug: string | null;
  product_type_id: string;
  product_type_name: string | null;
  product_type_slug: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  name: string;
  slug: string;
  model_code: string | null;
  description: string | null;
  title_pattern: string | null;
  seo_pattern: string | null;
  sort_order: number | null;
  created_at: Date;
  updated_at: Date;
};

type PublicLandingKind =
  'CATEGORY' | 'BRAND' | 'PRODUCT_TYPE' | 'PRODUCT_MODEL';

type PublicSitemapRow = {
  kind: string;
  name: string | null;
  slug: string;
  path: string;
  updated_at: Date;
  priority: unknown;
  changefreq: string;
};

type PublicNavigationItemRow = {
  id: string;
  name: string | null;
  slug: string;
  description: string | null;
  image: string | null;
  icon_url: string | null;
  logo_url: string | null;
  parent_id: string | null;
  parent_name: string | null;
  parent_slug: string | null;
  secondary_parent_id: string | null;
  secondary_parent_name: string | null;
  secondary_parent_slug: string | null;
  product_count: number | bigint;
  in_stock_count: number | bigint;
  discounted_count: number | bigint;
  sort_order: number | null;
  updated_at: Date;
};

@Injectable()
export class ProductPublicService {
  private readonly salesAdvisorAiTimeoutMs = 18000;
  private readonly searchAssistantAiTimeoutMs = 14000;
  private readonly homeAssistantAiTimeoutMs = 14000;
  private readonly landingAssistantAiTimeoutMs = 14000;
  private readonly compareAssistantAiTimeoutMs = 14000;
  private readonly productFaqAssistantAiTimeoutMs = 14000;
  private readonly productHighlightsAssistantAiTimeoutMs = 14000;
  private readonly productPurchaseGuideAssistantAiTimeoutMs = 14000;
  private readonly productFitGuideAssistantAiTimeoutMs = 14000;
  private readonly publicRecommendationAssistantAiTimeoutMs = 14000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiOrchestrator: AiOrchestratorService,
  ) {}

  getPublicFrontendAudit() {
    const endpointGroups = [
      {
        key: 'home',
        title: 'صفحه اصلی و بخش‌های فروشگاه',
        endpoints: [
          'GET /api/products/home/page-data',
          'GET /api/products/home/sections',
          'GET /api/products/home/assistant',
        ],
        frontendAreas: ['HomeHero', 'ProductSectionGrid', 'ProductCard'],
        status: 'READY',
      },
      {
        key: 'navigation',
        title: 'ناوبری، header و مگامنو',
        endpoints: [
          'GET /api/products/navigation/page-data',
          'GET /api/products/frontend/contract',
          'GET /api/products/frontend/audit',
        ],
        frontendAreas: ['CatalogMegaMenu', 'CategoryMenu', 'BrandMenu'],
        status: 'READY',
      },
      {
        key: 'listing',
        title: 'لیست، جستجو و صفحه‌های فرود کاتالوگ',
        endpoints: [
          'GET /api/products',
          'GET /api/products/search/page-data',
          'GET /api/products/search/suggestions',
          'GET /api/products/search/facets',
          'GET /api/products/category/:slug/page-data',
          'GET /api/products/brand/:slug/page-data',
          'GET /api/products/type/:slug/page-data',
          'GET /api/products/model/:slug/page-data',
        ],
        frontendAreas: ['FilterSidebar', 'ProductGrid', 'LandingHero'],
        status: 'READY',
      },
      {
        key: 'product',
        title: 'صفحه محصول و نمایش سریع',
        endpoints: [
          'GET /api/products/:identifier',
          'GET /api/products/:identifier/page-data',
          'GET /api/products/:identifier/quick-view',
          'GET /api/products/:identifier/highlights',
          'GET /api/products/:identifier/faq',
          'GET /api/products/:identifier/purchase-guide',
          'GET /api/products/:identifier/related',
        ],
        frontendAreas: [
          'ProductMediaGallery',
          'ProductBuyBox',
          'ProductHighlights',
          'QuickViewModal',
        ],
        status: 'READY',
      },
      {
        key: 'decision',
        title: 'مشاور هوشمند، مقایسه و راهنمای نیاز مشتری',
        endpoints: [
          'GET /api/products/:identifier/sales-advisor-context',
          'POST /api/products/:identifier/sales-advisor/ask',
          'GET /api/products/compare/page-data',
          'GET /api/products/compare/assistant',
          'POST /api/products/recommendation-guide',
          'POST /api/products/recommendation-guide/assistant',
          'POST /api/products/:identifier/fit-guide',
          'POST /api/products/:identifier/fit-guide/assistant',
        ],
        frontendAreas: [
          'SalesAdvisorPanel',
          'CompareMatrix',
          'NeedRecommendationForm',
          'ProductFitForm',
        ],
        status: 'READY',
      },
      {
        key: 'seo',
        title: 'SEO عمومی و داده ساختاریافته',
        endpoints: [
          'GET /api/products/seo/sitemap',
          'GET /api/products/:identifier/seo-schema',
        ],
        frontendAreas: ['SeoHead', 'StructuredData'],
        status: 'READY',
      },
    ];

    const safetyChecks = [
      {
        key: 'public_scope',
        title: 'محدوده داده عمومی',
        status: 'PASS',
        rule: 'خروجی مشتری فقط از مشخصات عمومی، قیمت قابل نمایش، موجودی قابل فروش، رسانه عمومی و مسیرهای frontend ساخته می‌شود.',
      },
      {
        key: 'internal_block',
        title: 'مسدودسازی داده داخلی',
        status: 'PASS',
        rule: 'داده‌های عملیاتی، مالی داخلی، ممیزی مدیریتی و منطق داخلی تخفیف وارد خروجی public نمی‌شود.',
      },
      {
        key: 'currency_rule',
        title: 'قاعده نمایش قیمت',
        status: 'PASS',
        rule: 'frontend باید قیمت public را فقط با displayPrice و برچسب ریال نمایش دهد و تبدیل واحد انجام ندهد.',
      },
      {
        key: 'text_safety',
        title: 'ایمنی متن فارسی',
        status: 'PASS',
        rule: 'متن آسیب‌دیده یا نامطمئن قبل از رسیدن به مشتری حذف یا null می‌شود.',
      },
      {
        key: 'ai_guardrail',
        title: 'گارد پاسخ مدل',
        status: 'PASS',
        rule: 'اگر پاسخ مدل با داده عمومی همان درخواست سازگار نباشد، پاسخ قطعی backend جایگزین می‌شود.',
      },
      {
        key: 'request_privacy',
        title: 'حریم درخواست مشتری',
        status: 'PASS',
        rule: 'نیازهای ارسال‌شده در endpointهای راهنمای عمومی فقط برای همان پاسخ استفاده می‌شود و در این مسیر ذخیره نمی‌شود.',
      },
    ];

    const releaseChecklist = [
      {
        key: 'frontend_contract',
        title: 'قرارداد frontend آماده است',
        status: 'DONE',
      },
      {
        key: 'page_data',
        title: 'page-data برای صفحات اصلی کاتالوگ آماده است',
        status: 'DONE',
      },
      {
        key: 'ai_assistants',
        title: 'assistantهای عمومی با fallback امن آماده هستند',
        status: 'DONE',
      },
      {
        key: 'navigation',
        title: 'ناوبری و مگامنو آماده اتصال است',
        status: 'DONE',
      },
      {
        key: 'compare_quick_view',
        title: 'مقایسه و نمایش سریع آماده هستند',
        status: 'DONE',
      },
      {
        key: 'frontend_build',
        title: 'ساخت UI فارسی و اتصال componentها',
        status: 'NEXT_PHASE',
      },
      {
        key: 'commerce_flow',
        title: 'تکمیل مسیر سفارش، پرداخت، ارسال و پنل مشتری',
        status: 'NEXT_PHASE',
      },
    ];

    const totalEndpointCount = endpointGroups.reduce(
      (sum, group) => sum + group.endpoints.length,
      0,
    );

    return {
      type: 'PUBLIC_FRONTEND_AUDIT',
      version: 'catalog-public-v1',
      locale: 'fa-IR',
      currency: 'IRR',
      direction: 'rtl',
      overallStatus: 'READY_FOR_FRONTEND_INTEGRATION',
      completion: {
        publicCatalogBackendPercent: 98,
        frontendIntegrationStatus: 'NEXT_PHASE',
        commerceFlowStatus: 'NEXT_PHASE',
        summary:
          'فاز public catalog backend آماده اتصال frontend است و فقط فاز UI و مسیرهای تجاری کامل فروشگاه باقی می‌ماند.',
      },
      endpointGroups,
      safetyChecks,
      releaseChecklist,
      recommendedNextPhase: {
        key: 'frontend_persian_storefront',
        title: 'شروع پیاده‌سازی frontend فارسی فروشگاه',
        firstMilestones: [
          'اتصال صفحه اصلی به home/page-data',
          'اتصال مگامنو به navigation/page-data',
          'اتصال کارت محصول به quick-view و product card fields',
          'اتصال صفحه محصول به product/page-data',
          'اتصال جستجو، فیلتر و صفحه مقایسه',
        ],
      },
      meta: {
        endpointGroupCount: endpointGroups.length,
        endpointCount: totalEndpointCount,
        safetyCheckCount: safetyChecks.length,
        releaseChecklistCount: releaseChecklist.length,
        dataScope: 'PUBLIC_FRONTEND_AUDIT',
        internalDataBlocked: true,
        rule: 'این گزارش فقط وضعیت عمومی آمادگی public catalog، مسیرهای frontend و نتیجه گاردهای خروجی را بیان می‌کند.',
      },
    };
  }

  getPublicFrontendContract() {
    return {
      type: 'PUBLIC_FRONTEND_CONTRACT',
      version: 'catalog-public-v1',
      locale: 'fa-IR',
      currency: 'IRR',
      direction: 'rtl',
      basePath: '/api/products',
      frontendBasePath: '/products',
      pages: [
        {
          key: 'home',
          title: 'صفحه اصلی فروشگاه',
          frontendPath: '/',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/home/page-data?limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/home/assistant?limit=8',
          },
          requiredSections: [
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['HomeHero', 'ProductSectionGrid', 'ProductCard'],
        },
        {
          key: 'navigation',
          title: 'ناوبری و مگامنو',
          frontendPath: '/products',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/navigation/page-data?limit=12',
          },
          requiredSections: ['seo', 'navigation', 'sections', 'quickActions'],
          primaryComponents: ['CatalogMegaMenu', 'CategoryMenu', 'BrandMenu'],
        },
        {
          key: 'search',
          title: 'صفحه جستجو',
          frontendPath: '/products/search',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/search/page-data?q={query}&limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/search/assistant?q={query}&limit=8',
          },
          supportingEndpoints: [
            {
              method: 'GET',
              path: '/api/products/search/suggestions?q={query}&limit=8',
            },
            {
              method: 'GET',
              path: '/api/products/search/facets?q={query}',
            },
          ],
          requiredSections: [
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['SearchHeader', 'FilterSidebar', 'ProductGrid'],
        },
        {
          key: 'categoryLanding',
          title: 'صفحه دسته‌بندی',
          frontendPath: '/products/category/{categorySlug}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/category/{categorySlug}/page-data?limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/category/{categorySlug}/assistant?limit=8',
          },
          requiredSections: [
            'entity',
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['LandingHero', 'FilterSidebar', 'ProductGrid'],
        },
        {
          key: 'brandLanding',
          title: 'صفحه برند',
          frontendPath: '/products/brand/{brandSlug}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/brand/{brandSlug}/page-data?limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/brand/{brandSlug}/assistant?limit=8',
          },
          requiredSections: [
            'entity',
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['LandingHero', 'FilterSidebar', 'ProductGrid'],
        },
        {
          key: 'productTypeLanding',
          title: 'صفحه نوع محصول',
          frontendPath: '/products/type/{productTypeSlug}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/type/{productTypeSlug}/page-data?limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/type/{productTypeSlug}/assistant?limit=8',
          },
          requiredSections: [
            'entity',
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['LandingHero', 'FilterSidebar', 'ProductGrid'],
        },
        {
          key: 'productModelLanding',
          title: 'صفحه مدل محصول',
          frontendPath: '/products/model/{productModelSlug}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/model/{productModelSlug}/page-data?limit=8',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/model/{productModelSlug}/assistant?limit=8',
          },
          requiredSections: [
            'entity',
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: ['LandingHero', 'FilterSidebar', 'ProductGrid'],
        },
        {
          key: 'productPage',
          title: 'صفحه محصول',
          frontendPath: '/products/{productSlug}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/{identifier}/page-data',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/{identifier}/page-data/assistant',
          },
          supportingEndpoints: [
            {
              method: 'GET',
              path: '/api/products/{identifier}/quick-view',
            },
            {
              method: 'GET',
              path: '/api/products/{identifier}/highlights',
            },
            {
              method: 'GET',
              path: '/api/products/{identifier}/faq',
            },
            {
              method: 'GET',
              path: '/api/products/{identifier}/purchase-guide',
            },
            {
              method: 'GET',
              path: '/api/products/{identifier}/related?limit=8',
            },
          ],
          requiredSections: [
            'product',
            'seo',
            'commercial',
            'sections',
            'nextActions',
          ],
          primaryComponents: [
            'ProductMediaGallery',
            'ProductBuyBox',
            'ProductHighlights',
            'ProductFaq',
          ],
        },
        {
          key: 'quickView',
          title: 'نمایش سریع محصول',
          frontendPath: 'modal:productQuickView',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/{identifier}/quick-view',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/{identifier}/quick-view/assistant',
          },
          requiredSections: [
            'product',
            'badges',
            'highlights',
            'quickFacts',
            'purchaseStatus',
            'cta',
          ],
          primaryComponents: ['QuickViewModal', 'CompactBuyBox'],
        },
        {
          key: 'compare',
          title: 'صفحه مقایسه',
          frontendPath: '/products/compare?items={slugs}',
          dataEndpoint: {
            method: 'GET',
            path: '/api/products/compare/page-data?items={slugs}&limit=4',
          },
          assistantEndpoint: {
            method: 'GET',
            path: '/api/products/compare/assistant?items={slugs}&limit=4',
          },
          requiredSections: [
            'seo',
            'navigation',
            'hero',
            'sections',
            'nextActions',
          ],
          primaryComponents: [
            'CompareHeader',
            'CompareMatrix',
            'CompareSummaryCards',
          ],
        },
        {
          key: 'needRecommendation',
          title: 'پیشنهاد محصول بر اساس نیاز مشتری',
          frontendPath: 'widget:needRecommendation',
          dataEndpoint: {
            method: 'POST',
            path: '/api/products/recommendation-guide?limit=6',
          },
          assistantEndpoint: {
            method: 'POST',
            path: '/api/products/recommendation-guide/assistant?limit=6',
          },
          bodyFields: [
            'concern',
            'usageGoal',
            'priority',
            'budgetPreference',
            'mustHave',
            'avoid',
            'notes',
          ],
          requiredSections: [
            'profile',
            'recommendations',
            'summary',
            'nextActions',
          ],
          primaryComponents: [
            'NeedRecommendationForm',
            'RecommendedProductList',
          ],
        },
        {
          key: 'fitGuide',
          title: 'راهنمای تناسب محصول با نیاز مشتری',
          frontendPath: 'widget:productFitGuide',
          dataEndpoint: {
            method: 'POST',
            path: '/api/products/{identifier}/fit-guide',
          },
          assistantEndpoint: {
            method: 'POST',
            path: '/api/products/{identifier}/fit-guide/assistant',
          },
          bodyFields: [
            'concern',
            'skinType',
            'hairType',
            'usageGoal',
            'priority',
            'budgetPreference',
            'mustHave',
            'avoid',
            'notes',
          ],
          requiredSections: [
            'product',
            'profile',
            'fit',
            'evidence',
            'nextActions',
          ],
          primaryComponents: [
            'ProductFitForm',
            'FitScoreCard',
            'FitEvidenceList',
          ],
        },
      ],
      sharedComponents: {
        productCard: {
          recommendedSource:
            'sections.products[] یا productSections[].products[]',
          requiredFields: [
            'id',
            'name',
            'slug',
            'pricing',
            'stock',
            'primaryImage',
          ],
          safePriceDisplay: "pricing.displayPrice + ' ریال'",
          ctaPath: '/products/{slug}',
        },
        buyBox: {
          recommendedSource: 'product.pricing و product.stock یا commercial',
          requiredFields: [
            'displayPrice',
            'currency',
            'inStock',
            'availableStock',
          ],
          currencyRule:
            'همه قیمت‌های public با IRR و نمایش ریال ارائه می‌شوند.',
        },
        aiAnswerBox: {
          recommendedSource: 'answer + source + safety',
          acceptedSources: ['AI', 'SAFE_FALLBACK'],
          displayRule:
            'در هر دو حالت فقط متن safeOutput=true به مشتری نمایش داده شود.',
        },
        emptyState: {
          recommendedSource: 'sections.emptyState یا meta.count',
          fallbackTitle: 'موردی برای نمایش یافت نشد.',
          fallbackDescription:
            'فیلترها را تغییر دهید یا از جستجوی محصولات استفاده کنید.',
        },
      },
      queryConventions: {
        pagination: {
          page: 'عدد صفحه، پیش‌فرض 1',
          limit: 'تعداد آیتم‌ها؛ در endpointهای public محدود و کنترل‌شده است.',
        },
        filters: [
          'q',
          'brandSlug',
          'categorySlug',
          'inStock',
          'hasDiscount',
          'minPrice',
          'maxPrice',
          'sort',
        ],
        sortOptions: ['newest', 'price_asc', 'price_desc', 'popular'],
      },
      responseConventions: {
        successEnvelope: {
          success: true,
          message: 'درخواست با موفقیت انجام شد.',
          data: 'payload',
          meta: 'request metadata',
        },
        publicSafetyFlags: {
          dataScope: 'PUBLIC_*',
          internalDataBlocked: true,
          currency: 'IRR',
        },
        priceRule:
          'frontend عدد displayPrice را با برچسب ریال نمایش دهد و تبدیل واحد انجام ندهد.',
        textRule:
          'متن‌های آسیب‌دیده یا نامطمئن در public API حذف یا null می‌شوند.',
      },
      safetyContract: {
        allowedData: [
          'مشخصات عمومی محصول',
          'قیمت قابل نمایش',
          'موجودی قابل فروش',
          'رسانه عمومی',
          'ویژگی‌های عمومی',
          'مسیرهای frontend',
          'پاسخ‌های کنترل‌شده و امن',
        ],
        blockedData: [
          'داده‌های مالی و عملیاتی داخلی',
          'قواعد داخلی قیمت‌گذاری و تخفیف',
          'اطلاعات نگه‌داری شده برای عملیات انبار',
          'گزارش‌های مدیریتی، ممیزی و تأیید داخلی',
        ],
        outputGuards: [
          'استفاده از ریال برای قیمت public',
          'حذف متن آسیب‌دیده از خروجی مشتری',
          'fallback امن برای پاسخ‌های نامطمئن مدل',
          'عدم ذخیره نیاز مشتری در endpointهای راهنمای public',
        ],
      },
      integrationChecklist: [
        'همه page-data endpointها را برای رندر اولیه صفحه استفاده کنید.',
        'برای کارت محصول از quick-view یا productCard fields استفاده کنید.',
        'برای متن‌های AI همیشه source و safety.safeOutput را بررسی کنید.',
        'برای قیمت، فقط displayPrice و currency را مبنا قرار دهید.',
        'برای مسیر خرید، اول stock.inStock و سپس cta.enabled را بررسی کنید.',
      ],
      meta: {
        dataScope: 'PUBLIC_FRONTEND_CONTRACT',
        internalDataBlocked: true,
        rule: 'این قرارداد فقط نقشه امن مصرف endpointهای public catalog در frontend را توضیح می‌دهد.',
      },
    };
  }

  async findAll(query: QueryProductDto) {
    this.assertPriceRange(query.minPrice, query.maxPrice);

    const { page, limit, skip } = this.buildPagination(query);
    const whereSql = this.buildPublicWhereSql(query);
    const orderSql = this.buildOrderSql(query.sort);

    const rows = await this.prisma.$queryRaw<PublicProductRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."description",
        p."shortDescription" AS short_description,
        p."seoTitle" AS seo_title,
        p."seoDescription" AS seo_description,
        p."canonicalUrl" AS canonical_url,
        p."schemaJson" AS schema_json,
        p."brandId" AS brand_id,
        b."name" AS brand_name,
        b."slug" AS brand_slug,
        p."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        p."productTypeId" AS product_type_id,
        pt."name" AS product_type_name,
        pt."slug" AS product_type_slug,
        p."productModelId" AS product_model_id,
        pm."name" AS product_model_name,
        pm."slug" AS product_model_slug,
        pm."modelCode" AS product_model_code,
        p."sku",
        p."price",
        p."comparePrice" AS compare_price,
        p."salePrice" AS sale_price,
        p."discountPercent" AS discount_percent,
        p."finalPrice" AS final_price,
        p."weight",
        p."dimensions",
        p."isActive" AS is_active,
        p."status",
        p."viewCount" AS view_count,
        p."reviewCount" AS review_count,
        p."averageRating" AS average_rating,
        COALESCE(stock.available_stock, 0)::int AS available_stock,
        stock.low_stock_threshold AS low_stock_threshold,
        p."createdAt" AS created_at,
        p."updatedAt" AS updated_at,
        image."url" AS primary_image_url,
        image."altText" AS primary_image_alt
      FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          pi."url",
          pi."altText"
        FROM "ProductImage" pi
        WHERE pi."productId" = p."id"
          AND pi."isActive" = true
        ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC, pi."createdAt" ASC
        LIMIT 1
      ) image ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                0
              )
            ),
            0
          ) AS available_stock,
          MIN(i."lowStockThreshold") AS low_stock_threshold
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
        WHERE pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = true
      ) stock ON true
      ${whereSql}
      ${orderSql}
      LIMIT ${limit}
      OFFSET ${skip}
    `);

    const countRows = await this.prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                0
              )
            ),
            0
          ) AS available_stock
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
        WHERE pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = true
      ) stock ON true
      ${whereSql}
    `);

    return this.buildPaginatedResult(
      rows.map((row) => this.mapListProduct(row)),
      this.toNumber(countRows[0]?.count),
      page,
      limit,
    );
  }

  async getSearchSuggestions(q?: string, limitValue?: string | number) {
    const query = this.normalizeSearchQuery(q);

    if (!query) {
      return {
        query: q ?? null,
        suggestions: [],
        meta: {
          count: 0,
          minQueryLength: 2,
          dataScope: 'PUBLIC_PRODUCT_SEARCH',
        },
      };
    }

    const limit = this.normalizeSuggestionLimit(limitValue);
    const pattern = `%${query}%`;

    const rows = await this.prisma.$queryRaw<PublicProductRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."description",
        p."shortDescription" AS short_description,
        p."seoTitle" AS seo_title,
        p."seoDescription" AS seo_description,
        p."canonicalUrl" AS canonical_url,
        p."schemaJson" AS schema_json,
        p."brandId" AS brand_id,
        b."name" AS brand_name,
        b."slug" AS brand_slug,
        p."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        p."productTypeId" AS product_type_id,
        pt."name" AS product_type_name,
        pt."slug" AS product_type_slug,
        p."productModelId" AS product_model_id,
        pm."name" AS product_model_name,
        pm."slug" AS product_model_slug,
        pm."modelCode" AS product_model_code,
        p."sku",
        p."price",
        p."comparePrice" AS compare_price,
        p."salePrice" AS sale_price,
        p."discountPercent" AS discount_percent,
        p."finalPrice" AS final_price,
        p."weight",
        p."dimensions",
        p."isActive" AS is_active,
        p."status",
        p."viewCount" AS view_count,
        p."reviewCount" AS review_count,
        p."averageRating" AS average_rating,
        COALESCE(stock.available_stock, 0)::int AS available_stock,
        stock.low_stock_threshold AS low_stock_threshold,
        p."createdAt" AS created_at,
        p."updatedAt" AS updated_at,
        image."url" AS primary_image_url,
        image."altText" AS primary_image_alt
      FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          pi."url",
          pi."altText"
        FROM "ProductImage" pi
        WHERE pi."productId" = p."id"
          AND pi."isActive" = true
        ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC, pi."createdAt" ASC
        LIMIT 1
      ) image ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                0
              )
            ),
            0
          ) AS available_stock,
          MIN(i."lowStockThreshold") AS low_stock_threshold
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
        WHERE pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = true
      ) stock ON true
      WHERE p."deleted_at" IS NULL
        AND p."isActive" = true
        AND p."status"::text = 'ACTIVE'
        AND (
          p."name" ILIKE ${pattern}
          OR p."sku" ILIKE ${pattern}
          OR b."name" ILIKE ${pattern}
          OR c."name" ILIKE ${pattern}
          OR pt."name" ILIKE ${pattern}
          OR pm."name" ILIKE ${pattern}
          OR pm."modelCode" ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN p."name" ILIKE ${query} THEN 0
          WHEN p."name" ILIKE ${`${query}%`} THEN 1
          WHEN p."sku" ILIKE ${query} THEN 2
          ELSE 3
        END,
        p."viewCount" DESC,
        p."createdAt" DESC
      LIMIT ${limit}
    `);

    const suggestions = rows.map((row) => {
      const product = this.mapListProduct(row);

      return {
        type: 'PRODUCT',
        label: product.name,
        value: product.slug,
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        brand: product.brand,
        category: product.category,
        productType: product.productType,
        productModel: product.productModel,
        pricing: product.pricing,
        stock: product.stock,
        primaryImage: product.primaryImage,
      };
    });

    return {
      query,
      suggestions,
      meta: {
        count: suggestions.length,
        limit,
        dataScope: 'PUBLIC_PRODUCT_SEARCH',
        internalDataBlocked: true,
      },
    };
  }

  async getCatalogNavigationPageData(limitValue?: string | number) {
    const limit = this.normalizeNavigationLimit(limitValue);
    const [categoryRows, brandRows, productTypeRows, productModelRows] =
      await Promise.all([
        this.prisma.$queryRaw<PublicNavigationItemRow[]>(Prisma.sql`
          SELECT
            c."id",
            c."name",
            c."slug",
            c."description",
            c."image",
            c."iconUrl" AS icon_url,
            NULL::text AS logo_url,
            parent_category."id" AS parent_id,
            parent_category."name" AS parent_name,
            parent_category."slug" AS parent_slug,
            NULL::text AS secondary_parent_id,
            NULL::text AS secondary_parent_name,
            NULL::text AS secondary_parent_slug,
            COUNT(DISTINCT p."id")::int AS product_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(stock.available_stock, 0) > 0
            )::int AS in_stock_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(p."discountPercent", 0) > 0
                OR (
                  p."comparePrice" IS NOT NULL
                  AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price", 0)
                )
            )::int AS discounted_count,
            c."sortOrder" AS sort_order,
            c."updatedAt" AS updated_at
          FROM "Category" c
          LEFT JOIN "Category" parent_category
            ON parent_category."id" = c."parent_id"
            AND parent_category."deleted_at" IS NULL
            AND parent_category."isActive" = true
          LEFT JOIN "Product" p ON p."categoryId" = c."id"
            AND p."deleted_at" IS NULL
            AND p."isActive" = true
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          WHERE c."deleted_at" IS NULL
            AND c."isActive" = true
            AND c."slug" IS NOT NULL
          GROUP BY c."id", parent_category."id"
          ORDER BY c."sortOrder" ASC, product_count DESC, c."updatedAt" DESC
          LIMIT ${limit}
        `),
        this.prisma.$queryRaw<PublicNavigationItemRow[]>(Prisma.sql`
          SELECT
            b."id",
            b."name",
            b."slug",
            b."description",
            NULL::text AS image,
            NULL::text AS icon_url,
            b."logoUrl" AS logo_url,
            NULL::text AS parent_id,
            NULL::text AS parent_name,
            NULL::text AS parent_slug,
            NULL::text AS secondary_parent_id,
            NULL::text AS secondary_parent_name,
            NULL::text AS secondary_parent_slug,
            COUNT(DISTINCT p."id")::int AS product_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(stock.available_stock, 0) > 0
            )::int AS in_stock_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(p."discountPercent", 0) > 0
                OR (
                  p."comparePrice" IS NOT NULL
                  AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price", 0)
                )
            )::int AS discounted_count,
            0::int AS sort_order,
            b."updatedAt" AS updated_at
          FROM "Brand" b
          LEFT JOIN "Product" p ON p."brandId" = b."id"
            AND p."deleted_at" IS NULL
            AND p."isActive" = true
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          WHERE b."deleted_at" IS NULL
            AND b."isActive" = true
            AND b."slug" IS NOT NULL
          GROUP BY b."id"
          ORDER BY product_count DESC, b."updatedAt" DESC
          LIMIT ${limit}
        `),
        this.prisma.$queryRaw<PublicNavigationItemRow[]>(Prisma.sql`
          SELECT
            pt."id",
            pt."name",
            pt."slug",
            pt."description",
            NULL::text AS image,
            NULL::text AS icon_url,
            NULL::text AS logo_url,
            c."id" AS parent_id,
            c."name" AS parent_name,
            c."slug" AS parent_slug,
            NULL::text AS secondary_parent_id,
            NULL::text AS secondary_parent_name,
            NULL::text AS secondary_parent_slug,
            COUNT(DISTINCT p."id")::int AS product_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(stock.available_stock, 0) > 0
            )::int AS in_stock_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(p."discountPercent", 0) > 0
                OR (
                  p."comparePrice" IS NOT NULL
                  AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price", 0)
                )
            )::int AS discounted_count,
            pt."sortOrder" AS sort_order,
            pt."updatedAt" AS updated_at
          FROM "ProductType" pt
          LEFT JOIN "Category" c ON c."id" = pt."categoryId"
          LEFT JOIN "Product" p ON p."productTypeId" = pt."id"
            AND p."deleted_at" IS NULL
            AND p."isActive" = true
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          WHERE pt."deleted_at" IS NULL
            AND pt."isActive" = true
            AND pt."slug" IS NOT NULL
          GROUP BY pt."id", c."id"
          ORDER BY pt."sortOrder" ASC, product_count DESC, pt."updatedAt" DESC
          LIMIT ${limit}
        `),
        this.prisma.$queryRaw<PublicNavigationItemRow[]>(Prisma.sql`
          SELECT
            pm."id",
            pm."name",
            pm."slug",
            pm."description",
            NULL::text AS image,
            NULL::text AS icon_url,
            NULL::text AS logo_url,
            pt."id" AS parent_id,
            pt."name" AS parent_name,
            pt."slug" AS parent_slug,
            b."id" AS secondary_parent_id,
            b."name" AS secondary_parent_name,
            b."slug" AS secondary_parent_slug,
            COUNT(DISTINCT p."id")::int AS product_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(stock.available_stock, 0) > 0
            )::int AS in_stock_count,
            COUNT(DISTINCT p."id") FILTER (
              WHERE COALESCE(p."discountPercent", 0) > 0
                OR (
                  p."comparePrice" IS NOT NULL
                  AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price", 0)
                )
            )::int AS discounted_count,
            pm."sortOrder" AS sort_order,
            pm."updatedAt" AS updated_at
          FROM "ProductModel" pm
          LEFT JOIN "ProductType" pt ON pt."id" = pm."productTypeId"
          LEFT JOIN "Brand" b ON b."id" = pm."brandId"
          LEFT JOIN "Product" p ON p."productModelId" = pm."id"
            AND p."deleted_at" IS NULL
            AND p."isActive" = true
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
            FROM "ProductVariant" pv
            LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
            WHERE pv."productId" = p."id"
              AND pv."deleted_at" IS NULL
              AND pv."isActive" = true
          ) stock ON true
          WHERE pm."deleted_at" IS NULL
            AND pm."isActive" = true
            AND pm."slug" IS NOT NULL
          GROUP BY pm."id", pt."id", b."id"
          ORDER BY pm."sortOrder" ASC, product_count DESC, pm."updatedAt" DESC
          LIMIT ${limit}
        `),
      ]);

    const sections = {
      categories: categoryRows.map((row) =>
        this.mapPublicNavigationItem(row, 'CATEGORY', '/products/category'),
      ),
      brands: brandRows.map((row) =>
        this.mapPublicNavigationItem(row, 'BRAND', '/products/brand'),
      ),
      productTypes: productTypeRows.map((row) =>
        this.mapPublicNavigationItem(row, 'PRODUCT_TYPE', '/products/type'),
      ),
      productModels: productModelRows.map((row) =>
        this.mapPublicNavigationItem(row, 'PRODUCT_MODEL', '/products/model'),
      ),
    };

    return {
      type: 'CATALOG_NAVIGATION',
      seo: {
        title: 'ناوبری کاتالوگ وکسو بیوتی',
        description:
          'داده‌های عمومی و امن برای منو، مگامنو و لینک‌های اصلی کاتالوگ فروشگاه.',
        canonicalPath: '/products',
        robots: {
          noIndex: false,
          noFollow: false,
        },
      },
      navigation: {
        canonicalPath: '/products',
        homePageDataEndpoint: '/api/products/home/page-data',
        searchPageDataEndpoint: '/api/products/search/page-data',
        sitemapEndpoint: '/api/products/seo/sitemap',
      },
      sections,
      quickActions: this.buildPublicNavigationQuickActions(sections),
      meta: {
        limit,
        categoryCount: sections.categories.length,
        brandCount: sections.brands.length,
        productTypeCount: sections.productTypes.length,
        productModelCount: sections.productModels.length,
        dataScope: 'PUBLIC_CATALOG_NAVIGATION_PAGE_DATA',
        internalDataBlocked: true,
        rule: 'بسته ناوبری کاتالوگ فقط از دسته‌بندی‌ها، برندها، نوع محصول، مدل محصول و شمارش عمومی محصولات ساخته می‌شود.',
      },
    };
  }

  async getSearchPageData(query: QueryProductDto) {
    this.assertPriceRange(query.minPrice, query.maxPrice);

    const q = this.normalizeSearchQuery(query.q);
    const effectiveQuery = {
      ...query,
      q: q ?? undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    } as QueryProductDto;

    const [productsResult, facets] = await Promise.all([
      this.findAll(effectiveQuery),
      this.getPublicFacets(effectiveQuery),
    ]);

    const productsRecord = this.toRecord(productsResult);
    const products = Array.isArray(productsRecord.data)
      ? productsRecord.data
      : [];
    const pagination = this.toRecord(productsRecord.meta);
    const suggestions = q
      ? this.toRecord(await this.getSearchSuggestions(q, 8)).suggestions
      : [];
    const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
    const title = q ? `جستجوی ${q}` : 'جستجوی محصولات';
    const canonicalPath = q
      ? `/products/search?q=${encodeURIComponent(q)}`
      : '/products/search';

    return {
      type: 'SEARCH',
      query: this.buildPublicSearchQueryState(effectiveQuery, q),
      seo: {
        title,
        description: q
          ? `نتایج جستجوی عمومی و امن برای ${q} همراه با قیمت قابل نمایش، موجودی قابل فروش و فیلترهای عمومی.`
          : 'جستجوی محصولات فروشگاه وکسو بیوتی با فیلترهای عمومی، قیمت قابل نمایش و موجودی قابل فروش.',
        canonicalPath,
        robots: {
          noIndex: false,
          noFollow: false,
        },
      },
      navigation: {
        breadcrumbs: [
          {
            label: 'محصولات',
            path: '/products',
          },
          {
            label: 'جستجو',
            path: canonicalPath,
          },
        ],
        canonicalPath,
        listingEndpoint: '/api/products',
        suggestionsEndpoint: '/api/products/search/suggestions',
        facetsEndpoint: '/api/products/search/facets',
        assistantEndpoint: '/api/products/search/assistant',
      },
      hero: {
        title,
        subtitle: q
          ? `برای عبارت ${q}، ${this.toNumber(pagination.total) || products.length} محصول عمومی پیدا شد.`
          : 'عبارت جستجو یا فیلترها را انتخاب کنید تا محصولات عمومی فروشگاه نمایش داده شوند.',
        totalProducts: this.toNumber(pagination.total) || products.length,
        primaryAction: {
          label: 'فیلتر محصولات',
          path: '/products/search/facets',
        },
      },
      sections: {
        products,
        suggestions: safeSuggestions,
        facets,
        pagination,
        sortOptions: this.buildCatalogLandingSortOptions(),
        emptyState: {
          title: 'نتیجه‌ای برای این جستجو یافت نشد.',
          description:
            'عبارت جستجو یا فیلترها را تغییر دهید یا از راهنمای هوشمند جستجو استفاده کنید.',
        },
      },
      nextActions: this.buildSearchPageNextActions(q),
      meta: {
        dataScope: 'PUBLIC_SEARCH_PAGE_DATA',
        internalDataBlocked: true,
        productCount: products.length,
        suggestionCount: safeSuggestions.length,
        total: this.toNumber(pagination.total) || products.length,
        page: this.toNumber(pagination.page) || 1,
        limit: this.toNumber(pagination.limit) || products.length,
        rule: 'بسته صفحه جستجو فقط از محصولات عمومی، facetهای عمومی، پیشنهادهای عمومی، قیمت قابل نمایش و موجودی قابل فروش ساخته می‌شود.',
      },
    };
  }

  async getSearchAssistant(q?: string, limitValue?: string | number) {
    const query = this.normalizeSearchQuery(q);

    if (!query) {
      throw new BadRequestException(
        'برای راهنمای جستجو، عبارت جستجو باید حداقل دو کاراکتر داشته باشد.',
      );
    }

    const limit = this.normalizeSuggestionLimit(limitValue);
    const suggestionsResult = await this.getSearchSuggestions(query, limit);
    const facets = await this.getPublicFacets({
      q: query,
      page: 1,
      limit,
    });

    const suggestionsRecord = this.toRecord(suggestionsResult);
    const suggestions = Array.isArray(suggestionsRecord.suggestions)
      ? suggestionsRecord.suggestions
      : [];

    const context = this.buildSearchAssistantContext(
      query,
      suggestions,
      facets,
    );

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildSearchAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 520,
            promptKey: 'product.public.search_assistant.answer',
            metadata: {
              query,
              suggestionCount: suggestions.length,
              generatedFor: 'PUBLIC_SEARCH_ASSISTANT_AI',
            },
          },
        ),
        this.searchAssistantAiTimeoutMs,
        'AI_SEARCH_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafePublicCurrencyUnitAnswer(answer)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicSearchAssistantAnswer(context);
        model = 'backend-deterministic-safe-search-assistant';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicSearchAssistantAnswer(context);
      model = 'backend-deterministic-safe-search-assistant';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      query,
      answer,
      source,
      model,
      provider,
      taskType,
      suggestions,
      facets,
      safety: {
        safeOutput: true,
        dataScope:
          'جستجوی عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش و facetهای عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'راهنمای جستجو فقط بر اساس نتایج و facetهای عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_SEARCH_ASSISTANT_AI',
    };
  }

  async getHomePageData(limitValue?: string | number) {
    const homeSections = await this.getHomeSections(limitValue);
    const sections = Array.isArray(homeSections.sections)
      ? homeSections.sections
      : [];
    const limit =
      this.toNumber(this.toRecord(homeSections.meta).limit) ||
      this.normalizeSuggestionLimit(limitValue);

    return {
      type: 'HOME',
      seo: {
        title: 'فروشگاه هوشمند زیبایی وکسو بیوتی',
        description:
          'خرید محصولات زیبایی، مراقبت پوست، مراقبت مو و ابزار برقی زیبایی با راهنمای هوشمند، قیمت قابل نمایش و موجودی قابل فروش.',
        canonicalPath: '/',
        robots: {
          noIndex: false,
          noFollow: false,
        },
      },
      navigation: {
        canonicalPath: '/',
        sectionsEndpoint: '/api/products/home/sections',
        assistantEndpoint: '/api/products/home/assistant',
        searchPageEndpoint: '/api/products/search/page-data',
      },
      hero: {
        title: 'فروشگاه هوشمند زیبایی وکسو بیوتی',
        subtitle:
          'محصولات منتخب، تخفیف‌دار، پربازدید و آماده خرید را با داده‌های عمومی امن مشاهده کنید.',
        primaryAction: {
          label: 'جستجوی محصولات',
          path: '/products/search',
        },
        secondaryAction: {
          label: 'دریافت راهنمای هوشمند',
          path: '/products/home/assistant',
        },
      },
      sections: {
        productSections: sections,
        sortOptions: this.buildCatalogLandingSortOptions(),
        quickLinks: [
          {
            key: 'new_arrivals',
            label: 'جدیدترین محصولات',
            path: '/products?sort=newest',
          },
          {
            key: 'discounted',
            label: 'پیشنهادهای تخفیف‌دار',
            path: '/products?hasDiscount=true',
          },
          {
            key: 'in_stock',
            label: 'آماده خرید',
            path: '/products?inStock=true',
          },
        ],
      },
      nextActions: [
        {
          key: 'search_products',
          label: 'جستجوی محصولات',
          path: '/products/search',
        },
        {
          key: 'ask_home_assistant',
          label: 'دریافت راهنمای هوشمند صفحه اصلی',
          path: '/products/home/assistant',
        },
        {
          key: 'open_discounted',
          label: 'مشاهده محصولات تخفیف‌دار',
          path: '/products?hasDiscount=true',
        },
      ],
      meta: {
        limit,
        sectionCount: sections.length,
        dataScope: 'PUBLIC_HOME_PAGE_DATA',
        internalDataBlocked: true,
        rule: 'بسته صفحه اصلی فقط از بخش‌های عمومی محصولات، قیمت قابل نمایش و موجودی قابل فروش ساخته می‌شود.',
      },
    };
  }

  async getHomeSections(limitValue?: string | number) {
    const limit = this.normalizeSuggestionLimit(limitValue);

    const [newArrivalsResult, discountedResult, popularResult, inStockResult] =
      await Promise.all([
        this.findAll({ page: 1, limit }),
        this.findAll({
          page: 1,
          limit,
          hasDiscount: true,
          sort: 'popular',
        }),
        this.findAll({ page: 1, limit, sort: 'popular' }),
        this.findAll({ page: 1, limit, inStock: true }),
      ]);

    const sections = [
      {
        key: 'new_arrivals',
        title: 'جدیدترین محصولات',
        description: 'محصولات تازه‌تر فروشگاه بر اساس تاریخ ثبت.',
        products: this.extractPaginatedProducts(newArrivalsResult),
      },
      {
        key: 'discounted',
        title: 'پیشنهادهای تخفیف‌دار',
        description: 'محصولاتی که قیمت قابل نمایش آن‌ها شامل تخفیف عمومی است.',
        products: this.extractPaginatedProducts(discountedResult),
      },
      {
        key: 'popular',
        title: 'محصولات پربازدید',
        description: 'محصولات مرتب‌شده بر اساس بازدید و تعامل عمومی.',
        products: this.extractPaginatedProducts(popularResult),
      },
      {
        key: 'in_stock',
        title: 'آماده خرید',
        description: 'محصولاتی که موجودی قابل فروش دارند.',
        products: this.extractPaginatedProducts(inStockResult),
      },
    ];

    return {
      sections,
      meta: {
        limit,
        sectionCount: sections.length,
        dataScope: 'PUBLIC_HOME_PRODUCT_SECTIONS',
        internalDataBlocked: true,
      },
    };
  }

  async getHomeAssistant(limitValue?: string | number) {
    const homeSections = await this.getHomeSections(limitValue);
    const context = this.buildHomeAssistantContext(homeSections);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(this.buildHomeAssistantMessages(context), {
          task: 'RECOMMENDATION',
          temperature: 0.2,
          maxTokens: 620,
          promptKey: 'product.public.home_assistant.answer',
          metadata: {
            sectionCount: context.sections.length,
            generatedFor: 'PUBLIC_HOME_ASSISTANT_AI',
          },
        }),
        this.homeAssistantAiTimeoutMs,
        'AI_HOME_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (!answer || this.hasAdvisorSensitiveLeak(answer)) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicHomeAssistantAnswer(context);
        model = 'backend-deterministic-safe-home-assistant';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicHomeAssistantAnswer(context);
      model = 'backend-deterministic-safe-home-assistant';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      answer,
      source,
      model,
      provider,
      taskType,
      sections: homeSections.sections,
      safety: {
        safeOutput: true,
        dataScope:
          'بخش‌های عمومی صفحه اصلی، قیمت قابل نمایش و موجودی قابل فروش',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ صفحه اصلی فقط بر اساس محصولات عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_HOME_ASSISTANT_AI',
      meta: homeSections.meta,
    };
  }

  async getPublicSitemap(limit?: string) {
    const safeLimit = this.normalizeSitemapLimit(limit);

    const rows = await this.prisma.$queryRaw<PublicSitemapRow[]>(Prisma.sql`
      SELECT
        'PRODUCT'::text AS kind,
        p."name" AS name,
        p."slug" AS slug,
        ('/products/' || p."slug")::text AS path,
        p."updatedAt" AS updated_at,
        0.85::numeric AS priority,
        'daily'::text AS changefreq
      FROM "Product" p
      WHERE p."deleted_at" IS NULL
        AND p."isActive" = true
        AND p."status"::text = 'ACTIVE'
        AND p."slug" IS NOT NULL

      UNION ALL

      SELECT
        'CATEGORY'::text AS kind,
        c."name" AS name,
        c."slug" AS slug,
        ('/products/category/' || c."slug")::text AS path,
        c."updatedAt" AS updated_at,
        0.75::numeric AS priority,
        'daily'::text AS changefreq
      FROM "Category" c
      WHERE c."deleted_at" IS NULL
        AND c."isActive" = true
        AND c."slug" IS NOT NULL

      UNION ALL

      SELECT
        'BRAND'::text AS kind,
        b."name" AS name,
        b."slug" AS slug,
        ('/products/brand/' || b."slug")::text AS path,
        b."updatedAt" AS updated_at,
        0.7::numeric AS priority,
        'weekly'::text AS changefreq
      FROM "Brand" b
      WHERE b."deleted_at" IS NULL
        AND b."isActive" = true
        AND b."slug" IS NOT NULL

      ORDER BY updated_at DESC
      LIMIT ${safeLimit}
    `);

    return {
      urls: rows.map((row) => ({
        type: row.kind,
        name:
          this.sanitizeCustomerText(this.nullIfDamaged(row.name)) ?? row.slug,
        slug: row.slug,
        path: row.path,
        updatedAt: row.updated_at.toISOString(),
        updatedAtFa: this.formatDateTimeFa(row.updated_at),
        priority: this.toNumber(row.priority),
        changefreq: row.changefreq,
      })),
      meta: {
        count: rows.length,
        limit: safeLimit,
        dataScope: 'PUBLIC_SEO_SITEMAP',
        internalDataBlocked: true,
      },
    };
  }

  async getProductSeoSchema(identifier: string) {
    const productPage = await this.findOne(identifier, {
      incrementView: false,
    });
    const product = this.toRecord(productPage);
    const brand = this.toRecord(product.brand);
    const category = this.toRecord(product.category);
    const productType = this.toRecord(product.productType);
    const productModel = this.toRecord(product.productModel);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const media = this.toRecord(product.media);
    const primaryImage = this.toRecord(media.primaryImage);
    const images = Array.isArray(media.images) ? media.images : [];

    const imageUrls = Array.from(
      new Set(
        [
          this.getString(primaryImage.url),
          ...images
            .map((item) => this.getString(this.toRecord(item).url))
            .filter((url): url is string => Boolean(url)),
        ].filter((url): url is string => Boolean(url)),
      ),
    );

    const rating = this.toRecord(product.rating);
    const reviewCount = this.toNumber(rating.reviewCount);
    const averageRating = this.getString(rating.average);
    const productPath = `/products/${this.getString(product.slug) ?? identifier}`;
    const description =
      this.sanitizeCustomerText(this.getString(product.shortDescription)) ??
      this.sanitizeCustomerText(this.getString(product.description)) ??
      this.sanitizeCustomerText(this.getString(product.name)) ??
      'محصول فروشگاه وکسو بیوتی';

    const schema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: this.sanitizeCustomerText(this.getString(product.name)),
      description,
      sku: this.sanitizeCustomerText(this.getString(product.sku)),
      url: productPath,
      image: imageUrls,
      brand: this.getString(brand.name)
        ? {
            '@type': 'Brand',
            name: this.sanitizeCustomerText(this.getString(brand.name)),
          }
        : undefined,
      category: this.sanitizeCustomerText(this.getString(category.name)),
      model: this.sanitizeCustomerText(
        this.getString(productModel.name) ??
          this.getString(productModel.modelCode),
      ),
      additionalType: this.sanitizeCustomerText(
        this.getString(productType.name),
      ),
      offers: {
        '@type': 'Offer',
        priceCurrency: 'IRR',
        price:
          this.getString(pricing.displayPrice) ??
          this.getString(pricing.finalPrice) ??
          this.getString(pricing.salePrice) ??
          this.getString(pricing.regularPrice),
        availability:
          this.getBoolean(stock.inStock) === true
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        url: productPath,
      },
    };

    if (reviewCount > 0 && averageRating) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: averageRating,
        reviewCount,
      };
    }

    return {
      product: {
        id: this.getString(product.id),
        name: this.sanitizeCustomerText(this.getString(product.name)),
        slug: this.getString(product.slug),
        sku: this.sanitizeCustomerText(this.getString(product.sku)),
        brand: {
          name: this.sanitizeCustomerText(this.getString(brand.name)),
          slug: this.getString(brand.slug),
        },
        category: {
          name: this.sanitizeCustomerText(this.getString(category.name)),
          slug: this.getString(category.slug),
        },
        pricing,
        stock,
      },
      schema: this.removeUndefinedValues(schema),
      meta: {
        dataScope: 'PUBLIC_PRODUCT_SEO_SCHEMA',
        internalDataBlocked: true,
      },
    };
  }

  async getCompareProducts(itemsValue?: string, limitValue?: string | number) {
    const identifiers = this.normalizeCompareIdentifiers(
      itemsValue,
      limitValue,
    );
    const productPages = await Promise.all(
      identifiers.map((identifier) =>
        this.findOne(identifier, { incrementView: false }),
      ),
    );

    const uniqueProducts = Array.from(
      new Map(
        productPages.map((item) => {
          const record = this.toRecord(item);
          return [
            this.getString(record.id) ?? this.getString(record.slug),
            item,
          ];
        }),
      ).values(),
    );

    if (uniqueProducts.length < 2) {
      throw new BadRequestException(
        'برای مقایسه، حداقل دو محصول متفاوت لازم است.',
      );
    }

    const products = uniqueProducts.map((item) => this.mapCompareProduct(item));
    const matrix = this.buildComparisonMatrix(products);
    const insights = this.buildComparisonInsights(products);

    return {
      items: products,
      matrix,
      insights,
      meta: {
        count: products.length,
        requestedCount: identifiers.length,
        dataScope: 'PUBLIC_PRODUCT_COMPARISON',
        internalDataBlocked: true,
        rule: 'فقط مشخصات عمومی، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی مقایسه می‌شوند.',
      },
    };
  }

  async getComparePageData(itemsValue?: string, limitValue?: string | number) {
    const comparison = await this.getCompareProducts(itemsValue, limitValue);
    const comparisonRecord = this.toRecord(comparison);
    const items = Array.isArray(comparisonRecord.items)
      ? comparisonRecord.items
      : [];
    const matrix = Array.isArray(comparisonRecord.matrix)
      ? comparisonRecord.matrix
      : [];
    const insights = this.toRecord(comparisonRecord.insights);
    const meta = this.toRecord(comparisonRecord.meta);
    const itemSlugs = items
      .map((item) => this.getString(this.toRecord(item).slug))
      .filter((item): item is string => Boolean(item));
    const itemsQuery = itemSlugs.join(',');
    const encodedItemsQuery = encodeURIComponent(itemsQuery);
    const canonicalPath = encodedItemsQuery
      ? `/products/compare?items=${encodedItemsQuery}`
      : '/products/compare';
    const productNames = items
      .map((item) =>
        this.sanitizeCustomerText(this.getString(this.toRecord(item).name)),
      )
      .filter((item): item is string => Boolean(item));
    const primaryTitle =
      productNames.length > 0
        ? `مقایسه ${productNames.slice(0, 2).join(' و ')}`
        : 'مقایسه محصولات';

    return {
      type: 'COMPARE',
      seo: {
        title: primaryTitle,
        description:
          'مقایسه امن محصولات بر اساس مشخصات عمومی، قیمت قابل نمایش، موجودی قابل فروش و ویژگی‌های عمومی قابل مقایسه.',
        canonicalPath,
        robots: {
          noIndex: false,
          noFollow: false,
        },
      },
      navigation: {
        breadcrumbs: [
          {
            label: 'محصولات',
            path: '/products',
          },
          {
            label: 'مقایسه محصولات',
            path: canonicalPath,
          },
        ],
        canonicalPath,
        compareEndpoint: encodedItemsQuery
          ? `/api/products/compare?items=${encodedItemsQuery}`
          : '/api/products/compare',
        assistantEndpoint: encodedItemsQuery
          ? `/api/products/compare/assistant?items=${encodedItemsQuery}`
          : '/api/products/compare/assistant',
        searchPageEndpoint: '/api/products/search/page-data',
      },
      hero: {
        title: primaryTitle,
        subtitle: `در این صفحه ${items.length} محصول با داده‌های عمومی و قیمت ریالی قابل نمایش مقایسه می‌شوند.`,
        totalProducts: items.length,
        primaryAction: {
          label: 'افزودن محصول دیگر',
          path: '/products/search',
        },
        secondaryAction: {
          label: 'راهنمای هوشمند مقایسه',
          path: canonicalPath.includes('?')
            ? `${canonicalPath}&assistant=true`
            : '/products/compare/assistant',
        },
      },
      sections: {
        items,
        matrix,
        insights,
        summaryCards: this.buildComparePageSummaryCards(items, insights),
        emptyState: {
          title: 'برای مقایسه، حداقل دو محصول انتخاب کنید.',
          description:
            'از صفحه جستجو یا کارت محصول، محصولات مورد نظر را به مقایسه اضافه کنید.',
        },
      },
      nextActions: this.buildComparePageNextActions(itemSlugs),
      meta: {
        count: items.length,
        requestedCount: this.toNumber(meta.requestedCount) || items.length,
        dataScope: 'PUBLIC_PRODUCT_COMPARE_PAGE_DATA',
        internalDataBlocked: true,
        rule: 'بسته صفحه مقایسه فقط از مشخصات عمومی، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی قابل مقایسه ساخته می‌شود.',
      },
    };
  }

  async getCompareAssistant(itemsValue?: string, limitValue?: string | number) {
    const comparison = await this.getCompareProducts(itemsValue, limitValue);
    const context = this.buildCompareAssistantContext(comparison);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildCompareAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 680,
            promptKey: 'product.public.compare.answer',
            metadata: {
              productCount: context.items.length,
              generatedFor: 'PUBLIC_PRODUCT_COMPARE_ASSISTANT_AI',
            },
          },
        ),
        this.compareAssistantAiTimeoutMs,
        'AI_COMPARE_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafePublicCurrencyUnitAnswer(answer)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicCompareAnswer(context);
        model = 'backend-deterministic-safe-product-compare';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicCompareAnswer(context);
      model = 'backend-deterministic-safe-product-compare';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...comparison,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'مقایسه عمومی محصولات، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ مقایسه فقط بر اساس محصولات و ماتریس عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_COMPARE_ASSISTANT_AI',
    };
  }

  async getProductHighlights(identifier: string) {
    const productPage = await this.findOne(identifier, {
      incrementView: false,
    });
    const product = this.toRecord(productPage);
    const attributes = Array.isArray(product.attributes)
      ? product.attributes.map((item) => this.toRecord(item))
      : [];
    const attributeMap = this.buildPublicAttributeValueMap(attributes);
    const highlights = this.buildProductHighlightItems(product, attributeMap);
    const badges = this.buildProductHighlightBadges(product, highlights);

    return {
      product: this.buildFaqProductSummary(product),
      highlights,
      badges,
      cta: {
        primary: 'مشاهده و خرید محصول',
        secondary: 'پرسیدن سوال از مشاور فروش',
        productPath: `/products/${this.getString(product.slug) ?? ''}`,
      },
      meta: {
        count: highlights.length,
        badgeCount: badges.length,
        dataScope: 'PUBLIC_PRODUCT_HIGHLIGHTS',
        internalDataBlocked: true,
        rule: 'نکات برجسته فقط بر اساس توضیحات عمومی، قیمت قابل نمایش، موجودی قابل فروش، رسانه عمومی و attributes عمومی ساخته می‌شوند.',
      },
    };
  }

  async getProductHighlightsAssistant(identifier: string) {
    const highlightsResponse = await this.getProductHighlights(identifier);
    const context =
      this.buildProductHighlightAssistantContext(highlightsResponse);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildProductHighlightAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 520,
            promptKey: 'product.public.highlights_assistant.answer',
            metadata: {
              productId: context.product.id,
              productSlug: context.product.slug,
              highlightCount: context.highlights.length,
              generatedFor: 'PUBLIC_PRODUCT_HIGHLIGHTS_ASSISTANT_AI',
            },
          },
        ),
        this.productHighlightsAssistantAiTimeoutMs,
        'AI_PRODUCT_HIGHLIGHTS_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafeDisplayPriceAnswer(answer, context.product.displayPrice)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicProductHighlightAnswer(context);
        model = 'backend-deterministic-safe-product-highlights';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicProductHighlightAnswer(context);
      model = 'backend-deterministic-safe-product-highlights';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...highlightsResponse,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'نکات برجسته عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش، badges عمومی و attributes عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ نکات برجسته فقط بر اساس داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_HIGHLIGHTS_ASSISTANT_AI',
    };
  }

  async getProductQuickView(identifier: string) {
    const [productPage, highlightsResponse, purchaseGuideResponse] =
      await Promise.all([
        this.findOne(identifier, { incrementView: false }),
        this.getProductHighlights(identifier),
        this.getProductPurchaseGuide(identifier),
      ]);

    const product = this.toRecord(productPage);
    const highlightsRecord = this.toRecord(highlightsResponse);
    const purchaseGuideRecord = this.toRecord(purchaseGuideResponse);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const media = this.toRecord(product.media);
    const primaryImageRecord = this.toRecord(media.primaryImage);
    const decision = this.toRecord(purchaseGuideRecord.decision);
    const slug = this.getString(product.slug) ?? identifier;
    const name =
      this.sanitizeCustomerText(this.getString(product.name)) ?? slug;
    const displayPrice = this.getString(pricing.displayPrice);
    const availableStock = this.toNumber(stock.availableStock);
    const highlights = Array.isArray(highlightsRecord.highlights)
      ? highlightsRecord.highlights
          .slice(0, 4)
          .map((item) => this.toRecord(item))
          .map((item) => ({
            key: this.sanitizeCustomerText(this.getString(item.key)),
            title: this.sanitizeCustomerText(this.getString(item.title)),
            value: this.sanitizeCustomerText(this.getString(item.value)),
            source: this.sanitizeCustomerText(this.getString(item.source)),
          }))
          .filter((item) => Boolean(item.title && item.value))
      : [];
    const badges = Array.isArray(highlightsRecord.badges)
      ? highlightsRecord.badges
          .map((item) => this.sanitizeCustomerText(this.getString(item)))
          .filter((item): item is string => Boolean(item))
          .slice(0, 5)
      : [];
    const quickFacts = [
      displayPrice
        ? {
            key: 'display_price',
            title: 'قیمت قابل نمایش',
            value: `${displayPrice} ریال`,
            source: 'PUBLIC_PRICING',
          }
        : null,
      {
        key: 'availability',
        title: 'وضعیت موجودی',
        value: this.getBoolean(stock.inStock)
          ? `موجود؛ موجودی قابل فروش ${availableStock} عدد است.`
          : 'ناموجود برای خرید عمومی',
        source: 'PUBLIC_STOCK',
      },
      this.getBoolean(pricing.hasDiscount)
        ? {
            key: 'discount',
            title: 'تخفیف عمومی',
            value: this.getString(pricing.discountPercent)
              ? `تخفیف عمومی ${this.getString(pricing.discountPercent)} درصدی فعال است.`
              : 'تخفیف عمومی برای این محصول فعال است.',
            source: 'PUBLIC_PRICING',
          }
        : null,
      badges.length > 0
        ? {
            key: 'badges',
            title: 'نشان‌های محصول',
            value: badges.join('، '),
            source: 'PUBLIC_HIGHLIGHTS',
          }
        : null,
    ].filter(
      (
        item,
      ): item is {
        key: string;
        title: string;
        value: string;
        source: string;
      } => Boolean(item),
    );
    const primaryImage = this.getString(primaryImageRecord.url)
      ? {
          url: this.getString(primaryImageRecord.url),
          altText: this.sanitizeCustomerText(
            this.getString(primaryImageRecord.altText),
          ),
        }
      : null;

    return {
      type: 'PRODUCT_QUICK_VIEW',
      product: {
        id: this.getString(product.id),
        name,
        slug,
        sku: this.sanitizeCustomerText(this.getString(product.sku)),
        shortDescription: this.sanitizeCustomerText(
          this.getString(product.shortDescription),
        ),
        brand: this.toRecord(product.brand),
        category: this.toRecord(product.category),
        productType: this.toRecord(product.productType),
        productModel: this.toRecord(product.productModel),
        pricing,
        stock,
        primaryImage,
        rating: this.toRecord(product.rating),
      },
      badges,
      highlights,
      quickFacts,
      purchaseStatus: {
        score: this.toNumber(decision.score),
        readiness: this.getString(decision.readiness) ?? 'NEED_MORE_INFO',
        label:
          this.sanitizeCustomerText(this.getString(decision.label)) ??
          'وضعیت خرید عمومی',
        recommendation: this.sanitizeCustomerText(
          this.getString(decision.recommendation),
        ),
      },
      cta: {
        primary: {
          label: this.getBoolean(stock.inStock)
            ? 'مشاهده و خرید محصول'
            : 'مشاهده جزئیات محصول',
          path: `/products/${slug}`,
          enabled: true,
        },
        secondary: {
          label: 'پرسیدن سوال از مشاور فروش',
          path: `/products/${slug}#sales-advisor`,
          enabled: true,
        },
      },
      nextActions: [
        {
          key: 'open_product',
          label: 'مشاهده صفحه محصول',
          path: `/products/${slug}`,
        },
        {
          key: 'compare',
          label: 'افزودن به مقایسه',
          path: `/products/compare?items=${slug}`,
        },
        {
          key: 'ask_sales_advisor',
          label: 'پرسیدن سوال از مشاور فروش',
          path: `/products/${slug}#sales-advisor`,
        },
      ],
      meta: {
        dataScope: 'PUBLIC_PRODUCT_QUICK_VIEW',
        internalDataBlocked: true,
        highlightCount: highlights.length,
        badgeCount: badges.length,
        quickFactCount: quickFacts.length,
        rule: 'نمایش سریع محصول فقط از داده‌های عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش، تصویر عمومی و highlights عمومی ساخته می‌شود.',
      },
    };
  }

  async getProductQuickViewAssistant(identifier: string) {
    const quickView = await this.getProductQuickView(identifier);
    const product = this.toRecord(quickView.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const purchaseStatus = this.toRecord(quickView.purchaseStatus);
    const highlights = Array.isArray(quickView.highlights)
      ? quickView.highlights.map((item) => this.toRecord(item))
      : [];
    const name =
      this.sanitizeCustomerText(this.getString(product.name)) ??
      this.getString(product.slug) ??
      'این محصول';
    const displayPrice = this.getString(pricing.displayPrice);
    const availableStock = this.toNumber(stock.availableStock);
    const statusLabel =
      this.sanitizeCustomerText(this.getString(purchaseStatus.label)) ??
      'وضعیت خرید عمومی';
    const topHighlight = this.toRecord(highlights[0]);
    const topHighlightText = this.sanitizeCustomerText(
      this.getString(topHighlight.value) ?? this.getString(topHighlight.title),
    );
    const answer = [
      `نمایش سریع ${name}:`,
      displayPrice ? `قیمت قابل نمایش: ${displayPrice} ریال.` : null,
      `موجودی قابل فروش: ${availableStock} عدد.`,
      `وضعیت خرید: ${statusLabel}.`,
      topHighlightText ? `نکته شاخص: ${topHighlightText}` : null,
      'برای تصمیم دقیق‌تر، صفحه محصول یا مشاور فروش همین محصول را باز کنید.',
      'این پاسخ فقط بر اساس داده‌های عمومی نمایش سریع ساخته شده است.',
    ]
      .filter((item): item is string => Boolean(item))
      .join('\n');

    return {
      ...quickView,
      answer,
      source: 'SAFE_FALLBACK',
      model: 'backend-deterministic-safe-product-quick-view',
      provider: 'backend',
      taskType: 'RECOMMENDATION',
      safety: {
        safeOutput: true,
        dataScope:
          'نمایش سریع عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش، تصویر عمومی و highlights عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ نمایش سریع فقط بر اساس داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_QUICK_VIEW_ASSISTANT',
    };
  }

  async getProductPageData(identifier: string) {
    const [
      productPage,
      highlightsResponse,
      faqResponse,
      purchaseGuideResponse,
      seoSchemaResponse,
      relatedResponse,
    ] = await Promise.all([
      this.findOne(identifier, { incrementView: false }),
      this.getProductHighlights(identifier),
      this.getProductFaq(identifier),
      this.getProductPurchaseGuide(identifier),
      this.getProductSeoSchema(identifier),
      this.getRelatedProducts(identifier, 4),
    ]);

    const product = this.toRecord(productPage);
    const seo = this.toRecord(product.seo);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const highlightsRecord = this.toRecord(highlightsResponse);
    const faqRecord = this.toRecord(faqResponse);
    const purchaseGuideRecord = this.toRecord(purchaseGuideResponse);
    const seoSchemaRecord = this.toRecord(seoSchemaResponse);
    const relatedRecord = this.toRecord(relatedResponse);
    const slug = this.getString(product.slug) ?? identifier;
    const name =
      this.sanitizeCustomerText(this.getString(product.name)) ?? slug;
    const pageTitle =
      this.sanitizeCustomerText(this.getString(seo.title)) ?? name;
    const pageDescription =
      this.sanitizeCustomerText(this.getString(seo.description)) ??
      this.sanitizeCustomerText(this.getString(product.shortDescription)) ??
      this.sanitizeCustomerText(this.getString(product.description)) ??
      name;
    const highlights = Array.isArray(highlightsRecord.highlights)
      ? highlightsRecord.highlights
      : [];
    const badges = Array.isArray(highlightsRecord.badges)
      ? highlightsRecord.badges
      : [];
    const faq = Array.isArray(faqRecord.faq) ? faqRecord.faq : [];
    const related = Array.isArray(relatedRecord.related)
      ? relatedRecord.related
      : [];
    const nextActions = Array.isArray(purchaseGuideRecord.nextActions)
      ? purchaseGuideRecord.nextActions
      : [
          {
            key: 'open_product',
            label: 'مشاهده صفحه محصول',
            path: `/products/${slug}`,
          },
          {
            key: 'ask_sales_advisor',
            label: 'پرسیدن سوال از مشاور فروش',
            path: `/products/${slug}#sales-advisor`,
          },
        ];

    return {
      product: productPage,
      seo: {
        title: pageTitle,
        description: pageDescription,
        canonicalPath: `/products/${slug}`,
        schema: this.toRecord(seoSchemaRecord.schema),
      },
      commercial: {
        pricing,
        stock,
        decision: this.toRecord(purchaseGuideRecord.decision),
      },
      sections: {
        highlights,
        badges,
        faq,
        related,
        purchaseGuide: {
          decision: this.toRecord(purchaseGuideRecord.decision),
          recommendation: this.getString(
            this.toRecord(purchaseGuideRecord.decision).recommendation,
          ),
        },
        salesAdvisor: {
          contextEndpoint: `/api/products/${slug}/sales-advisor-context`,
          askEndpoint: `/api/products/${slug}/sales-advisor/ask`,
          visibilityPolicy:
            'مشاور فروش فقط مجاز است از اطلاعات عمومی محصول، قیمت قابل نمایش و موجودی قابل فروش استفاده کند.',
        },
      },
      nextActions,
      meta: {
        dataScope: 'PUBLIC_PRODUCT_PAGE_DATA',
        internalDataBlocked: true,
        highlightCount: highlights.length,
        faqCount: faq.length,
        relatedCount: related.length,
        rule: 'بسته صفحه محصول فقط از جزئیات عمومی محصول، SEO عمومی، highlights، FAQ، راهنمای خرید و محصولات مرتبط عمومی ساخته می‌شود.',
      },
    };
  }

  async getProductPageDataAssistant(identifier: string) {
    const pageData = await this.getProductPageData(identifier);
    const product = this.toRecord(pageData.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const commercial = this.toRecord(pageData.commercial);
    const decision = this.toRecord(commercial.decision);
    const sections = this.toRecord(pageData.sections);
    const highlights = Array.isArray(sections.highlights)
      ? sections.highlights
      : [];
    const faq = Array.isArray(sections.faq) ? sections.faq : [];
    const related = Array.isArray(sections.related) ? sections.related : [];
    const name =
      this.sanitizeCustomerText(this.getString(product.name)) ??
      this.getString(product.slug) ??
      'این محصول';
    const displayPrice = this.getString(pricing.displayPrice);
    const availableStock = this.toNumber(stock.availableStock);
    const readinessLabel =
      this.sanitizeCustomerText(this.getString(decision.label)) ??
      'وضعیت خرید عمومی';
    const topHighlight = this.toRecord(highlights[0]);
    const topHighlightText = this.sanitizeCustomerText(
      this.getString(topHighlight.value) ?? this.getString(topHighlight.title),
    );

    const answerParts = [
      `خلاصه امن صفحه محصول ${name}:`,
      displayPrice ? `قیمت قابل نمایش: ${displayPrice} ریال.` : null,
      `موجودی قابل فروش: ${availableStock} عدد.`,
      `وضعیت تصمیم خرید: ${readinessLabel}.`,
      topHighlightText ? `نکته شاخص: ${topHighlightText}` : null,
      `تعداد سوالات متداول عمومی: ${faq.length}.`,
      `تعداد محصولات مرتبط عمومی: ${related.length}.`,
      'برای تصمیم دقیق‌تر، بخش highlights، FAQ، راهنمای خرید و محصولات مرتبط همین صفحه را بررسی کنید.',
      'این پاسخ فقط بر اساس داده‌های عمومی صفحه محصول ساخته شده است.',
    ].filter((item): item is string => Boolean(item));

    return {
      ...pageData,
      answer: answerParts.join('\n'),
      source: 'SAFE_FALLBACK',
      model: 'backend-deterministic-safe-product-page-data',
      provider: 'backend',
      taskType: 'RECOMMENDATION',
      safety: {
        safeOutput: true,
        dataScope:
          'بسته عمومی صفحه محصول، قیمت قابل نمایش، موجودی قابل فروش، highlights، FAQ و محصولات مرتبط عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ صفحه محصول فقط بر اساس داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_PAGE_DATA_ASSISTANT',
    };
  }

  async getProductPurchaseGuide(identifier: string) {
    const highlightsResponse = await this.getProductHighlights(identifier);
    const faqResponse = await this.getProductFaq(identifier);
    const relatedResponse = await this.getRelatedProducts(identifier, 4);
    const product = this.toRecord(highlightsResponse.product);
    const highlights = Array.isArray(highlightsResponse.highlights)
      ? highlightsResponse.highlights
      : [];
    const badges = Array.isArray(highlightsResponse.badges)
      ? highlightsResponse.badges
      : [];
    const faq = Array.isArray(faqResponse.faq)
      ? faqResponse.faq.slice(0, 6)
      : [];
    const relatedResponseRecord = this.toRecord(relatedResponse);
    const related = Array.isArray(relatedResponseRecord.related)
      ? relatedResponseRecord.related.slice(0, 4).map((item) => {
          const row = this.toRecord(item);

          return {
            id: this.getString(row.id),
            name: this.sanitizeCustomerText(this.getString(row.name)),
            slug: this.getString(row.slug),
            pricing: this.toRecord(row.pricing),
            stock: this.toRecord(row.stock),
            reasons: Array.isArray(row.reasons)
              ? row.reasons
                  .map((reason) =>
                    this.sanitizeCustomerText(this.getString(reason)),
                  )
                  .filter((reason): reason is string => Boolean(reason))
              : [],
          };
        })
      : [];
    const decision = this.buildProductPurchaseDecision(
      product,
      highlights,
      badges,
    );

    return {
      product: this.buildFaqProductSummary(product),
      decision,
      highlights,
      badges,
      faq,
      related,
      nextActions: this.buildProductPurchaseNextActions(product, decision),
      meta: {
        dataScope: 'PUBLIC_PRODUCT_PURCHASE_GUIDE',
        internalDataBlocked: true,
        highlightCount: highlights.length,
        faqCount: faq.length,
        relatedCount: related.length,
        rule: 'راهنمای خرید فقط بر اساس اطلاعات عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش، FAQ عمومی و محصولات مرتبط عمومی ساخته می‌شود.',
      },
    };
  }

  async getProductPurchaseGuideAssistant(identifier: string) {
    const guideResponse = await this.getProductPurchaseGuide(identifier);
    const context =
      this.buildProductPurchaseGuideAssistantContext(guideResponse);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildProductPurchaseGuideAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 620,
            promptKey: 'product.public.purchase_guide.answer',
            metadata: {
              productId: context.product.id,
              productSlug: context.product.slug,
              readiness: context.decision.readiness,
              generatedFor: 'PUBLIC_PRODUCT_PURCHASE_GUIDE_ASSISTANT_AI',
            },
          },
        ),
        this.productPurchaseGuideAssistantAiTimeoutMs,
        'AI_PRODUCT_PURCHASE_GUIDE_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafeDisplayPriceAnswer(answer, context.product.displayPrice)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicProductPurchaseGuideAnswer(context);
        model = 'backend-deterministic-safe-product-purchase-guide';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicProductPurchaseGuideAnswer(context);
      model = 'backend-deterministic-safe-product-purchase-guide';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...guideResponse,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'راهنمای خرید عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش، highlights عمومی، FAQ عمومی و محصولات مرتبط عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ راهنمای خرید فقط بر اساس داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_PURCHASE_GUIDE_ASSISTANT_AI',
    };
  }

  async getProductFitGuide(
    identifier: string,
    body: Record<string, unknown> = {},
  ) {
    const guideResponse = await this.getProductPurchaseGuide(identifier);
    const product = this.toRecord(guideResponse.product);
    const profile = this.buildPublicNeedProfile(body);
    const fit = this.buildProductFitDecision(guideResponse, profile);

    return {
      product: this.buildFaqProductSummary(product),
      profile,
      fit,
      evidence: {
        decision: guideResponse.decision,
        highlights: guideResponse.highlights,
        badges: guideResponse.badges,
        matchedSignals: fit.matchedSignals,
        missingSignals: fit.missingSignals,
      },
      nextActions: this.buildProductFitNextActions(product, fit),
      meta: {
        dataScope: 'PUBLIC_PRODUCT_FIT_GUIDE',
        internalDataBlocked: true,
        rule: 'راهنمای تناسب محصول فقط بر اساس نیاز اعلام‌شده در همین درخواست، اطلاعات عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی ساخته می‌شود.',
      },
    };
  }

  async getProductFitGuideAssistant(
    identifier: string,
    body: Record<string, unknown> = {},
  ) {
    const fitGuide = await this.getProductFitGuide(identifier, body);
    const context = this.buildProductFitGuideAssistantContext(fitGuide);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildProductFitGuideAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 620,
            promptKey: 'product.public.fit_guide.answer',
            metadata: {
              productId: context.product.id,
              productSlug: context.product.slug,
              fitStatus: context.fit.status,
              generatedFor: 'PUBLIC_PRODUCT_FIT_GUIDE_ASSISTANT_AI',
            },
          },
        ),
        this.productFitGuideAssistantAiTimeoutMs,
        'AI_PRODUCT_FIT_GUIDE_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafeDisplayPriceAnswer(answer, context.product.displayPrice)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicProductFitGuideAnswer(context);
        model = 'backend-deterministic-safe-product-fit-guide';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicProductFitGuideAnswer(context);
      model = 'backend-deterministic-safe-product-fit-guide';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...fitGuide,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'راهنمای تناسب عمومی محصول با نیاز مشتری، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ تناسب محصول فقط بر اساس نیاز اعلام‌شده در همین درخواست و داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_FIT_GUIDE_ASSISTANT_AI',
    };
  }

  async getPublicRecommendationGuide(
    body: Record<string, unknown> = {},
    limitValue?: string | number,
  ) {
    const limit = this.normalizeSuggestionLimit(limitValue);
    const profile = this.buildPublicNeedProfile(body);
    const homeSections = await this.getHomeSections(Math.max(limit, 8));
    const products = this.extractUniqueProductsFromSections(homeSections);
    const recommendations = this.buildPublicRecommendationCandidates(
      products,
      profile,
      limit,
    );

    return {
      profile,
      recommendations,
      summary: this.buildPublicRecommendationSummary(recommendations, profile),
      nextActions: [
        {
          key: 'search_products',
          label: 'جستجوی محصولات بیشتر',
          path: '/products/search',
        },
        {
          key: 'compare_recommendations',
          label: 'مقایسه گزینه‌های پیشنهادی',
          path: `/products/compare?items=${recommendations
            .map((item) => this.getString(this.toRecord(item.product).slug))
            .filter((item): item is string => Boolean(item))
            .slice(0, 4)
            .join(',')}`,
        },
      ],
      meta: {
        count: recommendations.length,
        candidateCount: products.length,
        limit,
        dataScope: 'PUBLIC_PRODUCT_RECOMMENDATION_GUIDE',
        internalDataBlocked: true,
        rule: 'پیشنهاد محصولات فقط بر اساس نیاز اعلام‌شده در همین درخواست، محصولات عمومی، قیمت قابل نمایش و موجودی قابل فروش ساخته می‌شود.',
      },
    };
  }

  async getPublicRecommendationGuideAssistant(
    body: Record<string, unknown> = {},
    limitValue?: string | number,
  ) {
    const guide = await this.getPublicRecommendationGuide(body, limitValue);
    const context = this.buildPublicRecommendationAssistantContext(guide);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildPublicRecommendationAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 720,
            promptKey: 'product.public.recommendation_guide.answer',
            metadata: {
              recommendationCount: context.recommendations.length,
              generatedFor: 'PUBLIC_PRODUCT_RECOMMENDATION_GUIDE_AI',
            },
          },
        ),
        this.publicRecommendationAssistantAiTimeoutMs,
        'AI_PUBLIC_RECOMMENDATION_GUIDE_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafeRecommendationPriceAnswer(
          answer,
          context.recommendations,
        ) ||
        this.hasUnsupportedRecommendationPublicClaim(answer, context)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicPublicRecommendationAnswer(context);
        model = 'backend-deterministic-safe-public-recommendation-guide';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicPublicRecommendationAnswer(context);
      model = 'backend-deterministic-safe-public-recommendation-guide';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...guide,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'پیشنهاد عمومی محصولات، نیاز اعلام‌شده در همین درخواست، قیمت قابل نمایش و موجودی قابل فروش',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ پیشنهاد محصولات فقط بر اساس پروفایل نیاز همین درخواست و محصولات عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_RECOMMENDATION_GUIDE_AI',
    };
  }

  async getProductFaq(identifier: string) {
    const productPage = await this.findOne(identifier, {
      incrementView: false,
    });
    const product = this.toRecord(productPage);
    const attributes = Array.isArray(product.attributes)
      ? product.attributes.map((item) => this.toRecord(item))
      : [];
    const attributeMap = this.buildPublicAttributeValueMap(attributes);
    const faq = this.buildProductFaqItems(product, attributeMap);

    return {
      product: this.buildFaqProductSummary(product),
      faq,
      meta: {
        count: faq.length,
        dataScope: 'PUBLIC_PRODUCT_FAQ',
        internalDataBlocked: true,
        rule: 'سوالات متداول فقط بر اساس توضیحات عمومی، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی ساخته می‌شوند.',
      },
    };
  }

  async getProductFaqAssistant(identifier: string) {
    const faqResponse = await this.getProductFaq(identifier);
    const context = this.buildProductFaqAssistantContext(faqResponse);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildProductFaqAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 560,
            promptKey: 'product.public.faq_assistant.answer',
            metadata: {
              productId: context.product.id,
              productSlug: context.product.slug,
              faqCount: context.faq.length,
              generatedFor: 'PUBLIC_PRODUCT_FAQ_ASSISTANT_AI',
            },
          },
        ),
        this.productFaqAssistantAiTimeoutMs,
        'AI_PRODUCT_FAQ_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafeDisplayPriceAnswer(answer, context.product.displayPrice)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicProductFaqAnswer(context);
        model = 'backend-deterministic-safe-product-faq';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicProductFaqAnswer(context);
      model = 'backend-deterministic-safe-product-faq';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...faqResponse,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'سوالات متداول عمومی محصول، قیمت قابل نمایش، موجودی قابل فروش و attributes عمومی',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ FAQ فقط بر اساس سوالات متداول و داده‌های عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_PRODUCT_FAQ_ASSISTANT_AI',
    };
  }

  async getCategoryLanding(categorySlug: string, query: QueryProductDto) {
    const category = await this.findPublicCategoryBySlug(categorySlug);
    const effectiveQuery = {
      ...query,
      categorySlug: category.slug,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    } as QueryProductDto;

    const [productsResult, facets] = await Promise.all([
      this.findAll(effectiveQuery),
      this.getPublicFacets(effectiveQuery),
    ]);

    return this.buildLandingResponse(
      'CATEGORY',
      this.mapPublicCategoryLanding(category),
      productsResult,
      facets,
    );
  }

  async getBrandLanding(brandSlug: string, query: QueryProductDto) {
    const brand = await this.findPublicBrandBySlug(brandSlug);
    const effectiveQuery = {
      ...query,
      brandSlug: brand.slug,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    } as QueryProductDto;

    const [productsResult, facets] = await Promise.all([
      this.findAll(effectiveQuery),
      this.getPublicFacets(effectiveQuery),
    ]);

    return this.buildLandingResponse(
      'BRAND',
      this.mapPublicBrandLanding(brand),
      productsResult,
      facets,
    );
  }

  async getProductTypeLanding(productTypeSlug: string, query: QueryProductDto) {
    const productType = await this.findPublicProductTypeBySlug(productTypeSlug);
    const effectiveQuery = {
      ...query,
      productTypeSlug: productType.slug,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    } as QueryProductDto & { productTypeSlug: string };

    const [productsResult, facets] = await Promise.all([
      this.findAll(effectiveQuery as QueryProductDto),
      this.getPublicFacets(effectiveQuery as QueryProductDto),
    ]);

    return this.buildLandingResponse(
      'PRODUCT_TYPE',
      this.mapPublicProductTypeLanding(productType),
      productsResult,
      facets,
    );
  }

  async getProductModelLanding(
    productModelSlug: string,
    query: QueryProductDto,
  ) {
    const productModel =
      await this.findPublicProductModelBySlug(productModelSlug);
    const effectiveQuery = {
      ...query,
      productModelSlug: productModel.slug,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
    } as QueryProductDto & { productModelSlug: string };

    const [productsResult, facets] = await Promise.all([
      this.findAll(effectiveQuery as QueryProductDto),
      this.getPublicFacets(effectiveQuery as QueryProductDto),
    ]);

    return this.buildLandingResponse(
      'PRODUCT_MODEL',
      this.mapPublicProductModelLanding(productModel),
      productsResult,
      facets,
    );
  }

  async getCategoryLandingAssistant(
    categorySlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getCategoryLanding(categorySlug, {
      ...query,
      limit: query.limit ?? 8,
    });

    return this.buildLandingAssistant('CATEGORY', landing);
  }

  async getBrandLandingAssistant(brandSlug: string, query: QueryProductDto) {
    const landing = await this.getBrandLanding(brandSlug, {
      ...query,
      limit: query.limit ?? 8,
    });

    return this.buildLandingAssistant('BRAND', landing);
  }

  async getProductTypeLandingAssistant(
    productTypeSlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getProductTypeLanding(productTypeSlug, {
      ...query,
      limit: query.limit ?? 8,
    });

    return this.buildLandingAssistant('PRODUCT_TYPE', landing);
  }

  async getProductModelLandingAssistant(
    productModelSlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getProductModelLanding(productModelSlug, {
      ...query,
      limit: query.limit ?? 8,
    });

    return this.buildLandingAssistant('PRODUCT_MODEL', landing);
  }

  async getCategoryLandingPageData(
    categorySlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getCategoryLanding(categorySlug, {
      ...query,
      limit: query.limit ?? 24,
    });

    return this.buildCatalogLandingPageData('CATEGORY', landing);
  }

  async getBrandLandingPageData(brandSlug: string, query: QueryProductDto) {
    const landing = await this.getBrandLanding(brandSlug, {
      ...query,
      limit: query.limit ?? 24,
    });

    return this.buildCatalogLandingPageData('BRAND', landing);
  }

  async getProductTypeLandingPageData(
    productTypeSlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getProductTypeLanding(productTypeSlug, {
      ...query,
      limit: query.limit ?? 24,
    });

    return this.buildCatalogLandingPageData('PRODUCT_TYPE', landing);
  }

  async getProductModelLandingPageData(
    productModelSlug: string,
    query: QueryProductDto,
  ) {
    const landing = await this.getProductModelLanding(productModelSlug, {
      ...query,
      limit: query.limit ?? 24,
    });

    return this.buildCatalogLandingPageData('PRODUCT_MODEL', landing);
  }

  async getPublicFacets(query: QueryProductDto) {
    this.assertPriceRange(query.minPrice, query.maxPrice);

    const whereSql = this.buildPublicWhereSql(query);

    const [brandRows, categoryRows, productTypeRows, priceRows] =
      await Promise.all([
        this.prisma.$queryRaw<PublicFacetRow[]>(Prisma.sql`
        SELECT
          b."id",
          b."name",
          b."slug",
          COUNT(DISTINCT p."id")::int AS count
        FROM "Product" p
        LEFT JOIN "Brand" b ON b."id" = p."brandId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
        LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
          WHERE pv."productId" = p."id"
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = true
        ) stock ON true
        ${whereSql}
          AND b."id" IS NOT NULL
        GROUP BY b."id", b."name", b."slug"
        ORDER BY count DESC, b."name" ASC
        LIMIT 50
      `),
        this.prisma.$queryRaw<PublicFacetRow[]>(Prisma.sql`
        SELECT
          c."id",
          c."name",
          c."slug",
          COUNT(DISTINCT p."id")::int AS count
        FROM "Product" p
        LEFT JOIN "Brand" b ON b."id" = p."brandId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
        LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
          WHERE pv."productId" = p."id"
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = true
        ) stock ON true
        ${whereSql}
          AND c."id" IS NOT NULL
        GROUP BY c."id", c."name", c."slug"
        ORDER BY count DESC, c."name" ASC
        LIMIT 50
      `),
        this.prisma.$queryRaw<PublicFacetRow[]>(Prisma.sql`
        SELECT
          pt."id",
          pt."name",
          pt."slug",
          COUNT(DISTINCT p."id")::int AS count
        FROM "Product" p
        LEFT JOIN "Brand" b ON b."id" = p."brandId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
        LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
          WHERE pv."productId" = p."id"
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = true
        ) stock ON true
        ${whereSql}
          AND pt."id" IS NOT NULL
        GROUP BY pt."id", pt."name", pt."slug"
        ORDER BY count DESC, pt."name" ASC
        LIMIT 50
      `),
        this.prisma.$queryRaw<PublicPriceFacetRow[]>(Prisma.sql`
        SELECT
          MIN(COALESCE(p."finalPrice", p."salePrice", p."price")) AS min_price,
          MAX(COALESCE(p."finalPrice", p."salePrice", p."price")) AS max_price,
          COUNT(DISTINCT p."id") FILTER (
            WHERE COALESCE(p."discountPercent", 0) > 0
              OR (
                p."comparePrice" IS NOT NULL
                AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price")
              )
          )::int AS discounted_count,
          COUNT(DISTINCT p."id") FILTER (WHERE COALESCE(stock.available_stock, 0) > 0)::int AS in_stock_count,
          COUNT(DISTINCT p."id") FILTER (WHERE COALESCE(stock.available_stock, 0) <= 0)::int AS out_of_stock_count,
          COUNT(DISTINCT p."id")::int AS total
        FROM "Product" p
        LEFT JOIN "Brand" b ON b."id" = p."brandId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
        LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(
              SUM(
                GREATEST(
                  COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                  0
                )
              ),
              0
            ) AS available_stock
          FROM "ProductVariant" pv
          LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
          WHERE pv."productId" = p."id"
            AND pv."deleted_at" IS NULL
            AND pv."isActive" = true
        ) stock ON true
        ${whereSql}
      `),
      ]);

    const price = priceRows[0];

    return {
      brands: brandRows.map((row) => this.mapPublicFacet(row)),
      categories: categoryRows.map((row) => this.mapPublicFacet(row)),
      productTypes: productTypeRows.map((row) => this.mapPublicFacet(row)),
      price: {
        min: this.toNullableDecimalString(price?.min_price),
        max: this.toNullableDecimalString(price?.max_price),
      },
      availability: {
        inStock: this.toNumber(price?.in_stock_count),
        outOfStock: this.toNumber(price?.out_of_stock_count),
      },
      discounts: {
        discounted: this.toNumber(price?.discounted_count),
      },
      meta: {
        total: this.toNumber(price?.total),
        dataScope: 'PUBLIC_PRODUCT_FACETS',
        internalDataBlocked: true,
      },
    };
  }

  async getRelatedProducts(identifier: string, limitValue?: string | number) {
    const base = await this.findPublicProductRow(identifier);
    const limit = this.normalizeSuggestionLimit(limitValue);

    const productTypeScore = base.product_type_id
      ? Prisma.sql`(CASE WHEN p."productTypeId" = ${base.product_type_id} THEN 25 ELSE 0 END)`
      : Prisma.sql`0`;
    const productModelScore = base.product_model_id
      ? Prisma.sql`(CASE WHEN p."productModelId" = ${base.product_model_id} THEN 35 ELSE 0 END)`
      : Prisma.sql`0`;

    const relationFilters: Prisma.Sql[] = [
      Prisma.sql`p."categoryId" = ${base.category_id}`,
      Prisma.sql`p."brandId" = ${base.brand_id}`,
    ];

    if (base.product_type_id) {
      relationFilters.push(
        Prisma.sql`p."productTypeId" = ${base.product_type_id}`,
      );
    }

    if (base.product_model_id) {
      relationFilters.push(
        Prisma.sql`p."productModelId" = ${base.product_model_id}`,
      );
    }

    const rows = await this.prisma.$queryRaw<RelatedProductRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."description",
        p."shortDescription" AS short_description,
        p."seoTitle" AS seo_title,
        p."seoDescription" AS seo_description,
        p."canonicalUrl" AS canonical_url,
        p."schemaJson" AS schema_json,
        p."brandId" AS brand_id,
        b."name" AS brand_name,
        b."slug" AS brand_slug,
        p."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        p."productTypeId" AS product_type_id,
        pt."name" AS product_type_name,
        pt."slug" AS product_type_slug,
        p."productModelId" AS product_model_id,
        pm."name" AS product_model_name,
        pm."slug" AS product_model_slug,
        pm."modelCode" AS product_model_code,
        p."sku",
        p."price",
        p."comparePrice" AS compare_price,
        p."salePrice" AS sale_price,
        p."discountPercent" AS discount_percent,
        p."finalPrice" AS final_price,
        p."weight",
        p."dimensions",
        p."isActive" AS is_active,
        p."status",
        p."viewCount" AS view_count,
        p."reviewCount" AS review_count,
        p."averageRating" AS average_rating,
        COALESCE(stock.available_stock, 0)::int AS available_stock,
        stock.low_stock_threshold AS low_stock_threshold,
        p."createdAt" AS created_at,
        p."updatedAt" AS updated_at,
        image."url" AS primary_image_url,
        image."altText" AS primary_image_alt,
        (
          (CASE WHEN p."categoryId" = ${base.category_id} THEN 20 ELSE 0 END) +
          (CASE WHEN p."brandId" = ${base.brand_id} THEN 20 ELSE 0 END) +
          ${productTypeScore} +
          ${productModelScore} +
          (CASE WHEN COALESCE(stock.available_stock, 0) > 0 THEN 5 ELSE 0 END) +
          (CASE WHEN COALESCE(p."discountPercent", 0) > 0 THEN 5 ELSE 0 END)
        )::int AS similarity_score
      FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          pi."url",
          pi."altText"
        FROM "ProductImage" pi
        WHERE pi."productId" = p."id"
          AND pi."isActive" = true
        ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC, pi."createdAt" ASC
        LIMIT 1
      ) image ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                0
              )
            ),
            0
          ) AS available_stock,
          MIN(i."lowStockThreshold") AS low_stock_threshold
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
        WHERE pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = true
      ) stock ON true
      WHERE p."deleted_at" IS NULL
        AND p."isActive" = true
        AND p."status"::text = 'ACTIVE'
        AND p."id" <> ${base.id}
        AND (${Prisma.join(relationFilters, ' OR ')})
      ORDER BY
        similarity_score DESC,
        COALESCE(stock.available_stock, 0) DESC,
        p."viewCount" DESC,
        p."createdAt" DESC,
        p."id" DESC
      LIMIT ${limit}
    `);

    const baseProduct = this.mapListProduct(base);
    const related = rows.map((row) => ({
      ...this.mapListProduct(row),
      similarityScore: this.toNumber(row.similarity_score),
      reasons: this.buildRelatedReasons(base, row),
    }));

    return {
      baseProduct: {
        id: baseProduct.id,
        name: baseProduct.name,
        slug: baseProduct.slug,
        sku: baseProduct.sku,
        brand: baseProduct.brand,
        category: baseProduct.category,
        productType: baseProduct.productType,
        productModel: baseProduct.productModel,
        pricing: baseProduct.pricing,
        stock: baseProduct.stock,
        primaryImage: baseProduct.primaryImage,
      },
      related,
      meta: {
        count: related.length,
        limit,
        dataScope: 'PUBLIC_RELATED_PRODUCTS',
        internalDataBlocked: true,
        strategy: 'category_brand_type_model_similarity',
      },
    };
  }

  async getRelatedRecommendationAssistant(
    identifier: string,
    limitValue?: string | number,
  ) {
    const relatedResult = await this.getRelatedProducts(identifier, limitValue);
    const context = this.buildRelatedRecommendationContext(relatedResult);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildRelatedRecommendationMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 560,
            promptKey: 'product.public.related_recommendation.answer',
            metadata: {
              productId: context.baseProduct.id,
              productSlug: context.baseProduct.slug,
              relatedCount: context.related.length,
              generatedFor: 'RELATED_PRODUCT_ASSISTANT_AI',
            },
          },
        ),
        this.searchAssistantAiTimeoutMs,
        'AI_RELATED_RECOMMENDATION_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (!answer || this.hasAdvisorSensitiveLeak(answer)) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicRelatedRecommendationAnswer(context);
        model = 'backend-deterministic-safe-related-recommendation';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicRelatedRecommendationAnswer(context);
      model = 'backend-deterministic-safe-related-recommendation';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...relatedResult,
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope:
          'محصول پایه، محصولات مرتبط عمومی، قیمت قابل نمایش و موجودی قابل فروش',
        internalDataBlocked: true,
        hallucinationPolicy:
          'پیشنهاد محصول مرتبط فقط بر اساس محصول پایه و نتایج مرتبط همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'RELATED_PRODUCT_ASSISTANT_AI',
    };
  }

  async findOne(identifier: string, options?: { incrementView?: boolean }) {
    const product = await this.findPublicProductRow(identifier);

    if (options?.incrementView !== false) {
      await this.incrementView(product.id);
    }

    const [images, attributes] = await Promise.all([
      this.getImages(product.id),
      this.getAttributes(product.id),
    ]);

    return this.mapProductPage(product, images, attributes);
  }

  async getSalesAdvisorContext(identifier: string) {
    const product = await this.findPublicProductRow(identifier);

    const [images, attributes] = await Promise.all([
      this.getImages(product.id),
      this.getAttributes(product.id),
    ]);

    const productPage = this.mapProductPage(product, images, attributes);
    const attributeMap = this.buildAttributeMap(attributes);
    const safeAiContent = this.extractSafeAiContent(product.dimensions);

    return {
      productId: productPage.id,
      name: productPage.name,
      slug: productPage.slug,
      sku: productPage.sku,
      brand: productPage.brand,
      category: productPage.category,
      productType: productPage.productType,
      productModel: productPage.productModel,
      description: productPage.description,
      shortDescription: productPage.shortDescription,
      pricing: productPage.pricing,
      stock: productPage.stock,
      media: productPage.media,
      attributes: productPage.attributes,
      salesFacts: {
        countryOfOrigin: attributeMap.country_of_origin ?? null,
        warranty: attributeMap.warranty ?? null,
        usageMethod: attributeMap.usage_method ?? null,
        sellingPoints: safeAiContent.sellingPoints,
        faq: safeAiContent.faq,
      },
      allowedUse: [
        'پاسخ‌گویی درباره مشخصات، کاربردها، گارانتی، نحوه استفاده، موجودی قابل فروش و قیمت فروش محصول.',
        'کمک به انتخاب محصول بر اساس نیاز مشتری با اتکا به داده‌های همین context.',
        'پیشنهاد متن کوتاه فروش یا پاسخ پشتیبانی بدون ساختن ادعای تاییدنشده.',
      ],
      guardrails: {
        visibilityPolicy:
          'این context فقط برای پاسخ‌گویی فروش با داده‌های عمومی محصول ساخته شده و هیچ مقدار داخلی عملیاتی یا مالی در آن وجود ندارد.',
        mustNotDo: [
          'حدس‌زدن ویژگی‌هایی که در attributes یا توضیحات محصول وجود ندارد.',
          'افشای اطلاعات داخلی قیمت‌گذاری، سود، رزرو موجودی، audit داخلی یا تأییدکننده‌های ادمین.',
          'توصیه پزشکی، درمانی یا ایمنی قطعی فراتر از اطلاعات محصول.',
        ],
        pricePolicy:
          'فقط قیمت فروش و تخفیف قابل نمایش در همین context مجاز است.',
      },
      generatedFor: 'SALES_ADVISOR_AI',
    };
  }

  async askSalesAdvisor(
    identifier: string,
    dto: ProductSalesAdvisorQuestionDto,
  ) {
    const context = await this.getSalesAdvisorContext(identifier);
    const messages = this.buildSalesAdvisorMessages(context, dto);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'SALES';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(messages, {
          task: 'SALES',
          temperature: 0.2,
          maxTokens: 650,
          promptKey: 'product.public.sales_advisor.answer',
          metadata: {
            productId: context.productId,
            productSlug: context.slug,
            generatedFor: 'SALES_ADVISOR_AI',
          },
        }),
        this.salesAdvisorAiTimeoutMs,
        'AI_SALES_ADVISOR_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'SALES';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (!answer || this.hasAdvisorSensitiveLeak(answer)) {
        source = 'SAFE_FALLBACK';
        answer =
          this.sanitizeCustomerText(
            this.buildDeterministicSalesAnswer(context, dto.question),
          ) ?? '';
        model = 'backend-deterministic-safe-sales-advisor';
        provider = 'backend';
        taskType = 'SALES';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer =
        this.sanitizeCustomerText(
          this.buildDeterministicSalesAnswer(context, dto.question),
        ) ?? '';
      model = 'backend-deterministic-safe-sales-advisor';
      provider = 'backend';
      taskType = 'SALES';
    }

    return {
      productId: context.productId,
      questionReceived: true,
      answer,
      source,
      model,
      provider,
      taskType,
      product: {
        id: context.productId,
        name: context.name,
        slug: context.slug,
        sku: context.sku,
        brand: context.brand,
        category: context.category,
        productType: context.productType,
        productModel: context.productModel,
      },
      salesFacts: {
        pricing: context.pricing,
        stock: context.stock,
        countryOfOrigin: context.salesFacts.countryOfOrigin,
        warranty: context.salesFacts.warranty,
        usageMethod: context.salesFacts.usageMethod,
        sellingPoints: context.salesFacts.sellingPoints,
        faq: context.salesFacts.faq,
      },
      safety: {
        safeOutput: true,
        dataScope: 'اطلاعات عمومی محصول و فکت‌های مجاز فروش',
        internalDataBlocked: true,
        hallucinationPolicy:
          'اگر داده‌ای در context وجود نداشته باشد، پاسخ باید نبود داده را اعلام کند.',
      },
      generatedFor: 'SALES_ADVISOR_AI',
    };
  }

  private getLandingKindTitle(kind: PublicLandingKind): string {
    if (kind === 'CATEGORY') {
      return 'دسته‌بندی';
    }

    if (kind === 'BRAND') {
      return 'برند';
    }

    if (kind === 'PRODUCT_TYPE') {
      return 'نوع محصول';
    }

    return 'مدل محصول';
  }

  private getLandingDataScope(kind: PublicLandingKind): string {
    if (kind === 'CATEGORY') {
      return 'PUBLIC_CATEGORY_LANDING';
    }

    if (kind === 'BRAND') {
      return 'PUBLIC_BRAND_LANDING';
    }

    if (kind === 'PRODUCT_TYPE') {
      return 'PUBLIC_PRODUCT_TYPE_LANDING';
    }

    return 'PUBLIC_PRODUCT_MODEL_LANDING';
  }

  private getLandingSafetyScope(kind: PublicLandingKind): string {
    if (kind === 'CATEGORY') {
      return 'صفحه عمومی دسته‌بندی، محصولات قابل نمایش، قیمت قابل نمایش و موجودی قابل فروش';
    }

    if (kind === 'BRAND') {
      return 'صفحه عمومی برند، محصولات قابل نمایش، قیمت قابل نمایش و موجودی قابل فروش';
    }

    if (kind === 'PRODUCT_TYPE') {
      return 'صفحه عمومی نوع محصول، محصولات قابل نمایش، قیمت قابل نمایش و موجودی قابل فروش';
    }

    return 'صفحه عمومی مدل محصول، محصولات قابل نمایش، قیمت قابل نمایش و موجودی قابل فروش';
  }

  private getLandingPromptKey(kind: PublicLandingKind): string {
    if (kind === 'CATEGORY') {
      return 'product.public.category_landing.answer';
    }

    if (kind === 'BRAND') {
      return 'product.public.brand_landing.answer';
    }

    if (kind === 'PRODUCT_TYPE') {
      return 'product.public.product_type_landing.answer';
    }

    return 'product.public.product_model_landing.answer';
  }

  private buildLandingResponse(
    kind: PublicLandingKind,
    entity: Record<string, unknown>,
    productsResult: unknown,
    facets: unknown,
  ) {
    const productsRecord = this.toRecord(productsResult);
    const products = Array.isArray(productsRecord.data)
      ? productsRecord.data
      : [];
    const pagination = this.toRecord(productsRecord.meta);

    return {
      type: kind,
      entity,
      products,
      pagination,
      facets,
      meta: {
        total: this.toNumber(pagination.total),
        page: this.toNumber(pagination.page) || 1,
        limit: this.toNumber(pagination.limit) || products.length,
        dataScope: this.getLandingDataScope(kind),
        internalDataBlocked: true,
      },
    };
  }

  private buildPublicSearchQueryState(
    query: QueryProductDto,
    q: string | null,
  ) {
    return {
      q,
      page: query.page ?? 1,
      limit: query.limit ?? 24,
      sort: query.sort ?? null,
      brandSlug: query.brandSlug ?? null,
      categorySlug: query.categorySlug ?? null,
      inStock: query.inStock ?? null,
      hasDiscount: query.hasDiscount ?? null,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
      dataUse:
        'پارامترهای جستجو فقط برای ساخت همین پاسخ عمومی استفاده می‌شوند.',
    };
  }

  private buildSearchPageNextActions(q: string | null) {
    const encodedQuery = q ? encodeURIComponent(q) : null;

    const actions = [
      {
        key: 'search_products',
        label: 'جستجوی محصولات',
        path: encodedQuery
          ? `/products/search?q=${encodedQuery}`
          : '/products/search',
      },
      {
        key: 'open_facets',
        label: 'مشاهده فیلترهای جستجو',
        path: encodedQuery
          ? `/products/search/facets?q=${encodedQuery}`
          : '/products/search/facets',
      },
      {
        key: 'open_discounted',
        label: 'مشاهده محصولات تخفیف‌دار',
        path: '/products?hasDiscount=true',
      },
    ];

    if (encodedQuery) {
      actions.push({
        key: 'ask_search_assistant',
        label: 'دریافت راهنمای هوشمند جستجو',
        path: `/products/search/assistant?q=${encodedQuery}`,
      });
    }

    return actions;
  }

  private mapPublicNavigationItem(
    row: PublicNavigationItemRow,
    kind: PublicLandingKind,
    basePath: string,
  ): Record<string, unknown> {
    const slug = this.getString(row.slug);
    const name =
      this.sanitizeCustomerText(this.nullIfDamaged(row.name)) ?? slug;
    const parentName = this.sanitizeCustomerText(
      this.nullIfDamaged(row.parent_name),
    );
    const secondaryParentName = this.sanitizeCustomerText(
      this.nullIfDamaged(row.secondary_parent_name),
    );

    return this.removeUndefinedValues({
      type: kind,
      id: row.id,
      name,
      slug,
      path: slug ? `${basePath}/${slug}` : undefined,
      description: this.sanitizeCustomerText(
        this.nullIfDamaged(row.description),
      ),
      media: this.removeUndefinedValues({
        image: this.sanitizeCustomerText(this.nullIfDamaged(row.image)),
        iconUrl: this.sanitizeCustomerText(this.nullIfDamaged(row.icon_url)),
        logoUrl: this.sanitizeCustomerText(this.nullIfDamaged(row.logo_url)),
      }),
      parent: row.parent_id
        ? {
            id: row.parent_id,
            name: parentName,
            slug: row.parent_slug,
          }
        : undefined,
      secondaryParent: row.secondary_parent_id
        ? {
            id: row.secondary_parent_id,
            name: secondaryParentName,
            slug: row.secondary_parent_slug,
          }
        : undefined,
      stats: {
        productCount: this.toNumber(row.product_count),
        inStockCount: this.toNumber(row.in_stock_count),
        discountedCount: this.toNumber(row.discounted_count),
      },
      sortOrder: row.sort_order ?? 0,
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    });
  }

  private buildPublicNavigationQuickActions(sections: {
    categories: Record<string, unknown>[];
    brands: Record<string, unknown>[];
    productTypes: Record<string, unknown>[];
    productModels: Record<string, unknown>[];
  }) {
    const actions: Record<string, string>[] = [
      {
        key: 'all_products',
        label: 'همه محصولات',
        path: '/products',
      },
      {
        key: 'search_products',
        label: 'جستجوی محصولات',
        path: '/products/search',
      },
    ];
    const firstCategoryPath = this.getString(
      this.toRecord(sections.categories[0]).path,
    );
    const firstBrandPath = this.getString(
      this.toRecord(sections.brands[0]).path,
    );
    const firstTypePath = this.getString(
      this.toRecord(sections.productTypes[0]).path,
    );
    const firstModelPath = this.getString(
      this.toRecord(sections.productModels[0]).path,
    );

    if (firstCategoryPath) {
      actions.push({
        key: 'top_category',
        label: 'دسته‌بندی منتخب',
        path: firstCategoryPath,
      });
    }

    if (firstBrandPath) {
      actions.push({
        key: 'top_brand',
        label: 'برند منتخب',
        path: firstBrandPath,
      });
    }

    if (firstTypePath) {
      actions.push({
        key: 'top_product_type',
        label: 'نوع محصول منتخب',
        path: firstTypePath,
      });
    }

    if (firstModelPath) {
      actions.push({
        key: 'top_product_model',
        label: 'مدل محصول منتخب',
        path: firstModelPath,
      });
    }

    return actions;
  }

  private buildComparePageSummaryCards(
    items: unknown[],
    insights: Record<string, unknown>,
  ) {
    const cheapest = this.toRecord(insights.cheapest);
    const highestPrice = this.toRecord(insights.highestPrice);
    const inStockCount = this.toNumber(insights.inStockCount) ?? 0;
    const discountedCount = this.toNumber(insights.discountedCount) ?? 0;

    return [
      {
        key: 'selected_count',
        title: 'تعداد محصولات انتخاب‌شده',
        value: String(items.length),
        description: 'محصولاتی که در این مقایسه عمومی حضور دارند.',
      },
      {
        key: 'in_stock_count',
        title: 'گزینه‌های موجود',
        value: String(inStockCount),
        description: 'تعداد محصولاتی که موجودی قابل فروش عمومی دارند.',
      },
      {
        key: 'discounted_count',
        title: 'گزینه‌های تخفیف‌دار',
        value: String(discountedCount),
        description: 'تعداد محصولاتی که تخفیف عمومی قابل نمایش دارند.',
      },
      {
        key: 'cheapest',
        title: 'اقتصادی‌ترین گزینه',
        value:
          this.sanitizeCustomerText(this.getString(cheapest.name)) ??
          'مشخص نیست',
        description: this.getString(cheapest.displayPrice)
          ? `قیمت قابل نمایش: ${this.getString(cheapest.displayPrice)} ریال`
          : 'قیمت قابل نمایش کافی برای این گزینه موجود نیست.',
      },
      {
        key: 'highest_price',
        title: 'گران‌ترین گزینه قابل نمایش',
        value:
          this.sanitizeCustomerText(this.getString(highestPrice.name)) ??
          'مشخص نیست',
        description: this.getString(highestPrice.displayPrice)
          ? `قیمت قابل نمایش: ${this.getString(highestPrice.displayPrice)} ریال`
          : 'قیمت قابل نمایش کافی برای این گزینه موجود نیست.',
      },
    ];
  }

  private buildComparePageNextActions(itemSlugs: string[]) {
    const itemsQuery = itemSlugs.join(',');
    const encodedItemsQuery = encodeURIComponent(itemsQuery);

    return [
      {
        key: 'search_products',
        label: 'افزودن محصول از جستجو',
        path: '/products/search',
      },
      {
        key: 'ask_compare_assistant',
        label: 'دریافت راهنمای هوشمند مقایسه',
        path: encodedItemsQuery
          ? `/products/compare/assistant?items=${encodedItemsQuery}`
          : '/products/compare/assistant',
      },
      {
        key: 'open_compare',
        label: 'مشاهده صفحه مقایسه',
        path: encodedItemsQuery
          ? `/products/compare?items=${encodedItemsQuery}`
          : '/products/compare',
      },
    ];
  }

  private buildCatalogLandingPageData(
    kind: PublicLandingKind,
    landing: unknown,
  ) {
    const landingRecord = this.toRecord(landing);
    const entity = this.toRecord(landingRecord.entity);
    const seo = this.toRecord(entity.seo);
    const pagination = this.toRecord(landingRecord.pagination);
    const facets = this.toRecord(landingRecord.facets);
    const products = Array.isArray(landingRecord.products)
      ? landingRecord.products
      : [];
    const slug = this.getString(entity.slug) ?? '';
    const entityName =
      this.sanitizeCustomerText(this.getString(entity.name)) ?? slug;
    const description = this.sanitizeCustomerText(
      this.getString(entity.description),
    );
    const title =
      this.sanitizeCustomerText(this.getString(seo.title)) ??
      this.buildCatalogLandingDefaultTitle(kind, entityName);
    const seoDescription =
      this.sanitizeCustomerText(this.getString(seo.description)) ??
      description ??
      this.buildCatalogLandingDefaultDescription(kind, entityName);
    const canonicalPath = this.buildCatalogLandingPath(kind, slug);

    return {
      type: kind,
      entity,
      seo: {
        title,
        description: seoDescription,
        canonicalPath,
        robots: {
          noIndex: false,
          noFollow: false,
        },
      },
      navigation: {
        breadcrumbs: this.buildCatalogLandingBreadcrumbs(
          kind,
          entity,
          canonicalPath,
        ),
        canonicalPath,
        listingEndpoint: `/api${canonicalPath}`,
        assistantEndpoint: `/api${canonicalPath}/assistant`,
      },
      hero: {
        title,
        subtitle: description ?? seoDescription,
        totalProducts: this.toNumber(pagination.total) || products.length,
        primaryAction: {
          label: 'مشاهده محصولات',
          path: canonicalPath,
        },
      },
      sections: {
        products,
        facets,
        pagination,
        sortOptions: this.buildCatalogLandingSortOptions(),
        emptyState: {
          title: 'محصولی برای این صفحه یافت نشد.',
          description:
            'فیلترها را تغییر دهید یا از جستجوی محصولات استفاده کنید.',
        },
      },
      nextActions: this.buildCatalogLandingNextActions(
        kind,
        slug,
        canonicalPath,
      ),
      meta: {
        dataScope: this.getCatalogLandingPageDataScope(kind),
        internalDataBlocked: true,
        productCount: products.length,
        total: this.toNumber(pagination.total) || products.length,
        page: this.toNumber(pagination.page) || 1,
        limit: this.toNumber(pagination.limit) || products.length,
        rule: 'بسته صفحه فرود کاتالوگ فقط از اطلاعات عمومی entity، محصولات عمومی، facetهای عمومی، قیمت قابل نمایش و موجودی قابل فروش ساخته می‌شود.',
      },
    };
  }

  private getCatalogLandingPageDataScope(kind: PublicLandingKind): string {
    if (kind === 'CATEGORY') {
      return 'PUBLIC_CATEGORY_PAGE_DATA';
    }

    if (kind === 'BRAND') {
      return 'PUBLIC_BRAND_PAGE_DATA';
    }

    if (kind === 'PRODUCT_TYPE') {
      return 'PUBLIC_PRODUCT_TYPE_PAGE_DATA';
    }

    return 'PUBLIC_PRODUCT_MODEL_PAGE_DATA';
  }

  private buildCatalogLandingPath(
    kind: PublicLandingKind,
    slug: string,
  ): string {
    if (kind === 'CATEGORY') {
      return `/products/category/${slug}`;
    }

    if (kind === 'BRAND') {
      return `/products/brand/${slug}`;
    }

    if (kind === 'PRODUCT_TYPE') {
      return `/products/type/${slug}`;
    }

    return `/products/model/${slug}`;
  }

  private buildCatalogLandingDefaultTitle(
    kind: PublicLandingKind,
    entityName: string,
  ): string {
    if (kind === 'CATEGORY') {
      return `خرید محصولات ${entityName}`;
    }

    if (kind === 'BRAND') {
      return `خرید محصولات برند ${entityName}`;
    }

    if (kind === 'PRODUCT_TYPE') {
      return `خرید ${entityName}`;
    }

    return `خرید مدل ${entityName}`;
  }

  private buildCatalogLandingDefaultDescription(
    kind: PublicLandingKind,
    entityName: string,
  ): string {
    if (kind === 'BRAND') {
      return `مشاهده محصولات عمومی و قابل خرید برند ${entityName} با قیمت قابل نمایش و موجودی قابل فروش.`;
    }

    if (kind === 'PRODUCT_MODEL') {
      return `مشاهده محصولات عمومی مدل ${entityName} همراه با فیلترها و اطلاعات قابل نمایش برای مشتری.`;
    }

    return `مشاهده محصولات عمومی ${entityName} همراه با فیلترها، قیمت قابل نمایش و موجودی قابل فروش.`;
  }

  private buildCatalogLandingBreadcrumbs(
    kind: PublicLandingKind,
    entity: Record<string, unknown>,
    canonicalPath: string,
  ) {
    const breadcrumbs: Array<{ label: string; path: string }> = [
      {
        label: 'محصولات',
        path: '/products',
      },
    ];
    const category = this.toRecord(entity.category);
    const brand = this.toRecord(entity.brand);
    const productType = this.toRecord(entity.productType);
    const categorySlug = this.getString(category.slug);
    const categoryName = this.sanitizeCustomerText(
      this.getString(category.name),
    );
    const brandSlug = this.getString(brand.slug);
    const brandName = this.sanitizeCustomerText(this.getString(brand.name));
    const productTypeSlug = this.getString(productType.slug);
    const productTypeName = this.sanitizeCustomerText(
      this.getString(productType.name),
    );

    if (categorySlug && categoryName && kind !== 'CATEGORY') {
      breadcrumbs.push({
        label: categoryName,
        path: `/products/category/${categorySlug}`,
      });
    }

    if (brandSlug && brandName && kind === 'PRODUCT_MODEL') {
      breadcrumbs.push({
        label: brandName,
        path: `/products/brand/${brandSlug}`,
      });
    }

    if (productTypeSlug && productTypeName && kind === 'PRODUCT_MODEL') {
      breadcrumbs.push({
        label: productTypeName,
        path: `/products/type/${productTypeSlug}`,
      });
    }

    breadcrumbs.push({
      label:
        this.sanitizeCustomerText(this.getString(entity.name)) ??
        'صفحه کاتالوگ',
      path: canonicalPath,
    });

    return breadcrumbs;
  }

  private buildCatalogLandingSortOptions() {
    return [
      {
        key: 'newest',
        label: 'جدیدترین',
      },
      {
        key: 'price_asc',
        label: 'ارزان‌ترین',
      },
      {
        key: 'price_desc',
        label: 'گران‌ترین',
      },
      {
        key: 'popular',
        label: 'محبوب‌ترین',
      },
    ];
  }

  private buildCatalogLandingNextActions(
    kind: PublicLandingKind,
    slug: string,
    canonicalPath: string,
  ) {
    const actions = [
      {
        key: 'open_landing',
        label: 'مشاهده صفحه کاتالوگ',
        path: canonicalPath,
      },
      {
        key: 'ask_landing_assistant',
        label: 'دریافت راهنمای هوشمند این صفحه',
        path: `${canonicalPath}/assistant`,
      },
      {
        key: 'search_products',
        label: 'جستجوی محصولات بیشتر',
        path: '/products/search',
      },
    ];

    if (kind === 'CATEGORY') {
      actions.push({
        key: 'category_filters',
        label: 'فیلتر محصولات این دسته‌بندی',
        path: `/products/search/facets?categorySlug=${slug}`,
      });
    }

    if (kind === 'BRAND') {
      actions.push({
        key: 'brand_filters',
        label: 'فیلتر محصولات این برند',
        path: `/products/search/facets?brandSlug=${slug}`,
      });
    }

    return actions;
  }

  private async buildLandingAssistant(
    kind: PublicLandingKind,
    landing: unknown,
  ) {
    const context = this.buildLandingAssistantContext(kind, landing);

    let source: 'AI' | 'SAFE_FALLBACK' = 'AI';
    let model: string | null = null;
    let provider: string | null = null;
    let taskType: string | null = 'RECOMMENDATION';
    let answer: string;

    try {
      const result = await this.withTimeout(
        this.aiOrchestrator.generate(
          this.buildLandingAssistantMessages(context),
          {
            task: 'RECOMMENDATION',
            temperature: 0.2,
            maxTokens: 620,
            promptKey: this.getLandingPromptKey(kind),
            metadata: {
              kind,
              entitySlug: context.entity.slug,
              productCount: context.products.length,
              generatedFor: 'PUBLIC_LANDING_ASSISTANT_AI',
            },
          },
        ),
        this.landingAssistantAiTimeoutMs,
        'AI_LANDING_ASSISTANT_TIMEOUT',
      );

      model = result.model;
      provider = result.provider ?? null;
      taskType = result.taskType ?? 'RECOMMENDATION';
      answer =
        this.sanitizeCustomerText(
          this.normalizeAdvisorAnswer(result.content),
        ) ?? '';

      if (
        !answer ||
        this.hasAdvisorSensitiveLeak(answer) ||
        this.hasUnsafePublicCurrencyUnitAnswer(answer)
      ) {
        source = 'SAFE_FALLBACK';
        answer = this.buildDeterministicLandingAssistantAnswer(context);
        model = 'backend-deterministic-safe-landing-assistant';
        provider = 'backend';
        taskType = 'RECOMMENDATION';
      }
    } catch {
      source = 'SAFE_FALLBACK';
      answer = this.buildDeterministicLandingAssistantAnswer(context);
      model = 'backend-deterministic-safe-landing-assistant';
      provider = 'backend';
      taskType = 'RECOMMENDATION';
    }

    return {
      ...this.toRecord(landing),
      answer,
      source,
      model,
      provider,
      taskType,
      safety: {
        safeOutput: true,
        dataScope: this.getLandingSafetyScope(kind),
        internalDataBlocked: true,
        hallucinationPolicy:
          'پاسخ صفحه فرود فقط بر اساس محصولات عمومی، facetها و اطلاعات عمومی همین پاسخ ساخته می‌شود.',
      },
      generatedFor: 'PUBLIC_LANDING_ASSISTANT_AI',
    };
  }

  private extractPaginatedProducts(
    result: Awaited<ReturnType<ProductPublicService['findAll']>>,
  ) {
    const record = this.toRecord(result);

    return Array.isArray(record.data) ? (record.data as unknown[]) : [];
  }

  private buildLandingAssistantContext(
    kind: PublicLandingKind,
    landing: unknown,
  ) {
    const landingRecord = this.toRecord(landing);
    const entityRecord = this.toRecord(landingRecord.entity);
    const paginationRecord = this.toRecord(landingRecord.pagination);
    const facetsRecord = this.toRecord(landingRecord.facets);
    const products = Array.isArray(landingRecord.products)
      ? landingRecord.products.map((item) => this.toRecord(item))
      : [];

    return {
      kind,
      entity: {
        id: this.getString(entityRecord.id),
        name:
          this.sanitizeCustomerText(this.getString(entityRecord.name)) ??
          this.getString(entityRecord.slug),
        slug: this.getString(entityRecord.slug),
        description: this.sanitizeCustomerText(
          this.getString(entityRecord.description),
        ),
        seo: this.toRecord(entityRecord.seo),
      },
      products: products.slice(0, 8).map((product) => {
        const brand = this.toRecord(product.brand);
        const category = this.toRecord(product.category);
        const productType = this.toRecord(product.productType);
        const productModel = this.toRecord(product.productModel);
        const pricing = this.toRecord(product.pricing);
        const stock = this.toRecord(product.stock);

        return {
          id: this.getString(product.id),
          name:
            this.sanitizeCustomerText(this.getString(product.name)) ??
            this.getString(product.slug),
          slug: this.getString(product.slug),
          sku: this.getString(product.sku),
          shortDescription: this.sanitizeCustomerText(
            this.getString(product.shortDescription),
          ),
          brand: this.sanitizeCustomerText(this.getString(brand.name)),
          category: this.sanitizeCustomerText(this.getString(category.name)),
          productType: this.sanitizeCustomerText(
            this.getString(productType.name),
          ),
          productModel: this.sanitizeCustomerText(
            this.getString(productModel.name),
          ),
          displayPrice: this.getString(pricing.displayPrice),
          hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
          availableStock: this.toNumber(stock.availableStock),
          inStock: this.getBoolean(stock.inStock) ?? false,
        };
      }),
      facets: facetsRecord,
      pagination: paginationRecord,
    };
  }

  private buildLandingAssistantMessages(
    context: ReturnType<ProductPublicService['buildLandingAssistantContext']>,
  ) {
    const title = this.getLandingKindTitle(context.kind);

    return [
      {
        role: 'system' as const,
        content: [
          `تو راهنمای فارسی صفحه ${title} فروشگاه وکسو بیوتی هستی.`,
          'فقط بر اساس اطلاعات عمومی همین context پاسخ بده.',
          'هیچ داده داخلی مالی، عملیاتی، audit، تأیید ادمین، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'اگر قیمت می‌گویی، فقط displayPrice موجود در context را با واحد ریال بنویس؛ تومان/تومن ننویس و تبدیل واحد انجام نده.',
          'درباره گارانتی، ضمانت یا اصالت کالا ادعا نساز مگر همان داده در context عمومی همان محصول آمده باشد.',
          'پاسخ کوتاه، فروشگاهی، دقیق و مناسب نمایش در صفحه فرود سایت باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `نوع صفحه: ${title}`,
          'context عمومی صفحه فرود:',
          JSON.stringify(context, null, 2),
          '',
          'یک متن راهنمای کوتاه برای مشتری تولید کن و حداکثر سه محصول شاخص را معرفی کن.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicLandingAssistantAnswer(
    context: ReturnType<ProductPublicService['buildLandingAssistantContext']>,
  ): string {
    const title = this.getLandingKindTitle(context.kind);
    const name = context.entity.name ?? context.entity.slug ?? title;
    const total = this.toNumber(context.pagination.total);

    if (context.products.length === 0) {
      return `در صفحه ${title} «${name}» فعلاً محصول عمومی قابل نمایش پیدا نشد. برای انتخاب بهتر می‌توانید از جستجو یا فیلترهای فروشگاه استفاده کنید.`;
    }

    const lines = [
      `در صفحه ${title} «${name}» ${total || context.products.length} محصول عمومی قابل بررسی است.`,
    ];

    for (const product of context.products.slice(0, 3)) {
      const priceText = product.displayPrice
        ? ` قیمت قابل نمایش: ${product.displayPrice} ریال.`
        : '';
      const stockText = product.inStock
        ? ` موجودی قابل فروش: ${product.availableStock} عدد.`
        : ' موجودی قابل فروش ثبت نشده است.';
      const discountText = product.hasDiscount
        ? ' این محصول تخفیف فعال دارد.'
        : '';
      const brandText =
        product.brand && context.kind !== 'BRAND'
          ? ` برند: ${product.brand}.`
          : '';
      const categoryText =
        product.category && context.kind !== 'CATEGORY'
          ? ` دسته‌بندی: ${product.category}.`
          : '';

      lines.push(
        `- ${product.name ?? product.slug}.${brandText}${categoryText}${priceText}${stockText}${discountText}`,
      );
    }

    lines.push(
      'برای انتخاب دقیق‌تر، فیلترهای موجودی، تخفیف، برند، دسته‌بندی و بازه قیمت را بررسی کنید.',
    );

    return lines.join('\n');
  }

  private buildHomeAssistantContext(
    homeSections: Awaited<ReturnType<ProductPublicService['getHomeSections']>>,
  ) {
    const sections = Array.isArray(homeSections.sections)
      ? homeSections.sections
      : [];

    return {
      sections: sections.map((section) => {
        const sectionRecord = this.toRecord(section);
        const products = Array.isArray(sectionRecord.products)
          ? sectionRecord.products.map((item) => {
              const product = this.toRecord(item);
              const brand = this.toRecord(product.brand);
              const category = this.toRecord(product.category);
              const pricing = this.toRecord(product.pricing);
              const stock = this.toRecord(product.stock);

              return {
                id: this.getString(product.id),
                name:
                  this.sanitizeCustomerText(this.getString(product.name)) ??
                  this.getString(product.slug),
                slug: this.getString(product.slug),
                sku: this.getString(product.sku),
                brand: this.sanitizeCustomerText(this.getString(brand.name)),
                category: this.sanitizeCustomerText(
                  this.getString(category.name),
                ),
                displayPrice: this.getString(pricing.displayPrice),
                hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
                availableStock: this.toNumber(stock.availableStock),
                inStock: this.getBoolean(stock.inStock) ?? false,
              };
            })
          : [];

        return {
          key: this.getString(sectionRecord.key),
          title: this.sanitizeCustomerText(this.getString(sectionRecord.title)),
          description: this.sanitizeCustomerText(
            this.getString(sectionRecord.description),
          ),
          products: products.slice(0, 8),
        };
      }),
      meta: this.toRecord(homeSections.meta),
    };
  }

  private buildHomeAssistantMessages(
    context: ReturnType<ProductPublicService['buildHomeAssistantContext']>,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای فارسی صفحه اصلی فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس محصولات عمومی و بخش‌های امن صفحه اصلی پاسخ بده.',
          'هیچ داده داخلی مالی، عملیاتی، audit، تأیید ادمین، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ کوتاه، فروشگاهی و مناسب نمایش در ویجت صفحه اصلی باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی صفحه اصلی:',
          JSON.stringify(context, null, 2),
          '',
          'یک متن کوتاه برای راهنمای صفحه اصلی تولید کن و از هر بخش حداکثر یک محصول شاخص را معرفی کن.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicHomeAssistantAnswer(
    context: ReturnType<ProductPublicService['buildHomeAssistantContext']>,
  ): string {
    const lines = [
      'در صفحه اصلی وکسو بیوتی چند بخش عمومی برای انتخاب سریع محصول آماده است:',
    ];

    for (const section of context.sections) {
      const firstProduct = section.products[0];

      if (!firstProduct) {
        continue;
      }

      const priceText = firstProduct.displayPrice
        ? ` با قیمت قابل نمایش ${firstProduct.displayPrice} ریال`
        : '';
      const stockText = firstProduct.inStock ? ' و موجودی قابل فروش' : '';

      lines.push(
        `- ${section.title ?? 'بخش محصول'}: ${firstProduct.name ?? firstProduct.slug}${priceText}${stockText}.`,
      );
    }

    if (lines.length === 1) {
      lines.push(
        'در حال حاضر محصول عمومی کافی برای ساخت پیشنهاد صفحه اصلی ثبت نشده است.',
      );
    }

    lines.push(
      'برای انتخاب دقیق‌تر، وارد صفحه محصول شوید یا از جستجو و فیلترهای فروشگاه استفاده کنید.',
    );

    return lines.join('\n');
  }

  private buildProductHighlightItems(
    product: Record<string, unknown>,
    attributeMap: Record<string, unknown>,
  ) {
    const productName =
      this.sanitizeCustomerText(this.getString(product.name)) ??
      this.getString(product.slug) ??
      'این محصول';
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const content = this.toRecord(product.content);
    const media = this.toRecord(product.media);
    const primaryImage = this.toRecord(media.primaryImage);
    const sellingPoints = this.getStringArray(content.sellingPoints)
      .map((item) => this.sanitizeCustomerText(item))
      .filter((item): item is string =>
        Boolean(item && !this.hasPublicProcessLeak(item)),
      );
    const highlights: {
      key: string;
      title: string;
      value: string;
      source: string;
      priority: number;
    }[] = [];
    const seen = new Set<string>();

    const add = (
      key: string,
      titleValue: string,
      valueValue: string | null | undefined,
      source: string,
      priority: number,
    ) => {
      const title = this.sanitizeCustomerText(titleValue);
      const value = this.sanitizeCustomerText(valueValue);

      if (!title || !value || seen.has(key)) {
        return;
      }

      if (
        this.hasPublicProcessLeak(title) ||
        this.hasPublicProcessLeak(value)
      ) {
        return;
      }

      seen.add(key);
      highlights.push({ key, title, value, source, priority });
    };

    const displayPrice =
      this.getString(pricing.displayPrice) ??
      this.getString(pricing.finalPrice) ??
      this.getString(pricing.salePrice) ??
      this.getString(pricing.regularPrice);
    const discountPercent = this.getString(pricing.discountPercent);
    const hasDiscount = this.getBoolean(pricing.hasDiscount) === true;
    const availableStock = this.toNumber(stock.availableStock);
    const warranty = this.sanitizeAttributeValue(attributeMap.warranty);
    const countryOfOrigin = this.sanitizeAttributeValue(
      attributeMap.country_of_origin,
    );
    const usageMethod = this.sanitizeAttributeValue(attributeMap.usage_method);
    const shortDescription = this.sanitizeCustomerText(
      this.getString(product.shortDescription),
    );

    if (displayPrice) {
      add(
        'display_price',
        'قیمت قابل نمایش',
        `${displayPrice} ریال${hasDiscount ? ' با تخفیف عمومی فعال' : ''}`,
        'PUBLIC_PRICING',
        10,
      );
    }

    if (hasDiscount) {
      add(
        'discount',
        'وضعیت تخفیف',
        discountPercent
          ? `تخفیف عمومی ${discountPercent} درصدی برای محصول فعال است.`
          : 'این محصول در حال حاضر با قیمت تخفیف‌دار عمومی نمایش داده می‌شود.',
        'PUBLIC_PRICING',
        20,
      );
    }

    add(
      'availability',
      'وضعیت موجودی',
      availableStock > 0
        ? `موجود و آماده خرید؛ موجودی قابل فروش ${availableStock} عدد است.`
        : 'در حال حاضر موجودی قابل فروش برای این محصول ثبت نشده است.',
      'PUBLIC_STOCK',
      30,
    );

    if (typeof warranty === 'string') {
      add('warranty', 'گارانتی', warranty, 'PUBLIC_ATTRIBUTE', 40);
    }

    if (typeof countryOfOrigin === 'string') {
      add(
        'country_of_origin',
        'کشور سازنده',
        countryOfOrigin,
        'PUBLIC_ATTRIBUTE',
        50,
      );
    }

    if (typeof usageMethod === 'string') {
      add('usage_method', 'نحوه استفاده', usageMethod, 'PUBLIC_ATTRIBUTE', 60);
    }

    if (shortDescription) {
      add(
        'short_description',
        'خلاصه محصول',
        shortDescription,
        'PUBLIC_DESCRIPTION',
        70,
      );
    }

    sellingPoints.slice(0, 4).forEach((item, index) => {
      add(
        `selling_point_${index + 1}`,
        `مزیت محصول ${index + 1}`,
        item,
        'PUBLIC_CONTENT',
        80 + index,
      );
    });

    if (this.getString(primaryImage.url)) {
      add(
        'media',
        'رسانه محصول',
        `برای ${productName} تصویر محصول در صفحه کالا ثبت شده است.`,
        'PUBLIC_MEDIA',
        90,
      );
    }

    return highlights
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 12)
      .map((item) => ({
        key: item.key,
        title: item.title,
        value: item.value,
        source: item.source,
      }));
  }

  private buildProductHighlightBadges(
    product: Record<string, unknown>,
    highlights: { key: string; title: string; value: string; source: string }[],
  ): string[] {
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const result: string[] = [];
    const add = (value: string) => {
      const safeValue = this.sanitizeCustomerText(value);

      if (safeValue && !result.includes(safeValue)) {
        result.push(safeValue);
      }
    };

    if (this.getBoolean(pricing.hasDiscount) === true) {
      add('دارای تخفیف عمومی');
    }

    if (this.getBoolean(stock.inStock) === true) {
      add('موجود و آماده خرید');
    }

    if (highlights.some((item) => item.key === 'warranty')) {
      add('دارای گارانتی');
    }

    const country = highlights.find((item) => item.key === 'country_of_origin');

    if (country?.value) {
      add(`ساخت ${country.value}`);
    }

    if (highlights.some((item) => item.key === 'media')) {
      add('دارای تصویر محصول');
    }

    return result.slice(0, 8);
  }

  private buildProductHighlightAssistantContext(
    highlightsResponse: Awaited<
      ReturnType<ProductPublicService['getProductHighlights']>
    >,
  ) {
    const product = this.toRecord(highlightsResponse.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);

    return {
      product: {
        id: this.getString(product.id),
        name:
          this.sanitizeCustomerText(this.getString(product.name)) ??
          this.getString(product.slug),
        slug: this.getString(product.slug),
        brand: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.brand).name),
        ),
        category: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.category).name),
        ),
        displayPrice: this.getString(pricing.displayPrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
      },
      highlights: highlightsResponse.highlights.map((item) => ({
        key: item.key,
        title: item.title,
        value: item.value,
        source: item.source,
      })),
      badges: highlightsResponse.badges,
      meta: highlightsResponse.meta,
    };
  }

  private buildProductHighlightAssistantMessages(
    context: ReturnType<
      ProductPublicService['buildProductHighlightAssistantContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای نکات برجسته محصول در فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی highlight پاسخ بده و ادعای جدید نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، فرآیند اداری، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ باید کوتاه، فارسی، فروشگاهی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی نکات برجسته محصول:',
          JSON.stringify(context, null, 2),
          '',
          'یک متن کوتاه فروشگاهی برای خلاصه محصول بنویس و مهم‌ترین نکات برجسته و badges را توضیح بده.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicProductHighlightAnswer(
    context: ReturnType<
      ProductPublicService['buildProductHighlightAssistantContext']
    >,
  ): string {
    const lines: string[] = [];
    const productName =
      context.product.name ?? context.product.slug ?? 'این محصول';

    lines.push(`نکات برجسته ${productName}:`);

    for (const item of context.highlights.slice(0, 5)) {
      lines.push(`- ${item.title}: ${item.value}`);
    }

    if (context.badges.length > 0) {
      lines.push(`برچسب‌های عمومی: ${context.badges.join('، ')}.`);
    }

    lines.push(
      'این خلاصه فقط بر اساس اطلاعات عمومی محصول، قیمت قابل نمایش و موجودی قابل فروش ساخته شده است.',
    );

    return lines.join('\n');
  }

  private buildProductPurchaseDecision(
    product: Record<string, unknown>,
    highlights: { key: string; title: string; value: string; source: string }[],
    badges: string[],
  ) {
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const displayPrice = this.getString(pricing.displayPrice);
    const hasDiscount = this.getBoolean(pricing.hasDiscount) === true;
    const inStock = this.getBoolean(stock.inStock) === true;
    const availableStock = this.toNumber(stock.availableStock);
    const hasWarranty = highlights.some((item) => item.key === 'warranty');
    const hasUsage = highlights.some((item) => item.key === 'usage_method');
    const hasImage = highlights.some((item) => item.key === 'media');
    let score = 35;
    const reasons: string[] = [];
    const cautions: string[] = [];

    const addReason = (value: string) => {
      const safe = this.sanitizeCustomerText(value);

      if (safe && !reasons.includes(safe)) {
        reasons.push(safe);
      }
    };

    const addCaution = (value: string) => {
      const safe = this.sanitizeCustomerText(value);

      if (safe && !cautions.includes(safe)) {
        cautions.push(safe);
      }
    };

    if (displayPrice) {
      score += 12;
      addReason('قیمت قابل نمایش برای مشتری مشخص است.');
    } else {
      addCaution('قیمت قابل نمایش برای این محصول کامل نیست.');
    }

    if (hasDiscount) {
      score += 8;
      addReason('برای محصول تخفیف عمومی فعال است.');
    }

    if (inStock && availableStock > 0) {
      score += 18;
      addReason(
        `محصول موجود است و موجودی قابل فروش ${availableStock} عدد ثبت شده است.`,
      );
    } else {
      score -= 18;
      addCaution('فعلاً موجودی قابل فروش برای خرید مستقیم ثبت نشده است.');
    }

    if (hasWarranty) {
      score += 12;
      addReason('اطلاعات گارانتی برای تصمیم خرید در دسترس است.');
    } else {
      addCaution('اطلاعات گارانتی عمومی برای این محصول کامل نیست.');
    }

    if (hasUsage) {
      score += 8;
      addReason('راهنمای استفاده عمومی برای محصول ثبت شده است.');
    }

    if (hasImage) {
      score += 7;
      addReason('تصویر محصول برای بررسی ظاهری در صفحه کالا موجود است.');
    }

    if (badges.length > 0) {
      score += Math.min(8, badges.length * 2);
    }

    const safeScore = Math.max(0, Math.min(100, score));
    const readiness = !inStock
      ? 'OUT_OF_STOCK'
      : safeScore >= 78
        ? 'READY_TO_BUY'
        : safeScore >= 58
          ? 'CHECK_DETAILS'
          : 'NEED_MORE_INFO';
    const label =
      readiness === 'READY_TO_BUY'
        ? 'آماده خرید'
        : readiness === 'CHECK_DETAILS'
          ? 'نیازمند بررسی جزئیات'
          : readiness === 'OUT_OF_STOCK'
            ? 'ناموجود برای خرید مستقیم'
            : 'نیازمند تکمیل اطلاعات';

    return {
      score: safeScore,
      readiness,
      label,
      reasons: reasons.slice(0, 6),
      cautions: cautions.slice(0, 5),
      recommendation:
        readiness === 'READY_TO_BUY'
          ? 'این محصول از نظر اطلاعات عمومی، موجودی و شفافیت خرید برای نمایش در مسیر خرید آماده است.'
          : readiness === 'OUT_OF_STOCK'
            ? 'پیش از خرید، موجودی محصول را بررسی کنید یا از محصولات مرتبط موجود استفاده کنید.'
            : 'پیش از خرید، جزئیات صفحه محصول و سوالات متداول را بررسی کنید.',
    };
  }

  private buildProductPurchaseNextActions(
    product: Record<string, unknown>,
    decision: { readiness: string },
  ) {
    const slug = this.getString(product.slug) ?? '';
    const actions = [
      {
        key: 'open_product',
        label: 'مشاهده صفحه محصول',
        path: `/products/${slug}`,
      },
      {
        key: 'ask_sales_advisor',
        label: 'پرسیدن سوال از مشاور فروش',
        path: `/products/${slug}#sales-advisor`,
      },
      {
        key: 'compare',
        label: 'مقایسه با محصولات مشابه',
        path: `/products/compare?items=${slug}`,
      },
    ];

    if (decision.readiness === 'OUT_OF_STOCK') {
      actions.unshift({
        key: 'related_products',
        label: 'دیدن جایگزین‌های مرتبط',
        path: `/products/${slug}#related-products`,
      });
    }

    return actions;
  }

  private buildProductPurchaseGuideAssistantContext(
    guideResponse: Awaited<
      ReturnType<ProductPublicService['getProductPurchaseGuide']>
    >,
  ) {
    const product = this.toRecord(guideResponse.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);

    return {
      product: {
        id: this.getString(product.id),
        name:
          this.sanitizeCustomerText(this.getString(product.name)) ??
          this.getString(product.slug),
        slug: this.getString(product.slug),
        brand: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.brand).name),
        ),
        category: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.category).name),
        ),
        displayPrice: this.getString(pricing.displayPrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
      },
      decision: guideResponse.decision,
      highlights: guideResponse.highlights,
      badges: guideResponse.badges,
      faq: guideResponse.faq,
      related: guideResponse.related,
      nextActions: guideResponse.nextActions,
      meta: guideResponse.meta,
    };
  }

  private buildProductPurchaseGuideAssistantMessages(
    context: ReturnType<
      ProductPublicService['buildProductPurchaseGuideAssistantContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای خرید محصول در فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی راهنمای خرید پاسخ بده و هیچ عدد یا ادعای جدید نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، فرآیند اداری، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ باید فارسی، کوتاه، کاربردی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی راهنمای خرید محصول:',
          JSON.stringify(context, null, 2),
          '',
          'یک راهنمای خرید کوتاه بنویس: وضعیت آمادگی خرید، دلایل اصلی، نکات احتیاطی و اقدام بعدی را توضیح بده.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicProductPurchaseGuideAnswer(
    context: ReturnType<
      ProductPublicService['buildProductPurchaseGuideAssistantContext']
    >,
  ): string {
    const productName =
      context.product.name ?? context.product.slug ?? 'این محصول';
    const lines: string[] = [];

    lines.push(`راهنمای خرید ${productName}:`);
    lines.push(
      `وضعیت: ${context.decision.label} با امتیاز عمومی ${context.decision.score} از ۱۰۰.`,
    );

    if (context.decision.reasons.length > 0) {
      lines.push(
        `دلایل مثبت: ${context.decision.reasons.slice(0, 3).join('، ')}.`,
      );
    }

    if (context.decision.cautions.length > 0) {
      lines.push(
        `نکات قابل بررسی: ${context.decision.cautions.slice(0, 2).join('، ')}.`,
      );
    }

    if (context.product.displayPrice) {
      lines.push(`قیمت قابل نمایش فعلی: ${context.product.displayPrice} ریال.`);
    }

    lines.push(context.decision.recommendation);
    lines.push(
      'این راهنما فقط بر اساس اطلاعات عمومی محصول، قیمت قابل نمایش و موجودی قابل فروش ساخته شده است.',
    );

    return lines.join('\n');
  }

  private buildPublicNeedProfile(body: Record<string, unknown>) {
    const getField = (key: string): string | null =>
      this.sanitizeCustomerText(this.getString(body[key]));
    const getList = (key: string): string[] => {
      const value = body[key];
      const raw = Array.isArray(value)
        ? value
        : typeof value === 'string'
          ? value.split(/[،,|\n]/g)
          : [];

      return raw
        .map((item) => this.sanitizeCustomerText(this.getString(item)))
        .filter((item): item is string => Boolean(item))
        .filter((item) => !this.hasPublicProcessLeak(item))
        .slice(0, 8);
    };

    const profile = {
      concern: getField('concern'),
      skinType: getField('skinType'),
      hairType: getField('hairType'),
      usageGoal: getField('usageGoal'),
      priority: getField('priority'),
      budgetPreference: getField('budgetPreference'),
      mustHave: getList('mustHave'),
      avoid: getList('avoid'),
      notes: getField('notes'),
    };

    const hasInput = Object.values(profile).some((value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value),
    );

    return {
      ...profile,
      hasInput,
      dataUse:
        'این نیازها فقط برای همین پاسخ استفاده می‌شوند و در این endpoint ذخیره نمی‌شوند.',
    };
  }

  private buildProductFitDecision(
    guideResponse: Awaited<
      ReturnType<ProductPublicService['getProductPurchaseGuide']>
    >,
    profile: ReturnType<ProductPublicService['buildPublicNeedProfile']>,
  ) {
    const product = this.toRecord(guideResponse.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const highlights = Array.isArray(guideResponse.highlights)
      ? guideResponse.highlights.map((item) => this.toRecord(item))
      : [];
    const badges = Array.isArray(guideResponse.badges)
      ? guideResponse.badges.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const textCorpus = [
      this.getString(product.name),
      this.getString(product.slug),
      this.getString(this.toRecord(product.brand).name),
      this.getString(this.toRecord(product.category).name),
      this.getString(this.toRecord(product.productType).name),
      this.getString(this.toRecord(product.productModel).name),
      ...highlights.flatMap((item) => [
        this.getString(item.title),
        this.getString(item.value),
      ]),
      ...badges,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ')
      .toLowerCase();

    const needTerms = this.extractFitNeedTerms(profile);
    const matchedSignals: string[] = [];
    const missingSignals: string[] = [];
    let score = 45;

    const addMatched = (value: string) => {
      const safe = this.sanitizeCustomerText(value);
      if (safe && !matchedSignals.includes(safe)) {
        matchedSignals.push(safe);
      }
    };

    const addMissing = (value: string) => {
      const safe = this.sanitizeCustomerText(value);
      if (safe && !missingSignals.includes(safe)) {
        missingSignals.push(safe);
      }
    };

    for (const term of needTerms) {
      if (this.textIncludesNeed(textCorpus, term)) {
        score += 8;
        addMatched(`نیاز «${term}» در اطلاعات عمومی محصول نشانه مرتبط دارد.`);
      } else {
        score -= 3;
        addMissing(`برای نیاز «${term}» اطلاعات عمومی کافی در محصول دیده نشد.`);
      }
    }

    const inStock = this.getBoolean(stock.inStock) === true;
    const hasDiscount = this.getBoolean(pricing.hasDiscount) === true;
    const displayPrice = this.getString(pricing.displayPrice);

    if (inStock) {
      score += 12;
      addMatched('محصول موجود است و برای خرید مستقیم مانع موجودی ندارد.');
    } else {
      score -= 18;
      addMissing('موجودی قابل فروش برای خرید مستقیم ثبت نشده است.');
    }

    if (displayPrice) {
      score += 8;
      addMatched('قیمت قابل نمایش برای تصمیم خرید مشخص است.');
    } else {
      score -= 10;
      addMissing('قیمت قابل نمایش برای تصمیم خرید کامل نیست.');
    }

    if (hasDiscount) {
      score += 5;
      addMatched('برای محصول تخفیف عمومی فعال است.');
    }

    if (highlights.some((item) => this.getString(item.key) === 'warranty')) {
      score += 8;
      addMatched('اطلاعات گارانتی در داده‌های عمومی محصول وجود دارد.');
    }

    if (
      highlights.some((item) => this.getString(item.key) === 'usage_method')
    ) {
      score += 6;
      addMatched('نحوه استفاده عمومی برای محصول ثبت شده است.');
    }

    if (!profile.hasInput) {
      score -= 10;
      addMissing(
        'نیاز مشخصی از سمت مشتری ارسال نشده است؛ ارزیابی عمومی انجام شد.',
      );
    }

    const safeScore = Math.max(0, Math.min(100, score));
    const status = !inStock
      ? 'CHECK_BEFORE_BUY'
      : safeScore >= 78
        ? 'GOOD_FIT'
        : safeScore >= 55
          ? 'POSSIBLE_FIT'
          : 'NEEDS_MORE_INFO';
    const label =
      status === 'GOOD_FIT'
        ? 'تناسب خوب'
        : status === 'POSSIBLE_FIT'
          ? 'تناسب احتمالی'
          : status === 'CHECK_BEFORE_BUY'
            ? 'نیازمند بررسی قبل از خرید'
            : 'نیازمند اطلاعات بیشتر';

    return {
      score: safeScore,
      status,
      label,
      matchedSignals: matchedSignals.slice(0, 8),
      missingSignals: missingSignals.slice(0, 8),
      recommendation:
        status === 'GOOD_FIT'
          ? 'با داده‌های عمومی موجود، این محصول با نیاز اعلام‌شده تناسب خوبی دارد.'
          : status === 'POSSIBLE_FIT'
            ? 'این محصول می‌تواند گزینه قابل بررسی باشد، اما بهتر است جزئیات عمومی محصول را کامل‌تر بررسی کنید.'
            : 'برای تصمیم دقیق‌تر، اطلاعات بیشتری از نیاز مشتری یا مشخصات محصول لازم است.',
    };
  }

  private extractFitNeedTerms(
    profile: ReturnType<ProductPublicService['buildPublicNeedProfile']>,
  ): string[] {
    const raw = [
      profile.concern,
      profile.skinType,
      profile.hairType,
      profile.usageGoal,
      profile.priority,
      profile.budgetPreference,
      profile.notes,
      ...profile.mustHave,
    ]
      .filter((item): item is string => Boolean(item))
      .flatMap((item) => item.split(/[،,\s]+/g))
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && item.length <= 40)
      .filter((item) => !/برای|محصول|نیاز|مناسب|است|with|and|the/i.test(item));

    return Array.from(new Set(raw)).slice(0, 10);
  }

  private textIncludesNeed(textCorpus: string, term: string): boolean {
    const normalizedTerm = term.toLowerCase();

    return textCorpus.includes(normalizedTerm);
  }

  private buildProductFitNextActions(
    product: Record<string, unknown>,
    fit: ReturnType<ProductPublicService['buildProductFitDecision']>,
  ) {
    const slug = this.getString(product.slug) ?? '';
    const actions = [
      {
        key: 'open_product',
        label: 'مشاهده صفحه محصول',
        path: `/products/${slug}`,
      },
      {
        key: 'ask_sales_advisor',
        label: 'پرسیدن سوال اختصاصی از مشاور فروش',
        path: `/products/${slug}#sales-advisor`,
      },
      {
        key: 'compare',
        label: 'مقایسه با محصولات مشابه',
        path: `/products/compare?items=${slug}`,
      },
    ];

    if (fit.status === 'NEEDS_MORE_INFO') {
      actions.unshift({
        key: 'complete_need_profile',
        label: 'تکمیل نیاز و اولویت مشتری',
        path: `/products/${slug}#fit-guide`,
      });
    }

    return actions;
  }

  private buildProductFitGuideAssistantContext(
    fitGuide: Awaited<ReturnType<ProductPublicService['getProductFitGuide']>>,
  ) {
    const product = this.toRecord(fitGuide.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);

    return {
      product: {
        id: this.getString(product.id),
        name:
          this.sanitizeCustomerText(this.getString(product.name)) ??
          this.getString(product.slug),
        slug: this.getString(product.slug),
        brand: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.brand).name),
        ),
        category: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.category).name),
        ),
        displayPrice: this.getString(pricing.displayPrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
      },
      profile: fitGuide.profile,
      fit: fitGuide.fit,
      evidence: fitGuide.evidence,
      nextActions: fitGuide.nextActions,
      meta: fitGuide.meta,
    };
  }

  private buildProductFitGuideAssistantMessages(
    context: ReturnType<
      ProductPublicService['buildProductFitGuideAssistantContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای تناسب محصول با نیاز مشتری در فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی و نیاز اعلام‌شده در همین درخواست پاسخ بده.',
          'هیچ تشخیص پزشکی، وعده درمانی، ادعای قطعی درباره پوست/مو یا عدد جدید نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، فرآیند اداری، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ باید فارسی، کوتاه، کاربردی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی راهنمای تناسب محصول:',
          JSON.stringify(context, null, 2),
          '',
          'در چند جمله توضیح بده این محصول تا چه حد با نیاز اعلام‌شده مناسب است، چه شواهد عمومی داریم، چه چیزهایی نیازمند بررسی بیشتر است و اقدام بعدی چیست.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicProductFitGuideAnswer(
    context: ReturnType<
      ProductPublicService['buildProductFitGuideAssistantContext']
    >,
  ): string {
    const productName =
      context.product.name ?? context.product.slug ?? 'این محصول';
    const lines: string[] = [];

    lines.push(`راهنمای تناسب ${productName}:`);
    lines.push(
      `نتیجه عمومی: ${context.fit.label} با امتیاز ${context.fit.score} از ۱۰۰.`,
    );

    if (context.fit.matchedSignals.length > 0) {
      lines.push(
        `شواهد مثبت: ${context.fit.matchedSignals.slice(0, 3).join('، ')}.`,
      );
    }

    if (context.fit.missingSignals.length > 0) {
      lines.push(
        `موارد نیازمند بررسی: ${context.fit.missingSignals.slice(0, 3).join('، ')}.`,
      );
    }

    if (context.product.displayPrice) {
      lines.push(`قیمت قابل نمایش فعلی: ${context.product.displayPrice} ریال.`);
    }

    lines.push(context.fit.recommendation);
    lines.push(
      'این پاسخ فقط بر اساس نیاز اعلام‌شده در همین درخواست و اطلاعات عمومی محصول ساخته شده است.',
    );

    return lines.join('\n');
  }

  private extractUniqueProductsFromSections(homeSections: unknown) {
    const sections = Array.isArray(this.toRecord(homeSections).sections)
      ? (this.toRecord(homeSections).sections as unknown[])
      : [];
    const seen = new Set<string>();
    const products: Record<string, unknown>[] = [];

    for (const section of sections) {
      const record = this.toRecord(section);
      const items = Array.isArray(record.products) ? record.products : [];

      for (const item of items) {
        const product = this.toRecord(item);
        const id = this.getString(product.id) ?? this.getString(product.slug);

        if (id && !seen.has(id)) {
          seen.add(id);
          products.push(product);
        }
      }
    }

    return products;
  }

  private buildPublicRecommendationCandidates(
    products: Record<string, unknown>[],
    profile: ReturnType<ProductPublicService['buildPublicNeedProfile']>,
    limit: number,
  ) {
    const terms = this.extractFitNeedTerms(profile);

    return products
      .map((product) =>
        this.scorePublicRecommendationProduct(product, profile, terms),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private scorePublicRecommendationProduct(
    product: Record<string, unknown>,
    profile: ReturnType<ProductPublicService['buildPublicNeedProfile']>,
    terms: string[],
  ) {
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const brand = this.toRecord(product.brand);
    const category = this.toRecord(product.category);
    const productType = this.toRecord(product.productType);
    const productModel = this.toRecord(product.productModel);
    const displayPrice = this.getString(pricing.displayPrice);
    const hasDiscount = this.getBoolean(pricing.hasDiscount) ?? false;
    const inStock = this.getBoolean(stock.inStock) ?? false;
    const availableStock = this.toNumber(stock.availableStock);
    const productName =
      this.sanitizeCustomerText(this.getString(product.name)) ??
      this.getString(product.slug) ??
      'محصول';
    const textCorpus = [
      productName,
      this.getString(product.shortDescription),
      this.getString(brand.name),
      this.getString(category.name),
      this.getString(productType.name),
      this.getString(productModel.name),
      this.getString(product.sku),
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ')
      .toLowerCase();
    const matchedTerms = terms.filter((term) =>
      this.textIncludesNeed(textCorpus, term),
    );
    const reasons: string[] = [];
    const cautions: string[] = [];
    let score = 30;

    const addReason = (value: string) => {
      const safe = this.sanitizeCustomerText(value);

      if (safe && !reasons.includes(safe)) {
        reasons.push(safe);
      }
    };

    const addCaution = (value: string) => {
      const safe = this.sanitizeCustomerText(value);

      if (safe && !cautions.includes(safe)) {
        cautions.push(safe);
      }
    };

    if (matchedTerms.length > 0) {
      score += Math.min(30, matchedTerms.length * 6);
      addReason(
        `با ${matchedTerms.length} مورد از نیاز اعلام‌شده هم‌پوشانی عمومی دارد.`,
      );
    }

    if (displayPrice) {
      score += 10;
      addReason('قیمت قابل نمایش برای مشتری مشخص است.');
    } else {
      addCaution('قیمت قابل نمایش کامل نیست.');
    }

    if (inStock && availableStock > 0) {
      score += 20;
      addReason(`موجودی قابل فروش ${availableStock} عدد ثبت شده است.`);
    } else {
      score -= 20;
      addCaution('فعلاً موجودی قابل فروش برای خرید مستقیم ثبت نشده است.');
    }

    if (hasDiscount) {
      score += 10;
      addReason('تخفیف عمومی فعال دارد.');
    }

    const budgetText = [profile.budgetPreference, profile.priority]
      .filter((item): item is string => Boolean(item))
      .join(' ');

    if (/قیمت|بودجه|اقتصادی|ارزان|تخفیف/.test(budgetText) && displayPrice) {
      score += 8;
      addReason('با اولویت قیمت/بودجه قابل بررسی است.');
    }

    const safeScore = Math.max(0, Math.min(100, score));
    const status = !inStock
      ? 'CHECK_AVAILABILITY'
      : safeScore >= 75
        ? 'RECOMMENDED'
        : safeScore >= 55
          ? 'GOOD_OPTION'
          : 'LOW_MATCH';
    const label =
      status === 'RECOMMENDED'
        ? 'پیشنهاد مناسب'
        : status === 'GOOD_OPTION'
          ? 'گزینه قابل بررسی'
          : status === 'CHECK_AVAILABILITY'
            ? 'نیازمند بررسی موجودی'
            : 'تناسب کم';

    return {
      product: this.buildPublicRecommendationProductCard(product),
      score: safeScore,
      status,
      label,
      reasons: reasons.slice(0, 6),
      cautions: cautions.slice(0, 4),
      matchedNeedTerms: matchedTerms.slice(0, 8),
    };
  }

  private buildPublicRecommendationProductCard(
    product: Record<string, unknown>,
  ) {
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const brand = this.toRecord(product.brand);
    const category = this.toRecord(product.category);
    const primaryImage = this.toRecord(product.primaryImage);

    return {
      id: this.getString(product.id),
      name:
        this.sanitizeCustomerText(this.getString(product.name)) ??
        this.getString(product.slug),
      slug: this.getString(product.slug),
      sku: this.sanitizeCustomerText(this.getString(product.sku)),
      shortDescription: this.sanitizeCustomerText(
        this.getString(product.shortDescription),
      ),
      brand: {
        id: this.getString(brand.id),
        name: this.sanitizeCustomerText(this.getString(brand.name)),
        slug: this.getString(brand.slug),
      },
      category: {
        id: this.getString(category.id),
        name: this.sanitizeCustomerText(this.getString(category.name)),
        slug: this.getString(category.slug),
      },
      pricing: {
        currency: this.getString(pricing.currency) ?? 'IRR',
        displayPrice: this.getString(pricing.displayPrice),
        finalPrice: this.getString(pricing.finalPrice),
        comparePrice: this.getString(pricing.comparePrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        discountPercent: this.getString(pricing.discountPercent),
      },
      stock: {
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
        isLowStock: this.getBoolean(stock.isLowStock) ?? false,
        isOutOfStock: this.getBoolean(stock.isOutOfStock) ?? false,
      },
      primaryImage: this.getString(primaryImage.url)
        ? {
            url: this.getString(primaryImage.url),
            altText: this.sanitizeCustomerText(
              this.getString(primaryImage.altText),
            ),
          }
        : null,
      path: `/products/${this.getString(product.slug) ?? ''}`,
    };
  }

  private buildPublicRecommendationSummary(
    recommendations: ReturnType<
      ProductPublicService['buildPublicRecommendationCandidates']
    >,
    profile: ReturnType<ProductPublicService['buildPublicNeedProfile']>,
  ) {
    const best = recommendations[0];

    return {
      hasInput: profile.hasInput,
      totalRecommended: recommendations.length,
      topProduct: best ? best.product : null,
      topScore: best ? best.score : null,
      label: best
        ? `${best.label} با امتیاز ${best.score} از ۱۰۰`
        : 'گزینه‌ای برای پیشنهاد پیدا نشد.',
      note: 'این پیشنهادها ذخیره نمی‌شوند و فقط بر اساس نیاز همین درخواست و داده‌های عمومی محصول ساخته شده‌اند.',
    };
  }

  private buildPublicRecommendationAssistantContext(
    guide: Awaited<
      ReturnType<ProductPublicService['getPublicRecommendationGuide']>
    >,
  ) {
    return {
      profile: guide.profile,
      recommendations: guide.recommendations.slice(0, 6).map((item) => {
        const product = this.toRecord(item.product);
        const pricing = this.toRecord(product.pricing);
        const stock = this.toRecord(product.stock);

        return {
          product: {
            id: this.getString(product.id),
            name: this.sanitizeCustomerText(this.getString(product.name)),
            slug: this.getString(product.slug),
            brand: this.sanitizeCustomerText(
              this.getString(this.toRecord(product.brand).name),
            ),
            category: this.sanitizeCustomerText(
              this.getString(this.toRecord(product.category).name),
            ),
            displayPrice: this.getString(pricing.displayPrice),
            hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
            availableStock: this.toNumber(stock.availableStock),
            inStock: this.getBoolean(stock.inStock) ?? false,
          },
          score: item.score,
          label: item.label,
          reasons: item.reasons,
          cautions: item.cautions,
          matchedNeedTerms: item.matchedNeedTerms,
        };
      }),
      summary: guide.summary,
      meta: guide.meta,
    };
  }

  private buildPublicRecommendationAssistantMessages(
    context: ReturnType<
      ProductPublicService['buildPublicRecommendationAssistantContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای پیشنهاد محصول در فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی همین پیام و نیاز اعلام‌شده در همین درخواست پاسخ بده.',
          'هیچ تشخیص پزشکی، وعده درمانی، ادعای قطعی یا اطلاعات ساختگی نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، فرآیند اداری، قیمت خرید، حاشیه سود، حداقل قیمت مجاز یا رزرو موجودی را بیان نکن.',
          'اگر قیمت می‌گویی، فقط همان displayPrice موجود در context را دقیق و با واحد ریال بگو؛ هرگز تومان ننویس و هیچ تبدیل واحد انجام نده.',
          'اگر گارانتی، اصالت کالا یا ضمانت در دلایل عمومی هر محصول نیامده، درباره داشتن گارانتی ادعا نکن؛ حتی اگر کاربر گارانتی را خواسته باشد.',
          'پاسخ باید فارسی، کوتاه، فروشگاهی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی پیشنهاد محصول:',
          JSON.stringify(context, null, 2),
          '',
          '۳ گزینه برتر را با دلیل عمومی، وضعیت موجودی و قیمت قابل نمایش توضیح بده و در پایان اقدام بعدی پیشنهاد کن.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicPublicRecommendationAnswer(
    context: ReturnType<
      ProductPublicService['buildPublicRecommendationAssistantContext']
    >,
  ): string {
    const lines = ['پیشنهادهای مناسب بر اساس نیاز اعلام‌شده:'];

    for (const item of context.recommendations.slice(0, 3)) {
      const productName = item.product.name ?? item.product.slug ?? 'محصول';
      const price = item.product.displayPrice
        ? ` قیمت قابل نمایش: ${item.product.displayPrice} ریال.`
        : ' قیمت قابل نمایش کامل نیست.';
      const stock = item.product.inStock
        ? ` موجودی قابل فروش: ${item.product.availableStock} عدد.`
        : ' فعلاً موجودی قابل فروش ثبت نشده است.';
      const reason = item.reasons.length > 0 ? ` دلیل: ${item.reasons[0]}` : '';

      lines.push(
        `- ${productName}: ${item.label} با امتیاز ${item.score} از ۱۰۰.${price}${stock}${reason}`,
      );
    }

    lines.push(
      'برای تصمیم دقیق‌تر، صفحه محصول را باز کنید یا گزینه‌های پیشنهادی را با هم مقایسه کنید.',
    );
    lines.push(
      'این پاسخ فقط بر اساس نیاز همین درخواست و اطلاعات عمومی محصولات ساخته شده است.',
    );

    return lines.join('\n');
  }

  private hasUnsafeRecommendationPriceAnswer(
    answer: string,
    recommendations: ReturnType<
      ProductPublicService['buildPublicRecommendationAssistantContext']
    >['recommendations'],
  ): boolean {
    if (!/قیمت|price|ریال|تومان|تومن/i.test(answer)) {
      return false;
    }

    if (/تومان|تومن/i.test(answer)) {
      return true;
    }

    const expectedPrices = recommendations
      .map((item) => this.normalizeDigitsOnly(item.product.displayPrice))
      .filter((item): item is string => Boolean(item));

    if (expectedPrices.length === 0) {
      return false;
    }

    const answerNumbers = Array.from(
      answer.matchAll(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,،.\s]*/g),
    )
      .map((match) => this.normalizeDigitsOnly(match[0]))
      .filter((item): item is string => Boolean(item && item.length >= 4));

    return answerNumbers.some(
      (item) =>
        !expectedPrices.some(
          (expected) => item === expected || item.endsWith(expected),
        ),
    );
  }

  private hasUnsupportedRecommendationPublicClaim(
    answer: string,
    context: ReturnType<
      ProductPublicService['buildPublicRecommendationAssistantContext']
    >,
  ): boolean {
    const hasWarrantyClaim = /گارانتی|ضمانت|اصالت\s*کالا|سلامت\s*فیزیکی/i.test(
      answer,
    );

    if (!hasWarrantyClaim) {
      return false;
    }

    const hasWarrantyEvidence = context.recommendations.some((item) => {
      const searchable = [
        item.product.name,
        item.product.brand,
        item.product.category,
        ...item.reasons,
        ...item.cautions,
        ...item.matchedNeedTerms,
      ]
        .filter((value): value is string => typeof value === 'string')
        .join(' ');

      return /گارانتی|ضمانت|اصالت\s*کالا|سلامت\s*فیزیکی/i.test(searchable);
    });

    return !hasWarrantyEvidence;
  }

  private buildPublicAttributeValueMap(
    attributes: Record<string, unknown>[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const attribute of attributes) {
      const code = this.getString(attribute.code);
      const value = this.sanitizeAttributeValue(attribute.value);

      if (code && value !== null && value !== undefined && value !== '') {
        result[code] = value;
      }
    }

    return result;
  }

  private buildFaqProductSummary(product: Record<string, unknown>) {
    return {
      id: this.getString(product.id),
      name:
        this.sanitizeCustomerText(this.getString(product.name)) ??
        this.getString(product.slug),
      slug: this.getString(product.slug),
      sku: this.sanitizeCustomerText(this.getString(product.sku)),
      brand: this.toRecord(product.brand),
      category: this.toRecord(product.category),
      productType: this.toRecord(product.productType),
      productModel: this.toRecord(product.productModel),
      pricing: this.toRecord(product.pricing),
      stock: this.toRecord(product.stock),
    };
  }

  private buildProductFaqItems(
    product: Record<string, unknown>,
    attributeMap: Record<string, unknown>,
  ) {
    const productName =
      this.sanitizeCustomerText(this.getString(product.name)) ??
      this.getString(product.slug) ??
      'این محصول';
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const content = this.toRecord(product.content);
    const existingFaq = Array.isArray(content.faq)
      ? content.faq.map((item) => this.toRecord(item))
      : [];
    const result: {
      question: string;
      answer: string;
      source: string;
      relatedAttributeCode?: string;
    }[] = [];
    const seen = new Set<string>();

    const add = (
      questionValue: string | null | undefined,
      answerValue: string | null | undefined,
      source: string,
      relatedAttributeCode?: string,
    ) => {
      const question = this.sanitizeCustomerText(questionValue);
      const answer = this.sanitizeCustomerText(answerValue);

      if (!question || !answer) {
        return;
      }

      if (
        this.hasPublicProcessLeak(question) ||
        this.hasPublicProcessLeak(answer)
      ) {
        return;
      }

      const key = question.replace(/[؟?\s]+/g, '').toLowerCase();

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      result.push(
        this.removeUndefinedValues({
          question,
          answer,
          source,
          relatedAttributeCode,
        }),
      );
    };

    for (const faqItem of existingFaq) {
      add(
        this.getString(faqItem.question),
        this.getString(faqItem.answer),
        'PRODUCT_CONTENT',
      );
    }

    const displayPrice =
      this.getString(pricing.displayPrice) ??
      this.getString(pricing.finalPrice) ??
      this.getString(pricing.salePrice) ??
      this.getString(pricing.regularPrice);
    const hasDiscount = this.getBoolean(pricing.hasDiscount) === true;
    const availableStock = this.toNumber(stock.availableStock);
    const warranty = this.sanitizeAttributeValue(attributeMap.warranty);
    const countryOfOrigin = this.sanitizeAttributeValue(
      attributeMap.country_of_origin,
    );
    const usageMethod = this.sanitizeAttributeValue(attributeMap.usage_method);

    if (displayPrice) {
      add(
        `قیمت قابل نمایش ${productName} چقدر است؟`,
        `قیمت قابل نمایش فعلی ${displayPrice} ریال است${hasDiscount ? ' و برای این محصول تخفیف عمومی فعال است' : ''}.`,
        'PUBLIC_PRICING',
      );
    }

    add(
      `آیا ${productName} موجود است؟`,
      availableStock > 0
        ? `بله، موجودی قابل فروش این محصول ${availableStock} عدد است.`
        : 'در حال حاضر موجودی قابل فروش برای این محصول ثبت نشده است.',
      'PUBLIC_STOCK',
    );

    if (typeof warranty === 'string') {
      add(
        `گارانتی ${productName} چیست؟`,
        warranty,
        'PUBLIC_ATTRIBUTE',
        'warranty',
      );
    }

    if (typeof countryOfOrigin === 'string') {
      add(
        `کشور سازنده ${productName} کجاست؟`,
        countryOfOrigin,
        'PUBLIC_ATTRIBUTE',
        'country_of_origin',
      );
    }

    if (typeof usageMethod === 'string') {
      add(
        `نحوه استفاده از ${productName} چگونه است؟`,
        usageMethod,
        'PUBLIC_ATTRIBUTE',
        'usage_method',
      );
    }

    const shortDescription = this.sanitizeCustomerText(
      this.getString(product.shortDescription),
    );

    if (shortDescription) {
      add(
        `${productName} برای چه کسی مناسب است؟`,
        shortDescription,
        'PUBLIC_DESCRIPTION',
      );
    }

    return result.slice(0, 12);
  }

  private buildProductFaqAssistantContext(
    faqResponse: Awaited<ReturnType<ProductPublicService['getProductFaq']>>,
  ) {
    const product = this.toRecord(faqResponse.product);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);

    return {
      product: {
        id: this.getString(product.id),
        name:
          this.sanitizeCustomerText(this.getString(product.name)) ??
          this.getString(product.slug),
        slug: this.getString(product.slug),
        brand: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.brand).name),
        ),
        category: this.sanitizeCustomerText(
          this.getString(this.toRecord(product.category).name),
        ),
        displayPrice: this.getString(pricing.displayPrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
      },
      faq: faqResponse.faq.map((item) => ({
        question: item.question,
        answer: item.answer,
      })),
      meta: faqResponse.meta,
    };
  }

  private buildProductFaqAssistantMessages(
    context: ReturnType<
      ProductPublicService['buildProductFaqAssistantContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای سوالات متداول محصول در فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی FAQ پاسخ بده و ادعای جدید نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، فرآیند اداری، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ باید کوتاه، فارسی، فروشگاهی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی سوالات متداول محصول:',
          JSON.stringify(context, null, 2),
          '',
          'یک راهنمای کوتاه برای مشتری بنویس و مهم‌ترین سوالات و پاسخ‌ها را خلاصه کن.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicProductFaqAnswer(
    context: ReturnType<
      ProductPublicService['buildProductFaqAssistantContext']
    >,
  ): string {
    const lines: string[] = [];
    const productName =
      context.product.name ?? context.product.slug ?? 'این محصول';

    lines.push(`سوالات متداول ${productName}:`);

    for (const item of context.faq.slice(0, 4)) {
      lines.push(`- ${item.question} ${item.answer}`);
    }

    if (context.faq.length === 0) {
      lines.push(
        'برای این محصول هنوز سوال متداول عمومی کافی ثبت نشده است؛ مشخصات صفحه محصول را بررسی کنید.',
      );
    }

    lines.push(
      'پاسخ‌ها فقط بر اساس اطلاعات عمومی محصول، قیمت قابل نمایش و موجودی قابل فروش ساخته شده‌اند.',
    );

    return lines.join('\n');
  }

  private hasUnsafePublicCurrencyUnitAnswer(answer: string): boolean {
    return /تومان|تومن/i.test(answer);
  }

  private hasUnsafeDisplayPriceAnswer(
    answer: string,
    displayPrice?: string | null,
  ): boolean {
    const expected = this.normalizeDigitsOnly(displayPrice);

    if (!expected || !/قیمت|price/i.test(answer)) {
      return false;
    }

    const answerNumbers = Array.from(
      answer.matchAll(/[0-9۰-۹٠-٩][0-9۰-۹٠-٩,،.\s]*/g),
    )
      .map((match) => this.normalizeDigitsOnly(match[0]))
      .filter((item): item is string => Boolean(item));

    if (answerNumbers.length === 0) {
      return false;
    }

    return !answerNumbers.some(
      (item) => item === expected || item.endsWith(expected),
    );
  }

  private normalizeDigitsOnly(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    const digits = value
      .replace(/[۰-۹]/g, (char) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char)))
      .replace(/[٠-٩]/g, (char) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(char)))
      .replace(/[^0-9]/g, '');

    return digits.length > 0 ? digits : null;
  }

  private hasPublicProcessLeak(value: string): boolean {
    return /ادمین|مدیریت|approved|metadata|هوش\s*مصنوعی|\bAI\b|کنترل‌شده|اعمال\s*کنترل/i.test(
      value,
    );
  }

  private normalizeCompareIdentifiers(
    itemsValue?: string,
    limitValue?: string | number,
  ): string[] {
    const limit = this.normalizeCompareLimit(limitValue);
    const items =
      typeof itemsValue === 'string'
        ? itemsValue
            .split(/[،,|\n]/g)
            .map((item) => item.trim())
            .filter((item) => item.length > 0 && item.length <= 180)
        : [];

    const unique = Array.from(new Set(items));

    if (unique.length < 2) {
      throw new BadRequestException(
        'پارامتر items باید حداقل دو شناسه، slug یا SKU محصول داشته باشد.',
      );
    }

    return unique.slice(0, limit);
  }

  private normalizeCompareLimit(value?: string | number): number {
    const numeric = Number(value ?? 4);

    if (!Number.isFinite(numeric)) {
      return 4;
    }

    return Math.min(4, Math.max(2, Math.trunc(numeric)));
  }

  private mapCompareProduct(productPage: unknown): Record<string, unknown> {
    const product = this.toRecord(productPage);
    const media = this.toRecord(product.media);
    const pricing = this.toRecord(product.pricing);
    const stock = this.toRecord(product.stock);
    const rating = this.toRecord(product.rating);
    const attributes = Array.isArray(product.attributes)
      ? product.attributes.map((item) => this.toRecord(item))
      : [];

    return {
      id: this.getString(product.id),
      name:
        this.sanitizeCustomerText(this.getString(product.name)) ??
        this.getString(product.slug),
      slug: this.getString(product.slug),
      sku: this.sanitizeCustomerText(this.getString(product.sku)),
      shortDescription: this.sanitizeCustomerText(
        this.getString(product.shortDescription),
      ),
      brand: this.toRecord(product.brand),
      category: this.toRecord(product.category),
      productType: this.toRecord(product.productType),
      productModel: this.toRecord(product.productModel),
      pricing,
      stock,
      primaryImage: this.toRecord(media.primaryImage),
      rating: {
        average: this.getString(rating.average),
        reviewCount: this.toNumber(rating.reviewCount),
      },
      attributes: attributes
        .map((attribute) => ({
          code: this.getString(attribute.code),
          label:
            this.sanitizeCustomerText(this.getString(attribute.label)) ??
            this.sanitizeCustomerText(this.getString(attribute.name)),
          value: this.sanitizeAttributeValue(attribute.value),
          unit: this.sanitizeCustomerText(this.getString(attribute.unit)),
          dataType: this.getString(attribute.dataType),
          isComparable: this.getBoolean(attribute.isComparable) ?? false,
          isFilterable: this.getBoolean(attribute.isFilterable) ?? false,
          sortOrder: this.toNumber(attribute.sortOrder),
        }))
        .filter((attribute) => Boolean(attribute.label && attribute.value)),
    };
  }

  private buildComparisonMatrix(products: Record<string, unknown>[]) {
    const fieldMap = new Map<
      string,
      {
        code: string | null;
        label: string;
        unit: string | null;
        sortOrder: number;
        values: { productId: string | null; value: unknown }[];
      }
    >();

    for (const product of products) {
      const productId = this.getString(product.id);
      const attributes = Array.isArray(product.attributes)
        ? product.attributes.map((item) => this.toRecord(item))
        : [];

      for (const attribute of attributes) {
        const code = this.getString(attribute.code);
        const label =
          this.sanitizeCustomerText(this.getString(attribute.label)) ?? code;

        if (!label) {
          continue;
        }

        const key = code ?? label;
        const existing = fieldMap.get(key) ?? {
          code,
          label,
          unit: this.sanitizeCustomerText(this.getString(attribute.unit)),
          sortOrder: this.toNumber(attribute.sortOrder),
          values: [],
        };

        existing.values.push({
          productId,
          value: this.sanitizeAttributeValue(attribute.value),
        });
        fieldMap.set(key, existing);
      }
    }

    return Array.from(fieldMap.values())
      .map((field) => ({
        code: field.code,
        label: field.label,
        unit: field.unit,
        values: products.map((product) => {
          const productId = this.getString(product.id);
          const value = field.values.find(
            (item) => item.productId === productId,
          );

          return {
            productId,
            value: value?.value ?? null,
          };
        }),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fa'));
  }

  private buildComparisonInsights(products: Record<string, unknown>[]) {
    const pricedProducts = products
      .map((product) => {
        const pricing = this.toRecord(product.pricing);
        const stock = this.toRecord(product.stock);
        const price = Number(
          this.getString(pricing.displayPrice) ??
            this.getString(pricing.finalPrice) ??
            this.getString(pricing.salePrice) ??
            this.getString(pricing.regularPrice) ??
            0,
        );

        return {
          id: this.getString(product.id),
          name: this.sanitizeCustomerText(this.getString(product.name)),
          slug: this.getString(product.slug),
          price: Number.isFinite(price) ? price : 0,
          inStock: this.getBoolean(stock.inStock) === true,
          availableStock: this.toNumber(stock.availableStock),
          hasDiscount: this.getBoolean(pricing.hasDiscount) === true,
        };
      })
      .filter((item) => item.price > 0);

    const cheapest = [...pricedProducts].sort((a, b) => a.price - b.price)[0];
    const highest = [...pricedProducts].sort((a, b) => b.price - a.price)[0];

    return {
      cheapest: cheapest
        ? {
            id: cheapest.id,
            name: cheapest.name,
            slug: cheapest.slug,
            displayPrice: String(cheapest.price),
          }
        : null,
      highestPrice: highest
        ? {
            id: highest.id,
            name: highest.name,
            slug: highest.slug,
            displayPrice: String(highest.price),
          }
        : null,
      inStockCount: pricedProducts.filter((item) => item.inStock).length,
      discountedCount: pricedProducts.filter((item) => item.hasDiscount).length,
    };
  }

  private buildCompareAssistantContext(
    comparison: Awaited<ReturnType<ProductPublicService['getCompareProducts']>>,
  ) {
    const items = Array.isArray(comparison.items)
      ? comparison.items.map((item) => this.toRecord(item))
      : [];

    return {
      items: items.map((item) => {
        const pricing = this.toRecord(item.pricing);
        const stock = this.toRecord(item.stock);
        const brand = this.toRecord(item.brand);
        const category = this.toRecord(item.category);
        const productType = this.toRecord(item.productType);
        const productModel = this.toRecord(item.productModel);
        const attributes = Array.isArray(item.attributes)
          ? item.attributes.map((attribute) => this.toRecord(attribute))
          : [];

        return {
          id: this.getString(item.id),
          name:
            this.sanitizeCustomerText(this.getString(item.name)) ??
            this.getString(item.slug),
          slug: this.getString(item.slug),
          brand: this.sanitizeCustomerText(this.getString(brand.name)),
          category: this.sanitizeCustomerText(this.getString(category.name)),
          productType: this.sanitizeCustomerText(
            this.getString(productType.name),
          ),
          productModel: this.sanitizeCustomerText(
            this.getString(productModel.name),
          ),
          displayPrice: this.getString(pricing.displayPrice),
          hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
          availableStock: this.toNumber(stock.availableStock),
          inStock: this.getBoolean(stock.inStock) ?? false,
          attributes: attributes.slice(0, 12).map((attribute) => ({
            label: this.sanitizeCustomerText(this.getString(attribute.label)),
            value: attribute.value,
            unit: this.sanitizeCustomerText(this.getString(attribute.unit)),
          })),
        };
      }),
      matrix: comparison.matrix,
      insights: comparison.insights,
      meta: comparison.meta,
    };
  }

  private buildCompareAssistantMessages(
    context: ReturnType<ProductPublicService['buildCompareAssistantContext']>,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای مقایسه محصول فارسی فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context عمومی مقایسه پاسخ بده و ادعای جدید نساز.',
          'هیچ داده داخلی مالی، عملیاتی، audit، تایید ادمین، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ باید کوتاه، کاربردی، فروشگاهی و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          'context عمومی مقایسه محصولات:',
          JSON.stringify(context, null, 2),
          '',
          'محصولات را از نظر قیمت قابل نمایش، موجودی قابل فروش، برند، دسته‌بندی و attributes عمومی مقایسه کن و یک پیشنهاد تصمیم‌گیری امن بده.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicCompareAnswer(
    context: ReturnType<ProductPublicService['buildCompareAssistantContext']>,
  ): string {
    const items = context.items;

    if (items.length < 2) {
      return 'برای مقایسه، حداقل دو محصول عمومی لازم است.';
    }

    const lines = ['مقایسه کوتاه محصولات انتخاب‌شده:'];

    for (const item of items.slice(0, 4)) {
      const stockText = item.inStock
        ? `موجودی قابل فروش: ${item.availableStock} عدد`
        : 'در حال حاضر ناموجود';
      const priceText = item.displayPrice
        ? `قیمت قابل نمایش: ${item.displayPrice} ریال`
        : 'قیمت قابل نمایش ثبت نشده';
      const discountText = item.hasDiscount ? '، دارای تخفیف' : '';

      lines.push(
        `- ${item.name ?? item.slug}: ${priceText}${discountText}، ${stockText}.`,
      );
    }

    const insights = this.toRecord(context.insights);
    const cheapest = this.toRecord(insights.cheapest);
    const cheapestName = this.sanitizeCustomerText(
      this.getString(cheapest.name),
    );

    if (cheapestName) {
      lines.push(`از نظر قیمت قابل نمایش، گزینه اقتصادی‌تر: ${cheapestName}.`);
    }

    lines.push(
      'برای انتخاب نهایی، مشخصات عمومی، موجودی قابل فروش و نیاز واقعی مشتری را کنار هم بررسی کنید.',
    );

    return lines.join('\n');
  }

  private buildRelatedRecommendationContext(
    relatedResult: Awaited<
      ReturnType<ProductPublicService['getRelatedProducts']>
    >,
  ) {
    const baseProduct = this.toRecord(relatedResult.baseProduct);
    const related = Array.isArray(relatedResult.related)
      ? relatedResult.related.map((item) => this.toRecord(item))
      : [];

    return {
      baseProduct: {
        id: this.getString(baseProduct.id),
        name:
          this.sanitizeCustomerText(this.getString(baseProduct.name)) ??
          'محصول',
        slug: this.getString(baseProduct.slug),
        sku: this.getString(baseProduct.sku),
        brand: this.toRecord(baseProduct.brand),
        category: this.toRecord(baseProduct.category),
        productType: this.toRecord(baseProduct.productType),
        productModel: this.toRecord(baseProduct.productModel),
        pricing: this.toRecord(baseProduct.pricing),
        stock: this.toRecord(baseProduct.stock),
      },
      related: related.map((item) => ({
        id: this.getString(item.id),
        name:
          this.sanitizeCustomerText(this.getString(item.name)) ??
          this.getString(item.slug),
        slug: this.getString(item.slug),
        sku: this.getString(item.sku),
        brand: this.toRecord(item.brand),
        category: this.toRecord(item.category),
        productType: this.toRecord(item.productType),
        productModel: this.toRecord(item.productModel),
        pricing: this.toRecord(item.pricing),
        stock: this.toRecord(item.stock),
        similarityScore: this.toNumber(item.similarityScore),
        reasons: this.getStringArray(item.reasons),
      })),
      meta: this.toRecord(relatedResult.meta),
    };
  }

  private buildRelatedRecommendationMessages(
    context: ReturnType<
      ProductPublicService['buildRelatedRecommendationContext']
    >,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای پیشنهاد محصول مرتبط فروشگاه وکسو بیوتی هستی.',
          'فقط از context عمومی استفاده کن و هیچ داده داخلی، مالی عملیاتی یا audit داخلی را حدس نزن یا افشا نکن.',
          'اگر محصول مرتبطی وجود ندارد، شفاف بگو و پیشنهاد بده کاربر از جستجو یا فیلترهای سایت استفاده کند.',
          'پاسخ فارسی، کوتاه، کاربردی و مناسب فروشگاه باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: JSON.stringify(context),
      },
    ];
  }

  private buildDeterministicRelatedRecommendationAnswer(
    context: ReturnType<
      ProductPublicService['buildRelatedRecommendationContext']
    >,
  ) {
    const baseName = context.baseProduct.name;

    if (context.related.length === 0) {
      return `برای «${baseName}» در حال حاضر محصول مرتبط فعال دیگری پیدا نشد. برای انتخاب بهتر می‌توانید جستجو را با نام برند، دسته‌بندی یا نوع محصول ادامه دهید.`;
    }

    const lines = [`برای «${baseName}» این گزینه‌های مرتبط قابل بررسی هستند:`];

    for (const item of context.related.slice(0, 3)) {
      const pricing = this.toRecord(item.pricing);
      const stock = this.toRecord(item.stock);
      const displayPrice = this.getString(pricing.displayPrice);
      const inStock = this.getBoolean(stock.inStock) === true;
      const reasons =
        item.reasons.length > 0
          ? ` دلیل ارتباط: ${item.reasons.join('، ')}.`
          : '';
      const priceText = displayPrice
        ? ` قیمت قابل نمایش: ${displayPrice} ریال.`
        : '';
      const stockText = inStock
        ? ' موجود است.'
        : ' موجودی قابل فروش ثبت نشده است.';

      lines.push(
        `- ${item.name ?? item.slug}.${reasons}${priceText}${stockText}`,
      );
    }

    lines.push(
      'برای تصمیم دقیق‌تر، صفحه هر محصول و مشخصات عمومی آن را بررسی کنید.',
    );

    return lines.join('\n');
  }

  private buildRelatedReasons(base: PublicProductRow, row: PublicProductRow) {
    const reasons: string[] = [];

    if (
      row.product_model_id &&
      row.product_model_id === base.product_model_id
    ) {
      reasons.push('مدل مشترک');
    }

    if (row.product_type_id && row.product_type_id === base.product_type_id) {
      reasons.push('نوع محصول مشترک');
    }

    if (row.category_id === base.category_id) {
      reasons.push('دسته‌بندی مشترک');
    }

    if (row.brand_id === base.brand_id) {
      reasons.push('برند مشترک');
    }

    if (this.buildPublicStock(row).inStock) {
      reasons.push('موجود');
    }

    if (this.buildPublicPricing(row).hasDiscount) {
      reasons.push('دارای تخفیف');
    }

    return reasons.slice(0, 6);
  }

  private buildSalesAdvisorMessages(
    context: Awaited<
      ReturnType<ProductPublicService['getSalesAdvisorContext']>
    >,
    dto: ProductSalesAdvisorQuestionDto,
  ) {
    const compactContext = this.buildCompactSalesAdvisorContext(context);

    return [
      {
        role: 'system' as const,
        content: [
          'تو مشاور فروش فارسی فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس context مجاز محصول پاسخ بده.',
          'اگر اطلاعات لازم در context وجود ندارد، صریح و کوتاه بگو که این اطلاعات برای محصول ثبت نشده است.',
          'هیچ داده داخلی مالی، عملیاتی، audit، تأیید ادمین، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'توصیه پزشکی یا درمانی قطعی نده و ادعای تاییدنشده نساز.',
          'پاسخ باید فارسی، دقیق، فروش‌محور و قابل نمایش به مشتری باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `سؤال مشتری: ${dto.question}`,
          '',
          'context مجاز محصول:',
          JSON.stringify(compactContext, null, 2),
          '',
          'با تکیه بر همین داده‌ها پاسخ بده. قیمت فقط از pricing مجاز استفاده شود.',
        ].join('\n'),
      },
    ];
  }

  private buildCompactSalesAdvisorContext(
    context: Awaited<
      ReturnType<ProductPublicService['getSalesAdvisorContext']>
    >,
  ) {
    return {
      product: {
        name: context.name,
        slug: context.slug,
        sku: context.sku,
        brand: context.brand?.name ?? null,
        category: context.category?.name ?? null,
        productType: context.productType?.name ?? null,
        productModel: context.productModel?.name ?? null,
        modelCode: context.productModel?.modelCode ?? null,
      },
      descriptions: {
        shortDescription: context.shortDescription,
        description: context.description,
      },
      pricing: context.pricing,
      stock: context.stock,
      attributes: context.attributes.map((attribute) => ({
        code: attribute.code,
        label: attribute.label,
        value: attribute.value,
        unit: attribute.unit,
      })),
      salesFacts: context.salesFacts,
      media: {
        primaryImageUrl: context.media.primaryImage?.url ?? null,
        imageCount: context.media.images.length,
        videoCount: context.media.videos.length,
      },
      rules: {
        dataScope: 'فقط اطلاعات عمومی محصول و فکت‌های مجاز فروش',
        doNotGuess: true,
        customerVisibleOnly: true,
      },
    };
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    reason: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(reason)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private normalizeAdvisorAnswer(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .replace(/```(?:json|markdown|text)?/gi, '')
      .replace(/```/g, '')
      .trim();
  }

  private hasAdvisorSensitiveLeak(value: string): boolean {
    return /purchasePrice|minAllowedPrice|grossMarginAmount|grossMarginPercent|reservedQuantity|aiQualityAudit|appliedBy|approvalReason|قیمت\s*خرید|حاشیه\s*سود|حداقل\s*قیمت\s*مجاز|رزرو\s*موجودی/i.test(
      value,
    );
  }

  private buildDeterministicSalesAnswer(
    context: Awaited<
      ReturnType<ProductPublicService['getSalesAdvisorContext']>
    >,
    question: string,
  ): string {
    const parts: string[] = [];
    const productName = context.name;
    const brandName = context.brand?.name;
    const modelName = context.productModel?.name;
    const finalPrice =
      context.pricing?.displayPrice ??
      context.pricing?.finalPrice ??
      context.pricing?.salePrice;
    const availableStock = Number(context.stock?.availableStock ?? 0);

    parts.push(
      `${productName} ${brandName ? `از برند ${brandName}` : ''}${modelName ? `، مدل ${modelName}` : ''} در حال حاضر برای مشاوره فروش آماده است.`.trim(),
    );

    if (finalPrice) {
      parts.push(
        `قیمت قابل نمایش فعلی ${finalPrice} ریال است${context.pricing?.hasDiscount ? ' و برای محصول تخفیف فعال شده است' : ''}.`,
      );
    }

    if (availableStock > 0) {
      parts.push(`موجودی قابل فروش محصول ${availableStock} عدد است.`);
    } else {
      parts.push('در حال حاضر موجودی قابل فروش برای این محصول ثبت نشده است.');
    }

    const countryOfOrigin = this.sanitizeCustomerText(
      this.getString(context.salesFacts?.countryOfOrigin),
    );
    const warranty = this.sanitizeCustomerText(
      this.getString(context.salesFacts?.warranty),
    );
    const usageMethod = this.sanitizeCustomerText(
      this.getString(context.salesFacts?.usageMethod),
    );

    if (countryOfOrigin) {
      parts.push(`کشور سازنده: ${countryOfOrigin}.`);
    }

    if (warranty) {
      parts.push(`وضعیت گارانتی: ${warranty}.`);
    }

    if (usageMethod) {
      parts.push(`نحوه استفاده: ${usageMethod}`);
    }

    const sellingPoints = context.salesFacts?.sellingPoints ?? [];

    if (sellingPoints.length > 0) {
      parts.push(`نکات فروش مهم: ${sellingPoints.slice(0, 3).join('، ')}.`);
    }

    if (
      /مناسب|برای من|پیشنهاد|بخر|خرید|ارزش|گارانتی|استفاده|کشور|موجود|قیمت/.test(
        question,
      )
    ) {
      parts.push(
        'برای تصمیم نهایی، بهتر است نیاز مشتری با همین مشخصات، وضعیت گارانتی، موجودی و قیمت قابل نمایش تطبیق داده شود.',
      );
    }

    return parts.join('\n');
  }

  private buildSearchAssistantContext(
    query: string,
    suggestions: unknown[],
    facets: unknown,
  ) {
    const safeSuggestions = suggestions.slice(0, 8).map((item) => {
      const record = this.toRecord(item);
      const pricing = this.toRecord(record.pricing);
      const stock = this.toRecord(record.stock);
      const brand = this.toRecord(record.brand);
      const category = this.toRecord(record.category);
      const productType = this.toRecord(record.productType);
      const productModel = this.toRecord(record.productModel);

      return {
        type: this.getString(record.type) ?? 'PRODUCT',
        label:
          this.sanitizeCustomerText(this.getString(record.label)) ??
          this.getString(record.slug),
        slug: this.getString(record.slug),
        sku: this.getString(record.sku),
        brand: this.sanitizeCustomerText(this.getString(brand.name)),
        category: this.sanitizeCustomerText(this.getString(category.name)),
        productType: this.sanitizeCustomerText(
          this.getString(productType.name),
        ),
        productModel: this.sanitizeCustomerText(
          this.getString(productModel.name),
        ),
        displayPrice: this.getString(pricing.displayPrice),
        hasDiscount: this.getBoolean(pricing.hasDiscount) ?? false,
        availableStock: this.toNumber(stock.availableStock),
        inStock: this.getBoolean(stock.inStock) ?? false,
      };
    });

    return {
      query,
      suggestions: safeSuggestions,
      facets,
      resultCount: safeSuggestions.length,
    };
  }

  private buildSearchAssistantMessages(
    context: ReturnType<ProductPublicService['buildSearchAssistantContext']>,
  ) {
    return [
      {
        role: 'system' as const,
        content: [
          'تو راهنمای جستجوی فارسی فروشگاه وکسو بیوتی هستی.',
          'فقط بر اساس نتایج عمومی و facetهای امن پاسخ بده.',
          'اگر نتیجه‌ای وجود ندارد، صریح بگو محصول مرتبط پیدا نشد و پیشنهاد بده عبارت دقیق‌تر وارد شود.',
          'هیچ داده داخلی مالی، عملیاتی، audit، تأیید ادمین، منطق تخفیف یا اطلاعات رزرو/انبار داخلی را بیان نکن.',
          'پاسخ کوتاه، کاربردی و مناسب UI جستجوی فروشگاه باشد.',
        ].join('\n'),
      },
      {
        role: 'user' as const,
        content: [
          `عبارت جستجو: ${context.query}`,
          '',
          'context عمومی جستجو:',
          JSON.stringify(context, null, 2),
          '',
          'بر اساس همین داده‌ها، یک راهنمای کوتاه برای مشتری تولید کن و حداکثر سه محصول مرتبط را معرفی کن.',
        ].join('\n'),
      },
    ];
  }

  private buildDeterministicSearchAssistantAnswer(
    context: ReturnType<ProductPublicService['buildSearchAssistantContext']>,
  ): string {
    const suggestions = context.suggestions;

    if (suggestions.length === 0) {
      return `برای عبارت «${context.query}» محصول مرتبطی در نتایج عمومی پیدا نشد. عبارت جستجو را دقیق‌تر وارد کنید یا از نام برند، نوع محصول یا مدل استفاده کنید.`;
    }

    const parts: string[] = [];
    parts.push(
      `برای عبارت «${context.query}» ${suggestions.length} پیشنهاد مرتبط پیدا شد.`,
    );

    const topItems = suggestions.slice(0, 3).map((item, index) => {
      const priceText = item.displayPrice
        ? ` قیمت قابل نمایش: ${item.displayPrice} ریال.`
        : '';
      const stockText = item.inStock
        ? ` موجودی قابل فروش: ${item.availableStock} عدد.`
        : ' در حال حاضر موجودی قابل فروش ثبت نشده است.';
      const discountText = item.hasDiscount
        ? ' این محصول تخفیف فعال دارد.'
        : '';
      const brandText = item.brand ? ` برند: ${item.brand}.` : '';
      const modelText = item.productModel ? ` مدل: ${item.productModel}.` : '';

      return `${index + 1}. ${item.label ?? item.slug}.${brandText}${modelText}${priceText}${stockText}${discountText}`;
    });

    parts.push(...topItems);
    parts.push(
      'برای انتخاب بهتر، فیلترهای برند، دسته‌بندی، موجودی و بازه قیمت را هم بررسی کنید.',
    );

    return parts.join('\n');
  }

  private async findPublicCategoryBySlug(
    slug: string,
  ): Promise<PublicCategoryLandingRow> {
    const normalizedSlug = this.normalizeRequiredSlug(
      slug,
      'شناسه دسته‌بندی نامعتبر است.',
    );

    const rows = await this.prisma.$queryRaw<
      PublicCategoryLandingRow[]
    >(Prisma.sql`
      SELECT
        c."id",
        c."name",
        c."slug",
        c."description",
        c."seoTitle" AS seo_title,
        c."seoDescription" AS seo_description,
        c."image",
        c."iconUrl" AS icon_url,
        c."sortOrder" AS sort_order,
        c."createdAt" AS created_at,
        c."updatedAt" AS updated_at
      FROM "Category" c
      WHERE c."slug" = ${normalizedSlug}
        AND c."isActive" = true
        AND c."deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('دسته‌بندی موردنظر پیدا نشد.');
    }

    return rows[0];
  }

  private async findPublicBrandBySlug(
    slug: string,
  ): Promise<PublicBrandLandingRow> {
    const normalizedSlug = this.normalizeRequiredSlug(
      slug,
      'شناسه برند نامعتبر است.',
    );

    const rows = await this.prisma.$queryRaw<
      PublicBrandLandingRow[]
    >(Prisma.sql`
      SELECT
        b."id",
        b."name",
        b."slug",
        b."description",
        b."seoTitle" AS seo_title,
        b."seoDescription" AS seo_description,
        b."logoUrl" AS logo_url,
        b."country",
        b."createdAt" AS created_at,
        b."updatedAt" AS updated_at
      FROM "Brand" b
      WHERE b."slug" = ${normalizedSlug}
        AND b."isActive" = true
        AND b."deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('برند موردنظر پیدا نشد.');
    }

    return rows[0];
  }

  private async findPublicProductTypeBySlug(
    slug: string,
  ): Promise<PublicProductTypeLandingRow> {
    const normalizedSlug = this.normalizeRequiredSlug(
      slug,
      'شناسه نوع محصول نامعتبر است.',
    );

    const rows = await this.prisma.$queryRaw<
      PublicProductTypeLandingRow[]
    >(Prisma.sql`
      SELECT
        pt."id",
        pt."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        pt."name",
        pt."slug",
        pt."description",
        pt."seoTitle" AS seo_title,
        pt."seoDescription" AS seo_description,
        pt."sortOrder" AS sort_order,
        pt."createdAt" AS created_at,
        pt."updatedAt" AS updated_at
      FROM "ProductType" pt
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE pt."slug" = ${normalizedSlug}
        AND pt."isActive" = true
        AND pt."deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('نوع محصول موردنظر پیدا نشد.');
    }

    return rows[0];
  }

  private async findPublicProductModelBySlug(
    slug: string,
  ): Promise<PublicProductModelLandingRow> {
    const normalizedSlug = this.normalizeRequiredSlug(
      slug,
      'شناسه مدل محصول نامعتبر است.',
    );

    const rows = await this.prisma.$queryRaw<
      PublicProductModelLandingRow[]
    >(Prisma.sql`
      SELECT
        pm."id",
        pm."brandId" AS brand_id,
        b."name" AS brand_name,
        b."slug" AS brand_slug,
        pm."productTypeId" AS product_type_id,
        pt."name" AS product_type_name,
        pt."slug" AS product_type_slug,
        pt."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        pm."name",
        pm."slug",
        pm."modelCode" AS model_code,
        pm."description",
        pm."titlePattern" AS title_pattern,
        pm."seoPattern" AS seo_pattern,
        pm."sortOrder" AS sort_order,
        pm."createdAt" AS created_at,
        pm."updatedAt" AS updated_at
      FROM "ProductModel" pm
      LEFT JOIN "Brand" b ON b."id" = pm."brandId"
      LEFT JOIN "ProductType" pt ON pt."id" = pm."productTypeId"
      LEFT JOIN "Category" c ON c."id" = pt."categoryId"
      WHERE pm."slug" = ${normalizedSlug}
        AND pm."isActive" = true
        AND pm."deleted_at" IS NULL
      LIMIT 1
    `);

    if (!rows[0]) {
      throw new NotFoundException('مدل محصول موردنظر پیدا نشد.');
    }

    return rows[0];
  }

  private mapPublicCategoryLanding(
    row: PublicCategoryLandingRow,
  ): Record<string, unknown> {
    return {
      id: row.id,
      name: this.sanitizeCustomerText(row.name) ?? row.slug,
      slug: row.slug,
      description: this.sanitizeCustomerText(row.description),
      seo: {
        title: this.sanitizeCustomerText(row.seo_title ?? row.name) ?? row.slug,
        description: this.sanitizeCustomerText(
          row.seo_description ?? row.description,
        ),
      },
      media: {
        image: this.sanitizeCustomerText(row.image),
        iconUrl: this.sanitizeCustomerText(row.icon_url),
      },
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapPublicBrandLanding(
    row: PublicBrandLandingRow,
  ): Record<string, unknown> {
    return {
      id: row.id,
      name: this.sanitizeCustomerText(row.name) ?? row.slug,
      slug: row.slug,
      description: this.sanitizeCustomerText(row.description),
      seo: {
        title: this.sanitizeCustomerText(row.seo_title ?? row.name) ?? row.slug,
        description: this.sanitizeCustomerText(
          row.seo_description ?? row.description,
        ),
      },
      media: {
        logoUrl: this.sanitizeCustomerText(row.logo_url),
      },
      country: this.sanitizeCustomerText(row.country),
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapPublicProductTypeLanding(
    row: PublicProductTypeLandingRow,
  ): Record<string, unknown> {
    return {
      id: row.id,
      name: this.sanitizeCustomerText(row.name) ?? row.slug,
      slug: row.slug,
      description: this.sanitizeCustomerText(row.description),
      seo: {
        title: this.sanitizeCustomerText(row.seo_title ?? row.name) ?? row.slug,
        description: this.sanitizeCustomerText(
          row.seo_description ?? row.description,
        ),
      },
      category: {
        id: row.category_id,
        name: this.sanitizeCustomerText(row.category_name),
        slug: row.category_slug,
      },
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapPublicProductModelLanding(
    row: PublicProductModelLandingRow,
  ): Record<string, unknown> {
    return {
      id: row.id,
      name: this.sanitizeCustomerText(row.name) ?? row.slug,
      slug: row.slug,
      modelCode: this.sanitizeCustomerText(row.model_code),
      description: this.sanitizeCustomerText(row.description),
      seo: {
        title:
          this.sanitizeCustomerText(row.title_pattern ?? row.name) ?? row.slug,
        description: this.sanitizeCustomerText(
          row.seo_pattern ?? row.description,
        ),
      },
      brand: {
        id: row.brand_id,
        name: this.sanitizeCustomerText(row.brand_name),
        slug: row.brand_slug,
      },
      productType: {
        id: row.product_type_id,
        name: this.sanitizeCustomerText(row.product_type_name),
        slug: row.product_type_slug,
      },
      category: {
        id: row.category_id,
        name: this.sanitizeCustomerText(row.category_name),
        slug: row.category_slug,
      },
      sortOrder: row.sort_order ?? 0,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private normalizeSitemapLimit(limit?: string): number {
    const numeric = Number(limit ?? 200);

    if (!Number.isFinite(numeric)) {
      return 200;
    }

    return Math.min(Math.max(Math.trunc(numeric), 1), 1000);
  }

  private removeUndefinedValues<T extends Record<string, unknown>>(
    value: T,
  ): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
  }

  private normalizeRequiredSlug(
    value: string | undefined,
    message: string,
  ): string {
    const slug = typeof value === 'string' ? value.trim() : '';

    if (!slug || slug.length > 180) {
      throw new BadRequestException(message);
    }

    return slug;
  }

  private async findPublicProductRow(
    identifier: string,
  ): Promise<PublicProductRow> {
    const rows = await this.prisma.$queryRaw<PublicProductRow[]>(Prisma.sql`
      SELECT
        p."id",
        p."name",
        p."slug",
        p."description",
        p."shortDescription" AS short_description,
        p."seoTitle" AS seo_title,
        p."seoDescription" AS seo_description,
        p."canonicalUrl" AS canonical_url,
        p."schemaJson" AS schema_json,
        p."brandId" AS brand_id,
        b."name" AS brand_name,
        b."slug" AS brand_slug,
        p."categoryId" AS category_id,
        c."name" AS category_name,
        c."slug" AS category_slug,
        p."productTypeId" AS product_type_id,
        pt."name" AS product_type_name,
        pt."slug" AS product_type_slug,
        p."productModelId" AS product_model_id,
        pm."name" AS product_model_name,
        pm."slug" AS product_model_slug,
        pm."modelCode" AS product_model_code,
        p."sku",
        p."price",
        p."comparePrice" AS compare_price,
        p."salePrice" AS sale_price,
        p."discountPercent" AS discount_percent,
        p."finalPrice" AS final_price,
        p."weight",
        p."dimensions",
        p."isActive" AS is_active,
        p."status",
        p."viewCount" AS view_count,
        p."reviewCount" AS review_count,
        p."averageRating" AS average_rating,
        COALESCE(stock.available_stock, 0)::int AS available_stock,
        stock.low_stock_threshold AS low_stock_threshold,
        p."createdAt" AS created_at,
        p."updatedAt" AS updated_at
      FROM "Product" p
      LEFT JOIN "Brand" b ON b."id" = p."brandId"
      LEFT JOIN "Category" c ON c."id" = p."categoryId"
      LEFT JOIN "ProductType" pt ON pt."id" = p."productTypeId"
      LEFT JOIN "ProductModel" pm ON pm."id" = p."productModelId"
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            SUM(
              GREATEST(
                COALESCE(i."quantity", 0) - COALESCE(i."reservedQuantity", 0),
                0
              )
            ),
            0
          ) AS available_stock,
          MIN(i."lowStockThreshold") AS low_stock_threshold
        FROM "ProductVariant" pv
        LEFT JOIN "Inventory" i ON i."variantId" = pv."id"
        WHERE pv."productId" = p."id"
          AND pv."deleted_at" IS NULL
          AND pv."isActive" = true
      ) stock ON true
      WHERE p."deleted_at" IS NULL
        AND p."isActive" = true
        AND p."status"::text = 'ACTIVE'
        AND (
          p."id" = ${identifier}
          OR p."slug" = ${identifier}
          OR p."sku" = ${identifier}
        )
      LIMIT 1
    `);

    const product = rows[0];

    if (!product) {
      throw new NotFoundException(
        'محصول موردنظر یافت نشد یا برای نمایش عمومی فعال نیست.',
      );
    }

    return product;
  }

  private async getImages(productId: string) {
    const rows = await this.prisma.$queryRaw<
      PublicProductImageRow[]
    >(Prisma.sql`
      SELECT
        "id",
        "productId" AS product_id,
        "type",
        "url",
        "thumbnailUrl" AS thumbnail_url,
        "altText" AS alt_text,
        "title",
        "caption",
        "mimeType" AS mime_type,
        "width",
        "height",
        "duration",
        "sortOrder" AS sort_order,
        "isPrimary" AS is_primary,
        "createdAt" AS created_at,
        "updatedAt" AS updated_at
      FROM "ProductImage"
      WHERE "productId" = ${productId}
        AND "isActive" = true
      ORDER BY "isPrimary" DESC, "sortOrder" ASC, "createdAt" ASC
    `);

    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      type: row.type,
      url: row.url,
      thumbnailUrl: row.thumbnail_url,
      altText: this.sanitizeCustomerText(this.nullIfDamaged(row.alt_text)),
      title: this.sanitizeCustomerText(this.nullIfDamaged(row.title)),
      caption: this.sanitizeCustomerText(this.nullIfDamaged(row.caption)),
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      duration: row.duration,
      sortOrder: row.sort_order,
      isPrimary: row.is_primary,
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    }));
  }

  private async getAttributes(productId: string) {
    const rows = await this.prisma.$queryRaw<
      PublicProductAttributeRow[]
    >(Prisma.sql`
      SELECT
        a."id" AS attribute_id,
        a."code",
        a."name",
        a."label",
        a."description",
        a."dataType"::text AS data_type,
        a."inputType"::text AS input_type,
        a."unit",
        a."isFilterable" AS is_filterable,
        a."isComparable" AS is_comparable,
        a."isSeoImportant" AS is_seo_important,
        a."isAiImportant" AS is_ai_important,
        a."sortOrder" AS sort_order,
        av."id" AS attribute_value_id,
        av."value" AS predefined_value,
        pa."valueText" AS value_text,
        pa."valueNumber" AS value_number,
        pa."valueBoolean" AS value_boolean,
        pa."valueJson" AS value_json,
        pa."unit" AS value_unit
      FROM "ProductAttribute" pa
      LEFT JOIN "Attribute" a ON a."id" = pa."attributeId"
      LEFT JOIN "AttributeValue" av ON av."id" = pa."attributeValueId"
      WHERE pa."productId" = ${productId}
        AND (a."deleted_at" IS NULL OR a."id" IS NULL)
        AND (a."isActive" = true OR a."id" IS NULL)
      ORDER BY a."sortOrder" ASC NULLS LAST, a."name" ASC NULLS LAST
    `);

    return rows.map((row) => {
      const value = this.resolveAttributeValue(row);

      return {
        attributeId: row.attribute_id,
        code: row.code,
        name: this.sanitizeCustomerText(row.name),
        label:
          this.sanitizeCustomerText(row.label) ??
          this.sanitizeCustomerText(row.name),
        description: this.sanitizeCustomerText(row.description),
        dataType: row.data_type,
        inputType: row.input_type,
        value: this.sanitizeAttributeValue(value),
        valueText: this.sanitizeCustomerText(
          row.value_text ?? row.predefined_value,
        ),
        valueNumber: this.toNullableDecimalString(row.value_number),
        valueBoolean: row.value_boolean,
        valueJson: row.value_json,
        unit: this.sanitizeCustomerText(row.value_unit ?? row.unit),
        isFilterable: row.is_filterable ?? false,
        isComparable: row.is_comparable ?? false,
        isSeoImportant: row.is_seo_important ?? false,
        isAiImportant: row.is_ai_important ?? false,
        sortOrder: row.sort_order ?? 0,
      };
    });
  }

  private mapListProduct(row: PublicProductRow) {
    const pricing = this.buildPublicPricing(row);

    return {
      id: row.id,
      name: this.sanitizeCustomerText(this.nullIfDamaged(row.name)) ?? row.slug,
      slug: row.slug,
      shortDescription: this.sanitizeCustomerText(row.short_description),
      brand: {
        id: row.brand_id,
        name: this.sanitizeCustomerText(row.brand_name),
        slug: row.brand_slug,
      },
      category: {
        id: row.category_id,
        name: this.sanitizeCustomerText(row.category_name),
        slug: row.category_slug,
      },
      productType: {
        id: row.product_type_id,
        name: this.sanitizeCustomerText(row.product_type_name),
        slug: row.product_type_slug,
      },
      productModel: {
        id: row.product_model_id,
        name: this.sanitizeCustomerText(row.product_model_name),
        slug: row.product_model_slug,
        modelCode: this.sanitizeCustomerText(row.product_model_code),
      },
      sku: row.sku,
      pricing,
      stock: this.buildPublicStock(row),
      primaryImage: row.primary_image_url
        ? {
            url: row.primary_image_url,
            altText: this.sanitizeCustomerText(row.primary_image_alt),
          }
        : null,
      rating: {
        average: this.toNullableDecimalString(row.average_rating),
        reviewCount: this.toNumber(row.review_count),
      },
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private mapProductPage(
    row: PublicProductRow,
    images: ReturnType<ProductPublicService['getImages']> extends Promise<
      infer T
    >
      ? T
      : never,
    attributes: ReturnType<
      ProductPublicService['getAttributes']
    > extends Promise<infer T>
      ? T
      : never,
  ) {
    const safeSeo = this.extractSafeSeo(row);
    const safeAiContent = this.extractSafeAiContent(row.dimensions);
    const imageItems = images.filter(
      (image) => image.type === ProductMediaType.IMAGE,
    );
    const videoItems = images.filter(
      (image) => image.type === ProductMediaType.VIDEO,
    );
    const primaryImage =
      imageItems.find((image) => image.isPrimary) ?? imageItems[0] ?? null;

    return {
      id: row.id,
      name: this.sanitizeCustomerText(this.nullIfDamaged(row.name)) ?? row.slug,
      slug: row.slug,
      description: this.sanitizeCustomerText(row.description),
      shortDescription: this.sanitizeCustomerText(row.short_description),
      seo: safeSeo,
      brand: {
        id: row.brand_id,
        name: this.sanitizeCustomerText(row.brand_name),
        slug: row.brand_slug,
      },
      category: {
        id: row.category_id,
        name: this.sanitizeCustomerText(row.category_name),
        slug: row.category_slug,
      },
      productType: {
        id: row.product_type_id,
        name: this.sanitizeCustomerText(row.product_type_name),
        slug: row.product_type_slug,
      },
      productModel: {
        id: row.product_model_id,
        name: this.sanitizeCustomerText(row.product_model_name),
        slug: row.product_model_slug,
        modelCode: this.sanitizeCustomerText(row.product_model_code),
      },
      sku: row.sku,
      pricing: this.buildPublicPricing(row),
      weight: row.weight,
      stock: this.buildPublicStock(row),
      content: safeAiContent,
      media: {
        primaryImage,
        images: imageItems,
        videos: videoItems,
      },
      attributes,
      rating: {
        average: this.toNullableDecimalString(row.average_rating),
        reviewCount: this.toNumber(row.review_count),
      },
      createdAt: row.created_at.toISOString(),
      createdAtFa: this.formatDateTimeFa(row.created_at),
      updatedAt: row.updated_at.toISOString(),
      updatedAtFa: this.formatDateTimeFa(row.updated_at),
    };
  }

  private buildPublicPricing(row: PublicProductRow) {
    const regularPrice = this.toDecimalString(row.price);
    const salePrice = this.toNullableDecimalString(row.sale_price);
    const finalPrice = this.toNullableDecimalString(row.final_price);
    const comparePrice = this.toNullableDecimalString(row.compare_price);
    const discountPercent = this.toNullableDecimalString(row.discount_percent);
    const displayPrice = finalPrice ?? salePrice ?? regularPrice;

    return {
      currency: 'IRR',
      regularPrice,
      salePrice,
      finalPrice,
      displayPrice,
      comparePrice,
      discountPercent,
      hasDiscount: this.hasPositiveDiscount(
        regularPrice,
        displayPrice,
        comparePrice,
        discountPercent,
      ),
    };
  }

  private buildPublicStock(row: PublicProductRow) {
    const availableStock = this.toNumber(row.available_stock);
    const lowStockThreshold = this.toNumber(row.low_stock_threshold);

    return {
      availableStock,
      inStock: availableStock > 0,
      isLowStock:
        availableStock > 0 &&
        lowStockThreshold > 0 &&
        availableStock <= lowStockThreshold,
      isOutOfStock: availableStock <= 0,
    };
  }

  private buildAttributeMap(
    attributes: Awaited<ReturnType<ProductPublicService['getAttributes']>>,
  ) {
    const result: Record<string, unknown> = {};

    for (const attribute of attributes) {
      if (attribute.code) {
        result[attribute.code] = attribute.value;
      }
    }

    return result;
  }

  private extractSafeSeo(row: PublicProductRow) {
    const dimensions = this.toRecord(row.dimensions);
    const seo = this.toRecord(dimensions.seo);

    return {
      title:
        this.sanitizeCustomerText(
          row.seo_title ?? this.getString(seo.metaTitle),
        ) ??
        this.sanitizeCustomerText(row.name) ??
        row.slug,
      description: this.sanitizeCustomerText(
        row.seo_description ??
          this.getString(seo.metaDescription) ??
          row.short_description,
      ),
      canonicalUrl: row.canonical_url,
      keywords: this.getStringArray(seo.keywords),
      ogTitle: this.sanitizeCustomerText(this.getString(seo.ogTitle)),
      ogDescription: this.sanitizeCustomerText(
        this.getString(seo.ogDescription),
      ),
      noIndex: this.getBoolean(seo.noIndex) ?? false,
      noFollow: this.getBoolean(seo.noFollow) ?? false,
      schemaJson: row.schema_json,
    };
  }

  private extractSafeAiContent(dimensionsValue: unknown) {
    const dimensions = this.toRecord(dimensionsValue);
    const aiContent = this.toRecord(dimensions.aiContent);

    return {
      sellingPoints: this.sanitizeCustomerStringArray(aiContent.sellingPoints),
      faq: this.sanitizeFaq(aiContent.faq),
      adCopy: this.sanitizeCustomerText(this.getString(aiContent.adCopy)),
    };
  }

  private resolveAttributeValue(row: PublicProductAttributeRow) {
    if (row.value_text !== null && row.value_text !== undefined) {
      return row.value_text;
    }

    if (row.predefined_value !== null && row.predefined_value !== undefined) {
      return row.predefined_value;
    }

    if (row.value_number !== null && row.value_number !== undefined) {
      return this.toDecimalString(row.value_number);
    }

    if (row.value_boolean !== null && row.value_boolean !== undefined) {
      return row.value_boolean;
    }

    if (row.value_json !== null && row.value_json !== undefined) {
      return row.value_json;
    }

    return null;
  }

  private mapPublicFacet(row: PublicFacetRow) {
    return {
      id: row.id,
      name: this.sanitizeCustomerText(this.nullIfDamaged(row.name)) ?? row.slug,
      slug: row.slug,
      count: this.toNumber(row.count),
    };
  }

  private normalizeSearchQuery(value?: string): string | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().replace(/\s+/g, ' ');

    return normalized.length >= 2 ? normalized.slice(0, 120) : null;
  }

  private normalizeSuggestionLimit(value?: string | number): number {
    const numeric = Number(value ?? 8);

    if (!Number.isFinite(numeric)) {
      return 8;
    }

    return Math.min(12, Math.max(3, Math.trunc(numeric)));
  }

  private normalizeNavigationLimit(value?: string | number): number {
    void value;
    return 100;
  }

  private buildPublicWhereSql(query: QueryProductDto): Prisma.Sql {
    const queryRecord = query as QueryProductDto & {
      productTypeId?: string;
      productTypeSlug?: string;
      productModelId?: string;
      productModelSlug?: string;
    };
    const conditions: Prisma.Sql[] = [
      Prisma.sql`p."deleted_at" IS NULL`,
      Prisma.sql`p."isActive" = true`,
      Prisma.sql`p."status"::text = 'ACTIVE'`,
    ];

    if (query.q) {
      conditions.push(Prisma.sql`
        (
          p."name" ILIKE ${`%${query.q}%`}
          OR p."sku" ILIKE ${`%${query.q}%`}
          OR p."description" ILIKE ${`%${query.q}%`}
          OR p."shortDescription" ILIKE ${`%${query.q}%`}
          OR b."name" ILIKE ${`%${query.q}%`}
          OR c."name" ILIKE ${`%${query.q}%`}
        )
      `);
    }

    if (query.brandId) {
      conditions.push(Prisma.sql`p."brandId" = ${query.brandId}`);
    }

    if (query.brandSlug) {
      conditions.push(Prisma.sql`b."slug" = ${query.brandSlug}`);
    }

    if (query.categoryId) {
      conditions.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
    }

    if (query.categorySlug) {
      conditions.push(Prisma.sql`c."slug" = ${query.categorySlug}`);
    }

    if (queryRecord.productTypeId) {
      conditions.push(
        Prisma.sql`p."productTypeId" = ${queryRecord.productTypeId}`,
      );
    }

    if (queryRecord.productTypeSlug) {
      conditions.push(Prisma.sql`pt."slug" = ${queryRecord.productTypeSlug}`);
    }

    if (queryRecord.productModelId) {
      conditions.push(
        Prisma.sql`p."productModelId" = ${queryRecord.productModelId}`,
      );
    }

    if (queryRecord.productModelSlug) {
      conditions.push(Prisma.sql`pm."slug" = ${queryRecord.productModelSlug}`);
    }

    if (query.minPrice !== undefined) {
      conditions.push(
        Prisma.sql`COALESCE(p."finalPrice", p."salePrice", p."price") >= ${query.minPrice}`,
      );
    }

    if (query.maxPrice !== undefined) {
      conditions.push(
        Prisma.sql`COALESCE(p."finalPrice", p."salePrice", p."price") <= ${query.maxPrice}`,
      );
    }

    if (query.minRating !== undefined) {
      conditions.push(Prisma.sql`p."averageRating" >= ${query.minRating}`);
    }

    if (query.inStock === true) {
      conditions.push(Prisma.sql`COALESCE(stock.available_stock, 0) > 0`);
    }

    if (query.inStock === false) {
      conditions.push(Prisma.sql`COALESCE(stock.available_stock, 0) <= 0`);
    }

    if (query.hasDiscount === true) {
      conditions.push(Prisma.sql`
        (
          COALESCE(p."discountPercent", 0) > 0
          OR (
            p."comparePrice" IS NOT NULL
            AND p."comparePrice" > COALESCE(p."finalPrice", p."salePrice", p."price")
          )
        )
      `);
    }

    if (query.hasDiscount === false) {
      conditions.push(Prisma.sql`
        COALESCE(p."discountPercent", 0) <= 0
      `);
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  private buildOrderSql(sort?: QueryProductDto['sort']): Prisma.Sql {
    if (sort === 'oldest') {
      return Prisma.sql`ORDER BY p."createdAt" ASC, p."id" ASC`;
    }

    if (sort === 'price_asc') {
      return Prisma.sql`ORDER BY COALESCE(p."finalPrice", p."salePrice", p."price") ASC, p."id" DESC`;
    }

    if (sort === 'price_desc') {
      return Prisma.sql`ORDER BY COALESCE(p."finalPrice", p."salePrice", p."price") DESC, p."id" DESC`;
    }

    if (sort === 'rating_desc') {
      return Prisma.sql`
        ORDER BY p."averageRating" DESC NULLS LAST,
                 p."reviewCount" DESC,
                 p."id" DESC
      `;
    }

    if (sort === 'popular') {
      return Prisma.sql`
        ORDER BY p."viewCount" DESC,
                 p."reviewCount" DESC,
                 p."id" DESC
      `;
    }

    if (sort === 'name_asc') {
      return Prisma.sql`ORDER BY p."name" ASC, p."id" DESC`;
    }

    if (sort === 'name_desc') {
      return Prisma.sql`ORDER BY p."name" DESC, p."id" DESC`;
    }

    return Prisma.sql`ORDER BY p."createdAt" DESC, p."id" DESC`;
  }

  private buildPagination(query: QueryProductDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 24)));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  private buildPaginatedResult<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  private async incrementView(productId: string) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "Product"
      SET
        "viewCount" = "viewCount" + 1,
        "updatedAt" = ${new Date()}
      WHERE "id" = ${productId}
        AND "deleted_at" IS NULL
    `);
  }

  private assertPriceRange(minPrice?: number, maxPrice?: number) {
    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice > maxPrice
    ) {
      throw new BadRequestException('بازه قیمت نامعتبر است.');
    }
  }

  private hasPositiveDiscount(
    regularPrice: string,
    displayPrice: string,
    comparePrice: string | null,
    discountPercent: string | null,
  ): boolean {
    const percent = Number(discountPercent ?? 0);

    if (Number.isFinite(percent) && percent > 0) {
      return true;
    }

    const compare = Number(comparePrice ?? 0);
    const display = Number(displayPrice);
    const regular = Number(regularPrice);

    return (
      Number.isFinite(compare) &&
      Number.isFinite(display) &&
      Number.isFinite(regular) &&
      ((compare > 0 && compare > display) || regular > display)
    );
  }

  private sanitizeCustomerStringArray(value: unknown): string[] {
    return this.getStringArray(value)
      .map((item) => this.sanitizeCustomerText(item))
      .filter((item): item is string => Boolean(item));
  }

  private sanitizeFaq(value: unknown): { question: string; answer: string }[] {
    return this.getFaq(value)
      .map((item) => ({
        question: this.sanitizeCustomerText(item.question),
        answer: this.sanitizeCustomerText(item.answer),
      }))
      .filter((item): item is { question: string; answer: string } =>
        Boolean(item.question && item.answer),
      );
  }

  private sanitizeAttributeValue(value: unknown): unknown {
    return typeof value === 'string' ? this.sanitizeCustomerText(value) : value;
  }

  private sanitizeCustomerText(value?: string | null): string | null {
    const undamagedValue = this.nullIfDamaged(value);

    if (!undamagedValue) {
      return null;
    }

    const cleaned = undamagedValue.trim();

    if (!cleaned) {
      return null;
    }

    const normalized = cleaned
      .split(/(?<=[.!؟?])\s+|\n+/g)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .filter((sentence) => !this.hasAdvisorSensitiveLeak(sentence))
      .join(' ');

    return normalized.length > 0 ? normalized : null;
  }

  private getFaq(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.toRecord(item))
      .map((item) => ({
        question: this.getString(item.question),
        answer: this.getString(item.answer),
      }))
      .filter((item): item is { question: string; answer: string } =>
        Boolean(item.question && item.answer),
      );
  }

  private getStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => this.sanitizeCustomerText(this.getString(item)))
      .filter((item): item is string => Boolean(item));
  }

  private getString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const cleaned = value.trim();

    return cleaned.length > 0 ? cleaned : null;
  }

  private getBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private nullIfDamaged(value?: string | null): string | null {
    if (!value) {
      return null;
    }

    if (/\?{3,}|Ø|Ù|Û|Ã/.test(value)) {
      return null;
    }

    return value;
  }

  private toDecimalString(value: unknown): string {
    if (value === null || value === undefined) {
      return '0.00';
    }

    if (Prisma.Decimal.isDecimal(value)) {
      return value.toString();
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    return '0.00';
  }

  private toNullableDecimalString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return this.toDecimalString(value);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'number') {
      return value;
    }

    if (Prisma.Decimal.isDecimal(value)) {
      const numeric = value.toNumber();

      return Number.isFinite(numeric) ? numeric : 0;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      const numeric = Number(value);

      return Number.isFinite(numeric) ? numeric : 0;
    }

    return 0;
  }

  private formatDateTimeFa(value: Date): string {
    return formatPersianDateTime(value) ?? value.toISOString();
  }
}
