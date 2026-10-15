#!/usr/bin/env python3
# ============================================================
#   Générateur des sons du Pomodoro — Study Plan IB
#   20 ambiances distinctes, une par emoji affiché dans l'application.
#   Chaque fichier boucle proprement : tout est construit en cercle
#   (les événements qui dépassent la fin repassent au début, les
#   oscillations font un nombre entier de cycles sur la durée du son).
#
#   Dépendance : numpy (pip install numpy)
#   Usage : python3 tools/generer-sons-pomodoro.py
#   Sortie : audio/pomodoro/*.wav (22050 Hz, 16 bits, 8 s)
# ============================================================

import os
import wave
import zlib

import numpy as np

FS = 22050                 # fréquence d'échantillonnage
DUREE = 8.0                # durée de chaque ambiance, en secondes
N = int(FS * DUREE)        # nombre d'échantillons
T = np.arange(N) / FS      # temps, en secondes
SORTIE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'audio', 'pomodoro')


# ── Outils de filtrage (masques en fréquence : la boucle reste parfaite) ──
def _freqs(n):
    return np.fft.rfftfreq(n, 1.0 / FS)


def passe_bas(fc, ordre=4):
    def masque(f):
        return 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * ordre))
    return masque


def passe_haut(fc, ordre=4):
    def masque(f):
        return 1.0 / np.sqrt(1.0 + (np.maximum(fc, 1e-6) / np.maximum(f, 1e-6)) ** (2 * ordre))
    return masque


def bande(f1, f2, ordre=3):
    bas = passe_bas(f2, ordre)
    haut = passe_haut(f1, ordre)
    return lambda f: bas(f) * haut(f)


def filtre(x, masque):
    n = len(x)
    f = _freqs(n)
    return np.fft.irfft(np.fft.rfft(x) * masque(f), n)


def bruit(n, rng):
    return rng.standard_normal(n)


def souffle(n, rng, f1, f2, ordre=3):
    return filtre(bruit(n, rng), bande(f1, f2, ordre))


def brun(n, rng, f1=25.0, f2=5000.0, pente=1.0):
    """Nappe grave en 1/f**pente, limitée à une bande audible (pas de courant continu)."""
    x = bruit(n, rng)
    f = _freqs(n).copy()
    f[0] = f[1]
    profil = (np.maximum(f, f1) / f1) ** (-pente)
    return np.fft.irfft(np.fft.rfft(x) * profil * bande(f1, f2, 3)(f), n)


def rose(n, rng, pente=0.5):
    """Bruit coloré par une pente en 1/f**pente (0.5 = rose, 1 = brun)."""
    x = bruit(n, rng)
    f = _freqs(n).copy()
    f[0] = f[1]
    y = np.fft.irfft(np.fft.rfft(x) / (f ** pente), n)
    return filtre(y, passe_haut(20.0, 4))


def ajouter(buf, debut, w):
    """Ajoute un événement au temps voulu ; ce qui dépasse revient au début."""
    n = len(buf)
    if len(w) >= n:
        w = w[:n]
    i = int(round(debut * FS)) % n
    m = len(w)
    if i + m <= n:
        buf[i:i + m] += w
    else:
        k = n - i
        buf[i:] += w[:k]
        buf[:m - k] += w[k:]


def env_creneau(m, montee=0.25, descente=0.4):
    """Enveloppe douce : attaque, plateau, extinction."""
    e = np.ones(m)
    a = max(1, int(m * montee))
    r = max(1, int(m * descente))
    e[:a] = np.linspace(0.0, 1.0, a) ** 1.4
    e[-r:] = np.linspace(1.0, 0.0, r) ** 1.4
    return e


def normaliser(x, rms_cible, crete_max=0.92):
    x = x - float(np.mean(x))
    r = float(np.sqrt(np.mean(x ** 2)))
    if r > 1e-9:
        x = x * (rms_cible / r)
    p = float(np.max(np.abs(x))) if len(x) else 0.0
    if p > crete_max:
        x = x * (crete_max / p)
    return x


def ton(n, freq, phase=0.0):
    """Sinus dont la fréquence tombe juste sur la durée du son (boucle nette)."""
    f = round(freq * DUREE) / DUREE
    return np.sin(2.0 * np.pi * f * T[:n] + phase)


