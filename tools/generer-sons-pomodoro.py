#!/usr/bin/env python3
# ============================================================
#   Générateur des sons du Pomodoro — Study Plan IB
#   20 ambiances, une par emoji affiché dans l'application.
#   Chaque fichier boucle proprement : tout est construit en cercle
#   (les événements qui dépassent la fin repassent au début, les
#   oscillations font un nombre entier de cycles sur la durée du son).
#
#   Objectif de cette version : plus aucun son ne doit ressembler à
#   une radio mal réglée. On garde donc les aigus sous contrôle, on
#   donne du corps grave/médium à chaque ambiance, et les deux pistes
#   binaurales sont posées très bas sous un lit chaud au lieu d'être
#   des sons purs en sirène.
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
    """Bruit blanc parfaitement bouclable : des phases au hasard dans le
    domaine des fréquences, donc la dernière seconde se raccorde à la première
    sans le moindre clic (l'ancienne version coupait net toutes les 8 s)."""
    f = _freqs(n)
    phase = rng.uniform(0.0, 2.0 * np.pi, len(f))
    amplitude = np.ones(len(f))
    amplitude[0] = 0.0
    return np.fft.irfft(amplitude * np.exp(1j * phase), n)


def nappe(n, rng, f1, f2, pente=0.35, gain=1.0):
    """Nappe de bruit dont on choisit la bande et la pente : c'est ce qui
    évite qu'un seul grave écrase toute l'ambiance (et donc le côté « sourd »
    ou « radio »). Le spectre est construit directement, donc la boucle est nette."""
    f = _freqs(n).copy()
    f[0] = f[1]
    profil = (np.maximum(f, f1) / f1) ** (-pente)
    profil *= 1.0 / np.sqrt(1.0 + (f / f2) ** (2 * 4))
    profil *= 1.0 / np.sqrt(1.0 + (f1 / np.maximum(f, 1e-6)) ** (2 * 4))
    profil[0] = 0.0
    phase = rng.uniform(0.0, 2.0 * np.pi, len(f))
    x = np.fft.irfft(profil * np.exp(1j * phase), n)
    # Chaque bande est ramenée à un volume comparable : le gain voulu est
    # alors son vrai poids dans le mélange (avant, les nappes étaient
    # quasi inaudibles et seuls les événements ressortaient).
    r = float(np.sqrt(np.mean(x ** 2)))
    return gain * (x / r) if r > 1e-12 else x


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


MARGE = int(0.09 * FS)      # fondu de bouclage (90 ms)
LONGUEUR = N - MARGE        # longueur finale de chaque fichier


def point_de_boucle(x, marge=2000):
    """Trouve l'endroit du signal où le raccord sera le plus discret :
    celui où deux échantillons voisins se ressemblent le plus."""
    d = np.abs(np.diff(x))
    debut = max(1, marge)
    fin = len(x) - marge
    return debut + int(np.argmin(d[debut:fin]))


def boucler(x, index=None):
    """Rend la boucle parfaite : la fin se fond dans le début sur 90 ms, puis
    le point de boucle est déplacé là où le signal est le plus plat.
    Aucun clic, aucune baisse de volume au moment où le son repart."""
    m = MARGE
    n = len(x)
    tete = x[:m].copy()
    queue = x[n - m:]
    fondu = np.linspace(0.0, 1.0, m)
    x = x[:n - m].copy()
    x[:m] = tete * fondu + queue * (1.0 - fondu)
    k = point_de_boucle(x) if index is None else index
    return np.concatenate([x[k + 1:], x[:k + 1]]), k


def ton_longueur(n, freq, phase=0.0):
    """Sinus qui fait un nombre entier de cycles sur la longueur du fichier,
    pour que la dernière seconde se raccorde exactement à la première."""
    f = round(freq * n / FS) * FS / n
    return np.sin(2.0 * np.pi * f * np.arange(n) / FS + phase)


def enveloppe_lente(n, cycles, phase=0.0, creux=0.35):
    """Respiration lente : un nombre entier de cycles sur la boucle."""
    x = 0.5 + 0.5 * np.cos(2.0 * np.pi * cycles * np.arange(n) / n + phase)
    return creux + (1.0 - creux) * x


def normaliser(x, rms_cible, crete_max=0.92):
    x = x - float(np.mean(x))
    r = float(np.sqrt(np.mean(x ** 2)))
    if r > 1e-9:
        x = x * (rms_cible / r)
    p = float(np.max(np.abs(x))) if len(x) else 0.0
    if p > crete_max:
        x = x * (crete_max / p)
    return x


