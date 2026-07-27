export interface AiProductContext {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string | null;
  shortDescription?: string | null;
  price: string;
  comparePrice?: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  averageRating?: string | null;
  reviewCount: number;
  viewCount: number;
  isActive: boolean;
  status: string;
}

export interface AiProductVariantContext {
  id: string;
  productId: string;
  sku: string;
  name?: string | null;
  slug?: string | null;
  price?: string | null;
  comparePrice?: string | null;
  weight?: number | null;
  imageUrl?: string | null;
  isActive: boolean;
}

export interface AiProductImageContext {
  id: string;
  productId: string;
  url: string;
  altText?: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface AiProductAttributeContext {
  name: string;
  value: string;
}

export interface AiInventoryContext {
  variantId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface AiReviewSummaryContext {
  averageRating: string | null;
  reviewCount: number;
  latestComments: Array<{
    rating: number;
    title?: string | null;
    comment?: string | null;
    isVerified: boolean;
    createdAt: Date;
  }>;
}

export interface AiProductSnapshot {
  product: AiProductContext;
  variants: AiProductVariantContext[];
  images: AiProductImageContext[];
  attributes: AiProductAttributeContext[];
  inventory: AiInventoryContext[];
  reviews: AiReviewSummaryContext;
}

export interface AiUserBehaviorContext {
  cartItems: Array<{
    productId: string;
    variantId?: string | null;
    productName: string;
    sku: string;
    quantity: number;
    price: string;
  }>;
  wishlistItems: Array<{
    productId: string;
    productName: string;
    sku: string;
  }>;
  recentPurchasedProducts: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    price: string;
    createdAt: Date;
  }>;
}

export interface AiCatalogSearchResult {
  products: AiProductContext[];
  total: number;
}
