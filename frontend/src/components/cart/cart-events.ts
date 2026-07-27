export const CART_UPDATED_EVENT =
  'vexo:cart-updated';

export function dispatchCartUpdated() {
  window.dispatchEvent(
    new CustomEvent(CART_UPDATED_EVENT),
  );
}
