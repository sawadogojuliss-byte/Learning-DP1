#!/usr/bin/env python3
"""Service HTTP d'annonces Pomodoro, sans synthèse ni données personnelles.

Le service travaille exclusivement sur les prises fournies avec Studyplan.
Les débits sont bornés et les durées approuvées ne sont jamais retimées.
"""
import hashlib
import importlib.util
import io
import logging
import os
from array import array
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import subprocess
import sys
import threading
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('preparer_annonces', ROOT / 'tools/preparer-annonces-fluides.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)
LOG = logging.getLogger('voix')
FFMPEG = os.environ.get('STUDY_FFMPEG', 'ffmpeg')
ORIGIN = os.environ.get('STUDY_VOIX_ORIGIN', 'https://sawadogojuliss-byte.github.io')
DEBITS = {'lent': '0.85', 'normal': '1.00', 'rapide': '1.15'}
VERSION = 'v1-20261109a'
MAX_REQUEST = 2048
MAX_CACHE = 96

# Lorsqu'un des enregistrements sources change, ne pas supposer que les
# repères phonétiques et les silences précédemment mesurés sont encore valides.
SOURCES = {
    ROOT / 'livrables/stock-voix/messages/annonce-debut.wav': '86d2aa33a4aa7fd774f7251ccb0184b5dd45dffe28edf863b3438313b43dca91',
    ROOT / 'livrables/stock-voix/messages/annonce-de-pause.wav': '0a9bb04c742d64cceff6e83681667239b82f8398127ed84157221822e0af1f47',
    ROOT / 'livrables/stock-voix/messages/essai-clair-5.wav': '401b69f4ea25ec4a266642de7501500ef97c013b2529abf03bc8731d85afe2ff',
    ROOT / 'livrables/publication-voix/essai-prononciation-claire-5.mp3': 'ab979aaeae858c2ee8da999e4e6ae843349fb4348afa2529b3607bd80fc99e9c',
}


def verifier_sources():
    for fichier, attendu in SOURCES.items():
        if hashlib.sha256(fichier.read_bytes()).hexdigest() != attendu:
            raise RuntimeError('Une prise a changé : les repères doivent être vérifiés')


def ffmpeg_commande(args, donnees=None):
    resultat = subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', *args],
                              input=donnees, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              timeout=30, check=True)
    return resultat.stdout


def octets_pcm(donnees):
    donnees = array('h', donnees)
    if sys.byteorder != 'little':
        donnees.byteswap()
    return donnees.tobytes()


def changer_debit(donnees, debit):
    if debit == 'normal':
        return donnees[:]
    raw = ffmpeg_commande(['-f', 's16le', '-ar', str(audio.RATE), '-ac', '1', '-i', 'pipe:0',
                           '-filter:a', 'atempo=' + DEBITS[debit], '-f', 's16le', 'pipe:1'], octets_pcm(donnees))
    sortie = array('h'); sortie.frombytes(raw)
    if sys.byteorder != 'little':
        sortie.byteswap()
    return sortie


def encoder(donnees):
    return ffmpeg_commande(['-f', 's16le', '-ar', str(audio.RATE), '-ac', '1', '-i', 'pipe:0',
                            '-codec:a', 'libmp3lame', '-b:a', '160k', '-f', 'mp3', 'pipe:1'], octets_pcm(donnees))


def generer(message, debit, minutes=None, finale=False):
    verifier_sources()
    if message == 'fin-serie':
        prise = audio.extraire(FFMPEG, ROOT / 'livrables/stock-voix/messages/fin-serie.wav')
        return encoder(changer_debit(prise, debit))
    if message == 'essai-clair':
        # Prise d'une phrase complète : aucun raccord autour de « maintenant »
        # ou « de ». Seul le long silence entre les deux phrases est réduit.
        fichier = ROOT / 'livrables/stock-voix/messages/essai-clair-5.wav'
        intervalle = audio.silence_interne(FFMPEG, fichier, 1.7, 3.1, .5)
        prise = audio.compresser_pause(audio.extraire(FFMPEG, fichier), intervalle, cible=.35)
        return encoder(changer_debit(prise, debit))
    if minutes == 5:
        # Prise complète acceptée : aucun raccord devant le nombre. Le débit
        # normal et la pause non finale renvoient exactement le MP3 approuvé.
        approuve = ROOT / 'livrables/publication-voix/essai-prononciation-claire-5.mp3'
        if debit == 'normal' and not finale:
            return approuve.read_bytes()
        phrase = changer_debit(audio.extraire(FFMPEG, approuve), debit)
        if finale:
            final = audio.rogner_bords(audio.extraire(FFMPEG, ROOT / 'livrables/stock-voix/messages/fin-serie.wav'))
            phrase = changer_debit(final, debit) + array('h', [0]) * round(.3 * audio.RATE) + phrase
        return encoder(phrase)
    debut = ROOT / 'livrables/stock-voix/messages/annonce-debut.wav'
    fin = ROOT / 'livrables/stock-voix/messages/annonce-de-pause.wav'
    # Ces paramètres sont les mêmes que pour l'essai antérieur, non validé.
    pause_debut = audio.silence_interne(FFMPEG, debut, 3.8, 5.10, .35)
    pause_fin = audio.silence_interne(FFMPEG, fin, .25, 1.10, .20)
    prefixe = audio.rogner_bords(audio.compresser_pause(audio.extraire(FFMPEG, debut), pause_debut))
    suffixe = audio.rogner_bords(audio.compresser_pause(audio.extraire(FFMPEG, fin), pause_fin))
    # Le nombre, y compris la prononciation validée de 21, est inchangé.
    milieu = audio.rogner_bords(audio.extraire(FFMPEG, audio.fichier_duree(minutes)))
    phrase = audio.fondu(audio.fondu(changer_debit(prefixe, debit), milieu), changer_debit(suffixe, debit))
    if finale:
        final = audio.rogner_bords(audio.extraire(FFMPEG, ROOT / 'livrables/stock-voix/messages/fin-serie.wav'))
        phrase = changer_debit(final, debit) + array('h', [0]) * round(.3 * audio.RATE) + phrase
    return encoder(phrase)


