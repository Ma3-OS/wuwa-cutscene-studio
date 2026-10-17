use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

/// Pure Rust TrueType font metrics reader for exact character width calculation
pub struct FontMetrics {
    units_per_em: u16,
    hmtx_advances: Vec<u16>,
    cmap_map: HashMap<u32, u16>,
}

impl FontMetrics {
    /// Load and parse TTF tables (head, hhea, hmtx, cmap format 4)
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Option<Self> {
        let data = fs::read(path).ok()?;
        Self::parse(&data)
    }

    pub fn parse(data: &[u8]) -> Option<Self> {
        if data.len() < 12 {
            return None;
        }

        let num_tables = u16::from_be_bytes([data[4], data[5]]) as usize;
        let mut tables = HashMap::new();

        let mut offset = 12;
        for _ in 0..num_tables {
            if offset + 16 > data.len() {
                break;
            }
            let tag = &data[offset..offset + 4];
            let table_offset = u32::from_be_bytes([
                data[offset + 8],
                data[offset + 9],
                data[offset + 10],
                data[offset + 11],
            ]) as usize;
            let table_len = u32::from_be_bytes([
                data[offset + 12],
                data[offset + 13],
                data[offset + 14],
                data[offset + 15],
            ]) as usize;

            tables.insert(tag.to_vec(), (table_offset, table_len));
            offset += 16;
        }

        // 1. Read head table -> unitsPerEm
        let (head_off, _) = tables.get(b"head".as_slice())?;
        if *head_off + 20 > data.len() {
            return None;
        }
        let units_per_em = u16::from_be_bytes([data[head_off + 18], data[head_off + 19]]);
        if units_per_em == 0 {
            return None;
        }

        // 2. Read hhea table -> numberOfHMetrics
        let (hhea_off, _) = tables.get(b"hhea".as_slice())?;
        if *hhea_off + 36 > data.len() {
            return None;
        }
        let num_h_metrics = u16::from_be_bytes([data[hhea_off + 34], data[hhea_off + 35]]) as usize;

        // 3. Read hmtx table -> advance widths
        let (hmtx_off, _) = tables.get(b"hmtx".as_slice())?;
        let mut hmtx_advances = Vec::with_capacity(num_h_metrics);
        let mut h_curr = *hmtx_off;
        for _ in 0..num_h_metrics {
            if h_curr + 4 > data.len() {
                break;
            }
            let adv = u16::from_be_bytes([data[h_curr], data[h_curr + 1]]);
            hmtx_advances.push(adv);
            h_curr += 4;
        }

        // 4. Read cmap table
        let (cmap_off, _) = tables.get(b"cmap".as_slice())?;
        if *cmap_off + 4 > data.len() {
            return None;
        }
        let num_subtables = u16::from_be_bytes([data[cmap_off + 2], data[cmap_off + 3]]) as usize;

        let mut subtable_offset = None;
        for i in 0..num_subtables {
            let sub_entry = cmap_off + 4 + (i * 8);
            if sub_entry + 8 > data.len() {
                break;
            }
            let pid = u16::from_be_bytes([data[sub_entry], data[sub_entry + 1]]);
            let eid = u16::from_be_bytes([data[sub_entry + 2], data[sub_entry + 3]]);
            let sub_off = u32::from_be_bytes([
                data[sub_entry + 4],
                data[sub_entry + 5],
                data[sub_entry + 6],
                data[sub_entry + 7],
            ]) as usize;

            if (pid == 3 && eid == 1) || pid == 0 {
                subtable_offset = Some(cmap_off + sub_off);
                break;
            }
        }

        let sub_off = subtable_offset?;
        if sub_off + 6 > data.len() {
            return None;
        }

        let format = u16::from_be_bytes([data[sub_off], data[sub_off + 1]]);
        let mut cmap_map = HashMap::new();

        if format == 4 {
            let seg_count_x2 = u16::from_be_bytes([data[sub_off + 6], data[sub_off + 7]]) as usize;
            let seg_count = seg_count_x2 / 2;

            let end_code_offset = sub_off + 14;
            let start_code_offset = end_code_offset + (seg_count * 2) + 2;
            let id_delta_offset = start_code_offset + (seg_count * 2);
            let id_range_offset = id_delta_offset + (seg_count * 2);

            if id_range_offset + (seg_count * 2) <= data.len() {
                for i in 0..seg_count {
                    let end_code = u16::from_be_bytes([
                        data[end_code_offset + (i * 2)],
                        data[end_code_offset + (i * 2) + 1],
                    ]) as u32;
                    let start_code = u16::from_be_bytes([
                        data[start_code_offset + (i * 2)],
                        data[start_code_offset + (i * 2) + 1],
                    ]) as u32;
                    let id_delta = i16::from_be_bytes([
                        data[id_delta_offset + (i * 2)],
                        data[id_delta_offset + (i * 2) + 1],
                    ]) as i32;
                    let range_offset = u16::from_be_bytes([
                        data[id_range_offset + (i * 2)],
                        data[id_range_offset + (i * 2) + 1],
                    ]) as usize;

                    if start_code == 0xFFFF {
                        break;
                    }

                    for cp in start_code..=end_code {
                        let gid = if range_offset == 0 {
                            ((cp as i32 + id_delta) & 0xFFFF) as u16
                        } else {
                            let gid_addr = id_range_offset
                                + (i * 2)
                                + range_offset
                                + ((cp - start_code) as usize * 2);
                            if gid_addr + 2 <= data.len() {
                                let g = u16::from_be_bytes([data[gid_addr], data[gid_addr + 1]]);
                                if g != 0 {
                                    ((g as i32 + id_delta) & 0xFFFF) as u16
                                } else {
                                    0
                                }
                            } else {
                                0
                            }
                        };
                        if gid != 0 {
                            cmap_map.insert(cp, gid);
                        }
                    }
                }
            }
        }

        Some(Self {
            units_per_em,
            hmtx_advances,
            cmap_map,
        })
    }