# ── Briques d'événements ────────────────────────────────────────────────
def goutte(rng, freq, tau, amp=1.0, bruit_part=0.45):
    m = max(8, int(tau * 7 * FS))
    t = np.arange(m) / FS
    e = np.exp(-t / tau)
    corps = np.sin(2.0 * np.pi * freq * t) * e
    grain = rng.standard_normal(m) * np.exp(-t / max(0.0015, tau * 0.25))
    return amp * (corps + bruit_part * grain)


def craquement(rng, freq, tau, amp=1.0):
    return goutte(rng, freq, tau, amp, bruit_part=0.7)


def tape(rng, freq_bas, freq_haut, amp=1.0):
    """"Toc" de touche de clavier : claquement court + résonance basse."""
    m = int(0.05 * FS)
    t = np.arange(m) / FS
    clic = filtre(rng.standard_normal(m), bande(freq_bas, freq_haut, 2)) * np.exp(-t / 0.004)
    corps = np.sin(2.0 * np.pi * 165 * t) * np.exp(-t / 0.016)
    return amp * (0.85 * clic + 0.5 * corps)


def froissement(rng, duree, amp=1.0, f1=1200, f2=6500):
    m = int(duree * FS)
    base = souffle(m, rng, f1, f2, 2)
    t = np.arange(m)
    modul = 0.5 + 0.5 * np.sin(2.0 * np.pi * (8.0 + rng.random() * 9.0) * t / FS)
    return amp * base * modul * env_creneau(m, 0.3, 0.45)


def coup_de_tonnerre(rng, force=1.0):
    m = int((2.6 + rng.random() * 1.8) * FS)
    t = np.arange(m) / FS
    base = brun(m, rng)
    grondement = filtre(base, bande(24, 170, 3))
    e = np.exp(-t / (1.0 + rng.random() * 0.9)) * (1.0 - np.exp(-t / 0.05))
    e *= 0.75 + 0.25 * np.sin(2.0 * np.pi * (0.7 + rng.random()) * t)
    craquement_sec = souffle(int(0.22 * FS), rng, 120, 5200, 2) * np.exp(-np.arange(int(0.22 * FS)) / 0.035)
    x = force * (grondement * 3.4 * e)
    x[:len(craquement_sec)] += force * 0.5 * craquement_sec
    return x


def sifflement_oiseau(rng, amp=1.0):
    m = int((0.16 + rng.random() * 0.14) * FS)
    t = np.arange(m) / FS
    f0 = 2400.0 + rng.random() * 1400.0
    excursion = (rng.random() - 0.5) * 1800.0
    phase = 2.0 * np.pi * (f0 * t + excursion * t ** 2 / (2 * m / FS))
    return amp * np.sin(phase) * env_creneau(m, 0.25, 0.5)


def klaxon(rng, amp=1.0):
    m = int(0.55 * FS)
    t = np.arange(m) / FS
    f = 400.0 + rng.random() * 90.0
    x = 0.6 * np.sin(2.0 * np.pi * f * t) + 0.4 * np.sin(2.0 * np.pi * f * 1.5 * t)
    return amp * x * env_creneau(m, 0.1, 0.35)


def passage_voiture(rng, duree=2.4, amp=1.0):
    m = int(duree * FS)
    base = souffle(m, rng, 180, 2600, 2)
    t = np.linspace(-1.0, 1.0, m)
    e = np.exp(-((t + 0.1) ** 2) / 0.09)
    grondement = brun(m, rng, 40.0, 260.0, 0.8)
    return amp * (0.6 * base + 0.9 * grondement * 2.0) * e


# ── Ambiances ───────────────────────────────────────────────────────────
def son_pluie(rng):
    """☂️ Pluie — averse régulière : nappe douce + gouttes fines serrées."""
    lit = souffle(N, rng, 500, 6500, 2) * 0.42
    lit += brun(N, rng, 120.0, 900.0, 0.6) * 1.1
    lit += filtre(souffle(N, rng, 120, 900, 2), passe_bas(900, 2)) * 0.55
    for _ in range(560):
        ajouter(lit, rng.random() * DUREE, goutte(rng, 1500 + rng.random() * 3200, 0.010 + rng.random() * 0.02, 0.09))
    return lit


