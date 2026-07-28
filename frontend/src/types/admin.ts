export type AdminApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T | null;
  meta?: Record<string, unknown>;
};

export type AdminCommandCenterStatus = {
  value?: string;
  label?: string;
  score?: number;
  message?: string;
};

export type AdminCommandCenterData = {
  meta?: {
    generatedAt?: string;
    requestedBy?: string;
    currency?: string | null;
    createdFrom?: string | null;
    createdTo?: string | null;
    chartDays?: number | null;
    actionLimit?: number;
    timelineLimit?: number;
  };
  status?: AdminCommandCenterStatus;
  dashboard?: unknown;
  actionCenter?: unknown;
  insights?: unknown;
  timeline?: unknown;
};

export type AdminNavigationItem = {
  label: string;
  href: string;
  description: string;
};

export type AdminOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export type AdminOrderPaymentStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL_REFUNDED';

export type AdminOrderPaymentMethod =
  | 'ZARINPAL'
  | 'IDPAY'
  | 'CASH'
  | 'CARD'
  | 'WALLET';

export type AdminOrderListItem = {
  id: string;
  userId?: string | null;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  totalAmount: string | number;
  paidAmount?: string | number | null;
  currency?: string | null;
  itemCount?: number | null;
  totalQuantity?: number | null;
  userEmail?: string | null;
  userPhone?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  shippingMethod?: string | null;
  trackingNumber?: string | null;
  invoiceStatus?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
};

export type AdminOrderListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/* ADMIN_ORDER_DETAIL_TYPES_V1 */

export type AdminOrderUser = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
};

export type AdminOrderAmounts = {
  subtotal: string;
  taxAmount: string;
  shippingAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  refundedAmount: string;
  netPaidAmount: string;
  currency: string;
};

export type AdminOrderPaymentSummary = {
  status: AdminOrderPaymentStatus;
  method: AdminOrderPaymentMethod | null;
  failedPaymentCount: number;
};

export type AdminOrderShipping = {
  shippingAddressId: string | null;
  billingAddressId: string | null;
  method: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  shippedAtFa: string | null;
  deliveredAt: string | null;
  deliveredAtFa: string | null;
};

export type AdminOrderInvoice = {
  id: string | null;
  status: string | null;
};

export type AdminOrderItemsSummary = {
  itemCount: number;
  totalQuantity: number;
};

export type AdminOrderItem = {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  price: string;
  productName: string;
  sku: string;
  discount: string;
  lineTotal: string;
  createdAt: string;
  createdAtFa: string | null;
};

export type AdminOrderPayment = {
  id: string;
  amount: string;
  currency: string;
  paymentMethod: AdminOrderPaymentMethod;
  paymentStatus: AdminOrderPaymentStatus;
  transactionId: string | null;
  gateway: string | null;
  receiptUrl: string | null;
  paidAt: string | null;
  paidAtFa: string | null;
  refundedAt: string | null;
  refundedAtFa: string | null;
  createdAt: string;
  createdAtFa: string | null;
};

export type AdminOrderAddress = {
  id: string;
  title: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  country: string;
  state: string | null;
  city: string;
  postalCode: string | null;
  street: string;
  apartment: string | null;
};

export type AdminOrderNote = {
  id: string;
  note: string | null;
  isImportant: boolean;
  visibility: string;
  actorId: string | null;
  createdAt: string;
  createdAtFa: string | null;
};

export type AdminOrderTimelineItem = {
  source: string;
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  amount: string | null;
  currency: string | null;
  occurredAt: string;
  occurredAtFa: string | null;
};

export type AdminOrderDetail = {
  id: string;
  user: AdminOrderUser;
  orderNumber: string;
  status: AdminOrderStatus;
  amounts: AdminOrderAmounts;
  payment: AdminOrderPaymentSummary;
  shipping: AdminOrderShipping;
  invoice: AdminOrderInvoice;
  itemsSummary: AdminOrderItemsSummary;
  cancelledAt: string | null;
  cancelledAtFa: string | null;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
  deletedAt: string | null;
  deletedAtFa: string | null;
  items: AdminOrderItem[];
  payments: AdminOrderPayment[];
  shippingAddress: AdminOrderAddress | null;
  billingAddress: AdminOrderAddress | null;
  notes: AdminOrderNote[];
};

export type AdminOrderTimelinePayload = {
  data: AdminOrderTimelineItem[];
  meta?: {
    orderId?: string;
    total?: number;
  };
};

export type AdminOrderNotesPayload = {
  data: AdminOrderNote[];
  meta?: {
    orderId?: string;
    total?: number;
  };
};

/* ADMIN_PRODUCT_LIST_TYPES_V1 */

export type AdminProductStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ARCHIVED';

export type AdminProductReference = {
  id: string | null;
  name: string | null;
  slug: string | null;
};

