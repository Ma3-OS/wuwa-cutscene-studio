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
    public class LooseDiskVideo
    {
        public string Path { get; set; } = "";
        public string FileName { get; set; } = "";
        public string Stem { get; set; } = "";
        public string Format { get; set; } = "";
        public long Size { get; set; }
        public int Gender { get; set; } = -1;
        public string CategoryFolder { get; set; } = "";
    }

}