def son_ocean(rng):
    """🌊 Océan — vagues qui montent et descendent, écume en crête."""
    houle = 0.5 + 0.5 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T)
    houle = houle ** 1.6
    grave = brun(N, rng, 30.0, 700.0, 0.8) * (1.6 + 3.6 * houle)
    ecume = souffle(N, rng, 1800, 8000, 2) * (0.06 + 0.42 * houle ** 2)
    ressac = souffle(N, rng, 400, 2200, 2) * (0.3 + 0.75 * houle)
    return grave * 1.4 + ecume * 0.9 + ressac * 0.5


def son_cafe(rng):
    """☕ Café animé — murmure de voix douces : plusieurs personnes parlent à voix basse."""
    voix = np.zeros(N)
    plans = [
        (104.0, (420.0, 1180.0, 2500.0), 3.6),
        (126.0, (560.0, 1650.0, 2900.0), 4.2),
        (88.0, (330.0, 900.0, 2300.0), 3.1),
        (142.0, (640.0, 1900.0, 3050.0), 4.6),
        (96.0, (480.0, 1400.0, 2700.0), 3.3),
        (115.0, (380.0, 1250.0, 2450.0), 3.9),
    ]
    for f0, formants, syllabes in plans:
        fond = round(f0 * DUREE) / DUREE
        # Intonation : la hauteur monte et descend doucement, comme une vraie voix.
        amplitude = 6.0 + rng.random() * 8.0
        fm = (2 + int(rng.random() * 4)) / DUREE          # fréquence entière sur la boucle
        psi = rng.random() * 6.0
        phase = 2.0 * np.pi * fond * T + (amplitude / fm) * np.sin(2.0 * np.pi * fm * T + psi)
        source = 2.0 * ((phase / (2.0 * np.pi)) % 1.0) - 1.0       # voix voisée
        voix_basse = np.zeros(N)
        for i, (fc, largeur, poids) in enumerate(zip(formants, (150.0, 240.0, 300.0), (1.0, 0.62, 0.3))):
            voix_basse += poids * filtre(source, bande(fc - largeur / 2, fc + largeur / 2, 3))
        rythme = syllabes + rng.random() * 0.6
        phase = rng.random()
        mode = 0.55 + 0.45 * np.sin(2.0 * np.pi * round(rythme * DUREE) / DUREE * T + phase)
        souffle_voix = souffle(N, rng, 500, 3200, 2) * 0.5      # souffle : voix murmurée
        voix += (voix_basse * 0.85 + souffle_voix) * (0.35 + 0.65 * mode)
    # Voix douces : on adoucit les aigus et on garde un fond de salle discret.
    voix = filtre(voix, bande(180, 3600, 2))
    fond_salle = souffle(N, rng, 120, 1200, 2) * 0.35 + brun(N, rng, 45.0, 300.0, 0.9) * 1.2
    for _ in range(9):
        ajouter(fond_salle, rng.random() * DUREE, goutte(rng, 2600 + rng.random() * 1400, 0.05, 0.06))
    melange = voix * 0.95 + fond_salle * 0.75
    return melange


def son_avion(rng):
    """✈️ Cabine d'avion — grondement sourd continu, souffle d'air conditionné."""
    moteur = brun(N, rng, 35.0, 340.0, 1.0) * 4.5
    turbine = ton(N, 88.0) * 0.06 + ton(N, 176.0) * 0.03
    turbine *= 0.75 + 0.25 * np.cos(2.0 * np.pi * (3.0 / DUREE) * T)
    souffle_cabine = souffle(N, rng, 420, 5200, 2) * 0.36
    sifflement = filtre(souffle(N, rng, 1800, 3400, 3), bande(1800, 3400, 3)) * 0.05
    return moteur + turbine + souffle_cabine + sifflement