def ponderation_a(f):
    """Courbe de pondération A : elle suit la sensibilité de l'oreille.
    Normaliser avec elle évite qu'une ambiance grave paraisse deux fois plus
    faible qu'une ambiance claire, à volume égal."""
    f2 = f ** 2
    ra = (12194.0 ** 2 * f2 ** 2) / ((f2 + 20.6 ** 2) * np.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194.0 ** 2))
    return ra * 10.0 ** (2.0 / 20.0)


def rms_pondere(x):
    spec = np.fft.rfft(x)
    f = _freqs(len(x))
    poids = ponderation_a(np.maximum(f, 1.0))
    return float(np.sqrt(np.sum((np.abs(spec) * poids) ** 2) / len(x) ** 2))


def limiter(x, seuil=0.86):
    """Écrêtage doux : on arrondit seulement les pointes, sans distordre."""
    x = x / seuil
    x = np.where(np.abs(x) > 0.7, np.sign(x) * (0.7 + 0.3 * np.tanh((np.abs(x) - 0.7) / 0.3)), x)
    return x * seuil


def masteriser(x, rms_cible, coupe_bas=32.0, coupe_haut=9500.0, saturation=0.0):
    """Finition commune : bande utile, adoucissement, volume perçu constant."""
    x = filtre(x, lambda f: passe_haut(coupe_bas, 2)(f) * passe_bas(coupe_haut, 4)(f))
    if saturation > 0.0:
        x = np.tanh(x * saturation) / saturation
    x = x - float(np.mean(x))
    r = float(np.sqrt(np.mean(x ** 2)))
    if r > 1e-9:
        x = x * (rms_cible / r)
    # Sécurité seulement : on ne touche pas aux crêtes normales, sinon les
    # gouttes et les craquements perdent toute leur vie.
    p = float(np.max(np.abs(x)))
    if p > 0.98:
        x = x * (0.98 / p)
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
    return goutte(rng, freq, tau, amp, bruit_part=0.9)


def craquement_bois(rng, taille, amp=1.0):
    """Craquement de bois, comme dans une vraie cheminée.
    taille 0 = petit tic sec, 1 = gros claquement.
    Attaque large bande très brève (le « tac »), puis corps boisé qui
    résonne (deux harmoniques), puis extinction rapide."""
    duree = 0.012 + 0.055 * taille
    m = max(8, int(duree * FS))
    t = np.arange(m) / FS
    attaque = rng.standard_normal(m) * np.exp(-t / (0.0005 + 0.0009 * taille))
    attaque = filtre(attaque, bande(500, 8200, 2))
    attaque /= (np.max(np.abs(attaque)) + 1e-9)
    f0 = 210.0 + rng.random() * 250.0
    corps = np.sin(2.0 * np.pi * f0 * t + rng.random() * 6.28) * np.exp(-t / (0.006 + 0.020 * taille))
    corps += 0.50 * np.sin(2.0 * np.pi * f0 * 2.35 * t + rng.random() * 6.28) * np.exp(-t / (0.004 + 0.012 * taille))
    corps += 0.30 * np.sin(2.0 * np.pi * f0 * 4.1 * t) * np.exp(-t / (0.003 + 0.008 * taille))
    x = 0.95 * attaque + 0.62 * corps
    fin = max(2, int(0.35 * m))
    x[-fin:] *= np.linspace(1.0, 0.0, fin) ** 2
    return amp * x


def tape(rng, freq_bas, freq_haut, amp=1.0):
    """"Toc" de touche de clavier : claquement court + résonance basse."""
    m = int(0.05 * FS)
    t = np.arange(m) / FS
    clic = filtre(rng.standard_normal(m), bande(freq_bas, freq_haut, 2)) * np.exp(-t / 0.004)
    corps = np.sin(2.0 * np.pi * 165 * t) * np.exp(-t / 0.016)
    return amp * (0.7 * clic + 0.5 * corps)


def froissement(rng, duree, amp=1.0, f1=1200, f2=6500):
    m = int(duree * FS)
    base = souffle(m, rng, f1, f2, 2)
    t = np.arange(m)
    modul = 0.5 + 0.5 * np.sin(2.0 * np.pi * (8.0 + rng.random() * 9.0) * t / FS)
    return amp * base * modul * env_creneau(m, 0.3, 0.45)


