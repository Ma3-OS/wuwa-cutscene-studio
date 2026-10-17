import { invoke } from "@tauri-apps/api/core";

export interface GameEnvironmentDto {
  game_paks_found: boolean;
  paks_dir: string;
  paks_count: number;
  keys_found: boolean;
  keys_path: string;
  dynamic_keys_count: number;
}

export interface ExtractedAssetResult {
  status: string;
  id: string;
  cg_name: string;
  video_file: string;
  audio_files: string[];
  elapsed_ms: number;
  is_cached: boolean;
  thumbnail_base64?: string | null;
}

export interface CatalogItemDto {
  cg_name: string;
  cg_file: string;
  is_cached: boolean;
  local_video_path?: string | null;
  audio_ready: boolean;
  girl_or_boy: number;
  can_skip?: boolean;
  aspect?: number;
  category_folder?: string;
  has_video?: boolean;
  is_level_sequence?: boolean;
  base_cg_name?: string | null;
  file_size?: number | null;
  asset_kind?: string;
  video_format?: string;
}

export const ExtractorAPI = {
  detectGameEnvironment: (): Promise<GameEnvironmentDto> =>
    invoke<GameEnvironmentDto>("detect_game_environment"),

  startExtractorDaemon: (paksDir: string, keysFile: string): Promise<boolean> =>
    invoke<boolean>("start_extractor_daemon", { paksDir, keysFile }),

  extractCutsceneOnDemand: (
    cgName: string,
    cgFile: string,
    soundEvents: string[] = [],
    requestId: string = crypto.randomUUID()
  ): Promise<ExtractedAssetResult> =>
    invoke<ExtractedAssetResult>("extract_cutscene_on_demand", {
      cgName,
      cgFile,
      soundEvents,
      requestId,
    }),

  cancelExtraction: (requestId: string): Promise<void> =>
    invoke<void>("cancel_extraction", { requestId }),

  getFullCatalog: (): Promise<CatalogItemDto[]> =>
    invoke<CatalogItemDto[]>("get_full_catalog_with_status"),

  getCutsceneThumbnail: (
    cgName: string,
    cgFile: string,
    gender: number = -1
  ): Promise<string> =>
    invoke<string>("get_cutscene_thumbnail", { cgName, cgFile, gender }),
};