def son_salle(rng):
    """😰 Salle d'examen — silence tendu : papier, horloge, toux lointaine."""
    fond = souffle(N, rng, 100, 800, 2) * 0.05 + brun(N, rng, 50.0, 320.0, 0.8) * 0.6
    base = fond * 0.5
    for i in range(4):
        ajouter(base, i * 2.0 + rng.random() * 0.3, froissement(rng, 0.32 + rng.random() * 0.2, 0.3, 500, 3400))
    for i in range(8):
        t0 = i * 1.0 + 0.12
        m = int(0.05 * FS)
        tt = np.arange(m) / FS
        tic = np.sin(2.0 * np.pi * 1050.0 * tt) * np.exp(-tt / 0.006)
        ajouter(base, t0, 0.05 * tic)
    # une toux étouffée, une seule fois
    m = int(0.42 * FS)
    tt = np.arange(m) / FS
    toux = filtre(rng.standard_normal(m), bande(300, 1800, 2)) * np.exp(-tt / 0.06)
    ajouter(base, 3.4, 0.5 * toux)
    return base


def son_train(rng):
    """🚆 Train — roulement continu et claquements de bogies réguliers."""
    roulement = brun(N, rng, 40.0, 460.0, 1.0) * 4.0
    roulement += souffle(N, rng, 300, 3000, 2) * 0.22
    # claquements (boucle régulière : le motif tient dans la durée)
    rail_buf = np.zeros(N)
    for k in range(5):
        t0 = 0.35 + k * 1.6
        ajouter(rail_buf, t0, craquement(rng, 950.0, 0.014, 0.5))
        ajouter(rail_buf, t0 + 0.26, craquement(rng, 1150.0, 0.012, 0.38))
        ajouter(rail_buf, t0, goutte(rng, 150.0, 0.05, 0.25))
    grincement = filtre(souffle(N, rng, 2100, 2700, 3), bande(2100, 2700, 3)) * 0.04
    grincement *= 0.6 + 0.4 * np.cos(2.0 * np.pi * (5.0 / DUREE) * T)
    return roulement + rail_buf + grincement


def son_bibliotheque(rng):
    """📚 Bibliothèque — calme feutré, pages tournées, soufflerie lointaine."""
    ventilation = souffle(N, rng, 90, 700, 2) * 0.16 + ton(N, 120.0) * 0.012
    base = ventilation
    for i in range(6):
        ajouter(base, i * 1.3 + rng.random() * 0.4, froissement(rng, 0.26 + rng.random() * 0.22, 0.34, 600, 3400))
    m = int(0.9 * FS)
    tt = np.arange(m) / FS
    chaise = np.sin(2.0 * np.pi * (760.0 + 120.0 * np.sin(2.0 * np.pi * 1.5 * tt)) * tt) * 0.03
    ajouter(base, 5.2, chaise * (0.5 + 0.5 * np.sin(2.0 * np.pi * 2.0 * tt)))
    return base


def son_matin(rng):
    """🚕 Matin en ville — circulation lointaine, oiseaux, un klaxon au loin."""
    circulation = brun(N, rng, 45.0, 520.0, 0.9) * 3.4
    circulation *= 0.7 + 0.3 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T)
    base = circulation + souffle(N, rng, 220, 3000, 2) * 0.16
    for i in range(4):
        ajouter(base, i * 1.9 + rng.random() * 0.6, passage_voiture(rng, 2.0 + rng.random(), 0.5))
    for i in range(9):
        ajouter(base, rng.random() * DUREE, sifflement_oiseau(rng, 0.05 + rng.random() * 0.05))
    ajouter(base, 2.7, klaxon(rng, 0.16))
    ajouter(base, 6.1, klaxon(rng, 0.1))
    return base


def son_pluie_legere(rng):
    """☔ Pluie légère — gouttes espacées, fines, sans grondement."""
    base = souffle(N, rng, 1200, 9000, 2) * 0.16
    for _ in range(190):
        ajouter(base, rng.random() * DUREE, goutte(rng, 2400 + rng.random() * 4200, 0.006 + rng.random() * 0.01, 0.14))
    base += souffle(N, rng, 300, 1200, 2) * 0.08
    return base


