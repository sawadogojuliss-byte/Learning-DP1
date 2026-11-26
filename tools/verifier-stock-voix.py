#!/usr/bin/env python3
"""Contrôles structurels du stock vocal, sans validation auditive ni intégration."""
from pathlib import Path
from array import array
import math
import sys
import wave

root = Path(__file__).resolve().parents[1]
stock = root / 'livrables/stock-voix'
durees = stock / 'durees'
pub = root / 'livrables/publication-voix'
expected = {f'{n:02d}-minutes.wav' for n in range(50)}
assert {f.name for f in durees.glob('*.wav')} == expected, 'Durées 0 à 49 incomplètes'
for path in sorted(durees.glob('*.wav')):
    with wave.open(str(path), 'rb') as audio:
        assert audio.getnchannels() == 1 and audio.getsampwidth() == 2, path
        assert audio.getframerate() == 44100, path
        seconds = audio.getnframes() / audio.getframerate()
        assert 0.3 < seconds < 4, (path, seconds)
        samples = array('h', audio.readframes(audio.getnframes()))
        if sys.byteorder != 'little':
            samples.byteswap()
        assert math.sqrt(sum(value * value for value in samples) / len(samples)) > 100, path
assert (durees / '21-minutes-approuve.mp3').read_bytes() == (pub / 'vingte-une-minute-essai.mp3').read_bytes(), 'Version de 21 différente de celle approuvée'
for name in ('reprise-proposition.wav', 'fin-seance-proposition.wav'):
    with wave.open(str(stock / 'messages' / name), 'rb') as audio:
        assert audio.getnframes() > audio.getframerate(), name
assert (stock / 'messages/fin-seance-test-masculine-2-original.mp3').stat().st_size > 1000
for n in range(50, 61):
    path = pub / f'essai-{n:02d}-minutes.mp3'
    assert path.stat().st_size > 1000, path
    assert path.read_bytes()[:3] == b'ID3', path
print('Stock 0–49, corrections, messages et essais 50–60 : structure vérifiée.')
