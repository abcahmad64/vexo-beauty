export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  meta?: {
    path?: string;
    method?: string;
    timestamp?: string;
    timestampFa?: string;
  };
};

export type PublicSeo = {
  title: string;
  description?: string | null;
  canonicalPath: string;
  robots?: {
    noIndex: boolean;
    noFollow: boolean;
  };
};

export type PublicAction = {
  key?: string;
  label: string;
  path: string;
};

export type PublicHero = {
  title: string;
  subtitle?: string | null;
  primaryAction?: PublicAction | null;
  secondaryAction?: PublicAction | null;
};

export type ProductMoneyValue = string | number;

export type ProductPricing = {
  currency: 'IRR' | string;
  regularPrice?: ProductMoneyValue | null;
  salePrice?: ProductMoneyValue | null;
  finalPrice?: ProductMoneyValue | null;
  displayPrice: ProductMoneyValue;
  comparePrice?: ProductMoneyValue | null;
  originalPrice?: ProductMoneyValue | null;
  discountAmount?: ProductMoneyValue | null;
  discountPercent?: number | null;
  hasDiscount?: boolean;
};

export type ProductStock = {
  inStock: boolean;
  availableStock?: number;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
};

export type ProductImage = {
  id?: string;
  type?: 'IMAGE' | 'VIDEO' | string;
  url?: string | null;
  thumbnailUrl?: string | null;
  alt?: string | null;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  sortOrder?: number;
  isPrimary?: boolean;
  isActive?: boolean;
};

export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  path?: string;
  shortDescription?: string | null;
  brand?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    path?: string | null;
  } | null;
  category?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    path?: string | null;
  } | null;
  productType?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
  } | null;
  productModel?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    modelCode?: string | null;
  } | null;
  pricing: ProductPricing;
  stock: ProductStock;
  primaryImage?: ProductImage | string | null;
  badges?: string[];
  rating?:
    | number
    | {
        average?: number | string | null;
        reviewCount?: number;
      }
    | null;
  reviewCount?: number;
  cta?: {
    enabled?: boolean;
    label?: string;
    path?: string;
  } | null;
};

export type ProductSection = {
  key: 'new_arrivals' | 'discounted' | 'popular' | 'in_stock' | string;
  title: string;
  description?: string | null;
  products: StorefrontProduct[];
};

export type HomePageData = {
  type: 'HOME' | string;
  seo: PublicSeo;
  navigation: {
    canonicalPath: string;
    sectionsEndpoint: string;
    assistantEndpoint: string;
    searchPageEndpoint: string;
  };
  hero: PublicHero;
  sections: {
    productSections: ProductSection[];
    sortOptions: Array<{
      key: string;
      label: string;
    }>;
    quickLinks: PublicAction[];
  };
  nextActions: PublicAction[];
  meta: {
    limit: number;
    sectionCount: number;
    dataScope: string;
    internalDataBlocked: boolean;
    rule?: string;
  };
};

export type NavigationStats = {
  productCount: number;
  inStockCount: number;
  discountedCount: number;
};

export type NavigationMedia = {
  image?: string | null;
  iconUrl?: string | null;
  logoUrl?: string | null;
};

export type NavigationItem = {
  type: 'CATEGORY' | 'BRAND' | 'PRODUCT_TYPE' | 'PRODUCT_MODEL' | string;
  id: string;
  name: string;
  slug: string;
  path: string;
  description?: string | null;
  media?: NavigationMedia;
  stats: NavigationStats;
  sortOrder?: number;
};

export type NavigationPageData = {
  type: 'CATALOG_NAVIGATION' | string;
  seo: PublicSeo;
  navigation: {
    canonicalPath: string;
    homePageDataEndpoint: string;
    searchPageDataEndpoint: string;
    sitemapEndpoint: string;
  };
  sections: {
    categories: NavigationItem[];
    brands: NavigationItem[];
    productTypes: NavigationItem[];
    productModels: NavigationItem[];
  };
  quickActions: PublicAction[];
  meta: {
    limit: number;
    categoryCount: number;
    brandCount: number;
    productTypeCount: number;
    productModelCount: number;
    dataScope: string;
    internalDataBlocked: boolean;
  };
};

