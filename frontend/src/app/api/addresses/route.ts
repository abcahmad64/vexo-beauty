import { NextResponse } from 'next/server';

import { proxyCustomerApiRequest } from '@/lib/server/customer-api-proxy';

type AddressBody = {
  title?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  country?: unknown;
  state?: unknown;
  city?: unknown;
  postalCode?: unknown;
  street?: unknown;
  apartment?: unknown;
  isDefault?: unknown;
};

function optionalString(value: unknown) {
  return typeof value === 'string' &&
    value.trim().length > 0
    ? value.trim()
    : undefined;
}

export async function GET() {
  return proxyCustomerApiRequest({
    method: 'GET',
    pathname: '/addresses?page=1&limit=100',
  });
}

export async function POST(request: Request) {
  let body: AddressBody;

  try {
    body = (await request.json()) as AddressBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'اطلاعات آدرس معتبر نیست.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  const requiredFields = [
    body.firstName,
    body.lastName,
    body.phone,
    body.country,
    body.city,
    body.street,
  ];

  if (
    requiredFields.some(
      (value) =>
        typeof value !== 'string' ||
        value.trim().length === 0,
    )
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          'نام، نام خانوادگی، تلفن، کشور، شهر و نشانی کامل الزامی هستند.',
        data: null,
      },
      {
        status: 400,
      },
    );
  }

  return proxyCustomerApiRequest({
    method: 'POST',
    pathname: '/addresses',
    body: {
      title: optionalString(body.title),
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      phone: String(body.phone).trim(),
      country: String(body.country).trim(),
      state: optionalString(body.state),
      city: String(body.city).trim(),
      postalCode: optionalString(body.postalCode),
      street: String(body.street).trim(),
      apartment: optionalString(body.apartment),
      isDefault: body.isDefault === true,
    },
  });
}
