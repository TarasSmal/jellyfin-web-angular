/**
 * Wire types for the Jellyfin HTTP API — hand-written per ADR 0002,
 * shapes cribbed from the server's OpenAPI spec. Only fields we use.
 */

export interface PublicSystemInfo {
  Id: string;
  ServerName: string;
  Version: string;
  ProductName?: string;
  LocalAddress?: string;
  StartupWizardCompleted?: boolean;
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string;
  Policy?: {
    IsAdministrator?: boolean;
  };
}

export interface AuthenticationResult {
  User: UserDto;
  AccessToken: string;
  ServerId: string;
}

export interface UserItemData {
  PlaybackPositionTicks?: number;
  PlayedPercentage?: number;
  Played?: boolean;
  IsFavorite?: boolean;
  UnplayedItemCount?: number;
}

/** Jellyfin models every media object with one DTO; Type discriminates. */
export interface BaseItemDto {
  Id: string;
  Name: string;
  Type: 'Movie' | 'Series' | 'Season' | 'Episode' | 'CollectionFolder' | (string & {});
  CollectionType?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Overview?: string;
  Genres?: string[];
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ImageBlurHashes?: Record<string, Record<string, string>>;
  PrimaryImageAspectRatio?: number;
  SeriesId?: string;
  SeriesName?: string;
  SeriesPrimaryImageTag?: string;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  IndexNumber?: number;
  ParentIndexNumber?: number;
  UserData?: UserItemData;
}

export interface ItemsResult {
  Items: BaseItemDto[];
  TotalRecordCount: number;
}