export type HomeAssistantData = {
  answer: string;
  source: 'AI' | 'SAFE_FALLBACK';
  model?: string | null;
  provider?: string | null;
  taskType?: string | null;
  sections: ProductSection[];
  safety: {
    safeOutput: boolean;
    dataScope: string;
    internalDataBlocked: boolean;
    hallucinationPolicy: string;
  };
  generatedFor: string;
  meta: HomePageData['meta'];
};

export type StorefrontHomeData = {
  home: HomePageData | null;
  navigation: NavigationPageData | null;
  assistant: HomeAssistantData | null;
};

export type CatalogEmptyState = {
  title?: string | null;
  description?: string | null;
};

export type CatalogFacetItem = {
  id?: string;
  name: string;
  slug: string;
  count: number;
};

export type CatalogFacets = {
  brands: CatalogFacetItem[];
  categories: CatalogFacetItem[];
  productTypes: CatalogFacetItem[];
  price: {
    min: ProductMoneyValue | null;
    max: ProductMoneyValue | null;
  };
  availability: {
    inStock: number;
    outOfStock: number;
  };
  discounts: {
    discounted: number;
  };
  meta?: {
    total?: number;
    dataScope?: string;
    internalDataBlocked?: boolean;
  };
};

export type CatalogPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type CatalogSortOption = {
  key: string;
  label: string;
};

export type CatalogPageData = {
  type?: string;
  query?: {
    q?: string | null;
    page?: number;
    limit?: number;
    sort?: string | null;
    brandSlug?: string | null;
    categorySlug?: string | null;
    inStock?: boolean | null;
    hasDiscount?: boolean | null;
    minPrice?: number | null;
    maxPrice?: number | null;
  };
  entity?: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    path?: string;
    media?: NavigationMedia;
    stats?: NavigationStats;
  } | null;
  seo?: PublicSeo;
  navigation?: {
    breadcrumbs?: Array<{
      label: string;
      path: string;
    }>;
    canonicalPath?: string;
    [key: string]: unknown;
  };
  hero?: (PublicHero & {
    totalProducts?: number;
  }) | null;
  sections?: {
    products?: StorefrontProduct[];
    productSections?: ProductSection[];
    suggestions?: Array<{
      type?: string;
      label: string;
      value: string;
      id?: string;
      slug?: string;
      sku?: string;
    }>;
    facets?: CatalogFacets;
    pagination?: CatalogPagination;
    sortOptions?: CatalogSortOption[];
    emptyState?: CatalogEmptyState | null;
    [key: string]: unknown;
  };
  products?: StorefrontProduct[];
  items?: StorefrontProduct[];
  nextActions?: PublicAction[];
  meta?: {
    count?: number;
    productCount?: number;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    dataScope?: string;
    internalDataBlocked?: boolean;
    [key: string]: unknown;
  };
};

export type ProductHighlight = {
  key?: string;
  title: string;
  value: string;
  source?: string;
};

export type ProductFaqItem = {
  question: string;
  answer: string;
  source?: string;
};

export type ProductDecision = {
  score?: number;
  readiness?: string;
  label?: string;
  reasons?: string[];
  cautions?: string[];
  recommendation?: string;
};