export type AdminProductModelReference =
  AdminProductReference & {
    modelCode: string | null;
  };

export type AdminProductPricing = {
  purchasePrice: string | null;
  salePrice: string | null;
  discountPercent: string | null;
  finalPrice: string | null;
  minAllowedPrice: string | null;
  grossMarginAmount: string | null;
  grossMarginPercent: string | null;
};

export type AdminProductStock = {
  variantCount: number;
  warehouseCount: number;
  totalQuantity: number;
  reservedQuantity: number;
  availableStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
};

export type AdminProductListItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  brand: AdminProductReference;
  category: AdminProductReference;
  productType: AdminProductReference;
  productModel: AdminProductModelReference;
  sku: string;
  price: string;
  comparePrice: string | null;
  pricing: AdminProductPricing;
  isActive: boolean;
  status: AdminProductStatus;
  ai: {
    contentStatus: string;
    qualityScore: string | null;
  };
  viewCount: number;
  reviewCount: number;
  averageRating: string | null;
  primaryImage: {
    url: string | null;
    altText: string | null;
  };
  stock: AdminProductStock;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

export type AdminProductListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AdminProductListPayload = {
  data: AdminProductListItem[];
  meta: AdminProductListMeta;
};

/* ADMIN_PRODUCT_CATALOG_BOOTSTRAP_TYPES_V1 */

export type AdminCatalogCategoryOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  image: string | null;
};

export type AdminCatalogBrandOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type AdminCatalogProductTypeOption = {
  id: string;
  categoryId: string;
  categoryName: string | null;
  categorySlug: string | null;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isActive: boolean;
  sortOrder: number;
  productModelCount: number;
  templateCount: number;
  createdAt: string;
  createdAtFa?: string | null;
  updatedAt: string;
  updatedAtFa?: string | null;
  deletedAt: string | null;
  deletedAtFa?: string | null;
};

export type AdminCatalogProductModelOption = {
  id: string;
  brandId: string;
  brandName: string | null;
  brandSlug: string | null;
  productTypeId: string;
  productTypeName: string | null;
  productTypeSlug: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  name: string;
  modelCode: string | null;
  slug: string;
  description: string | null;
  titlePattern: string | null;
  seoPattern: string | null;
  isActive: boolean;
  sortOrder: number;
  templateCount: number;
  createdAt: string;
  createdAtFa?: string | null;
  updatedAt: string;
  updatedAtFa?: string | null;
  deletedAt: string | null;
  deletedAtFa?: string | null;
};

export type AdminProductCatalogBootstrap = {
  categories: AdminCatalogCategoryOption[];
  brands: AdminCatalogBrandOption[];
  productTypes: AdminCatalogProductTypeOption[];
  productModels: AdminCatalogProductModelOption[];
  attributes: unknown[];
};

/* ADMIN_INVENTORY_QUICK_EDITOR_TYPES_V1 */

export type AdminWarehouseOption = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
};

