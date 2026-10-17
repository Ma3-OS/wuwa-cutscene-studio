pub struct ToolManifest {
    pub name: &'static str,
    pub url: &'static str,
    pub expected_sha256: Option<&'static str>,
}

pub const FFMPEG_TOOL: ToolManifest = ToolManifest {
    name: "FFmpeg",
    url: "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip",
    expected_sha256: None, // Floating latest release
};

pub const VGMSTREAM_TOOL: ToolManifest = ToolManifest {
    name: "vgmstream",
    url: "https://github.com/vgmstream/vgmstream/releases/download/r2117/vgmstream-win64.zip",
    expected_sha256: Some("f136fa5131922bb071e6261546876c2d1b09ea6406e23ecbb925695034a7d653"),
};

pub const WWISER_TOOL: ToolManifest = ToolManifest {
    name: "wwiser",
    url: "https://github.com/bnnm/wwiser/archive/refs/heads/master.zip",
    expected_sha256: None,
};

pub const DATABASE_BRANCH: &str = "3.7";
