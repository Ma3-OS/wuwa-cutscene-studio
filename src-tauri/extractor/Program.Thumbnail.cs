using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using CUE4Parse.Compression;
using CUE4Parse.Encryption.Aes;
using CUE4Parse.FileProvider;
using CUE4Parse.FileProvider.Objects;
using CUE4Parse.FileProvider.Vfs;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Objects.Core.Misc;
using CUE4Parse.UE4.Versions;

namespace WuWaExtractor
{
    public static partial class Program
    {
        private static async Task HandleGetThumbnailAsync(string reqId, string cgName, string cgFile, int gender, string outputDir)
        {
            if (string.IsNullOrEmpty(cgName))
            {
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = "cg_name is empty"
                });
                return;
            }

            var genderSuffix = gender == 0 ? "_nv" : gender == 1 ? "_nan" : "";
            var candidatePaths = new List<string>();
            if (!string.IsNullOrEmpty(outputDir))
            {
                candidatePaths.Add(Path.Combine(outputDir, $"thumb_{cgName}{genderSuffix}.jpg"));
                candidatePaths.Add(Path.Combine(outputDir, $"thumb_{cgName}.jpg"));
                candidatePaths.Add(Path.Combine(outputDir, $"{cgName}{genderSuffix}.jpg"));
                candidatePaths.Add(Path.Combine(outputDir, $"{cgName}.jpg"));
            }

            // Return cached thumbnail on disk if available
            foreach (var cPath in candidatePaths)
            {
                if (File.Exists(cPath))
                {
                    if (new FileInfo(cPath).Length >= 3500)
                    {
                        try
                        {
                            var bytes = File.ReadAllBytes(cPath);
                            SendResponse(new JsonObject
                            {
                                ["status"] = "ok",
                                ["id"] = reqId,
                                ["cg_name"] = cgName,
                                ["path"] = cPath,
                                ["base64"] = $"data:image/jpeg;base64,{Convert.ToBase64String(bytes)}"
                            });
                            return;
                        }
                        catch { }
                    }
                    else
                    {
                        try { File.Delete(cPath); } catch { }
                    }
                }
            }

            // Wait for provider to become ready (up to 30s)
            if (!_providerReadyTcs.Task.IsCompleted)
            {
                var completedTask = await Task.WhenAny(_providerReadyTcs.Task, Task.Delay(30000));
                if (completedTask != _providerReadyTcs.Task || !_providerReadyTcs.Task.Result)
                {
                    SendResponse(new JsonObject
                    {
                        ["status"] = "error",
                        ["id"] = reqId,
                        ["message"] = "Provider initialization timed out or failed"
                    });
                    return;
                }
            }

