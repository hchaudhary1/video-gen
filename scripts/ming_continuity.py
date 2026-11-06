"""One acoustic identity for a complete Ming narration."""
from pathlib import Path
import re

# Neutral, cue-free and bounded: performance directions must not choose the voice.
REFERENCE_TEXT = (
    'Your browser asks a server for information and receives a response.'
)
CONTINUITY_MODE = 'fixed-acoustic-reference-v2'


# Ming can return silence for a request of one or two words, so no fragment is that short
# unless the whole text is.
MIN_FRAGMENT_WORDS = 5
FRAGMENT_ATTEMPTS = 3


def _even(words, limit):
    """Split a word list into the fewest near-equal chunks of at most `limit` words."""
    count = -(-len(words) // limit)
    size = -(-len(words) // count)
    return [words[i:i + size] for i in range(0, len(words), size)]


def _sentence_chunks(sentence, limit):
    """An over-long sentence splits at clause punctuation first, then evenly."""
    words = sentence.split()
    if len(words) <= limit:
        return [words]
    groups, current = [], []
    for clause in re.split(r'(?<=[,;:—])\s+', sentence):
        clause_words = clause.split()
        if current and len(current) + len(clause_words) > limit:
            groups.append(current)
            current = []
        current = current + clause_words
    if current:
        groups.append(current)
    return [chunk for group in groups for chunk in _even(group, limit)]


def speech_fragments(text, limit=24):
    """Bound English requests without rewriting punctuation or orphaning quotes."""
    fragments, pending = [], []
    sentences = re.split(r'(?<=[.!?])\s+|(?<=[.!?]["”])\s+', text.strip())
    for sentence in sentences:
        for words in _sentence_chunks(sentence, limit):
            if pending and len(pending) + len(words) > limit:
                fragments.append(pending)
                pending = []
            pending = pending + words
    if pending:
        fragments.append(pending)
    # A tiny fragment joins its neighbour, or the pair is rebalanced within the limit.
    merged = []
    for words in fragments:
        if merged and (len(words) < MIN_FRAGMENT_WORDS or len(merged[-1]) < MIN_FRAGMENT_WORDS):
            pair = merged.pop() + words
            merged.extend([pair] if len(pair) <= limit else _even(pair, limit))
        else:
            merged.append(words)
    for words in merged:
        if words:
            yield ' '.join(words)


class MingNarrator:
    def __init__(self, model, reference_path):
        self.model = model
        self.reference_path = str(Path(reference_path).resolve())
        self.ready = False

    def synthesize(self, text):
        """Yield bounded fragments, each conditioned on the same reference.

        Explicit raw_text prevents synthesize from silently splitting again and
        resetting speaker conditioning. The reference is never returned as speech.
        Failure propagates; there is no unconditioned fallback.
        """
        fragments = speech_fragments(text)
        if not self.ready:
            reference = self.model.synthesize(
                task='IP', text=REFERENCE_TEXT, controls={'ip': 'US_James'},
                language_id='English', use_zero_spk_emb=True, raw_text=True,
                output_path=self.reference_path,
            )
            if reference.numel() < self.model.sample_rate * 2 or not reference.isfinite().all():
                raise ValueError('Ming voice reference is invalid or too short')
            # synthesize encodes/caches this prompt under its inference-mode
            # context on first use; do not encode it here with gradients enabled.
            self.ready = True
        for fragment in fragments:
            # Sampling is stochastic: a silent or invalid sample is drawn again with the
            # same reference (never unconditioned) before the fragment counts as failed.
            for attempt in range(FRAGMENT_ATTEMPTS):
                waveform = self.model.synthesize(
                    # IP selects the reference voice once. Continuations use
                    # acoustic cloning without a competing IP instruction:
                    # combining both can make Ming stop before speaking.
                    task='TTS', text=fragment, language_id='English',
                    prompt_wav_path=self.reference_path, prompt_text=REFERENCE_TEXT + ' ',
                    use_spk_emb=True, use_zero_spk_emb=False, raw_text=True,
                )
                if not waveform.numel() or not waveform.isfinite().all():
                    problem = 'Ming returned empty or invalid audio'
                elif waveform.abs().max().item() < 1e-4:
                    problem = 'Ming returned silent audio for a spoken fragment'
                else:
                    break
                if attempt == FRAGMENT_ATTEMPTS - 1:
                    raise ValueError(problem)
            yield waveform