def coup_de_tonnerre(rng, force=1.0, distance=0.35, duree=None):
    """Tonnerre qui roule, comme dans les enregistrements de référence :
    plusieurs vagues de grondement qui se chevauchent, chacune avec sa
    propre extinction, plus un souffle grave qui reste après le coup.

    distance : 0 = tout proche (coup sec), 1 = très lointain (seulement
    un roulement sourd, sans aucune pointe)."""
    if duree is None:
        duree = 4.2 + rng.random() * 2.6
    m = int(duree * FS)
    t = np.arange(m) / FS

    # ── Vagues de roulement : c'est ce qui fait « rouler » le tonnerre.
    x = np.zeros(m)
    nombre = 3 + int(rng.integers(0, 3))
    for i in range(nombre):
        debut = 0.05 + i * (0.22 + rng.random() * 0.5) + rng.random() * 0.25
        if debut > duree * 0.55:
            continue
        retard = int(debut * FS)
        reste = m - retard
        tt = np.arange(reste) / FS
        bas = 26 + rng.random() * 60
        haut = 120 + rng.random() * 220
        vague = filtre(brun(reste, rng), bande(bas, haut, 3))
        vague /= (np.sqrt(np.mean(vague ** 2)) + 1e-9)
        montee = 0.05 + rng.random() * 0.22
        extinction = 0.7 + rng.random() * 1.5
        env = (1.0 - np.exp(-tt / montee)) * np.exp(-tt / extinction)
        env *= 0.72 + 0.28 * np.cos(2.0 * np.pi * (0.7 + rng.random() * 1.3) * tt + rng.random() * 6.0)
        # Granulation : des fluctuations rapides et irrégulières. Sans elles,
        # le tonnerre fait « whoosh » ; avec, il roule et moutonne.
        grain = np.ones(len(tt))
        for _ in range(5):
            fg = 3.0 + rng.random() * 14.0
            grain += (0.10 + rng.random() * 0.12) * np.sin(2.0 * np.pi * fg * tt + rng.random() * 6.0)
        env *= np.clip(grain, 0.35, 1.6)
        x[retard:] += vague * env * (1.0 - 0.22 * i)

    # ── Le souffle grave qui reste après le coup.
    fond = filtre(brun(m, rng), bande(20, 120, 2))
    fond /= (np.sqrt(np.mean(fond ** 2)) + 1e-9)
    x += fond * np.exp(-t / (2.2 + rng.random() * 1.2)) * 0.55

    # ── Le coup sec : seulement s'il n'est pas trop lointain, et feutré.
    if distance < 0.75:
        msec = int(0.22 * FS)
        tsec = np.arange(msec) / FS
        sec = rng.standard_normal(msec) * np.exp(-tsec / (0.02 + 0.03 * (1.0 - distance)))
        sec = filtre(sec, bande(70, 700 + 1800 * (1.0 - distance), 2))
        sec /= (np.max(np.abs(sec)) + 1e-9)
        x[:msec] += sec * 0.55 * (1.0 - distance)

    x = filtre(x, passe_bas(3600 - 1800 * distance, 4))
    fin = max(2, int(min(0.6, duree * 0.3) * FS))
    x[-fin:] *= np.linspace(1.0, 0.0, fin) ** 2
    return force * x


def sifflement_oiseau(rng, amp=1.0):
    m = int((0.16 + rng.random() * 0.14) * FS)
    t = np.arange(m) / FS
    f0 = 2200.0 + rng.random() * 1200.0
    excursion = (rng.random() - 0.5) * 1200.0
    phase = 2.0 * np.pi * (f0 * t + excursion * t ** 2 / (2 * m / FS))
    return amp * np.sin(phase) * env_creneau(m, 0.3, 0.55)


def klaxon(rng, amp=1.0):
    m = int(0.55 * FS)
    t = np.arange(m) / FS
    f = 380.0 + rng.random() * 70.0
    x = 0.7 * np.sin(2.0 * np.pi * f * t) + 0.3 * np.sin(2.0 * np.pi * f * 1.5 * t)
    return amp * filtre(x, passe_bas(2200, 4)) * env_creneau(m, 0.12, 0.4)


def passage_voiture(rng, duree=2.4, amp=1.0):
    m = int(duree * FS)
    base = souffle(m, rng, 120, 1600, 2)
    t = np.linspace(-1.0, 1.0, m)
    e = np.exp(-((t + 0.1) ** 2) / 0.09)
    grondement = brun(m, rng, 40.0, 240.0, 0.8)
    return amp * (0.5 * base + 0.9 * grondement * 2.0) * e


