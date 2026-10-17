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
        private static DefaultFileProvider? _provider;
        private static readonly ConcurrentDictionary<string, CancellationTokenSource> _tasks = new();
        private static readonly object _consoleLock = new();
        private static readonly TaskCompletionSource<bool> _providerReadyTcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private static volatile bool _isInitializing = false;
        private static readonly object _initLock = new();
        private static readonly Dictionary<string, GameFile> _videoFilesByStem = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, GameFile> _videoFilesByExactName = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, List<GameFile>> _videosByBaseStem = new(StringComparer.OrdinalIgnoreCase);
        private static readonly List<GameFile> _allVideoFiles = new();
        private static readonly List<LooseDiskVideo> _looseDiskVideos = new();
        private static readonly Dictionary<string, string> _looseVideosByStem = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, string> _looseVideosByExactName = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, List<LooseDiskVideo>> _looseVideosByBaseStem = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, string> _archiveTextures = new(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, List<GameFile>> _wemFilesByStem = new(StringComparer.OrdinalIgnoreCase);
        private static readonly List<GameFile> _allBnkFiles = new();
        private static string _exportDir = "";
        private static string _logFilePath = "";
        private static readonly object _fileLogLock = new();

        public static async Task Main(string[] args)
        {
            Console.OutputEncoding = System.Text.Encoding.UTF8;

            try
            {
                var cwd = Directory.GetCurrentDirectory();
                var logDir = Path.Combine(cwd, "logs");
                if (!Directory.Exists(logDir))
                {
                    var baseDir = AppDomain.CurrentDomain.BaseDirectory;
                    var baseLogDir = Path.Combine(baseDir, "logs");
                    logDir = Directory.Exists(baseLogDir) ? baseLogDir : logDir;
                }
                Directory.CreateDirectory(logDir);
                _logFilePath = Path.Combine(logDir, "extractor.log");
                LogToFile($"[INFO] WuWaExtractor daemon started at {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff} UTC");
            }
            catch {}

            SendResponse(new JsonObject
            {
                ["status"] = "started",
                ["version"] = "2026.1.0"
            });

            // If command line arguments were passed directly for quick initialization
            if (args.Length >= 2 && args[0] == "--init")
            {
                var paks = args[1];
                var keys = args.Length >= 3 ? args[2] : "";
                InitializeProvider(paks, keys, "__cli_init__");
            }
            else if (args.Length >= 1 && args[0] == "--probe")
            {
                if (args.Length < 3)
                {
                    SendResponse(new JsonObject
                    {
                        ["status"] = "error",
                        ["message"] = "Usage: --probe <paks_dir> <keys_file>"
                    });
                    return;
                }
                var paks = args[1];
                var keys = args[2];
                InitializeProvider(paks, keys, "__probe__");
                return;
            }

            // Read NDJSON stream from stdin
            while (true)
            {
                var line = await Console.In.ReadLineAsync();
                if (line == null) break; // Stdin closed

                line = line.Trim().Trim('\uFEFF');
                if (string.IsNullOrEmpty(line)) continue;

                // Validate that the line starts with '{' and ends with '}' before parsing
                if (!line.StartsWith('{') || !line.EndsWith('}'))
                {
                    LogToFile($"[WARN] Ignored malformed stdin line: {line}");
                    continue;
                }

                _ = Task.Run(() => ProcessCommand(line));
            }
        }

        private static void ProcessCommand(string jsonLine)
        {
            try
            {
                var cleanLine = jsonLine.Trim().Trim('\uFEFF');
                if (!cleanLine.StartsWith('{') || !cleanLine.EndsWith('}'))
                {
                    return;
                }

                using var doc = JsonDocument.Parse(cleanLine);
                var root = doc.RootElement;
                if (!root.TryGetProperty("cmd", out var cmdProp))
                {
                    return;
                }
                var cmd = cmdProp.GetString();


                switch (cmd)
                {
                    case "ping":
                        SendResponse(new JsonObject { ["status"] = "pong" });
                        break;

                    case "dump_configdb":
                    {
                        var dbId = root.TryGetProperty("id", out var dbIdProp) ? dbIdProp.GetString() ?? "" : "";
                        var dbDir = root.GetProperty("db_dir").GetString() ?? "";
                        var outputTargetDir = root.GetProperty("output_dir").GetString() ?? "";
                        var ok = DumpConfigDb(dbDir, outputTargetDir);
                        SendResponse(new JsonObject
                        {
                            ["status"] = ok ? "configdb_dumped" : "configdb_dump_failed",
                            ["id"] = dbId,
                            ["output_dir"] = outputTargetDir
                        });
                        break;
                    }

                    case "search":
                        var query = root.TryGetProperty("query", out var qProp) ? qProp.GetString() ?? "" : "";
                        var matches = new JsonArray();
                        int maxMatches = 20;
                        if (_provider != null)
                        {
                            foreach (var key in _provider.Files.Keys)
                            {
                                if (key.Contains(query, StringComparison.OrdinalIgnoreCase))
                                {
                                    matches.Add(key);
                                    if (matches.Count >= maxMatches) break;
                                }
                            }
                        }
                        SendResponse(new JsonObject { ["status"] = "search_result", ["query"] = query, ["matches"] = matches });
                        break;

                    case "inspect_uasset":
                        var assetPath = root.GetProperty("path").GetString() ?? "";
                        var info = new JsonObject();
                        if (_provider != null && _provider.TryLoadPackage(assetPath, out var uPkg))
                        {
                            var expArray = new JsonArray();
                            foreach (var exp in uPkg.GetExports())
                            {
                                var expObj = new JsonObject
                                {
                                    ["type"] = exp.ExportType,
                                    ["name"] = exp.Name
                                };
                                if (exp is UObject uObj)
                                {
                                    var props = new JsonObject();
                                    foreach (var prop in uObj.Properties)
                                    {
                                        props[prop.Name.Text] = prop.Tag?.GenericValue?.ToString() ?? "";
                                    }
                                    expObj["props"] = props;
                                }
                                expArray.Add(expObj);
                            }
                            info["exports"] = expArray;
                        }
                        SendResponse(new JsonObject { ["status"] = "inspect_result", ["path"] = assetPath, ["data"] = info });
                        break;

                    case "dump_file":
                        var dPath = root.GetProperty("path").GetString() ?? "";
                        var outDest = root.GetProperty("dest").GetString() ?? "";
                        if (_provider != null && _provider.Files.TryGetValue(dPath, out var dumpGf))
                        {
                            var b = _provider.SaveAsset(dumpGf);
                            if (b != null)
                            {
                                var destDir = Path.GetDirectoryName(outDest);
                                if (!string.IsNullOrEmpty(destDir)) Directory.CreateDirectory(destDir);
                                File.WriteAllBytes(outDest, b);
                                SendResponse(new JsonObject { ["status"] = "dumped", ["path"] = dPath, ["size"] = b.Length });
                                break;
                            }
                        }
                        SendResponse(new JsonObject { ["status"] = "dump_failed", ["path"] = dPath });
                        break;

                    case "init":
                        var initId = root.TryGetProperty("id", out var initIdProp) ? initIdProp.GetString() ?? "" : "";
                        var paksDir = root.GetProperty("paks_dir").GetString() ?? "";
                        var keysFile = root.TryGetProperty("keys_file", out var kf) ? kf.GetString() ?? "" : "";
                        var initExpDir = root.TryGetProperty("export_dir", out var iedProp) ? iedProp.GetString() ?? "" : "";
                        InitializeProvider(paksDir, keysFile, initId, initExpDir);
                        break;

                    case "list_videos":
                        var listReqId = root.TryGetProperty("id", out var lIdProp) ? lIdProp.GetString() ?? "" : "";
                        var videoArray = new JsonArray();
                        var seenPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                        lock (_initLock)
                        {
                            foreach (var gf in _allVideoFiles)
                            {
                                var p = gf.Path.Replace('\\', '/');
                                if (!seenPaths.Add(p)) continue;

                                var fn = Path.GetFileName(p);
                                var stem = Path.GetFileNameWithoutExtension(p);
                                var ext = Path.GetExtension(p).TrimStart('.').ToLowerInvariant();

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

                                var folder = Path.GetDirectoryName(p)?.Replace('\\', '/') ?? "";
                                if (folder.StartsWith("Client/Content/", StringComparison.OrdinalIgnoreCase))
                                {
                                    folder = folder.Substring("Client/Content/".Length);
                                }

                                videoArray.Add(new JsonObject
                                {
                                    ["path"] = p,
                                    ["filename"] = fn,
                                    ["stem"] = stem,
                                    ["base_stem"] = GetNormalizedStem(stem),
                                    ["format"] = ext,
                                    ["size"] = gf.Size,
                                    ["gender"] = gVal,
                                    ["category_folder"] = folder,
                                    ["is_loose_file"] = false
                                });
                            }

                            foreach (var lv in _looseDiskVideos)
                            {
                                if (!seenPaths.Add(lv.Path)) continue;

                                videoArray.Add(new JsonObject
                                {
                                    ["path"] = lv.Path,
                                    ["filename"] = lv.FileName,
                                    ["stem"] = lv.Stem,
                                    ["base_stem"] = GetNormalizedStem(lv.Stem),
                                    ["format"] = lv.Format,
                                    ["size"] = lv.Size,
                                    ["gender"] = lv.Gender,
                                    ["category_folder"] = lv.CategoryFolder,
                                    ["is_loose_file"] = true
                                });
                            }
                        }
                        SendResponse(new JsonObject
                        {
                            ["status"] = "video_list",
                            ["id"] = listReqId,
                            ["count"] = videoArray.Count,
                            ["videos"] = videoArray
                        });
                        break;

                    case "cancel":
                        var cancelId = root.GetProperty("id").GetString() ?? "";
                        if (_tasks.TryRemove(cancelId, out var cts))
                        {
                            cts.Cancel();
                            cts.Dispose();
                            SendLog($"ยกเลิกคำขอสกัดไฟล์ {cancelId} สำเร็จ", "warn");
                            SendResponse(new JsonObject { ["status"] = "cancelled_ack", ["id"] = cancelId });
                        }
                        break;

                    case "extract":
                        var reqId = root.TryGetProperty("id", out var idProp) ? idProp.GetString() ?? "" : Guid.NewGuid().ToString();
                        var cgName = root.TryGetProperty("cg_name", out var cgProp) ? cgProp.GetString() ?? "" : "";
                        var videoPath = root.TryGetProperty("video_path", out var vpProp) ? vpProp.GetString() ?? "" : "";
                        var outDir = root.TryGetProperty("output_dir", out var odProp) ? odProp.GetString() ?? "" : "";
                        var extractExpDir = root.TryGetProperty("export_dir", out var eedProp) ? eedProp.GetString() ?? "" : "";
                        var extractGender = root.TryGetProperty("gender", out var egProp) ? egProp.GetString() ?? "" : "";
                        var extractLocale = root.TryGetProperty("locale", out var elProp) ? elProp.GetString() ?? "ja" : "ja";

                        // Parse sound hints if available
                        string[] soundHints = Array.Empty<string>();
                        if (root.TryGetProperty("sound_events", out var seProp) && seProp.ValueKind == JsonValueKind.Array)
                        {
                            var list = new List<string>();
                            foreach (var item in seProp.EnumerateArray())
                            {
                                var s = item.GetString();
                                if (!string.IsNullOrEmpty(s)) list.Add(s);
                            }
                            soundHints = list.ToArray();
                        }

                        _ = HandleExtractAsync(reqId, cgName, videoPath, soundHints, outDir, extractGender, extractExpDir, extractLocale);
                        break;

                    case "get_thumbnail":
                        var thumbId = root.TryGetProperty("id", out var tIdProp) ? tIdProp.GetString() ?? "" : Guid.NewGuid().ToString();
                        var tCgName = root.TryGetProperty("cg_name", out var tCgProp) ? tCgProp.GetString() ?? "" : "";
                        var tCgFile = root.TryGetProperty("cg_file", out var tCfProp) ? tCfProp.GetString() ?? "" : "";
                        var tGender = root.TryGetProperty("gender", out var tGenProp) ? tGenProp.GetInt32() : -1;
                        var tOutDir = root.TryGetProperty("output_dir", out var tOdProp) ? tOdProp.GetString() ?? "" : "";
                        _ = HandleGetThumbnailAsync(thumbId, tCgName, tCgFile, tGender, tOutDir);
                        break;

                    case "extract_wem_batch":
                        var wemBatchId = root.TryGetProperty("id", out var wIdProp) ? wIdProp.GetString() ?? "" : Guid.NewGuid().ToString();
                        var wemOutDir = root.TryGetProperty("output_dir", out var wOdProp) ? wOdProp.GetString() ?? "" : "";
                        var wemLocale = root.TryGetProperty("locale", out var wLocProp) ? wLocProp.GetString() ?? "" : "";
                        var wemList = new List<string>();
                        if (root.TryGetProperty("wems", out var wemsProp) && wemsProp.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in wemsProp.EnumerateArray())
                            {
                                var s = item.GetString();
                                if (!string.IsNullOrEmpty(s)) wemList.Add(s);
                            }
                        }
                        _ = HandleExtractWemBatchAsync(wemBatchId, wemList, wemOutDir, wemLocale);
                        break;

                    case "find_files":
                        var findQuery = root.TryGetProperty("query", out var fQProp) ? fQProp.GetString() ?? "" : "";
                        var foundFiles = new JsonArray();
                        if (_provider != null && !string.IsNullOrEmpty(findQuery))
                        {
                            foreach (var kvp in _provider.Files)
                            {
                                if (kvp.Key.Contains(findQuery, StringComparison.OrdinalIgnoreCase))
                                {
                                    foundFiles.Add(kvp.Key);
                                    if (foundFiles.Count >= 50) break;
                                }
                            }
                        }
                        SendResponse(new JsonObject { ["status"] = "found", ["query"] = findQuery, ["files"] = foundFiles });
                        break;

                    case "grep_files":
                        var filePattern = root.TryGetProperty("pattern", out var fpProp) ? fpProp.GetString() ?? "" : "";
                        var searchStr = root.TryGetProperty("search", out var spProp) ? spProp.GetString() ?? "" : "";
                        var hexStr = root.TryGetProperty("hex", out var hxProp) ? hxProp.GetString() ?? "" : "";
                        var grepMatches = new JsonArray();
                        byte[]? targetBytes = null;
                        if (!string.IsNullOrEmpty(hexStr))
                        {
                            try { targetBytes = Convert.FromHexString(hexStr.Replace(" ", "")); } catch { }
                        }
                        else if (!string.IsNullOrEmpty(searchStr))
                        {
                            targetBytes = System.Text.Encoding.UTF8.GetBytes(searchStr);
                        }

                        if (_provider != null && targetBytes != null && targetBytes.Length > 0)
                        {
                            foreach (var kvp in _provider.Files)
                            {
                                if (string.IsNullOrEmpty(filePattern) || kvp.Key.Contains(filePattern, StringComparison.OrdinalIgnoreCase))
                                {
                                    try
                                    {
                                        var data = _provider.SaveAsset(kvp.Value);
                                        if (data != null && data.AsSpan().IndexOf(targetBytes) >= 0)
                                        {
                                            grepMatches.Add(kvp.Key);
                                            if (grepMatches.Count >= 50) break;
                                        }
                                    }
                                    catch { }
                                }
                            }
                        }
                        SendResponse(new JsonObject { ["status"] = "grep_result", ["search"] = searchStr, ["hex"] = hexStr, ["matches"] = grepMatches });
                        break;

                    case "get_file_info":
                        var qPath = root.TryGetProperty("path", out var qpProp) ? qpProp.GetString() ?? "" : "";
                        var infoObj = new JsonObject();
                        if (_provider != null && _provider.Files.TryGetValue(qPath, out var gFile))
                        {
                            infoObj["path"] = gFile.Path;
                            infoObj["size"] = gFile.Size;
                        }
                        SendResponse(new JsonObject { ["status"] = "file_info", ["data"] = infoObj });
                        break;

                    case "check_paks":
                        var unloadedArr = new JsonArray();
                        var mountedArr = new JsonArray();
                        if (_provider != null)
                        {
                            foreach (var u in _provider.UnloadedVfs)
                            {
                                unloadedArr.Add(new JsonObject
                                {
                                    ["name"] = u.Name,
                                    ["path"] = u.Path,
                                    ["guid"] = u.EncryptionKeyGuid.ToString()
                                });
                            }
                        }
                        SendResponse(new JsonObject
                        {
                            ["status"] = "check_paks_result",
                            ["unloaded_count"] = unloadedArr.Count,
                            ["unloaded"] = unloadedArr
                        });
                        break;

                    default:
                        SendResponse(new JsonObject
                        {
                            ["status"] = "error",
                            ["message"] = $"คำสั่งที่ไม่รู้จัก {cmd}"
                        });
                        break;
                }
            }
            catch (Exception ex)
            {
                SendLog($"ข้อผิดพลาดในการประมวลผลคำสั่ง: {ex.Message}", "error");
                SendResponse(new JsonObject
                {
                    ["status"] = "error",
                    ["message"] = ex.Message
                });
            }
        }


    }
}