def son_pluie_forte(rng):
    """🌧️ Forte pluie — averse dense, grosses gouttes et ruissellement."""
    base = souffle(N, rng, 250, 9000, 2) * 0.85
    base += brun(N, rng, 40.0, 620.0, 0.9) * 3.8
    for _ in range(900):
        ajouter(base, rng.random() * DUREE, goutte(rng, 700 + rng.random() * 1800, 0.02 + rng.random() * 0.05, 0.21))
    ruissellement = souffle(N, rng, 180, 700, 2) * (0.3 + 0.3 * np.cos(2.0 * np.pi * (4.0 / DUREE) * T))
    return base + ruissellement


def son_orage(rng):
    """⛈️ Orage — pluie soutenue et coups de tonnerre qui roulent."""
    base = souffle(N, rng, 300, 7000, 2) * 0.3
    base += brun(N, rng, 40.0, 520.0, 0.9) * 1.7
    for _ in range(300):
        ajouter(base, rng.random() * DUREE, goutte(rng, 900 + rng.random() * 2200, 0.015 + rng.random() * 0.03, 0.1))
    ajouter(base, 0.6, coup_de_tonnerre(rng, 1.4))
    ajouter(base, 3.9, coup_de_tonnerre(rng, 1.05))
    return base


def son_cheminee(rng):
    """🔥 Cheminée — flamme qui ronfle, craquements fins et réguliers."""
    flamme = brun(N, rng, 70.0, 700.0, 0.8) * (3.2 + 0.8 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T))
    braise = souffle(N, rng, 200, 900, 2) * 0.2
    base = flamme + braise
    for _ in range(150):
        ajouter(base, rng.random() * DUREE, craquement(rng, 1600 + rng.random() * 4200, 0.004 + rng.random() * 0.006, 0.12))
    for _ in range(8):
        ajouter(base, rng.random() * DUREE, craquement(rng, 500 + rng.random() * 500, 0.05, 0.3))
    return base


def son_feu(rng):
    """🪵 Feu de camp — bois qui éclate, vent léger au-dessus des flammes."""
    base = brun(N, rng, 80.0, 520.0, 0.8) * (2.0 + 0.7 * np.cos(2.0 * np.pi * (3.0 / DUREE) * T))
    vent = souffle(N, rng, 150, 1400, 2) * 0.3
    base += vent
    for _ in range(46):
        ajouter(base, rng.random() * DUREE, craquement(rng, 260 + rng.random() * 500, 0.05 + rng.random() * 0.05, 0.52))
    for _ in range(60):
        ajouter(base, rng.random() * DUREE, craquement(rng, 1400 + rng.random() * 3600, 0.005, 0.1))
    return base


def son_bureau(rng):
    """🏢 Bureau — frappe de clavier par salves, imprimante, soufflerie."""
    soufflerie = souffle(N, rng, 120, 1600, 2) * 0.22 + ton(N, 200.0) * 0.01
    base = soufflerie
    t0 = 0.4
    while t0 < DUREE - 0.4:
        for _ in range(rng.integers(5, 12)):
            t0 += 0.07 + rng.random() * 0.09
            ajouter(base, t0, tape(rng, 1400, 5200, 0.34))
        t0 += 0.55 + rng.random() * 0.7
    m = int(0.7 * FS)
    tt = np.arange(m) / FS
    imprimante = np.sin(2.0 * np.pi * (140.0 + 28.0 * np.sin(2.0 * np.pi * 9.0 * tt)) * tt) * 0.05
    imprimante += souffle(m, rng, 700, 2600, 2) * 0.05 * (0.4 + 0.6 * np.sin(2.0 * np.pi * 11.0 * tt) ** 2)
    ajouter(base, 4.6, imprimante * env_creneau(m, 0.15, 0.3))
    return base


def son_vent(rng):
    """🌬️ Vent — rafales qui montent et redescendent, léger sifflement."""
    rafale = 0.18 + 0.95 * (0.5 + 0.5 * np.cos(2.0 * np.pi * (3.0 / DUREE) * T)) ** 2.6
    grave = filtre(souffle(N, rng, 90, 500, 2), passe_bas(600, 2)) * 1.1
    medium = souffle(N, rng, 300, 1800, 2) * 0.35
    sifflement = filtre(bruit(N, rng), bande(600, 1100, 3)) * 0.06
    sifflement *= 0.5 + 0.5 * np.cos(2.0 * np.pi * (4.0 / DUREE) * T + 0.4)
    return (grave + medium) * rafale + sifflement


