using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace WuWaExtractor
{
    public static partial class Program
    {
        // Parses Wuthering Waves SQLite ConfigDB files and extracts data
        // into the Arikatsu/WutheringWaves_Data hierarchy.
        public static bool DumpConfigDb(string configDbDir, string outputDataDir)
        {
            try
            {
                if (!Directory.Exists(configDbDir))
                {
                    LogToFile($"[CONFIGDB] Directory not found: {configDbDir}");
                    return false;
                }

                LogToFile($"[CONFIGDB] Scanning for SQLite databases in {configDbDir}");

                var binDataDir = Path.Combine(outputDataDir, "BinData");
                var cgVedioDir = Path.Combine(binDataDir, "cgVedio");
                var musicSubDir = Path.Combine(binDataDir, "MusicSubTitle");
                var textmapsDir = Path.Combine(outputDataDir, "Textmaps");

                Directory.CreateDirectory(cgVedioDir);
                Directory.CreateDirectory(musicSubDir);
                Directory.CreateDirectory(textmapsDir);

                var dbFiles = Directory.GetFiles(configDbDir, "*.db", SearchOption.AllDirectories);
                LogToFile($"[CONFIGDB] Found {dbFiles.Length} database files");

                foreach (var dbPath in dbFiles)
                {
                    var dbFileName = Path.GetFileName(dbPath);
                    try
                    {
                        ProcessDatabaseFile(dbPath, outputDataDir, cgVedioDir, musicSubDir, textmapsDir);
                    }
                    catch (Exception ex)
                    {
                        LogToFile($"[CONFIGDB] Error reading {dbFileName}: {ex.Message}");
                    }
                }

                LogToFile("[CONFIGDB] Extraction and export completed successfully");
                return true;
            }
            catch (Exception ex)
            {
                LogToFile($"[CONFIGDB] Fatal error during dump: {ex}");
                return false;
            }
        }

        private static void ProcessDatabaseFile(string dbPath, string rootDataDir, string cgVedioDir, string musicSubDir, string textmapsDir)
        {
            var connStr = $"Data Source={dbPath};Mode=ReadOnly;";
            using var conn = new SqliteConnection(connStr);
            conn.Open();

            var tables = GetTableNames(conn);

            foreach (var table in tables)
            {
                var lowerTable = table.ToLowerInvariant();

                // Process Cutscene and Lyric Data
                if (lowerTable == "cgvedio" || lowerTable == "videodata" || lowerTable == "cg_vedio")
                {
                    ExportTableToJson(conn, table, Path.Combine(cgVedioDir, "videodata.json"), rootDataDir);
                }
                else if (lowerTable == "videocaption" || lowerTable == "cg_caption")
                {
                    ExportTableToJson(conn, table, Path.Combine(cgVedioDir, "videocaption.json"), rootDataDir);
                }
                else if (lowerTable == "videosound" || lowerTable == "cg_sound")
                {
                    ExportTableToJson(conn, table, Path.Combine(cgVedioDir, "videosound.json"), rootDataDir);
                }
                else if (lowerTable == "musicsubtitle" || lowerTable == "music_subtitle")
                {
                    ExportTableToJson(conn, table, Path.Combine(musicSubDir, "musicsubtitle.json"), rootDataDir);
                }
                // Process Localized Textmaps
                else if (lowerTable.Contains("multitext") || lowerTable.Contains("multi_text") || lowerTable.Contains("subtitletext") || lowerTable.Contains("flowtext"))
                {
                    ExportTextmapTable(conn, table, textmapsDir, rootDataDir);
                }
            }
        }

        private static List<string> GetTableNames(SqliteConnection conn)
        {
            var list = new List<string>();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                list.Add(reader.GetString(0));
            }
            return list;
        }

        private static void ExportTableToJson(SqliteConnection conn, string tableName, string targetPath, string rootDataDir)
        {
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = $"SELECT * FROM \"{tableName}\";";
                using var reader = cmd.ExecuteReader();

                var rows = new List<Dictionary<string, object?>>();
                var hasBinData = false;

                for (int i = 0; i < reader.FieldCount; i++)
                {
                    if (reader.GetName(i).Equals("BinData", StringComparison.OrdinalIgnoreCase))
                    {
                        hasBinData = true;
                        break;
                    }
                }

                while (reader.Read())
                {
                    var row = new Dictionary<string, object?>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var colName = reader.GetName(i);
                        if (reader.IsDBNull(i))
                        {
                            row[colName] = null;
                        }
                        else if (hasBinData && colName.Equals("BinData", StringComparison.OrdinalIgnoreCase))
                        {
                            var rawVal = reader.GetString(i);
                            try
                            {
                                var decodedBytes = Convert.FromBase64String(rawVal);
                                var decodedStr = Encoding.UTF8.GetString(decodedBytes);
                                row[colName] = decodedStr;
                            }
                            catch
                            {
                                row[colName] = rawVal;
                            }
                        }
                        else
                        {
                            row[colName] = reader.GetValue(i);
                        }
                    }
                    rows.Add(row);
                }

                var jsonOptions = new JsonSerializerOptions { WriteIndented = true };
                var jsonStr = JsonSerializer.Serialize(rows, jsonOptions);

                // Write to target hierarchy
                var parentDir = Path.GetDirectoryName(targetPath);
                if (!string.IsNullOrEmpty(parentDir))
                {
                    Directory.CreateDirectory(parentDir);
                }
                File.WriteAllText(targetPath, jsonStr, Encoding.UTF8);

                // Write root convenience copy
                var rootFileName = Path.GetFileName(targetPath);
                var rootCopyPath = Path.Combine(rootDataDir, rootFileName);
                File.WriteAllText(rootCopyPath, jsonStr, Encoding.UTF8);

                LogToFile($"[CONFIGDB] Exported {rows.Count} rows from {tableName} to {targetPath}");
            }
            catch (Exception ex)
            {
                LogToFile($"[CONFIGDB] Failed exporting table {tableName}: {ex.Message}");
            }
        }

        private static void ExportTextmapTable(SqliteConnection conn, string tableName, string textmapsDir, string rootDataDir)
        {
            try
            {
                // Detect language from table name (e.g. MultiText_th, multi_text_en)
                string lang = "th";
                string[] knownLangs = { "th", "en", "ja", "ko", "zh-Hans", "zh-Hant", "de", "es", "fr", "id", "pt", "ru", "vi" };

                foreach (var kl in knownLangs)
                {
                    if (tableName.EndsWith($"_{kl}", StringComparison.OrdinalIgnoreCase) ||
                        tableName.EndsWith($"-{kl}", StringComparison.OrdinalIgnoreCase))
                    {
                        lang = kl;
                        break;
                    }
                }

                var subfolder = "multi_text";
                if (tableName.ToLowerInvariant().Contains("subtitle"))
                {
                    subfolder = "subtitle_text";
                }
                else if (tableName.ToLowerInvariant().Contains("flow"))
                {
                    subfolder = "flow_text";
                }

                var outDir = Path.Combine(textmapsDir, lang, subfolder);
                Directory.CreateDirectory(outDir);
                var outFile = Path.Combine(outDir, "MultiText.json");

                ExportTableToJson(conn, tableName, outFile, rootDataDir);

                // Also maintain merged MultiText_{lang}.json at root
                var rootMergedPath = Path.Combine(rootDataDir, $"MultiText_{lang}.json");
                if (File.Exists(outFile))
                {
                    File.Copy(outFile, rootMergedPath, true);
                }
            }
            catch (Exception ex)
            {
                LogToFile($"[CONFIGDB] Failed exporting textmap {tableName}: {ex.Message}");
            }
        }
    }
}
