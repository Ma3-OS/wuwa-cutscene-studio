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
        private static void InitializeProvider(string paksDir, string keysFile, string reqId = "", string exportDir = "")
        {
            if (!string.IsNullOrEmpty(exportDir))
            {
                _exportDir = exportDir;
            }

            if (_provider != null)
            {
                _providerReadyTcs.TrySetResult(true);
                SendResponse(new JsonObject
                {
                    ["status"] = "ready",
                    ["id"] = reqId,
                    ["mounted_paks"] = _provider.UnloadedVfs.Count + _provider.MountedVfs.Count,
                    ["files_count"] = _provider.Files.Count,
                    ["keys_loaded"] = 0,
                    ["elapsed_ms"] = 0
                });
                return;
            }

            lock (_initLock)
            {
                if (_provider != null)
                {
                    _providerReadyTcs.TrySetResult(true);
                    SendResponse(new JsonObject
                    {
                        ["status"] = "ready",
                        ["id"] = reqId,
                        ["mounted_paks"] = _provider.UnloadedVfs.Count + _provider.MountedVfs.Count,
                        ["files_count"] = _provider.Files.Count,
                        ["keys_loaded"] = 0,
                        ["elapsed_ms"] = 0
                    });
                    return;
                }

                if (_isInitializing) return;
                _isInitializing = true;
            }

            var sw = Stopwatch.StartNew();
            try
            {
                if (!Directory.Exists(paksDir))
                {
                    _providerReadyTcs.TrySetResult(false);
                    SendLog($"ไม่พบไดเรกทอรีแพ็กเกจเกม {paksDir}", "error");
                    SendResponse(new JsonObject
                    {
                        ["status"] = "error",
                        ["id"] = reqId,
                        ["message"] = $"ไม่พบไดเรกทอรีแพ็กเกจเกม {paksDir}"
                    });
                    return;
                }

                SendLog($"กำลังเริ่มต้นเชื่อมต่อเอนจิน CUE4Parse กับไดเรกทอรีเกม...");

                // 1. Initialize Oodle decompression if native library exists
                try
                {
                    var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    var oodleCandidate1 = Path.Combine(baseDir, "oo2core_9_win64.dll");
                    var oodleCandidate2 = Path.Combine(baseDir, "oodle-data-shared.dll");
                    if (File.Exists(oodleCandidate1))
                    {
                        OodleHelper.Initialize(oodleCandidate1);
                    }
                    else if (File.Exists(oodleCandidate2))
                    {
                        OodleHelper.Initialize(oodleCandidate2);
                    }
                }
                catch { }

                // 2. Discover parent Content and Saved folders to include all game paks and video paks
                var targetDir = paksDir;
                var extraDirs = new List<DirectoryInfo>();
                try
                {
                    var paksDirInfo = new DirectoryInfo(paksDir);
                    if (paksDirInfo.Name.Equals("Paks", StringComparison.OrdinalIgnoreCase) &&
                        paksDirInfo.Parent != null &&
                        Directory.Exists(paksDirInfo.Parent.FullName))
                    {
                        targetDir = paksDirInfo.Parent.FullName; // e.g. Client/Content

                        // Recursively discover all pak folders under Saved (Resources, Video/uhd/Paks, PersistentDownloadDir)
                        var clientDir = paksDirInfo.Parent.Parent;
                        if (clientDir != null && clientDir.Exists)
                        {
                            var savedDir = new DirectoryInfo(Path.Combine(clientDir.FullName, "Saved"));
                            if (savedDir.Exists)
                            {
                                try
                                {
                                    if (savedDir.EnumerateFiles("*.pak", SearchOption.TopDirectoryOnly).Any())
                                    {
                                        extraDirs.Add(savedDir);
                                    }
                                    foreach (var sub in savedDir.EnumerateDirectories("*", SearchOption.AllDirectories))
                                    {
                                        try
                                        {
                                            if (sub.EnumerateFiles("*.pak", SearchOption.TopDirectoryOnly).Any())
                                            {
                                                extraDirs.Add(sub);
                                            }
                                        }
                                        catch { }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch { }

                // 3. Initialize CUE4Parse with Wuthering Waves container across all pak directories
                SendLog($"กำลังสแกนค้นหาแพ็กเกจเกมจาก {targetDir} และโฟลเดอร์เสริม {extraDirs.Count} แห่ง");
                _provider = new DefaultFileProvider(new DirectoryInfo(targetDir), extraDirs.ToArray(), SearchOption.AllDirectories, new VersionContainer(EGame.GAME_WutheringWaves), StringComparer.OrdinalIgnoreCase);
                _provider.Initialize();

                // 4. Submit all AES keys in bulk
                var keysDict = new Dictionary<FGuid, FAesKey>();
                string resolvedKeysFile = keysFile;
                if (string.IsNullOrEmpty(resolvedKeysFile) || !File.Exists(resolvedKeysFile))
                {
                    var fallbackCandidates = new[]
                    {
                        keysFile,
                        Path.Combine(Directory.GetCurrentDirectory(), keysFile ?? ""),
                        Path.Combine(Directory.GetCurrentDirectory(), "data", "vid.json"),
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, keysFile ?? ""),
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "data", "vid.json"),
                        Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "data", "vid.json"),
                    };
                    foreach (var c in fallbackCandidates)
                    {
                        if (!string.IsNullOrEmpty(c) && File.Exists(c))
                        {
                            resolvedKeysFile = Path.GetFullPath(c);
                            break;
                        }
                    }
                }

                if (!string.IsNullOrEmpty(resolvedKeysFile) && File.Exists(resolvedKeysFile))
                {
                    SendLog($"กำลังนำเข้ากุญแจถอดรหัส AES จาก {Path.GetFileName(resolvedKeysFile)}");
                    var keysJson = File.ReadAllText(resolvedKeysFile);
                    using var doc = JsonDocument.Parse(keysJson);
                    var root = doc.RootElement;

                    if (root.TryGetProperty("mainKey", out var mainKeyProp))
                    {
                        var mainKeyStr = mainKeyProp.GetString();
                        if (!string.IsNullOrEmpty(mainKeyStr))
                        {
                            keysDict[new FGuid()] = new FAesKey(mainKeyStr);
                        }
                    }

                    if (root.TryGetProperty("dynamicKeys", out var dynamicKeysProp) && dynamicKeysProp.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var keyItem in dynamicKeysProp.EnumerateArray())
                        {
                            if (keyItem.TryGetProperty("guid", out var guidProp) && keyItem.TryGetProperty("key", out var keyValProp))
                            {
                                var gStr = guidProp.GetString();
                                var kStr = keyValProp.GetString();
                                if (!string.IsNullOrEmpty(gStr) && !string.IsNullOrEmpty(kStr))
                                {
                                    try
                                    {
                                        var guid = new FGuid(gStr);
                                        keysDict[guid] = new FAesKey(kStr);
                                    }
                                    catch { }
                                }
                            }
                        }
                    }
                    // Also merge any extra dynamic keys from FModel's AppSettings.json if available
                    try
                    {
                        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                        var fmodelSettingsPath = Path.Combine(appData, "FModel", "AppSettings.json");
                        if (File.Exists(fmodelSettingsPath))
                        {
                            var fmodelJson = File.ReadAllText(fmodelSettingsPath);
                            using var fdoc = JsonDocument.Parse(fmodelJson);
                            if (fdoc.RootElement.TryGetProperty("PerDirectory", out var perDirProp))
                            {
                                foreach (var gameDirProp in perDirProp.EnumerateObject())
                                {
                                    if (gameDirProp.Value.TryGetProperty("AesKeys", out var aesProp))
                                    {
                                        if (aesProp.TryGetProperty("dynamicKeys", out var fDynProp) && fDynProp.ValueKind == JsonValueKind.Array)
                                        {
                                            foreach (var kItem in fDynProp.EnumerateArray())
                                            {
                                                if (kItem.TryGetProperty("guid", out var gP) && kItem.TryGetProperty("key", out var kP))
                                                {
                                                    var gS = gP.GetString();
                                                    var kS = kP.GetString();
                                                    if (!string.IsNullOrEmpty(gS) && !string.IsNullOrEmpty(kS))
                                                    {
                                                        try
                                                        {
                                                            var guid = new FGuid(gS);
                                                            if (!keysDict.ContainsKey(guid))
                                                            {
                                                                keysDict[guid] = new FAesKey(kS);
                                                            }
                                                        }
                                                        catch { }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }

                int keysLoaded = 0;
                if (keysDict.Count > 0)
                {
                    keysLoaded = _provider.SubmitKeys(keysDict);
                    _provider.PostMount();
                }

                // Pre-index all video assets (.mp4, .bk2, .webm, .usm) and UI archive story photo textures
                lock (_initLock)
                {
                    _videoFilesByStem.Clear();
                    _videoFilesByExactName.Clear();
                    _allVideoFiles.Clear();
                    _allBnkFiles.Clear();
                    _archiveTextures.Clear();
                    _wemFilesByStem.Clear();
                    _looseDiskVideos.Clear();
                    _looseVideosByStem.Clear();
                    _looseVideosByExactName.Clear();
                    _looseVideosByBaseStem.Clear();
                    _videosByBaseStem.Clear();

                    foreach (var kvp in _provider.Files)
                    {
                        var p = kvp.Key.Replace('\\', '/');
                        if (p.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
                            p.EndsWith(".bk2", StringComparison.OrdinalIgnoreCase) ||
                            p.EndsWith(".webm", StringComparison.OrdinalIgnoreCase) ||
                            p.EndsWith(".usm", StringComparison.OrdinalIgnoreCase))
                        {
                            _allVideoFiles.Add(kvp.Value);
                            var fname = Path.GetFileName(p);
                            var stem = Path.GetFileNameWithoutExtension(p);
                            _videoFilesByExactName[fname] = kvp.Value;
                            _videoFilesByStem[stem] = kvp.Value;

                            var baseStem = GetNormalizedStem(stem);
                            if (!string.IsNullOrEmpty(baseStem))
                            {
                                if (!_videosByBaseStem.TryGetValue(baseStem, out var bList))
                                {
                                    bList = new List<GameFile>();
                                    _videosByBaseStem[baseStem] = bList;
                                }
                                bList.Add(kvp.Value);
                            }
                        }
                        else if (p.EndsWith(".uasset", StringComparison.OrdinalIgnoreCase) &&
                                 (p.Contains("Archive", StringComparison.OrdinalIgnoreCase) || p.Contains("StoryPhoto", StringComparison.OrdinalIgnoreCase)))
                        {
                            var stem = Path.GetFileNameWithoutExtension(p);
                            var withoutExt = p.Substring(0, p.Length - 7);
                            _archiveTextures[stem] = withoutExt;
                        }
                        else if (p.EndsWith(".bnk", StringComparison.OrdinalIgnoreCase) ||
                                 p.EndsWith(".pck", StringComparison.OrdinalIgnoreCase))
                        {
                            _allBnkFiles.Add(kvp.Value);
                        }
                        else if (p.EndsWith(".wem", StringComparison.OrdinalIgnoreCase))
                        {
                            var stem = Path.GetFileNameWithoutExtension(p);
                            if (!_wemFilesByStem.TryGetValue(stem, out var list))
                            {
                                list = new List<GameFile>();
                                _wemFilesByStem[stem] = list;
                            }
                            list.Add(kvp.Value);
                        }
                    }

                    // Scan loose video files on disk from Client/Content/Aki/Movies, Sequence, Saved/Resources and exportDir
                    var diskSearchDirs = new List<string>();
                    try
                    {
                        var paksDirInfo = new DirectoryInfo(paksDir);
                        if (paksDirInfo.Parent != null)
                        {
                            var akiMovies = Path.Combine(paksDirInfo.Parent.FullName, "Aki", "Movies");
                            if (Directory.Exists(akiMovies)) diskSearchDirs.Add(akiMovies);
                            var akiSeq = Path.Combine(paksDirInfo.Parent.FullName, "Aki", "Sequence");
                            if (Directory.Exists(akiSeq)) diskSearchDirs.Add(akiSeq);
                        }
                        var clientDir = paksDirInfo.Parent?.Parent;
                        if (clientDir != null)
                        {
                            var savedRes = Path.Combine(clientDir.FullName, "Saved", "Resources");
                            if (Directory.Exists(savedRes)) diskSearchDirs.Add(savedRes);
                            var savedPersistent = Path.Combine(clientDir.FullName, "Saved", "PersistentDownloadDir");
                            if (Directory.Exists(savedPersistent)) diskSearchDirs.Add(savedPersistent);
                        }
                    }
                    catch { }

                    var effExp = !string.IsNullOrEmpty(exportDir) ? exportDir : _exportDir;
                    if (!string.IsNullOrEmpty(effExp) && Directory.Exists(effExp) && !diskSearchDirs.Contains(effExp))
                    {
                        diskSearchDirs.Add(effExp);
                    }
                    try
                    {
                        var cwdExport = Path.Combine(Directory.GetCurrentDirectory(), "export");
                        if (Directory.Exists(cwdExport) && !diskSearchDirs.Contains(cwdExport)) diskSearchDirs.Add(cwdExport);

                        var fmodelAkiMovies = @"D:\Datamine\Datamine\FModel\Output\Exports\Client\Content\Aki\Movies";
                        if (Directory.Exists(fmodelAkiMovies) && !diskSearchDirs.Contains(fmodelAkiMovies)) diskSearchDirs.Add(fmodelAkiMovies);
                    }
                    catch { }

                    var validExts = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { ".mp4", ".bk2", ".webm", ".usm" };
                    foreach (var d in diskSearchDirs)
                    {
                        try
                        {
                            foreach (var f in Directory.EnumerateFiles(d, "*.*", SearchOption.AllDirectories))
                            {
                                var ext = Path.GetExtension(f);
                                if (validExts.Contains(ext))
                                {
                                    var fname = Path.GetFileName(f);
                                    var stem = Path.GetFileNameWithoutExtension(f);
                                    var fi = new FileInfo(f);
                                    if (fi.Length > 50_000)
                                    {
                                        int gVal = -1;
                                        if (stem.EndsWith("_Nvzhu", StringComparison.OrdinalIgnoreCase) ||
                                            stem.EndsWith("_Nv", StringComparison.OrdinalIgnoreCase) ||
                                            stem.EndsWith("F", StringComparison.OrdinalIgnoreCase) ||
                                            stem.Contains("_nv_", StringComparison.OrdinalIgnoreCase) ||
                                            stem.Contains("_nv.", StringComparison.OrdinalIgnoreCase))
                                        {
                                            gVal = 0;
                                        }
                                        else if (stem.EndsWith("_Nanzhu", StringComparison.OrdinalIgnoreCase) ||
                                                 stem.EndsWith("_Nan", StringComparison.OrdinalIgnoreCase) ||
                                                 stem.EndsWith("M", StringComparison.OrdinalIgnoreCase) ||
                                                 stem.Contains("_nan_", StringComparison.OrdinalIgnoreCase) ||
                                                 stem.Contains("_nan.", StringComparison.OrdinalIgnoreCase))
                                        {
                                            gVal = 1;
                                        }

                                        var dirOfFile = Path.GetDirectoryName(f)?.Replace('\\', '/') ?? "";
                                        var relCatFolder = "Aki/Movies";
                                        var akiIdx = dirOfFile.IndexOf("/Aki/", StringComparison.OrdinalIgnoreCase);
                                        if (akiIdx >= 0)
                                        {
                                            relCatFolder = dirOfFile.Substring(akiIdx + 1);
                                            if (!relCatFolder.StartsWith("Aki/", StringComparison.OrdinalIgnoreCase))
                                            {
                                                relCatFolder = "Aki/" + relCatFolder;
                                            }
                                        }
                                        else
                                        {
                                            relCatFolder = "Aki/Movies";
                                        }

                                        if (relCatFolder.Contains(":") ||
                                            relCatFolder.Contains("export", StringComparison.OrdinalIgnoreCase) ||
                                            relCatFolder.Contains("cache", StringComparison.OrdinalIgnoreCase) ||
                                            relCatFolder.Contains("cutscenes", StringComparison.OrdinalIgnoreCase))
                                        {
                                            relCatFolder = "Aki/Movies";
                                        }

                                        var loose = new LooseDiskVideo
                                        {
                                            Path = f.Replace('\\', '/'),
                                            FileName = fname,
                                            Stem = stem,
                                            Format = ext.TrimStart('.').ToLowerInvariant(),
                                            Size = fi.Length,
                                            Gender = gVal,
                                            CategoryFolder = relCatFolder
                                        };
                                        _looseDiskVideos.Add(loose);
                                        _looseVideosByStem[stem] = f;
                                        _looseVideosByExactName[fname] = f;

                                        var baseStem = GetNormalizedStem(stem);
                                        if (!string.IsNullOrEmpty(baseStem))
                                        {
                                            if (!_looseVideosByBaseStem.TryGetValue(baseStem, out var lbList))
                                            {
                                                lbList = new List<LooseDiskVideo>();
                                                _looseVideosByBaseStem[baseStem] = lbList;
                                            }
                                            lbList.Add(loose);
                                        }
                                    }
                                }
                            }
                        }
                        catch { }
                    }
                }
                SendLog($"สร้างดัชนีไฟล์วิดีโอแพ็กเกจเกมสำเร็จ {_allVideoFiles.Count} ไฟล์ ดิบดิสก์ {_looseDiskVideos.Count} ไฟล์ ภาพ Archive {_archiveTextures.Count} ภาพ คลังเสียง {_allBnkFiles.Count} ไฟล์", "info");

                sw.Stop();
                _providerReadyTcs.TrySetResult(true);

                var totalPaks = _provider.UnloadedVfs.Count + _provider.MountedVfs.Count;
                var totalFiles = _provider.Files.Count;
                SendLog($"เชื่อมต่อแพ็กเกจเกมสำเร็จ {totalPaks} แพ็กเกจ ไฟล์ทั้งหมด {totalFiles} ไฟล์ กุญแจถอดรหัส {keysLoaded} ดอก ใช้เวลา {sw.ElapsedMilliseconds} ms", "success");

                SendResponse(new JsonObject
                {
                    ["status"] = "ready",
                    ["id"] = reqId,
                    ["mounted_paks"] = totalPaks,
                    ["files_count"] = totalFiles,
                    ["keys_loaded"] = keysLoaded,
                    ["elapsed_ms"] = sw.ElapsedMilliseconds
                });
            }
            catch (Exception ex)
            {
                sw.Stop();
                _providerReadyTcs.TrySetResult(false);
                SendLog($"เกิดข้อผิดพลาดในการโหลดแพ็กเกจ CUE4Parse: {ex.Message}", "error");
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["id"] = reqId,
                    ["message"] = $"Failed to initialize CUE4Parse: {ex.Message}",
                    ["elapsed_ms"] = sw.ElapsedMilliseconds
                });
            }
            finally
            {
                _isInitializing = false;
            }
        }

    }
}