            if (_provider == null)
            {
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = "Provider not initialized"
                });
                return;
            }

            try
            {
                // Candidates list in order of preference
                var candidates = new List<string>();
                if (gender == 0) // Female
                {
                    candidates.Add($"T_StoryPhoto_{cgName}_a");
                    candidates.Add($"T_StoryPhoto{cgName}_a");
                    candidates.Add($"T_StoryPhoto_{cgName}");
                    candidates.Add($"T_StoryPhoto{cgName}");
                    candidates.Add($"T_StoryPhoto_{cgName}_b");
                }
                else if (gender == 1) // Male
                {
                    candidates.Add($"T_StoryPhoto_{cgName}_b");
                    candidates.Add($"T_StoryPhoto{cgName}_b");
                    candidates.Add($"T_StoryPhoto_{cgName}");
                    candidates.Add($"T_StoryPhoto{cgName}");
                    candidates.Add($"T_StoryPhoto_{cgName}_a");
                }
                else
                {
                    candidates.Add($"T_StoryPhoto_{cgName}");
                    candidates.Add($"T_StoryPhoto{cgName}");
                    candidates.Add($"T_StoryPhoto_{cgName}_a");
                    candidates.Add($"T_StoryPhoto_{cgName}_b");
                    candidates.Add($"T_StoryPhoto{cgName}_a");
                    candidates.Add($"T_StoryPhoto{cgName}_b");
                }

                string? matchedPkg = null;
                const string archivePrefix = "Client/Content/Aki/UI/UIResources/Common/Image/Archive/";
                foreach (var cand in candidates)
                {
                    if (_archiveTextures.TryGetValue(cand, out var pkgPath))
                    {
                        matchedPkg = pkgPath;
                        break;
                    }
                    var fullCand = archivePrefix + cand;
                    if (_provider.Files.ContainsKey(fullCand + ".uasset") || _provider.Files.ContainsKey(fullCand))
                    {
                        matchedPkg = fullCand;
                        break;
                    }
                }

                if (matchedPkg == null)
                {
                    // Instant search in pre-indexed _archiveTextures for matching cgName (only ~300 items, 0.001ms)
                    foreach (var kvp in _archiveTextures)
                    {
                        if (kvp.Key.Contains(cgName, StringComparison.OrdinalIgnoreCase))
                        {
                            if (gender == 0 && (kvp.Key.EndsWith("_a", StringComparison.OrdinalIgnoreCase) || kvp.Key.Contains("_nv", StringComparison.OrdinalIgnoreCase)))
                            {
                                matchedPkg = kvp.Value;
                                break;
                            }
                            if (gender == 1 && (kvp.Key.EndsWith("_b", StringComparison.OrdinalIgnoreCase) || kvp.Key.Contains("_nan", StringComparison.OrdinalIgnoreCase)))
                            {
                                matchedPkg = kvp.Value;
                                break;
                            }
                            matchedPkg ??= kvp.Value;
                        }
                    }
                }

                if (matchedPkg != null && _provider.TryLoadPackage(matchedPkg, out var pkg))
                {
                    foreach (var exp in pkg.GetExports())
                    {
                        if (exp is CUE4Parse.UE4.Assets.Exports.Texture.UTexture uTex)
                        {
                            CUE4Parse_Conversion.Textures.TextureDecoder.UseAssetRipperTextureDecoder = true;
                            var cTex = CUE4Parse_Conversion.Textures.TextureDecoder.Decode(uTex);
                            if (cTex != null)
                            {
                                var jpgBytes = CUE4Parse_Conversion.Textures.TextureEncoder.Encode(
                                    cTex,
                                    CUE4Parse_Conversion.Options.ETextureFormat.Jpeg,
                                    false,
                                    out _,
                                    85
                                );
                                if (jpgBytes != null && jpgBytes.Length > 0)
                                {
                                    var targetSavePath = !string.IsNullOrEmpty(outputDir) ? Path.Combine(outputDir, $"thumb_{cgName}{genderSuffix}.jpg") : "";
                                    if (!string.IsNullOrEmpty(targetSavePath))
                                    {
                                        Directory.CreateDirectory(outputDir);
                                        File.WriteAllBytes(targetSavePath, jpgBytes);
                                    }
                                    var base64 = $"data:image/jpeg;base64,{Convert.ToBase64String(jpgBytes)}";
                                    SendResponse(new JsonObject
                                    {
                                        ["status"] = "ok",
                                        ["id"] = reqId,
                                        ["cg_name"] = cgName,
                                        ["path"] = targetSavePath,
                                        ["base64"] = base64
                                    });
                                    return;
                                }
                            }
                        }
                    }
                }

                // Fallback: If no texture in Archive, check if video asset exists in PAK or local
                var (matchedVideo, localVid) = FindVideoMatch(cgName, cgFile, gender == 0 ? "Girl" : gender == 1 ? "Boy" : "", "");
                string? tempVideoToClean = null;
                string? videoSourcePath = null;

                if (!string.IsNullOrEmpty(localVid) && File.Exists(localVid))
                {
                    videoSourcePath = localVid;
                }
                else if (matchedVideo != null)
                {
                    try
                    {
                        var vBytes = _provider.SaveAsset(matchedVideo);
                        if (vBytes != null && vBytes.Length > 0)
                        {
                            var tempDir = Path.Combine(Path.GetTempPath(), "wuwa_thumb_temp");
                            Directory.CreateDirectory(tempDir);
                            var ext = Path.GetExtension(matchedVideo.Path);
                            tempVideoToClean = Path.Combine(tempDir, $"{Guid.NewGuid()}{ext}");
                            File.WriteAllBytes(tempVideoToClean, vBytes);
                            videoSourcePath = tempVideoToClean;
                        }
                    }
                    catch { }
                }

                if (!string.IsNullOrEmpty(videoSourcePath) && File.Exists(videoSourcePath))
                {
                    var targetSavePath = !string.IsNullOrEmpty(outputDir)
                        ? Path.Combine(outputDir, $"thumb_{cgName}{genderSuffix}.jpg")
                        : Path.Combine(Path.GetTempPath(), $"thumb_{cgName}{genderSuffix}.jpg");

                    var ffmpegExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ffmpeg.exe");
                    if (!File.Exists(ffmpegExe)) ffmpegExe = "ffmpeg";

                    var seekPoints = new[] { "00:00:03.500", "00:00:07.000", "00:00:01.000" };
                    foreach (var seek in seekPoints)
                    {
                        try
                        {
                            var psi = new ProcessStartInfo
                            {
                                FileName = ffmpegExe,
                                Arguments = $"-y -ss {seek} -i \"{videoSourcePath}\" -vf \"scale=480:-1\" -vframes 1 -q:v 4 \"{targetSavePath}\"",
                                UseShellExecute = false,
                                CreateNoWindow = true,
                                RedirectStandardError = true,
                                RedirectStandardOutput = true
                            };
                            using var proc = Process.Start(psi);
                            if (proc != null)
                            {
                                proc.WaitForExit(3000);
                                if (File.Exists(targetSavePath) && new FileInfo(targetSavePath).Length >= 3500)
                                {
                                    var jpgBytes = File.ReadAllBytes(targetSavePath);
                                    var base64 = $"data:image/jpeg;base64,{Convert.ToBase64String(jpgBytes)}";
                                    SendResponse(new JsonObject
                                    {
                                        ["status"] = "ok",
                                        ["id"] = reqId,
                                        ["cg_name"] = cgName,
                                        ["path"] = targetSavePath,
                                        ["base64"] = base64
                                    });
                                    if (tempVideoToClean != null && File.Exists(tempVideoToClean))
                                    {
                                        try { File.Delete(tempVideoToClean); } catch { }
                                    }
                                    return;
                                }
                            }
                        }
                        catch { }
                    }
                }

                if (tempVideoToClean != null && File.Exists(tempVideoToClean))
                {
                    try { File.Delete(tempVideoToClean); } catch { }
                }

                // If not found in game textures or video, report not_found
                SendResponse(new JsonObject
                {
                    ["status"] = "not_found",
                    ["id"] = reqId,
                    ["cg_name"] = cgName
                });
            }
            catch (Exception ex)
            {
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = ex.Message
                });
            }
        }

    }
}
