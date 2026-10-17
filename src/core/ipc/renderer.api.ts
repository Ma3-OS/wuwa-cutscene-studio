import { invoke } from "@tauri-apps/api/core";

export interface VideoInfoPayload {
  cg_name: string;
  cg_file: string;
  girl_or_boy?: string;
  sounds: string[];
  ass_path?: string | null;
  srt_path?: string | null;
}

export interface DialogueMatchDto {
  cg_name: string;
  caption_id: number;
  show_moment: number;
  time_formatted: string;
  content: string;
}

export interface CutsceneSubtitleLineDto {
  caption_id: number;
  show_moment: number;
  duration: number;
  time_formatted: string;
  content: string;
}

export const RendererAPI = {
  renderVideo: async (
    videoInfo: VideoInfoPayload,
    subtitleMode: string
  ): Promise<string> => {
    return await invoke<string>("render_video", {
      videoInfo,
      subtitleMode,
    });
  },

  generateSingleVideoInfo: async (
    mp4Path: string,
    locale: string,
    girlOrBoy: string
  ): Promise<VideoInfoPayload> => {
    return await invoke<VideoInfoPayload>("generate_single_video_info", {
      mp4Path,
      locale,
      girlOrBoy,
    });
  },

  getVideoAudioEvent: async (videoName: string): Promise<string[]> => {
    return await invoke<string[]>("get_video_audio_event", { videoName });
  },

  searchDialogue: async (
    query: string,
    lang?: string
  ): Promise<DialogueMatchDto[]> => {
    return await invoke<DialogueMatchDto[]>("search_dialogue", { query, lang });
  },

  getCutsceneDialogue: async (
    cgName: string,
    lang?: string
  ): Promise<CutsceneSubtitleLineDto[]> => {
    return await invoke<CutsceneSubtitleLineDto[]>("get_cutscene_dialogue", {
      cgName,
      lang,
    });
  },

  exportSubtitlesBundle: async (cgName: string): Promise<string[]> => {
    return await invoke<string[]>("export_subtitles_bundle", { cgName });
  },

  cancelRender: async (): Promise<void> => {
    await invoke("cancel_render");
  },
};
