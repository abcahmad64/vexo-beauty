'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BadgePercent,
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  Crown,
  FileJson,
  FolderTree,
  ImageOff,
  Images,
  LoaderCircle,
  Package,
  Pencil,
  RefreshCcw,
  Save,
  SearchCheck,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Warehouse,
  XCircle,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { AdminHeader } from '@/components/admin/admin-header';

import type {
  AdminApiEnvelope,
  AdminInventoryListItem,
  AdminInventoryListPayload,
  AdminProductAttribute,
  AdminProductCatalogBootstrap,
  AdminProductDetail,
  AdminProductVariantListItem,
  AdminProductVariantListPayload,
  AdminWarehouseListPayload,
  AdminWarehouseOption,
} from '@/types/admin';

type AdminProductDetailScreenProps = {
  productId: string;
};

/* ADMIN_PRODUCT_MEDIA_MANAGER_V2 */

type ProductMediaDraft = {
  altText: string;
  title: string;
  caption: string;
};

type ProductMediaAction =
  | 'save'
  | 'primary'
  | 'delete';

/* ADMIN_PRODUCT_VARIANT_INLINE_EDIT_V1 */

type ProductVariantEditDraft = {
  sku: string;
  name: string;
  barcode: string;
  gtin: string;
  mpn: string;
  price: string;
  comparePrice: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  ARCHIVED: 'بایگانی‌شده',
};

const productStatusOptions = [
  ['DRAFT', 'پیش‌نویس'],
  ['ACTIVE', 'فعال'],
  ['INACTIVE', 'غیرفعال'],
  ['ARCHIVED', 'بایگانی‌شده'],
] as const;

const aiStatusLabels: Record<string, string> = {
  NOT_STARTED: 'شروع‌نشده',
  PENDING: 'در انتظار',
  PROCESSING: 'در حال پردازش',
  DRAFT: 'پیش‌نویس آماده',
  COMPLETED: 'تکمیل‌شده',
  FAILED: 'ناموفق',
};

/* ADMIN_PRODUCT_MEDIA_UPLOAD_V1 */

const productMediaMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
]);

const productMediaAccept = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
].join(',');

const productMediaMaxFileSize =
  10 * 1024 * 1024;

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '۰ بایت';
  }

  if (value < 1024) {
    return `${new Intl.NumberFormat('fa-IR').format(
      value,
    )} بایت`;
  }

  const kilobytes = value / 1024;

  if (kilobytes < 1024) {
    return `${new Intl.NumberFormat('fa-IR', {
      maximumFractionDigits: 1,
    }).format(kilobytes)} کیلوبایت`;
  }

  return `${new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 1,
  }).format(kilobytes / 1024)} مگابایت`;
}

function isOptimizedImage(file: File) {
  return (
    file.type === 'image/webp' ||
    file.type === 'image/avif'
  );
}

function formatMoney(
  value: string | number | null | undefined,
) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatNumber(
  value: number | null | undefined,
) {
  return new Intl.NumberFormat('fa-IR').format(
    Number.isFinite(value ?? NaN)
      ? value ?? 0
      : 0,
  );
}

