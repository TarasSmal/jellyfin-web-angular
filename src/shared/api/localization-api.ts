import { HttpResourceRequest } from '@angular/common/http';
import { ApiConfig } from './api-config';

/** Known parental ratings (for UserPolicy.MaxParentalRating thresholds). */
export function parentalRatingsRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Localization/ParentalRatings') };
}

/** Display languages (for ServerConfiguration.UICulture). */
export function localizationOptionsRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Localization/Options') };
}

/** Metadata languages (for PreferredMetadataLanguage). */
export function culturesRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Localization/Cultures') };
}

/** Countries (for MetadataCountryCode). */
export function countriesRequest(config: ApiConfig): HttpResourceRequest | undefined {
  if (!config.isAuthenticated()) return undefined;
  return { url: config.url('/Localization/Countries') };
}