def clink(rng, amp=1.0):
    """Petite tasse posée sur une soucoupe."""
    m = int(0.16 * FS)
    t = np.arange(m) / FS
    f1 = 1900.0 + rng.random() * 1400.0
    x = np.sin(2.0 * np.pi * f1 * t) * np.exp(-t / 0.035)
    x += 0.55 * np.sin(2.0 * np.pi * f1 * 1.57 * t) * np.exp(-t / 0.025)
    x += 0.25 * souffle(m, rng, 2500, 7000, 2) * np.exp(-t / 0.006)
    return amp * x


def page(rng, amp=1.0):
    """Feuille tournée : froissement court et doux."""
    return froissement(rng, 0.20 + rng.random() * 0.18, amp, 900, 4200)


def pas(rng, amp=1.0):
    """Pas feutré : petit choc grave + frottement de semelle."""
    m = int(0.22 * FS)
    t = np.arange(m) / FS
    choc = np.sin(2.0 * np.pi * (95.0 + rng.random() * 30.0) * t) * np.exp(-t / 0.035)
    semelle = souffle(m, rng, 300, 2200, 2) * np.exp(-t / 0.05) * 0.5
    return amp * (choc + semelle) * env_creneau(m, 0.05, 0.5)


def syllabe(rng, duree, f1, f2, amp=1.0):
    """Fragment de parole murmurée : bruit doux modulé, jamais de voix robot."""
    m = int(duree * FS)
    t = np.arange(m) / FS
    base = souffle(m, rng, f1, f2, 2)
    base += 0.35 * souffle(m, rng, f1 * 0.6, f2 * 0.8, 2)
    base *= 0.65 + 0.35 * np.sin(2.0 * np.pi * (5.0 + rng.random() * 4.0) * t)
    return amp * base * env_creneau(m, 0.30, 0.55)


# ── Ambiances ───────────────────────────────────────────────────────────
#  Chaque ambiance est un mélange de bandes équilibrées (grave, médium, air)
#  plus quelques événements discrets. Aucune bande ne doit écraser les autres.
def son_pluie(rng):
    """☂️ Pluie — averse régulière : nappe douce + gouttes fines serrées."""
    lit = nappe(N, rng, 120, 600, 0.40, 0.55)
    lit += nappe(N, rng, 450, 2600, 0.25, 0.70)
    lit += nappe(N, rng, 1800, 6500, 0.10, 0.26)
    for _ in range(430):
        ajouter(lit, rng.random() * DUREE, goutte(rng, 850 + rng.random() * 2200, 0.012 + rng.random() * 0.02, 1.10))
    for _ in range(26):
        ajouter(lit, rng.random() * DUREE, goutte(rng, 480 + rng.random() * 800, 0.035 + rng.random() * 0.03, 1.60))
    return lit


def son_ocean(rng):
    """🌊 Océan — vagues qui montent et descendent, écume en crête."""
    houle = (0.5 + 0.5 * np.cos(2.0 * np.pi * (1.0 / DUREE) * T)) ** 1.5
    grave = nappe(N, rng, 40, 320, 0.55, 0.55) * (1.2 + 2.2 * houle)
    ressac = nappe(N, rng, 260, 1600, 0.40, 1.20) * (0.45 + 0.55 * houle)
    ecume = nappe(N, rng, 1200, 6000, 0.20, 0.50) * (0.10 + 0.90 * houle ** 2)
    return grave + ressac + ecume


def son_cafe(rng):
    """☕ Café animé — murmure de conversations, tasses, machine à café."""
    base = nappe(N, rng, 80, 320, 0.50, 0.30)
    base += nappe(N, rng, 250, 1300, 0.35, 0.85)
    base += nappe(N, rng, 1000, 5000, 0.20, 0.26)
    # Six conversations à voix basse : des syllabes douces, jamais une voix de robot.
    for i in range(6):
        f1 = 240.0 + rng.random() * 260.0
        voix = np.zeros(N)
        for _ in range(22):
            ajouter(voix, rng.random() * DUREE, syllabe(rng, 0.10 + rng.random() * 0.16, f1, f1 + 700 + rng.random() * 900, 0.45))
        base += filtre(voix, bande(220, 2600, 2))
    for _ in range(8):
        ajouter(base, rng.random() * DUREE, clink(rng, 0.45 + rng.random() * 0.25))
    for _ in range(3):
        m = int(1.1 * FS)
        vapeur = souffle(m, rng, 2500, 7000, 2) * 0.05 * env_creneau(m, 0.15, 0.35)
        ajouter(base, rng.random() * DUREE, vapeur)
    return base


