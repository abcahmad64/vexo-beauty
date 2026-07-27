export type RecommendationReason =
  | 'similar'
  | 'best_seller'
  | 'trending'
  | 'new_arrival'
  | 'cart_related'
  | 'personalized';

export type RecommendedProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: string;
  comparePrice: string | null;
  brand: {
    id: string;
    name: string | null;
    slug: string | null;
  };
  category: {
    id: string;
    name: string | null;
    slug: string | null;
  };
  image: {
    url: string | null;
    alt: string | null;
  };
  score: number;
  reason: RecommendationReason;
};