function formatDate(
  value?: string | null,
  persianValue?: string | null,
) {
  if (persianValue) {
    return persianValue;
  }

  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function finalProductPrice(
  product: AdminProductDetail,
) {
  return (
    product.pricing.finalPrice ??
    product.pricing.salePrice ??
    product.price
  );
}

function stringifyJson(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function attributeValue(
  attribute: AdminProductAttribute,
) {
  if (attribute.predefinedValue) {
    return attribute.predefinedValue;
  }

  if (attribute.valueText) {
    return attribute.valueText;
  }

  if (attribute.valueNumber !== null) {
    return attribute.valueNumber;
  }

  if (attribute.valueBoolean !== null) {
    return attribute.valueBoolean
      ? 'بله'
      : 'خیر';
  }

  if (
    attribute.valueJson !== null &&
    attribute.valueJson !== undefined
  ) {
    return stringifyJson(attribute.valueJson);
  }

  return 'ثبت نشده';
}

function stockState(product: AdminProductDetail) {
  if (product.stock.isOutOfStock) {
    return {
      label: 'ناموجود',
      className: 'is-out',
    };
  }

  if (product.stock.isLowStock) {
    return {
      label: 'رو به اتمام',
      className: 'is-low',
    };
  }

  return {
    label: 'موجود',
    className: 'is-ready',
  };
}

export function AdminProductDetailScreen({
  productId,
}: AdminProductDetailScreenProps) {
  const [product, setProduct] =
    useState<AdminProductDetail | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [notFound, setNotFound] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  /* ADMIN_PRODUCT_STATUS_ACTION_V1 */

  const [statusDraft, setStatusDraft] =
    useState('');

  const [activeDraft, setActiveDraft] =
    useState(false);

  const [statusReason, setStatusReason] =
    useState('');

  const [statusPending, setStatusPending] =
    useState(false);

  const [actionFeedback, setActionFeedback] =
    useState<{
      tone: 'success' | 'error';
      message: string;
    } | null>(null);

  /* ADMIN_PRODUCT_EDIT_FORMS_V1 */

  const [nameDraft, setNameDraft] =
    useState('');

  const [slugDraft, setSlugDraft] =
    useState('');

  const [skuDraft, setSkuDraft] =
    useState('');

  const [shortDescriptionDraft, setShortDescriptionDraft] =
    useState('');

  const [descriptionDraft, setDescriptionDraft] =
    useState('');

  /* ADMIN_PRODUCT_CLASSIFICATION_EDITOR_V1 */

  const [catalog, setCatalog] =
    useState<AdminProductCatalogBootstrap | null>(
      null,
    );

  const [catalogLoading, setCatalogLoading] =
    useState(true);

  const [catalogError, setCatalogError] =
    useState<string | null>(null);

  const [brandIdDraft, setBrandIdDraft] =
    useState('');

  const [categoryIdDraft, setCategoryIdDraft] =
    useState('');

  const [productTypeIdDraft, setProductTypeIdDraft] =
    useState('');

  const [productModelIdDraft, setProductModelIdDraft] =
    useState('');

  const [priceDraft, setPriceDraft] =
    useState('');

  const [comparePriceDraft, setComparePriceDraft] =
    useState('');

  const [purchasePriceDraft, setPurchasePriceDraft] =
    useState('');

  const [salePriceDraft, setSalePriceDraft] =
    useState('');

  const [identityPending, setIdentityPending] =
    useState(false);

  const [pricingPending, setPricingPending] =
    useState(false);

  /* ADMIN_PRODUCT_SEO_EDITOR_V1 */

  const [seoTitleDraft, setSeoTitleDraft] =
    useState('');

  const [seoDescriptionDraft, setSeoDescriptionDraft] =
    useState('');

  const [canonicalUrlDraft, setCanonicalUrlDraft] =
    useState('');

  const [schemaJsonDraft, setSchemaJsonDraft] =
    useState('');

  const [seoPending, setSeoPending] =
    useState(false);

  const [schemaJsonError, setSchemaJsonError] =
    useState<string | null>(null);

  /* ADMIN_PRODUCT_INVENTORY_QUICK_EDITOR_V1 */

  const [inventoryItems, setInventoryItems] =
    useState<AdminInventoryListItem[]>([]);

  const [warehouses, setWarehouses] =
    useState<AdminWarehouseOption[]>([]);

  const [inventoryLoading, setInventoryLoading] =
    useState(true);

  const [inventoryPending, setInventoryPending] =
    useState(false);

  const [inventoryError, setInventoryError] =
    useState<string | null>(null);

  const [warehouseIdDraft, setWarehouseIdDraft] =
    useState('');

  const [stockQuantityDraft, setStockQuantityDraft] =
    useState('0');

  const [
    lowStockThresholdDraft,
    setLowStockThresholdDraft,
  ] = useState('5');

  /* ADMIN_PRODUCT_VARIANTS_UI_V1 */

  const [variants, setVariants] =
    useState<AdminProductVariantListItem[]>([]);

  const [variantsLoading, setVariantsLoading] =
    useState(true);

  const [variantsError, setVariantsError] =
    useState<string | null>(null);

  const [variantCreatePending, setVariantCreatePending] =
    useState(false);

  const [variantActionId, setVariantActionId] =
    useState<string | null>(null);

  const [variantSkuDraft, setVariantSkuDraft] =
    useState('');

  const [variantNameDraft, setVariantNameDraft] =
    useState('');

  const [variantPriceDraft, setVariantPriceDraft] =
    useState('');

  const [
    variantComparePriceDraft,
    setVariantComparePriceDraft,
  ] = useState('');

  const [variantActiveDraft, setVariantActiveDraft] =
    useState(true);

  const [editingVariantId, setEditingVariantId] =
    useState<string | null>(null);

  const [variantEditDraft, setVariantEditDraft] =
    useState<ProductVariantEditDraft | null>(null);

  const [variantEditPending, setVariantEditPending] =
    useState(false);

  const [variantPricePending, setVariantPricePending] =
    useState(false);

  const [variantDeletePending, setVariantDeletePending] =
    useState(false);

  const [mediaFile, setMediaFile] =
    useState<File | null>(null);

  const [mediaPreviewUrl, setMediaPreviewUrl] =
    useState<string | null>(null);

  const [mediaAltText, setMediaAltText] =
    useState('');

  const [mediaTitle, setMediaTitle] =
    useState('');

  const [mediaCaption, setMediaCaption] =
    useState('');

  const [mediaPrimary, setMediaPrimary] =
    useState(false);

  const [mediaPending, setMediaPending] =
    useState(false);

  const [mediaDragging, setMediaDragging] =
    useState(false);

  const [mediaInputKey, setMediaInputKey] =
    useState(0);

  const [mediaDrafts, setMediaDrafts] =
    useState<Record<string, ProductMediaDraft>>(
      {},
    );

  const [mediaAction, setMediaAction] =
    useState<{
      imageId: string;
      action: ProductMediaAction;
    } | null>(null);

  /* ADMIN_PRODUCT_MEDIA_REORDER_V3 */

  const [mediaOrder, setMediaOrder] =
    useState<string[]>([]);

  const [mediaOrderBaseline, setMediaOrderBaseline] =
    useState<string[]>([]);

  const [draggedMediaId, setDraggedMediaId] =
    useState<string | null>(null);

  const [dropTargetMediaId, setDropTargetMediaId] =
    useState<string | null>(null);

  const [mediaReorderPending, setMediaReorderPending] =
    useState(false);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);

    try {
      const response = await fetch(
        '/api/admin/product-catalog/bootstrap?includeInactive=true',
        {
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminProductCatalogBootstrap>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت اطلاعات کاتالوگ انجام نشد.',
        );
      }

      setCatalog(envelope.data);
    } catch (error) {
      setCatalog(null);

      setCatalogError(
        error instanceof Error
          ? error.message
          : 'دریافت اطلاعات کاتالوگ انجام نشد.',
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [productId]);

  /* ADMIN_VARIANT_DRAFT_SYNC_V1 */
  /* ADMIN_VARIANT_DRAFT_SYNC_RETURN_FIX_V1 */

  const loadVariants = useCallback(
    async (): Promise<
      AdminProductVariantListItem[]
    > => {
    setVariantsLoading(true);
    setVariantsError(null);

    try {
      const response = await fetch(
        `/api/admin/product-variants?productId=${encodeURIComponent(
          productId,
        )}&page=1&limit=200&sortBy=createdAt&sortDirection=asc`,
        {
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return [];
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminProductVariantListPayload>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت واریانت‌های محصول انجام نشد.',
        );
      }

      const nextVariants =
        envelope.data.data;

      setVariants(nextVariants);

      return nextVariants;
    } catch (error) {
      setVariants([]);

      setVariantsError(
        error instanceof Error
          ? error.message
          : 'دریافت واریانت‌های محصول انجام نشد.',
      );

      return [];
    } finally {
      setVariantsLoading(false);
    }
  },
    [productId],
  );

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);

    try {
      const [inventoryResponse, warehouseResponse] =
        await Promise.all([
          fetch(
            `/api/admin/inventory?productId=${encodeURIComponent(
              productId,
            )}&page=1&limit=100`,
            {
              cache: 'no-store',
            },
          ),
          fetch(
            '/api/admin/inventory/warehouses?isActive=true&limit=100',
            {
              cache: 'no-store',
            },
          ),
        ]);

      if (
        inventoryResponse.status === 401 ||
        warehouseResponse.status === 401
      ) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      const inventoryEnvelope =
        (await inventoryResponse.json()) as AdminApiEnvelope<AdminInventoryListPayload>;

      const warehouseEnvelope =
        (await warehouseResponse.json()) as AdminApiEnvelope<AdminWarehouseListPayload>;

      if (
        !inventoryResponse.ok ||
        inventoryEnvelope.success !== true ||
        !inventoryEnvelope.data
      ) {
        throw new Error(
          inventoryEnvelope.message ||
            'دریافت موجودی محصول انجام نشد.',
        );
      }

      if (
        !warehouseResponse.ok ||
        warehouseEnvelope.success !== true ||
        !warehouseEnvelope.data
      ) {
        throw new Error(
          warehouseEnvelope.message ||
            'دریافت فهرست انبارها انجام نشد.',
        );
      }

      const nextInventoryItems =
        inventoryEnvelope.data.data;

      const nextWarehouses =
        warehouseEnvelope.data.data.filter(
          (warehouse) => warehouse.isActive,
        );

      setInventoryItems(nextInventoryItems);
      setWarehouses(nextWarehouses);

      if (nextInventoryItems.length === 1) {
        const inventory = nextInventoryItems[0];

        setWarehouseIdDraft(
          inventory.warehouse.id,
        );

        setStockQuantityDraft(
          String(inventory.quantity),
        );

        setLowStockThresholdDraft(
          String(inventory.lowStockThreshold),
        );
      } else if (nextInventoryItems.length === 0) {
        setWarehouseIdDraft(
          nextWarehouses.length === 1
            ? nextWarehouses[0].id
            : '',
        );

        setStockQuantityDraft('0');
        setLowStockThresholdDraft('5');
      } else {
        setWarehouseIdDraft('');
        setStockQuantityDraft('0');
        setLowStockThresholdDraft('5');
      }
    } catch (error) {
      setInventoryItems([]);
      setWarehouses([]);

      setInventoryError(
        error instanceof Error
          ? error.message
          : 'دریافت اطلاعات موجودی انجام نشد.',
      );
    } finally {
      setInventoryLoading(false);
    }
  }, [productId]);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}`,
        {
          cache: 'no-store',
        },
      );

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;
        return;
      }

      if (response.status === 404) {
        setProduct(null);
        setNotFound(true);
        return;
      }

      const envelope =
        (await response.json()) as AdminApiEnvelope<AdminProductDetail>;

      if (
        !response.ok ||
        envelope.success !== true ||
        !envelope.data
      ) {
        throw new Error(
          envelope.message ||
            'دریافت جزئیات محصول انجام نشد.',
        );
      }

      const freshProduct = envelope.data;

      setProduct(freshProduct);
      setStatusDraft(freshProduct.status);
      setActiveDraft(freshProduct.isActive);

      setNameDraft(freshProduct.name);
      setSlugDraft(freshProduct.slug);
      setSkuDraft(freshProduct.sku);

      setShortDescriptionDraft(
        freshProduct.shortDescription ?? '',
      );

      setDescriptionDraft(
        freshProduct.description ?? '',
      );

      setBrandIdDraft(
        freshProduct.brand.id ?? '',
      );

      setCategoryIdDraft(
        freshProduct.category.id ?? '',
      );

      setProductTypeIdDraft(
        freshProduct.productType.id ?? '',
      );

      setProductModelIdDraft(
        freshProduct.productModel.id ?? '',
      );

      setPriceDraft(
        freshProduct.price ?? '',
      );

      setComparePriceDraft(
        freshProduct.comparePrice ?? '',
      );

      setPurchasePriceDraft(
        freshProduct.pricing.purchasePrice ?? '',
      );

      setSalePriceDraft(
        freshProduct.pricing.salePrice ?? '',
      );

      setSeoTitleDraft(
        freshProduct.seo.title ?? '',
      );

      setSeoDescriptionDraft(
        freshProduct.seo.description ?? '',
      );

      setCanonicalUrlDraft(
        freshProduct.seo.canonicalUrl ?? '',
      );

      setSchemaJsonDraft(
        freshProduct.seo.schemaJson
          ? JSON.stringify(
              freshProduct.seo.schemaJson,
              null,
              2,
            )
          : '',
      );

      setSchemaJsonError(null);

      setMediaDrafts(
        Object.fromEntries(
          freshProduct.images.map((image) => [
            image.id,
            {
              altText: image.altText ?? '',
              title: image.title ?? '',
              caption: image.caption ?? '',
            },
          ]),
        ),
      );

      const nextMediaOrder =
        freshProduct.images.map(
          (image) => image.id,
        );

      setMediaOrder(nextMediaOrder);
      setMediaOrderBaseline(nextMediaOrder);
      setDraggedMediaId(null);
      setDropTargetMediaId(null);
    } catch (error) {
      setProduct(null);

      setMessage(
        error instanceof Error
          ? error.message
          : 'دریافت جزئیات محصول انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }, [productId]);

  function availableProductTypes() {
    if (!catalog || !categoryIdDraft) {
      return [];
    }

    return catalog.productTypes.filter(
      (option) =>
        option.categoryId === categoryIdDraft,
    );
  }

  function availableProductModels() {
    if (
      !catalog ||
      !brandIdDraft ||
      !productTypeIdDraft
    ) {
      return [];
    }

    return catalog.productModels.filter(
      (option) =>
        option.brandId === brandIdDraft &&
        option.productTypeId ===
          productTypeIdDraft,
    );
  }

  function changeCategory(nextCategoryId: string) {
    setCategoryIdDraft(nextCategoryId);

    const selectedType =
      catalog?.productTypes.find(
        (option) =>
          option.id === productTypeIdDraft,
      );

    if (
      selectedType &&
      selectedType.categoryId !==
        nextCategoryId
    ) {
      setProductTypeIdDraft('');
      setProductModelIdDraft('');
    }
  }

  function changeBrand(nextBrandId: string) {
    setBrandIdDraft(nextBrandId);

    const selectedModel =
      catalog?.productModels.find(
        (option) =>
          option.id === productModelIdDraft,
      );

    if (
      selectedModel &&
      selectedModel.brandId !== nextBrandId
    ) {
      setProductModelIdDraft('');
    }
  }

  function changeProductType(
    nextProductTypeId: string,
  ) {
    setProductTypeIdDraft(nextProductTypeId);

    const selectedModel =
      catalog?.productModels.find(
        (option) =>
          option.id === productModelIdDraft,
      );

    if (
      selectedModel &&
      selectedModel.productTypeId !==
        nextProductTypeId
    ) {
      setProductModelIdDraft('');
    }
  }

  function clearSelectedMedia() {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setMediaAltText('');
    setMediaTitle('');
    setMediaCaption('');
    setMediaPrimary(false);
    setMediaDragging(false);
    setMediaInputKey((current) => current + 1);
  }

  function selectMediaFile(file: File | null) {
    setActionFeedback(null);

    if (!file) {
      clearSelectedMedia();
      return;
    }

    if (!productMediaMimeTypes.has(file.type)) {
      clearSelectedMedia();

      setActionFeedback({
        tone: 'error',
        message:
          'فقط تصاویر JPEG، PNG، WebP، GIF، AVIF و ویدئوهای MP4 یا WebM مجاز هستند.',
      });

      return;
    }

    if (
      file.size <= 0 ||
      file.size > productMediaMaxFileSize
    ) {
      clearSelectedMedia();

      setActionFeedback({
        tone: 'error',
        message:
          'حجم فایل باید بیشتر از صفر و حداکثر ۱۰ مگابایت باشد.',
      });

      return;
    }

    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));

    const nameWithoutExtension =
      file.name.replace(/\.[^.]+$/, '').trim();

    setMediaAltText(
      nameWithoutExtension || product?.name || '',
    );

    setMediaTitle(
      nameWithoutExtension || product?.name || '',
    );
  }

  async function submitProductMedia(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !mediaFile ||
      mediaPending ||
      identityPending ||
      pricingPending ||
      statusPending ||
      product?.deletedAt
    ) {
      return;
    }

    setMediaPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const formData = new FormData();

      formData.append(
        'file',
        mediaFile,
        mediaFile.name,
      );

      formData.append(
        'type',
        mediaFile.type.startsWith('video/')
          ? 'VIDEO'
          : 'IMAGE',
      );

      if (mediaAltText.trim()) {
        formData.append(
          'altText',
          mediaAltText.trim(),
        );
      }

      if (mediaTitle.trim()) {
        formData.append(
          'title',
          mediaTitle.trim(),
        );
      }

      if (mediaCaption.trim()) {
        formData.append(
          'caption',
          mediaCaption.trim(),
        );
      }

      formData.append(
        'isPrimary',
        String(mediaPrimary),
      );

      formData.append('isActive', 'true');

      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/media/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'آپلود رسانه محصول انجام نشد.',
        );
      }

      clearSelectedMedia();

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'رسانه محصول با موفقیت آپلود و ثبت شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'آپلود رسانه محصول انجام نشد.',
      });
    } finally {
      setMediaPending(false);
    }
  }

  function mediaOrderChanged() {
    return (
      mediaOrder.length ===
        mediaOrderBaseline.length &&
      mediaOrder.some(
        (imageId, index) =>
          imageId !== mediaOrderBaseline[index],
      )
    );
  }

  function isPrimaryMedia(imageId: string) {
    return Boolean(
      product?.images.find(
        (image) => image.id === imageId,
      )?.isPrimary,
    );
  }

  function moveMediaBefore(
    sourceId: string,
    targetId: string,
  ) {
    if (
      sourceId === targetId ||
      isPrimaryMedia(sourceId) ||
      isPrimaryMedia(targetId) ||
      mediaReorderPending ||
      mediaAction
    ) {
      return;
    }

    setMediaOrder((current) => {
      const sourceIndex =
        current.indexOf(sourceId);

      const targetIndex =
        current.indexOf(targetId);

      if (
        sourceIndex < 0 ||
        targetIndex < 0
      ) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(
        sourceIndex,
        1,
      );

      const insertionIndex =
        sourceIndex < targetIndex
          ? targetIndex - 1
          : targetIndex;

      next.splice(
        insertionIndex,
        0,
        moved,
      );

      return next;
    });
  }

  function moveMediaByDirection(
    imageId: string,
    direction: -1 | 1,
  ) {
    if (
      isPrimaryMedia(imageId) ||
      mediaReorderPending ||
      mediaAction
    ) {
      return;
    }

    setMediaOrder((current) => {
      const movableIds = current.filter(
        (id) => !isPrimaryMedia(id),
      );

      const movableIndex =
        movableIds.indexOf(imageId);

      const targetMovableIndex =
        movableIndex + direction;

      if (
        movableIndex < 0 ||
        targetMovableIndex < 0 ||
        targetMovableIndex >=
          movableIds.length
      ) {
        return current;
      }

      const targetId =
        movableIds[targetMovableIndex];

      const sourceIndex =
        current.indexOf(imageId);

      const targetIndex =
        current.indexOf(targetId);

      const next = [...current];

      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];

      return next;
    });
  }

  function resetMediaOrder() {
    if (
      mediaReorderPending ||
      mediaAction
    ) {
      return;
    }

    setMediaOrder(mediaOrderBaseline);
    setDraggedMediaId(null);
    setDropTargetMediaId(null);
    setActionFeedback(null);
  }

  async function saveMediaOrder() {
    if (
      !product ||
      !mediaOrderChanged() ||
      mediaReorderPending ||
      mediaAction ||
      product.deletedAt
    ) {
      return;
    }

    setMediaReorderPending(true);
    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/media/reorder`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: mediaOrder.map(
              (imageId, index) => ({
                imageId,
                sortOrder: index,
              }),
            ),
          }),
        },
      );

      const success =
        await readAdminActionResponse(
          response,
          'ذخیره ترتیب رسانه‌ها انجام نشد.',
        );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'ترتیب رسانه‌های محصول با موفقیت ذخیره شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ذخیره ترتیب رسانه‌ها انجام نشد.',
      });
    } finally {
      setMediaReorderPending(false);
      setDraggedMediaId(null);
      setDropTargetMediaId(null);
    }
  }

  function updateMediaDraft(
    imageId: string,
    field: keyof ProductMediaDraft,
    value: string,
  ) {
    setMediaDrafts((current) => ({
      ...current,
      [imageId]: {
        altText:
          current[imageId]?.altText ?? '',
        title:
          current[imageId]?.title ?? '',
        caption:
          current[imageId]?.caption ?? '',
        [field]: value,
      },
    }));
  }

  async function readAdminActionResponse(
    response: Response,
    fallbackMessage: string,
  ) {
    const envelope =
      (await response.json()) as AdminApiEnvelope<unknown>;

    if (response.status === 401) {
      window.location.href =
        `/admin/login?next=${encodeURIComponent(
          `/admin/products/${productId}`,
        )}`;

      return false;
    }

    if (
      !response.ok ||
      envelope.success !== true
    ) {
      throw new Error(
        envelope.message || fallbackMessage,
      );
    }

    return true;
  }

  async function saveProductMedia(
    imageId: string,
  ) {
    const image = product?.images.find(
      (item) => item.id === imageId,
    );

    const draft = mediaDrafts[imageId];

    if (
      !image ||
      !draft ||
      mediaAction ||
      product?.deletedAt
    ) {
      return;
    }

    const altText = draft.altText.trim();
    const title = draft.title.trim();
    const caption = draft.caption.trim();

    const body: Record<string, string> = {};

    if (
      altText &&
      altText !== (image.altText ?? '')
    ) {
      body.altText = altText;
    }

    if (
      title &&
      title !== (image.title ?? '')
    ) {
      body.title = title;
    }

    if (
      caption &&
      caption !== (image.caption ?? '')
    ) {
      body.caption = caption;
    }

    if (Object.keys(body).length === 0) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر قابل ذخیره‌ای برای این رسانه وجود ندارد. خالی‌کردن فیلدها فعلاً مقدار قبلی را حذف نمی‌کند.',
      });

      return;
    }

    setMediaAction({
      imageId,
      action: 'save',
    });

    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/media/${encodeURIComponent(
          imageId,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      const success =
        await readAdminActionResponse(
          response,
          'ویرایش اطلاعات رسانه انجام نشد.',
        );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'اطلاعات رسانه با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش اطلاعات رسانه انجام نشد.',
      });
    } finally {
      setMediaAction(null);
    }
  }

  async function makeProductMediaPrimary(
    imageId: string,
  ) {
    const image = product?.images.find(
      (item) => item.id === imageId,
    );

    if (
      !image ||
      image.isPrimary ||
      mediaAction ||
      product?.deletedAt
    ) {
      return;
    }

    setMediaAction({
      imageId,
      action: 'primary',
    });

    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/media/${encodeURIComponent(
          imageId,
        )}/primary`,
        {
          method: 'PATCH',
        },
      );

      const success =
        await readAdminActionResponse(
          response,
          'انتخاب تصویر اصلی انجام نشد.',
        );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'تصویر اصلی محصول با موفقیت تغییر کرد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'انتخاب تصویر اصلی انجام نشد.',
      });
    } finally {
      setMediaAction(null);
    }
  }

  async function deleteProductMedia(
    imageId: string,
  ) {
    const image = product?.images.find(
      (item) => item.id === imageId,
    );

    if (
      !image ||
      mediaAction ||
      product?.deletedAt
    ) {
      return;
    }

    const confirmed = window.confirm(
      image.isPrimary
        ? 'این رسانه تصویر اصلی محصول است. با حذف آن، رسانه از گالری کنار می‌رود و فایل فیزیکی در Storage باقی می‌ماند. ادامه می‌دهید؟'
        : 'این رسانه از گالری محصول کنار گذاشته می‌شود، اما فایل فیزیکی در Storage باقی می‌ماند. ادامه می‌دهید؟',
    );

    if (!confirmed) {
      return;
    }

    setMediaAction({
      imageId,
      action: 'delete',
    });

    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/media/${encodeURIComponent(
          imageId,
        )}`,
        {
          method: 'DELETE',
        },
      );

      const success =
        await readAdminActionResponse(
          response,
          'حذف رسانه انجام نشد.',
        );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'رسانه با موفقیت از گالری محصول حذف شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'حذف رسانه انجام نشد.',
      });
    } finally {
      setMediaAction(null);
    }
  }

  async function updateProduct(
    body: Record<string, string>,
    fallbackMessage: string,
  ) {
    const response = await fetch(
      `/api/admin/products/${encodeURIComponent(
        productId,
      )}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    const envelope =
      (await response.json()) as AdminApiEnvelope<unknown>;

    if (response.status === 401) {
      window.location.href =
        `/admin/login?next=${encodeURIComponent(
          `/admin/products/${productId}`,
        )}`;

      return false;
    }

    if (
      !response.ok ||
      envelope.success !== true
    ) {
      throw new Error(
        envelope.message || fallbackMessage,
      );
    }

    return true;
  }

  async function submitProductIdentity(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      identityPending ||
      pricingPending ||
      statusPending ||
      product?.deletedAt
    ) {
      return;
    }

    const name = nameDraft.trim();
    const slug = slugDraft.trim();
    const sku = skuDraft.trim();

    if (!name) {
      setActionFeedback({
        tone: 'error',
        message: 'نام محصول را وارد کنید.',
      });
      return;
    }

    if (!slug) {
      setActionFeedback({
        tone: 'error',
        message: 'اسلاگ محصول را وارد کنید.',
      });
      return;
    }

    if (!sku) {
      setActionFeedback({
        tone: 'error',
        message: 'SKU محصول را وارد کنید.',
      });
      return;
    }

    if (
      !brandIdDraft ||
      !categoryIdDraft ||
      !productTypeIdDraft ||
      !productModelIdDraft
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'برند، دسته‌بندی، نوع محصول و مدل محصول را کامل انتخاب کنید.',
      });

      return;
    }

    if (!product) {
      return;
    }

    const shortDescription =
      shortDescriptionDraft.trim();

    const description =
      descriptionDraft.trim();

    const updateBody: Record<string, string> =
      {};

    if (name !== product.name) {
      updateBody.name = name;
    }

    if (slug !== product.slug) {
      updateBody.slug = slug;
    }

    if (sku !== product.sku) {
      updateBody.sku = sku;
    }

    if (
      shortDescription &&
      shortDescription !==
        (product.shortDescription ?? '')
    ) {
      updateBody.shortDescription =
        shortDescription;
    }

    if (
      description &&
      description !==
        (product.description ?? '')
    ) {
      updateBody.description = description;
    }

    if (
      brandIdDraft !==
      (product.brand.id ?? '')
    ) {
      updateBody.brandId = brandIdDraft;
    }

    if (
      categoryIdDraft !==
      (product.category.id ?? '')
    ) {
      updateBody.categoryId =
        categoryIdDraft;
    }

    if (
      productTypeIdDraft !==
      (product.productType.id ?? '')
    ) {
      updateBody.productTypeId =
        productTypeIdDraft;
    }

    if (
      productModelIdDraft !==
      (product.productModel.id ?? '')
    ) {
      updateBody.productModelId =
        productModelIdDraft;
    }

    if (Object.keys(updateBody).length === 0) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر قابل ذخیره‌ای در اطلاعات محصول وجود ندارد.',
      });

      return;
    }

    setIdentityPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const success = await updateProduct(
        updateBody,
        'ویرایش اطلاعات محصول انجام نشد.',
      );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'اطلاعات اصلی محصول با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش اطلاعات محصول انجام نشد.',
      });
    } finally {
      setIdentityPending(false);
    }
  }

  async function submitProductSeo(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      seoPending ||
      identityPending ||
      pricingPending ||
      statusPending ||
      product?.deletedAt ||
      !product
    ) {
      return;
    }

    const seoTitle = seoTitleDraft.trim();
    const seoDescription =
      seoDescriptionDraft.trim();

    const canonicalUrl =
      canonicalUrlDraft.trim();

    let schemaJson:
      | Record<string, unknown>
      | null = null;

    if (schemaJsonDraft.trim()) {
      try {
        const parsed = JSON.parse(
          schemaJsonDraft,
        ) as unknown;

        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error(
            'Schema JSON باید یک شیء JSON باشد.',
          );
        }

        schemaJson =
          parsed as Record<string, unknown>;

        setSchemaJsonError(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Schema JSON معتبر نیست.';

        setSchemaJsonError(message);

        setActionFeedback({
          tone: 'error',
          message,
        });

        return;
      }
    } else {
      setSchemaJsonError(null);
    }

    if (seoTitle.length > 180) {
      setActionFeedback({
        tone: 'error',
        message:
          'عنوان SEO نباید بیش از ۱۸۰ کاراکتر باشد.',
      });

      return;
    }

    if (seoDescription.length > 500) {
      setActionFeedback({
        tone: 'error',
        message:
          'توضیحات SEO نباید بیش از ۵۰۰ کاراکتر باشد.',
      });

      return;
    }

    if (canonicalUrl) {
      try {
        const url = new URL(canonicalUrl);

        if (
          url.protocol !== 'http:' &&
          url.protocol !== 'https:'
        ) {
          throw new Error();
        }
      } catch {
        setActionFeedback({
          tone: 'error',
          message:
            'Canonical URL معتبر نیست.',
        });

        return;
      }
    }

    const updateBody: Record<
      string,
      string | null | Record<string, unknown>
    > = {};

    const currentTitle =
      product.seo.title ?? '';

    const currentDescription =
      product.seo.description ?? '';

    const currentCanonical =
      product.seo.canonicalUrl ?? '';

    const currentSchema =
      product.seo.schemaJson
        ? JSON.stringify(
            product.seo.schemaJson,
          )
        : '';

    if (seoTitle !== currentTitle) {
      updateBody.seoTitle =
        seoTitle || null;
    }

    if (
      seoDescription !==
      currentDescription
    ) {
      updateBody.seoDescription =
        seoDescription || null;
    }

    if (
      canonicalUrl !== currentCanonical
    ) {
      updateBody.canonicalUrl =
        canonicalUrl || null;
    }

    const nextSchema =
      schemaJson === null
        ? ''
        : JSON.stringify(schemaJson);

    if (nextSchema !== currentSchema) {
      updateBody.schemaJson = schemaJson;
    }

    if (Object.keys(updateBody).length === 0) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر قابل ذخیره‌ای در تنظیمات SEO وجود ندارد.',
      });

      return;
    }

    setSeoPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ذخیره تنظیمات SEO انجام نشد.',
        );
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'تنظیمات SEO محصول با موفقیت ذخیره شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ذخیره تنظیمات SEO انجام نشد.',
      });
    } finally {
      setSeoPending(false);
    }
  }

  async function submitProductVariant(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      variantCreatePending ||
      variantsLoading ||
      inventoryPending ||
      identityPending ||
      pricingPending ||
      seoPending ||
      statusPending ||
      product?.deletedAt ||
      !product
    ) {
      return;
    }

    const sku = variantSkuDraft.trim();
    const name = variantNameDraft.trim();
    const price = variantPriceDraft.trim();

    const comparePrice =
      variantComparePriceDraft.trim();

    if (!sku) {
      setActionFeedback({
        tone: 'error',
        message: 'SKU واریانت را وارد کنید.',
      });

      return;
    }

    if (sku.length > 120) {
      setActionFeedback({
        tone: 'error',
        message:
          'SKU واریانت نباید بیش از ۱۲۰ کاراکتر باشد.',
      });

      return;
    }

    const moneyPattern =
      /^\d+(\.\d{1,2})?$/;

    if (price && !moneyPattern.test(price)) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت واریانت باید عددی نامنفی با حداکثر دو رقم اعشار باشد.',
      });

      return;
    }

    if (
      comparePrice &&
      !moneyPattern.test(comparePrice)
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت مقایسه‌ای باید عددی نامنفی با حداکثر دو رقم اعشار باشد.',
      });

      return;
    }

    if (
      price &&
      comparePrice &&
      Number(comparePrice) < Number(price)
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت مقایسه‌ای نباید کمتر از قیمت واریانت باشد.',
      });

      return;
    }

    setVariantCreatePending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        '/api/admin/product-variants',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId,
            sku,
            ...(name ? { name } : {}),
            ...(price ? { price } : {}),
            ...(comparePrice
              ? { comparePrice }
              : {}),
            isActive: variantActiveDraft,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ایجاد واریانت محصول انجام نشد.',
        );
      }

      setVariantSkuDraft('');
      setVariantNameDraft('');
      setVariantPriceDraft('');
      setVariantComparePriceDraft('');
      setVariantActiveDraft(true);

      await Promise.all([
        loadVariants(),
        loadProduct(),
        loadInventory(),
      ]);

      setActionFeedback({
        tone: 'success',
        message:
          'واریانت محصول با موفقیت ایجاد شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ایجاد واریانت محصول انجام نشد.',
      });
    } finally {
      setVariantCreatePending(false);
    }
  }

  async function toggleProductVariant(
    variant: AdminProductVariantListItem,
  ) {
    if (
      variantActionId ||
      variantCreatePending ||
      product?.deletedAt
    ) {
      return;
    }

    setVariantActionId(variant.id);
    setActionFeedback(null);

    try {
      const action = variant.isActive
        ? 'deactivate'
        : 'activate';

      const response = await fetch(
        `/api/admin/product-variants/${encodeURIComponent(
          variant.id,
        )}/${action}`,
        {
          method: 'PATCH',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'تغییر وضعیت واریانت انجام نشد.',
        );
      }

      await Promise.all([
        loadVariants(),
        loadProduct(),
        loadInventory(),
      ]);

      setActionFeedback({
        tone: 'success',
        message: variant.isActive
          ? 'واریانت با موفقیت غیرفعال شد.'
          : 'واریانت با موفقیت فعال شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تغییر وضعیت واریانت انجام نشد.',
      });
    } finally {
      setVariantActionId(null);
    }
  }

  function beginVariantEdit(
    variant: AdminProductVariantListItem,
  ) {
    if (
      variantActionId ||
      variantCreatePending ||
      variantEditPending ||
      variantPricePending ||
      variantDeletePending
    ) {
      return;
    }

    setEditingVariantId(variant.id);

    setVariantEditDraft({
      sku: variant.sku,
      name: variant.name ?? '',
      barcode: variant.barcode ?? '',
      gtin: variant.gtin ?? '',
      mpn: variant.mpn ?? '',
      price: variant.price ?? '',
      comparePrice: variant.comparePrice ?? '',
    });

    setActionFeedback(null);
  }

  function cancelVariantEdit() {
    if (
      variantEditPending ||
      variantPricePending ||
      variantDeletePending
    ) {
      return;
    }

    setEditingVariantId(null);
    setVariantEditDraft(null);
  }

  function updateVariantEditDraft(
    field: keyof ProductVariantEditDraft,
    value: string,
  ) {
    setVariantEditDraft((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function saveVariantIdentity(
    variant: AdminProductVariantListItem,
  ) {
    if (
      !variantEditDraft ||
      editingVariantId !== variant.id ||
      variantEditPending ||
      variantPricePending ||
      variantDeletePending
    ) {
      return;
    }

    const sku = variantEditDraft.sku.trim();
    const name = variantEditDraft.name.trim();
    const barcode =
      variantEditDraft.barcode.trim();

    const gtin = variantEditDraft.gtin.trim();
    const mpn = variantEditDraft.mpn.trim();

    if (!sku) {
      setActionFeedback({
        tone: 'error',
        message: 'SKU واریانت الزامی است.',
      });

      return;
    }

    if (sku.length > 120) {
      setActionFeedback({
        tone: 'error',
        message:
          'SKU واریانت نباید بیش از ۱۲۰ کاراکتر باشد.',
      });

      return;
    }

    if (name.length > 180) {
      setActionFeedback({
        tone: 'error',
        message:
          'نام واریانت نباید بیش از ۱۸۰ کاراکتر باشد.',
      });

      return;
    }

    const barcodePattern =
      /^[A-Za-z0-9._/+:-]+$/;

    if (
      barcode &&
      (
        barcode.length > 64 ||
        !barcodePattern.test(barcode)
      )
    ) {
      setActionFeedback({
        tone: 'error',
        message: 'بارکد واریانت معتبر نیست.',
      });

      return;
    }

    const gtinPattern =
      /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

    if (gtin && !gtinPattern.test(gtin)) {
      setActionFeedback({
        tone: 'error',
        message:
          'GTIN باید شامل ۸، ۱۲، ۱۳ یا ۱۴ رقم باشد.',
      });

      return;
    }

    if (mpn.length > 120) {
      setActionFeedback({
        tone: 'error',
        message:
          'MPN نباید بیش از ۱۲۰ کاراکتر باشد.',
      });

      return;
    }

    const updateBody: Record<
      string,
      string | null
    > = {};

    if (sku !== variant.sku) {
      updateBody.sku = sku;
    }

    if (name && name !== (variant.name ?? '')) {
      updateBody.name = name;
    }

    if (barcode !== (variant.barcode ?? '')) {
      updateBody.barcode =
        barcode || null;
    }

    if (gtin !== (variant.gtin ?? '')) {
      updateBody.gtin = gtin || null;
    }

    if (mpn !== (variant.mpn ?? '')) {
      updateBody.mpn = mpn || null;
    }

    if (Object.keys(updateBody).length === 0) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر هویتی قابل ذخیره‌ای وجود ندارد.',
      });

      return;
    }

    setVariantEditPending(true);
    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/product-variants/${encodeURIComponent(
          variant.id,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ویرایش مشخصات واریانت انجام نشد.',
        );
      }

      const refreshedVariants =
        await loadVariants();

      const refreshedVariant =
        refreshedVariants.find(
          (item) => item.id === variant.id,
        );

      if (refreshedVariant) {
        setVariantEditDraft({
          sku: refreshedVariant.sku,
          name: refreshedVariant.name ?? '',
          barcode:
            refreshedVariant.barcode ?? '',
          gtin: refreshedVariant.gtin ?? '',
          mpn: refreshedVariant.mpn ?? '',
          price: refreshedVariant.price ?? '',
          comparePrice:
            refreshedVariant.comparePrice ?? '',
        });
      }

      setActionFeedback({
        tone: 'success',
        message:
          'مشخصات واریانت با موفقیت ذخیره شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش مشخصات واریانت انجام نشد.',
      });
    } finally {
      setVariantEditPending(false);
    }
  }

  async function saveVariantPrice(
    variant: AdminProductVariantListItem,
  ) {
    if (
      !variantEditDraft ||
      editingVariantId !== variant.id ||
      variantEditPending ||
      variantPricePending ||
      variantDeletePending
    ) {
      return;
    }

    const price =
      variantEditDraft.price.trim();

    const comparePrice =
      variantEditDraft.comparePrice.trim();

    const moneyPattern =
      /^\d+(\.\d{1,2})?$/;

    if (price && !moneyPattern.test(price)) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت واریانت معتبر نیست.',
      });

      return;
    }

    if (
      comparePrice &&
      !moneyPattern.test(comparePrice)
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت مقایسه‌ای واریانت معتبر نیست.',
      });

      return;
    }

    if (
      price &&
      comparePrice &&
      Number(comparePrice) < Number(price)
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'قیمت مقایسه‌ای نباید کمتر از قیمت واریانت باشد.',
      });

      return;
    }

    const currentPrice = variant.price ?? '';
    const currentComparePrice =
      variant.comparePrice ?? '';

    const updateBody: Record<
      string,
      string | null
    > = {};

    if (price !== currentPrice) {
      updateBody.price = price || null;
    }

    if (comparePrice !== currentComparePrice) {
      updateBody.comparePrice =
        comparePrice || null;
    }

    if (Object.keys(updateBody).length === 0) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر قیمتی قابل ذخیره‌ای وجود ندارد.',
      });

      return;
    }

    setVariantPricePending(true);
    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/product-variants/${encodeURIComponent(
          variant.id,
        )}/price`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateBody),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ویرایش قیمت واریانت انجام نشد.',
        );
      }

      await Promise.all([
        loadVariants(),
        loadProduct(),
      ]);

      setVariantEditDraft((current) =>
        current
          ? {
              ...current,
              price,
              comparePrice,
            }
          : current,
      );

      setActionFeedback({
        tone: 'success',
        message:
          'قیمت واریانت با موفقیت ذخیره شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش قیمت واریانت انجام نشد.',
      });
    } finally {
      setVariantPricePending(false);
    }
  }

  async function deleteProductVariant(
    variant: AdminProductVariantListItem,
  ) {
    if (
      variantDeletePending ||
      variantEditPending ||
      variantPricePending ||
      variantActionId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `واریانت «${
        variant.name || variant.sku
      }» حذف شود؟ این عملیات حذف نرم است.`,
    );

    if (!confirmed) {
      return;
    }

    setVariantDeletePending(true);
    setActionFeedback(null);

    try {
      const response = await fetch(
        `/api/admin/product-variants/${encodeURIComponent(
          variant.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'حذف واریانت انجام نشد.',
        );
      }

      setEditingVariantId(null);
      setVariantEditDraft(null);

      await Promise.all([
        loadVariants(),
        loadProduct(),
        loadInventory(),
      ]);

      setActionFeedback({
        tone: 'success',
        message:
          'واریانت با موفقیت حذف شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'حذف واریانت انجام نشد.',
      });
    } finally {
      setVariantDeletePending(false);
    }
  }

  async function submitProductInventory(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      inventoryPending ||
      inventoryLoading ||
      identityPending ||
      pricingPending ||
      seoPending ||
      statusPending ||
      product?.deletedAt ||
      !product
    ) {
      return;
    }

    const hasComplexInventory =
      product.stock.variantCount > 1 ||
      product.stock.warehouseCount > 1 ||
      inventoryItems.length > 1;

    if (hasComplexInventory) {
      setActionFeedback({
        tone: 'error',
        message:
          'این محصول دارای چند واریانت یا چند انبار است و باید از مدیریت پیشرفته موجودی ویرایش شود.',
      });

      return;
    }

    if (!warehouseIdDraft) {
      setActionFeedback({
        tone: 'error',
        message: 'انبار محصول را انتخاب کنید.',
      });

      return;
    }

    if (
      stockQuantityDraft.trim() === '' ||
      lowStockThresholdDraft.trim() === ''
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'موجودی و آستانه کمبود را وارد کنید.',
      });

      return;
    }

    const stockQuantity = Number(
      stockQuantityDraft,
    );

    const lowStockThreshold = Number(
      lowStockThresholdDraft,
    );

    if (
      !Number.isInteger(stockQuantity) ||
      stockQuantity < 0
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'موجودی باید یک عدد صحیح نامنفی باشد.',
      });

      return;
    }

    if (
      !Number.isInteger(lowStockThreshold) ||
      lowStockThreshold < 0
    ) {
      setActionFeedback({
        tone: 'error',
        message:
          'آستانه کمبود باید یک عدد صحیح نامنفی باشد.',
      });

      return;
    }

    const currentInventory =
      inventoryItems.length === 1
        ? inventoryItems[0]
        : null;

    const reservedQuantity =
      currentInventory?.reservedQuantity ?? 0;

    if (stockQuantity < reservedQuantity) {
      setActionFeedback({
        tone: 'error',
        message:
          `موجودی کل نمی‌تواند کمتر از موجودی رزروشده (${new Intl.NumberFormat(
            'fa-IR',
          ).format(reservedQuantity)}) باشد.`,
      });

      return;
    }

    const hasChanges =
      !currentInventory ||
      warehouseIdDraft !==
        currentInventory.warehouse.id ||
      stockQuantity !==
        currentInventory.quantity ||
      lowStockThreshold !==
        currentInventory.lowStockThreshold;

    if (!hasChanges) {
      setActionFeedback({
        tone: 'error',
        message:
          'تغییر قابل ذخیره‌ای در موجودی محصول وجود ندارد.',
      });

      return;
    }

    setInventoryPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            defaultWarehouseId:
              warehouseIdDraft,
            stockQuantity,
            lowStockThreshold,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'ویرایش موجودی محصول انجام نشد.',
        );
      }

      await Promise.all([
        loadProduct(),
        loadInventory(),
      ]);

      setActionFeedback({
        tone: 'success',
        message:
          'موجودی محصول با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش موجودی محصول انجام نشد.',
      });
    } finally {
      setInventoryPending(false);
    }
  }

  async function submitProductPricing(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      pricingPending ||
      identityPending ||
      statusPending ||
      product?.deletedAt
    ) {
      return;
    }

    const price = priceDraft.trim();

    if (!price) {
      setActionFeedback({
        tone: 'error',
        message: 'قیمت پایه را وارد کنید.',
      });
      return;
    }

    setPricingPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const success = await updateProduct(
        {
          price,
          ...(comparePriceDraft.trim()
            ? {
                comparePrice:
                  comparePriceDraft.trim(),
              }
            : {}),
          ...(purchasePriceDraft.trim()
            ? {
                purchasePrice:
                  purchasePriceDraft.trim(),
              }
            : {}),
          ...(salePriceDraft.trim()
            ? {
                salePrice:
                  salePriceDraft.trim(),
              }
            : {}),
        },
        'ویرایش قیمت‌گذاری محصول انجام نشد.',
      );

      if (!success) {
        return;
      }

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'قیمت‌گذاری محصول با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'ویرایش قیمت‌گذاری محصول انجام نشد.',
      });
    } finally {
      setPricingPending(false);
    }
  }

  async function submitProductStatus(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !statusDraft ||
      statusPending ||
      product?.deletedAt
    ) {
      return;
    }

    setStatusPending(true);
    setActionFeedback(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(
          productId,
        )}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: statusDraft,
            isActive: activeDraft,
            reason:
              statusReason.trim() ||
              undefined,
          }),
        },
      );

      const envelope =
        (await response.json()) as AdminApiEnvelope<unknown>;

      if (response.status === 401) {
        window.location.href =
          `/admin/login?next=${encodeURIComponent(
            `/admin/products/${productId}`,
          )}`;

        return;
      }

      if (
        !response.ok ||
        envelope.success !== true
      ) {
        throw new Error(
          envelope.message ||
            'تغییر وضعیت محصول انجام نشد.',
        );
      }

      setStatusReason('');

      await loadProduct();

      setActionFeedback({
        tone: 'success',
        message:
          'وضعیت محصول با موفقیت به‌روزرسانی شد.',
      });
    } catch (error) {
      setActionFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تغییر وضعیت محصول انجام نشد.',
      });
    } finally {
      setStatusPending(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadProduct(),
        loadCatalog(),
        loadInventory(),
        loadVariants(),
      ]);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    loadCatalog,
    loadInventory,
    loadProduct,
    loadVariants,
  ]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl) {
        URL.revokeObjectURL(mediaPreviewUrl);
      }
    };
  }, [mediaPreviewUrl]);

  if (loading) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="جزئیات محصول"
          subtitle="در حال دریافت اطلاعات محصول"
          refreshing
        />

        <section className="admin-product-detail-state">
          <LoaderCircle
            className="is-spinning"
            aria-hidden="true"
          />

          <strong>
            در حال دریافت جزئیات محصول...
          </strong>
        </section>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="محصول پیدا نشد"
          subtitle="شناسه محصول معتبر نیست یا محصول در دسترس نیست"
        />

        <section className="admin-product-detail-state">
          <XCircle aria-hidden="true" />

          <strong>
            محصول موردنظر پیدا نشد
          </strong>

          <p>
            ممکن است محصول حذف شده باشد یا شناسهٔ
            ارسال‌شده معتبر نباشد.
          </p>

          <Link
            href="/admin/products"
            className="button button--primary"
          >
            بازگشت به محصولات
            <ArrowLeft aria-hidden="true" />
          </Link>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="admin-page">
        <AdminHeader
          title="جزئیات محصول"
          subtitle="اطلاعات محصول دریافت نشد"
          onRefresh={loadProduct}
        />

        <section className="admin-product-detail-state">
          <AlertTriangle aria-hidden="true" />

          <strong>
            دریافت محصول امکان‌پذیر نبود
          </strong>

          <p>
            {message ||
              'ارتباط با سرویس محصولات را بررسی کنید.'}
          </p>

          <button
            type="button"
            className="button button--primary"
            onClick={loadProduct}
          >
            تلاش دوباره
            <RefreshCcw aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  const stock = stockState(product);

  const currentInventory =
    inventoryItems.length === 1
      ? inventoryItems[0]
      : null;

  const quickInventoryBlocked =
    product.stock.variantCount > 1 ||
    product.stock.warehouseCount > 1 ||
    inventoryItems.length > 1;

  const reservedInventoryQuantity =
    currentInventory?.reservedQuantity ?? 0;

  const targetInventoryQuantity =
    Number.isInteger(
      Number(stockQuantityDraft),
    )
      ? Math.max(
          0,
          Number(stockQuantityDraft),
        )
      : 0;

  const projectedAvailableQuantity =
    Math.max(
      0,
      targetInventoryQuantity -
        reservedInventoryQuantity,
    );

  const dimensionsJson = stringifyJson(
    product.dimensions,
  );

  return (
    <main className="admin-page">
      <AdminHeader
        title={product.name}
        subtitle={`SKU: ${product.sku}`}
        onRefresh={loadProduct}
        refreshing={loading}
      />

      <nav
        className="admin-product-detail-breadcrumbs"
        aria-label="مسیر صفحه"
      >
        <Link href="/admin">داشبورد</Link>
        <ArrowLeft aria-hidden="true" />

        <Link href="/admin/products">
          محصولات
        </Link>
        <ArrowLeft aria-hidden="true" />

        <span>{product.name}</span>
      </nav>

      {actionFeedback ? (
        <p
          className={`admin-product-action-feedback is-${actionFeedback.tone}`}
          role={
            actionFeedback.tone === 'error'
              ? 'alert'
              : 'status'
          }
        >
          {actionFeedback.message}
        </p>
      ) : null}

      {product.deletedAt ? (
        <section className="admin-product-deleted-banner">
          <AlertTriangle aria-hidden="true" />

          <div>
            <strong>
              این محصول حذف نرم شده است
            </strong>

            <span>
              {formatDate(
                product.deletedAt,
                product.deletedAtFa,
              )}
            </span>
          </div>
        </section>
      ) : null}

      <section className="admin-product-detail-hero">
        <div className="admin-product-detail-hero__image">
          {product.primaryImage.url ? (
            <Image
              src={product.primaryImage.url}
              alt={
                product.primaryImage.altText ||
                product.name
              }
              width={240}
              height={240}
              sizes="(max-width: 680px) 160px, 240px"
              unoptimized
            />
          ) : (
            <ImageOff aria-hidden="true" />
          )}
        </div>

        <div className="admin-product-detail-hero__copy">
          <span className="panel-label">
            PRODUCT DETAIL
          </span>

          <h2>{product.name}</h2>

          {product.shortDescription ? (
            <p>{product.shortDescription}</p>
          ) : null}

          <dl>
            <div>
              <dt>SKU</dt>
              <dd>
                <bdi dir="ltr">{product.sku}</bdi>
              </dd>
            </div>

            <div>
              <dt>Slug</dt>
              <dd>
                <bdi dir="ltr">{product.slug}</bdi>
              </dd>
            </div>

            <div>
              <dt>شناسه</dt>
              <dd>
                <bdi dir="ltr">{product.id}</bdi>
              </dd>
            </div>
          </dl>
        </div>

        <div className="admin-product-detail-hero__badges">
          <span
            className={`admin-product-status is-${product.status.toLowerCase()}`}
          >
            {statusLabels[product.status] ||
              product.status}
          </span>

          <span
            className={
              product.isActive
                ? 'admin-product-active-badge is-active'
                : 'admin-product-active-badge is-inactive'
            }
          >
            {product.isActive
              ? 'فعال در فروشگاه'
              : 'غیرفعال'}
          </span>

          <span
            className={`admin-product-stock-badge ${stock.className}`}
          >
            {stock.label}
          </span>
        </div>
      </section>

      <section className="admin-product-detail-metrics">
        <article>
          <span>
            <CircleDollarSign aria-hidden="true" />
          </span>

          <div>
            <small>قیمت نهایی</small>
            <strong>
              {formatMoney(
                finalProductPrice(product),
              )}
              {' '}
              ریال
            </strong>
          </div>
        </article>

        <article>
          <span>
            <Boxes aria-hidden="true" />
          </span>

          <div>
            <small>موجودی قابل فروش</small>
            <strong>
              {formatNumber(
                product.stock.availableStock,
              )}
            </strong>
          </div>
        </article>

        <article>
          <span>
            <BarChart3 aria-hidden="true" />
          </span>

          <div>
            <small>بازدید</small>
            <strong>
              {formatNumber(product.viewCount)}
            </strong>
          </div>
        </article>

        <article>
          <span>
            <Star aria-hidden="true" />
          </span>

          <div>
            <small>امتیاز میانگین</small>
            <strong>
              {product.averageRating ?? '—'}
            </strong>
          </div>
        </article>
      </section>

      <div className="admin-product-detail-layout">
        <div className="admin-product-detail-main">
          <section className="admin-product-edit-card">
            <header>
              <div>
                <span className="panel-label">
                  EDIT PRODUCT
                </span>
                <h2>ویرایش اطلاعات اصلی</h2>
              </div>

              <Package aria-hidden="true" />
            </header>

            <form
              className="admin-product-edit-form"
              onSubmit={submitProductIdentity}
            >
              <div className="admin-product-edit-grid">
                <label>
                  <span>نام محصول</span>
                  <input
                    value={nameDraft}
                    onChange={(event) =>
                      setNameDraft(event.target.value)
                    }
                    maxLength={180}
                    disabled={
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>SKU</span>
                  <input
                    value={skuDraft}
                    onChange={(event) =>
                      setSkuDraft(event.target.value)
                    }
                    maxLength={120}
                    dir="ltr"
                    disabled={
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <div className="admin-product-classification-heading is-full">
                  <strong>
                    هویت و طبقه‌بندی کاتالوگ
                  </strong>

                  <span>
                    نوع محصول به دسته‌بندی وابسته است و
                    مدل براساس برند و نوع محصول فیلتر
                    می‌شود.
                  </span>
                </div>

                {catalogError ? (
                  <div className="admin-product-catalog-error is-full">
                    <span>{catalogError}</span>

                    <button
                      type="button"
                      onClick={() =>
                        void loadCatalog()
                      }
                      disabled={catalogLoading}
                    >
                      تلاش دوباره
                    </button>
                  </div>
                ) : null}

                <label>
                  <span>برند</span>

                  <select
                    value={brandIdDraft}
                    onChange={(event) =>
                      changeBrand(
                        event.target.value,
                      )
                    }
                    disabled={
                      catalogLoading ||
                      !catalog ||
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  >
                    <option value="">
                      انتخاب برند
                    </option>

                    {catalog?.brands.map(
                      (option) => (
                        <option
                          key={option.id}
                          value={option.id}
                        >
                          {option.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>دسته‌بندی</span>

                  <select
                    value={categoryIdDraft}
                    onChange={(event) =>
                      changeCategory(
                        event.target.value,
                      )
                    }
                    disabled={
                      catalogLoading ||
                      !catalog ||
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  >
                    <option value="">
                      انتخاب دسته‌بندی
                    </option>

                    {catalog?.categories.map(
                      (option) => (
                        <option
                          key={option.id}
                          value={option.id}
                        >
                          {option.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>نوع محصول</span>

                  <select
                    value={productTypeIdDraft}
                    onChange={(event) =>
                      changeProductType(
                        event.target.value,
                      )
                    }
                    disabled={
                      catalogLoading ||
                      !catalog ||
                      !categoryIdDraft ||
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  >
                    <option value="">
                      {categoryIdDraft
                        ? 'انتخاب نوع محصول'
                        : 'ابتدا دسته‌بندی را انتخاب کنید'}
                    </option>

                    {availableProductTypes().map(
                      (option) => (
                        <option
                          key={option.id}
                          value={option.id}
                        >
                          {option.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>مدل محصول</span>

                  <select
                    value={productModelIdDraft}
                    onChange={(event) =>
                      setProductModelIdDraft(
                        event.target.value,
                      )
                    }
                    disabled={
                      catalogLoading ||
                      !catalog ||
                      !brandIdDraft ||
                      !productTypeIdDraft ||
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  >
                    <option value="">
                      {brandIdDraft &&
                      productTypeIdDraft
                        ? 'انتخاب مدل محصول'
                        : 'ابتدا برند و نوع محصول را انتخاب کنید'}
                    </option>

                    {availableProductModels().map(
                      (option) => (
                        <option
                          key={option.id}
                          value={option.id}
                        >
                          {option.name}
                          {option.modelCode
                            ? ` — ${option.modelCode}`
                            : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="is-full">
                  <span>Slug</span>
                  <input
                    value={slugDraft}
                    onChange={(event) =>
                      setSlugDraft(event.target.value)
                    }
                    maxLength={220}
                    dir="ltr"
                    disabled={
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label className="is-full">
                  <span>توضیح کوتاه</span>
                  <textarea
                    value={shortDescriptionDraft}
                    onChange={(event) =>
                      setShortDescriptionDraft(
                        event.target.value,
                      )
                    }
                    maxLength={500}
                    rows={3}
                    disabled={
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label className="is-full">
                  <span>توضیحات کامل</span>
                  <textarea
                    value={descriptionDraft}
                    onChange={(event) =>
                      setDescriptionDraft(
                        event.target.value,
                      )
                    }
                    rows={8}
                    disabled={
                      identityPending ||
                      pricingPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={
                  identityPending ||
                  pricingPending ||
                  statusPending ||
                  catalogLoading ||
                  !catalog ||
                  !nameDraft.trim() ||
                  !slugDraft.trim() ||
                  !skuDraft.trim() ||
                  !brandIdDraft ||
                  !categoryIdDraft ||
                  !productTypeIdDraft ||
                  !productModelIdDraft ||
                  Boolean(product.deletedAt)
                }
              >
                {identityPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}

                {identityPending
                  ? 'در حال ذخیره...'
                  : 'ذخیره اطلاعات اصلی'}
              </button>
            </form>
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  IDENTITY
                </span>
                <h2>هویت و طبقه‌بندی</h2>
              </div>

              <FolderTree aria-hidden="true" />
            </header>

            <dl className="admin-product-info-grid">
              <div>
                <dt>برند</dt>
                <dd>
                  {product.brand.name ||
                    'ثبت نشده'}
                </dd>
              </div>

              <div>
                <dt>دسته‌بندی</dt>
                <dd>
                  {product.category.name ||
                    'ثبت نشده'}
                </dd>
              </div>

              <div>
                <dt>نوع محصول</dt>
                <dd>
                  {product.productType.name ||
                    'ثبت نشده'}
                </dd>
              </div>

              <div>
                <dt>مدل محصول</dt>
                <dd>
                  {product.productModel.name ||
                    'ثبت نشده'}
                </dd>
              </div>

              <div>
                <dt>کد مدل</dt>
                <dd>
                  {product.productModel.modelCode ? (
                    <bdi dir="ltr">
                      {product.productModel.modelCode}
                    </bdi>
                  ) : (
                    'ثبت نشده'
                  )}
                </dd>
              </div>

              <div>
                <dt>وزن</dt>
                <dd>
                  {product.weight !== null
                    ? `${formatNumber(product.weight)} گرم`
                    : 'ثبت نشده'}
                </dd>
              </div>
            </dl>

            {dimensionsJson ? (
              <div className="admin-product-json-block">
                <span>ابعاد محصول</span>
                <pre dir="ltr">
                  {dimensionsJson}
                </pre>
              </div>
            ) : null}
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  MEDIA
                </span>
                <h2>رسانه‌های محصول</h2>
              </div>

              <Images aria-hidden="true" />
            </header>

            <form
              className="admin-product-media-uploader"
              onSubmit={submitProductMedia}
            >
              <label
                className={`admin-product-media-dropzone${
                  mediaDragging
                    ? ' is-dragging'
                    : ''
                }`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setMediaDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setMediaDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();

                  if (
                    event.currentTarget ===
                    event.target
                  ) {
                    setMediaDragging(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setMediaDragging(false);

                  selectMediaFile(
                    event.dataTransfer.files[0] ??
                      null,
                  );
                }}
              >
                <input
                  key={mediaInputKey}
                  type="file"
                  accept={productMediaAccept}
                  onChange={(event) =>
                    selectMediaFile(
                      event.target.files?.[0] ??
                        null,
                    )
                  }
                  disabled={
                    mediaPending ||
                    identityPending ||
                    pricingPending ||
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />

                <Images aria-hidden="true" />

                <strong>
                  فایل را اینجا رها کنید
                </strong>

                <span>
                  یا برای انتخاب تصویر یا ویدئو کلیک کنید
                </span>

                <small>
                  حداکثر ۱۰ مگابایت · WebP و AVIF
                  پیشنهاد می‌شوند
                </small>
              </label>

              {mediaFile && mediaPreviewUrl ? (
                <div className="admin-product-media-selection">
                  <div className="admin-product-media-selection__preview">
                    {mediaFile.type.startsWith(
                      'image/',
                    ) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mediaPreviewUrl}
                        alt="پیش‌نمایش رسانه انتخاب‌شده"
                      />
                    ) : (
                      <video
                        src={mediaPreviewUrl}
                        controls
                        preload="metadata"
                      />
                    )}
                  </div>

                  <div className="admin-product-media-selection__info">
                    <div>
                      <strong>{mediaFile.name}</strong>

                      <span>
                        {formatFileSize(
                          mediaFile.size,
                        )}
                        {' · '}
                        {mediaFile.type}
                      </span>
                    </div>

                    {isOptimizedImage(mediaFile) ? (
                      <span className="admin-product-media-optimized">
                        فرمت بهینه
                      </span>
                    ) : mediaFile.type.startsWith(
                        'image/',
                      ) ? (
                      <p>
                        برای کاهش حجم، نسخه WebP یا
                        AVIF این تصویر پیشنهاد می‌شود.
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={clearSelectedMedia}
                      disabled={mediaPending}
                    >
                      حذف انتخاب
                    </button>
                  </div>
                </div>
              ) : null}

              {mediaFile ? (
                <div className="admin-product-media-fields">
                  <label>
                    <span>متن جایگزین تصویر</span>

                    <input
                      value={mediaAltText}
                      onChange={(event) =>
                        setMediaAltText(
                          event.target.value,
                        )
                      }
                      maxLength={180}
                      disabled={mediaPending}
                    />
                  </label>

                  <label>
                    <span>عنوان رسانه</span>

                    <input
                      value={mediaTitle}
                      onChange={(event) =>
                        setMediaTitle(
                          event.target.value,
                        )
                      }
                      maxLength={180}
                      disabled={mediaPending}
                    />
                  </label>

                  <label className="is-full">
                    <span>توضیح رسانه</span>

                    <textarea
                      value={mediaCaption}
                      onChange={(event) =>
                        setMediaCaption(
                          event.target.value,
                        )
                      }
                      maxLength={500}
                      rows={3}
                      disabled={mediaPending}
                    />
                  </label>

                  <label className="admin-product-media-primary">
                    <input
                      type="checkbox"
                      checked={mediaPrimary}
                      onChange={(event) =>
                        setMediaPrimary(
                          event.target.checked,
                        )
                      }
                      disabled={mediaPending}
                    />

                    <span>
                      این رسانه به‌عنوان تصویر اصلی محصول
                      ثبت شود
                    </span>
                  </label>
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  !mediaFile ||
                  mediaPending ||
                  identityPending ||
                  pricingPending ||
                  statusPending ||
                  Boolean(product.deletedAt)
                }
              >
                {mediaPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <Images aria-hidden="true" />
                )}

                {mediaPending
                  ? 'در حال آپلود...'
                  : 'آپلود و ثبت رسانه'}
              </button>
            </form>

            <div className="admin-product-media-gallery-heading">
              <div>
                <strong>رسانه‌های ثبت‌شده</strong>

                <span>
                  {new Intl.NumberFormat(
                    'fa-IR',
                  ).format(product.images.length)}
                  {' '}
                  رسانه
                </span>

                <small>
                  تصویر اصلی در جایگاه اول ثابت است.
                  سایر رسانه‌ها را بکشید یا با دکمه‌های
                  جابه‌جایی مرتب کنید.
                </small>
              </div>

              <div className="admin-product-media-reorder-actions">
                <button
                  type="button"
                  onClick={resetMediaOrder}
                  disabled={
                    !mediaOrderChanged() ||
                    mediaReorderPending ||
                    Boolean(mediaAction) ||
                    Boolean(product.deletedAt)
                  }
                >
                  بازنشانی
                </button>

                <button
                  type="button"
                  className="is-save"
                  onClick={() =>
                    void saveMediaOrder()
                  }
                  disabled={
                    !mediaOrderChanged() ||
                    mediaReorderPending ||
                    Boolean(mediaAction) ||
                    Boolean(product.deletedAt)
                  }
                >
                  {mediaReorderPending
                    ? 'در حال ذخیره...'
                    : 'ذخیره ترتیب'}
                </button>
              </div>
            </div>

            {product.images.length > 0 ? (
              <div className="admin-product-gallery">
                {mediaOrder.map(
                  (imageId, index) => {
                  const image =
                    product.images.find(
                      (item) =>
                        item.id === imageId,
                    );

                  if (!image) {
                    return null;
                  }

                  const draft = mediaDrafts[
                    image.id
                  ] ?? {
                    altText: image.altText ?? '',
                    title: image.title ?? '',
                    caption: image.caption ?? '',
                  };

                  const pendingAction =
                    mediaAction?.imageId ===
                    image.id
                      ? mediaAction.action
                      : null;

                  return (
                    <article
                      key={image.id}
                      draggable={
                        !image.isPrimary &&
                        !mediaReorderPending &&
                        !mediaAction
                      }
                      className={[
                        'admin-product-media-card',
                        draggedMediaId ===
                        image.id
                          ? 'is-dragging'
                          : '',
                        dropTargetMediaId ===
                        image.id
                          ? 'is-drop-target'
                          : '',
                        image.isPrimary
                          ? 'is-primary-locked'
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onDragStart={(event) => {
                        if (
                          image.isPrimary ||
                          mediaReorderPending ||
                          mediaAction
                        ) {
                          event.preventDefault();
                          return;
                        }

                        setDraggedMediaId(
                          image.id,
                        );

                        event.dataTransfer.effectAllowed =
                          'move';

                        event.dataTransfer.setData(
                          'text/plain',
                          image.id,
                        );
                      }}
                      onDragOver={(event) => {
                        if (
                          !draggedMediaId ||
                          image.isPrimary ||
                          draggedMediaId ===
                            image.id
                        ) {
                          return;
                        }

                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          'move';

                        setDropTargetMediaId(
                          image.id,
                        );
                      }}
                      onDrop={(event) => {
                        event.preventDefault();

                        const sourceId =
                          draggedMediaId ||
                          event.dataTransfer.getData(
                            'text/plain',
                          );

                        if (sourceId) {
                          moveMediaBefore(
                            sourceId,
                            image.id,
                          );
                        }

                        setDraggedMediaId(null);
                        setDropTargetMediaId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedMediaId(null);
                        setDropTargetMediaId(null);
                      }}
                    >
                      <div className="admin-product-media-card__order">
                        <span>
                          ترتیب{' '}
                          {new Intl.NumberFormat(
                            'fa-IR',
                          ).format(index + 1)}
                        </span>

                        <div>
                          <button
                            type="button"
                            aria-label="انتقال رسانه به جایگاه قبل"
                            title="انتقال به قبل"
                            onClick={() =>
                              moveMediaByDirection(
                                image.id,
                                -1,
                              )
                            }
                            disabled={
                              image.isPrimary ||
                              index <= 1 ||
                              mediaReorderPending ||
                              Boolean(mediaAction)
                            }
                          >
                            ↑
                          </button>

                          <button
                            type="button"
                            aria-label="انتقال رسانه به جایگاه بعد"
                            title="انتقال به بعد"
                            onClick={() =>
                              moveMediaByDirection(
                                image.id,
                                1,
                              )
                            }
                            disabled={
                              image.isPrimary ||
                              index ===
                                mediaOrder.length -
                                  1 ||
                              mediaReorderPending ||
                              Boolean(mediaAction)
                            }
                          >
                            ↓
                          </button>
                        </div>
                      </div>

                      <div className="admin-product-media-card__preview">
                        {image.type === 'VIDEO' ? (
                          <video
                            src={image.url}
                            controls
                            preload="metadata"
                          />
                        ) : (
                          <Image
                            src={image.url}
                            alt={
                              image.altText ||
                              image.title ||
                              product.name
                            }
                            width={220}
                            height={220}
                            sizes="(max-width: 680px) 50vw, 220px"
                            unoptimized
                          />
                        )}

                        {image.isPrimary ? (
                          <span>
                            <Crown aria-hidden="true" />
                            تصویر اصلی
                          </span>
                        ) : null}
                      </div>

                      <div className="admin-product-media-card__meta">
                        <strong>
                          {image.title ||
                            image.altText ||
                            'رسانه محصول'}
                        </strong>

                        <small>
                          {[
                            image.width &&
                            image.height
                              ? `${image.width}×${image.height}`
                              : null,
                            image.size
                              ? formatFileSize(
                                  image.size,
                                )
                              : null,
                            image.mimeType,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </small>
                      </div>

                      <div className="admin-product-media-card__fields">
                        <label>
                          <span>متن جایگزین</span>

                          <input
                            value={draft.altText}
                            maxLength={180}
                            onChange={(event) =>
                              updateMediaDraft(
                                image.id,
                                'altText',
                                event.target.value,
                              )
                            }
                            disabled={
                              Boolean(mediaAction) ||
                              mediaReorderPending
                            }
                          />
                        </label>

                        <label>
                          <span>عنوان</span>

                          <input
                            value={draft.title}
                            maxLength={180}
                            onChange={(event) =>
                              updateMediaDraft(
                                image.id,
                                'title',
                                event.target.value,
                              )
                            }
                            disabled={
                              Boolean(mediaAction) ||
                              mediaReorderPending
                            }
                          />
                        </label>

                        <label>
                          <span>توضیح</span>

                          <textarea
                            value={draft.caption}
                            maxLength={500}
                            rows={3}
                            onChange={(event) =>
                              updateMediaDraft(
                                image.id,
                                'caption',
                                event.target.value,
                              )
                            }
                            disabled={
                              Boolean(mediaAction) ||
                              mediaReorderPending
                            }
                          />
                        </label>
                      </div>

                      <div className="admin-product-media-card__actions">
                        <button
                          type="button"
                          onClick={() =>
                            void saveProductMedia(
                              image.id,
                            )
                          }
                          disabled={
                            Boolean(mediaAction) ||
                            mediaReorderPending ||
                            Boolean(product.deletedAt)
                          }
                        >
                          {pendingAction ===
                          'save' ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Save aria-hidden="true" />
                          )}

                          ذخیره
                        </button>

                        <button
                          type="button"
                          className="is-primary-action"
                          onClick={() =>
                            void makeProductMediaPrimary(
                              image.id,
                            )
                          }
                          disabled={
                            image.isPrimary ||
                            Boolean(mediaAction) ||
                            mediaReorderPending ||
                            Boolean(product.deletedAt)
                          }
                        >
                          {pendingAction ===
                          'primary' ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Crown aria-hidden="true" />
                          )}

                          {image.isPrimary
                            ? 'تصویر اصلی'
                            : 'انتخاب به‌عنوان اصلی'}
                        </button>

                        <button
                          type="button"
                          className="is-delete-action"
                          onClick={() =>
                            void deleteProductMedia(
                              image.id,
                            )
                          }
                          disabled={
                            Boolean(mediaAction) ||
                            mediaReorderPending ||
                            Boolean(product.deletedAt)
                          }
                        >
                          {pendingAction ===
                          'delete' ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2 aria-hidden="true" />
                          )}

                          حذف
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="admin-product-empty-text">
                رسانه‌ای برای محصول ثبت نشده است.
              </p>
            )}
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  ATTRIBUTES
                </span>
                <h2>ویژگی‌های محصول</h2>
              </div>

              <Tag aria-hidden="true" />
            </header>

            {product.attributes.length > 0 ? (
              <div className="admin-product-attributes">
                {product.attributes.map(
                  (attribute, index) => (
                    <article
                      key={
                        attribute.attributeValueId ??
                        attribute.attributeId ??
                        `${attribute.code}-${index}`
                      }
                    >
                      <div>
                        <small>
                          {attribute.code ||
                            'ATTRIBUTE'}
                        </small>

                        <strong>
                          {attribute.label ||
                            attribute.name ||
                            'ویژگی'}
                        </strong>
                      </div>

                      <span>
                        {attributeValue(attribute)}
                        {attribute.unit
                          ? ` ${attribute.unit}`
                          : ''}
                      </span>
                    </article>
                  ),
                )}
              </div>
            ) : (
              <p className="admin-product-empty-text">
                ویژگی‌ای برای این محصول ثبت نشده است.
              </p>
            )}
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  CONTENT
                </span>
                <h2>محتوای محصول</h2>
              </div>

              <Package aria-hidden="true" />
            </header>

            <div className="admin-product-description-block">
              <h3>توضیح کوتاه</h3>
              <p>
                {product.shortDescription ||
                  'توضیح کوتاه ثبت نشده است.'}
              </p>
            </div>

            <div className="admin-product-description-block">
              <h3>توضیحات کامل</h3>
              <p>
                {product.description ||
                  'توضیحات کامل ثبت نشده است.'}
              </p>
            </div>
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  INVENTORY
                </span>
                <h2>مدیریت سریع موجودی</h2>
              </div>

              <Warehouse aria-hidden="true" />
            </header>

            {inventoryError ? (
              <div className="admin-product-inventory-error">
                <AlertTriangle aria-hidden="true" />

                <div>
                  <strong>
                    دریافت موجودی انجام نشد
                  </strong>

                  <span>{inventoryError}</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadInventory()
                  }
                  disabled={inventoryLoading}
                >
                  تلاش دوباره
                </button>
              </div>
            ) : null}

            {quickInventoryBlocked ? (
              <div className="admin-product-inventory-complex">
                <Boxes aria-hidden="true" />

                <div>
                  <strong>
                    مدیریت پیشرفته موجودی لازم است
                  </strong>

                  <p>
                    این محصول دارای چند واریانت یا چند
                    رکورد انبار است. برای جلوگیری از
                    تغییر اشتباه موجودی تجمیعی، ویرایش
                    سریع غیرفعال شده است.
                  </p>

                  <dl>
                    <div>
                      <dt>تعداد واریانت</dt>
                      <dd>
                        {formatNumber(
                          product.stock.variantCount,
                        )}
                      </dd>
                    </div>

                    <div>
                      <dt>تعداد انبار</dt>
                      <dd>
                        {formatNumber(
                          product.stock.warehouseCount,
                        )}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/admin/inventory?productId=${encodeURIComponent(
                      product.id,
                    )}`}
                  >
                    رفتن به مدیریت موجودی
                    <ArrowLeft aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <form
                className="admin-product-inventory-editor"
                onSubmit={submitProductInventory}
              >
                <label className="is-full">
                  <span>انبار</span>

                  <select
                    value={warehouseIdDraft}
                    onChange={(event) =>
                      setWarehouseIdDraft(
                        event.target.value,
                      )
                    }
                    disabled={
                      inventoryLoading ||
                      inventoryPending ||
                      warehouses.length === 0 ||
                      Boolean(product.deletedAt)
                    }
                  >
                    <option value="">
                      {inventoryLoading
                        ? 'در حال دریافت انبارها...'
                        : 'انتخاب انبار'}
                    </option>

                    {warehouses.map(
                      (warehouse) => (
                        <option
                          key={warehouse.id}
                          value={warehouse.id}
                        >
                          {warehouse.name}
                          {' — '}
                          {warehouse.code}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  <span>موجودی کل هدف</span>

                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={stockQuantityDraft}
                    onChange={(event) =>
                      setStockQuantityDraft(
                        event.target.value,
                      )
                    }
                    disabled={
                      inventoryLoading ||
                      inventoryPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>آستانه کمبود</span>

                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={
                      lowStockThresholdDraft
                    }
                    onChange={(event) =>
                      setLowStockThresholdDraft(
                        event.target.value,
                      )
                    }
                    disabled={
                      inventoryLoading ||
                      inventoryPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <div className="admin-product-inventory-summary is-full">
                  <article>
                    <span>رزروشده</span>
                    <strong>
                      {formatNumber(
                        reservedInventoryQuantity,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>
                      قابل فروش پس از ذخیره
                    </span>
                    <strong>
                      {formatNumber(
                        projectedAvailableQuantity,
                      )}
                    </strong>
                  </article>

                  <article>
                    <span>وضعیت رکورد</span>
                    <strong>
                      {currentInventory
                        ? 'موجود'
                        : 'ایجاد اولیه'}
                    </strong>
                  </article>
                </div>

                {targetInventoryQuantity <
                reservedInventoryQuantity ? (
                  <p
                    className="admin-product-inventory-warning is-full"
                    role="alert"
                  >
                    <AlertTriangle
                      aria-hidden="true"
                    />
                    موجودی هدف از مقدار رزروشده کمتر است
                    و قابل ذخیره نیست.
                  </p>
                ) : null}

                {warehouses.length === 0 &&
                !inventoryLoading ? (
                  <p className="admin-product-inventory-warning is-full">
                    <AlertTriangle
                      aria-hidden="true"
                    />
                    هیچ انبار فعالی برای ثبت موجودی وجود
                    ندارد.
                  </p>
                ) : null}

                <p className="admin-product-edit-help is-full">
                  مقدار موجودی، عدد نهایی رکورد انبار
                  است؛ نه میزان افزایش یا کاهش. موجودی
                  رزروشده فقط خواندنی است.
                </p>

                <button
                  type="submit"
                  className="is-full"
                  disabled={
                    inventoryLoading ||
                    inventoryPending ||
                    !warehouseIdDraft ||
                    warehouses.length === 0 ||
                    targetInventoryQuantity <
                      reservedInventoryQuantity ||
                    Boolean(product.deletedAt)
                  }
                >
                  {inventoryPending ? (
                    <LoaderCircle
                      className="is-spinning"
                      aria-hidden="true"
                    />
                  ) : (
                    <Save aria-hidden="true" />
                  )}

                  {inventoryPending
                    ? 'در حال ذخیره...'
                    : currentInventory
                      ? 'ذخیره موجودی'
                      : 'ثبت موجودی اولیه'}
                </button>
              </form>
            )}
          </section>

          <section className="admin-product-detail-panel admin-product-variants-panel">
            <header>
              <div>
                <span className="panel-label">
                  PRODUCT VARIANTS
                </span>
                <h2>مدیریت واریانت‌ها</h2>
              </div>

              <Boxes aria-hidden="true" />
            </header>

            <form
              className="admin-product-variant-create"
              onSubmit={submitProductVariant}
            >
              <div className="admin-product-variant-create__heading">
                <div>
                  <strong>ایجاد واریانت جدید</strong>

                  <span>
                    ویژگی‌های رنگ، حجم و اندازه در مرحله
                    Attribute Matrix متصل می‌شوند.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadVariants()
                  }
                  disabled={
                    variantsLoading ||
                    variantCreatePending ||
                    Boolean(variantActionId)
                  }
                  aria-label="بازخوانی واریانت‌ها"
                >
                  <RefreshCcw
                    className={
                      variantsLoading
                        ? 'is-spinning'
                        : ''
                    }
                    aria-hidden="true"
                  />
                </button>
              </div>

              <div className="admin-product-variant-create__grid">
                <label>
                  <span>SKU واریانت</span>

                  <input
                    value={variantSkuDraft}
                    onChange={(event) =>
                      setVariantSkuDraft(
                        event.target.value,
                      )
                    }
                    maxLength={120}
                    dir="ltr"
                    autoComplete="off"
                    placeholder="SKU-VARIANT-01"
                    disabled={
                      variantCreatePending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>نام واریانت</span>

                  <input
                    value={variantNameDraft}
                    onChange={(event) =>
                      setVariantNameDraft(
                        event.target.value,
                      )
                    }
                    maxLength={180}
                    placeholder="مثلاً حجم ۱۰۰ میلی‌لیتر"
                    disabled={
                      variantCreatePending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>قیمت اختصاصی</span>

                  <input
                    value={variantPriceDraft}
                    onChange={(event) =>
                      setVariantPriceDraft(
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    dir="ltr"
                    placeholder={product.price}
                    disabled={
                      variantCreatePending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>قیمت مقایسه‌ای</span>

                  <input
                    value={
                      variantComparePriceDraft
                    }
                    onChange={(event) =>
                      setVariantComparePriceDraft(
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    dir="ltr"
                    disabled={
                      variantCreatePending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>
              </div>

              <label className="admin-product-variant-active">
                <input
                  type="checkbox"
                  checked={variantActiveDraft}
                  onChange={(event) =>
                    setVariantActiveDraft(
                      event.target.checked,
                    )
                  }
                  disabled={
                    variantCreatePending ||
                    Boolean(product.deletedAt)
                  }
                />

                <span>
                  واریانت پس از ایجاد فعال باشد
                </span>
              </label>

              <button
                type="submit"
                className="admin-product-variant-create__submit"
                disabled={
                  variantCreatePending ||
                  !variantSkuDraft.trim() ||
                  Boolean(product.deletedAt)
                }
              >
                {variantCreatePending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <Save aria-hidden="true" />
                )}

                {variantCreatePending
                  ? 'در حال ایجاد...'
                  : 'ایجاد واریانت'}
              </button>
            </form>

            {variantsError ? (
              <div className="admin-product-variants-error">
                <AlertTriangle aria-hidden="true" />

                <div>
                  <strong>
                    دریافت واریانت‌ها انجام نشد
                  </strong>

                  <span>{variantsError}</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadVariants()
                  }
                  disabled={variantsLoading}
                >
                  تلاش دوباره
                </button>
              </div>
            ) : null}

            {variantsLoading ? (
              <div className="admin-product-variants-loading">
                <LoaderCircle
                  className="is-spinning"
                  aria-hidden="true"
                />

                <span>
                  در حال دریافت واریانت‌های محصول...
                </span>
              </div>
            ) : variants.length === 0 ? (
              <div className="admin-product-variants-empty">
                <Package aria-hidden="true" />

                <strong>
                  هنوز واریانت سفارشی ثبت نشده است
                </strong>

                <p>
                  فرم بالا را تکمیل کن. برای محصول ساده،
                  ثبت واریانت اضافی الزامی نیست.
                </p>
              </div>
            ) : (
              <div className="admin-product-variants-table-wrap">
                <table className="admin-product-variants-table">
                  <thead>
                    <tr>
                      <th>واریانت</th>
                      <th>SKU</th>
                      <th>قیمت</th>
                      <th>موجودی</th>
                      <th>وضعیت</th>
                      <th>
                        <span className="sr-only">
                          عملیات
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {variants.map((variant) => {
                      const actionPending =
                        variantActionId ===
                        variant.id;

                      return (
                        <tr key={variant.id}>
                          <td data-label="واریانت">
                            <div className="admin-product-variant-name">
                              <strong>
                                {variant.name ||
                                  'بدون نام'}
                              </strong>

                              <span>
                                {variant.slug ||
                                  'اسلاگ ثبت نشده'}
                              </span>
                            </div>
                          </td>

                          <td data-label="SKU">
                            <bdi dir="ltr">
                              {variant.sku}
                            </bdi>
                          </td>

                          <td data-label="قیمت">
                            <strong>
                              {formatMoney(
                                variant.price ||
                                  product.price,
                              )}
                              {' '}
                              ریال
                            </strong>

                            {!variant.price ? (
                              <small>
                                قیمت پایه محصول
                              </small>
                            ) : null}
                          </td>

                          <td data-label="موجودی">
                            <div className="admin-product-variant-stock">
                              <strong>
                                {formatNumber(
                                  variant.stock
                                    .availableStock,
                                )}
                              </strong>

                              <span>
                                کل:
                                {' '}
                                {formatNumber(
                                  variant.stock
                                    .totalQuantity,
                                )}
                              </span>
                            </div>
                          </td>

                          <td data-label="وضعیت">
                            <span
                              className={
                                variant.isActive
                                  ? 'admin-product-variant-status is-active'
                                  : 'admin-product-variant-status is-inactive'
                              }
                            >
                              {variant.isActive
                                ? 'فعال'
                                : 'غیرفعال'}
                            </span>
                          </td>

                          <td data-label="عملیات">
                            <div className="admin-product-variant-actions">
                              <button
                                type="button"
                                className="admin-product-variant-edit-button"
                                onClick={() =>
                                  beginVariantEdit(
                                    variant,
                                  )
                                }
                                disabled={
                                  Boolean(
                                    variantActionId,
                                  ) ||
                                  variantCreatePending ||
                                  variantDeletePending ||
                                  Boolean(
                                    product.deletedAt,
                                  )
                                }
                              >
                                <Pencil aria-hidden="true" />
                                ویرایش
                              </button>

                              <button
                                type="button"
                                className={
                                  variant.isActive
                                    ? 'admin-product-variant-toggle is-deactivate'
                                    : 'admin-product-variant-toggle is-activate'
                                }
                                onClick={() =>
                                  void toggleProductVariant(
                                    variant,
                                  )
                                }
                                disabled={
                                  actionPending ||
                                  Boolean(
                                    variantActionId,
                                  ) ||
                                  variantCreatePending ||
                                  variantDeletePending ||
                                  Boolean(
                                    product.deletedAt,
                                  )
                                }
                              >
                                {actionPending ? (
                                  <LoaderCircle
                                    className="is-spinning"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <RefreshCcw
                                    aria-hidden="true"
                                  />
                                )}

                                {actionPending
                                  ? 'در حال تغییر...'
                                  : variant.isActive
                                    ? 'غیرفعال'
                                    : 'فعال'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {editingVariantId &&
            variantEditDraft ? (
              <div className="admin-product-variant-inline-editor">
                {(() => {
                  const variant = variants.find(
                    (item) =>
                      item.id === editingVariantId,
                  );

                  if (!variant) {
                    return null;
                  }

                  const pending =
                    variantEditPending ||
                    variantPricePending ||
                    variantDeletePending;

                  return (
                    <>
                      <div className="admin-product-variant-inline-editor__header">
                        <div>
                          <strong>
                            ویرایش واریانت
                          </strong>

                          <span>
                            <bdi dir="ltr">
                              {variant.sku}
                            </bdi>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={cancelVariantEdit}
                          disabled={pending}
                          aria-label="بستن فرم ویرایش"
                        >
                          <XCircle
                            aria-hidden="true"
                          />
                        </button>
                      </div>

                      <div className="admin-product-variant-inline-editor__section">
                        <div className="admin-product-variant-inline-editor__title">
                          <strong>
                            مشخصات هویتی
                          </strong>

                          <span>
                            Barcode، GTIN و MPN با خالی
                            کردن فیلد پاک می‌شوند.
                          </span>
                        </div>

                        <div className="admin-product-variant-inline-editor__grid">
                          <label>
                            <span>SKU</span>

                            <input
                              value={
                                variantEditDraft.sku
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'sku',
                                  event.target.value,
                                )
                              }
                              maxLength={120}
                              dir="ltr"
                              disabled={pending}
                            />
                          </label>

                          <label>
                            <span>نام واریانت</span>

                            <input
                              value={
                                variantEditDraft.name
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'name',
                                  event.target.value,
                                )
                              }
                              maxLength={180}
                              disabled={pending}
                            />
                          </label>

                          <label>
                            <span>Barcode</span>

                            <input
                              value={
                                variantEditDraft.barcode
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'barcode',
                                  event.target.value,
                                )
                              }
                              maxLength={64}
                              dir="ltr"
                              disabled={pending}
                            />
                          </label>

                          <label>
                            <span>GTIN</span>

                            <input
                              value={
                                variantEditDraft.gtin
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'gtin',
                                  event.target.value,
                                )
                              }
                              inputMode="numeric"
                              dir="ltr"
                              disabled={pending}
                            />
                          </label>

                          <label className="is-full">
                            <span>MPN</span>

                            <input
                              value={
                                variantEditDraft.mpn
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'mpn',
                                  event.target.value,
                                )
                              }
                              maxLength={120}
                              dir="ltr"
                              disabled={pending}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="admin-product-variant-inline-save"
                          onClick={() =>
                            void saveVariantIdentity(
                              variant,
                            )
                          }
                          disabled={pending}
                        >
                          {variantEditPending ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Save aria-hidden="true" />
                          )}

                          {variantEditPending
                            ? 'در حال ذخیره...'
                            : 'ذخیره مشخصات'}
                        </button>
                      </div>

                      <div className="admin-product-variant-inline-editor__section">
                        <div className="admin-product-variant-inline-editor__title">
                          <strong>
                            قیمت اختصاصی
                          </strong>

                          <span>
                            خالی کردن قیمت باعث بازگشت
                            واریانت به قیمت پایه محصول
                            می‌شود.
                          </span>
                        </div>

                        <div className="admin-product-variant-inline-editor__grid">
                          <label>
                            <span>
                              قیمت واریانت
                            </span>

                            <input
                              value={
                                variantEditDraft.price
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'price',
                                  event.target.value,
                                )
                              }
                              inputMode="decimal"
                              dir="ltr"
                              placeholder={
                                product.price
                              }
                              disabled={pending}
                            />
                          </label>

                          <label>
                            <span>
                              قیمت مقایسه‌ای
                            </span>

                            <input
                              value={
                                variantEditDraft.comparePrice
                              }
                              onChange={(event) =>
                                updateVariantEditDraft(
                                  'comparePrice',
                                  event.target.value,
                                )
                              }
                              inputMode="decimal"
                              dir="ltr"
                              disabled={pending}
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="admin-product-variant-inline-save"
                          onClick={() =>
                            void saveVariantPrice(
                              variant,
                            )
                          }
                          disabled={pending}
                        >
                          {variantPricePending ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <CircleDollarSign
                              aria-hidden="true"
                            />
                          )}

                          {variantPricePending
                            ? 'در حال ذخیره...'
                            : 'ذخیره قیمت'}
                        </button>
                      </div>

                      <div className="admin-product-variant-inline-danger">
                        <div>
                          <strong>حذف واریانت</strong>

                          <span>
                            Variant دارای موجودی رزروشده
                            از سمت Backend قابل حذف نیست.
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void deleteProductVariant(
                              variant,
                            )
                          }
                          disabled={pending}
                        >
                          {variantDeletePending ? (
                            <LoaderCircle
                              className="is-spinning"
                              aria-hidden="true"
                            />
                          ) : (
                            <Trash2
                              aria-hidden="true"
                            />
                          )}

                          {variantDeletePending
                            ? 'در حال حذف...'
                            : 'حذف نرم واریانت'}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </section>

          <section className="admin-product-detail-panel">
            <header>
              <div>
                <span className="panel-label">
                  SEO
                </span>
                <h2>تنظیمات SEO</h2>
              </div>

              <SearchCheck aria-hidden="true" />
            </header>

            <form
              className="admin-product-seo-editor"
              onSubmit={submitProductSeo}
            >
              <label>
                <span>
                  عنوان SEO
                  <small>
                    {new Intl.NumberFormat(
                      'fa-IR',
                    ).format(
                      seoTitleDraft.length,
                    )}
                    /۱۸۰
                  </small>
                </span>

                <input
                  value={seoTitleDraft}
                  onChange={(event) =>
                    setSeoTitleDraft(
                      event.target.value,
                    )
                  }
                  maxLength={180}
                  disabled={
                    seoPending ||
                    identityPending ||
                    pricingPending ||
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />
              </label>

              <label>
                <span>
                  توضیحات SEO
                  <small>
                    {new Intl.NumberFormat(
                      'fa-IR',
                    ).format(
                      seoDescriptionDraft.length,
                    )}
                    /۵۰۰
                  </small>
                </span>

                <textarea
                  value={seoDescriptionDraft}
                  onChange={(event) =>
                    setSeoDescriptionDraft(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={5}
                  disabled={
                    seoPending ||
                    identityPending ||
                    pricingPending ||
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />
              </label>

              <label>
                <span>Canonical URL</span>

                <input
                  value={canonicalUrlDraft}
                  onChange={(event) =>
                    setCanonicalUrlDraft(
                      event.target.value,
                    )
                  }
                  placeholder="https://example.com/products/..."
                  dir="ltr"
                  disabled={
                    seoPending ||
                    identityPending ||
                    pricingPending ||
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />
              </label>

              <label>
                <span>
                  <FileJson aria-hidden="true" />
                  Schema JSON
                </span>

                <textarea
                  className={
                    schemaJsonError
                      ? 'is-invalid'
                      : ''
                  }
                  value={schemaJsonDraft}
                  onChange={(event) => {
                    setSchemaJsonDraft(
                      event.target.value,
                    );

                    if (schemaJsonError) {
                      setSchemaJsonError(null);
                    }
                  }}
                  rows={12}
                  dir="ltr"
                  spellCheck={false}
                  placeholder={`{
  "@context": "https://schema.org",
  "@type": "Product"
}`}
                  disabled={
                    seoPending ||
                    identityPending ||
                    pricingPending ||
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />

                {schemaJsonError ? (
                  <small className="admin-product-seo-json-error">
                    {schemaJsonError}
                  </small>
                ) : null}
              </label>

              <div className="admin-product-seo-preview">
                <span>پیش‌نمایش نتیجه جست‌وجو</span>

                <div>
                  <small>
                    {canonicalUrlDraft.trim() ||
                      `https://example.com/products/${product.slug}`}
                  </small>

                  <strong>
                    {seoTitleDraft.trim() ||
                      product.name}
                  </strong>

                  <p>
                    {seoDescriptionDraft.trim() ||
                      product.shortDescription ||
                      'توضیحات متای محصول در این بخش نمایش داده می‌شود.'}
                  </p>
                </div>
              </div>

              <p className="admin-product-edit-help">
                خالی‌کردن هر فیلد، مقدار قبلی آن را پاک
                می‌کند. Schema JSON باید یک شیء معتبر
                باشد.
              </p>

              <button
                type="submit"
                disabled={
                  seoPending ||
                  identityPending ||
                  pricingPending ||
                  statusPending ||
                  Boolean(product.deletedAt)
                }
              >
                {seoPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <SearchCheck aria-hidden="true" />
                )}

                {seoPending
                  ? 'در حال ذخیره...'
                  : 'ذخیره تنظیمات SEO'}
              </button>
            </form>
          </section>
        </div>

        <aside className="admin-product-detail-aside">
          <section className="admin-product-status-action">
            <header>
              <RefreshCcw aria-hidden="true" />

              <div>
                <span className="panel-label">
                  ACTION CENTER
                </span>
                <h2>مدیریت وضعیت محصول</h2>
              </div>
            </header>

            <form onSubmit={submitProductStatus}>
              <label>
                <span>وضعیت محصول</span>

                <select
                  value={statusDraft}
                  onChange={(event) => {
                    const nextStatus =
                      event.target.value;

                    setStatusDraft(nextStatus);

                    if (nextStatus === 'ACTIVE') {
                      setActiveDraft(true);
                    }

                    if (
                      nextStatus === 'INACTIVE' ||
                      nextStatus === 'ARCHIVED'
                    ) {
                      setActiveDraft(false);
                    }
                  }}
                  disabled={
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                >
                  {productStatusOptions.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="admin-product-status-action__switch">
                <input
                  type="checkbox"
                  checked={activeDraft}
                  onChange={(event) =>
                    setActiveDraft(
                      event.target.checked,
                    )
                  }
                  disabled={
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />

                <span aria-hidden="true" />

                <div>
                  <strong>
                    فعال در فروشگاه
                  </strong>

                  <small>
                    محصول برای مشتریان قابل نمایش و فروش
                    باشد.
                  </small>
                </div>
              </label>

              <label>
                <span>توضیح مدیریتی</span>

                <textarea
                  value={statusReason}
                  onChange={(event) =>
                    setStatusReason(
                      event.target.value,
                    )
                  }
                  maxLength={500}
                  rows={4}
                  placeholder="دلیل تغییر وضعیت یا توضیح داخلی"
                  disabled={
                    statusPending ||
                    Boolean(product.deletedAt)
                  }
                />
              </label>

              <div className="admin-product-status-action__summary">
                <span>وضعیت فعلی</span>

                <strong>
                  {statusLabels[product.status] ||
                    product.status}
                  {' · '}
                  {product.isActive
                    ? 'فعال'
                    : 'غیرفعال'}
                </strong>
              </div>

              <button
                type="submit"
                disabled={
                  statusPending ||
                  !statusDraft ||
                  Boolean(product.deletedAt)
                }
              >
                {statusPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}

                {statusPending
                  ? 'در حال ذخیره...'
                  : 'ذخیره وضعیت محصول'}
              </button>
            </form>

            {product.deletedAt ? (
              <p className="admin-product-status-action__notice">
                محصول حذف‌شده قابل تغییر وضعیت نیست.
              </p>
            ) : null}
          </section>

          <section className="admin-product-edit-card">
            <header>
              <div>
                <span className="panel-label">
                  EDIT PRICING
                </span>
                <h2>ویرایش قیمت‌گذاری</h2>
              </div>

              <CircleDollarSign aria-hidden="true" />
            </header>

            <form
              className="admin-product-edit-form"
              onSubmit={submitProductPricing}
            >
              <div className="admin-product-edit-grid is-single">
                <label>
                  <span>قیمت پایه</span>
                  <input
                    value={priceDraft}
                    onChange={(event) =>
                      setPriceDraft(event.target.value)
                    }
                    inputMode="decimal"
                    dir="ltr"
                    disabled={
                      pricingPending ||
                      identityPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>قیمت مقایسه‌ای</span>
                  <input
                    value={comparePriceDraft}
                    onChange={(event) =>
                      setComparePriceDraft(
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    dir="ltr"
                    disabled={
                      pricingPending ||
                      identityPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>قیمت خرید</span>
                  <input
                    value={purchasePriceDraft}
                    onChange={(event) =>
                      setPurchasePriceDraft(
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    dir="ltr"
                    disabled={
                      pricingPending ||
                      identityPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>

                <label>
                  <span>قیمت فروش</span>
                  <input
                    value={salePriceDraft}
                    onChange={(event) =>
                      setSalePriceDraft(
                        event.target.value,
                      )
                    }
                    inputMode="decimal"
                    dir="ltr"
                    disabled={
                      pricingPending ||
                      identityPending ||
                      statusPending ||
                      Boolean(product.deletedAt)
                    }
                  />
                </label>
              </div>

              <p className="admin-product-edit-help">
                اعداد را بدون جداکننده هزارگان وارد کنید.
                خالی‌کردن فیلدهای اختیاری مقدار قبلی را حذف
                نمی‌کند.
              </p>

              <button
                type="submit"
                disabled={
                  pricingPending ||
                  identityPending ||
                  statusPending ||
                  !priceDraft.trim() ||
                  Boolean(product.deletedAt)
                }
              >
                {pricingPending ? (
                  <LoaderCircle
                    className="is-spinning"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw aria-hidden="true" />
                )}

                {pricingPending
                  ? 'در حال ذخیره...'
                  : 'ذخیره قیمت‌گذاری'}
              </button>
            </form>
          </section>

          <section className="admin-product-side-card">
            <header>
              <BadgePercent aria-hidden="true" />

              <div>
                <span className="panel-label">
                  PRICING
                </span>
                <h2>قیمت‌گذاری</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>قیمت پایه</dt>
                <dd>
                  {formatMoney(product.price)}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>قیمت مقایسه‌ای</dt>
                <dd>
                  {product.comparePrice
                    ? `${formatMoney(product.comparePrice)} ریال`
                    : '—'}
                </dd>
              </div>

              <div>
                <dt>قیمت خرید</dt>
                <dd>
                  {product.pricing.purchasePrice
                    ? `${formatMoney(product.pricing.purchasePrice)} ریال`
                    : '—'}
                </dd>
              </div>

              <div>
                <dt>قیمت فروش</dt>
                <dd>
                  {product.pricing.salePrice
                    ? `${formatMoney(product.pricing.salePrice)} ریال`
                    : '—'}
                </dd>
              </div>

              <div className="is-total">
                <dt>قیمت نهایی</dt>
                <dd>
                  {formatMoney(
                    finalProductPrice(product),
                  )}
                  {' '}
                  ریال
                </dd>
              </div>

              <div>
                <dt>درصد تخفیف</dt>
                <dd>
                  {product.pricing.discountPercent
                    ? `${product.pricing.discountPercent}٪`
                    : '—'}
                </dd>
              </div>

              <div>
                <dt>حاشیه سود</dt>
                <dd>
                  {product.pricing.grossMarginPercent
                    ? `${product.pricing.grossMarginPercent}٪`
                    : '—'}
                </dd>
              </div>

              <div>
                <dt>حداقل قیمت مجاز</dt>
                <dd>
                  {product.pricing.minAllowedPrice
                    ? `${formatMoney(product.pricing.minAllowedPrice)} ریال`
                    : '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-product-side-card">
            <header>
              <Warehouse aria-hidden="true" />

              <div>
                <span className="panel-label">
                  INVENTORY
                </span>
                <h2>موجودی</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>موجودی کل</dt>
                <dd>
                  {formatNumber(
                    product.stock.totalQuantity,
                  )}
                </dd>
              </div>

              <div>
                <dt>رزروشده</dt>
                <dd>
                  {formatNumber(
                    product.stock.reservedQuantity,
                  )}
                </dd>
              </div>

              <div className="is-total">
                <dt>قابل فروش</dt>
                <dd>
                  {formatNumber(
                    product.stock.availableStock,
                  )}
                </dd>
              </div>

              <div>
                <dt>تعداد انبار</dt>
                <dd>
                  {formatNumber(
                    product.stock.warehouseCount,
                  )}
                </dd>
              </div>

              <div>
                <dt>تعداد Variant</dt>
                <dd>
                  {formatNumber(
                    product.stock.variantCount,
                  )}
                </dd>
              </div>

              <div>
                <dt>آستانه کمبود</dt>
                <dd>
                  {formatNumber(
                    product.stock.lowStockThreshold,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-product-side-card">
            <header>
              <Sparkles aria-hidden="true" />

              <div>
                <span className="panel-label">
                  ARTIFICIAL INTELLIGENCE
                </span>
                <h2>وضعیت AI</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>وضعیت محتوا</dt>
                <dd>
                  {aiStatusLabels[
                    product.ai.contentStatus
                  ] ||
                    product.ai.contentStatus}
                </dd>
              </div>

              <div>
                <dt>امتیاز کیفیت</dt>
                <dd>
                  {product.ai.qualityScore ??
                    '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-product-side-card">
            <header>
              <BarChart3 aria-hidden="true" />

              <div>
                <span className="panel-label">
                  STATISTICS
                </span>
                <h2>آمار محصول</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>بازدید</dt>
                <dd>
                  {formatNumber(
                    product.viewCount,
                  )}
                </dd>
              </div>

              <div>
                <dt>تعداد دیدگاه</dt>
                <dd>
                  {formatNumber(
                    product.reviewCount,
                  )}
                </dd>
              </div>

              <div>
                <dt>میانگین امتیاز</dt>
                <dd>
                  {product.averageRating ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-product-side-card">
            <header>
              <CalendarClock aria-hidden="true" />

              <div>
                <span className="panel-label">
                  TIMESTAMPS
                </span>
                <h2>زمان‌بندی</h2>
              </div>
            </header>

            <dl>
              <div>
                <dt>ایجاد</dt>
                <dd>
                  {formatDate(
                    product.createdAt,
                    product.createdAtFa,
                  )}
                </dd>
              </div>

              <div>
                <dt>آخرین تغییر</dt>
                <dd>
                  {formatDate(
                    product.updatedAt,
                    product.updatedAtFa,
                  )}
                </dd>
              </div>

              <div>
                <dt>حذف</dt>
                <dd>
                  {formatDate(
                    product.deletedAt,
                    product.deletedAtFa,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <Link
            href="/admin/products"
            className="admin-product-back-link"
          >
            بازگشت به فهرست محصولات
            <ArrowLeft aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}
