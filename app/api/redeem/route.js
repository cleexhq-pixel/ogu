import { NextResponse } from 'next/server';

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
const DEFAULT_PRODUCT_PERMALINK = 'fansign-prep-pass';

function isInactivePurchase(purchase) {
  if (!purchase || typeof purchase !== 'object') return true;
  if (purchase.refunded || purchase.chargebacked || purchase.disputed) return true;
  if (purchase.ended_at && new Date(purchase.ended_at) <= new Date()) return true;
  return false;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const licenseKey =
      typeof body.licenseKey === 'string'
        ? body.licenseKey.trim().toUpperCase()
        : '';

    if (licenseKey.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid license key' },
        { status: 400 },
      );
    }

    const productPermalink =
      process.env.GUMROAD_PRODUCT_PERMALINK || DEFAULT_PRODUCT_PERMALINK;

    const form = new URLSearchParams({
      product_permalink: productPermalink,
      license_key: licenseKey,
      increment_uses_count: 'false',
    });

    const res = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'License verification failed' },
        { status: 502 },
      );
    }

    const data = await res.json();
    if (!data?.success || isInactivePurchase(data.purchase)) {
      return NextResponse.json(
        { success: false, error: 'License key could not be verified' },
        { status: 400 },
      );
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    return NextResponse.json({
      success: true,
      tier: 'prep_pass',
      expiresAt: expiresAt.toISOString(),
      licenseKey,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'License verification failed' },
      { status: 500 },
    );
  }
}
