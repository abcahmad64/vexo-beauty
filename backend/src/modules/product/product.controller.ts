import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { QueryProductDto } from './dto/query-product.dto';

import { ProductSalesAdvisorQuestionDto } from './dto/product-sales-advisor-question.dto';

import { ProductPublicService } from './services/product-public.service';

@ApiTags('Products')
@Controller('products')
export class ProductController {
  constructor(private readonly productPublicService: ProductPublicService) {}

  @Get()
  @ApiOperation({
    summary: 'دریافت لیست امن محصولات برای سایت',
  })
  findAll(@Query() query: QueryProductDto): unknown {
    return this.productPublicService.findAll(query);
  }

  @Get('navigation/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های ناوبری و مگامنو کاتالوگ برای frontend',
  })
  getCatalogNavigationPageData(@Query('limit') limit?: string): unknown {
    return this.productPublicService.getCatalogNavigationPageData(limit);
  }

  @Get('frontend/contract')
  @ApiOperation({
    summary: 'دریافت قرارداد امن frontend برای صفحات public catalog',
  })
  getPublicFrontendContract(): unknown {
    return this.productPublicService.getPublicFrontendContract();
  }

  @Get('frontend/audit')
  @ApiOperation({
    summary: 'دریافت گزارش نهایی آمادگی و ایمنی public catalog برای frontend',
  })
  getPublicFrontendAudit(): unknown {
    return this.productPublicService.getPublicFrontendAudit();
  }

  @Get('home/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه اصلی فروشگاه برای frontend',
  })
  getHomePageData(@Query('limit') limit?: string): unknown {
    return this.productPublicService.getHomePageData(limit);
  }

  @Get('home/sections')
  @ApiOperation({
    summary: 'دریافت بخش‌های امن محصولات برای صفحه اصلی',
  })
  getHomeSections(@Query('limit') limit?: string): unknown {
    return this.productPublicService.getHomeSections(limit);
  }

  @Get('home/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای راهنمای صفحه اصلی محصولات',
  })
  getHomeAssistant(@Query('limit') limit?: string): unknown {
    return this.productPublicService.getHomeAssistant(limit);
  }

  @Get('seo/sitemap')
  @ApiOperation({
    summary: 'دریافت URLهای امن سئو برای sitemap سایت',
  })
  getSeoSitemap(@Query('limit') limit?: string): unknown {
    return this.productPublicService.getPublicSitemap(limit);
  }

  @Get('compare/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه مقایسه محصولات برای frontend',
  })
  compareProductsPageData(
    @Query('items') items?: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getComparePageData(items, limit);
  }

  @Get('compare')
  @ApiOperation({
    summary: 'مقایسه امن محصولات برای سایت',
  })
  compareProducts(
    @Query('items') items?: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getCompareProducts(items, limit);
  }

  @Get('compare/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای مقایسه محصولات',
  })
  compareProductsAssistant(
    @Query('items') items?: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getCompareAssistant(items, limit);
  }

  @Get('category/:categorySlug/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه دسته‌بندی برای frontend',
  })
  getCategoryLandingPageData(
    @Param('categorySlug') categorySlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getCategoryLandingPageData(
      categorySlug,
      query,
    );
  }

  @Get('category/:categorySlug')
  @ApiOperation({
    summary: 'دریافت صفحه امن دسته‌بندی برای سایت',
  })
  getCategoryLanding(
    @Param('categorySlug') categorySlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getCategoryLanding(categorySlug, query);
  }

  @Get('category/:categorySlug/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای صفحه دسته‌بندی',
  })
  getCategoryLandingAssistant(
    @Param('categorySlug') categorySlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getCategoryLandingAssistant(
      categorySlug,
      query,
    );
  }

  @Get('brand/:brandSlug/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه برند برای frontend',
  })
  getBrandLandingPageData(
    @Param('brandSlug') brandSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getBrandLandingPageData(brandSlug, query);
  }

  @Get('brand/:brandSlug')
  @ApiOperation({
    summary: 'دریافت صفحه امن برند برای سایت',
  })
  getBrandLanding(
    @Param('brandSlug') brandSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getBrandLanding(brandSlug, query);
  }

  @Get('brand/:brandSlug/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای صفحه برند',
  })
  getBrandLandingAssistant(
    @Param('brandSlug') brandSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getBrandLandingAssistant(brandSlug, query);
  }

  @Get('type/:productTypeSlug/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه نوع محصول برای frontend',
  })
  getProductTypeLandingPageData(
    @Param('productTypeSlug') productTypeSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductTypeLandingPageData(
      productTypeSlug,
      query,
    );
  }

  @Get('type/:productTypeSlug')
  @ApiOperation({
    summary: 'دریافت صفحه امن نوع محصول برای سایت',
  })
  getProductTypeLanding(
    @Param('productTypeSlug') productTypeSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductTypeLanding(
      productTypeSlug,
      query,
    );
  }

  @Get('type/:productTypeSlug/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای صفحه نوع محصول',
  })
  getProductTypeLandingAssistant(
    @Param('productTypeSlug') productTypeSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductTypeLandingAssistant(
      productTypeSlug,
      query,
    );
  }

  @Get('model/:productModelSlug/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه مدل محصول برای frontend',
  })
  getProductModelLandingPageData(
    @Param('productModelSlug') productModelSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductModelLandingPageData(
      productModelSlug,
      query,
    );
  }

  @Get('model/:productModelSlug')
  @ApiOperation({
    summary: 'دریافت صفحه امن مدل محصول برای سایت',
  })
  getProductModelLanding(
    @Param('productModelSlug') productModelSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductModelLanding(
      productModelSlug,
      query,
    );
  }

  @Get('model/:productModelSlug/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای صفحه مدل محصول',
  })
  getProductModelLandingAssistant(
    @Param('productModelSlug') productModelSlug: string,
    @Query() query: QueryProductDto,
  ): unknown {
    return this.productPublicService.getProductModelLandingAssistant(
      productModelSlug,
      query,
    );
  }

  @Get('search/page-data')
  @ApiOperation({
    summary: 'دریافت بسته امن داده‌های صفحه جستجوی محصولات برای frontend',
  })
  getSearchPageData(@Query() query: QueryProductDto): unknown {
    return this.productPublicService.getSearchPageData(query);
  }

  @Get('search/suggestions')
  @ApiOperation({
    summary: 'پیشنهاد امن جستجوی محصول برای سایت',
  })
  getSearchSuggestions(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getSearchSuggestions(q, limit);
  }

  @Get('search/facets')
  @ApiOperation({
    summary: 'دریافت facetهای امن فیلتر محصولات برای سایت',
  })
  getSearchFacets(@Query() query: QueryProductDto): unknown {
    return this.productPublicService.getPublicFacets(query);
  }

  @Get('search/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای راهنمایی جستجوی محصول',
  })
  getSearchAssistant(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getSearchAssistant(q, limit);
  }

  @Post('recommendation-guide')
  @ApiOperation({
    summary: 'دریافت راهنمای پیشنهاد امن محصولات بر اساس نیاز مشتری',
  })
  getPublicRecommendationGuide(
    @Body() body?: Record<string, unknown>,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getPublicRecommendationGuide(body, limit);
  }

  @Post('recommendation-guide/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای پیشنهاد محصولات بر اساس نیاز مشتری',
  })
  getPublicRecommendationGuideAssistant(
    @Body() body?: Record<string, unknown>,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getPublicRecommendationGuideAssistant(
      body,
      limit,
    );
  }

  @Get(':identifier/quick-view')
  @ApiOperation({
    summary: 'دریافت بسته امن نمایش سریع محصول برای frontend',
  })
  getProductQuickView(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductQuickView(identifier);
  }

  @Get(':identifier/quick-view/assistant')
  @ApiOperation({
    summary: 'پاسخ امن برای نمایش سریع محصول',
  })
  getProductQuickViewAssistant(
    @Param('identifier') identifier: string,
  ): unknown {
    return this.productPublicService.getProductQuickViewAssistant(identifier);
  }

  @Get(':identifier/page-data')
  @ApiOperation({
    summary: 'دریافت بسته کامل و امن داده‌های صفحه محصول',
  })
  getProductPageData(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductPageData(identifier);
  }

  @Get(':identifier/page-data/assistant')
  @ApiOperation({
    summary: 'پاسخ امن برای جمع‌بندی داده‌های صفحه محصول',
  })
  getProductPageDataAssistant(
    @Param('identifier') identifier: string,
  ): unknown {
    return this.productPublicService.getProductPageDataAssistant(identifier);
  }

  @Get(':identifier/purchase-guide')
  @ApiOperation({
    summary: 'دریافت راهنمای خرید امن محصول برای سایت',
  })
  getProductPurchaseGuide(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductPurchaseGuide(identifier);
  }

  @Get(':identifier/purchase-guide/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای راهنمای خرید محصول',
  })
  getProductPurchaseGuideAssistant(
    @Param('identifier') identifier: string,
  ): unknown {
    return this.productPublicService.getProductPurchaseGuideAssistant(
      identifier,
    );
  }

  @Post(':identifier/fit-guide')
  @ApiOperation({
    summary: 'دریافت راهنمای تناسب امن محصول با نیاز مشتری',
  })
  getProductFitGuide(
    @Param('identifier') identifier: string,
    @Body() body?: Record<string, unknown>,
  ): unknown {
    return this.productPublicService.getProductFitGuide(identifier, body);
  }

  @Post(':identifier/fit-guide/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای تناسب محصول با نیاز مشتری',
  })
  getProductFitGuideAssistant(
    @Param('identifier') identifier: string,
    @Body() body?: Record<string, unknown>,
  ): unknown {
    return this.productPublicService.getProductFitGuideAssistant(
      identifier,
      body,
    );
  }

  @Get(':identifier/highlights')
  @ApiOperation({
    summary: 'دریافت نکات برجسته امن محصول برای سایت',
  })
  getProductHighlights(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductHighlights(identifier);
  }

  @Get(':identifier/highlights/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای نکات برجسته محصول',
  })
  getProductHighlightsAssistant(
    @Param('identifier') identifier: string,
  ): unknown {
    return this.productPublicService.getProductHighlightsAssistant(identifier);
  }

  @Get(':identifier/faq')
  @ApiOperation({
    summary: 'دریافت سوالات متداول امن محصول برای سایت',
  })
  getProductFaq(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductFaq(identifier);
  }

  @Get(':identifier/faq/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای سوالات متداول محصول',
  })
  getProductFaqAssistant(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductFaqAssistant(identifier);
  }

  @Get(':identifier/seo-schema')
  @ApiOperation({
    summary: 'دریافت structured data امن محصول برای SEO',
  })
  getProductSeoSchema(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getProductSeoSchema(identifier);
  }

  @Get(':identifier/related')
  @ApiOperation({
    summary: 'دریافت محصولات مرتبط امن برای صفحه محصول',
  })
  getRelatedProducts(
    @Param('identifier') identifier: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getRelatedProducts(identifier, limit);
  }

  @Get(':identifier/recommendations/assistant')
  @ApiOperation({
    summary: 'پاسخ امن AI برای پیشنهاد محصولات مرتبط',
  })
  getRelatedRecommendationAssistant(
    @Param('identifier') identifier: string,
    @Query('limit') limit?: string,
  ): unknown {
    return this.productPublicService.getRelatedRecommendationAssistant(
      identifier,
      limit,
    );
  }

  @Get(':identifier/sales-advisor-context')
  @ApiOperation({
    summary: 'دریافت context امن محصول برای مشاور فروش هوشمند',
  })
  getSalesAdvisorContext(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.getSalesAdvisorContext(identifier);
  }

  @Post(':identifier/sales-advisor/ask')
  @ApiOperation({
    summary: 'پاسخ امن مشاور فروش هوشمند برای یک محصول',
  })
  askSalesAdvisor(
    @Param('identifier') identifier: string,
    @Body() dto: ProductSalesAdvisorQuestionDto,
  ): unknown {
    return this.productPublicService.askSalesAdvisor(identifier, dto);
  }

  @Get(':identifier')
  @ApiOperation({
    summary: 'دریافت جزئیات امن محصول برای صفحه محصول سایت',
  })
  findOne(@Param('identifier') identifier: string): unknown {
    return this.productPublicService.findOne(identifier, {
      incrementView: true,
    });
  }
}