def son_avion(rng):
    """✈️ Cabine d'avion — grondement sourd continu, souffle d'air conditionné."""
    moteur = nappe(N, rng, 45, 240, 0.50, 0.68)
    cabine = nappe(N, rng, 180, 1300, 0.40, 1.20)
    air = nappe(N, rng, 800, 5200, 0.25, 0.36)
    ronron = ton(N, 92.0) * 0.012 + ton(N, 184.0) * 0.004
    ronron *= 0.8 + 0.2 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T)
    return moteur + cabine + air + ronron


def son_salle(rng):
    """😰 Salle d'examen — silence tendu : papier, horloge, toux lointaine."""
    base = nappe(N, rng, 50, 220, 0.50, 0.12)
    base += nappe(N, rng, 220, 1400, 0.40, 0.30)
    base += nappe(N, rng, 800, 3500, 0.20, 0.05)
    for i in range(4):
        ajouter(base, i * 2.0 + rng.random() * 0.3, page(rng, 0.55 + rng.random() * 0.25))
    for i in range(8):
        m = int(0.06 * FS)
        tt = np.arange(m) / FS
        tic = np.sin(2.0 * np.pi * 780.0 * tt) * np.exp(-tt / 0.008)
        ajouter(base, i * 1.0 + 0.10, 0.18 * filtre(tic, passe_bas(2600, 3)))
    m = int(0.42 * FS)
    tt = np.arange(m) / FS
    toux = souffle(m, rng, 240, 1500, 2) * np.exp(-tt / 0.06) * 0.80
    ajouter(base, 3.4, toux)
    return base


def son_train(rng):
    """🚆 Train — roulement continu et claquements de bogies réguliers."""
    roulement = nappe(N, rng, 40, 280, 0.55, 0.72)
    roulement += nappe(N, rng, 220, 1600, 0.40, 0.95)
    roulement += nappe(N, rng, 700, 4200, 0.20, 0.28)
    rail_buf = np.zeros(N)
    for k in range(5):
        t0 = 0.35 + k * 1.6
        ajouter(rail_buf, t0, craquement(rng, 620.0, 0.030, 1.00))
        ajouter(rail_buf, t0 + 0.26, craquement(rng, 720.0, 0.028, 0.80))
        ajouter(rail_buf, t0, goutte(rng, 120.0, 0.06, 1.00))
    rail_buf = filtre(rail_buf, passe_bas(3200, 3))
    grincement = souffle(N, rng, 1500, 2400, 3) * 0.008
    grincement *= 0.6 + 0.4 * np.cos(2.0 * np.pi * (3.0 / DUREE) * T)
    return roulement + rail_buf + grincement


def son_bibliotheque(rng):
    """📚 Bibliothèque — calme feutré, pages tournées, soufflerie lointaine."""
    base = nappe(N, rng, 70, 350, 0.50, 0.18)
    base += nappe(N, rng, 300, 1800, 0.40, 0.55)
    base += nappe(N, rng, 900, 4500, 0.20, 0.20)
    for i in range(6):
        ajouter(base, i * 1.3 + rng.random() * 0.4, page(rng, 0.60 + rng.random() * 0.30))
    for i in range(2):
        ajouter(base, 2.2 + i * 3.3 + rng.random() * 0.4, pas(rng, 0.50))
    m = int(0.9 * FS)
    tt = np.arange(m) / FS
    chaise = np.sin(2.0 * np.pi * (620.0 + 80.0 * np.sin(2.0 * np.pi * 1.2 * tt)) * tt) * 0.006
    ajouter(base, 5.2, chaise * (0.5 + 0.5 * np.sin(2.0 * np.pi * 1.6 * tt)))
    return base


def son_matin(rng):
    """🚕 Matin en ville — circulation lointaine, oiseaux, un klaxon au loin."""
    circulation = nappe(N, rng, 45, 260, 0.55, 0.70)
    circulation *= 0.72 + 0.28 * np.cos(2.0 * np.pi * (1.0 / DUREE) * T)
    base = circulation + nappe(N, rng, 220, 1600, 0.40, 0.70) + nappe(N, rng, 800, 4500, 0.20, 0.22)
    for i in range(4):
        ajouter(base, i * 1.9 + rng.random() * 0.6, passage_voiture(rng, 2.0 + rng.random(), 1.00))
    for i in range(10):
        ajouter(base, rng.random() * DUREE, sifflement_oiseau(rng, 0.22 + rng.random() * 0.14))
    ajouter(base, 2.7, klaxon(rng, 0.45))
    ajouter(base, 6.1, klaxon(rng, 0.28))
    return base


