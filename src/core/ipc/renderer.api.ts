import { invoke } from "@tauri-apps/api/core";

export interface VideoInfoPayload {
  cg_name: string;
  cg_file: string;
  sounds: string[];
  ass_path?: string | null;
  srt_path?: string | null;
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
};
