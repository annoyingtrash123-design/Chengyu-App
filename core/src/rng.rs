//! Tiny deterministic PRNG (SplitMix64) so quizzes and games are reproducible in tests.

#[derive(Debug, Clone)]
pub struct Rng(u64);

impl Rng {
    pub fn new(seed: u64) -> Self {
        Rng(seed)
    }

    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    /// Uniform integer in `0..n` (`n` must be > 0).
    pub fn below(&mut self, n: usize) -> usize {
        (self.next_u64() % n as u64) as usize
    }

    pub fn shuffle<T>(&mut self, items: &mut [T]) {
        for i in (1..items.len()).rev() {
            let j = self.below(i + 1);
            items.swap(i, j);
        }
    }

    pub fn pick<'a, T>(&mut self, items: &'a [T]) -> Option<&'a T> {
        if items.is_empty() {
            None
        } else {
            Some(&items[self.below(items.len())])
        }
    }

    /// Up to `n` distinct items, in random order.
    pub fn sample<T: Clone>(&mut self, items: &[T], n: usize) -> Vec<T> {
        let mut v = items.to_vec();
        self.shuffle(&mut v);
        v.truncate(n);
        v
    }
}

/// Stable hash used for "chengyu of the day".
pub fn hash64(x: u64) -> u64 {
    Rng::new(x).next_u64()
}