def son_pluie_legere(rng):
    """☔ Pluie légère — gouttes espacées, fines, sans grondement."""
    base = nappe(N, rng, 150, 650, 0.45, 0.40)
    base += nappe(N, rng, 500, 3200, 0.30, 0.45)
    base += nappe(N, rng, 2000, 6800, 0.15, 0.14)
    for _ in range(150):
        ajouter(base, rng.random() * DUREE, goutte(rng, 1400 + rng.random() * 2600, 0.008 + rng.random() * 0.012, 0.90))
    for _ in range(18):
        ajouter(base, rng.random() * DUREE, goutte(rng, 700 + rng.random() * 700, 0.03, 1.20))
    return base


def son_pluie_forte(rng):
    """🌧️ Forte pluie — averse dense, grosses gouttes et ruissellement."""
    base = nappe(N, rng, 70, 450, 0.50, 0.70)
    base += nappe(N, rng, 300, 2600, 0.30, 0.95)
    base += nappe(N, rng, 1500, 6800, 0.15, 0.40)
    for _ in range(750):
        ajouter(base, rng.random() * DUREE, goutte(rng, 650 + rng.random() * 1600, 0.018 + rng.random() * 0.04, 1.00))
    base += nappe(N, rng, 150, 620, 0.45, 0.20) * (0.5 + 0.5 * np.cos(2.0 * np.pi * (3.0 / DUREE) * T))
    return base


def son_orage(rng):
    """⛈️ Orage — pluie soutenue et tonnerre qui roule au loin.

    Références : « rumbling thunder and rain », le tonnerre arrive quelques
    secondes après l'éclair et roule longuement sur le paysage ; la pluie
    reste continue derrière."""
    # 1. La pluie : présente, dense, mais elle ne doit pas couvrir le tonnerre.
    pluie = nappe(N, rng, 80, 450, 0.50, 0.30)
    pluie += nappe(N, rng, 300, 2400, 0.30, 0.60)
    pluie += nappe(N, rng, 1400, 6500, 0.15, 0.28)
    for _ in range(320):
        ajouter(pluie, rng.random() * DUREE, goutte(rng, 800 + rng.random() * 1800, 0.014 + rng.random() * 0.03, 0.55))

    # 2. Un vent de rafale discret, comme dans un vrai orage.
    rafale = 0.4 + 0.6 * (0.5 + 0.5 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T + 1.1))
    pluie += nappe(N, rng, 250, 1200, 0.45, 0.14) * rafale

    # 3. Le tonnerre : d'abord lointain, puis plus proche, puis lointain
    #    à nouveau. Chaque coup roule longuement par-dessus la pluie.
    orage = np.zeros(N)
    ajouter(orage, 0.30, coup_de_tonnerre(rng, 0.55, distance=0.85, duree=2.3))
    ajouter(orage, 2.10, coup_de_tonnerre(rng, 1.30, distance=0.18, duree=3.4))

    # Le tonnerre domine largement : c'est lui qu'on doit entendre.
    return pluie * 0.58 + orage * 1.70