    /// Measure string pixel width at the given font size calibrated for libass
    pub fn measure_string(&self, text: &str, font_size: f32) -> f32 {
        let mut total_advance = 0u64;

        for ch in text.chars() {
            let cp = ch as u32;
            // Thai non-spacing combining vowels and tone marks have zero horizontal advance
            if cp == 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E3A) || (cp >= 0x0E47 && cp <= 0x0E4E) || (cp >= 0x0300 && cp <= 0x036F) {
                continue;
            }

            if let Some(&gid) = self.cmap_map.get(&cp) {
                let idx = gid as usize;
                if idx < self.hmtx_advances.len() {
                    total_advance += self.hmtx_advances[idx] as u64;
                } else if let Some(&last) = self.hmtx_advances.last() {
                    total_advance += last as u64;
                }
            } else {
                // Fallback advance based on char classification
                let fallback = if ch.is_ascii() {
                    (self.units_per_em as f32 * 0.52) as u64
                } else {
                    (self.units_per_em as f32 * 0.95) as u64
                };
                total_advance += fallback;
            }
        }

        (total_advance as f32 * font_size * LIBASS_FONT_SCALE) / (self.units_per_em as f32)
    }
}

pub const LIBASS_FONT_SCALE: f32 = 0.635;

static CACHED_METRICS: RwLock<Option<FontMetrics>> = RwLock::new(None);

/// Get or initialize font metrics from search paths
pub fn get_font_metrics(custom_font_name: &str) -> Option<&'static RwLock<Option<FontMetrics>>> {
    {
        let read = CACHED_METRICS.read().unwrap();
        if read.is_some() {
            return Some(&CACHED_METRICS);
        }
    }

    // Try finding font file in local directories
    let candidates = [
        format!("fonts/{}.ttf", custom_font_name),
        format!("fonts/{}-Medium.ttf", custom_font_name),
        "fonts/Kanit-Medium.ttf".to_string(),
        "public/fonts/Kanit-Medium.ttf".to_string(),
        "dist/fonts/Kanit-Medium.ttf".to_string(),
        "../fonts/Kanit-Medium.ttf".to_string(),
    ];

    for candidate in &candidates {
        let p = PathBuf::from(candidate);
        if p.exists() {
            if let Some(metrics) = FontMetrics::load_from_file(&p) {
                let mut write = CACHED_METRICS.write().unwrap();
                *write = Some(metrics);
                return Some(&CACHED_METRICS);
            }
        }
    }

    None
}

/// Dynamic text width calculation matching LGUI Text Generator
pub fn measure_text_width(text: &str, font_name: &str, font_size: f32) -> f32 {
    if let Some(lock) = get_font_metrics(font_name) {
        let guard = lock.read().unwrap();
        if let Some(metrics) = guard.as_ref() {
            return metrics.measure_string(text, font_size);
        }
    }

    // Approximate fallback if no font file is available
    let mut width = 0.0f32;
    for ch in text.chars() {
        // Thai combining marks have 0 advance
        if matches!(ch as u32, 0x0E31 | 0x0E34..=0x0E3A | 0x0E47..=0x0E4E) {
            continue;
        }
        if ch.is_ascii() {
            width += font_size * 0.52;
        } else {
            width += font_size * 0.90;
        }
    }
    width * LIBASS_FONT_SCALE
}
