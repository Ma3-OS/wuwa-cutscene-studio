using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace WuWaExtractor
{
    public static partial class Program
    {
        public static string SanitizeLog(string message)
        {
            if (string.IsNullOrEmpty(message)) return message;
            try
            {
                var username = Environment.UserName;
                if (!string.IsNullOrEmpty(username) && username.Length > 1)
                {
                    message = message.Replace(username, "***");
                }
                var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
                if (!string.IsNullOrEmpty(userProfile))
                {
                    message = message.Replace(userProfile, "~USER~");
                    message = message.Replace(userProfile.Replace('\\', '/'), "~USER~");
                }
            }
            catch {}
            return message;
        }

        private static void LogToFile(string line)
        {
            if (string.IsNullOrEmpty(_logFilePath)) return;
            try
            {
                lock (_fileLogLock)
                {
                    File.AppendAllText(_logFilePath, line + Environment.NewLine);
                }
            }
            catch {}
        }

        private static void SendLog(string message, string level = "info")
        {
            var sanitized = SanitizeLog(message);
            LogToFile($"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}] [{level.ToUpperInvariant()}] {sanitized}");
            SendResponse(new JsonObject
            {
                ["status"] = "log",
                ["level"] = level,
                ["message"] = sanitized
            });
        }

        private static void SendResponse(JsonObject json)
        {
            var str = json.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
            var sanitized = SanitizeLog(str);
            lock (_consoleLock)
            {
                Console.WriteLine(sanitized);
                Console.Out.Flush();
            }
        }
    }
}
