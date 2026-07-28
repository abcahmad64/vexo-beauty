import { NextResponse } from 'next/server';

import { proxyAdminApiRequest } from '@/lib/server/admin-api-proxy';

type RouteContext = {
  params: Promise<{
    productId: string;
  }>;
};

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
  'video/webm',
]);

const allowedTextFields = [
  'type',
  'thumbnailUrl',
  'altText',
  'title',
  'caption',
  'sortOrder',
  'isPrimary',
  'isActive',
] as const;

const maxFileSize = Number(
  process.env.MEDIA_MAX_FILE_SIZE_BYTES ??
    10 * 1024 * 1024,
);

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      message,
      data: null,
    },
    {
      status,
    },
  );
}

export async function POST(
  request: Request,
  { params }: RouteContext,
) {
  const { productId } = await params;

  let incomingFormData: FormData;

  try {
    incomingFormData = await request.formData();
  } catch {
    return errorResponse(
      'اطلاعات آپلود رسانه معتبر نیست.',
    );
  }

  const fileValue = incomingFormData.get('file');

  if (!(fileValue instanceof File)) {
    return errorResponse(
      'انتخاب فایل برای آپلود الزامی است.',
    );
  }

  if (fileValue.size <= 0) {
    return errorResponse(
      'فایل انتخاب‌شده خالی یا نامعتبر است.',
    );
  }

  if (
    Number.isFinite(maxFileSize) &&
    fileValue.size > maxFileSize
  ) {
    return errorResponse(
      'حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.',
      413,
    );
  }

  if (!allowedMimeTypes.has(fileValue.type)) {
    return errorResponse(
      'فقط تصاویر JPEG، PNG، WebP، GIF، AVIF و ویدئوهای MP4 یا WebM مجاز هستند.',
    );
  }

  const outgoingFormData = new FormData();

  outgoingFormData.append(
    'file',
    fileValue,
    fileValue.name,
  );

  for (const field of allowedTextFields) {
    const value = incomingFormData.get(field);

    if (typeof value !== 'string') {
      continue;
    }

    const normalized = value.trim();

    if (normalized) {
      outgoingFormData.append(
        field,
        normalized,
      );
    }
  }

  return proxyAdminApiRequest({
    method: 'POST',
    pathname:
      `/admin/products/${encodeURIComponent(
        productId.trim(),
      )}/media/upload`,
    body: outgoingFormData,
    timeoutMs: 120_000,
  });
}
