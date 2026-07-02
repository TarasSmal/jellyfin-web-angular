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

/**
 * POST /Users/{id}/Policy replaces the whole policy, so edits must round-trip
 * every field the server sent — hence the index signature.
 */
export interface UserPolicy {
  IsAdministrator?: boolean;
  IsDisabled?: boolean;
  IsHidden?: boolean;
  [key: string]: unknown;
}

export interface UserDto {
  Id: string;
  Name: string;
  ServerId?: string;
  PrimaryImageTag?: string;
  HasPassword?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Policy?: UserPolicy;
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

export interface PersonDto {
  Id: string;
  Name: string;
  Role?: string;
  Type?: string;
  PrimaryImageTag?: string;
}

/** Jellyfin models every media object with one DTO; Type discriminates. */
export interface BaseItemDto {
  People?: PersonDto[];
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

/** Full system info from /System/Info — admin-only. */
export interface SystemInfo extends PublicSystemInfo {
  OperatingSystemDisplayName?: string;
  HasPendingRestart?: boolean;
  WebSocketPortNumber?: number;
}

export interface PlayState {
  PositionTicks?: number;
  IsPaused?: boolean;
  IsMuted?: boolean;
  PlayMethod?: 'Transcode' | 'DirectStream' | 'DirectPlay' | (string & {});
}

/** A device connected to the server, playing something or idle. */
export interface SessionInfo {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  ApplicationVersion?: string;
  RemoteEndPoint?: string;
  LastActivityDate?: string;
  NowPlayingItem?: BaseItemDto;
  PlayState?: PlayState;
}

export type TaskState = 'Idle' | 'Cancelling' | 'Running';

export interface TaskResult {
  StartTimeUtc?: string;
  EndTimeUtc?: string;
  Status?: 'Completed' | 'Failed' | 'Cancelled' | 'Aborted' | (string & {});
  ErrorMessage?: string;
}

export type CollectionTypeOption =
  | 'movies'
  | 'tvshows'
  | 'music'
  | 'musicvideos'
  | 'homevideos'
  | 'boxsets'
  | 'books'
  | 'mixed';

/** A library as configured on the server ("virtual folder"). */
export interface VirtualFolderInfo {
  Name: string;
  Locations: string[];
  CollectionType?: CollectionTypeOption;
  /** Id of the library's folder item — used for per-library refresh. */
  ItemId?: string;
  RefreshProgress?: number;
  RefreshStatus?: string;
}

export type LogSeverity = 'Trace' | 'Debug' | 'Information' | 'Warn' | 'Error' | 'Fatal';

export interface ActivityLogEntry {
  Id: number;
  Name: string;
  Overview?: string;
  ShortOverview?: string;
  Type: string;
  Date: string;
  Severity: LogSeverity;
  UserId?: string;
}

export interface ActivityLogResult {
  Items: ActivityLogEntry[];
  TotalRecordCount: number;
}

export interface TaskInfo {
  Id: string;
  Name: string;
  State: TaskState;
  /** Only present while the task is running. */
  CurrentProgressPercentage?: number;
  Description?: string;
  Category?: string;
  LastExecutionResult?: TaskResult;
}
