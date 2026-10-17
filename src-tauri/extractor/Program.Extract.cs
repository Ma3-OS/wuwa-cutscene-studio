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
        private static async Task HandleExtractAsync(string reqId, string cgName, string videoPath, string[] soundHints, string outputDir, string gender = "", string exportDir = "", string locale = "ja")
        {
            SendLog($"เริ่มคำขอสกัดไฟล์คัตซีน {cgName} รหัส {reqId}");

            // Gracefully await provider initialization if in progress (up to 30s)
            if (!_providerReadyTcs.Task.IsCompleted)
            {
                SendLog($"กำลังรอเอนจิน CUE4Parse โหลดข้อมูลให้พร้อมใช้งาน...");
                var completedTask = await Task.WhenAny(_providerReadyTcs.Task, Task.Delay(30000));
                if (completedTask != _providerReadyTcs.Task || !_providerReadyTcs.Task.Result)
                {
                    SendLog($"การเชื่อมต่อเอนจินหมดเวลา หรือเกิดข้อผิดพลาด", "error");
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
                SendLog($"เอนจิน CUE4Parse ยังไม่ได้เริ่มต้น", "error");
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = "Provider not initialized"
                });
                return;
            }

            var cts = new CancellationTokenSource();
            _tasks[reqId] = cts;
            var sw = Stopwatch.StartNew();

            try
            {
                Directory.CreateDirectory(outputDir);
                string extractedVideo = "";
                var extractedSounds = new JsonArray();

                var ct = cts.Token;
                ct.ThrowIfCancellationRequested();

                // Find matching video asset
                var (targetVideo, localSource) = FindVideoMatch(cgName, videoPath, gender, exportDir);

                if (!string.IsNullOrEmpty(localSource) && File.Exists(localSource))
                {
                    var fname = Path.GetFileName(localSource);
                    var destVideo = Path.Combine(outputDir, fname);
                    if (!File.Exists(destVideo) || new FileInfo(destVideo).Length != new FileInfo(localSource).Length)
                    {
                        File.Copy(localSource, destVideo, true);
                    }
                    extractedVideo = destVideo;
                    SendLog($"คัดลอกไฟล์วิดีโอจากโฟลเดอร์ส่งออกสำเร็จ {fname}", "success");
                }
                else if (targetVideo != null)
                {
                    SendLog($"กำลังเริ่มสกัดไฟล์วิดีโอ {targetVideo.Path} ขนาด {targetVideo.Size} ไบต์...");
                    try
                    {
                        var bytes = _provider.SaveAsset(targetVideo);
                        if (bytes != null && bytes.Length > 0)
                        {
                            var fname = Path.GetFileName(targetVideo.Path);
                            var destVideo = Path.Combine(outputDir, fname);
                            File.WriteAllBytes(destVideo, bytes);
                            extractedVideo = destVideo;
                            SendLog($"สกัดไฟล์วิดีโอสำเร็จ {fname} ขนาด {bytes.Length} ไบต์", "success");
                        }
                    }
                    catch (Exception ex)
                    {
                        SendLog($"เกิดข้อผิดพลาดขณะเขียนไฟล์วิดีโอ: {ex.Message}", "error");
                    }
                }

                // Locate and extract audio banks (.bnk / .wem) matching soundHints or cgName
                ct.ThrowIfCancellationRequested();
                var savedAudios = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                SendLog($"กำลังค้นหาไฟล์เสียง Wwise ที่เกี่ยวข้องกับ {cgName}...");
                var searchPatterns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var hint in soundHints)
                {
                    if (string.IsNullOrEmpty(hint)) continue;
                    searchPatterns.Add(hint);
                    var stripped = hint.Replace("play_video_all_sound_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_seq_all_sound_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_all_sound_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_sound_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_sequence_music_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_story_music_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_sfx_lva_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_sfx_lvb_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_sfx_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_vo_story_", "", StringComparison.OrdinalIgnoreCase)
                                       .Replace("play_vo_", "", StringComparison.OrdinalIgnoreCase);

                    var coreId = stripped.Replace("_nvzhu", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("_nanzhu", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("_nv", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("_nan", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("_cam010", "", StringComparison.OrdinalIgnoreCase)
                                         .Replace("_cam020", "", StringComparison.OrdinalIgnoreCase)
                                         .Trim();

                    if (!string.IsNullOrEmpty(coreId))
                    {
                        searchPatterns.Add(coreId);
                        searchPatterns.Add("play_video_all_sound_" + coreId);
                        searchPatterns.Add("play_seq_all_sound_" + coreId);
                        searchPatterns.Add("play_all_sound_" + coreId);
                        searchPatterns.Add("play_sequence_music_" + coreId);
                        searchPatterns.Add("play_story_music_" + coreId);
                        searchPatterns.Add("play_sfx_lva_" + coreId);
                        searchPatterns.Add("play_sfx_lvb_" + coreId);
                        searchPatterns.Add("play_sfx_" + coreId);
                        searchPatterns.Add("play_sound_" + coreId);
                        searchPatterns.Add("play_vo_story_" + coreId);
                        searchPatterns.Add("play_vo_" + coreId);
                        searchPatterns.Add("vo_" + coreId);
                        searchPatterns.Add("set_music_" + coreId);
                        searchPatterns.Add("set_state_" + coreId);
                    }
                }

                if (!string.IsNullOrEmpty(cgName))
                {
                    var cleanCg = cgName.Replace("_nvzhu", "", StringComparison.OrdinalIgnoreCase)
                                        .Replace("_nanzhu", "", StringComparison.OrdinalIgnoreCase)
                                        .Replace("_nv", "", StringComparison.OrdinalIgnoreCase)
                                        .Replace("_nan", "", StringComparison.OrdinalIgnoreCase)
                                        .Trim();
                    searchPatterns.Add(cleanCg);
                    var lowerCg = cleanCg.ToLowerInvariant();
                    searchPatterns.Add("play_video_all_sound_" + lowerCg);
                    searchPatterns.Add("play_seq_all_sound_" + lowerCg);
                    searchPatterns.Add("play_all_sound_" + lowerCg);
                    searchPatterns.Add("play_sequence_music_" + lowerCg);
                    searchPatterns.Add("play_story_music_" + lowerCg);
                    searchPatterns.Add("play_sfx_lva_" + lowerCg);
                    searchPatterns.Add("play_sfx_lvb_" + lowerCg);
                    searchPatterns.Add("play_sfx_" + lowerCg);
                    searchPatterns.Add("play_sound_" + lowerCg);
                    searchPatterns.Add("play_vo_story_" + lowerCg);
                    searchPatterns.Add("play_vo_" + lowerCg);
                    searchPatterns.Add("vo_" + lowerCg);
                    searchPatterns.Add("set_music_" + lowerCg);
                    searchPatterns.Add("set_state_" + lowerCg);
                }

                if (!string.IsNullOrEmpty(videoPath))
                {
                    var normVp = videoPath.Replace('\\', '/');
                    var parts = normVp.Split('/');
                    foreach (var part in parts)
                    {
                        if (part.Contains('_') && (part.StartsWith("0") || part.StartsWith("Section") || part.StartsWith("Main")))
                        {
                            var cleanedPart = part.Replace("Section", "", StringComparison.OrdinalIgnoreCase)
                                                  .Replace("03_5", "3_5", StringComparison.OrdinalIgnoreCase)
                                                  .Trim();
                            if (!string.IsNullOrEmpty(cleanedPart))
                            {
                                searchPatterns.Add($"quest_{cleanedPart}_{cgName.ToLowerInvariant()}");
                                searchPatterns.Add($"quest_{cleanedPart}");
                            }
                        }
                    }
                }

                // Fast 0.5 ms Wwise BGM and Event Scan from .uasset NameMap
                try
                {
                    var uassetCandidates = new List<string>();
                    if (!string.IsNullOrEmpty(videoPath) && videoPath.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
                    {
                        uassetCandidates.Add(videoPath);
                    }
                    if (!string.IsNullOrEmpty(cgName))
                    {
                        var cleanStem = cgName.Replace("_nvzhu", "", StringComparison.OrdinalIgnoreCase)
                                              .Replace("_nanzhu", "", StringComparison.OrdinalIgnoreCase)
                                              .Replace("_nv", "", StringComparison.OrdinalIgnoreCase)
                                              .Replace("_nan", "", StringComparison.OrdinalIgnoreCase).Trim();
                        if (_provider != null)
                        {
                            foreach (var key in _provider.Files.Keys)
                            {
                                if (key.EndsWith($"{cleanStem}.uasset", StringComparison.OrdinalIgnoreCase) && key.Contains("Sequence", StringComparison.OrdinalIgnoreCase))
                                {
                                    uassetCandidates.Add(key);
                                    break;
                                }
                            }
                        }
                    }

                    int nameMapEventsFound = 0;
                    foreach (var uCandidate in uassetCandidates)
                    {
                        if (_provider != null && _provider.TryLoadPackage(uCandidate, out var uPkg))
                        {
                            foreach (var nameEntry in uPkg.NameMap)
                            {
                                var nText = nameEntry.Name;
                                if (string.IsNullOrEmpty(nText)) continue;
                                if (nText.StartsWith("play_", StringComparison.OrdinalIgnoreCase) ||
                                    nText.StartsWith("bgm_", StringComparison.OrdinalIgnoreCase) ||
                                    nText.StartsWith("music_", StringComparison.OrdinalIgnoreCase) ||
                                    nText.StartsWith("set_state_", StringComparison.OrdinalIgnoreCase) ||
                                    nText.StartsWith("set_music_", StringComparison.OrdinalIgnoreCase) ||
                                    nText.StartsWith("ak_event_", StringComparison.OrdinalIgnoreCase))
                                {
                                    if (searchPatterns.Add(nText))
                                    {
                                        nameMapEventsFound++;
                                    }
                                }
                            }
                        }
                    }
                    if (nameMapEventsFound > 0)
                    {
                        SendLog($"พบ Wwise Event จาก NameMap ของ {cgName} จำนวน {nameMapEventsFound} รายการ", "info");
                    }
                }
                catch { }

                var targetWemSubdir = Path.Combine(outputDir, "wem");
                Directory.CreateDirectory(targetWemSubdir);
                var targetAudioSubdir = Path.Combine(outputDir, "audio");
                Directory.CreateDirectory(targetAudioSubdir);

                SendLog($"กำลังค้นหาไฟล์เสียง Wwise ที่เกี่ยวข้องกับ {cgName} ในคลัง Bank {_allBnkFiles.Count} ไฟล์...");

                var allMediaIdsToExtract = new HashSet<uint>();

                foreach (var gf in _allBnkFiles)
                {
                    ct.ThrowIfCancellationRequested();
                    var p = gf.Path;

                    var normP = p.Replace('\\', '/').ToLowerInvariant();
                    bool isLocalized = normP.Contains("/ja/") || normP.Contains("/en/") || normP.Contains("/zh/") || normP.Contains("/ko/");
                    if (isLocalized)
                    {
                        var targetLangFolder = "/" + (locale ?? "ja").ToLowerInvariant() + "/";
                        if (!normP.Contains(targetLangFolder))
                        {
                            continue;
                        }
                    }

                    var fnStem = Path.GetFileNameWithoutExtension(p);
                    bool isMatch = false;
                    foreach (var pat in searchPatterns)
                    {
                        if (string.IsNullOrEmpty(pat)) continue;
                        if (IsExactOrWordBoundaryMatch(fnStem, pat))
                        {
                            isMatch = true;
                            break;
                        }
                    }

                    if (isMatch)
                    {
                        var fileName = Path.GetFileName(gf.Path);
                        var destAudio = Path.Combine(outputDir, fileName);

                        if (!savedAudios.Contains(destAudio))
                        {
                            byte[]? b = null;
                            if (!File.Exists(destAudio) || new FileInfo(destAudio).Length == 0)
                            {
                                b = _provider.SaveAsset(gf);
                                if (b != null && b.Length > 0)
                                {
                                    File.WriteAllBytes(destAudio, b);
                                    try
                                    {
                                        var audioSubDest = Path.Combine(targetAudioSubdir, fileName);
                                        File.WriteAllBytes(audioSubDest, b);
                                    }
                                    catch {}
                                }
                            }
                            else
                            {
                                try { b = File.ReadAllBytes(destAudio); } catch {}
                            }

                            savedAudios.Add(destAudio);
                            extractedSounds.Add(destAudio);
                            SendLog($"สกัดไฟล์เสียง Wwise สำเร็จ {fileName}");

                            if (fileName.EndsWith(".bnk", StringComparison.OrdinalIgnoreCase) && b != null)
                            {
                                try
                                {
                                    var mediaIds = ExtractMediaIdsFromBnk(b);
                                    foreach (var mid in mediaIds)
                                    {
                                        allMediaIdsToExtract.Add(mid);
                                    }
                                }
                                catch (Exception bnkEx)
                                {
                                    SendLog($"ข้อผิดพลาดในการสแกน WEM จาก {fileName}: {bnkEx.Message}", "warn");
                                }
                            }
                        }
                    }
                }

                // Parallel extraction of all discovered .wem streams
                if (allMediaIdsToExtract.Count > 0)
                {
                    SendLog($"ตรวจพบสตรีมเสียง WEM ทั้งหมด {allMediaIdsToExtract.Count} ไฟล์ กำลังสกัดแบบคู่ขนาน...");
                    var parallelWems = new ConcurrentBag<string>();
                    var parallelOpts = new ParallelOptions
                    {
                        MaxDegreeOfParallelism = Math.Max(1, Environment.ProcessorCount),
                        CancellationToken = ct
                    };

                    await Parallel.ForEachAsync(allMediaIdsToExtract, parallelOpts, async (mid, token) =>
                    {
                        var stem = mid.ToString();
                        var destWem = Path.Combine(targetWemSubdir, stem + ".wem");
                        if (File.Exists(destWem) && new FileInfo(destWem).Length > 0)
                        {
                            parallelWems.Add(destWem);
                            return;
                        }

                        List<GameFile>? wemCandidates = null;
                        lock (_initLock)
                        {
                            _wemFilesByStem.TryGetValue(stem, out wemCandidates);
                        }

                        if (wemCandidates != null && wemCandidates.Count > 0)
                        {
                            var bestWem = SelectWemByLocale(wemCandidates, locale);
                            byte[]? wemBytes = null;
                            try
                            {
                                wemBytes = _provider.SaveAsset(bestWem);
                            }
                            catch {}

                            if (wemBytes != null && wemBytes.Length > 0)
                            {
                                await File.WriteAllBytesAsync(destWem, wemBytes, token);
                                parallelWems.Add(destWem);
                            }
                        }
                    });

                    foreach (var w in parallelWems)
                    {
                        if (!savedAudios.Contains(w))
                        {
                            savedAudios.Add(w);
                            extractedSounds.Add(w);
                        }
                    }
                    SendLog($"สกัดไฟล์เสียง WEM แบบคู่ขนานสำเร็จ {parallelWems.Count} ไฟล์");
                }

                sw.Stop();

                if (string.IsNullOrEmpty(extractedVideo))
                {
                    // For in-engine 3D Level Sequences, there is no MP4 video file in the PAKs.
                    // If audio was extracted or it's an in-engine sequence, return success!
                    if (extractedSounds.Count > 0)
                    {
                        SendLog($"สกัดไฟล์เสียงสำหรับ 3D Sequence {cgName} สำเร็จ {extractedSounds.Count} ไฟล์ เป็น In-Engine LevelSequence ที่ไม่มีไฟล์วิดีโอ MP4 ในแพ็กเกจเกม", "success");
                        SendResponse(new JsonObject
                        {
                            ["status"] = "ok",
                            ["id"] = reqId,
                            ["cg_name"] = cgName,
                            ["video_file"] = "",
                            ["audio_files"] = extractedSounds,
                            ["is_level_sequence"] = true,
                            ["elapsed_ms"] = sw.ElapsedMilliseconds
                        });
                        return;
                    }

                    if ((videoPath ?? "").Contains("Sequence", StringComparison.OrdinalIgnoreCase) ||
                        (videoPath ?? "").EndsWith(".uasset", StringComparison.OrdinalIgnoreCase))
                    {
                        SendLog($"บันทึกข้อมูล 3D LevelSequence {cgName} สำเร็จ เป็น In-Engine LevelSequence", "info");
                        SendResponse(new JsonObject
                        {
                            ["status"] = "ok",
                            ["id"] = reqId,
                            ["cg_name"] = cgName,
                            ["video_file"] = "",
                            ["audio_files"] = extractedSounds,
                            ["is_level_sequence"] = true,
                            ["elapsed_ms"] = sw.ElapsedMilliseconds
                        });
                        return;
                    }

                    SendLog($"ไม่พบไฟล์วิดีโอที่มีชื่อสอดคล้องกับคัตซีน {cgName} ในแพ็กเกจเกมหรือโฟลเดอร์ส่งออก", "warn");
                    SendResponse(new JsonObject
                    {
                        ["status"] = "error",
                        ["id"] = reqId,
                        ["message"] = $"ไม่พบไฟล์วิดีโอสำหรับคัตซีน {cgName} ในแพ็กเกจเกมหรือโฟลเดอร์ส่งออก"
                    });
                    return;
                }

                SendLog($"กระบวนการสกัดคัตซีน {cgName} เสร็จสมบูรณ์ ใช้เวลา {sw.ElapsedMilliseconds} ms", "success");
                SendResponse(new JsonObject
                {
                    ["status"] = "ok",
                    ["id"] = reqId,
                    ["cg_name"] = cgName,
                    ["video_file"] = extractedVideo,
                    ["audio_files"] = extractedSounds,
                    ["elapsed_ms"] = sw.ElapsedMilliseconds
                });
            }

            catch (OperationCanceledException)
            {
                SendLog($"คำขอสกัดคัตซีน {cgName} ถูกยกเลิกโดยผู้ใช้", "warn");
                SendResponse(new JsonObject
                {
                    ["status"] = "cancelled",
                    ["id"] = reqId
                });
            }
            catch (Exception ex)
            {
                sw.Stop();
                SendLog($"เกิดข้อผิดพลาดในการสกัดคัตซีน {cgName}: {ex.Message}", "error");
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = ex.Message,
                    ["elapsed_ms"] = sw.ElapsedMilliseconds
                });
            }
            finally
            {
                _tasks.TryRemove(reqId, out _);
                cts.Dispose();
            }
        }

        private static HashSet<uint> ExtractMediaIdsFromBnk(byte[] data)
        {
            var ids = new HashSet<uint>();
            if (data == null || data.Length < 16) return ids;

            // Search for "DIDX" chunk (Data Index of embedded/stream media)
            for (int i = 0; i < data.Length - 8; i++)
            {
                if (data[i] == 0x44 && data[i + 1] == 0x49 && data[i + 2] == 0x44 && data[i + 3] == 0x58) // "DIDX"
                {
                    int chunkSize = BitConverter.ToInt32(data, i + 4);
                    int start = i + 8;
                    int end = Math.Min(data.Length, start + chunkSize);
                    for (int offset = start; offset + 12 <= end; offset += 12)
                    {
                        uint id = BitConverter.ToUInt32(data, offset);
                        if (id > 0) ids.Add(id);
                    }
                    break;
                }
            }

            // Also search for "HIRC" chunk (Hierarchy: Sound SFX / Voice referencing source IDs)
            for (int i = 0; i < data.Length - 8; i++)
            {
                if (data[i] == 0x48 && data[i + 1] == 0x49 && data[i + 2] == 0x52 && data[i + 3] == 0x43) // "HIRC"
                {
                    int chunkSize = BitConverter.ToInt32(data, i + 4);
                    int count = BitConverter.ToInt32(data, i + 8);
                    int pos = i + 12;
                    int end = Math.Min(data.Length, i + 8 + chunkSize);

                    for (int item = 0; item < count && pos + 5 < end; item++)
                    {
                        byte objType = data[pos];
                        int objSize = BitConverter.ToInt32(data, pos + 1);
                        int objDataStart = pos + 5;
                        if (objDataStart + objSize > end) break;

                        if (objType == 2 && objSize >= 14)
                        {
                            for (int off = 0; off + 4 <= objSize; off++)
                            {
                                uint candidateId = BitConverter.ToUInt32(data, objDataStart + off);
                                if (candidateId > 1000 && _wemFilesByStem.ContainsKey(candidateId.ToString()))
                                {
                                    ids.Add(candidateId);
                                }
                            }
                        }
                        pos = objDataStart + objSize;
                    }
                    break;
                }
            }

            return ids;
        }

        private static GameFile SelectWemByLocale(List<GameFile> candidates, string locale)
        {
            if (candidates.Count == 1) return candidates[0];

            var normLocale = (locale ?? "").ToLowerInvariant().Trim();
            string[] langKeywords = normLocale switch
            {
                "ja" or "jp" or "japanese" => new[] { "japanese", "japan", "/ja/", "_ja", "/jp" },
                "en" or "english" => new[] { "english", "/en/", "_en", "en-us" },
                "zh-hans" or "zh" or "chinese" => new[] { "chinese", "zh-hans", "zh_hans", "/zh/" },
                "zh-hant" => new[] { "zh-hant", "zh_hant", "traditional" },
                "ko" or "korean" => new[] { "korean", "korea", "/ko/", "_ko" },
                _ => Array.Empty<string>()
            };

            foreach (var kw in langKeywords)
            {
                foreach (var c in candidates)
                {
                    if (c.Path.Contains(kw, StringComparison.OrdinalIgnoreCase))
                    {
                        return c;
                    }
                }
            }

            return candidates[0];
        }

        private static async Task HandleExtractWemBatchAsync(string reqId, List<string> wemStems, string outputDir, string locale)
        {
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

            var targetWemDir = Path.Combine(outputDir, "wem");
            Directory.CreateDirectory(targetWemDir);

            int extractedCount = 0;
            var extractedPaths = new JsonArray();

            await Task.Run(() =>
            {
                foreach (var stemRaw in wemStems)
                {
                    var stem = Path.GetFileNameWithoutExtension(stemRaw).Trim();
                    if (string.IsNullOrEmpty(stem)) continue;

                    var destFile = Path.Combine(targetWemDir, stem + ".wem");
                    if (File.Exists(destFile) && new FileInfo(destFile).Length > 0)
                    {
                        extractedPaths.Add(destFile);
                        extractedCount++;
                        continue;
                    }

                    if (_wemFilesByStem.TryGetValue(stem, out var candidates) && candidates.Count > 0)
                    {
                        var bestFile = SelectWemByLocale(candidates, locale);
                        try
                        {
                            var bytes = _provider.SaveAsset(bestFile);
                            if (bytes != null && bytes.Length > 0)
                            {
                                File.WriteAllBytes(destFile, bytes);
                                extractedPaths.Add(destFile);
                                extractedCount++;
                            }
                        }
                        catch (Exception ex)
                        {
                            SendLog($"ข้อผิดพลาดในการสกัดไฟล์เสียง {stem}.wem: {ex.Message}", "warn");
                        }
                    }
                }
            });

            SendLog($"สกัดไฟล์เสียง WEM สำเร็จ {extractedCount} ไฟล์สำหรับ {reqId}");
            SendResponse(new JsonObject
            {
                ["status"] = "ok",
                ["id"] = reqId,
                ["extracted_count"] = extractedCount,
                ["files"] = extractedPaths
            });
        }

    }
}
