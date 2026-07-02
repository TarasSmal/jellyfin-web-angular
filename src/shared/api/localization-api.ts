import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/** Known parental ratings (for UserPolicy.MaxParentalRating thresholds). */
export function parentalRatingsRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Localization/ParentalRatings') };
}