def son_cheminee(rng):
    """🔥 Cheminée — le foyer qui ronfle, le souffle d'air dans le conduit
    (le « whoosh » que l'on entend dans une vraie cheminée) et des
    craquements de bois bien détachés du fond.

    Références : « crackling firewood over a warm burning hearth », et le
    bruit d'air aspiré vers le haut du conduit."""
    # 1. Le foyer : un ronflement chaud, grave et médium.
    foyer = nappe(N, rng, 55, 230, 0.55, 0.44)
    braise = nappe(N, rng, 200, 900, 0.35, 0.30)

    # 2. Le tirage dans le conduit : souffle d'air qui monte, irrégulier.
    bouffees = np.zeros(N)
    for cycles, phase, poids in ((2, 0.0, 0.5), (3, 2.1, 0.3), (5, 4.4, 0.2)):
        bouffees += poids * (0.5 + 0.5 * np.cos(2.0 * np.pi * cycles * T / DUREE + phase))
    bouffees = 0.45 + 0.55 * bouffees
    conduit = nappe(N, rng, 300, 1500, 0.45, 0.26) * bouffees
    conduit += nappe(N, rng, 700, 4200, 0.30, 0.26) * bouffees

    # Frémissement de la combustion : de petites fluctuations rapides
    # (7 et 11 par seconde), très discrètes, qui donnent vie au foyer.
    fremissement = np.zeros(N)
    for cycles_par_seconde, phase in ((7.0, 0.7), (11.0, 2.9), (17.0, 4.2)):
        cycle = round(cycles_par_seconde * DUREE)
        fremissement += 0.5 * np.cos(2.0 * np.pi * cycle * T / DUREE + phase)
    fremissement = 0.90 + 0.10 * fremissement / 3.0

    # Le fond reste bien en dessous des craquements : c'est le craquement
    # qui doit dominer, comme dans une vraie cheminée.
    base = ((foyer + braise) * 0.18 + conduit * 0.13) * fremissement

    # 3. Les craquements, en trois familles comme dans un vrai feu :
    #    beaucoup de petits tics, des craquements moyens, quelques gros.
    for _ in range(110):
        ajouter(base, rng.random() * DUREE, craquement_bois(rng, 0.12 + rng.random() * 0.18, 0.22 + rng.random() * 0.26))
    for _ in range(16):
        debut = rng.random() * DUREE
        for _ in range(int(rng.integers(3, 7))):
            ajouter(base, debut + rng.random() * 0.25, craquement_bois(rng, 0.2 + rng.random() * 0.3, 0.26 + rng.random() * 0.3))
    for _ in range(10):
        ajouter(base, rng.random() * DUREE, craquement_bois(rng, 0.5 + rng.random() * 0.2, 0.40 + rng.random() * 0.22))
    for _ in range(4):
        ajouter(base, 0.6 + rng.random() * 6.4, craquement_bois(rng, 0.95, 0.42 + rng.random() * 0.16))
    # 4. Les braises : de minuscules pétillements très aigus, comme les
    #    escarbilles qui éclatent. Ils donnent le « crépitement » du feu
    #    sans jamais ressembler à un chuintement de radio.
    for _ in range(120):
        m = max(12, int((0.003 + rng.random() * 0.004) * FS))
        tt = np.arange(m) / FS
        tic = rng.standard_normal(m) * np.exp(-tt / (0.0008 + rng.random() * 0.0012))
        tic = filtre(tic, bande(2200 + rng.random() * 1800, 7800, 2))
        tic /= (np.max(np.abs(tic)) + 1e-9)
        ajouter(base, rng.random() * DUREE, tic * (0.10 + rng.random() * 0.14))
    return base


def son_feu(rng):
    """🪵 Feu de camp — bois qui éclate, vent léger au-dessus des flammes."""
    base = nappe(N, rng, 60, 380, 0.55, 0.75)
    base *= 0.9 + 0.1 * np.cos(2.0 * np.pi * (2.0 / DUREE) * T)
    base += nappe(N, rng, 280, 1800, 0.40, 0.65)
    base += nappe(N, rng, 700, 4500, 0.20, 0.25)
    for _ in range(40):
        ajouter(base, rng.random() * DUREE, craquement(rng, 240 + rng.random() * 420, 0.05 + rng.random() * 0.05, 1.30))
    for _ in range(55):
        ajouter(base, rng.random() * DUREE, craquement(rng, 900 + rng.random() * 2200, 0.005, 0.55))
    return base


def son_bureau(rng):
    """🏢 Bureau — frappe de clavier par salves, imprimante, soufflerie."""
    base = nappe(N, rng, 80, 420, 0.50, 0.18)
    base += nappe(N, rng, 300, 1900, 0.40, 0.55)
    base += nappe(N, rng, 1000, 5200, 0.20, 0.22)
    t0 = 0.4
    while t0 < DUREE - 0.4:
        for _ in range(rng.integers(5, 12)):
            t0 += 0.07 + rng.random() * 0.09
            ajouter(base, t0, tape(rng, 700, 2800, 0.80))
        t0 += 0.55 + rng.random() * 0.7
    m = int(0.7 * FS)
    tt = np.arange(m) / FS
    imprimante = np.sin(2.0 * np.pi * (120.0 + 18.0 * np.sin(2.0 * np.pi * 7.0 * tt)) * tt) * 0.02
    imprimante += souffle(m, rng, 500, 1800, 2) * 0.02 * (0.4 + 0.6 * np.sin(2.0 * np.pi * 9.0 * tt) ** 2)
    ajouter(base, 4.6, imprimante * env_creneau(m, 0.15, 0.3))
    return base


# 🌬️ Vent : n'est plus fabriqué ici. Le son vient de l'enregistrement « Vents.mp3 »
# fourni par Juliss (Drive Study Plan, 2 h, 44,1 kHz) : tools/extrait-vent.py y
# découpe un passage stable de 7,91 s, le boucle et écrit
# audio/pomodoro/vent.wav. Ne pas remettre de version synthétique ici : lancer
# main() écraserait ce fichier.


