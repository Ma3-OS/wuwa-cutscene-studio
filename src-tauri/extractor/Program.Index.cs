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
        private static bool IsExactOrWordBoundaryMatch(string text, string pattern)
        {
            if (string.Equals(text, pattern, StringComparison.OrdinalIgnoreCase)) return true;
            if (string.IsNullOrEmpty(pattern) || text.Length < pattern.Length) return false;

            int idx = 0;
            while ((idx = text.IndexOf(pattern, idx, StringComparison.OrdinalIgnoreCase)) >= 0)
            {
                bool startBoundary = idx == 0 || text[idx - 1] == '_' || text[idx - 1] == '-' || text[idx - 1] == ' ' || text[idx - 1] == '.';
                int endIdx = idx + pattern.Length;
                bool endBoundary = endIdx == text.Length || text[endIdx] == '_' || text[endIdx] == '-' || text[endIdx] == ' ' || text[endIdx] == '.';

                if (startBoundary && endBoundary) return true;
                idx += 1;
            }
            return false;
        }

        public static string GetNormalizedStem(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return "";
            var s = Path.GetFileNameWithoutExtension(name).Trim();
            string[] suffixes = {
                "_nanzhu", "_nvzhu", "_nanzhu_mp4", "_nvzhu_mp4",
                "_nan", "_nv", "_male", "_female", "_boy", "_girl",
                "_mp4", "_bk2", "_webm", "_usm",
                "_cam010", "_cam020", "_cam030", "_cam040", "_cam001",
                "_1", "_2", "_3", "_f", "_m"
            };

            bool stripped = true;
            while (stripped)
            {
                stripped = false;
                foreach (var suf in suffixes)
                {
                    if (s.EndsWith(suf, StringComparison.OrdinalIgnoreCase))
                    {
                        s = s.Substring(0, s.Length - suf.Length);
                        stripped = true;
                    }
                }
            }
            return s.Trim();
        }

        private static string StripRoverSuffix(string name)
        {
            if (string.IsNullOrEmpty(name)) return "";
            var lower = name.ToLowerInvariant();
            string[] suffixes = { "_nvzhu", "_nanzhu", "_nv", "_nan", "_female", "_male", "_girl", "_boy", "_f", "_m" };
            foreach (var s in suffixes)
            {
                if (lower.EndsWith(s))
                    return name.Substring(0, name.Length - s.Length);
            }
            return name;
        }

        private static (GameFile? pakFile, string localPath) FindVideoMatch(string cgName, string videoPath, string gender, string customExportDir)
        {
            var normalized = (videoPath ?? "").Replace('\\', '/').TrimStart('/');
            if (normalized.StartsWith("Game/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = "Client/Content/" + normalized[5..];
            }

            bool preferNanzhu = gender.Equals("Boy", StringComparison.OrdinalIgnoreCase) ||
                                gender.Equals("male", StringComparison.OrdinalIgnoreCase) ||
                                gender == "1" ||
                                normalized.Contains("Nanzhu", StringComparison.OrdinalIgnoreCase) ||
                                normalized.Contains("Nan", StringComparison.OrdinalIgnoreCase) ||
                                (cgName ?? "").Contains("Nanzhu", StringComparison.OrdinalIgnoreCase) ||
                                (cgName ?? "").Contains("Nan", StringComparison.OrdinalIgnoreCase);

            bool preferNvzhu = gender.Equals("Girl", StringComparison.OrdinalIgnoreCase) ||
                               gender.Equals("female", StringComparison.OrdinalIgnoreCase) ||
                               gender == "0" ||
                               normalized.Contains("Nvzhu", StringComparison.OrdinalIgnoreCase) ||
                               normalized.Contains("Nv", StringComparison.OrdinalIgnoreCase) ||
                               (cgName ?? "").Contains("Nvzhu", StringComparison.OrdinalIgnoreCase) ||
                               (cgName ?? "").Contains("Nv", StringComparison.OrdinalIgnoreCase);

            // 1. Direct candidate paths
            if (normalized.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
                normalized.EndsWith(".bk2", StringComparison.OrdinalIgnoreCase))
            {
                if (_provider != null && _provider.Files.TryGetValue(normalized, out var fDirect))
                {
                    return (fDirect, "");
                }
            }

            if (normalized.Contains("Sequence", StringComparison.OrdinalIgnoreCase))
            {
                var moviesNorm = normalized.Replace("Sequence", "Movies", StringComparison.OrdinalIgnoreCase);
                var withoutExt = Path.ChangeExtension(moviesNorm, null);
                if (_provider != null)
                {
                    if (_provider.Files.TryGetValue(withoutExt + ".mp4", out var fSeq1)) return (fSeq1, "");
                    if (_provider.Files.TryGetValue(withoutExt + ".bk2", out var fSeq2)) return (fSeq2, "");

                    // Also try removing /Main/ and intermediate leaf folders (e.g. LevelA_Seq/Main/03_5/M0372/M0372_Nvzhu -> LevelA_Seq/03_5/M0372_Nvzhu)
                    var moviesNoMain = withoutExt.Replace("/Main/", "/", StringComparison.OrdinalIgnoreCase);
                    if (_provider.Files.TryGetValue(moviesNoMain + ".mp4", out var fSeq3)) return (fSeq3, "");
                    if (_provider.Files.TryGetValue(moviesNoMain + ".bk2", out var fSeq4)) return (fSeq4, "");

                    // Strip leaf folder if it matches filename
                    var fileNameOnly = Path.GetFileName(moviesNoMain);
                    var parentDir = Path.GetDirectoryName(moviesNoMain)?.Replace('\\', '/');
                    if (!string.IsNullOrEmpty(parentDir) && !string.IsNullOrEmpty(fileNameOnly))
                    {
                        var grandParentDir = Path.GetDirectoryName(parentDir)?.Replace('\\', '/');
                        if (!string.IsNullOrEmpty(grandParentDir))
                        {
                            var directCandidate = grandParentDir + "/" + fileNameOnly;
                            if (_provider.Files.TryGetValue(directCandidate + ".mp4", out var fSeq5)) return (fSeq5, "");
                            if (_provider.Files.TryGetValue(directCandidate + ".bk2", out var fSeq6)) return (fSeq6, "");
                        }
                    }
                }
            }

            // Derive base stems
            var baseCg = StripRoverSuffix(cgName);
            var rawStemNorm = !string.IsNullOrEmpty(normalized) ? Path.GetFileNameWithoutExtension(normalized) : "";
            if (rawStemNorm.Contains('.')) rawStemNorm = Path.GetFileNameWithoutExtension(rawStemNorm);
            var baseSeq = StripRoverSuffix(rawStemNorm);

            // 2. Build candidate stems in priority order
            var candidates = new List<string>();
            if (preferNanzhu)
            {
                if (!string.IsNullOrEmpty(baseCg))
                {
                    candidates.Add(baseCg + "_Nanzhu");
                    candidates.Add(baseCg + "_Nan");
                    candidates.Add(baseCg + "M");
                    candidates.Add(baseCg + "_M");
                }
                if (!string.IsNullOrEmpty(baseSeq) && !baseSeq.Equals(baseCg, StringComparison.OrdinalIgnoreCase))
                {
                    candidates.Add(baseSeq + "_Nanzhu");
                    candidates.Add(baseSeq + "_Nan");
                    candidates.Add(baseSeq + "M");
                    candidates.Add(baseSeq + "_M");
                }
            }
            else if (preferNvzhu)
            {
                if (!string.IsNullOrEmpty(baseCg))
                {
                    candidates.Add(baseCg + "_Nvzhu");
                    candidates.Add(baseCg + "_Nv");
                    candidates.Add(baseCg + "F");
                    candidates.Add(baseCg + "_F");
                }
                if (!string.IsNullOrEmpty(baseSeq) && !baseSeq.Equals(baseCg, StringComparison.OrdinalIgnoreCase))
                {
                    candidates.Add(baseSeq + "_Nvzhu");
                    candidates.Add(baseSeq + "_Nv");
                    candidates.Add(baseSeq + "F");
                    candidates.Add(baseSeq + "_F");
                }
            }

            // Exact stems
            if (!string.IsNullOrEmpty(cgName) && !candidates.Contains(cgName)) candidates.Add(cgName);
            if (!string.IsNullOrEmpty(baseCg) && !candidates.Contains(baseCg)) candidates.Add(baseCg);
            if (!string.IsNullOrEmpty(rawStemNorm) && !candidates.Contains(rawStemNorm)) candidates.Add(rawStemNorm);
            if (!string.IsNullOrEmpty(baseSeq) && !candidates.Contains(baseSeq)) candidates.Add(baseSeq);

            // Opposite gender fallback
            if (preferNanzhu)
            {
                if (!string.IsNullOrEmpty(baseCg))
                {
                    candidates.Add(baseCg + "_Nvzhu");
                    candidates.Add(baseCg + "_Nv");
                }
                if (!string.IsNullOrEmpty(baseSeq))
                {
                    candidates.Add(baseSeq + "_Nvzhu");
                    candidates.Add(baseSeq + "_Nv");
                }
            }
            else if (preferNvzhu)
            {
                if (!string.IsNullOrEmpty(baseCg))
                {
                    candidates.Add(baseCg + "_Nanzhu");
                    candidates.Add(baseCg + "_Nan");
                }
                if (!string.IsNullOrEmpty(baseSeq))
                {
                    candidates.Add(baseSeq + "_Nanzhu");
                    candidates.Add(baseSeq + "_Nan");
                }
            }

            // Check indexed PAK files and loose videos for all candidates
            foreach (var cand in candidates)
            {
                if (string.IsNullOrEmpty(cand)) continue;
                if (_videoFilesByStem.TryGetValue(cand, out var fStem)) return (fStem, "");
                if (_videoFilesByExactName.TryGetValue(cand + ".mp4", out var fExactMp4)) return (fExactMp4, "");
                if (_videoFilesByExactName.TryGetValue(cand + ".bk2", out var fExactBk2)) return (fExactBk2, "");
                if (_looseVideosByStem.TryGetValue(cand, out var lStem) && File.Exists(lStem)) return (null, lStem);
                if (_looseVideosByExactName.TryGetValue(cand + ".mp4", out var lExactMp4) && File.Exists(lExactMp4)) return (null, lExactMp4);
                if (_looseVideosByExactName.TryGetValue(cand + ".bk2", out var lExactBk2) && File.Exists(lExactBk2)) return (null, lExactBk2);
            }

            // Check base stem lookups in PAK files and loose videos
            var baseCandidates = new List<string>();
            if (!string.IsNullOrEmpty(baseCg)) baseCandidates.Add(baseCg);
            if (!string.IsNullOrEmpty(baseSeq) && !baseSeq.Equals(baseCg, StringComparison.OrdinalIgnoreCase)) baseCandidates.Add(baseSeq);
            foreach (var cand in candidates)
            {
                var norm = GetNormalizedStem(cand);
                if (!string.IsNullOrEmpty(norm) && !baseCandidates.Contains(norm, StringComparer.OrdinalIgnoreCase))
                {
                    baseCandidates.Add(norm);
                }
            }

            foreach (var bStem in baseCandidates)
            {
                if (_videosByBaseStem.TryGetValue(bStem, out var gFileList) && gFileList.Count > 0)
                {
                    GameFile? bestFile = null;
                    foreach (var gf in gFileList)
                    {
                        var s = Path.GetFileNameWithoutExtension(gf.Path);
                        if (preferNanzhu && (s.Contains("Nanzhu", StringComparison.OrdinalIgnoreCase) || s.Contains("_Nan", StringComparison.OrdinalIgnoreCase)))
                        {
                            bestFile = gf;
                            break;
                        }
                        if (preferNvzhu && (s.Contains("Nvzhu", StringComparison.OrdinalIgnoreCase) || s.Contains("_Nv", StringComparison.OrdinalIgnoreCase)))
                        {
                            bestFile = gf;
                            break;
                        }
                    }
                    if (bestFile != null) return (bestFile, "");
                    return (gFileList[0], "");
                }

                if (_looseVideosByBaseStem.TryGetValue(bStem, out var looseList) && looseList.Count > 0)
                {
                    LooseDiskVideo? bestLoose = null;
                    foreach (var lv in looseList)
                    {
                        if (!File.Exists(lv.Path)) continue;
                        if (preferNanzhu && (lv.Stem.Contains("Nanzhu", StringComparison.OrdinalIgnoreCase) || lv.Stem.Contains("_Nan", StringComparison.OrdinalIgnoreCase)))
                        {
                            bestLoose = lv;
                            break;
                        }
                        if (preferNvzhu && (lv.Stem.Contains("Nvzhu", StringComparison.OrdinalIgnoreCase) || lv.Stem.Contains("_Nv", StringComparison.OrdinalIgnoreCase)))
                        {
                            bestLoose = lv;
                            break;
                        }
                    }
                    if (bestLoose != null) return (null, bestLoose.Path);
                    var validFirst = looseList.FirstOrDefault(lv => File.Exists(lv.Path));
                    if (validFirst != null) return (null, validFirst.Path);
                }
            }

            // 3. Check on disk (effectiveExportDir, project export, output, and cutscenes folders)
            var searchDiskDirs = new List<string>();
            var effectiveExportDir = !string.IsNullOrEmpty(customExportDir) ? customExportDir : _exportDir;
            if (!string.IsNullOrEmpty(effectiveExportDir) && Directory.Exists(effectiveExportDir))
            {
                searchDiskDirs.Add(effectiveExportDir);
            }
            try
            {
                var cwd = Directory.GetCurrentDirectory();
                var pExport = Path.Combine(cwd, "export");
                if (Directory.Exists(pExport) && !searchDiskDirs.Contains(pExport)) searchDiskDirs.Add(pExport);
                var pOutput = Path.Combine(cwd, "output");
                if (Directory.Exists(pOutput) && !searchDiskDirs.Contains(pOutput)) searchDiskDirs.Add(pOutput);
                var pCache = Path.Combine(cwd, "cache", "cutscenes");
                if (Directory.Exists(pCache) && !searchDiskDirs.Contains(pCache)) searchDiskDirs.Add(pCache);
            }
            catch { }

            foreach (var sDir in searchDiskDirs)
            {
                try
                {
                    foreach (var cand in candidates)
                    {
                        var files = Directory.GetFiles(sDir, $"{cand}.*", SearchOption.AllDirectories);
                        foreach (var f in files)
                        {
                            if (f.EndsWith(".mp4", StringComparison.OrdinalIgnoreCase) ||
                                f.EndsWith(".bk2", StringComparison.OrdinalIgnoreCase) ||
                                f.EndsWith(".mkv", StringComparison.OrdinalIgnoreCase))
                            {
                                return (null, f);
                            }
                        }
                    }
                }
                catch { }
            }

            // 4. StreamMediaSource uasset resolution
            if (!string.IsNullOrEmpty(normalized) && _provider != null)
            {
                var withoutExt = Path.ChangeExtension(normalized, null);
                try
                {
                    if (_provider.TryLoadPackage(withoutExt, out var uPackage))
                    {
                        foreach (var exp in uPackage.GetExports())
                        {
                            if (exp is UObject uObj)
                            {
                                foreach (var prop in uObj.Properties)
                                {
                                    if (prop.Name.Text.Equals("StreamUrl", StringComparison.OrdinalIgnoreCase))
                                    {
                                        var url = prop.Tag?.GenericValue?.ToString() ?? "";
                                        if (url.Contains("Movies", StringComparison.OrdinalIgnoreCase))
                                        {
                                            var movieSub = url.Substring(url.IndexOf("Movies", StringComparison.OrdinalIgnoreCase));
                                            var fullMoviePath = "Client/Content/Aki/" + movieSub.Replace('\\', '/');
                                            if (_provider.Files.TryGetValue(fullMoviePath, out var fMatch))
                                            {
                                                return (fMatch, "");
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

            // 5. Word boundary or prefix match across all indexed videos in PAKs
            var searchStems = new List<string>();
            if (!string.IsNullOrEmpty(baseCg)) searchStems.Add(baseCg);
            if (!string.IsNullOrEmpty(baseSeq) && !baseSeq.Equals(baseCg, StringComparison.OrdinalIgnoreCase)) searchStems.Add(baseSeq);

            foreach (var targetStem in searchStems)
            {
                foreach (var gf in _allVideoFiles)
                {
                    var s = Path.GetFileNameWithoutExtension(gf.Path);
                    if (s.StartsWith(targetStem + "_", StringComparison.OrdinalIgnoreCase) ||
                        s.StartsWith(targetStem + "-", StringComparison.OrdinalIgnoreCase) ||
                        IsExactOrWordBoundaryMatch(s, targetStem))
                    {
                        if (preferNanzhu && (s.Contains("Nanzhu", StringComparison.OrdinalIgnoreCase) || s.Contains("_Nan", StringComparison.OrdinalIgnoreCase)))
                        {
                            return (gf, "");
                        }
                        if (preferNvzhu && (s.Contains("Nvzhu", StringComparison.OrdinalIgnoreCase) || s.Contains("_Nv", StringComparison.OrdinalIgnoreCase)))
                        {
                            return (gf, "");
                        }
                        return (gf, "");
                    }
                }
            }

            return (null, "");
        }

    }
}
