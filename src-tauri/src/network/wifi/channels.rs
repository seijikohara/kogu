//! Pure channel / frequency math, shared across all platform backends.
//!
//! Different backends report the AP center frequency in different units
//! (Hz, kHz, or MHz). Convert to MHz at the source, then map to a
//! `(channel, band)` pair using the formulas below.

use super::types::WifiBand;

/// Convert a center frequency in MHz to a `(channel, band)` pair.
///
/// Returns `None` for frequencies that fall outside any defined Wi-Fi
/// band. The mapping follows IEEE 802.11-2020 §17.4.6.3 (Operating
/// Channels) and the FCC / ETSI Wi-Fi 6E allocations:
///
/// - 2.4 GHz: 2412 + (n - 1) * 5 MHz for n = 1..13, plus 2484 for ch 14.
/// - 5 GHz: 5180 + (n - 36) * 5 MHz for the standard primary channels.
/// - 6 GHz: 5950 + n * 5 MHz for n = 1..233 (Wi-Fi 6E / 802.11ax).
pub fn freq_mhz_to_channel(freq_mhz: u32) -> Option<(u16, WifiBand)> {
    // 2.4 GHz
    if (2412..=2472).contains(&freq_mhz) && (freq_mhz - 2412).is_multiple_of(5) {
        let channel = ((freq_mhz - 2412) / 5 + 1) as u16;
        return Some((channel, WifiBand::Band24));
    }
    if freq_mhz == 2484 {
        return Some((14, WifiBand::Band24));
    }
    // 5 GHz: channels 36..177 primary, but real-world range is 36..165
    if (5160..=5885).contains(&freq_mhz) && (freq_mhz - 5160).is_multiple_of(5) {
        let channel = ((freq_mhz - 5000) / 5) as u16;
        return Some((channel, WifiBand::Band5));
    }
    // 6 GHz
    if (5955..=7115).contains(&freq_mhz) && (freq_mhz - 5955).is_multiple_of(5) {
        let channel = ((freq_mhz - 5950) / 5) as u16;
        return Some((channel, WifiBand::Band6));
    }
    None
}

/// Inverse of [`freq_mhz_to_channel`].
///
/// Used by tests and helpful for tooling that wants to label the X axis
/// of the channel chart with frequencies.
#[cfg(test)]
pub fn channel_to_freq_mhz(channel: u16, band: WifiBand) -> Option<u32> {
    match band {
        WifiBand::Band24 => match channel {
            1..=13 => Some(2412 + (u32::from(channel) - 1) * 5),
            14 => Some(2484),
            _ => None,
        },
        WifiBand::Band5 => {
            if (36..=177).contains(&channel) {
                Some(5000 + u32::from(channel) * 5)
            } else {
                None
            }
        }
        WifiBand::Band6 => {
            if (1..=233).contains(&channel) {
                Some(5950 + u32::from(channel) * 5)
            } else {
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn freq_to_channel_24ghz() {
        assert_eq!(freq_mhz_to_channel(2412), Some((1, WifiBand::Band24)));
        assert_eq!(freq_mhz_to_channel(2437), Some((6, WifiBand::Band24)));
        assert_eq!(freq_mhz_to_channel(2462), Some((11, WifiBand::Band24)));
        assert_eq!(freq_mhz_to_channel(2484), Some((14, WifiBand::Band24)));
    }

    #[test]
    fn freq_to_channel_5ghz() {
        assert_eq!(freq_mhz_to_channel(5180), Some((36, WifiBand::Band5)));
        assert_eq!(freq_mhz_to_channel(5240), Some((48, WifiBand::Band5)));
        assert_eq!(freq_mhz_to_channel(5500), Some((100, WifiBand::Band5)));
        assert_eq!(freq_mhz_to_channel(5825), Some((165, WifiBand::Band5)));
    }

    #[test]
    fn freq_to_channel_6ghz() {
        assert_eq!(freq_mhz_to_channel(5955), Some((1, WifiBand::Band6)));
        assert_eq!(freq_mhz_to_channel(6175), Some((45, WifiBand::Band6)));
        assert_eq!(freq_mhz_to_channel(7115), Some((233, WifiBand::Band6)));
    }

    #[test]
    fn freq_to_channel_invalid() {
        assert_eq!(freq_mhz_to_channel(1000), None);
        assert_eq!(freq_mhz_to_channel(2413), None);
        assert_eq!(freq_mhz_to_channel(9999), None);
    }

    #[test]
    fn channel_to_freq_round_trip_24ghz() {
        for ch in 1..=13 {
            let freq = channel_to_freq_mhz(ch, WifiBand::Band24).unwrap();
            assert_eq!(freq_mhz_to_channel(freq), Some((ch, WifiBand::Band24)));
        }
        assert_eq!(channel_to_freq_mhz(14, WifiBand::Band24), Some(2484));
    }

    #[test]
    fn channel_to_freq_round_trip_5ghz() {
        for ch in [36, 40, 44, 48, 100, 149, 165] {
            let freq = channel_to_freq_mhz(ch, WifiBand::Band5).unwrap();
            assert_eq!(freq_mhz_to_channel(freq), Some((ch, WifiBand::Band5)));
        }
    }
}
