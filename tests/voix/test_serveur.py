#!/usr/bin/env python3
"""Tests réels de l'API et du traitement, sans hébergeur externe."""
import concurrent.futures
import importlib.util
import os
import subprocess
import tempfile
import threading
from http.client import HTTPConnection
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('service_voix', ROOT / 'services/voix/serveur.py')
service = importlib.util.module_from_spec(spec); spec.loader.exec_module(service)
service.FFMPEG = os.environ.get('STUDY_FFMPEG', 'ffmpeg')
serveur = service.Serveur(('127.0.0.1', 0), service.Gestionnaire)
thread = threading.Thread(target=serveur.serve_forever, daemon=True); thread.start()
port = serveur.server_port


def requete(path, headers=None, method='GET'):
    connexion = HTTPConnection('127.0.0.1', port, timeout=90)
    try:
        connexion.request(method, path, headers=headers or {})
        reponse = connexion.getresponse(); corps = reponse.read()
        return reponse.status, dict(reponse.getheaders()), corps
    finally:
        connexion.close()


def duree(data):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(data); f.flush()
        return len(service.audio.extraire(service.FFMPEG, f.name)) / service.audio.RATE


try:
    assert requete('/healthz')[0] == 200
    for path in ['/v1/audio', '/v1/audio?message=pause&minutes=0',
                 '/v1/audio?message=pause&minutes=61', '/v1/audio?message=pause&minutes=01',
                 '/v1/audio?message=pause&minutes=21&debit=999',
                 '/v1/audio?message=pause&minutes=21&minutes=5',
                 '/v1/audio?message=pause&minutes=21&file=/etc/passwd',
                 '/v1/audio?message=fin-serie&minutes=2',
                 '/v1/audio?message=pause&minutes=21&finale=true']:
        assert requete(path)[0] == 400, path
    assert requete('/etc/passwd')[0] == 404
    base = '/v1/audio?message=fin-serie&debit='
    mesures = {}
    for debit in ('lent', 'normal', 'rapide'):
        statut, headers, corps = requete(base + debit, {'Origin': service.ORIGIN})
        assert statut == 200 and headers['Content-Type'] == 'audio/mpeg'
        assert headers['Access-Control-Allow-Origin'] == service.ORIGIN
        assert headers['X-Voice-Cache'] == 'miss'
        mesures[debit] = duree(corps)
        statut, headers, corps2 = requete(base + debit, {'Origin': 'https://hostile.example'})
        assert statut == 200 and corps == corps2 and headers['X-Voice-Cache'] == 'hit'
        assert 'Access-Control-Allow-Origin' not in headers
        etag = headers['ETag']
        statut, headers, corps = requete(base + debit, {'If-None-Match': etag})
        assert statut == 304 and not corps and 'Content-Length' not in headers
    assert mesures['lent'] > mesures['normal'] > mesures['rapide'], mesures
    print('Débits de la phrase finale (secondes) :', mesures)

    # Nouvelle prise complète réservée à l'écoute, sans raccord à l'intérieur
    # des mots signalés. On ne retire que le centre du silence entre phrases.
    source = ROOT / 'livrables/stock-voix/messages/essai-clair-5.wav'
    intervalle = service.audio.silence_interne(service.FFMPEG, source, 1.7, 3.1, .5)
    brut = service.audio.extraire(service.FFMPEG, source)
    traite = service.audio.compresser_pause(brut, intervalle, cible=.35)
    assert traite[:round(intervalle[0] * service.audio.RATE)] == brut[:round(intervalle[0] * service.audio.RATE)]
    assert traite[-round((len(brut) / service.audio.RATE - intervalle[1]) * service.audio.RATE):] == brut[-round((len(brut) / service.audio.RATE - intervalle[1]) * service.audio.RATE):]
    statut, _, essai = requete('/v1/audio?message=essai-clair&debit=normal')
    assert statut == 200 and 3 < duree(essai) < len(brut) / service.audio.RATE

    # Phrase complète pour les deux extrêmes et 21, y compris la fin de série.
    for n, finale in ((1, 0), (5, 0), (21, 0), (21, 1), (60, 0)):
        statut, headers, corps = requete(f'/v1/audio?message=pause&minutes={n}&debit=normal&finale={finale}')
        assert statut == 200 and 4 < duree(corps) < 20, (n, finale)
        assert int(headers['Content-Length']) == len(corps)
        if n == 5:
            assert corps == (ROOT / 'livrables/publication-voix/essai-prononciation-claire-5.mp3').read_bytes()
    for debit, finale in (('normal', 1), ('lent', 0), ('rapide', 0)):
        statut, _, corps = requete(f'/v1/audio?message=pause&minutes=5&debit={debit}&finale={finale}')
        assert statut == 200 and duree(corps) > 3

    # Vérifie avant encodage et en dehors du fondu que la durée approuvée ne
    # subit pas le changement de débit, pour les trois réglages.
    milieu = service.audio.rogner_bords(service.audio.extraire(service.FFMPEG, service.audio.fichier_duree(21)))
    enc = service.encoder
    service.encoder = lambda signal: signal
    try:
        for debit in service.DEBITS:
            assemblage = service.generer('pause', debit, 21, False)
            marge = round(.02 * service.audio.RATE)
            assert milieu[marge:-marge].tobytes() in assemblage.tobytes()
    finally:
        service.encoder = enc

    # Un même calcul concurrent est partagé et stocké une seule fois.
    autre = service.Service(); original = service.generer; compte = []
    def fake(*args):
        import time
        compte.append(args); time.sleep(.1); return b'audio'
    service.generer = fake
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
            res = list(pool.map(lambda _: autre.obtenir(('pause', 'normal', 5, False)), range(10)))
        assert len(compte) == 1 and sum(not hit for _, hit in res) == 1
    finally:
        service.generer = original
    print('OK API HTTP, CORS, cache, bornes, concurrence et prise 21 préservée')
finally:
    serveur.shutdown(); serveur.server_close(); thread.join()