def son_blanc(rng):
    """🧠 Bruit blanc — plat, régulier, uniforme (aigus adoucis)."""
    return nappe(N, rng, 40, 11000, 0.0, 1.0)


def son_rose(rng):
    """🩷 Bruit rose — plus doux dans les aigus que le blanc."""
    return nappe(N, rng, 25, 9000, 0.5, 1.0)


def son_brun(rng):
    """🟤 Bruit brun — grave, profond, enveloppant."""
    return nappe(N, rng, 25, 5000, 1.0, 1.0) + nappe(N, rng, 60, 400, 0.4, 0.25)


SONS = [
    ('pluie', son_pluie, 0.075, 9000.0),
    ('ocean', son_ocean, 0.075, 8000.0),
    ('cafe', son_cafe, 0.070, 7000.0),
    ('avion', son_avion, 0.078, 6000.0),
    ('salle', son_salle, 0.060, 6000.0),
    ('train', son_train, 0.078, 6500.0),
    ('bibliotheque', son_bibliotheque, 0.062, 6500.0),
    ('matin', son_matin, 0.075, 7000.0),
    ('pluie-legere', son_pluie_legere, 0.068, 8000.0),
    ('pluie-forte', son_pluie_forte, 0.082, 8500.0),
    ('orage', son_orage, 0.084, 8500.0),
    ('cheminee', son_cheminee, 0.075, 7000.0),
    ('feu', son_feu, 0.075, 7500.0),
    ('bureau', son_bureau, 0.070, 6000.0),
    ('blanc', son_blanc, 0.070, 11000.0),
    ('rose', son_rose, 0.072, 9000.0),
    ('brun', son_brun, 0.078, 5000.0),
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


def binaural(rng, porteuse, battement, rms_cible=0.055):
    """Battement binaural posé très bas sous un lit chaud.
    Les deux sons purs ne sont plus en avant : plus d'effet « fréquence radio ».
    Le battement reste exact et la boucle est parfaite (porteuses entières
    sur la longueur du fichier)."""
    lit = nappe(N, rng, 35, 900, 0.60, 0.80)
    lit += nappe(N, rng, 220, 1600, 0.40, 0.45)
    lit += nappe(N, rng, 600, 3000, 0.20, 0.15)
    gain_porteuse = 0.045
    # Porteuses justes sur 8 s (200 / 240 / 220 Hz) : l'écart de battement
    # est exactement 40 Hz ou 20 Hz, sans dérive.
    g = ton(N, porteuse) * gain_porteuse + ton(N, porteuse * 3.0) * 0.003
    d = ton(N, porteuse + battement) * gain_porteuse + ton(N, porteuse * 3.0 + battement) * 0.003
    respiration = 0.85 + 0.15 * np.cos(2.0 * np.pi * (1.0 / DUREE) * T)
    gabarit = lit * 0.9 + g * respiration
    _, k = boucler(gabarit)
    gauche, _ = boucler(lit * 0.9 + g * respiration, index=k)
    droite, _ = boucler(lit * 0.9 + d * respiration, index=k)
    stereo = np.vstack([gauche, droite])
    stereo = np.vstack([filtre(stereo[0], passe_haut(28.0, 2)), filtre(stereo[1], passe_haut(28.0, 2))])
    r = float(np.sqrt(np.mean(stereo ** 2)))
    stereo = stereo * (rms_cible / r)
    p = float(np.max(np.abs(stereo)))
    if p > 0.9:
        stereo = stereo * (0.9 / p)
    return stereo


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lignes = []
    for nom, fabrique, rms, coupe in SONS:
        rng = np.random.default_rng(zlib.crc32(nom.encode('utf-8')))
        x, _ = boucler(masteriser(fabrique(rng), rms, coupe_haut=coupe))
        chemin, taille = ecrire_wav(nom, x)
        lignes.append((nom, 'mono', taille, float(np.sqrt(np.mean(x ** 2))), float(np.max(np.abs(x)))))
    for nom, porteuse, battement in (('gamma', 200.0, 40.0), ('beta', 200.0, 20.0)):
        rng = np.random.default_rng(zlib.crc32(nom.encode('utf-8')))
        x = binaural(rng, porteuse, battement)
        chemin, taille = ecrire_wav(nom, x)
        lignes.append((nom, 'stéréo', taille, float(np.sqrt(np.mean(x ** 2))), float(np.max(np.abs(x)))))
    for nom, canaux, taille, r, p in sorted(lignes):
        print(f'{nom:14s} {canaux:7s} {taille:9d} o   rms {r:.3f}   crête {p:.3f}')


if __name__ == '__main__':
    main()