export type ProductPageData = {
  type?: string;
  product?: StorefrontProduct & {
    description?: string | null;
    shortDescription?: string | null;
    weight?: number | null;
    media?: {
      primaryImage?: ProductImage | null;
      images?: ProductImage[];
      videos?: ProductImage[];
    };
    content?: {
      sellingPoints?: string[];
      faq?: ProductFaqItem[];
      adCopy?: string | null;
    };
    attributes?: Array<{
      key?: string;
      label?: string;
      value?: string;
      name?: string;
      code?: string;
    }>;
  };
  seo?: PublicSeo & {
    schema?: Record<string, unknown>;
  };
  commercial?: {
    pricing?: ProductPricing;
    stock?: ProductStock;
    cta?: StorefrontProduct['cta'];
    decision?: ProductDecision;
  };
  sections?: {
    highlights?: ProductHighlight[];
    badges?: string[];
    faq?: ProductFaqItem[];
    related?: StorefrontProduct[];
    purchaseGuide?: {
      decision?: ProductDecision;
      recommendation?: string;
    };
    salesAdvisor?: {
      contextEndpoint?: string;
      askEndpoint?: string;
      visibilityPolicy?: string;
    };
    [key: string]: unknown;
  };
  nextActions?: PublicAction[];
  meta?: {
    dataScope?: string;
    internalDataBlocked?: boolean;
    highlightCount?: number;
    faqCount?: number;
    relatedCount?: number;
    [key: string]: unknown;
  };
};


export type CartProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: ProductMoneyValue;
  comparePrice?: ProductMoneyValue | null;
  variant?: {
    id: string;
    sku?: string | null;
    name?: string | null;
  } | null;
  image?: {
    url: string;
    alt?: string | null;
  } | null;
};

export type CartItem = {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: ProductMoneyValue;
  lineTotal: ProductMoneyValue;
  product: CartProduct | null;
  stock: {
    available: number;
    isAvailable: boolean;
  };
  createdAt?: string;
  createdAtFa?: string | null;
  updatedAt?: string;
  updatedAtFa?: string | null;
};

export type CustomerCart = {
  id: string;
  userId: string;
  items: CartItem[];
  summary: {
    totalItems: number;
    uniqueItems: number;
    subtotal: ProductMoneyValue;
    unavailableItemsCount: number;
  };
  createdAt?: string;
  createdAtFa?: string | null;
  updatedAt?: string;
  updatedAtFa?: string | null;
};

export type CustomerAddress = {
  id: string;
  userId?: string;
  title?: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  state?: string | null;
  city: string;
  postalCode?: string | null;
  street: string;
  apartment?: string | null;
  isDefault: boolean;
  createdAt?: string;
  createdAtFa?: string | null;
  updatedAt?: string;
  updatedAtFa?: string | null;
};

export type CustomerAddressCollection = {
  data: CustomerAddress[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type CheckoutBootstrap = {
  cart: CustomerCart;
  addresses: CustomerAddressCollection;
};

export type CustomerOrderStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'COMPLETED'
  | string;

export type CustomerOrderPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | string;

export type CustomerOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  price: ProductMoneyValue;
  productName: string;
  sku: string;
  discount: ProductMoneyValue;
  lineTotal: ProductMoneyValue;
  createdAt?: string;
  createdAtFa?: string | null;
  updatedAt?: string;
  updatedAtFa?: string | null;
};

export type CustomerOrder = {
  id: string;
  userId?: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  subtotal: ProductMoneyValue;
  taxAmount: ProductMoneyValue;
  shippingAmount: ProductMoneyValue;
  discountAmount: ProductMoneyValue;
  totalAmount: ProductMoneyValue;
  currency: string;
  paymentStatus: CustomerOrderPaymentStatus;
  paymentMethod?: string | null;
  shippingAddressId?: string | null;
  billingAddressId?: string | null;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
  shippedAt?: string | null;
  shippedAtFa?: string | null;
  deliveredAt?: string | null;
  deliveredAtFa?: string | null;
  cancelledAt?: string | null;
  cancelledAtFa?: string | null;
  createdAt: string;
  createdAtFa?: string | null;
  updatedAt?: string;
  updatedAtFa?: string | null;
  items?: CustomerOrderItem[];
};

export type CustomerOrderCollection = {
  data: CustomerOrder[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};