export type AdminWarehouseListPayload = {
  data: AdminWarehouseOption[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

export type AdminInventoryListItem = {
  id: string;
  variant: {
    id: string;
    sku: string | null;
    name: string | null;
  };
  product: {
    id: string | null;
    name: string | null;
    slug: string | null;
  };
  warehouse: {
    id: string;
    name: string | null;
    code: string | null;
  };
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
};

export type AdminInventoryListPayload = {
  data: AdminInventoryListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
};

/* ADMIN_VARIANT_ATTRIBUTE_MATRIX_TYPES_V1 */

export type AdminVariantAttributeValueOption = {
  id: string;
  attributeId: string;
  value: string;
};

export type AdminVariantAttributeDefinition = {
  id: string;
  name: string;
  code: string | null;
  label: string;
  description: string | null;
  dataType:
    | 'TEXT'
    | 'NUMBER'
    | 'BOOLEAN'
    | 'ENUM'
    | 'MULTI_SELECT'
    | 'JSON'
    | 'DATE';
  inputType:
    | 'TEXT'
    | 'TEXTAREA'
    | 'NUMBER'
    | 'SWITCH'
    | 'SELECT'
    | 'MULTI_SELECT'
    | 'DATE'
    | 'COLOR'
    | 'RICH_TEXT';
  unit: string | null;
  options: string[];
  placeholder: string | null;
  helpText: string | null;
  isFilterable: boolean;
  isComparable: boolean;
  isSeoImportant: boolean;
  isAiImportant: boolean;
  isActive: boolean;
};

export type AdminVariantAttributeField = {
  id: string;
  templateId: string;
  attributeId: string;
  groupName: string | null;
  isRequired: boolean;
  sortOrder: number;
  attribute: AdminVariantAttributeDefinition;
  values: AdminVariantAttributeValueOption[];
};

export type AdminVariantAttributeTemplate = {
  id: string;
  scope:
    | 'CATEGORY'
    | 'PRODUCT_TYPE'
    | 'BRAND_PRODUCT_TYPE'
    | 'PRODUCT_MODEL';
  name: string;
  categoryId: string | null;
  productTypeId: string | null;
  brandId: string | null;
  productModelId: string | null;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AdminVariantAttributeMatrixPayload = {
  templates: AdminVariantAttributeTemplate[];
  fields: AdminVariantAttributeField[];
};

/* ADMIN_PRODUCT_VARIANT_TYPES_V1 */

export type AdminProductVariantStock = {
  totalQuantity: number;
  reservedQuantity: number;
  availableStock: number;
  lowStockThreshold: number;
};

export type AdminProductVariantListItem = {
  id: string;
  product: {
    id: string;
    name: string | null;
    slug: string | null;
    sku: string | null;
  };
  sku: string;
  name: string | null;
  slug: string | null;
  barcode: string | null;
  gtin: string | null;
  mpn: string | null;
  price: string | null;
  comparePrice: string | null;
  weight: number | null;
  imageUrl: string | null;
  isActive: boolean;
  stock: AdminProductVariantStock;
  attributes: AdminProductVariantAttribute[];
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

export type AdminProductVariantListPayload = {
  data: AdminProductVariantListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AdminProductVariantAttribute = {
  attributeId: string;
  attributeName: string | null;
  attributeValueId: string;
  value: string | null;
};

export type AdminProductVariantInventory = {
  inventoryId: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
};

export type AdminProductVariantDetail =
  AdminProductVariantListItem & {
    attributes: AdminProductVariantAttribute[];
    inventories: AdminProductVariantInventory[];
  };

/* ADMIN_PRODUCT_DETAIL_TYPES_V1 */

export type AdminProductSeo = {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  schemaJson: unknown;
};

export type AdminProductImage = {
  id: string;
  productId: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  title: string | null;
  caption: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
};

export type AdminProductAttribute = {
  attributeId: string | null;
  code: string | null;
  name: string | null;
  label: string | null;
  attributeValueId: string | null;
  predefinedValue: string | null;
  valueText: string | null;
  valueNumber: string | null;
  valueBoolean: boolean | null;
  valueJson: unknown;
  unit: string | null;
};

export type AdminProductDetail =
  AdminProductListItem & {
    description: string | null;
    seo: AdminProductSeo;
    weight: number | null;
    dimensions: unknown;
    images: AdminProductImage[];
    attributes: AdminProductAttribute[];
  };


/* ADMIN_COUPON_TYPES_V1 */

export type AdminCouponType =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_SHIPPING';

export type AdminCouponStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED';

export type AdminCouponListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/* ADMIN_COUPON_RESPONSE_SHAPE_FIX_V1 */

export type AdminCouponFlags = {
  isExpired: boolean;
  isScheduled: boolean;
  isExhausted: boolean;
  isCurrentlyUsable: boolean;
};

export type AdminCouponStats = {
  usageCount: number;
  uniqueUserCount: number;
  orderCount: number;
  revenueAmount: string;
  lastUsedAt: string | null;
  lastUsedAtFa: string | null;
};

export type AdminCouponListItem = {
  id: string;
  code: string;
  type: AdminCouponType;
  value: string;
  description: string | null;
  usageLimit: number | null;
  usedCount: number;
  remainingUsage: number | null;
  status: AdminCouponStatus;
  minAmount: string;
  isActive: boolean;
  flags: AdminCouponFlags;
  stats: AdminCouponStats;
  startDate: string;
  startDateFa: string | null;
  endDate: string | null;
  endDateFa: string | null;
  createdAt: string;
  createdAtFa: string | null;
  updatedAt: string;
  updatedAtFa: string | null;
  deletedAt: string | null;
  deletedAtFa: string | null;
};

export type AdminCouponListPayload = {
  data: AdminCouponListItem[];
  meta: AdminCouponListMeta;
};

export type AdminCouponMutationPayload = {
  coupon: AdminCouponListItem;
  audit: {
    actorId: string | null;
    action: string;
    status?: AdminCouponStatus;
    reason?: string | null;
  };
};

export type AdminCouponCreateInput = {
  code: string;
  type: AdminCouponType;
  value?: string;
  description?: string;
  minAmount?: string;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
  status?: AdminCouponStatus;
};

export type AdminCouponUpdateInput =
  Partial<AdminCouponCreateInput> & {
    clearEndDate?: boolean;
  };

export type AdminCouponDashboardMetric = {
  count: number;
  revenueAmount: string;
  discountAmount: string;
};

export type AdminCouponDashboardPayload = {
  total: AdminCouponDashboardMetric;
  active: AdminCouponDashboardMetric;
  inactive: AdminCouponDashboardMetric;
  expired: AdminCouponDashboardMetric;
  exhausted: AdminCouponDashboardMetric;
  scheduled: AdminCouponDashboardMetric;
};