def son_blanc(rng):
    """🧠 Bruit blanc — plat, régulier, uniforme."""
    return bruit(N, rng)


def son_rose(rng):
    """🩷 Bruit rose — plus doux dans les aigus que le blanc."""
    return rose(N, rng, 0.5)


def son_brun(rng):
    """🟤 Bruit brun — grave, profond, enveloppant."""
    return brun(N, rng, 22.0, 6000.0, 1.0) * 6.0 + rose(N, rng, 0.5) * 0.10


SONS = [
    ('pluie', son_pluie, 0.085),
    ('ocean', son_ocean, 0.085),
    ('cafe', son_cafe, 0.075),
    ('avion', son_avion, 0.085),
    ('salle', son_salle, 0.07),
    ('train', son_train, 0.085),
    ('bibliotheque', son_bibliotheque, 0.07),
    ('matin', son_matin, 0.085),
    ('pluie-legere', son_pluie_legere, 0.085),
    ('pluie-forte', son_pluie_forte, 0.09),
    ('orage', son_orage, 0.09),
    ('cheminee', son_cheminee, 0.085),
    ('feu', son_feu, 0.085),
    ('bureau', son_bureau, 0.08),
    ('vent', son_vent, 0.085),
    ('blanc', son_blanc, 0.08),
    ('rose', son_rose, 0.08),
    ('brun', son_brun, 0.08),
]


def ecrire_wav(nom, donnees):
    """Écrit un WAV 16 bits ; donnees = mono (N,) ou stéréo (2, N)."""
    if donnees.ndim == 1:
        canaux = 1
        plat = donnees
    else:
        canaux = donnees.shape[0]
        plat = donnees.T.reshape(-1)
    entier = np.clip(plat, -1.0, 1.0)
    entier = (entier * 32767.0).astype('<i2')
    chemin = os.path.join(SORTIE, nom + '.wav')
    with wave.open(chemin, 'wb') as f:
        f.setnchannels(canaux)
        f.setsampwidth(2)
        f.setframerate(FS)
        f.writeframes(entier.tobytes())
    return chemin, os.path.getsize(chemin)


def binaural(rng, porteuse, battement, rms_cible=0.06):
    """Battement binaural : deux porteuses, une par oreille."""
    gauche = ton(N, porteuse) * 0.5 + ton(N, porteuse * 2.0) * 0.05
    droite = ton(N, porteuse + battement) * 0.5 + ton(N, porteuse * 2.0 + battement) * 0.05
    voile = rose(N, rng, 0.5)
    gauche = gauche + voile * 0.05
    droite = droite + np.roll(voile, 733) * 0.05
    stereo = np.vstack([gauche, droite])
    stereo = stereo - stereo.mean(axis=1, keepdims=True)
    r = float(np.sqrt(np.mean(stereo ** 2)))
    stereo = stereo * (rms_cible / r)
    p = float(np.max(np.abs(stereo)))
    if p > 0.9:
        stereo = stereo * (0.9 / p)
    return stereo


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lignes = []
    for nom, fabrique, rms in SONS:
        rng = np.random.default_rng(zlib.crc32(nom.encode('utf-8')))
        x = normaliser(fabrique(rng), rms)
        chemin, taille = ecrire_wav(nom, x)
        lignes.append((nom, 'mono', taille, float(np.sqrt(np.mean(x ** 2))), float(np.max(np.abs(x)))))
    for nom, porteuse, battement in (('gamma', 200.0, 40.0), ('beta', 220.0, 18.0)):
        rng = np.random.default_rng(zlib.crc32(nom.encode('utf-8')))
        x = binaural(rng, porteuse, battement)
        chemin, taille = ecrire_wav(nom, x)
        lignes.append((nom, 'stéréo', taille, float(np.sqrt(np.mean(x ** 2))), float(np.max(np.abs(x)))))
    for nom, canaux, taille, r, p in sorted(lignes):
        print(f'{nom:14s} {canaux:7s} {taille:9d} o   rms {r:.3f}   crête {p:.3f}')


if __name__ == '__main__':
    main()