def lire_parametres(chemin):
    if len(chemin) > MAX_REQUEST:
        raise ValueError('Requête trop longue')
    url = urlsplit(chemin)
    if url.path != '/v1/audio':
        raise LookupError('Ressource inexistante')
    params = parse_qs(url.query, keep_blank_values=True, strict_parsing=True, max_num_fields=4)
    if not set(params) <= {'message', 'minutes', 'debit', 'finale'} or any(len(v) != 1 for v in params.values()):
        raise ValueError('Paramètres inconnus ou répétés')
    message = params.get('message', [''])[0]
    debit = params.get('debit', ['normal'])[0]
    if message not in ('fin-serie', 'pause', 'essai-clair') or debit not in DEBITS:
        raise ValueError('Message ou débit non reconnu')
    if message in ('fin-serie', 'essai-clair'):
        if 'minutes' in params or 'finale' in params:
            raise ValueError('Paramètres inutiles pour ce message')
        return (message, debit, None, False)
    valeur = params.get('minutes', [''])[0]
    if not re.fullmatch(r'(?:[1-9]|[1-5][0-9]|60)', valeur):
        raise ValueError('La durée doit être un entier de 1 à 60')
    finale = params.get('finale', ['0'])[0]
    if finale not in ('0', '1'):
        raise ValueError('Valeur de finale incorrecte')
    return (message, debit, int(valeur), finale == '1')


class Service:
    def __init__(self):
        self.cache = OrderedDict()
        self.lock = threading.Lock()
        # Une seule génération à la fois : déduplication et borne CPU, la
        # lecture des sons déjà en cache ne passe pas par ce verrou.
        self.calcul = threading.Lock()

    def obtenir(self, cle):
        with self.lock:
            if cle in self.cache:
                self.cache.move_to_end(cle)
                return self.cache[cle], True
        with self.calcul:
            with self.lock:
                if cle in self.cache:
                    self.cache.move_to_end(cle)
                    return self.cache[cle], True
            resultat = generer(*cle)
            with self.lock:
                self.cache[cle] = resultat
                while len(self.cache) > MAX_CACHE:
                    self.cache.popitem(last=False)
            return resultat, False


class Serveur(ThreadingHTTPServer):
    daemon_threads = True
    # Limite le nombre de requêtes en cours, y compris celles en attente
    # d'un calcul ; évite de lancer un thread illimité par client.
    def __init__(self, adresse, gestionnaire, service=None):
        super().__init__(adresse, gestionnaire)
        self.service = service or Service()
        self.places = threading.BoundedSemaphore(12)

    def process_request(self, request, client_address):
        if not self.places.acquire(blocking=False):
            try:
                request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nRetry-After: 2\r\nContent-Length: 0\r\nConnection: close\r\n\r\n')
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.places.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.places.release()


class Gestionnaire(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'StudyplanVoice/1'
    sys_version = ''

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, fmt, *args):
        # Pas de données de profil ; ne pas journaliser les URL ou adresses IP.
        LOG.info('Requête vocale traitée')

    def repondre(self, statut, corps=b'', type_contenu='text/plain; charset=utf-8', headers=None):
        self.send_response(statut)
        self.send_header('Content-Type', type_contenu)
        if statut != 304:
            self.send_header('Content-Length', str(len(corps)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Vary', 'Origin')
        if self.headers.get('Origin') == ORIGIN:
            self.send_header('Access-Control-Allow-Origin', ORIGIN)
        for nom, valeur in (headers or {}).items():
            self.send_header(nom, valeur)
        self.end_headers()
        if self.command != 'HEAD':
            try:
                self.wfile.write(corps)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.path == '/healthz':
            return self.repondre(200, b'ok\n', headers={'Cache-Control': 'no-store'})
        try:
            cle = lire_parametres(self.path)
        except LookupError:
            return self.repondre(404, b'Not found\n')
        except ValueError:
            return self.repondre(400, b'Invalid parameters\n')
        try:
            contenu, hit = self.server.service.obtenir(cle)
        except (OSError, RuntimeError, ValueError, subprocess.SubprocessError):
            LOG.exception('Echec du traitement audio')
            return self.repondre(503, b'Audio unavailable\n', headers={'Cache-Control': 'no-store', 'Retry-After': '5'})
        etag = '"' + hashlib.sha256(contenu).hexdigest() + '"'
        headers = {'Cache-Control': 'public, max-age=86400', 'ETag': etag, 'X-Voice-Version': VERSION, 'X-Voice-Cache': 'hit' if hit else 'miss'}
        if self.headers.get('If-None-Match') == etag:
            return self.repondre(304, headers=headers)
        return self.repondre(200, contenu, 'audio/mpeg', headers)


def main():
    logging.basicConfig(level=logging.INFO)
    verifier_sources()
    ffmpeg_commande(['-version'])
    port = int(os.environ.get('PORT', '8080'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT invalide')
    serveur = Serveur((os.environ.get('HOST', '0.0.0.0'), port), Gestionnaire)
    LOG.info('Service prêt sur le port %d', port)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        serveur.server_close()


if __name__ == '__main__':
    main()
